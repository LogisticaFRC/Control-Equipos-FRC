# Control AFI & Programación — FRC (versión modular)

Aplicación Vue 3 + Supabase separada en módulos. **No requiere compilación**: se sube la carpeta completa al hosting tal cual.

> ⚠️ Debe abrirse desde un servidor web (Netlify, GitHub Pages, hosting propio…). Con doble clic (`file://`) los módulos JS no cargan.
> Para probar en el PC: `npx serve .` o `python -m http.server` dentro de la carpeta.

## Estructura

```
index.html                     ← liviano: solo carga librerías y js/main.js
css/styles.css                 ← estilos globales (parpadeo horómetro, scrollbars)
js/
  main.js                      ← arma la app: header, menú, pestañas y modales
  core/
    supabase.js                ← conexión, helper sb() que detecta errores, subida de archivos
    tablas.js                  ← nombres EXACTOS de las tablas de Supabase
    store.js                   ← estado compartido (usuario, tablas cargadas) y carga de datos
    utils.js                   ← fechas, números, AFI, CSV, lectura de Excel
    horometros.js              ← cálculo predictivo de horómetros / próxima mantención
    comunes.js                 ← funciones que usan todas las pantallas
    sesion.js                  ← sesión persistente (F5 no cierra sesión), cierre por 5 min de inactividad, pestaña en la URL
  modules/
    dashboard/                 ← DASHBOARD
    inventario/                ← INVENTARIO AFI (+ Perfil de Equipo y modal Nuevo Equipo)
    programas/                 ← PROGRAMAS (+ modales Crear Programa / Asignar Equipo)
    movimientos/               ← MOVIMIENTOS (+ modal Registrar Movimiento)
    historial/                 ← HISTORIAL (+ formulario de Mantención)
    aceites/                   ← CONTROL ACEITES
    configuracion/             ← CONFIG & USUARIOS (+ Login)
    formatos/                  ← FORMATOS (Área → Norma ISO) + carpeta de documentos reutilizable (también Ficha Técnica de equipos)
```

Cada módulo tiene:
- `*.template.js` → el HTML de la pantalla
- `*.service.js` → la lógica (filtros, guardar, eliminar, importar)
- `*.view.js` → el componente que une plantilla + lógica
- `*.mapper.js` → (si aplica) cómo se convierte la fila de Supabase al objeto de la app

## ✅ Acción requerida en Supabase

1. **Agregar la columna `horometro` a `bd_programas_items`** (la tabla "Horómetro realizado" de los Programas de Mantención no tiene dónde guardarse):
   ```sql
   ALTER TABLE public.bd_programas_items ADD COLUMN IF NOT EXISTS horometro numeric;
   ```
   Mientras no exista, la app guarda igual las fechas y el estado, y avisa que el horómetro no se guardó.
2. **Tabla `bd_formatos`** (Formatos y Fichas Técnicas). Si ya existe con `carpeta`, `nombre`, `link`, no hay que hacer nada; si no:
   ```sql
   CREATE TABLE IF NOT EXISTS public.bd_formatos (
     id bigserial PRIMARY KEY, carpeta text NOT NULL, nombre text, link text NOT NULL, created_at timestamptz DEFAULT now()
   );
   ```
   Debe permitir leer/insertar/eliminar con la clave `anon` (igual que las demás tablas) y el bucket `archivos_frc` debe ser público.
3. Verificar que las políticas RLS de `bd_programas_calendarios` y `bd_programas_items` permitan leer/escribir con la clave `anon` (como las demás tablas).

## Errores corregidos

### Contra la base de datos (confirmados con el esquema)
| # | Problema | Corrección |
|---|----------|------------|
| 1 | Las tablas de programas se consultaban como `BD_PROGRAMAS_CALENDARIOS` / `BD_PROGRAMAS_ITEMS`, pero en la BD son **minúsculas** (Supabase distingue mayúsculas) → los programas no se guardaban ni cargaban. | Nombres corregidos en `core/tablas.js`. |
| 2 | Los filtros usados se guardaban en `kit_bodega` pero se leían de `filtros_json` (no existe) → siempre "Sin filtros". | Se lee y guarda en `kit_bodega`. |
| 3 | El refrigerante se buscaba como `aceite_refrigerante_50` (no existe) → nunca aparecía en Control Aceites. | Se usa `aceite_refrigerante_5050`. |
| 4 | Se enviaba `horometro` al crear ítems de programa y esa columna no existe → la asignación fallaba. | Ya no se envía al crear (ver acción requerida). |
| 5 | `frecuencia_mantencion` es `integer` y se podía enviar con decimales. | Se redondea. |

### Lógica
- **Errores de Supabase ocultos:** supabase-js no lanza excepciones, así que los `try/catch` vacíos mostraban "¡Guardado!" aunque fallara. Ahora todas las operaciones avisan el error real.
- **Asignaciones falsas:** si fallaba una asignación a un programa, el original igual agregaba un registro en pantalla que desaparecía al recargar. Eliminado.
- **Horómetro desde mantención:** al registrar una mantención se actualizaba el horómetro del equipo pero no su fecha, y eso falseaba el uso hrs/día. Ahora se actualizan ambos y solo si el historial se guardó bien.
- **Horómetro "NaN":** salía en equipos sin fecha de horómetro.
- **Filtro "Tipo Mantención" del Historial:** no encontraba nada (buscaba "PREVENTIVA" exacto y lo guardado es "PREVENTIVA 250 HRS").
- **"Tipo en horas":** siempre quedaba en "250 hrs". Ahora se toma del tipo elegido (ej. 500 hrs).
- **Fechas por defecto:** usaban UTC (después de las 21:00 en Chile daban el día siguiente). Ahora usan la hora local.
- **Permisos:** los usuarios de **solo lectura** podían cambiar el ON/OFF, las fechas y los horómetros de los programas. Ahora están bloqueados.
- **Perfil de equipo:** los gráficos se actualizan al cambiar los filtros. La lista de causas muestra solo las de ese equipo.
- **Importar inventario:** sobrescribía la frecuencia (250) y el horómetro (0) de equipos existentes si el Excel no traía esas columnas. Ahora solo actualiza las columnas que vienen en el archivo.
- **Importar movimientos:** ahora incluye el camión.
- **Control Aceites:** con un tipo de aceite seleccionado, "Suma Total" suma solo ese tipo.
- **Alta de equipo:** no permite crear un AFI duplicado.
- **Errores de carga:** si una tabla falla al cargar, se avisa en la consola en vez de cortar silenciosamente.

### Visual / técnico
- La pestaña del navegador mostraba `{{ config.title }}` y el "Color Body" nunca se aplicaba (estaban fuera de Vue).
- Se cargaban 2 versiones de Tailwind, una de ellas no funciona en navegador. Las librerías ahora tienen versión fija.
- `via.placeholder.com` ya no existe (el logo y las fotos salían rotos). Se reemplazó por una imagen generada localmente.
- La columna Aceites del Historial no se leía (texto amarillo claro sobre fondo amarillo).
- Al exportar el inventario a CSV salía `[object Object]` y la foto en base64.
- Los gráficos del Dashboard ya no dependen de `setTimeout`: se dibujan al abrir la pestaña y al cambiar los datos.

## Sin cambios (a pedido)
- **Login:** mismo mecanismo que el original. Las claves se leen desde la tabla `usuarios` y existe el acceso de respaldo `logistica/frc` si la tabla falla.
- La tabla antigua `BD_PROGRAMAS` existe en la BD pero la app no la usa.

## Formatos y Ficha Técnica

Todo se guarda en `bd_formatos`; la columna `carpeta` dice a qué pertenece cada documento:

| Dónde | Valor de `carpeta` |
|---|---|
| Ficha Técnica de un equipo (Perfil de Equipo) | `EQUIPO:<id del equipo>` |
| Formatos | `<ÁREA> / <NORMA>` — ej. `RRHH / ISO SEGURIDAD 45001` |

Áreas: OPERACIONES, RRHH, FINANZAS, ADMINISTRACION. Normas: ISO CALIDAD 9001, ISO MEDIO AMBIENTE 14001, ISO SEGURIDAD 45001
(se cambian en `AREAS` / `NORMAS` de `formatos.service.js`). En cada carpeta el Admin puede **subir un archivo** (va al bucket
`archivos_frc/formatos/...`) o **agregar un enlace** (Drive, OneDrive, web del fabricante). Subadmin y Lectura solo ven la lista y abren.

## Perfiles de usuario

| Acción | Admin | Subadmin | Lectura |
|---|:-:|:-:|:-:|
| Ver todas las pantallas | ✅ | ✅ | ✅ |
| Editar horómetros (perfil de equipo) | ✅ | ✅ | ❌ |
| Registrar / editar mantenciones | ✅ | ✅ | ❌ |
| Crear equipos, editar datos y foto | ✅ | ✅ | ❌ |
| Programas: cambiar estado Realizado / Pendiente | ✅ | ✅ | ❌ |
| Programas: agregar (asignar) equipos a un programa | ✅ | ✅ | ❌ |
| Programas: crear programas, cambiar fechas u horómetro de lo ya asignado | ✅ | ❌ | ❌ |
| Movimientos, importaciones Excel, usuarios, configuración | ✅ | ❌ | ❌ |
| Formatos y Ficha Técnica: ver / abrir | ✅ | ✅ | ✅ |
| Formatos y Ficha Técnica: subir archivo, agregar enlace, eliminar | ✅ | ❌ | ❌ |
| **Eliminar cualquier cosa** | ✅ | ❌ | ❌ |

El rol se guarda en la columna `rol` de la tabla `usuarios` (`admin`, `subadmin` o `lectura`).
Se crea desde *Config & Usuarios → Rol → Subadmin*. Los permisos están en `js/core/store.js`
(`isAdmin`, `isSubadmin`, `puedeEditar`, `soloAdmin()`, `soloEditor()`), y además de ocultar botones
cada acción se bloquea en su `*.service.js`.

> ⚠️ Estas restricciones son del lado del navegador. Para seguridad total habría que aplicar también
> políticas RLS en Supabase.

## Sesión
- Al **actualizar la página** la sesión se mantiene y se vuelve a la **misma pestaña** (queda en la URL: `#inventario`, `#programas`…; también funcionan Atrás/Adelante).
- La sesión se cierra con el botón **Salir** o tras **5 minutos sin actividad** (mouse, teclado, scroll o toque). Se cuenta la actividad de todas las pestañas abiertas del sistema; si se sale en una, se sale en todas.
- Solo se guarda el nombre de usuario en el navegador (nunca la contraseña); el rol se vuelve a leer desde Supabase. El tiempo se cambia en `INACTIVIDAD_MS` de `js/core/sesion.js`.

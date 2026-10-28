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
  modules/
    dashboard/                 ← DASHBOARD
    inventario/                ← INVENTARIO AFI (+ Perfil de Equipo y modal Nuevo Equipo)
    programas/                 ← PROGRAMAS (+ modales Crear Programa / Asignar Equipo)
    movimientos/               ← MOVIMIENTOS (+ modal Registrar Movimiento)
    historial/                 ← HISTORIAL (+ formulario de Mantención)
    aceites/                   ← CONTROL ACEITES
    configuracion/             ← CONFIG & USUARIOS (+ Login)
    formatos/                  ← En construcción (código original sin tocar, sin pantalla)
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
2. Verificar que las políticas RLS de `bd_programas_calendarios` y `bd_programas_items` permitan leer/escribir con la clave `anon` (como las demás tablas).

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
- **Formatos / Fichas técnicas** (`modules/formatos/formatos.service.js`): código original sin tocar. Al activarlo, cambiar `'BD_FORMATOS'` → `'bd_formatos'` y `'BD_MODELOS_FICHA'` → `'bd_modelos_ficha'` (en la BD están en minúsculas).
- La tabla antigua `BD_PROGRAMAS` existe en la BD pero la app no la usa.

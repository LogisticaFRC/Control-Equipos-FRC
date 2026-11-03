# Control AFI & Programación — FRC (versión modular)

Aplicación Vue 3 + Supabase separada en módulos. **No requiere compilación**: se sube la carpeta completa al hosting tal cual.

> ⚠️ Debe abrirse desde un servidor web (Netlify, GitHub Pages, hosting propio…). Con doble clic (`file://`) los módulos JS no cargan.
> Para probar en el PC: `npx serve .` o `python -m http.server` dentro de la carpeta.

## Estructura

```
index.html                     ← liviano: solo carga librerías y js/main.js
css/styles.css                 ← estilos globales (parpadeo horómetro, scrollbars)
js/
  main.js                      ← arma la app: header, menú lateral (hamburguesa), pantallas y modales
  core/
    menu.js                    ← ÁREAS del menú lateral y sus módulos (Operaciones, Ventas, Seguridad, RRHH, Finanzas, Administración, General)
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
    minutas/                   ← MINUTAS (mejora continua semanal: carpetas Año → Mes, dashboard por minuta y general, importar Word/Excel, exportar)
    movimientos/               ← MOVIMIENTOS (+ modal Registrar Movimiento)
    historial/                 ← HISTORIAL (+ formulario de Mantención)
    aceites/                   ← CONTROL ACEITES
    configuracion/             ← CONFIG & USUARIOS (+ Login)
    filtros/                   ← FILTROS (referencia cruzada por marca/modelo, comparativo de precios por proveedor)
    bodega/                    ← BODEGA FILTROS (inventario general de filtros, ARMAR KIT, movimientos)
    formatos/                  ← FORMATOS (Área → Norma ISO) + carpeta de documentos reutilizable (también Ficha Técnica de equipos)
    general/                   ← INICIO (bienvenida) + pantalla "En construcción" para áreas sin módulos aún
```

### Menú lateral por áreas

Los módulos se abren con el botón ☰ (esquina superior izquierda). El menú se cierra al elegir un módulo, al hacer clic fuera o con `Esc`.

| Área | Módulos |
|---|---|
| Inicio | Bienvenida ("Bienvenido al Sistema de Gestión FRC" + logo grande). Es la primera pantalla al iniciar sesión; también se llega haciendo clic en el logo del header |
| Operaciones | Dashboard, Inventario AFI, Programas, Minutas, Movimientos, Historial, Control Aceites, Filtros, Bodega Filtros |
| Ventas · Seguridad · RRHH · Finanzas · Administración | En construcción (pantalla "Próximamente") |
| General | Formatos, Config & Usuarios |

- El botón **Agregar Mantención** solo aparece en módulos de **Operaciones** (y para usuarios con permiso de edición).
- Bajo el título del header se muestra el área y módulo actual (ej. *Operaciones › Inventario AFI*).
- **Para agregar un módulo a un área:** sumarlo en `js/core/menu.js` (dentro de `modulos` del área; quitar el "Inicio …" con `placeholder` si ya no se necesita) y registrar su vista en `main.js`. La URL `#clave` queda válida automáticamente.

### Permisos por área (usuarios)

> ⚠️ Ejecutar una vez **`sql/permisos_areas.sql`** en Supabase (agrega la columna `permisos` a `usuarios` y pasa los Subadmin antiguos a "Subadmin de Operaciones").

- **Admin general** (`rol = 'admin'`): todo en todas las áreas y es el **único** que crea/elimina usuarios y cambia permisos (Config & Usuarios). El usuario `logistica` es el principal: no se puede eliminar ni bajar.
- **Usuario por área** (`rol = 'lectura'` + `permisos` jsonb, ej. `{"operaciones":"admin","finanzas":"subadmin"}`). En cada área tiene uno de estos niveles:
  - **Admin del área** → agregar, modificar y eliminar todo dentro de esa área.
  - **Subadmin** → lo que hacía el Subadmin (horómetros, mantenciones, equipos, estado "Realizado" en Programas; sin eliminar).
  - **Solo lectura** → ve el área pero no modifica (área que no aparece en `permisos` = solo lectura).
- Todos ven todas las áreas; los botones de edición aparecen solo donde el usuario tiene permiso.
- En el header se muestra el nivel del usuario en el área actual (ej. *Juan (Admin Finanzas)*).
- Implementación: `core/store.js` (`nivelEnArea`, `isAdmin`/`isSubadmin`/`puedeEditar` calculados según el área de la pantalla actual, `soloAdminGeneral()`). Los módulos no cambiaron: siguen usando `isAdmin`, `soloAdmin()`, `soloEditor()`.
- Los permisos se validan en el navegador **y en la base de datos (RLS)**: ver la sección Seguridad.

## 🔒 Seguridad (Supabase Auth + RLS) — actualizado 2026-11-03

**Qué cambió**
- Las contraseñas ya **no están en la tabla `usuarios`**: las guarda Supabase Auth, cifradas, y se validan en el servidor.
- La sesión es un **token firmado** por Supabase (antes bastaba escribir el nombre de usuario en el navegador para entrar).
- **RLS activado** en todas las tablas: sin iniciar sesión no se puede leer ni modificar nada, aunque se use la llave `anon`.
  Cada acción se valida en la base de datos según el nivel por área (Admin general / Admin del área / Subadmin / Lectura).
- Se eliminó el usuario de respaldo con clave fija que había en el código.
- Contraseñas: mínimo **10 caracteres, con letras y números**. Al entrar con una clave inicial o temporal, el sistema obliga a cambiarla.
- Botón 🔑 en el encabezado → cada usuario cambia su propia contraseña.
- *Config & Usuarios* → columna **Clave**: el Admin general asigna una contraseña temporal (cierra las sesiones de ese usuario).
- SheetJS actualizado a 0.20.3 (la 0.18.5 tenía vulnerabilidades al abrir archivos Excel).

**Cómo instalarlo (hacerlo todo seguido, la versión antigua deja de funcionar al ejecutar el SQL)**
1. *Supabase → Authentication → Sign In / Providers → Email*: **desactivar "Allow new users to sign up"**
   (los usuarios solo los crea el Admin general desde la app). Dejar activo el proveedor Email.
2. *Supabase → Authentication → Sign In / Providers → Email*: **Minimum password length = 10** y
   **Password requirements = letras y números** (si tu plan lo muestra).
3. *Supabase → SQL Editor*: ejecutar **`sql/seguridad_paso1_auth_rls.sql`**. Al final muestra la lista de usuarios con `migrado = true`.
   Revisa los avisos (NOTICE/WARNING): si alguna tabla aparece "sin RLS", avisar para agregarla.
4. Subir la carpeta completa al hosting y actualizar con **Ctrl + F5**.
5. Entrar con `logistica` y su contraseña actual → el sistema pide una nueva. Cada usuario hace lo mismo al entrar.
6. Cuando todos entren bien (unos días después), ejecutar **`sql/seguridad_paso2_limpieza.sql`**
   (borra definitivamente las contraseñas antiguas que quedaron respaldadas).

**Detalles técnicos**
- Cada usuario tiene un correo interno `usuario@usuarios.frchile.cl` (no se envían correos). Se arma igual en
  `emailDeUsuario()` (`js/core/supabase.js`) y `public.frc_email()` (SQL): si se cambia uno, cambiar el otro.
- `usuarios` tiene columnas nuevas: `auth_id`, `email`, `debe_cambiar_clave`.
- Funciones SQL: `frc_nivel(area)`, `frc_puede(areas, minimo)`, `frc_admin_crear_usuario`, `frc_admin_cambiar_clave`,
  `frc_admin_eliminar_usuario`, `frc_clave_cambiada`. El usuario `logistica` está protegido por un trigger.
- **Tabla nueva** → agregarla a la lista del punto 7 de `seguridad_paso1_auth_rls.sql` y volver a ejecutarlo
  (si no, queda sin RLS). Los scripts antiguos (`filtros.sql`, `minutas.sql`, etc.) crean políticas `anon_all`:
  **si se vuelve a ejecutar alguno, ejecutar después otra vez `seguridad_paso1_auth_rls.sql`.**
- Las reglas finas del Subadmin (ej. no cambiar fechas de un ítem asignado) siguen validándose en la app;
  la base de datos asegura lo principal: sin login nada, Lectura no modifica, solo Admin elimina en las tablas principales.
- Archivos (bucket `archivos_frc`): subir/borrar requiere sesión con nivel Subadmin o Admin. El bucket sigue siendo
  público para que funcionen los enlaces ya guardados; quien tenga un enlace puede abrir ese archivo.
- Supabase Auth limita los intentos de login fallidos por IP (*Authentication → Rate Limits*).

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
   El bucket `archivos_frc` debe ser público. Los permisos de la tabla los pone `sql/seguridad_paso1_auth_rls.sql`.
3. **Módulo FILTROS** → abrir `sql/filtros.sql`, copiar todo en *Supabase → SQL Editor* y presionar **Run** (una sola vez).
   Crea `bd_filtros_precios` (lista de precios) y `bd_filtros` (filtros por marca/modelo), con sus permisos, y carga la
   planilla `filtros1234.xlsx` (108 códigos con precio, 12 proveedores, 269 precios). Si `bd_filtros` ya existía de la versión
   anterior, la ajusta sola (pasa sus precios a la lista). Se puede volver a ejecutar sin duplicar.
4. **Bodega de Filtros + KITS** → abrir `sql/bodega_filtros.sql`, copiar todo en *Supabase → SQL Editor* y **Run** (una vez).
   Crea `bd_filtros_stock`, `bd_filtros_kits`, `bd_filtros_kits_items` y `bd_filtros_movimientos` con sus permisos.
5. **Seguridad** → ver la sección *🔒 Seguridad* (ejecutar `sql/seguridad_paso1_auth_rls.sql` al final, después de los otros scripts).

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

> 🔒 Además de la app, la base de datos (RLS) bloquea lo principal: ver la sección Seguridad.

## Sesión
- Al **actualizar la página** la sesión se mantiene y se vuelve a la **misma pestaña** (queda en la URL: `#inventario`, `#programas`…; también funcionan Atrás/Adelante).
- La sesión se cierra con el botón **Salir** o tras **5 minutos sin actividad** (mouse, teclado, scroll o toque). Se cuenta la actividad de todas las pestañas abiertas del sistema; si se sale en una, se sale en todas.
- La sesión es un token de Supabase Auth (nunca se guarda la contraseña); el rol se vuelve a leer desde la tabla `usuarios`. El tiempo se cambia en `INACTIVIDAD_MS` de `js/core/sesion.js`.
- **¿Sigue saliendo al actualizar?** Revisa la versión que aparece abajo en el login (`v2026-10-30 b`). Si no aparece, el navegador u hosting sigue usando archivos antiguos: vuelve a subir la carpeta completa y actualiza con **Ctrl + F5**.

## Filtros

Dos tablas:

| Tabla | Qué guarda | Una fila por |
|---|---|---|
| `bd_filtros_precios` | **Lista de precios** (la planilla "PRECIO FILTROS"): código, marca, tipo, proveedor, precio, fecha del precio | código + proveedor |
| `bd_filtros` | **Qué filtros usa cada equipo**: marca y modelo del equipo, tipo, código, **cantidad**, último uso | marca + modelo + tipo + código |

**Cómo se llena**
- *Precios:* el script `sql/filtros.sql` (carga inicial) o el botón **Importar lista de precios (Excel)** (solo Admin) con el
  mismo formato de la planilla: encabezado `CODIGO | MARCA | TIPO | proveedor 1 | proveedor 2 | …` (las columnas "ColumnaN" se ignoran).
  Reemplaza el precio si el código + proveedor ya existe; lo que no viene en el Excel no se borra.
- *Equipos:* al guardar una mantención, cada filtro del "Registro de Filtros Utilizados" queda enlazado a la **marca + modelo** del
  equipo del AFI. Si trae proveedor y precio, también actualiza la lista de precios (una mantención antigua no pisa un precio más nuevo).
- *Editar:* botón ✏️ en cada código (Admin y Subadmin): código, marca, tipo, **precio de cada proveedor** (vacío = no lo vende; se pueden
  agregar proveedores nuevos) y **equipos que lo usan** (marca, modelo, tipo y cantidad). Solo Admin elimina.

**Reglas**
- Mismo modelo + mismo tipo + distinto código = **referencia cruzada** (códigos que sirven para ese equipo).
- La **cantidad** es del modelo + tipo (ej. 2 filtros de combustible): vale para todos sus códigos equivalentes y es la que ve el Perfil de Equipo.
- Los tipos se guardan en MAYÚSCULAS. Se corrigen automáticamente `COMBUSITBLE → COMBUSTIBLE` y `SEPARADOR COMBUSTIBLE → COMBUSTIBLE SEPARADOR`.

**Pantallas**
- *Filtros → Comparativo de precios por proveedor:* igual a la planilla; marca en verde el precio más bajo, mejor proveedor, ahorro y a qué equipos aplica.
- *Filtros → Referencia cruzada por equipo:* por marca/modelo, cada tipo con sus códigos equivalentes y su mejor precio.
- *Perfil de Equipo → Filtros que usa el equipo:* solo lectura (tipo, cantidad, códigos que sirven, mejor opción, costo del kit). Se corrige en Filtros.
- *Agregar Mantención:* al escribir un código conocido completa marca, tipo y el proveedor más barato con su precio (se puede cambiar);
  al cambiar el proveedor trae su precio. Botón **Cargar filtros del modelo** para llenar el registro con lo que usa el equipo.

## Formatos: buscador, subcarpetas y edición
- **Buscador general** (arriba en Formatos): busca por nombre en todas las áreas, normas y subcarpetas; muestra la ruta de cada resultado. Cada carpeta tiene además su propio buscador.
- **Subcarpetas** (solo Admin): botón *Nueva subcarpeta* dentro de cada Área / Norma (también en la Ficha Técnica de un equipo). Se pueden renombrar y eliminar; al eliminar una subcarpeta sus documentos **no se borran**, pasan a la carpeta principal.
- **Subcarpetas en la lista**: aparecen arriba de los documentos, como en un explorador. El Admin **arrastra un documento y lo suelta sobre una carpeta** para moverlo (dentro de una subcarpeta, soltarlo en *Volver a Carpeta principal* lo saca). En celular/tablet se usa ✏️ → *Mover a*.
- **Modificar documento** (solo Admin, botón ✏️): cambiar nombre, **mover** a otra subcarpeta y **reemplazar el archivo** (el anterior se borra del Storage) o cambiar el enlace.
- Sin cambios en la base de datos: la subcarpeta se guarda en la columna `carpeta` (`AREA / NORMA / Subcarpeta`) y las subcarpetas vacías se guardan con una fila marcador `nombre = '__CARPETA__'` que no se muestra. Para borrar archivos reemplazados, el bucket `archivos_frc` debe permitir *delete* con la clave `anon` (si no, el reemplazo funciona igual y el archivo viejo queda en el Storage).

## Bodega de Filtros y KITS (pestaña "Bodega Filtros")

| Tabla | Qué guarda |
|---|---|
| `bd_filtros_stock` | Inventario general de filtros sueltos: **código, tipo, marca, cantidad** (una fila por código) |
| `bd_filtros_kits` | KITS armados: código del kit, **marca + modelo de equipo** para el que sirve, cantidad en bodega |
| `bd_filtros_kits_items` | Qué filtros (y cuántos) lleva **1** kit |
| `bd_filtros_movimientos` | Todo lo que entra y sale: INGRESO, SALIDA, AJUSTE, ARMADO KIT, DESARME KIT, CONSUMO KIT, DEVOLUCION KIT |

**Inventario general**: *Ingresar filtros* (al escribir un código conocido completa tipo y marca desde el módulo Filtros), ➕ ingreso,
➖ salida, ✏️ ajuste por conteo (Admin), 🗑 eliminar (Admin). *Importar stock (Excel)* (Admin): columnas `CODIGO | TIPO | MARCA | CANTIDAD`,
se **suman** a lo que hay. La columna "Sirve para" sale del módulo Filtros.

**ARMAR KIT**: elegir marca y modelo del equipo → *Cargar filtros del modelo* (trae los tipos y cantidades del módulo Filtros y, entre los
códigos equivalentes, elige el que tiene stock) o agregar filtros a mano → indicar **N° de kits** → *Armar KIT*. Los filtros se **descuentan
del inventario general** y el kit queda en bodega con su código (se sugiere `KIT-<MODELO>-01`). Si no alcanza el stock no deja armar.
Opcional: enlaza los códigos del kit a ese modelo en el módulo Filtros. En cada kit: *Armar más* (misma composición), *Desarmar* (Admin,
devuelve los filtros al inventario), editar / eliminar (Admin; la composición solo se cambia con 0 kits armados).

**Programas → Mantención**: cada equipo muestra
- **FILTROS**: cuántos filtros lleva según el módulo Filtros (pasa el mouse para ver el detalle por tipo y lo que hay suelto en bodega).
- **KIT EN BODEGA**: cuántos kits hay para su modelo. Si no hay pero alcanzan los filtros sueltos, aparece *Se puede armar · Armar KIT*.
- Arriba, un resumen por modelo: equipos pendientes vs kits en bodega y cuántos **faltan**.
- Al marcar **Realizado** se descuenta **1 KIT** del modelo (el de más stock). Si no hay kit, pregunta si marcar igual.
  Al volver a **Pendiente** el kit se devuelve a bodega. Todo queda en *Bodega Filtros → Movimientos* (con referencia al ítem del programa).

## Minutas (pestaña "Minutas" en Operaciones)

> ⚠️ Ejecutar **`sql/minutas.sql`** en Supabase (crea `bd_minutas` y `bd_minutas_items` y agrega las columnas `seccion`, `area`, `fecha_texto`). Si ya se había ejecutado antes, ejecutarlo **de nuevo** (no borra nada).

| Tabla | Qué guarda |
|---|---|
| `bd_minutas` | Cada minuta: nombre, **fecha** (define la carpeta Año → Mes), minuta de origen, quién la creó |
| `bd_minutas_items` | Tareas: **N° Item, Sección, Área, Personal Encargado, Fecha Compromiso (o texto, ej. Siempre), Fecha Estimada, Tareas, Estado, Fecha Realizado** |

- **Menú como Programas:** carpetas por año y mes (se arman solas con la fecha de la minuta). La más reciente lleva la etiqueta *ACTUAL*; cada una muestra su % de cumplimiento.
- **Nueva Minuta = continúa desde la última:** copia sus tareas **Pendiente, Proceso y No Realizado** con estado y fechas. Las **Realizadas no pasan** (ya están listas): quedan guardadas en la minuta anterior y en el Dashboard General. La minuta anterior queda guardada tal cual (histórico).
- **Estados:** Proceso, Pendiente, Realizado, No Realizado. Al marcar **Realizado** se guarda el día (editable). *Vencida* = Pendiente/Proceso **con Fecha Compromiso** y con Fecha Estimada pasada (fila en rojo). Sin Fecha Compromiso nunca se marca vencida.
- **Permisos:** Admin crea/renombra/elimina minutas y corrige el histórico. Subadmin crea minutas y edita solo la minuta actual. Lectura solo ve.
- **Agrupación por sección:** todas las tareas de una misma sección (ej. VENTANAS) se muestran juntas bajo un solo título, aunque en el Word estén separadas. Las secciones van en el orden en que aparecen por primera vez y dentro de cada una por N° Item (igual en el Excel exportado).
- **Historial de una tarea** (ícono 🕓): cómo fue cambiando en cada minuta.
- **Dashboard:** totales y % por estado, vencidas, % realizadas a tiempo, gráfico por estado, por encargado y evolución semana a semana.
- **Dashboard General** (botón negro arriba, o pestaña *General* en cualquier minuta): reúne **todas las minutas**. Como cada minuta copia las tareas de la anterior, cada tarea se cuenta **una sola vez** (se reconoce por la primera línea del texto) con su **último estado**.
  - Filtros: período (todo, 30 días, 3 meses, 6 meses, este año), sección y encargado.
  - Indicadores: minutas, tareas, realizadas, no realizadas, abiertas, vencidas, % cumplimiento, % a tiempo, días promedio en cerrar.
  - Gráficos: estado, evolución semana a semana, por sección, por encargado y realizadas por mes. Tabla de cumplimiento por encargado.
  - Listas: Abiertas, Vencidas, Realizadas (con fecha), No realizadas, Más tiempo abiertas y Todas. Cada tarea muestra cuántos días lleva o tardó, en cuántas minutas apareció y si ya no aparece en la minuta actual. Clic en una tarea = su recorrido minuta a minuta.
  - **Exportar General:** Excel con hoja *Dashboard General* (logo, resumen con %, gráficos, cumplimiento por sección y encargado) + una hoja por lista (Abiertas, Vencidas, Realizadas, No Realizadas, Todas). Respeta los filtros elegidos.
- **Importar (Word / Excel)**: se pueden elegir **varios archivos a la vez** (.docx, .xlsx, .csv). Antes de guardar se muestra una revisión con las tareas leídas y la **fecha de cada minuta**, que se puede cambiar.
  - *Fecha:* se busca en el documento ("FECHA" del encabezado de página del Word, "Fecha: …" o la tabla de encabezado), si no en el nombre del archivo, y si no se usa hoy (avisa para revisarla).
  - *Minuta ACTUAL:* siempre es la de **fecha más reciente**, aunque se importe después una más antigua (esa queda como histórico).
  - *Formato Word de la minuta:* tabla con `N° (sin título) | Área | Responsable | Fecha de Compromiso | Tarea | Cumple`. Las filas con un solo texto (ej. **Seguridad**) son **secciones**. Varias personas en Responsable se guardan separadas por " / ". Las viñetas de la tarea se conservan.
  - *Cumple:* `1` = Realizado (con la fecha de esa minuta como día realizado), `0` = No Realizado, vacío = Pendiente.
  - *Fechas:* la **"Fecha de Compromiso" del Word es el plazo → se guarda como Fecha Estimada**. La **Fecha Compromiso** del sistema (cuándo se adquirió el compromiso) aún no viene en el Word: queda vacía (o se toma la que ya tenga esa misma tarea en una minuta anterior). Cuando el Word traiga las dos fechas (ej. "Fecha Ingreso" + "Fecha de Compromiso"), la otra columna se toma como Fecha Compromiso. Si trae "Fecha Estimada" o "Plazo", "Fecha Compromiso" se respeta tal cual.
  - *Plazo que no es fecha* (ej. "Siempre") se guarda como texto y se muestra bajo la Fecha Estimada (esas tareas nunca quedan vencidas).
  - Destino: crear minuta(s) nueva(s) (una por archivo), o agregar / reemplazar las tareas de la minuta seleccionada.
  - Word antiguo (.doc): abrirlo en Word y guardarlo como .docx. La lectura de Word usa mammoth y JSZip (se descargan solos desde cdn.jsdelivr.net).
  - Columnas Excel / plantilla: `N° Item | Sección | Área | Personal Encargado | Fecha Compromiso | Fecha Estimada | Tareas | Estado | Fecha Realizado`. También acepta los Excel exportados por el sistema.
- **Exportar Minuta:** Excel con logo, resumen con cantidades y %, tabla con colores por estado agrupada por **sección** (como el Word) y hoja *Dashboard* con gráficos y cumplimiento por sección y por encargado.
- **Exportar Todas (un archivo):** *Resumen General* (situación actual + evolución por minuta + promedio), *Dashboard*, *Histórico* consolidado y una hoja por minuta en orden cronológico.
- La exportación usa ExcelJS (se descarga sola desde cdn.jsdelivr.net al exportar). El logo es el configurado en Config & Usuarios; si el servidor de la imagen no lo permite, el Excel sale sin logo.

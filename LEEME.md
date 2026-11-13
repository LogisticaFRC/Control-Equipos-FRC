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
    programas/                 ← PROGRAMAS Mantención / Reparación (+ modales Crear Programa / Asignar Equipo)
    taller/                    ← TALLER: naves de reparación (tarjetas con foto y % de avance, OT para mecánicos)
    minutas/                   ← MINUTAS (mejora continua semanal: carpetas Año → Mes, dashboard por minuta y general, importar Word/Excel, exportar)
    areas/                     ← ÁREAS Y LOCACIONES (Empresa → Área → Sector → Locación → AFI) + selector en cascada reutilizable
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
| Operaciones | Dashboard, Inventario AFI, Programas Mantención, Programas Reparación (Taller), Minutas, Áreas y Locaciones, Movimientos, Historial, Control Aceites, Filtros, Bodega Filtros |
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

## 🔗 Programas de mantención ↔ Historial

- Al guardar una mantención en el **Historial** con **Programa** seleccionado, el equipo queda **REALIZADO** en ese programa
  (fecha realizada = fecha de la mantención, horómetro = el de la mantención; en programas de MANTENCIÓN descuenta el KIT como el switch).
- Si el equipo está **varias veces** en el programa, las mantenciones se asignan en orden de fecha: 1 mantención → la fecha programada
  más baja; 2 mantenciones → la más baja y la siguiente; etc.
- En el formulario de mantención, la lista de programas muestra primero los que tienen ese AFI y su próxima fecha pendiente.
- En el programa, bajo *Fecha Realizada* aparece el enlace al registro del Historial (fecha y N° OT).
- Botón **Sincronizar con Historial** (en el programa): marca de una vez los equipos que ya tenían su mantención registrada.
- Desmarcar sigue siendo manual (si se borra una mantención del Historial, el ítem no vuelve solo a Pendiente).

## 📝 Órdenes de Trabajo (OT) — Operaciones → Órdenes de Trabajo

> ⚠️ Ejecutar una vez **`sql/ot.sql`** en Supabase (crea `bd_ot` con sus permisos).

- **Formato FRC-RE-OPE-006** idéntico al Excel: el editor muestra la misma hoja; las celdas amarillas se rellenan.
- Al escribir el **ID EQUIPO (AFI)** se completan Equipo, Marca, Modelo y Hrs actual desde el Inventario. Hrs prox. mant. se escribe a mano.
- **Tipo de mantención** y **Pauta** (250/500/1000/5000): clic en el cuadro para marcar la X.
- El **folio se escribe a mano** en la celda FOLIO de la hoja (se sugiere el mayor + 1). No se puede repetir: si ya existe, avisa.
- **Excel**: rellena la plantilla original `plantillas/FORMATO_OT.xlsx` (mismas combinaciones, bordes, logo y configuración de impresión).
- **Imprimir**: abre la hoja lista para imprimir en carta vertical (80 %, como el Excel).
- **Estado**: *Pendiente* → *Realizada* cuando en el **Historial** existe una mantención con ese **N° OT** (botón *Registrar en Historial*:
  abre el formulario de mantención con AFI, N° OT, tipo, horómetro, actividades y personal ya rellenados). En el Historial, el N° OT es un enlace que abre la OT.
- **Importar OT (Excel)** (solo Admin): uno o varios archivos con el mismo formato. Lee todas las celdas del formato (fechas y horas
  incluidas). El folio sale de la celda FOLIO o, si está vacía, del nombre del archivo (ej. `OT 45.xlsx`). Si el folio ya existe, pregunta si reemplazar.
- **Vinculados**: en la lista y dentro de la OT se ven las mantenciones del Historial con ese N° OT y su documento adjunto (botón *Ver documento*).
- Permisos: crear/editar = Subadmin o Admin de Operaciones · anular/eliminar = Admin.
- Si cambia el Excel del formato: reemplazar `plantillas/FORMATO_OT.xlsx` y ejecutar
  `python tools/generar_formato_ot.py plantillas/FORMATO_OT.xlsx js/modules/ot/ot.formato.js` (las celdas de datos están definidas en ese script).

## 🏭 Programas separados + Taller de reparación (2026-11-05)

> ⚠️ Ejecutar una vez **`sql/taller.sql`** en Supabase (crea `bd_taller_reparaciones` y agrega `bd_ot.reparacion_id`).
> Si después se vuelve a ejecutar `seguridad_paso1_auth_rls.sql`, la tabla nueva ya está en su lista.

**Menú (Operaciones → Gestión operacional):** el antiguo *Programas* ahora son dos submódulos:
- **Programas Mantención** (`#progMantencion`): carpeta Mantención, tabla, Gantt, kits, sincronizar con Historial (igual que antes).
- **Programas Reparación** (`#progReparacion`): pestañas **Taller · Naves** y **Programas y Gantt** (la vista de siempre, solo Reparación, con columna nueva **TALLER**).
- El enlace antiguo `#programas` abre Programas Mantención. El modal *Asignar Equipo* solo ofrece programas del submódulo donde se abrió.

**Taller · Naves** (pensado para el PC del taller, letra y botones grandes, botón *Pantalla completa*):
- Tarjeta grande por **NAVE** con la **foto del equipo** (campo `foto` del Inventario), AFI, programa, OT, tiempo en nave y **% de avance**
  (= actividades de sus OT con fecha de término / actividades escritas). Se refresca sola cada 45 s (se pausa con una ventana abierta).
- **Nave vacía** → *Ingresar equipo*: lista los equipos del **programa de reparación** (seleccionado arriba; por defecto el vigente) que faltan,
  primero los **recomendados** (programados en esa nave y con fecha de inicio ya cumplida); también los que están en espera y
  **“Equipo nuevo · agregar a nave”** (AFI que no está en el programa → queda además en **Equipos reparación sin programa**, columna derecha).
- **REPARAR** (o clic en la foto): muestra la OT del equipo con sus actividades como casillas grandes. Al marcar una actividad se guarda
  la fecha y hora de término en la OT (igual que en el papel); se pueden agregar actividades (máx. 20, como el formato) y el ejecutante.
  Si no tiene OT: *Crear OT y empezar* (folio manual, sugerido el mayor + 1, tipo Correctiva) o enlazar una OT existente del mismo AFI.
- **Sacar**: pregunta **¿quedó reparado?**
  - **Sí** → la nave queda libre, el equipo queda **Disponible** en el Inventario y **REPARADO** en el programa.
  - **No** → se escribe **qué le falta** (sugiere las actividades pendientes) y opcionalmente se agrega como actividades pendientes en la OT.
    Queda en **Salieron con faltantes** (con su OT y pendientes) para reingresarlo a una nave.
- Al ingresar a una nave, el equipo pasa a **En Mantencion** en el Inventario.
- Abajo: **Resumen de reparación** del programa (Por ingresar · En nave · Con faltantes · Listos) y **OT de reparación** (dónde está cada equipo y avance).
- Una nave = un equipo (índice único en la BD: si dos PC intentan ocupar la misma nave, el segundo recibe aviso).

**Órdenes de Trabajo:** en el editor hay un cuadro **Programa de reparación / Taller** para enlazar la OT a un equipo del programa de
reparación o a *Equipos reparación sin programa* (opción **“+ Agregar a Equipos reparación sin programa”** si el AFI no está en el programa).
La lista de OT tiene la columna **Taller**. Las actividades terminadas de la OT suman al % de la nave.

Permisos: ver = todos · ingresar/sacar/marcar actividades = Subadmin o Admin de Operaciones · quitar de la lista = Admin.
Archivos: `js/modules/taller/` (`taller.service.js`, `taller.template.js`, `taller.view.js`, `reparacion.view.js`), `sql/taller.sql`.
⚠️ La sesión se cierra a los 5 min sin actividad (`core/sesion.js`): en el PC del taller los mecánicos tendrán que volver a entrar si nadie lo toca.

### Taller v2 (2026-11-05): OT del mecánico, problemas nuevos, firmas y "sacar por error"

> ⚠️ Ejecutar una vez **`sql/taller_firmas_problemas.sql`** (columna `bd_ot.firmas` y tabla `bd_taller_problemas`).

- **REPARAR**: el mecánico **no crea OT**. Ve las OT ya creadas del AFI y presiona **Unir esta OT**. Operaciones (Subadmin/Admin)
  también puede unirla desde *Órdenes de Trabajo → Programa de reparación / Taller*; apenas se une, le aparece al mecánico.
  Si no hay OT, se le avisa que Operaciones debe crearla. Solo el **Admin** puede crear la OT desde el taller (cuadro plegado "Crear la OT aquí").
- En la OT unida, el mecánico completa (se guarda solo al escribir): **ejecutante, F. inicio, F. término, H. inicio, H. término** de cada actividad,
  **insumos** (aceites/lts, repuestos, fecha, retira), **personal asignado** (nombre, cargo, firma), **pauta** y **mecánico / supervisor responsable con firma**.
  La descripción de las actividades solo la cambia el Admin (y solo él agrega o quita actividades).
- **Enviar nuevo problema para OT**: el mecánico escribe lo que encontró; queda *Esperando al Admin*. El Admin lo ve en la tarjeta de la nave y en
  el panel **Problemas nuevos para OT**; lo corrige si quiere y lo **agrega a la OT** como actividad, o lo **rechaza** (con motivo).
- **Firmas** dibujadas con el mouse o con el dedo (pantalla touch). Se ven sobre la hoja de la OT (editor e impresión). El Excel exportado no las incluye
  (usar Imprimir → Guardar como PDF).
- **Sacar por error / prueba** (solo Admin): deshace el ingreso a la nave sin marcar reparado ni faltantes; el equipo vuelve a su estado y
  disponibilidad anteriores. Si la reparación se creó solo para ese ingreso (sin OT ni problemas), se borra.
- Componente reutilizable: `js/core/firma-pad.js` (`<firma-pad>`).
- **Aceites y repuestos** (en REPARAR): *Aceites utilizados* = filas 1 a 4 de insumos del formato; *Repuestos utilizados* = desde la fila 5,
  con botón **Agregar repuesto** sin límite. En la hoja caben 6 repuestos; los demás se imprimen en una **hoja anexa** (el Excel exportado solo lleva las 10 filas del formato).

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

---

## Módulo OC · Órdenes de Compra (Operaciones → OC)

**Antes de usarlo:** ejecutar `sql/oc.sql` en Supabase → SQL Editor (crea la tabla `bd_oc` con sus permisos).

| Tabla | Campos |
|---|---|
| `bd_oc` | **N° OC** (único), fecha, **AFI**, proveedor, descripción, **precio**, **documento** (`link` en Storage `archivos_frc/oc/…`), nombre del archivo, creado por |

- **Registro histórico:** lista con filtros (texto, AFI, fechas, vinculadas / sin vincular), totales ($) y botón *Nueva OC*. Clic en una fila = ver / editar (subir o cambiar el documento PDF / imagen).
- **Enlace con la mantención:** la columna **N° OC** de cada mantención (BD_HISTORIAL.`numero_oc`) ahora admite **varias OC** separadas por coma (`4521, 4533`). La OC queda vinculada a la mantención que tenga su número (se compara sin "OC", "N°", "#" ni espacios).
  - Desde la **mantención**: bloque *Órdenes de Compra* → escribir el N° y *Agregar OC* (sugiere las OC del mismo AFI aún sin vincular). Muestra el precio de cada OC y el **Total OC**.
  - Desde la **OC**: elegir *Mantención vinculada* (mantenciones del AFI); al guardar se agrega el N° a esa mantención. Botón 🔧 = registrar una mantención nueva que ya trae esa OC.
  - N° escritos en mantenciones que no están registrados en el módulo aparecen en el aviso amarillo *OC sin registrar* (botón *Registrar*). Esas OC suman $0 hasta registrarlas.
- **Historial:** columnas *N° OC* (cada OC con su precio, clic = abre la OC) y *TOTAL OC*.
- **Perfil de equipo:** tarjeta **Total gastado en OC** y tabla *Órdenes de Compra del Equipo* (OC con ese AFI + las vinculadas a sus mantenciones).
- **Exportar Excel** (con logo, todo centrado): hoja *OC* (respeta los filtros, con total) + hoja *Total por equipo*.
- Permisos: Subadmin/Admin de Operaciones crea y edita; solo Admin elimina.

## Programas de Mantención: última mantención, ubicación y exportación con formato

- Tabla del programa de **Mantención**: nuevas columnas **UBICACIÓN ACTUAL** (Inventario, la actualizan los Movimientos, + empresa) y **ÚLTIMA MANTENCIÓN** (fecha, días transcurridos — en rojo si son más de 90 —, tipo y horómetro, tomada del Historial).
- **Exportar Programa (Excel)** ahora sale con formato: logo, título centrado (empresa · programa · vigencia · % realizado), encabezados en color, **todas las celdas centradas** con bordes, filtros y estado coloreado. Mantención: hojas *Mantención* (incluye ubicación y última mantención) y *Carta Gantt* (días coloreados). Reparación: una hoja por nave (con Gantt coloreado) + *Fuera de rango*.
- Las funciones de formato están en `js/core/excel.js` (`nuevoLibro`, `hojaTabla`, `descargarLibro`) para reutilizarlas en otros módulos.

## Áreas y Locaciones (Operaciones → Áreas y Locaciones)

**Antes de usarlo:** ejecutar `sql/areas.sql` en Supabase → SQL Editor (crea `bd_locaciones`, agrega `locacion_id` a `BD_INVENTARIO` y `BD_MOVIMIENTOS`, y crea la empresa TALLER FRC). Se puede repetir sin perder datos.

| Nivel | Qué es | Guardado en |
|---|---|---|
| **Empresa** | Cliente / dueño del lugar (ej. CODELCO, TALLER FRC) | `bd_locaciones` tipo `EMPRESA` |
| **Área** | Carpeta dentro de la empresa (ej. MINA SUR) | `bd_locaciones` tipo `AREA` (padre = empresa) |
| **Locación** | Lugar físico donde están los equipos (ej. TALLER CAMIONES) | `bd_locaciones` tipo `LOCACION` (padre = área) |
| **Equipos (AFI)** | Cada equipo apunta a una locación | `BD_INVENTARIO.locacion_id` |

- **Explorador tipo carpetas:** árbol a la izquierda y carpetas/equipos a la derecha, con migas de pan, buscador (AFI, equipo, empresa, área o locación) y contadores. Carpeta especial **Sin locación** = equipos aún no ubicados (muestra su ubicación antigua en texto para ayudar a ubicarlos).
- **Actualización manual:** en una locación → *Agregar equipos (AFI)* (selección múltiple; avisa si el equipo estaba en otra locación). Botón *Cambiar* en cada equipo = elegir Empresa → Área → Locación. ✕ = quitarlo (queda Sin locación). El Admin puede marcar *Registrar también en Movimientos*.
- **Perfil de Equipo:** bloque *Ubicación actual del equipo* con las 3 listas en cascada. La **Empresa Arrendada** sale de la locación elegida (Fuera de Servicio → sigue siendo TALLER FRC).
- **Movimientos:** el *Origen* se completa solo con la locación actual del equipo y el *Destino* se elige con Empresa → Área → Locación. Al guardar, el equipo queda en esa locación.
- **¿No existe el lugar?** En cualquiera de las 3 listas elegir **➕ Crear nueva…** y escribir el nombre: si la empresa es nueva, el área y la locación también lo son. Se crean al guardar (perfil o movimiento) y aparecen en el módulo.
- Para que el resto del sistema no cambie, al ubicar un equipo también se escribe `ubicacion = "ÁREA / LOCACIÓN"` y `empresa_arriendo = EMPRESA` (Inventario, Programas y Excel siguen leyendo esos textos). Al renombrar o mover una carpeta, esos textos se actualizan en sus equipos.
- Renombrar ✏️ y mover ⇄ (área a otra empresa, locación a otra área): Subadmin/Admin. Eliminar: solo Admin y solo si la carpeta no tiene subcarpetas (los equipos de una locación eliminada quedan Sin locación).
- Nombres en MAYÚSCULAS; no se repite el mismo nombre dentro de la misma carpeta.
- **Exportar Excel:** Empresa | Área | Locación | AFI | equipo | estado | horómetro (de la carpeta abierta o de todo).

### Georreferencia y mapa de equipos (Google Maps)

> ⚠️ Ejecutar **`sql/areas_georef.sql`** en Supabase (agrega `lat`, `lng` y `maps_url` a `bd_locaciones`).

- En cada **empresa, área o locación** → ✏️ → campo *Georreferencia Google Maps*: pegar el **link de Google Maps** o las **coordenadas** (`-33.4489, -70.6693`, también en grados `33°26'56"S 70°40'09"W`). Muestra las coordenadas leídas y un enlace *comprobar*.
  - Para obtenerlas: en Google Maps, **clic derecho sobre el lugar → clic en las coordenadas** (se copian). Los links cortos `maps.app.goo.gl` no traen coordenadas: se guardan como enlace, pero el punto no sale en el mapa.
- Una locación sin georreferencia propia usa la de su área o empresa (aparece como **"aprox."**, pin punteado).
- La locación abierta muestra su **mapa de Google** embebido; en cada carpeta y en el **Perfil de Equipo** hay *Abrir / Ver en Google Maps*.
- **Ver mapa de equipos** (botón arriba): todas las locaciones con sus equipos (o solo las de la empresa/área abierta). Pin con la cantidad de equipos, color por empresa, vista Mapa/Satélite. Clic en el pin = lista de AFI (clic en el AFI abre su perfil), *Abrir en Google Maps* y *Ver carpeta*. Abajo se listan las locaciones sin georreferencia para completarlas.
- El mapa usa Leaflet + OpenStreetMap/Esri (gratis, sin API key; se carga desde cdnjs al abrirlo). Google Maps se usa para el mapa de cada locación y los enlaces. Un mapa de Google con todos los pines requiere una API key de Google Cloud (se puede agregar después).
- El Excel exportado incluye la columna *GOOGLE MAPS* (coordenadas con enlace).

### Nivel SECTOR (2026-11-04)

La jerarquía ahora es **Empresa → Área → Sector → Locación → Equipos (AFI)**.
- `sql/areas.sql` (script completo, se puede repetir) agrega el tipo `SECTOR`, una regla en la base de datos que obliga el orden correcto
  (no se puede crear una locación directo en un área) y **migra** lo que ya existía: las locaciones que estaban directo en un área pasan a un sector **GENERAL** de esa área (los equipos se mantienen; luego se pueden renombrar o mover).
- El texto de ubicación de los equipos queda `ÁREA / SECTOR / LOCACIÓN`.
- Selector en Perfil, Movimientos y Cambiar: 4 listas (Empresa, Área, Sector, Locación), cada una con *➕ Crear nuevo…*. Si un nivel tiene una sola opción, se elige sola.
- Mover: área → otra empresa, sector → otra área, locación → otro sector. El Excel incluye la columna SECTOR.
- **Exportar Excel (Áreas):** hoja *Equipos* (Empresa, Área, Sector, Locación, AFI, equipo, estado, horómetro, **Latitud, Longitud, Georreferencia** propia/aprox./sin y enlace *Google Maps*) + hoja *Georreferencias* (cada empresa, área, sector y locación con sus coordenadas, cantidad de equipos y enlace). Respeta la carpeta abierta.

## Programas de Reparación: editar equipos asignados (2026-11-05)
- En la *Vista de Tabla por Naves* cada fila tiene un botón **Editar** (lápiz) en ACCIONES, visible para admin y subadmin. Eliminar (papelera) sigue siendo solo admin.
- Abre el modal de asignación en modo edición: se puede cambiar Programa, Equipo (AFI), Nave, Condición, **Tipo Trabajo**, Fecha Inicio y Fecha Fin. No cambia el estado ON/OFF.
- Valida que la fecha fin no sea anterior a la fecha inicio. No requiere SQL (usa columnas existentes de `bd_programas_items`).
- Favicon: la pestaña del navegador muestra el logo de la empresa (index.html + main.js, se sincroniza con el logo de Config & Usuarios).

## Taller · OT: quitar enlace, no unir OT antiguas, asignar programa al crear (2026-11-05)
- **Quitar OT del taller:** botón *Quitar* en la tabla "OT de reparación" y *Quitar OT N del taller* dentro de Actividades (admin y subadmin). La OT no se borra: solo pierde el enlace (`bd_ot.reparacion_id = null`) y **deja de contar** en el % de avance de la reparación/nave. También se puede desde Órdenes de Trabajo eligiendo "Sin enlace (OT normal)".
- **Unir OT desde la nave:** solo se ofrecen OT del AFI **pendientes** (no registradas en el Historial) y con fecha desde 7 días antes del inicio del programa (o de la creación de la reparación si es "sin programa"). Así no se une una OT antigua.
- **Crear OT:** al guardar una OT nueva sin enlace, si su AFI está en un programa de reparación **vigente** (y no reparado), pregunta si se asigna a ese programa. El selector "Programa de reparación / Taller" sigue disponible para elegirlo a mano.
- **Imprimir OT:** márgenes de 0,25" y la hoja se escala automáticamente para ocupar toda la hoja carta.
- **Inactividad:** el cierre de sesión por inactividad pasó de 5 a **10 minutos** (`INACTIVIDAD_MS` en core/sesion.js).
- No requiere SQL.

## Seguridad · Control Entrega EPP (2026-11-05)

> ⚠️ Ejecutar **`sql/epp.sql`** en Supabase → SQL Editor (crea `bd_trabajadores` y `bd_epp_entregas`, y carga los 24 trabajadores y 29 entregas de la planilla *CONTROL ENTREGA EPP.xlsx*). Se puede repetir sin duplicar.

- Menú **Seguridad → Control Entrega EPP** (reemplaza "Inicio Seguridad"). Archivos: `js/modules/epp/` (mapper, service, template, view).
- **Trabajadores** (tarjetas): nombre, cargo, RUT, tallas, EPP sin entregar nunca, perfil incompleto, última entrega. Filtros por texto, cargo y estado (activos / con EPP sin entregar / inactivos).
- **Perfil**: cada elemento con su talla y la **última entrega** (fecha y hace cuánto) + historial completo. Botones Entregar EPP, Editar, Ficha (Excel con columna de firma) y Eliminar (Admin; mejor marcar INACTIVO para conservar el historial).
- **Nuevo / Editar trabajador**: nombre, RUT, cargo, activo, observaciones y, por cada elemento, si lo **requiere** + su talla (atajo "misma talla en toda la ropa").
- **Entregar EPP**: fecha, motivo (inicial, reposición, deterioro, pérdida), observaciones y los elementos entregados con talla y cantidad → una fila por elemento en `bd_epp_entregas`. Si se entrega otra talla o un elemento no requerido, actualiza el perfil (opcional).
- **Planilla EPP**: matriz como el Excel (talla / SI / N/A + última fecha). Clic en una celda = entregar ese elemento.
- **Historial de entregas**: todas las entregas con filtros (texto, elemento, motivo, fechas). Eliminar registro: solo Admin.
- **Exportar Excel**: hojas *Planilla EPP*, *Control entrega* (última fecha por elemento y pendientes) e *Historial entregas*.
- Elementos: calzado, buzo, pantalón, polera, parka, primera capa, guantes cabritilla, guantes multiflex, guante soldador, lente claro, lente oscuro, respirador, fonos y tapón auditivo (`ELEMENTOS_EPP` en epp.mapper.js; para agregar uno se suma ahí).
- Importación: "GUANTES = SI" de la planilla → requiere cabritilla y multiflex (soldador queda en NO). Los trabajadores que solo estaban en la hoja de control (Juvenal Silva, Víctor Soto, Felipe Viveros, Abel Muñoz, Sebastián Díaz) quedan con perfil incompleto (sin tallas). Felipe Viveros estaba repetido: quedó uno solo.
- Permisos: ver = todos · crear/editar/entregar = Subadmin o Admin de **Seguridad** (o de RRHH) · eliminar = Admin.
- **RRHH**: `bd_trabajadores` está pensada como la base de trabajadores; cuando exista RRHH se le agregan columnas y este módulo sigue funcionando.

## Taller · OT de reparación por programa + pestaña "OT enlazadas" (Admin) (2026-11-05)

- La tabla **OT de reparación** del Taller muestra solo las OT de equipos del **programa que se está viendo** (selector "Programa" de arriba).
- Nueva pestaña **OT enlazadas** junto a *Taller · Naves* y *Programas y Gantt*, **solo para el Admin**: todas las OT enlazadas al taller (cualquier programa y "Sin programa"), con filtro por programa y búsqueda por folio/AFI. Botones Formato y Quitar.
- Archivos: `taller/enlaces.view.js` (pestaña), cambios en `taller.service.js` (`otsTallerPrograma`), `taller.template.js`, `reparacion.view.js`. No requiere SQL.
- (Se descartó la bitácora de enlaces: `sql/ot_enlaces.sql` y `taller/enlaces.service.js` ya no se usan y se pueden borrar.)

## Programa de Mantención: firmas al exportar (2026-11-05)
- **Exportar Programa (Excel)** de Mantención agrega al pie de las hojas *Mantención* y *Carta Gantt* el bloque de firmas: espacio para firmar, línea, "FIRMA", nombre y cargo — **IGNACIO NEIRA · JEFE DE OPERACIONES** (izquierda) y **BRANDON PÉREZ · JEFE SERVICIO TÉCNICO** (derecha), del mismo largo y centradas en cada mitad de la hoja.
- Para cambiar nombres o cargos: `FIRMAS_PROGRAMA` en `js/core/excel.js`. La función `bloqueFirmas(ws, firmas)` se puede reutilizar en otros Excel (1 a 3 firmas). No requiere SQL.

## Minutas: nuevo formato de exportación para enviar (2026-11-05)
- La hoja **Minuta** del Excel (Exportar minuta y Exportar todo) tiene un formato nuevo, centrado y simétrico (grilla de 40 columnas):
  - Encabezado con logo y títulos **centrados**; pie de página con nombre de la minuta y "Página X de N".
  - **Datos**: fecha de reunión, total de tareas, responsables y secciones.
  - **Resumen de cumplimiento**: 8 tarjetas (Total, Realizado, En proceso, Pendiente, No realizado, Vencidas, A tiempo, % Cumplimiento) + barra de avance.
  - **Resumen por responsable**: total, realizado, en proceso, pendiente, no realizado, vencidas y % por persona.
  - **Detalle de tareas** por sección (cada sección con su n° de tareas y % cumplido) y nueva columna **SITUACIÓN** ("VENCIDA hace X días", "Vence en X días", "Vence HOY", "Realizada a tiempo", "Realizada con X días de atraso"...). Filas vencidas en rojo, estado con color.
  - Sin líneas de cuadrícula; el alto de las filas se ajusta al texto; al imprimir se repite el encabezado de la tabla en cada página.
- En todas las hojas de Minutas los títulos y los gráficos quedan centrados. Archivo: `js/modules/minutas/minutas.export.js`. No requiere SQL.

## Horómetro manual: ya no se sobrescribe solo (2026-11-06)
- Antes, al guardar una mantención/inspección en el Historial con un horómetro mayor, el sistema copiaba ese horómetro y su fecha al campo **"Último horómetro tomado (manual)"** del equipo. **Se quitó**: ese campo ahora solo cambia cuando el usuario lo edita en el Perfil (*Actualizar horómetro* o *Guardar*).
- *Guardar perfil* solo envía el horómetro manual y su fecha **si se modificaron** y ambos están completos.
- Si el equipo no tiene fecha de horómetro manual, el campo queda **vacío** (antes se rellenaba con la fecha de hoy y al guardar quedaba una fecha falsa, ej. 9439 hrs del 07-10 guardado como 02-11). *Actualizar horómetro* exige la fecha y no acepta fechas futuras.
- El cálculo (horas aprox., próxima mantención) sigue usando el historial como antes (`core/horometros.js`).
- Archivos: `historial/historial.service.js`, `inventario/perfil.service.js`. No requiere SQL. Los equipos que ya quedaron con el dato cambiado se corrigen a mano en su Perfil.

## Programas: editar nombre y fechas (2026-11-06)
- En la lista de programas (Mantención y Reparación) cada programa tiene un botón **lápiz** (solo Admin) que abre el mismo formulario de "Crear Programa" en modo **Editar**: nombre, subcarpeta, fecha inicio y fecha término. Los equipos asignados no se tocan.
- Si se cambia el **nombre**, también se actualiza `uso_de_art` de las mantenciones del Historial que tenían ese programa (el enlace Programa ↔ Historial es por nombre), avisando cuántas son. No permite dos programas con el mismo nombre.
- Archivos: `programas/programas.service.js` (`abrirModalEditarPrograma`, `guardarEdicionPrograma`), `programas.template.js`, `modal-programa.template.js`. No requiere SQL.

## Movimientos editables + datos del equipo; Filtros con tipo/marca/modelo (2026-11-06)
- **Movimientos:** nueva columna **EQUIPO (tipo · marca · modelo)**; la columna TIPO pasa a llamarse **TIPO MOVIMIENTO**. Columna **EDITAR** (solo Admin): abre el mismo formulario en modo edición (fecha, tipo, origen, destino —texto guardado o nueva locación de Áreas—, estado, camión, conductor). Casilla opcional *Actualizar también el equipo*: solo en el último movimiento del equipo. La política RLS existente (Admin de Operaciones) ya permite editar.
- **Registrar movimiento:** al elegir el AFI muestra **Tipo equipo, Marca y Modelo**; la lista de AFI también los muestra.
- **Filtros:** la referencia cruzada muestra en la cabecera **TIPO · MARCA · MODELO**, los botones dicen "AFI xxx" (con tooltip del equipo); "Último uso (AFI xxx)" agrega el equipo; el comparativo muestra los equipos como "TIPO MARCA MODELO".
- Archivos: `movimientos/` (service, mapper, template, modal), `filtros/filtros.service.js`, `filtros/filtros.template.js`. No requiere SQL.

## 2026-11-09 · Minutas: eliminar filas (Subadmin) y N° Item con "Guardar cambios"
- **Eliminar filas**: el botón 🗑 de cada tarea ahora lo ven Admin y Subadmin (Subadmin solo en la última minuta, como el resto de la edición). La política RLS de `bd_minutas_items` ya permitía borrar con nivel subadmin: no requiere SQL.
- **N° Item en borrador**: al escribir un N° la fila ya no salta de posición. El N° queda marcado en ámbar y aparece el botón **Guardar cambios (n)** (y **Descartar**). Al guardar se graban los N° en Supabase y recién ahí las filas se ordenan.
- Si se cambia de minuta con N° sin guardar, se pide confirmación.
- Archivos: `minutas.service.js` (nItemVisible, cambiarNItem, nItemPendiente, cambiosNItem, guardarCambiosNItem, descartarCambiosNItem; eliminarTarea usa soloEditor) y `minutas.template.js`.

## 2026-11-09 · Minutas: mover secciones ▲▼ · Excel de Programas con hoja "Inicio" (dashboard)
- **Minutas – mover secciones (títulos):** cada título amarillo tiene flechas ▲▼ (Admin en cualquier minuta, Subadmin solo en la última). El orden se guarda en la columna nueva `orden_seccion` de `bd_minutas_items` y se copia al crear la minuta siguiente. Si una tarea cambia de sección, toma la posición de esa sección (sección nueva → queda al final). **Requiere ejecutar `sql/minutas_orden_secciones.sql`** (sin eso, las flechas avisan que falta la columna y todo lo demás sigue funcionando).
- **Programas → Exportar Excel:** ahora la primera pestaña es **Inicio** con un dashboard:
  - Reparación (antes de las pestañas por nave): KPI (equipos, reparados, pendientes, atrasados, % avance, % tiempo transcurrido, fuera de vigencia), gráficos (estado general, avance por nave, equipos por tipo, carga del taller por día) y tablas (resumen por nave, por condición, equipos atrasados).
  - Mantención: KPI (programados, realizadas, % cumplimiento, pendientes, atrasadas, % a tiempo, próximos 7 días, pendientes sin kit en bodega), gráficos (estado, programado vs realizado acumulado, por tipo, por ubicación) y tablas (por tipo, atrasadas, próximos 7 días).
  - Los gráficos se dibujan con Chart.js y se insertan como imagen. Helper nuevo `hojaDashboard` / `graficoPNG` en `core/excel.js`; armado en `programas/programas.dashboard.js`.
- Archivos: `minutas.service.js`, `minutas.template.js`, `sql/minutas_orden_secciones.sql`, `core/excel.js`, `programas/programas.dashboard.js` (nuevo), `programas/programas.service.js`.

## 2026-11-09 · Nuevo módulo VEHÍCULOS (Operaciones → Equipos → Vehículos)
- **Qué es un vehículo:** todo equipo de `BD_INVENTARIO` cuyo AFI es una **patente con formato XXXX-XX** (ej. `RTZK-45`). Se detecta solo (`esVehiculo` en `inventario/inventario.mapper.js`). Los vehículos **ya no aparecen en Inventario AFI** (ahí hay un botón "Vehículos (N)" que lleva al módulo); en Movimientos, Historial, Programas y OT siguen funcionando igual con la patente como AFI.
- **N° AFI:** cada vehículo tiene su N° AFI interno (`bd_vehiculos.numero_afi`), que se muestra como "AFI: 615" en la tarjeta y el perfil. La patente sigue siendo la clave en todo el sistema.
- **Tarjetas** (como Inventario): foto, placa con la patente, estado, ubicación/empresa, bloque **Kilometraje**, bloque **Horómetro** y los 3 documentos principales con su estado.
- **Kilometraje** — mismo cálculo que el horómetro (`calcularKm` en `vehiculos.service.js`):
  uso km/día = (último km tomado − km última mantención) / días (si no: penúltima vs última mantención; si no: últimas 2 lecturas; si no: 80 km/día).
  Km aprox. hoy = último km + días × uso · Meta = km última mantención + frecuencia (por defecto 10.000 km, editable por vehículo) · Estado AL DÍA / PRÓXIMO (≤ 1.000 km) / ¡PASADO! · fecha aproximada.
  Se registran **lecturas** o **mantención realizada** (esta fija el punto de partida de la meta). Historial de lecturas con km recorridos; eliminar = Admin.
- **Horómetro:** el mismo del Perfil de Equipo (`BD_INVENTARIO.horometroactual`); se puede actualizar desde el perfil del vehículo. La mantención por horas sigue saliendo del Historial.
- **Documentos:**
  - **Principales:** Revisión Técnica, Permiso de Circulación y SOAP (12 meses por defecto).
  - **Secundarios:** cualquier otro (padrón, revisión de gases, certificados, etc.).
  - Cada documento: emisión, **duración** (días / meses / años), **vencimiento** (= emisión + duración, o escrito a mano), **aviso X días antes** (30 por defecto), N°/folio, archivo (Storage `archivos_frc/vehiculos/<PATENTE>/`) y observación.
  - Estados: VIGENTE · POR VENCER (dentro de los días de aviso) · VENCIDO · SIN CARGAR. Se muestra el tiempo restante ("Quedan 15 días", "Vencido hace 5 días").
  - **Renovar** = cargar uno nuevo; el anterior queda como historial. Corregir = Subadmin/Admin; eliminar = Admin.
- **Avisos:** tarjetas de resumen (vencidos, por vencer, sin cargar, mantención por km y por horómetro) y una lista de **Avisos** ordenada por urgencia; clic abre el perfil en la pestaña correspondiente. Filtros por aviso, estado, búsqueda y orden "Más urgentes primero".
- **Agregar vehículo:** crea el registro en `BD_INVENTARIO` (AFI = patente, se formatea sola a XXXX-XX) + N° AFI, km inicial y frecuencias.
- **Exportar Excel:** hojas *Vehículos*, *Documentos* y *Avisos* con colores por estado.
- Permisos: ver = todos · crear/editar/registrar km/subir documentos = Subadmin o Admin de **Operaciones** · eliminar = Admin.
- **Requiere ejecutar `sql/vehiculos.sql`** en Supabase (tablas `bd_vehiculos`, `bd_vehiculos_km`, `bd_vehiculos_documentos` + RLS). Sin eso, los vehículos se ven igual pero sin km ni documentos (aparece un aviso).
- Archivos: `js/modules/vehiculos/` (nuevo: mapper, service, template, view), `sql/vehiculos.sql` (nuevo), `core/menu.js`, `core/tablas.js`, `main.js`, `inventario/inventario.mapper.js`, `inventario.service.js`, `inventario.template.js`.

## 2026-11-09 · Vehículos: el horómetro ES el kilometraje · frecuencia 10.000 km
- En los vehículos (AFI = patente XXXX-XX) **todo lo que el sistema llama "horómetro" es kilometraje**: `BD_INVENTARIO.horometroactual` = último km tomado y `BD_HISTORIAL.horometro` = km de cada mantención.
- `core/horometros.js`: para patentes usa frecuencia por defecto **10.000 km**, uso por defecto **80 km/día** y aviso **PRÓXIMO desde 1.000 km** (en equipos sigue 250 h / 1,5 h/día / 50 h). El objeto `horometros` trae `esVehiculo`, `unidad` ('km' | 'h') y `umbralProximo`.
- Módulo Vehículos: se quitó el bloque "Horómetro" (tarjetas, perfil, avisos, filtro y Excel). Queda solo **Kilometraje**, calculado con el mismo motor de siempre.
  - **Registrar kilometraje** actualiza el km tomado del inventario (y queda en la bitácora `bd_vehiculos_km`).
  - **Registrar mantención** abre "Agregar Mantención" del Historial: su campo ahora dice **Kilometraje (km)** cuando el AFI es una patente, y fija la próxima meta (km + 10.000).
  - Historial de kilometraje del perfil = lecturas + registros del Historial con km.
  - "Mantención cada (km)" se guarda en `BD_INVENTARIO.frecuencia_mantencion`.
- Perfil de Equipo e Historial muestran **km** en vez de h/hrs cuando el AFI es una patente. `esPatente` disponible en todas las plantillas (core/comunes.js).
- Nuevo equipo con patente (o importado sin frecuencia) → 10.000 km.
- **SQL:** `sql/vehiculos_frecuencia_10000.sql` deja la frecuencia en 10.000 a todos los vehículos ya existentes (también quedó al final de `sql/vehiculos.sql`).

## 2026-11-09 · Historial: "Cargar documentos" (carga masiva de PDF enlazados a cada registro)
- Botón **Cargar documentos** en Historial (Subadmin/Admin de Operaciones). Se elige una **carpeta** (ej. `DOCUMENTOS EQUIPOS/2026/ABRIL`) o varios archivos (PDF, JPG, PNG).
- Del nombre se lee: **AFI** (números de 2 a 4 dígitos o patentes que existan en el inventario; "759, 760, 761" o "127_147" = mismo archivo para cada AFI), **fecha** dd-mm-aaaa (si falta o no calza, se usa la de la carpeta `dd-mm-aaaa`), y **tipo**: si dice MANTENCION → registro de mantención; si no → otra intervención. Se ignoran sufijos de página/copia ("_001", "_page-0002", "(1)").
- Busca el registro de `BD_HISTORIAL` con mismo AFI + fecha + tipo (si no hay ese día, ± 3 días). Vista previa con estados: Listo · Revisar · Ya tiene documento · Sin registro · Sin AFI. En cada fila se puede corregir AFI, fecha, tipo (clic) y elegir el registro de una lista (± 20 días).
- Al confirmar sube a Storage `archivos_frc/historial/<AFI>/…` y guarda la URL en `BD_HISTORIAL.link` (botón "Drive" del Historial). Si varios archivos van al mismo registro se **unen en un solo PDF** (pdf-lib 1.17.1 desde cdnjs, se carga solo si hace falta). Por defecto no reemplaza documentos existentes (casilla para reemplazar).
- Ojo con el espacio: las carpetas 2025 + 2026 pesan ~880 MB; el plan gratis de Supabase Storage trae 1 GB.
- Archivos: `historial/carga-documentos.service.js`, `historial/carga-documentos.view.js` (nuevos), `historial.template.js`, `historial.view.js`. No requiere SQL.

## 2026-11-09 · Perfil de Equipo: columna "Doc." en el historial
- La tabla "Historial completo de mantenciones del equipo" del Perfil tiene la columna **Doc.** (junto a la fecha) con el botón **Ver** para abrir el documento enlazado (`BD_HISTORIAL.link`, el mismo que se carga con "Cargar documentos" o al registrar la mantención). Si el registro no tiene documento muestra "—".
- Archivo: `inventario/perfil-equipo.template.js`. No requiere SQL.

## 2026-11-09 · Programa de Mantención: tipos 250 / 500 / 1000 / Intermedia · la intermedia no cambia el equipo
- Cada equipo del Programa de Mantención tiene **Tipo de mantención**: 250 hrs, 500 hrs, 1000 hrs o **Intermedia (filtros de aire)**. Se elige al asignar el equipo y se puede cambiar en la columna nueva **TIPO MANT.** (Admin, mientras esté pendiente). Se guarda en `bd_programas_items.tipo` (los antiguos quedan "Sin tipo" = mantención normal). No requiere SQL.
- **Enlace con el Historial** (campo "Programa" de la mantención): en programas de MANTENCIÓN solo cuentan registros cuya causa diga **MANTENCION**:
  - "MANTENCION INTERMEDIA" → marca REALIZADO un ítem **Intermedia** del equipo.
  - Mantención normal → marca REALIZADO un ítem 250 / 500 / 1000 (o sin tipo).
  - En programas de REPARACIÓN sigue igual (cualquier registro con ese programa).
- **La intermedia no cambia nada del equipo**: `claseMantencion()` en `core/horometros.js` ('COMPLETA' | 'INTERMEDIA' | null). Solo la COMPLETA reinicia horómetro/km, la meta, la mantención anual y la "Última mantención" del programa.
- La intermedia **no descuenta KIT** de bodega (columna Kit muestra "Solo filtro aire") y no se cuenta en el resumen de kits del programa.
- Excel del programa: columna nueva **TIPO MANT.**
- Archivos: `core/horometros.js`, `programas/programas.service.js`, `programas.template.js`, `programas.view.js`, `modal-asignar.template.js`, `modal-asignar.view.js`, `vehiculos/vehiculos.service.js`, `vehiculos.template.js`.

## 2026-11-09 · Análisis de Fallas (módulo nuevo) · Perfil de Equipo en pestañas · Historial compacto
- **Operaciones → Mantenimiento → Análisis de Fallas** (`js/modules/fallas/`, cálculo en `js/core/analisis-fallas.js`):
  - Clasifica cada registro del Historial por **sistema** (Eléctrico, Generación/Panel, Motor, Combustible, Refrigeración, Hidráulico, Lubricación/Filtros, Transmisión/Rodado, Estructura, Iluminación, Servicio/Inspección, Otros) leyendo **causa + causa detallada + descripción** con palabras clave (`CATEGORIAS_FALLA`; para afinar, agregar palabras ahí).
  - Por defecto excluye las mantenciones (casilla "Incluir mantenciones"). Filtros: período, tipo de equipo, sistema, AFI.
  - KPI (intervenciones, equipos, sistema que más falla, repetidas < 30 días, **horas de trabajo** desde Total horas o Inicio/Término, costo), **Hallazgos** escritos (qué falla más, qué consume más horas, problema más repetido, equipo con más fallas, equipos que vuelven a fallar en < 30 días, tipo de equipo que más falla por unidad, tendencia 90 días), gráfico por sistema (clic filtra) y evolución mensual, problemas que más se repiten, palabras más usadas, tabla por tipo de equipo y **ranking de equipos** (sistema top, problema más repetido, repetidas, días entre fallas, horas; clic despliega sus registros). Exportar Excel (Sistemas, Equipos, Problemas, Detalle).
- **Perfil de Equipo** reorganizado en **pestañas**: Resumen (horómetro/km + hallazgos) · Historial (estadísticas + tabla compacta) · **Fallas** (análisis del equipo: lo que más le falla, problemas repetidos, fallas repetidas < 30 días, cada cuántos días falla, comparación con el promedio de su tipo, registros clasificados) · Datos y ubicación (+ asignar a programa) · Filtros y ficha · OC y traslados. Encabezado con tipo/marca/modelo, estado y ubicación, y barra de indicadores rápidos.
- **Historial sin barra hacia el lado**: tabla compacta (`historial/tabla-historial.view.js`, componente global `tabla-historial`) con Fecha · AFI · Causa/Tipo · Causa detallada · Sistema · Horas · Horómetro/Km · Doc. Clic en la fila despliega todo lo demás (programa, mecánicos, horas, costo, filtros, OC, OT, aceites, sistema detectado). Muestra de a 100 (botón "Ver más"). Se usa en el módulo Historial y en el Perfil.
- **Cargar documentos**: ventana más compacta (max 4xl, tabla más chica, filtros en "chips").
- No requiere SQL.

## 2026-11-09 · Análisis de Fallas: PIEZA y MOTIVO · filtros · arreglos
- Además del sistema, cada registro detecta la **pieza** (correa, batería, motor de partida, alternador, AVR, radiador, manguera, filtro de aire, ampolleta…) y el **motivo** (rotura/corte, desgaste, fuga, suelto/mal tensado, quemado, descargado, tapado/sucio, sobrecalentamiento, golpe/mal uso, robo, falta de nivel/mantención, desconfiguración) leyendo causa detallada + descripción (`PIEZAS` y `MOTIVOS` en `core/analisis-fallas.js`; para afinar, agregar palabras ahí).
- Módulo Análisis de Fallas: tabla **"Piezas que más fallan y por qué"** (motivos con cantidades y equipos; clic filtra), barra de **Motivos de falla**, filtros nuevos **Pieza** y **Motivo**, hallazgos de pieza y motivo, hoja Excel **Piezas** y columnas Pieza/Motivo en Detalle.
- Perfil → pestaña Fallas: "Piezas y por qué fallaron" y **filtros en Registros clasificados** (buscar, sistema, pieza, motivo, causa). Cada registro muestra su pieza y motivo.
- Historial (detalle de la fila): "Pieza · motivo detectado".
- Ya no cuentan como falla los registros **preventivos/predictivos** (tipo, causa o causa detallada dicen PREVENTIVA/PREDICTIVA), además de las mantenciones. Palabras como "preventiva", "correctiva", "hrs" ya no se toman como "problema repetido".
- **Horas de trabajo** = suma de "Total horas" de cada falla (o término − inicio si no hay total). Se ignoran valores de más de 16 h en un registro y textos tipo "250 HRS" (son datos mal ingresados o el tipo de mantención).
- Arreglo: en el Perfil (y en el perfil de Vehículos) el menú de pestañas ya no queda tapado al abrir Historial o Fallas.
- (ajuste) "Problema que más se repite" ya no toma inspecciones, revisiones, pruebas, limpiezas, etc. (son actividades, no problemas). Si el registro indica una pieza, el problema se agrupa como "pieza · motivo" (ej. "Correa · rotura / corte").
- (ajuste) "Problema" ya no se arma con texto libre: solo con **pieza**, **motivo** o **señal de alerta** (`SINTOMAS`: quedó fuera de servicio, no parte, se apaga, no genera, alarma, ruido/vibración, humo, pierde potencia, alta temperatura, baja presión). Revisiones, inspecciones, etc. no son problema. "Palabras más usadas" pasó a **Señales de alerta**; hallazgo nuevo: cuántas fallas dejaron el equipo fuera de servicio.

## 2026-11-09 · Análisis de Fallas: diccionario técnico
- `core/analisis-fallas.js` reconoce piezas nuevas (corta corriente, bocina/baliza, alimentadores Cooper, manifold/válvulas, acoples, patas estabilizadoras, pasadores/pernos, parabrisas, enfriador, retén de cigüeñal) y errores de tipeo frecuentes (READIADOR, MANGERA, REGRIGERANTE, OCMBUSTIBLE, MODILO, ALTA TEMEPRATURA…).
- Motivos: "mal estado" → desgaste; "saturado" → tapado. Causas ESTANDARIZACION, IMPLEMENTACION, CHECK LIST, ACTIVIDAD y PUESTA EN MARCHA ya no cuentan como falla.

## 2026-11-09 · Lectura de documentos escaneados (gratis, OCR) · datos de la hoja
- **Ejecutar `sql/historial_documentos.sql`** (agrega `art`, `numero_folio`, `causa_falla` a BD_HISTORIAL). Si no se ejecuta, todo sigue funcionando pero no se guardan esos 3 datos (avisa).
- Formulario del Historial: sección **Datos de la hoja** → N° folio, Uso de ART, Bloqueo de equipo, Hora falla, Causa de la falla (antes bloqueo se guardaba siempre "NO" y hora falla vacía).
- **Leer el documento al adjuntar** (casilla en el formulario): `core/ocr-documentos.js` (pdf.js + Tesseract.js, en el navegador, sin costo ni claves). Lee solo lo IMPRESO:
  - qué es cada página: Intervención mecánica · Pauta de mantención · ART · Orden de compra;
  - N° de folio (canal rojo + solo dígitos, ej. 000214 / 005119);
  - si trae ART → Uso de ART = SI; si trae OC impresa → N° OC.
  - Hoja de INTERVENCIÓN en un registro nuevo → limpia causa "MANTENCION" para elegirla; avisa si la causa no calza con la hoja.
  - En registro nuevo toma AFI y fecha del nombre del archivo. Solo completa campos VACÍOS.
  - La letra a mano (horómetro, horas, mecánicos, descripción) no se lee: se completa a mano.
- **Cargar documentos**: casilla "Leer el contenido al subir" y botón **"Leer documentos ya subidos"** (lotes de 10–100, se puede detener; solo documentos guardados en Supabase Storage). Nunca borra ni reemplaza: solo completa folio, ART y OC vacíos. Lista de **Lecturas** con lo completado y botón **Deshacer lo completado**. Avisa si una hoja de intervención quedó en un registro de mantención.
- Las librerías se cargan solo al usar la lectura (la página no se pone más lenta). Primera lectura ~10–20 s (descarga el idioma español); luego ~3–7 s por página.
- (ajuste) Se revisan hasta **15 páginas** por PDF, dibujadas de a una (no se llena la memoria). Una pauta de 2 hojas (generador, manipulador, minicargador…) cuenta como UNA: la hoja siguiente del mismo tipo sin folio o con el mismo folio es continuación. Si el PDF trae 2 hojas principales distintas (ej. pauta 000214 + intervención 005119) se avisa en el formulario y en la lista de Lecturas; se usa la primera. Varias OC en un PDF → se agregan todas.

## 2026-11-09 · Formulario con la hoja al lado (PRUEBA) · Completar pendientes
- `historial/form-ayudas.js` (nuevo). Todo queda en el sistema; no se envían documentos a terceros.
- **Hoja al lado**: si el registro tiene documento (o se acaba de adjuntar), la ventana se agranda y muestra el PDF/imagen a la izquierda y el formulario a la derecha (en celular: arriba/abajo). Botón "Ocultar hoja / Ver hoja al lado". Imágenes con zoom y girar; PDF con el visor del navegador. Links antiguos de Google Drive se muestran en modo vista previa.
- **Sugerencias** al escribir mecánicos, lugar, causa detallada y empresa/arriendo (lo más usado en el Historial).
- **Dictado por voz** (botón micrófono) en causa detallada, descripción (ahora caja grande) e interferencia. Usa el reconocimiento de voz de Chrome/Edge (el audio lo procesa el servicio del navegador; el documento no se envía). Alternativa en Windows: tecla Windows + H.
- **Control del horómetro/km**: avisa en rojo si es menor que el registro anterior o mayor que el siguiente del mismo AFI, y en amarillo si subió más horas que los días transcurridos (km: > 1.500/día).
- **Completar pendientes** (botón en Historial): recorre uno a uno los registros con documento a los que les falta descripción/causa detallada, mecánicos u horómetro. Botones Guardar y siguiente · Saltar · Anterior · Salir, y contador "Pendiente X de N".
- Para quitarlo: borrar el botón "Completar pendientes" en `historial.template.js` y el bloque "HOJA AL LADO" en `form-mantencion.template.js`. No requiere SQL.

## 2026-11-09 · Costos de Mantención (módulo nuevo) · filtros enlazados por "SIRVE PARA"
- **Ejecutar `sql/costos_mantencion.sql`** (tabla `bd_config` para guardar la configuración compartida). Sin él todo funciona con los valores por defecto, pero no se puede guardar la configuración.
- **Filtros → Importar planilla**: ahora lee las columnas **SIRVE PARA, SIRVE PARA 2…** (ya no se toman como proveedores). Cada modelo se busca en el inventario sin importar espacios/guiones ("P-100" = "P100"), se toma su MARCA y se crea el enlace filtro ↔ marca/modelo en `bd_filtros` (cantidad 1; no duplica ni cambia los que ya existen). Los modelos que no están en el inventario se guardan sin marca y se avisan.
- **Mantenimiento → Costos de Mantención** (`js/modules/costos/`):
  - Valor de cada mantención 250 / 500 / 1000 hrs por modelo = filtros del modelo (opción más barata de cada tipo × cantidad) que van en esa mantención + costo adicional fijo opcional (aceite, mano de obra).
  - "Qué incluye cada mantención" (Admin): matriz grupo de filtro × 250/500/1000 + adicional $; se guarda para todos. Por defecto: aceite, combustible y aire en todas; hidráulico y cabina desde 500; separador de aceite, refrigerante, transmisión y otros solo en 1000.
  - **Horas de uso a proyectar** (250…5000 o escribir): cuántas mantenciones caen desde el horómetro aproximado de hoy, de qué tipo (por horómetro nominal: múltiplos de 1000 → 1000, de 500 → 500, resto → 250), fecha estimada (uso diario) y costo. Las vencidas se marcan.
  - KPI (costo proyectado, mantenciones 250/500/1000, vencidas, modelos sin filtros), vista **Por modelo** (tarjetas con costo 250/500/1000, AFI y detalle de filtros), **Por equipo** (próxima mantención, cantidades, costo; clic → todas las mantenciones), **Faltan datos** (modelos sin filtros y filtros sin precio). Sin vehículos.
  - **Excel**: Resumen (KPI), Por modelo, Por equipo, Proyección (cada mantención), Filtros por modelo (en qué mantención va cada uno), Sin filtros.
- **Perfil → pestaña "Costo mantención"**: valor de la 250 / 500 / 1000 con sus filtros, proyección con horas editables, tabla de mantenciones con fecha, costo y acumulado, y Excel del equipo.
- (ajuste Análisis de Fallas) La **causa detallada pesa x3** frente a la descripción, y de la descripción se ignoran las **revisiones y pruebas de rutina** ("se revisa temperatura, nivel de combustible", "se realizan pruebas quedando presión 10 bar"…) salvo que indiquen falla (bajo, falta, fuga, roto, no parte…). Ej.: "MODULO CON LECTURAS ERRONEAS" ya no sale como Combustible sino Generación / Panel de control. "Temperatura" sola ya no es sobrecalentamiento; motivo nuevo "lectura errónea" (dentro de Desconfiguración).
- (ajuste) **Módulo / controlador / panel de control / display** pasan a **Eléctrico / control** (es electrónica de control de cualquier equipo, no solo de generadores). "Generación" queda para AVR, voltaje, frecuencia, breaker, excitatriz, transferencia, alimentadores.

## 2026-11-09 · Causas probables por componente (conocimiento técnico)
- `js/core/conocimiento-fallas.js` (nuevo): para cada pieza (mismas keys de PIEZAS) sus fallas típicas con **causas probables** (más común primero), **qué revisar** y **cómo prevenir**, y con qué motivos calza. Mismo contenido que el doc "Causas de falla por componente FRC". Para afinar: editar ese archivo.
- Componente global `<causas-probables>` (`modules/fallas/causas-probables.view.js`): ordena las fallas según el motivo detectado (ej. correa + rotura → primero "se corta").
  - Análisis de Fallas → "Piezas que más fallan": botón **Causas** por pieza.
  - Perfil → Fallas: la pieza que más se repite muestra sus causas; las demás con **¿por qué?**.
  - Historial → detalle de una falla: causas probables de la pieza detectada (no en mantenciones).
- Piezas nuevas en el análisis: Unidad compresora, Separador de aceite (compresor), Válvula de admisión / descarga / seguridad. "Separador" solo cuenta como separador de agua cuando no dice "de aceite".
- (ajuste) **La pieza manda sobre el sistema**: si la causa detallada nombra una pieza (o la descripción la nombra y dice qué le pasó), el sistema es el de esa pieza (correa → Motor, módulo → Eléctrico / control, manguera → Hidráulico, radiador → Refrigeración…). Sin pieza se usan las palabras clave ("FALLA EN MOTOR, CAMBIO DE ACEITE" → Motor). Una inspección que solo nombra piezas sigue como Servicio / Inspección.

## 2026-11-10 · Minuta en Excel con fórmulas (se actualiza sola)
- Hoja **Minuta** del Excel: el resumen de arriba (total, realizado, en proceso, pendiente, no realizado, vencidas, a tiempo, % cumplimiento, barra), el **resumen por responsable** y el % de cada **sección** ahora son **fórmulas** que leen la tabla de tareas.
- **ESTADO** con lista desplegable (PENDIENTE / PROCESO / REALIZADO / NO REALIZADO) y **SITUACIÓN** con fórmula (a tiempo, días de atraso, vencida hace X días, vence en X días). Al cambiar el estado o escribir la FECHA REALIZADO se recalcula todo; colores del estado, situación, % y filas vencidas por formato condicional (usan HOY()).
- Columnas ocultas de apoyo AO:AR (responsable, vencida 1/0, a tiempo 1/-1, sección); no se imprimen.
- Hoja **Dashboard**: tablas por sección y por encargado con fórmulas hacia la hoja Minuta. Los gráficos siguen siendo imagen del momento de la descarga.

## 2026-11-10 · Programa de REPARACIÓN se llena solo desde el Historial
- Al guardar en el Historial un registro con un **programa de reparación** elegido, si el AFI no está en ese programa se **agrega solo** (tipo Reparación, fecha programada = fecha del registro) y queda **REALIZADO** con esa fecha. Si el mismo AFI tiene más registros con ese programa que ítems, se agregan los que faltan (uno por registro). Funciona aunque el programa se haya creado vacío.
- El botón "Sincronizar con Historial" del programa hace lo mismo para todos los registros que nombran el programa.
- Programas de **MANTENCIÓN** sin cambios (los equipos se planifican antes); ahora avisa si el AFI no está en el programa y no se marcó nada.
- Archivos: `programas/programas.service.js` (agregarFaltantesReparacion), `historial/historial.service.js`. No requiere SQL.
- (ajuste) En la tabla del **programa de reparación**, FECHA INICIO y FECHA FIN se editan directo en la fila (como en mantención) para Admin y Subadmin; la fecha fin no puede ser anterior a la de inicio (`actualizarFechasItemReparacion`).

## 2026-11-10 · Exportar Historial con formato (hoja de vida del equipo + general)
- `historial/historial.export.js` (nuevo), con el estilo de `core/excel.js` (logo, títulos centrados, encabezados de color, filas alternadas, totales, filtro, impresión apaisada con encabezado repetido y N° de página).
- **Perfil → Historial → "Exportar hoja de vida"** (respeta los filtros de fecha y causa del Perfil):
  - Resumen: KPI (registros, mantenciones, fallas, horas de trabajo, costo, total OC), gráficos (fallas por sistema, registros por mes), ficha del equipo (estado, horómetro/km aprox., próxima mantención), registros por causa y piezas que más fallan.
  - Historial: detalle completo (fecha, tipo/causa, sistema·pieza·motivo, causa detallada, descripción, horómetro, horario, horas, mecánicos, lugar, OT/OC, costo, link al documento). Mantenciones en verde, intermedias en azul. Alto de fila según el texto.
  - Filtros y aceites usados en cada mantención.
- **Historial → "Exportar Excel"** (lo filtrado): Resumen (KPI, gráficos por causa / mes / sistema, equipos con más registros), Historial (detalle con AFI y equipo), Por equipo y Filtros y aceites. El CSV sin formato sigue disponible en el link "CSV".
- "Falla" = no es mantención/preventivo ni servicio/inspección.
- (ajuste) En el Excel del Historial (equipo y general) la **causa detallada, la descripción y el lugar salen corregidos** con `core/ortografia.js`: errores de tipeo del diccionario técnico (MODILO → MÓDULO, READIADOR → RADIADOR, MANGERA → MANGUERA, OCMBUSTIBLE, ARRAQUE, RALIZA…), tildes de palabras técnicas (batería, hidráulico, válvula, mantención, revisión…), espacios y mayúscula al inicio de cada oración. Lo guardado en la base de datos NO cambia. Para agregar palabras: listas TIPEO y TILDES.

## 2026-11-10 · Guardar más rápido (recarga parcial)
- `cargarDatosDesdeSupabase(partes)` en `core/store.js`: antes cada guardado volvía a descargar las 15 tablas; ahora se puede recargar solo lo que cambió. Partes: `inventario`, `movimientos`, `historial`, `programas`, `modelos`, `formatos`, `filtros`, `bodega`, `oc`, `locaciones`. Sin parámetro = todo (inicio de la app y casos generales).
- Se usa en: Historial (guardar → historial + filtros; importar, cargar/leer documentos → historial), Perfil e Inventario (inventario), Movimientos (movimientos + inventario), Filtros (filtros), Formatos (formatos + modelos), Áreas (locaciones + inventario), Programas (crear programa → programas), Bodega (cambio de código → filtros + bodega).
- Si al recargar cambia inventario o historial, se recalculan los horómetros.

## 2026-11-11 · MIS TAREAS · Recordatorio de tareas personal (módulo nuevo)
- **Ejecutar `sql/recordatorios.sql`** (tablas `bd_recordatorios` y `bd_recordatorios_estado`). RLS por `auth_id = auth.uid()`: **cada usuario solo ve, crea, modifica y elimina SUS tareas**; nadie más las ve (tampoco el Admin general). Sin el SQL, la pantalla avisa que falta.
- Menú → **Mis Tareas** (botón directo bajo Inicio, para todos los usuarios, sin permisos por área). Archivos: `js/modules/recordatorios/` (service, template, view, avisos.view).
- **Tareas diarias**: todos los días, lunes a viernes o cada N días. Se marcan cada día por separado y muestran la racha de días cumplidos.
- **Tareas programadas**: una vez en una fecha, o semanal (días elegidos, cada N semanas), mensual o anual, con fecha "hasta" opcional. Si un día pasa sin marcarla (tarea única) queda **vencida**.
- Cada tarea: título, notas, fecha, hora o todo el día, prioridad (alta/media/baja), categoría (con colores), checklist de pasos, pausar. Acciones: hecha, pasar a mañana / próximo lunes, omitir solo un día (repetitivas), duplicar, eliminar.
- Pantalla con pestañas **Hoy** (agregar rápido, vencidas, tareas diarias, programadas, mini calendario, próximos 7 días) · **Semana** · **Mes** (calendario; las diarias se ocultan salvo "Mostrar tareas diarias") · **Todas mis tareas** (buscar/filtrar) · **Avisos** (preferencias). KPI: hoy, vencidas, próximos 7 días y % de cumplimiento de 7 días.
- **Avisos** (`iniciarMotorAvisos` en main.js, revisa cada 20 s):
  - **Campana** en el encabezado con contador (pendientes de hoy + vencidas; rojo si hay vencidas) y lista rápida.
  - **Ventana resumen al iniciar sesión** (vencidas, hoy, se acercan); una vez por inicio de sesión (no se repite con F5).
  - **Notificación de Windows** + **sonido** + tarjeta en pantalla: N minutos antes y a la hora; botones Hecha / +5 / +10 / +30 min.
  - **Aviso anticipado** (tareas únicas): desde N días antes, una vez al día.
  - **Resumen del día** a la hora elegida (08:00 por defecto).
  - Si la sesión se cierra por inactividad, sigue avisando las tareas con hora de las próximas 24 h mientras la página siga abierta; al apretar **Salir** se borra.
  - Preferencias por usuario y navegador (localStorage). Los avisos funcionan con el sistema abierto en el navegador (minimizado o en otra pestaña sirve).
- Inicio (Bienvenida): botón con el resumen de las tareas de hoy.

## 2026-11-11 · Programas: fechas en borrador con botón "Guardar fechas" (igual que la Minuta)
- **Mantención** (fecha programada y fecha realizada) y **Reparación** (fecha inicio y fecha fin): al escribir, la fecha queda en borrador (casilla amarilla). **No se guarda ni se mueve la fila** mientras se escribe; se puede poner cualquier fecha.
- Botones **Guardar fechas (N)** y **Descartar** junto a "Vista de Tabla" cuando hay cambios. Al guardar se valida todo; si algo no es válido **no se guarda nada**, aparece el error y la casilla queda en rojo con el motivo:
  - fecha incompleta o que no existe; año que no tiene 4 dígitos (ej. 202026) o fuera de 2000-2100;
  - mantención: fecha realizada futura;
  - reparación: fecha inicio vacía o fecha fin anterior a la fecha inicio.
- Recién al guardar la tabla se reordena por fecha. `programas.service.js` (fechaVisible, cambiarFechaBorrador, guardarCambiosFechas, descartarCambiosFechas) y `programas.template.js`. No requiere SQL.

## 2026-11-12 · Acceso por SUBMÓDULO y PERFILES de acceso
- Config & Usuarios → columna **Acceso a módulos** + botón **Módulos** por usuario: se elige módulo por módulo **No ve · Ver · Modificar (ver, agregar/subir y editar) · Todo (además eliminar)**. Botones para poner un nivel a toda un área o a todo. Opción "Sin restricción por módulo" = como antes (ve todo, manda el nivel por área).
- **Perfiles de acceso** (sección nueva): plantillas con nombre (ej. Bodega, Mecánico) que se asignan al crear el usuario o en la ventana Módulos. Al editar un perfil pregunta si actualizar a los usuarios que lo tienen. Se guardan en `bd_config` clave `perfiles_acceso` (requiere `sql/costos_mantencion.sql`, que crea esa tabla).
- **Inicio y Mis Tareas siempre se ven** (no se pueden quitar).
- Cómo se guarda: `usuarios.permisos._modulos = { modulo: nivel }` (+ `_perfil`). El nivel de cada área se guarda igual (= el mayor de sus módulos) porque la base de datos (RLS) revisa por área. Un módulo no marcado queda oculto del menú y si se abre por enlace vuelve a Inicio. En la pantalla, los botones de agregar/editar/eliminar siguen el nivel del módulo actual (`nivelEnModulo` en core/store.js).
- Ojo: ocultar es a nivel de pantallas. Los datos de un módulo oculto siguen siendo legibles para cualquier usuario conectado (RLS de lectura por miembro), igual que antes.
- No requiere SQL nuevo (usa la columna `permisos` existente).

## 2026-11-12 · Programa de REPARACIÓN: varios reportes por equipo (no se cierra solo)
- **Ejecutar `sql/reparacion_terminada.sql`** (columna `reparacion_terminada` en BD_HISTORIAL).
- Antes cada reporte del Historial con un programa de reparación marcaba el equipo REALIZADO y creaba otra fila del mismo equipo. Ahora: **una fila por equipo**; los reportes se suman ("N reportes · último dd-mm-aaaa") y el equipo queda **EN PROCESO** (la fecha fin se alarga hasta el último reporte).
- El equipo queda **REPARADO** con cualquiera de estas 3 formas:
  1. Historial → al elegir un programa de reparación aparece la casilla **"Reparación terminada"** (marcarla solo en el reporte final).
  2. Switch REPARADO en la tabla del programa (como antes).
  3. Taller · Naves → botón nuevo **EQUIPO LISTO / REPARADO** en la tarjeta de la nave (o Sacar → "Sí, reparado"): sale de la nave, queda Disponible y REPARADO en el programa. Pensado para los mecánicos (darles "Modificar" en Programas Reparación).
- Botón **Unir equipos repetidos (N)** (Admin) en el programa de reparación cuando un equipo aparece en varias filas: deja una (fecha inicio más antigua, fin más reciente, estado de la fila más reciente) y pasa la reparación del Taller a esa fila.
- Programas de MANTENCIÓN sin cambios (un documento = realizado).

## 2026-11-12 · OT abiertas en el Historial · cierre de OT · arreglos
- **Historial → N° OT**: muestra las **OT abiertas del AFI** (botones + lista al escribir). Abiertas = PENDIENTE (sin registros) o **EN PROCESO** (OT de reparación con reportes sin "Reparación terminada").
- Estados de OT (`estadoOT` en ot.service.js): PENDIENTE · EN PROCESO · REALIZADA · **CERRADA** (guardado en bd_ot.estado) · ANULADA. OT normal (mantención) = REALIZADA al registrarse en el Historial; OT de reparación = EN PROCESO hasta el reporte final.
- Las OT se **CIERRAN solas** cuando el equipo queda REPARADO: switch del programa de reparación, reporte con "Reparación terminada" o botón EQUIPO LISTO / Sacar → reparado en la nave (OT enlazadas al Taller + OT nombradas en sus reportes).
- En una OT cerrada / realizada **no se pueden agregar documentos**; solo el **Admin** puede (con confirmación) o **reabrirla** (Órdenes de Trabajo → botón Reabrir OT). Botón **Cerrar OT** manual para Admin/Subadmin. Desmarcar REPARADO reabre las OT solo si lo hace el Admin.
- Arreglo: el aviso del horómetro calculaba mal los días ("subió X h en 1 día"); ahora usa los días reales entre registros.
- Arreglo: en el formulario, un programa de REPARACIÓN con reportes sin terminar ya no dice "ya realizado": dice "en proceso" / "pendiente" / "reparado".
- No requiere SQL.

## 2026-11-12 · PROGRAMA REPARACIÓN MOTORES (módulo nuevo)
- **Ejecutar `sql/motores_externos.sql`** (tabla `bd_motores_externos` + carga del programa escrito a mano del 09-11-2026: AFI 365, 367, 366, 739, 362, 742, 747).
- Operaciones → Gestión operacional → **Programa Reparación Motores** (`js/modules/motores/`). Equipos elegibles: por ahora solo COMPRESORES (`TIPOS_EQUIPO` en motores.service.js).
- Cada equipo: **STATUS** (PENDIENTE · PROCESO · TERMINADO, se cambia directo en la tabla), AFI, **proveedor / taller** (Diego Torres, Taller TNTE, Taller FRC… o escribir otro), **fecha en que se lleva / se llevó**, **fecha término** de la etapa, **trabajo / etapa** (Evaluación, Reparación inyectores, Montaje motor ajustado y pruebas, Limpieza estanques diésel…) y observación.
- **Nueva etapa**: la etapa actual queda guardada en el **historial del equipo** (con su fecha de término) y se anota la siguiente desde ese día (ej. 09→13 limpieza; 13→20 reparación). La columna "Historial del equipo" muestra la línea de tiempo completa.
- KPI (clic = filtrar), filtros por proveedor y status, atrasados (fecha término pasada) en rojo.
- **Exportar Excel**: Resumen (KPI + gráficos por status y por proveedor + atrasados/próximos), Programa (colores por status + firmas), Por proveedor, Etapas (bitácora completa).
- Permisos: agregar/modificar = Subadmin u Admin de Operaciones; eliminar = Admin. Con perfiles por módulo, darle acceso a "Programa Reparación Motores".
- (ajuste) Cada etapa del historial tiene un **mini basurero** (Admin): borra solo esa etapa; el resto del historial y el equipo quedan. En la etapa actual, el basurero la borra y el equipo vuelve a la etapa anterior. El basurero grande de la fila sigue eliminando el equipo completo.

## 2026-11-12 · MECÁNICOS: app móvil + intervenciones con firma (módulo nuevo)
- **Ejecutar `sql/mecanicos.sql`**: tabla `bd_mec_intervenciones`, función `frc_mec_horometro` (el mecánico cambia SOLO el horómetro) y permiso para que los mecánicos agreguen al Historial y suban el PDF.
- **Usuarios** (Config & Usuarios → Tipo): **Mecánico (app del celular)** = `permisos.mecanicos = 'subadmin'` → entra DIRECTO a la app móvil, no ve el resto del sistema. **Supervisor de mecánicos** = `mecanicos = 'admin'` + sus niveles por área. También se cambia en la columna "Mecánicos" de la tabla de usuarios.
- **Área MECÁNICOS** del menú: solo la ven el Admin general y los supervisores → "Intervenciones y firmas" (`modules/mecanicos/panel.view.js`).
- **App móvil** (`modules/mecanicos/app.view.js`): Equipos (buscador; en taller primero; sin vehículos) con último horómetro y última mantención (+ fechas) · ficha del equipo con **Actualizar horómetro** · **Intervención mecánica** (FRC-RE-OPE-017) e **Intervención eléctrica** (IE-FRC) en 4 pasos (Datos · Trabajo realizado · Seguridad · Firmas), con dictado por voz, botones "Ahora" para las horas y borrador automático · **Registro de bloqueo** (FRC-RE-OP-015) completo si hubo bloqueo · ART: solo Sí/No (formato pendiente) · Mis registros · Mis tareas. Mantenciones: "próximamente".
- **Firmas**: mecánico(s) en el celular. Supervisor: (a) **en terreno** firma el supervisor del CLIENTE ahí mismo → pasa sola al Historial; (b) **en taller** queda "Falta firma supervisor" y el supervisor FRC firma en el panel (PC o celular), puede corregir o rechazar (el mecánico corrige y reenvía).
- Con la firma del supervisor se genera el **PDF con el formato oficial** (hoja de intervención + registro de bloqueo en hoja 2, `modules/mecanicos/hojas.js`, html2canvas + jsPDF), se sube y se crea el registro en el **Historial** (tipo INTERVENCION, causa según la hoja, folio APP-N°, mecánicos, horas, ART/bloqueo, link al PDF).
- Panel: "Ver la app como mecánico" para probar.

## 2026-11-13 · App mecánicos: causa de la lista, razón de la causa y lubricantes de la lista
- Intervención MECÁNICA (paso 2): **Causa de la intervención** = lista desplegable del Historial (REPARACION, IMPLEMENTACION, FALLA MECANICA…) → **Razón de la causa** (título corto) → **Descripción de lo realizado**. Se quitaron los 4 botones de "Causa de la falla". (En la tabla se guarda la causa en `causa_falla` y la razón en `causa_intervencion`; sin SQL.)
- Al pasar al Historial: causa = la elegida, causa detallada = la razón. En el PDF la línea "Causa de la intervención" muestra "CAUSA — razón".
- **Lubricantes**: lista desplegable con los mismos aceites del Historial + litros; al pasar al Historial se guardan en sus columnas de aceite (igual que una mantención). Eléctrica sin cambios.

## Mecánicos · carpetas por cuenta y hoja rediseñada (2026-11-13)
- Hoja mecánica: bloques numerados 1 Causa de la intervención · 2 Descripción · 3 Causa de la falla (razón), luego Interferencia, lubricantes y datos.
- Paso 4: cada compañero se elige desde las cuentas creadas (o nombre libre). El documento aparece en la carpeta de todos los participantes.
- App: "Mis documentos" con carpetas **Sin firma** (pendiente/rechazado) y **Realizados** (en Historial). Todos ven el PDF aunque falte firma.
- Panel: carpetas por mecánico con conteo sin firma / realizados. Sin SQL (usa el jsonb `mecanicos[].usuario`).

# Control de asistencia BTH

Esta guía explica el contenido de `js/js.js` en el mismo orden en que aparece. Está pensada para entender qué hace cada variable, propiedad, función y evento, y cómo se relaciona el JavaScript con `index.html` y Firestore.

## Recorrido general

1. El usuario elige una carrera, un año y un trimestre.
2. JavaScript obtiene o crea el documento de asistencia correspondiente en Firestore.
3. La página muestra las asistencias y el contacto del docente.
4. Si inició sesión un docente, aparecen controles para cambiar nombres, fechas y marcas.

## Variables y funciones en orden

### 1. `clavesTrimestre`

```js
const clavesTrimestre = {
  "1er Trimestre": "t1",
  "2do Trimestre": "t2",
  "3er Trimestre": "t3"
};
```

Relaciona el nombre visible de cada trimestre con un código corto. El código se usa al construir el identificador del documento de asistencia en Firestore. Por ejemplo, el documento del primer trimestre termina en `_t1`.

### 2. `nombresTrimestre`

Es el mapa inverso: relaciona `t1`, `t2` y `t3` con los nombres que se muestran en la página. Se usa al volver a cargar la tabla después de eliminar una fecha.

### 3. `modoAdministradorActivo`

Variable booleana que indica si hay una sesión de Firebase Authentication iniciada. Si vale `true`, se muestran controles de edición; si vale `false`, se muestra la vista de consulta.

### 4. `seleccionActual`

Guarda la carrera, el año y el trimestre que están abiertos. Se usa para volver a mostrar la misma tabla cuando cambia el estado de inicio de sesión o después de guardar el contacto del docente.

### 5. `window.auth.onAuthStateChanged(...)`

Es un observador de Firebase Authentication. Firebase lo ejecuta cuando se inicia o termina una sesión, y también cuando la página recupera una sesión guardada.

- `user`: el usuario autenticado; es `null` si no hay sesión.
- `Boolean(user)`: convierte la existencia del usuario en `true` o `false`.
- `document.getElementById(...)`: busca en el HTML un elemento por su `id`.
- `.classList.toggle('oculto', condición)`: agrega o quita la clase que oculta el botón de cerrar sesión.
- `.textContent`: cambia el texto del estado de sesión sin interpretarlo como HTML.
- `{ carrera, anio, trimestre }`: extrae esos tres valores de `seleccionActual`.

Si ya se había abierto un grupo, el observador vuelve a llamar `mostrarTablaAsistencia()` para mostrar los controles adecuados al estado de sesión.

### 6. `activarModoAdministrador()`

Muestra u oculta el formulario de acceso docente. En el HTML, el botón **Acceso docente** llama esta función.

### 7. `iniciarSesionDocente()`

Lee el correo y la contraseña de sus campos y llama a `signInWithEmailAndPassword()` de Firebase Authentication. Si inicia sesión, borra la contraseña del campo y oculta el formulario. Si hay un error, muestra un aviso.

La contraseña no se guarda en Firestore ni se incluye en el código fuente: Authentication verifica las credenciales.

### 8. `cerrarSesionDocente()`

Llama a `window.auth.signOut()` para cerrar la sesión. El observador de Authentication actualiza el modo y vuelve a dibujar la tabla.

### 9. `crearListaEstudiantesPorDefecto()`

Crea una lista inicial de 45 estudiantes. Cada estudiante es un objeto con:

- `nombre`: texto inicial como `Estudiante 1`.
- `asistencia`: objeto vacío que luego guardará una marca para cada fecha.

Se llama únicamente cuando todavía no existe el documento de ese curso y trimestre. Los nombres son datos de ejemplo que deben cambiarse por los nombres reales.

### 10. Evento de selección de carrera

El listener asociado a `#carreras` recibe los clics dentro del contenedor de carreras.

- `event.target`: elemento sobre el que se hizo clic.
- `.closest('[data-carrera]')`: busca ese elemento o un elemento padre con el atributo `data-carrera`.
- `.dataset.carrera`: lee el valor del atributo HTML `data-carrera`.

Si encuentra una tarjeta, llama a `mostrarAnios()` con el nombre de la carrera. Este patrón evita escribir un `onclick` en cada tarjeta.

### 11. `mostrarAnios(carrera)`

Clona la plantilla HTML `#plantilla-anios` y la inserta dentro de `#contenido`.

- `.content.cloneNode(true)`: copia la plantilla y todo su contenido.
- `[data-titulo]`: encabezado cuyo texto se cambia por el nombre de la carrera.
- `[data-anio]`: botones de los cursos 4to, 5to y 6to.
- `.addEventListener('click', ...)`: al pulsar un curso, llama a `mostrarTrimestres()`.
- `tarjeta.dataset.anio`: obtiene el año asociado al botón.
- `.replaceChildren(vista)`: reemplaza el contenido previo por la vista nueva.

El diseño fijo de estas tarjetas vive en `index.html`; JavaScript aporta los eventos y el título.

### 12. `mostrarTrimestres(carrera, anio)`

Clona `#plantilla-trimestres`, muestra la carrera y el año en el título y registra un evento para cada botón de trimestre. Al pulsar uno, llama a `mostrarTablaAsistencia()` con carrera, año y trimestre.

### 13. `mostrarTablaAsistencia(carrera, anio, trimestre)`

Es la función principal de lectura y dibujo de la tabla.

#### Selección y documento de asistencia

- Actualiza `seleccionActual` con el grupo actual.
- `contenido`: referencia al elemento HTML `#contenido`.
- `clave`: identificador compuesto por carrera, año y código de trimestre; por ejemplo `T.T.E. Electrónica_4to_t1`.
- `docRef`: referencia al documento de la colección `asistencia`.
- `await docRef.get()`: espera la lectura de Firestore.
- `snap.exists`: indica si el documento ya existe.
- `snap.data()`: devuelve los campos guardados.

Si el documento no existe, crea los campos `estudiantes`, `fechas` y `docente`, y los guarda con `docRef.set(datos)`.

#### Contacto compartido del docente

`claveGrupo` combina carrera y año, sin el trimestre. La colección `contactos_docentes` usa esa clave para compartir nombre y teléfono entre los tres trimestres del mismo grupo.

`contactoRef.get()` intenta leer el contacto compartido. Si no lo encuentra, el código busca un contacto antiguo guardado dentro de documentos trimestrales de `asistencia`. Esta compatibilidad permite recuperar el contacto que se guardó antes de usar la colección compartida.

El `try/catch` evita que un problema al leer `contactos_docentes` detenga toda la carga de la tabla. En caso de error, lo registra con `console.warn()`.

#### Mostrar o editar el contacto

`contacto` es un elemento `<section>` creado con `document.createElement()`.

- En modo docente se muestran campos para nombre y teléfono, además de un botón que llama `guardarContactoDocente()`.
- En modo espectador se muestra el nombre y un enlace `tel:` para llamar al docente.
- `escapeHtml()` protege los valores antes de insertarlos en las cadenas HTML.
- `.appendChild(contacto)`: añade el bloque de contacto a la página si tiene contenido.

#### Control para agregar fechas

En modo docente se crean un campo de tipo fecha y el botón **Agregar Fecha**.

Al pulsar el botón:

1. `entradaFecha.value` lee la fecha del control, normalmente como `AAAA-MM-DD`.
2. `.split('-').reverse().join('/')` la convierte a `DD/MM/AAAA`.
3. `.includes(fecha)` comprueba que esa fecha aún no esté en `datos.fechas`.
4. `.push(fecha)` agrega la fecha a la lista.
5. `docRef.update(...)` guarda las fechas en Firestore.
6. Se vuelve a llamar a `mostrarTablaAsistencia()` para refrescar la vista.

Si la fecha ya existe, se muestra un aviso. Conviene elegir una fecha antes de pulsar **Agregar Fecha**.

#### Crear la tabla

JavaScript crea los elementos `<table>`, `<thead>` y `<tbody>`.

- `datos.fechas.forEach(...)` crea una columna por fecha. En modo docente, la columna incluye el botón **Eliminar**; en modo espectador, solo presenta la fecha.
- `datos.estudiantes.forEach(...)` crea una fila por estudiante.
- `est.asistencia[fecha]` obtiene la marca correspondiente a ese estudiante y fecha.
- En modo docente aparece un selector con las opciones `✓`, `X`, `L` o vacío.
- En modo espectador aparece la marca con una clase de color: `verde`, `rojo` o `azul`.
- `appendChild()` añade cada fila y sección a la tabla y después a `#contenido`.

Actualmente, esta sección contiene bastante HTML dentro de cadenas de JavaScript. Las estructuras de cabecera, fila, selector y botón se podrían trasladar a elementos `<template>` en `index.html`; JavaScript tendría que seguir creando una instancia por cada estudiante y fecha y asignando sus valores.

### 14. `escapeHtml(valor)`

Convierte caracteres especiales (`&`, `<`, `>`, comillas) en entidades HTML. Se usa para los valores del contacto antes de insertarlos en `innerHTML`, evitando que se interpreten como etiquetas.

### 15. `guardarContactoDocente(claveGrupo)`

Lee los campos de nombre y teléfono, verifica que el nombre no esté vacío y guarda ambos valores en `contactos_docentes/{claveGrupo}`. Después vuelve a mostrar el grupo actual. Si Firestore rechaza la escritura, muestra un mensaje de error.

### 16. `actualizarAsistencia(clave, i, fecha, valor)`

Lee el documento de asistencia, cambia la marca de un estudiante en una fecha determinada y guarda nuevamente el arreglo `estudiantes` con `ref.update()`.

- `i`: posición del estudiante dentro del arreglo.
- `fecha`: fecha que corresponde a la columna.
- `valor`: nueva marca elegida.

### 17. `actualizarNombreEstudiante(clave, i, nombre)`

Lee el documento, cambia el nombre del estudiante ubicado en la posición `i` y actualiza el arreglo en Firestore.

### 18. `eliminarFecha(clave, iFecha)`

Lee el documento de asistencia y elimina la fecha cuyo índice es `iFecha`.

- `.splice(iFecha, 1)`: quita la fecha y la devuelve como `fechaEliminada`.
- `confirm(...)`: pide confirmación antes de borrar las marcas.
- `delete e.asistencia[fechaEliminada]`: borra esa marca de todos los estudiantes.
- `ref.update(...)`: guarda la lista de fechas y estudiantes actualizada.
- `.split('_')`: recupera carrera, año y código del trimestre desde `clave`.
- `nombresTrimestre[codTri]`: recupera el nombre visible del trimestre y vuelve a cargar la tabla.

## Datos que guarda Firestore

### Colección `asistencia`

Cada documento representa una carrera, año y trimestre. Sus campos principales son:

- `estudiantes`: arreglo de estudiantes y sus marcas por fecha.
- `fechas`: lista de fechas de clase.
- `docente`: campo antiguo que se conserva para recuperar contactos anteriores.

### Colección `contactos_docentes`

Cada documento representa una carrera y año escolar y guarda:

- `nombre`: nombre del docente.
- `telefono`: teléfono de contacto.

## Qué debe permanecer en JavaScript

Las consultas y escrituras de Firestore, el estado de sesión, la selección de carrera/año/trimestre, los eventos de botones, la confirmación de borrado y el cálculo de qué marcas mostrar son comportamiento. Deben permanecer en JavaScript. El HTML puede contener plantillas para la forma visual de esos elementos.

## Nota sobre permisos

La interfaz considera administrador a cualquier usuario que haya iniciado sesión en Firebase Authentication. Las reglas de seguridad de Firestore son las que deben controlar qué datos puede leer o modificar cada usuario. Ocultar controles en la página no reemplaza esas reglas.

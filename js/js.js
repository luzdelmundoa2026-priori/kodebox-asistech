//  Mapeo de claves internas para los trimestres
// ----------------------

// Este objeto relaciona los nombres legibles de los trimestres con claves internas más cortas
// que se utilizan como identificadores únicos para los documentos en Firestore.
const clavesTrimestre = {
    "1er Trimestre": "t1",
    "2do Trimestre": "t2",
    "3er Trimestre": "t3"
};

// Este objeto es el inverso de 'clavesTrimestre' y se utiliza para mostrar los nombres legibles
// de los trimestres a partir de sus claves internas.
const nombresTrimestre = {
    t1: "1er Trimestre",
    t2: "2do Trimestre",
    t3: "3er Trimestre"
};

// Esta variable controla si el modo administrador está activado.
// Solo el administrador puede realizar acciones como agregar fechas o modificar asistencia.
let modoAdministradorActivo = false;
let seleccionActual = null;

window.auth.onAuthStateChanged(user => {
    modoAdministradorActivo = Boolean(user);
    document.getElementById('cerrar-sesion').classList.toggle('oculto', !user);
    document.getElementById('estado-sesion').textContent = user ?
        `Sesión iniciada: ${user.email}` :
        'Inicia sesión con la cuenta asignada por la institución.';
    if (seleccionActual) {
        const { carrera, anio, trimestre } = seleccionActual;
        mostrarTablaAsistencia(carrera, anio, trimestre);
    }
});

// ----------------------
// Función para activar el modo administrador
// ----------------------
// Muestra u oculta el formulario de acceso docente.
// function declara una función que se ejecuta cuando se la llama.
function activarModoAdministrador() {
    // Busca en el HTML el elemento con id="acceso-docente".
    // classList permite consultar, agregar, quitar o alternar clases CSS.
    // toggle('oculto') agrega la clase si no existe y la quita si ya existe.
    document.getElementById('acceso-docente').classList.toggle('oculto');
}

// Inicia sesión del docente usando Firebase Authentication.
// async permite usar await dentro de esta función.
async function iniciarSesionDocente() {
    // Busca el campo con id="correo-docente", obtiene su texto
    // y trim() elimina espacios al principio y al final.
    const correo = document.getElementById('correo-docente').value.trim();

    // Obtiene el valor del campo de contraseña.
    // No se usa trim() para conservar exactamente la contraseña escrita.
    const contrasena = document.getElementById('contrasena-docente').value;

    try {
        // Intenta iniciar sesión con el correo y la contraseña.
        // await espera la respuesta de Firebase antes de continuar.
        await window.auth.signInWithEmailAndPassword(correo, contrasena);

        // Si el inicio de sesión fue correcto, limpia el campo de contraseña.
        document.getElementById('contrasena-docente').value = '';

        // Oculta el formulario de acceso agregando la clase CSS "oculto".
        document.getElementById('acceso-docente').classList.add('oculto');
    } catch (error) {
        // Si Firebase devuelve un error, se ejecuta este bloque.
        // alert() muestra un aviso en pantalla.
        alert('No se pudo iniciar sesión. Revisa el correo y la contraseña.');
    }
}

// Cierra la sesión actual del docente en Firebase Authentication.
async function cerrarSesionDocente() {
    // signOut() cierra la sesión.
    // await espera a que Firebase complete la operación.
    await window.auth.signOut();
}

// ----------------------
//  Función para crear una lista predeterminada de 45 estudiantes
// ----------------------

function crearListaEstudiantesPorDefecto() {
    const estudiantes = [];
    // Bucle for: se repite desde 1 hasta 45
    for (let i = 1; i <= 45; i++) {
        // .push(): método de los arrays que agrega un nuevo elemento al final
        // Se agrega un objeto con dos propiedades:
        // nombre: un texto como "Estudiante 1", "Estudiante 2", etc.
        // asistencia: un objeto vacío que luego almacenará las marcas de asistencia por fecha
        estudiantes.push({ nombre: `Estudiante ${i}`, asistencia: {} });
    }
    return estudiantes; // Devuelve el arreglo completo de 45 estudiantes
}

// ----------------------
// Función para mostrar los años disponibles según la carrera seleccionada
// ----------------------

document.getElementById('carreras').addEventListener('click', event => {
    const tarjeta = event.target.closest('[data-carrera]');
    if (tarjeta) mostrarAnios(tarjeta.dataset.carrera);
});

function mostrarAnios(carrera) {
    const contenido = document.getElementById('contenido');
    const vista = document.getElementById('plantilla-anios').content.cloneNode(true);
    vista.querySelector('[data-titulo]').textContent = carrera;
    vista.querySelectorAll('[data-anio]').forEach(tarjeta => {
        tarjeta.addEventListener('click', () => mostrarTrimestres(carrera, tarjeta.dataset.anio));
    });
    contenido.replaceChildren(vista);
}

// ----------------------
//  Función para mostrar los trimestres disponibles según la carrera y el año
// ----------------------

function mostrarTrimestres(carrera, anio) {
    const contenido = document.getElementById('contenido');
    const vista = document.getElementById('plantilla-trimestres').content.cloneNode(true);
    vista.querySelector('[data-titulo]').textContent = `${carrera} - ${anio}`;
    vista.querySelectorAll('[data-trimestre]').forEach(tarjeta => {
        tarjeta.addEventListener('click', () => {
            mostrarTablaAsistencia(carrera, anio, tarjeta.dataset.trimestre);
        });
    });
    contenido.replaceChildren(vista);
}
/**
 * BASE DE DATOS Función principal que muestra la tabla de asistencia para un grupo específico.
 * Carga datos de Firestore, crea la tabla con fechas y estudiantes, cuando se van registrando o accediendo desde el modo
 * administrador. si en caso no se registran datos se crea de manera automatica una lista con 45 estudiantes
 * y maneja la interfaz para agregar fechas y marcar asistencia si el modo admin está activo.
 */
async function mostrarTablaAsistencia(carrera, anio, trimestre) {
    seleccionActual = { carrera, anio, trimestre };
    const contenido = document.getElementById('contenido');
    contenido.innerHTML = `<h2>${carrera} - ${anio} - ${trimestre}</h2>`; // Título de la tabla

    const clave = `${carrera}_${anio}_${clavesTrimestre[trimestre]}`; // Clave para Firestore
    const docRef = window.db.collection("asistencia").doc(clave); // Referencia al documento Firestore

    let datos;
    const snap = await docRef.get(); // Obtener documento de Firestore (espera la respuesta)
    if (snap.exists) {
        datos = snap.data(); // Si existe, obtener los datos
    } else {
        datos = {
            estudiantes: crearListaEstudiantesPorDefecto(), // Si no existe, crear lista por defecto hace llamado a la funcion creada anteriormente
            fechas: [], // Y muestra la lista vacía de fechas
            docente: { nombre: '', telefono: '' }
        };
        await docRef.set(datos); // Guardar datos iniciales en Firestore
    }
    // Construye una clave única con la carrera y el año, por ejemplo: "Sistemas_2026".
    // const declara una variable que no se reasignará.
    // Las comillas invertidas permiten insertar variables con ${...}.
    const claveGrupo = `${carrera}_${anio}`;

    // Accede a la colección "contactos_docentes" de Firestore
    // y selecciona el documento cuyo ID es claveGrupo.
    // collection() y doc() son métodos de la API de Firestore.
    const contactoRef = window.db.collection('contactos_docentes').doc(claveGrupo);

    // Declara docente con valor inicial null.
    // null representa que todavía no hay un contacto cargado.
    let docente = null;

    try {
        // Solicita a Firestore el documento del contacto.
        // await espera a que termine la operación antes de continuar.
        const contactoSnap = await contactoRef.get();

        // exists indica si el documento existe.
        // Si existe, data() obtiene sus datos; si no, docente queda en null.
        docente = contactoSnap.exists ? contactoSnap.data() : null;
    } catch (error) {
        // catch captura errores, por ejemplo, problemas de conexión o permisos.
        // console.warn() muestra una advertencia en la consola del navegador.
        console.warn(
            'No se pudo leer contactos_docentes. Revisa las reglas de Firestore.',
            error
        );
    }

    // Busca un contacto anterior si no hay uno válido en la ubicación nueva.
    // !docente significa "no existe docente".
    // || significa "o".
    if (!docente || (!docente.nombre && !docente.telefono)) {
        // Usa el contacto de los datos actuales si existe; de lo contrario,
        // crea un objeto con nombre y teléfono vacíos.
        // El operador || devuelve el primer valor que no sea vacío/falsy.
        docente = datos.docente || { nombre: '', telefono: '' };

        // Comprueba si el contacto sigue sin tener nombre ni teléfono.
        // && significa "y".
        if (!docente.nombre && !docente.telefono) {
            // Object.values() obtiene los valores de clavesTrimestre como un arreglo.
            // for...of recorre cada elemento del arreglo.
            for (const codigo of Object.values(clavesTrimestre)) {
                // Busca en la colección "asistencia" el documento del trimestre.
                // El ID se forma combinando la clave del grupo y el código.
                const antiguo = await window.db
                    .collection('asistencia')
                    .doc(`${claveGrupo}_${codigo}`)
                    .get();

                // Si el documento existe, obtiene su propiedad docente.
                // Si no existe, contactoAntiguo queda en null.
                const contactoAntiguo = antiguo.exists ?
                    antiguo.data().docente :
                    null;

                // Comprueba que el contacto anterior tenga nombre o teléfono.
                if (
                    contactoAntiguo &&
                    (contactoAntiguo.nombre || contactoAntiguo.telefono)
                ) {
                    // Recupera el contacto encontrado.
                    docente = contactoAntiguo;

                    // break termina el ciclo porque ya encontró un contacto.
                    break;
                }
            }
        }
    }

    // Crea un elemento HTML <section>.
    // document.createElement() es un método del navegador para crear elementos.
    const contacto = document.createElement('section');

    // Asigna la clase CSS "contacto-docente" al elemento.
    // className es una propiedad del elemento HTML.
    contacto.className = 'contacto-docente';

    // Comprueba si está activo el modo administrador.
    if (modoAdministradorActivo) {
        // innerHTML inserta contenido HTML dentro de la sección.
        // Las comillas invertidas permiten escribir varias líneas e insertar variables.
        // escapeHtml() convierte caracteres especiales para mostrarlos como texto seguro.
        contacto.innerHTML = `
        <h3>Contacto del docente</h3>

        <label for="nombre-docente">Nombre completo</label>

        <input
            id="nombre-docente"
            type="text"
            maxlength="80"
            placeholder="Ej.: María Pérez"
            value="${escapeHtml(docente.nombre || '')}"
        >

        <label for="telefono-docente">Teléfono de contacto</label>

        <input
            id="telefono-docente"
            type="tel"
            maxlength="20"
            placeholder="Ej.: +591 70000000"
            value="${escapeHtml(docente.telefono || '')}"
        >

        <small>Incluye el código de país para que las familias puedan llamar.</small>

        <!-- onclick llama a guardarContactoDocente al pulsar el botón. -->
        <button
            class="boton"
            onclick="guardarContactoDocente('${claveGrupo}')"
        >
            Guardar contacto
        </button>
    `;

        // Si no es administrador, comprueba que exista un nombre o un teléfono.
    } else if (docente.nombre || docente.telefono) {
        // Crea una versión del teléfono que solo contiene números.
        // replace() busca coincidencias y las reemplaza.
        // La expresión regular /\D/g significa "todo carácter que no sea un dígito".
        // La bandera g aplica el reemplazo a todas las coincidencias.
        // Esto solo prepara el enlace; no cambia el valor guardado en Firestore.
        const numeroWhatsApp = (docente.telefono || '').replace(/\D/g, '');

        // encodeURIComponent() prepara el texto para que pueda ir dentro de una URL.
        const mensaje = encodeURIComponent(
            'Hola, docente. Me comunico con usted desde Asistech.'
        );

        // Inserta el contacto visible para las familias.
        contacto.innerHTML = `
        <h3>Contacto del docente</h3>

        ${
            // Si hay nombre, lo muestra; si no, inserta una cadena vacía.
            // escapeHtml() evita interpretar el nombre como código HTML.
            docente.nombre
                ? `<p class="nombre-contacto">${escapeHtml(docente.nombre)}</p>`
                : ''
        }

        ${
            // Si hay dígitos en el teléfono, crea el enlace de WhatsApp.
            // Si no, no muestra el botón.
            //target="_blank" <!-- Abre WhatsApp en otra pestaña. -->
            //rel="noopener noreferrer" <!-- Evita que la página abierta acceda a la pestaña original. -->
            //title="Contactar por WhatsApp"<!-- title muestra una ayuda al dejar el cursor encima. -->
            //aria-label="Contactar al docente por WhatsApp"<!-- aria-label describe el enlace a lectores de pantalla. -->
            numeroWhatsApp
                ? `
                    <a
                        class="telefono-contacto enlace-whatsapp"

                        href="https://wa.me/${numeroWhatsApp}?text=${mensaje}"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Contactar por WhatsApp"
                        aria-label="Contactar al docente por WhatsApp"
                    >
                        <!-- SVG permite dibujar el ícono sin instalar una biblioteca. -->
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <!-- Dibuja el contorno del globo de conversación. -->
                            <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.1-4.7a8.5 8.5 0 1 1 16.4-3.8Z"></path>

                            <!-- Dibuja el auricular del teléfono dentro del globo. -->
                            <path d="M8.5 8.2c.3-.6.6-.6.9-.6h.5c.2 0 .4 0 .5.4l.7 1.6c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4-.1.6.3.6.8 1.2 1.4 1.6.5.4 1.1.7 1.4.8.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.7-.1l1.5.7c.3.1.4.3.4.5 0 .3-.2 1-.6 1.3-.4.4-1 .6-1.6.6-.5 0-1.2-.2-2-.5-1-.4-2.1-1.1-3-2-.9-.8-1.5-1.8-1.8-2.5-.3-.7-.4-1.2-.4-1.6 0-.5.2-.9.5-1.2Z"></path>
                        </svg>
                    </a>
                `
                : ''
        }
    `;
}

// Si innerHTML tiene contenido, agrega la sección al elemento contenido.
// appendChild() inserta un elemento HTML dentro de otro.
if (contacto.innerHTML) {
    contenido.appendChild(contacto);
}

    // Si el modo administrador está activo, mostrar controles para agregar fechas
    if (modoAdministradorActivo) {
        const contenedorFecha = document.createElement('div'); // Crear un contenedor nuevo para fechas
        contenedorFecha.style.margin = '1rem 0'; // Margen arriba y abajo

        const entradaFecha = document.createElement('input'); // Crear input para seleccionar fecha
        entradaFecha.type = 'date'; // Tipo input: selector de fecha
        entradaFecha.valueAsDate = new Date(); // Valor por defecto: hoy
        entradaFecha.className = 'boton'; // Clase para estilizar como botón
        entradaFecha.style.marginRight = '0.5rem'; // Margen derecho para separar del botón

        const botonAgregarFecha = document.createElement('button'); // Crear botón para agregar fecha
        botonAgregarFecha.textContent = 'Agregar Fecha'; // Texto del botón
        botonAgregarFecha.className = 'boton'; // Clase CSS para estilos

        // Al hacer clic, agrega la fecha seleccionada si no está ya en la lista
        botonAgregarFecha.onclick = async() => {
            // La fecha viene en formato 'YYYY-MM-DD', la convertimos a 'DD/MM/YYYY'
            const fecha = entradaFecha.value.split('-').reverse().join('/');
            if (!datos.fechas.includes(fecha)) { // Verificar si la fecha no existe ya
                datos.fechas.push(fecha); // Agregar la fecha al array
                await docRef.update({ fechas: datos.fechas }); // Actualizar Firestore con nuevas fechas
                mostrarTablaAsistencia(carrera, anio, trimestre); // Recargar tabla para actualizar vista
            } else {
                alert("Esa fecha ya está registrada."); // Mensaje si la fecha ya está en la lista
            }
        };

        contenedorFecha.appendChild(entradaFecha); // Añadir input al contenedor
        contenedorFecha.appendChild(botonAgregarFecha); // Añadir botón al contenedor
        contenido.appendChild(contenedorFecha); // Añadir contenedor al contenido principal
    }

    // Crear tabla HTML para mostrar asistencia
    const tabla = document.createElement('table');
    const encabezado = document.createElement('thead');
    let filaEncabezado = '<tr><th>#</th><th>Nombre</th>'; // Primera fila con columnas # y Nombre

    // Añadir columnas de fechas
    datos.fechas.forEach((fecha, i) => {
        if (modoAdministradorActivo) {
            // En modo admin, mostrar fecha con botón para eliminar fecha
            filaEncabezado += `<th>${fecha}<br><button onclick="eliminarFecha('${clave}', ${i})" style="font-size:10px; color:red;">Eliminar</button></th>`;
        } else {
            // En modo usuario, solo mostrar fecha sin botones
            filaEncabezado += `<th>${fecha}</th>`;
        }
    });
    filaEncabezado += '</tr>';
    encabezado.innerHTML = filaEncabezado;
    tabla.appendChild(encabezado);

    // Crear cuerpo de la tabla para estudiantes y sus asistencias
    const cuerpo = document.createElement('tbody');

    // Por cada estudiante, crear una fila
    datos.estudiantes.forEach((est, i) => {
        const fila = document.createElement('tr');
        // Si modo admin activo, el nombre se muestra en un input editable
        let celdaNombre = modoAdministradorActivo ?
            `<input type="text" value="${est.nombre}" onchange="actualizarNombreEstudiante('${clave}', ${i}, this.value)" style="width: 100%; border: none; background: transparent; font-weight: bold;">` :
            est.nombre; // Si no, se muestra texto simple

        let contenidoFila = `<td>${i + 1}</td><td>${celdaNombre}</td>`; // Número y nombre del estudiante

        // Por cada fecha, mostrar asistencia o selector para cambiarla
        datos.fechas.forEach(fecha => {
            const marca = est.asistencia[fecha] || ''; // Obtener marca de asistencia para esa fecha (✓, X o vacío)
            if (modoAdministradorActivo) {
                // En admin, mostrar selector para marcar asistencia
                contenidoFila += `<td><select onchange="actualizarAsistencia('${clave}', ${i}, '${fecha}', this.value)">
                    <option value=""></option>
                    <option value="✓" ${marca === '✓' ? 'selected' : ''}>✓</option>
                    <option value="X" ${marca === 'X' ? 'selected' : ''}>X</option>
                    <option value="L" ${marca === 'L' ? 'selected' : ''}>L</option>
                </select></td>`;
            } else {
                // En usuario, solo mostrar la marca con color según tipo
                contenidoFila += `<td class="${marca === '✓' ? 'verde' : marca === 'X' ? 'rojo' : marca === 'L' ? 'azul' : ''}">${marca}</td>`;
            }
        });

        fila.innerHTML = contenidoFila; // Insertar la fila completa en HTML
        cuerpo.appendChild(fila); // Añadir fila al cuerpo de la tabla
    });

    tabla.appendChild(cuerpo); // Añadir cuerpo a la tabla
    contenido.appendChild(tabla); // Mostrar tabla en el contenido principal
}

function escapeHtml(valor) {
    return String(valor).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

async function guardarContactoDocente(claveGrupo) {
    const nombre = document.getElementById('nombre-docente').value.trim();
    const telefono = document.getElementById('telefono-docente').value.trim();
    if (!nombre) return alert('Escribe el nombre del docente.');
    
    try {
        await window.db.collection('contactos_docentes').doc(claveGrupo).set({ nombre, telefono });
        alert('Contacto guardado para los tres trimestres de este año.');
        const { carrera, anio, trimestre } = seleccionActual;
        mostrarTablaAsistencia(carrera, anio, trimestre);
    } catch (error) {
        alert('No se pudo guardar el contacto. Verifica el acceso a Firestore.');
    }
}

/**
 * Actualiza la asistencia de un estudiante en Firestore.
 * @param {string} clave - Documento Firestore (clave única).
 * @param {number} i - Índice del estudiante en el array.
 * @param {string} fecha - Fecha específica a modificar.
 * @param {string} valor - Nueva marca de asistencia ('✓', 'X' o 'L').
 */
async function actualizarAsistencia(clave, i, fecha, valor) {
    const ref = window.db.collection("asistencia").doc(clave); // Referencia al documento
    const snap = await ref.get(); // Obtener documento
    if (!snap.exists) return; // Si no existe, salir
    const data = snap.data(); // Obtener datos actuales
    data.estudiantes[i].asistencia[fecha] = valor; // Actualizar la asistencia en el objeto
    await ref.update({ estudiantes: data.estudiantes }); // Guardar cambios en Firestore
}

/**
 * Actualiza el nombre de un estudiante en Firestore.
 * @param {string} clave - Documento Firestore.
 * @param {number} i - Índice del estudiante.
 * @param {string} nombre - Nuevo nombre para el estudiante.
 */
async function actualizarNombreEstudiante(clave, i, nombre) {
    const ref = window.db.collection("asistencia").doc(clave);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    data.estudiantes[i].nombre = nombre; // Cambiar nombre
    await ref.update({ estudiantes: data.estudiantes });
}

/**
 * Elimina una fecha de asistencia de Firestore y de todos los estudiantes.
 * @param {string} clave - Documento Firestore.
 * @param {number} iFecha - Índice de la fecha a eliminar.
 */
async function eliminarFecha(clave, iFecha) {
    const ref = window.db.collection("asistencia").doc(clave);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    const fechaEliminada = data.fechas.splice(iFecha, 1)[0]; // Remover fecha del array
    if (!confirm(`¿Seguro que deseas eliminar ${fechaEliminada}? También se borrarán las marcas de asistencia de ese día.`)) return;
    data.estudiantes.forEach(e => delete e.asistencia[fechaEliminada]); // Eliminar la marca en cada estudiante
    await ref.update({ fechas: data.fechas, estudiantes: data.estudiantes }); // Actualizar Firestore

    // Extraer carrera, año y trimestre para recargar la tabla actualizada
    const [carrera, anio, codTri] = clave.split('_');
    mostrarTablaAsistencia(carrera, anio, nombresTrimestre[codTri]);
}
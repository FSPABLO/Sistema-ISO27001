import { api } from '../api.js';
import { html, icono, vacio } from '../ui.js';
import { cargarCatalogo } from '../app.js';

const ROLES_CUENTA = ['referencia', 'redaccion', 'vpd', 'sinAcceso1', 'sinAcceso2', 'comparacion'];
const USO_CUENTA = {
  referencia: 'PB-05b, PB-06b, PB-10 · dueño de los datos, ve los valores reales',
  redaccion: 'PB-05b · debe ver los datos redactados',
  vpd: 'PB-06b · debe ver solo sus filas',
  sinAcceso1: 'PB-12a · no debe poder leer el detalle',
  sinAcceso2: 'PB-12b · no debe poder leer el detalle',
  comparacion: 'PB-10 · lee la tabla del clon',
};

const lista = (v) => String(v || '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

export async function mostrar(raiz, _p, { ir, query }) {
  const [{ conexiones }, catalogo] = await Promise.all([api.get('/conexiones'), cargarCatalogo()]);
  const activas = conexiones.filter((c) => c.activa);
  if (!activas.length) {
    raiz.innerHTML = String(html`<div class="encabezado"><div><h1>Nueva ejecución</h1></div></div>
      <div class="tarjeta">${vacio('Primero registre una conexión.', 'conexion')}<div class="acciones centro"><a class="boton boton-primario" href="#/conexiones">Ir a Conexiones</a></div></div>`);
    return;
  }
  const elegida = query.conexion || String(activas[0].id);
  const etiquetas = catalogo.etiquetasCuenta;
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><p class="eyebrow">Auditoría</p><h1>Nueva ejecución</h1>
    <p class="sutil">Se ejecutan ${catalogo.pruebas.filter((p) => p.tipo === 'diccionario').length} pruebas de diccionario de solo lectura sobre los 18 controles, y opcionalmente ${catalogo.pruebas.filter((p) => p.tipo === 'funcional').length} pruebas funcionales.</p></div></div>
  <form id="form-ejecucion" class="pasos" novalidate>
    <section class="tarjeta paso">
      <h2><span class="paso-num">1</span> Base de datos</h2>
      <div class="opciones-conexion" role="radiogroup" aria-label="Conexión">
        ${activas.map((c) => html`<label class="opcion-conexion">
          <input type="radio" name="conexionId" value="${c.id}" ${String(c.id) === elegida ? 'checked' : ''}>
          <span class="opcion-cuerpo"><strong>${icono('conexion')} ${c.alias}</strong><code>${c.usuario}@${c.host}:${c.puerto}/${c.servicio}</code></span>
        </label>`)}
      </div>
      <label class="campo estrecho"><span>Contraseña de la cuenta de auditoría</span>
        <input type="password" name="clave" required autocomplete="off"><small>Solo se mantiene en memoria durante la ejecución. No se guarda ni se registra.</small></label>
    </section>
    <section class="tarjeta paso">
      <h2><span class="paso-num">2</span> Pruebas funcionales <span class="etiqueta">opcional</span></h2>
      <p class="sutil">Se conectan como usuarios de prueba para comprobar el comportamiento real: redacción (PB-05b), filtro por fila (PB-06b), acceso denegado (PB-12a/b) y que el clon no tenga datos reales (PB-10). Si no se activan, quedan como <b>Omitida</b> y no cuentan en el puntaje.</p>
      <label class="interruptor"><input type="checkbox" name="funcional" id="funcional"><span class="interruptor-pista"></span><span>Activar pruebas funcionales</span></label>
      <div id="funcional-campos" class="funcional oculto">
        <div class="fila-campos">
          <label class="campo"><span>Perfil</span><select id="perfil">
            <option value="">Personalizado</option>
            ${catalogo.perfiles.map((p) => html`<option value="${p.id}">${p.nombre}</option>`)}
          </select></label>
          <p class="nota crece" id="perfil-desc">${icono('info')} Elija un perfil para rellenar tablas, columnas y usuarios.</p>
        </div>
        <fieldset class="grupo"><legend>Tabla de producción</legend>
          <div class="fila-campos">
            <label class="campo"><span>Esquema</span><input name="t_esquema" spellcheck="false"></label>
            <label class="campo"><span>Tabla</span><input name="t_tabla" spellcheck="false"></label>
            <label class="campo"><span>Columna clave</span><input name="t_clave" spellcheck="false"></label>
          </div>
          <div class="fila-campos">
            <label class="campo crece"><span>Columnas sensibles (separadas por coma)</span><input name="t_sensibles" spellcheck="false"></label>
            <label class="campo"><span>Columna de segmentación (VPD)</span><input name="t_segmento" spellcheck="false"></label>
          </div>
        </fieldset>
        <fieldset class="grupo"><legend>Clon de desarrollo (A8.33)</legend>
          <div class="fila-campos">
            <label class="campo"><span>Esquema</span><input name="c_esquema" spellcheck="false"></label>
            <label class="campo"><span>Tabla</span><input name="c_tabla" spellcheck="false"></label>
            <label class="campo"><span>Columna clave</span><input name="c_clave" spellcheck="false"></label>
          </div>
          <label class="campo"><span>Columnas a comparar (separadas por coma)</span><input name="c_columnas" spellcheck="false"></label>
        </fieldset>
        <fieldset class="grupo"><legend>Usuarios de prueba</legend>
          <p class="nota">${icono('candado')} Las contraseñas solo se usan en memoria durante esta ejecución. Los nombres de esquemas, tablas y columnas se validan (letras, números, _ $ #).</p>
          <div class="tabla-cuentas">
            ${ROLES_CUENTA.map((r) => html`<div class="fila-cuenta">
              <div class="cuenta-rol"><strong>${etiquetas[r]}</strong><small>${USO_CUENTA[r]}</small></div>
              <label class="campo"><span class="lectores">Usuario</span><input name="u_${r}" placeholder="Usuario" spellcheck="false" aria-label="Usuario: ${etiquetas[r]}"></label>
              <label class="campo"><span class="lectores">Contraseña</span><input name="k_${r}" type="password" placeholder="Contraseña" autocomplete="off" aria-label="Contraseña: ${etiquetas[r]}"></label>
            </div>`)}
          </div>
        </fieldset>
      </div>
    </section>
    <div class="alerta alerta-error oculto" id="ejec-error" role="alert"></div>
    <div class="acciones derecha"><button class="boton boton-primario boton-grande" type="submit">${icono('ejecutar')} Ejecutar auditoría</button></div>
  </form>`);

  const form = raiz.querySelector('#form-ejecucion');
  const campos = raiz.querySelector('#funcional-campos');
  raiz.querySelector('#funcional').addEventListener('change', (e) => campos.classList.toggle('oculto', !e.target.checked));
  raiz.querySelector('#perfil').addEventListener('change', (e) => {
    const p = catalogo.perfiles.find((x) => x.id === e.target.value);
    raiz.querySelector('#perfil-desc').textContent = p ? p.descripcion : 'Escriba los nombres manualmente.';
    if (!p) return;
    const fijar = (n, v) => { form.elements[n].value = v || ''; };
    fijar('t_esquema', p.tabla.esquema); fijar('t_tabla', p.tabla.tabla); fijar('t_clave', p.tabla.clave);
    fijar('t_sensibles', p.tabla.columnasSensibles.join(', ')); fijar('t_segmento', p.tabla.columnaSegmento);
    fijar('c_esquema', p.clon.esquema); fijar('c_tabla', p.clon.tabla); fijar('c_clave', p.clon.clave);
    fijar('c_columnas', p.clon.columnas.join(', '));
    for (const r of ROLES_CUENTA) fijar('u_' + r, p.cuentas[r]);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const error = raiz.querySelector('#ejec-error');
    error.classList.add('oculto');
    const v = (n) => form.elements[n].value.trim();
    if (!form.clave.value) { error.textContent = 'Ingrese la contraseña de la cuenta de auditoría.'; error.classList.remove('oculto'); form.clave.focus(); return; }
    const activa = form.funcional.checked;
    const funcional = { activa };
    if (activa) {
      funcional.perfil = raiz.querySelector('#perfil').value || null;
      if (v('t_tabla')) funcional.tabla = { esquema: v('t_esquema'), tabla: v('t_tabla'), clave: v('t_clave'), columnasSensibles: lista(v('t_sensibles')), columnaSegmento: v('t_segmento') || null };
      if (v('c_tabla')) funcional.clon = { esquema: v('c_esquema'), tabla: v('c_tabla'), clave: v('c_clave'), columnas: lista(v('c_columnas')) };
      funcional.cuentas = {};
      for (const r of ROLES_CUENTA) if (v('u_' + r)) funcional.cuentas[r] = { usuario: v('u_' + r), clave: form.elements['k_' + r].value };
    }
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await api.post('/ejecuciones', { conexionId: Number(form.conexionId.value), clave: form.clave.value, funcional });
      form.reset();
      ir(`/ejecucion/${r.id}`);
    } catch (err) {
      error.textContent = err.message;
      error.classList.remove('oculto');
      boton.disabled = false;
    }
  });
}

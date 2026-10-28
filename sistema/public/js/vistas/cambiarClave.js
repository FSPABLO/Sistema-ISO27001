import { api } from '../api.js';
import { html, icono, notificar } from '../ui.js';
import { estado } from '../app.js';

export async function mostrar(raiz, _p, { ir }) {
  raiz.innerHTML = String(html`
  <div class="encabezado"><div><h1>Cambiar contraseña</h1>
    <p class="sutil">Es opcional: su contraseña actual sigue siendo válida mientras no la cambie.</p></div></div>
  <form class="tarjeta formulario estrecho" id="form-clave" novalidate>
    <div class="alerta alerta-error oculto" id="clave-error" role="alert"></div>
    <label class="campo"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>
    <label class="campo"><span>Nueva contraseña</span><input type="password" name="nueva" autocomplete="new-password" required minlength="12" aria-describedby="politica"></label>
    <label class="campo"><span>Repita la nueva contraseña</span><input type="password" name="repetir" autocomplete="new-password" required></label>
    <ul class="politica" id="politica">
      <li data-regla="largo">${icono('omitida')} Al menos 12 caracteres</li>
      <li data-regla="usuario">${icono('omitida')} No contiene su nombre de usuario</li>
      <li data-regla="igual">${icono('omitida')} Ambas contraseñas coinciden</li>
    </ul>
    <div class="acciones"><button class="boton boton-primario" type="submit">${icono('llave')} Guardar contraseña</button>
      <a class="boton" href="#/">Cancelar</a></div>
  </form>`);
  const form = raiz.querySelector('#form-clave');
  const error = raiz.querySelector('#clave-error');
  const reglas = () => {
    const n = form.nueva.value;
    const ok = {
      largo: n.length >= 12,
      usuario: n.length > 0 && !n.toLowerCase().includes(estado.usuario.usuario.toLowerCase()),
      igual: n.length > 0 && n === form.repetir.value,
    };
    for (const [k, v] of Object.entries(ok)) {
      const li = form.querySelector(`[data-regla="${k}"]`);
      li.classList.toggle('ok', v);
      li.querySelector('use').setAttribute('href', v ? '#i-cumple' : '#i-omitida');
    }
    return Object.values(ok).every(Boolean);
  };
  form.addEventListener('input', reglas);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.classList.add('oculto');
    if (!reglas()) { error.textContent = 'La nueva contraseña no cumple la política.'; error.classList.remove('oculto'); return; }
    try {
      const r = await api.post('/auth/cambiar-clave', { actual: form.actual.value, nueva: form.nueva.value });
      estado.usuario = r.usuario;
      notificar('Contraseña actualizada');
      ir('/');
    } catch (err) {
      error.textContent = err.message;
      error.classList.remove('oculto');
    }
  });
}

// Cliente de la API: agrega el token CSRF y centraliza el manejo de sesión expirada.
let csrf = '';
let alExpirar = () => {};
let alCambioRequerido = () => {};

export function configurar({ expirada, cambioRequerido }) {
  alExpirar = expirada;
  alCambioRequerido = cambioRequerido;
}

export function fijarCsrf(t) { if (t) csrf = t; }

export class ErrorApi extends Error {
  constructor(estado, cuerpo) {
    super((cuerpo && cuerpo.error) || `Error ${estado}`);
    this.estado = estado;
    this.cuerpo = cuerpo;
  }
}

export async function pedir(metodo, ruta, datos, { silencioso = false, reintento = false } = {}) {
  const opciones = { method: metodo, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
  if (metodo !== 'GET') {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.headers['X-CSRF-Token'] = csrf;
    opciones.body = JSON.stringify(datos || {});
  }
  const r = await fetch('/api' + ruta, opciones);
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch { cuerpo = null; }
  if (cuerpo && cuerpo.csrf) csrf = cuerpo.csrf;
  if (!r.ok) {
    // Token CSRF vencido (por ejemplo, tras cerrar sesión o expirar): se pide uno nuevo y se reintenta una vez
    if (r.status === 403 && !reintento && metodo !== 'GET' && cuerpo && /CSRF/.test(cuerpo.error || '')) {
      await iniciarCsrf();
      return pedir(metodo, ruta, datos, { silencioso, reintento: true });
    }
    if (r.status === 401 && !silencioso && !ruta.startsWith('/auth/login')) alExpirar();
    if (r.status === 403 && cuerpo && cuerpo.cambioRequerido) alCambioRequerido();
    throw new ErrorApi(r.status, cuerpo);
  }
  return cuerpo;
}

export const api = {
  get: (ruta, op) => pedir('GET', ruta, null, op),
  post: (ruta, d, op) => pedir('POST', ruta, d, op),
  patch: (ruta, d, op) => pedir('PATCH', ruta, d, op),
};

export async function iniciarCsrf() {
  const r = await api.get('/auth/csrf', { silencioso: true });
  fijarCsrf(r.csrf);
  return r;
}

'use strict';
// Servicio de usuarios del sistema: alta, ingreso con bloqueo temporal y cambio de contraseña.
const claves = require('./claves');
const { ROLES } = require('./permisos');

const PATRON_USUARIO = /^[a-zA-Z][a-zA-Z0-9._-]{2,39}$/;

class ErrorValidacion extends Error {
  constructor(mensajes, estado = 400) {
    super(Array.isArray(mensajes) ? mensajes.join(' ') : mensajes);
    this.mensajes = Array.isArray(mensajes) ? mensajes : [mensajes];
    this.estado = estado;
  }
}

function crearServicioUsuarios(db, config) {
  const ahora = () => new Date().toISOString();
  const q = {
    porNombre: db.prepare('SELECT * FROM usuarios WHERE usuario = ?'),
    porId: db.prepare('SELECT * FROM usuarios WHERE id = ?'),
    contar: db.prepare('SELECT COUNT(*) n FROM usuarios'),
    contarAdminsActivos: db.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol = 'administrador' AND activo = 1"),
    insertar: db.prepare(`INSERT INTO usuarios (usuario, nombre, rol, hash, activo, debe_cambiar, creado, actualizado)
                          VALUES (@usuario, @nombre, @rol, @hash, 1, @debe_cambiar, @creado, @creado)`),
    listar: db.prepare(`SELECT id, usuario, nombre, rol, activo, debe_cambiar, intentos_fallidos, bloqueado_hasta,
                               ultimo_ingreso, creado FROM usuarios ORDER BY usuario`),
    fallo: db.prepare('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ?, actualizado = ? WHERE id = ?'),
    exito: db.prepare('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_ingreso = ?, actualizado = ? WHERE id = ?'),
    clave: db.prepare('UPDATE usuarios SET hash = ?, debe_cambiar = ?, intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado = ? WHERE id = ?'),
    rol: db.prepare('UPDATE usuarios SET rol = ?, actualizado = ? WHERE id = ?'),
    activo: db.prepare('UPDATE usuarios SET activo = ?, actualizado = ? WHERE id = ?'),
  };

  function publico(u) {
    if (!u) return null;
    return {
      id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: Boolean(u.activo),
      debeCambiar: Boolean(u.debe_cambiar), intentosFallidos: u.intentos_fallidos,
      bloqueadoHasta: u.bloqueado_hasta, ultimoIngreso: u.ultimo_ingreso, creado: u.creado,
    };
  }

  async function crear({ usuario, nombre, rol, clave, debeCambiar = false }) {
    const errores = [];
    if (!PATRON_USUARIO.test(String(usuario || ''))) {
      errores.push('El usuario debe tener de 3 a 40 caracteres: letras, números, punto, guion o guion bajo, y empezar con letra.');
    }
    if (!nombre || String(nombre).trim().length < 2) errores.push('Indique el nombre completo.');
    if (!ROLES.includes(rol)) errores.push('Rol no válido.');
    errores.push(...claves.validarPolitica(clave, usuario));
    if (errores.length) throw new ErrorValidacion(errores);
    if (q.porNombre.get(usuario)) throw new ErrorValidacion('Ya existe un usuario con ese nombre.', 409);
    const id = q.insertar.run({
      usuario, nombre: String(nombre).trim().slice(0, 100), rol, hash: await claves.hashear(clave),
      debe_cambiar: debeCambiar ? 1 : 0, creado: ahora(),
    }).lastInsertRowid;
    return publico(q.porId.get(id));
  }

  // Crea el administrador inicial desde ADMIN_USER / ADMIN_PASSWORD si no hay usuarios.
  async function asegurarAdministrador() {
    if (q.contar.get().n > 0) return null;
    if (!config.adminUsuario || !config.adminClave) {
      throw new Error('No hay usuarios: defina ADMIN_USER y ADMIN_PASSWORD para crear el administrador inicial.');
    }
    return crear({ usuario: config.adminUsuario, nombre: 'Administrador inicial', rol: 'administrador',
      clave: config.adminClave });
  }

  // Devuelve { ok, usuario?, motivo, bloqueadoAhora }
  async function ingresar(usuario, clave) {
    const u = q.porNombre.get(String(usuario || ''));
    if (!u) {
      await claves.comparar(clave, claves.HASH_FICTICIO);
      return { ok: false, motivo: 'usuario inexistente' };
    }
    if (!u.activo) {
      await claves.comparar(clave, claves.HASH_FICTICIO);
      return { ok: false, motivo: 'cuenta desactivada', fila: u };
    }
    const t = Date.now();
    if (u.bloqueado_hasta && Date.parse(u.bloqueado_hasta) > t) {
      return { ok: false, motivo: 'cuenta bloqueada', bloqueada: true, hasta: u.bloqueado_hasta, fila: u };
    }
    const correcta = await claves.comparar(clave, u.hash);
    if (!correcta) {
      // Si el bloqueo anterior ya venció, el contador vuelve a empezar
      const previos = u.bloqueado_hasta ? 0 : u.intentos_fallidos;
      const intentos = previos + 1;
      let hasta = null;
      if (intentos >= config.intentosMaximos) hasta = new Date(t + config.bloqueoMin * 60000).toISOString();
      q.fallo.run(hasta ? 0 : intentos, hasta, ahora(), u.id);
      return { ok: false, motivo: 'contraseña incorrecta', intentos, bloqueadoAhora: Boolean(hasta), hasta, fila: u };
    }
    q.exito.run(ahora(), ahora(), u.id);
    return { ok: true, usuario: publico(q.porId.get(u.id)) };
  }

  async function cambiarClave(id, actual, nueva) {
    const u = q.porId.get(id);
    if (!u) throw new ErrorValidacion('Usuario no encontrado.', 404);
    if (!(await claves.comparar(actual, u.hash))) throw new ErrorValidacion('La contraseña actual no es correcta.');
    const errores = claves.validarPolitica(nueva, u.usuario);
    if (await claves.comparar(nueva, u.hash)) errores.push('La nueva contraseña debe ser distinta de la actual.');
    if (errores.length) throw new ErrorValidacion(errores);
    q.clave.run(await claves.hashear(nueva), 0, ahora(), id);
  }

  // Restablecimiento por el administrador: la nueva contraseña queda definitiva (cambiarla es opcional).
  async function restablecerClave(id, nueva) {
    const u = q.porId.get(id);
    if (!u) throw new ErrorValidacion('Usuario no encontrado.', 404);
    const errores = claves.validarPolitica(nueva, u.usuario);
    if (errores.length) throw new ErrorValidacion(errores);
    q.clave.run(await claves.hashear(nueva), 0, ahora(), id);
    return publico(q.porId.get(id));
  }

  function noDejarSinAdministrador(u, nuevoRol, nuevoActivo) {
    const dejaDeSerAdminActivo = u.rol === 'administrador' && u.activo && (nuevoRol !== 'administrador' || !nuevoActivo);
    if (dejaDeSerAdminActivo && q.contarAdminsActivos.get().n <= 1) {
      throw new ErrorValidacion('Debe quedar al menos un administrador activo.', 409);
    }
  }

  function cambiarRol(id, rol) {
    if (!ROLES.includes(rol)) throw new ErrorValidacion('Rol no válido.');
    const u = q.porId.get(id);
    if (!u) throw new ErrorValidacion('Usuario no encontrado.', 404);
    noDejarSinAdministrador(u, rol, Boolean(u.activo));
    q.rol.run(rol, ahora(), id);
    return { antes: u.rol, usuario: publico(q.porId.get(id)) };
  }

  function cambiarActivo(id, activo) {
    const u = q.porId.get(id);
    if (!u) throw new ErrorValidacion('Usuario no encontrado.', 404);
    noDejarSinAdministrador(u, u.rol, activo);
    q.activo.run(activo ? 1 : 0, ahora(), id);
    return publico(q.porId.get(id));
  }

  return {
    crear, asegurarAdministrador, ingresar, cambiarClave, restablecerClave, cambiarRol, cambiarActivo,
    listar: () => q.listar.all().map(publico),
    obtener: (id) => publico(q.porId.get(id)),
  };
}

module.exports = { crearServicioUsuarios, ErrorValidacion };

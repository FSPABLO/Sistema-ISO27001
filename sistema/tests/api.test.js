'use strict';
// Pruebas de la API con un conector simulado: autenticación, roles, CSRF, ejecución y secretos.
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearEntorno, agente, adminListo, usuarioListo, esperarFin, CLAVE_ADMIN } = require('./ayuda');

const CLAVE_BD = 'Clave_De_La_Base_Secreta_987';
const CONEXION = { alias: 'Laboratorio', host: 'host.docker.internal', puerto: 1522, servicio: 'FREEPDB1', usuario: 'iso_audit' };

// Respuestas mínimas para que varias pruebas tengan resultado distinto
function respuestas(sql) {
  if (/FROM dba_users\s+WHERE username IN/.test(sql)) return { columnas: ['USERNAME', 'ACCOUNT_STATUS', 'CREATED', 'LOCK_DATE'], filas: [['SCOTT', 'OPEN', '2026-01-01 00:00:00', null]] };
  if (/v\$session_connect_info/.test(sql)) return { columnas: ['NETWORK_SERVICE_BANNER'], filas: [['AES256 Encryption service adapter for Linux'], ['SHA512 Crypto-checksumming service adapter for Linux']] };
  if (/FROM v\$option/.test(sql)) return { columnas: ['PARAMETER', 'VALUE'], filas: [['Transparent Data Encryption', 'TRUE'], ['Data Redaction', 'FALSE'], ['Fine-grained access control', 'TRUE'], ['Unified Auditing', 'TRUE']] };
  if (/FROM v\$database/.test(sql)) return new Error('ORA-00942: table or view does not exist');
  return null;
}

test('flujo de ingreso: sin cambio obligatorio de clave, errores y CSRF', async () => {
  const e = crearEntorno();
  await e.servicios.usuarios.asegurarAdministrador();
  const a = await agente(e.app);

  // sin token CSRF se rechaza
  const sinToken = await a.post('/api/auth/login').send({ usuario: 'admin', clave: CLAVE_ADMIN });
  assert.equal(sinToken.status, 403);

  const mala = await a.ingresar('admin', 'otra-clave-cualquiera');
  assert.equal(mala.status, 401);
  assert.equal(mala.body.error, 'Usuario o contraseña incorrectos.');
  const inexistente = await a.ingresar('nadie', 'otra-clave-cualquiera');
  assert.equal(inexistente.body.error, mala.body.error, 'no revela si el usuario existe');

  const ok = await a.ingresar('admin', CLAVE_ADMIN);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.usuario.debeCambiar, false, 'la contraseña inicial es definitiva');
  const cookie = ok.headers['set-cookie'].join(';');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);

  // se puede usar el sistema de inmediato, sin cambiar la contraseña
  assert.equal((await a.get('/api/panel')).status, 200);

  // cambiarla es opcional y sigue aplicando la política
  const corta = await a.enviar('post', '/api/auth/cambiar-clave', { actual: CLAVE_ADMIN, nueva: 'corta' });
  assert.equal(corta.status, 400);
  const igual = await a.enviar('post', '/api/auth/cambiar-clave', { actual: CLAVE_ADMIN, nueva: CLAVE_ADMIN });
  assert.equal(igual.status, 400);
  const cambio = await a.enviar('post', '/api/auth/cambiar-clave', { actual: CLAVE_ADMIN, nueva: 'Nueva_Clave_Jefe_2026' });
  assert.equal(cambio.status, 200);
  assert.equal((await a.get('/api/panel')).status, 200);

  const salir = await a.enviar('post', '/api/auth/logout', {});
  assert.equal(salir.status, 200);
  assert.equal((await a.get('/api/panel')).status, 401);
});

test('bloqueo temporal tras 5 intentos fallidos y registro en auditoría', async () => {
  const e = crearEntorno();
  await e.servicios.usuarios.asegurarAdministrador();
  const a = await agente(e.app);
  for (let i = 0; i < 4; i++) assert.equal((await a.ingresar('admin', 'incorrecta-' + i)).status, 401);
  const quinto = await a.ingresar('admin', 'incorrecta-5');
  assert.equal(quinto.status, 423);
  assert.match(quinto.body.error, /bloqueada/);
  // aun con la clave correcta sigue bloqueada
  assert.equal((await a.ingresar('admin', CLAVE_ADMIN)).status, 423);
  const acciones = e.db.prepare('SELECT accion, resultado FROM audit_log ORDER BY id').all().map((f) => f.accion);
  assert.equal(acciones.filter((x) => x === 'LOGIN_FALLIDO').length, 6);
  assert.ok(acciones.includes('BLOQUEO_CUENTA'));
});

test('el administrador inicial requiere ADMIN_USER y una clave de 12+ caracteres', async () => {
  await assert.rejects(crearEntorno({ config: { adminClave: 'corta' } }).servicios.usuarios.asegurarAdministrador(), /12 caracteres/);
  await assert.rejects(crearEntorno({ config: { adminUsuario: '', adminClave: '' } }).servicios.usuarios.asegurarAdministrador(), /ADMIN_USER/);
});

test('permisos por rol', async () => {
  const e = crearEntorno({ respuestas });
  const admin = await adminListo(e);
  const analista = await usuarioListo(e, admin, 'ana', 'analista');
  const auditor = await usuarioListo(e, admin, 'aurelio', 'auditor');

  // gestión de usuarios: solo administrador
  assert.equal((await admin.get('/api/usuarios')).status, 200);
  assert.equal((await analista.get('/api/usuarios')).status, 403);
  assert.equal((await auditor.get('/api/usuarios')).status, 403);
  assert.equal((await analista.enviar('post', '/api/usuarios', { usuario: 'x1', nombre: 'X', rol: 'administrador', clave: 'Una_Clave_Larga_1' })).status, 403);

  // registrar conexiones: administrador y analista
  const cx = await analista.enviar('post', '/api/conexiones', CONEXION);
  assert.equal(cx.status, 201);
  assert.equal((await auditor.enviar('post', '/api/conexiones', { ...CONEXION, alias: 'Otra' })).status, 403);

  // ejecutar: administrador y analista; el auditor no
  const id = cx.body.conexion.id;
  assert.equal((await auditor.enviar('post', '/api/ejecuciones', { conexionId: id, clave: CLAVE_BD })).status, 403);
  assert.equal((await auditor.enviar('post', `/api/conexiones/${id}/probar`, { clave: CLAVE_BD })).status, 403);
  const ejAdmin = await admin.enviar('post', '/api/ejecuciones', { conexionId: id, clave: CLAVE_BD });
  assert.equal(ejAdmin.status, 202);
  await esperarFin(admin, ejAdmin.body.id);
  const ejAna = await analista.enviar('post', '/api/ejecuciones', { conexionId: id, clave: CLAVE_BD });
  assert.equal(ejAna.status, 202);
  await esperarFin(analista, ejAna.body.id);

  // historial: el analista solo ve las propias; administrador y auditor ven todas
  const histAna = (await analista.get('/api/ejecuciones')).body.ejecuciones;
  assert.deepEqual(histAna.map((x) => x.id), [ejAna.body.id]);
  assert.equal((await analista.get(`/api/ejecuciones/${ejAdmin.body.id}`)).status, 403);
  assert.equal((await analista.get(`/api/ejecuciones/${ejAdmin.body.id}/descarga`)).status, 403);
  assert.equal((await auditor.get('/api/ejecuciones')).body.ejecuciones.length, 2);
  assert.equal((await auditor.get(`/api/ejecuciones/${ejAna.body.id}`)).status, 200);
  assert.equal((await admin.get('/api/ejecuciones')).body.ejecuciones.length, 2);

  // registro de auditoría: administrador y auditor
  assert.equal((await analista.get('/api/auditoria')).status, 403);
  assert.equal((await auditor.get('/api/auditoria')).status, 200);
  const v = await auditor.get('/api/auditoria/verificar');
  assert.equal(v.body.integro, true);

  // el auditor no puede modificar nada: no existen rutas para borrar registros
  assert.equal((await admin.enviar('delete', '/api/auditoria/1', {})).status, 404);
  assert.equal((await admin.enviar('patch', '/api/auditoria/1', { usuario: 'x' })).status, 404);

  // comparación (misma conexión)
  const cmp = await auditor.get(`/api/ejecuciones/comparar?a=${ejAdmin.body.id}&b=${ejAna.body.id}`);
  assert.equal(cmp.status, 200);
  assert.equal(cmp.body.filas.length, 18);
  assert.equal((await analista.get(`/api/ejecuciones/comparar?a=${ejAdmin.body.id}&b=${ejAna.body.id}`)).status, 403);

  const denegados = e.db.prepare("SELECT COUNT(*) n FROM audit_log WHERE accion = 'ACCESO_DENEGADO'").get().n;
  assert.ok(denegados >= 5);
});

test('ejecución completa: estados, evidencia, omitidas y no evaluables', async () => {
  const e = crearEntorno({ respuestas });
  const admin = await adminListo(e);
  const { body } = await admin.enviar('post', '/api/conexiones', CONEXION);
  const r = await admin.enviar('post', '/api/ejecuciones', { conexionId: body.conexion.id, clave: CLAVE_BD });
  const fin = await esperarFin(admin, r.body.id);
  assert.equal(fin.estado, 'TERMINADA');
  const ej = (await admin.get(`/api/ejecuciones/${r.body.id}`)).body.ejecucion;
  assert.equal(ej.controles.length, 18);
  const prueba = (id) => ej.pruebas.find((p) => p.pruebaId === id);
  assert.equal(prueba('A5.18-1').estado, 'NO CUMPLE');
  assert.match(prueba('A5.18-1').detalle, /SCOTT/);
  assert.equal(prueba('A8.20-1').estado, 'CUMPLE');
  // opción no disponible y error ORA- → NO EVALUABLE con motivo
  assert.equal(prueba('A8.11-1').estado, 'NO EVALUABLE');
  assert.match(prueba('A8.11-1').detalle, /Data Redaction/);
  assert.equal(prueba('A8.13-1').estado, 'NO EVALUABLE');
  assert.match(prueba('A8.13-1').detalle, /ORA-00942/);
  // pruebas funcionales no activadas → OMITIDA
  assert.equal(prueba('PB-10').estado, 'OMITIDA');
  assert.equal(ej.controles.find((c) => c.controlId === 'A8.33').estado, 'OMITIDA');
  // evidencia tipo terminal
  const b = prueba('A5.18-1').bloques[0];
  assert.equal(b.comando, 'sqlplus iso_audit/********@//host.docker.internal:1522/FREEPDB1');
  assert.match(b.consulta, /^SQL> SELECT/);
  assert.match(b.salida, /USERNAME\s+ACCOUNT_STATUS/);
  assert.match(prueba('A5.18-2').bloques[0].salida, /no rows selected/);
  // puntaje y prioridades
  assert.equal(typeof ej.puntaje, 'number');
  assert.ok(ej.resumen.prioridades.length > 0);
  assert.equal(ej.resumen.prioridades[0].posicion, 1);
});

test('una clave de base incorrecta termina la ejecución con ERROR', async () => {
  const e = crearEntorno({ respuestas });
  const admin = await adminListo(e);
  const { body } = await admin.enviar('post', '/api/conexiones', CONEXION);
  const r = await admin.enviar('post', '/api/ejecuciones', { conexionId: body.conexion.id, clave: 'clave-mala' });
  const fin = await esperarFin(admin, r.body.id);
  assert.equal(fin.estado, 'ERROR');
  assert.match(fin.error, /ORA-01017/);
});

test('pruebas funcionales: identificadores inválidos se rechazan antes de ejecutar', async () => {
  const e = crearEntorno({ respuestas });
  const admin = await adminListo(e);
  const { body } = await admin.enviar('post', '/api/conexiones', CONEXION);
  const r = await admin.enviar('post', '/api/ejecuciones', { conexionId: body.conexion.id, clave: CLAVE_BD,
    funcional: { activa: true, tabla: { esquema: 'SEGCONF', tabla: 'CLIENTES; DROP TABLE X', clave: 'ID' } } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no válido/);
  assert.equal(e.db.prepare('SELECT COUNT(*) n FROM ejecuciones').get().n, 0);
});

test('la contraseña de la base no aparece en SQLite, auditoría, evidencia ni respuestas', async () => {
  const e = crearEntorno({ respuestas });
  const admin = await adminListo(e);
  const cx = await admin.enviar('post', '/api/conexiones', { ...CONEXION, clave: CLAVE_BD });
  assert.ok(!JSON.stringify(cx.body).includes(CLAVE_BD));
  const prueba = await admin.enviar('post', `/api/conexiones/${cx.body.conexion.id}/probar`, { clave: CLAVE_BD });
  assert.equal(prueba.status, 200);
  const r = await admin.enviar('post', '/api/ejecuciones', { conexionId: cx.body.conexion.id, clave: CLAVE_BD,
    funcional: { activa: true, tabla: { esquema: 'SEGCONF', tabla: 'CLIENTES', clave: 'ID_CLIENTE', columnasSensibles: ['EMAIL'] },
      cuentas: { redaccion: { usuario: 'APP_CONSULTA', clave: CLAVE_BD + 'F' }, referencia: { usuario: 'SEGCONF', clave: CLAVE_BD + 'R' } } } });
  await esperarFin(admin, r.body.id);
  const respuestasHttp = [
    JSON.stringify((await admin.get(`/api/ejecuciones/${r.body.id}`)).body),
    JSON.stringify((await admin.get('/api/ejecuciones')).body),
    JSON.stringify((await admin.get('/api/auditoria')).body),
    JSON.stringify((await admin.get('/api/conexiones')).body),
    (await admin.get(`/api/ejecuciones/${r.body.id}/descarga`)).text,
  ];
  for (const t of respuestasHttp) assert.ok(!t.includes(CLAVE_BD), 'la clave aparece en una respuesta HTTP');
  // volcado completo de todas las tablas de SQLite
  const tablas = e.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((f) => f.name);
  for (const t of tablas) {
    const volcado = JSON.stringify(e.db.prepare(`SELECT * FROM ${t}`).all());
    assert.ok(!volcado.includes(CLAVE_BD), `la clave aparece en la tabla ${t}`);
  }
  // la conexión simulada sí recibió las claves (en memoria)
  assert.ok(e.registro.aperturas.some((x) => x.clave === CLAVE_BD));
  assert.ok(e.registro.aperturas.some((x) => x.usuario === 'APP_CONSULTA'));
});

test('cabeceras de seguridad y CSP sin orígenes externos', async () => {
  const e = crearEntorno();
  const r = await (await agente(e.app)).get('/');
  assert.match(r.headers['content-security-policy'], /default-src 'self'/);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['x-powered-by'], undefined);
});

test('administración de usuarios: alta, cambio de rol, baja y restablecimiento auditados', async () => {
  const e = crearEntorno();
  const admin = await adminListo(e);
  const alta = await admin.enviar('post', '/api/usuarios', { usuario: 'beto', nombre: 'Beto', rol: 'analista', clave: 'Clave_Persona_Larga_1' });
  assert.equal(alta.status, 201);
  const debil = await admin.enviar('post', '/api/usuarios', { usuario: 'debil', nombre: 'Débil', rol: 'analista', clave: 'corta' });
  assert.equal(debil.status, 400);
  const id = alta.body.usuario.id;
  assert.equal((await admin.enviar('patch', `/api/usuarios/${id}/rol`, { rol: 'auditor' })).body.usuario.rol, 'auditor');
  assert.equal((await admin.enviar('post', `/api/usuarios/${id}/restablecer-clave`, { clave: 'Otra_Clave_Larga_2' })).body.usuario.debeCambiar, false);
  assert.equal((await admin.enviar('patch', `/api/usuarios/${id}/activo`, { activo: false })).body.usuario.activo, false);
  const beto = await agente(e.app);
  assert.equal((await beto.ingresar('beto', 'Otra_Clave_Larga_2')).status, 401, 'cuenta desactivada no ingresa');
  // no se puede dejar el sistema sin administrador
  const yo = (await admin.get('/api/auth/yo')).body.usuario;
  assert.equal((await admin.enviar('patch', `/api/usuarios/${yo.id}/rol`, { rol: 'analista' })).status, 409);
  const acciones = e.db.prepare('SELECT accion FROM audit_log').all().map((f) => f.accion);
  for (const x of ['USUARIO_ALTA', 'USUARIO_CAMBIO_ROL', 'USUARIO_RESTABLECER_CLAVE', 'USUARIO_BAJA', 'CAMBIO_CLAVE', 'LOGIN_OK']) {
    assert.ok(acciones.includes(x), x);
  }
});

test('crear cuenta desde el inicio de sesión: siempre analista, auditado y sin cambio obligatorio', async () => {
  const e = crearEntorno();
  await e.servicios.usuarios.asegurarAdministrador();
  const a = await agente(e.app);
  assert.equal((await a.get('/api/auth/csrf')).body.registro, true);
  // aunque se envíe otro rol, la cuenta queda como analista
  const r = await a.enviar('post', '/api/auth/registro', { usuario: 'nueva.persona', nombre: 'Nueva Persona', clave: 'Clave_Propia_Larga_1', rol: 'administrador' });
  assert.equal(r.status, 201);
  assert.equal(r.body.usuario.rol, 'analista');
  assert.equal(r.body.usuario.debeCambiar, false);
  a.csrf = r.body.csrf;
  // queda con la sesión iniciada y puede usar el sistema
  assert.equal((await a.get('/api/panel')).status, 200);
  assert.equal((await a.get('/api/usuarios')).status, 403);
  // usuario repetido y contraseña corta se rechazan
  const otro = await agente(e.app);
  assert.equal((await otro.enviar('post', '/api/auth/registro', { usuario: 'nueva.persona', nombre: 'Copia', clave: 'Clave_Propia_Larga_2' })).status, 409);
  assert.equal((await otro.enviar('post', '/api/auth/registro', { usuario: 'otra.persona', nombre: 'Otra', clave: 'corta' })).status, 400);
  // sin token CSRF no se registra
  assert.equal((await otro.post('/api/auth/registro').send({ usuario: 'sin.token', nombre: 'X', clave: 'Clave_Propia_Larga_3' })).status, 403);
  const registros = e.db.prepare("SELECT resultado FROM audit_log WHERE accion = 'USUARIO_REGISTRO'").all().map((f) => f.resultado);
  assert.deepEqual(registros, ['OK', 'FALLIDO', 'FALLIDO']);
  // la nueva cuenta entra con su contraseña de siempre
  const b = await agente(e.app);
  assert.equal((await b.ingresar('nueva.persona', 'Clave_Propia_Larga_1')).status, 200);
});

test('el registro se puede desactivar con PERMITIR_REGISTRO=false', async () => {
  const e = crearEntorno({ config: { permitirRegistro: false } });
  const a = await agente(e.app);
  assert.equal((await a.get('/api/auth/csrf')).body.registro, false);
  const r = await a.enviar('post', '/api/auth/registro', { usuario: 'nadie.mas', nombre: 'Nadie', clave: 'Clave_Propia_Larga_1' });
  assert.equal(r.status, 403);
  assert.equal(e.db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 0);
});

'use strict';
const config = require('./config');
const { abrir } = require('./db');
const { crearApp } = require('./app');
const { crearFabricaConectores } = require('./conectores');

async function principal() {
  const db = abrir(config.dbArchivo);
  const { app, servicios, auditoria } = crearApp({ db, config, fabricaConectores: crearFabricaConectores(config) });
  const admin = await servicios.usuarios.asegurarAdministrador();
  if (admin) {
    auditoria.registrar({ usuario: 'sistema', rol: 'sistema', accion: 'USUARIO_ALTA', objeto: `usuario:${admin.usuario}`,
      resultado: 'OK', detalle: 'Administrador inicial creado desde ADMIN_USER' });
    console.log(`Administrador inicial "${admin.usuario}" creado.`);
  }
  if (config.secretoGenerado) console.warn('SESSION_SECRET no definido: se generó uno temporal (las sesiones se pierden al reiniciar).');
  app.listen(config.puerto, () => console.log(`Sistema de auditoría ISO/IEC 27001 en http://localhost:${config.puerto}`));
}

principal().catch((e) => {
  console.error('No se pudo iniciar:', e.message);
  process.exit(1);
});

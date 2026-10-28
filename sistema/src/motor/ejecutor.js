'use strict';
// Motor de ejecución: se conecta a la base auditada mediante el conector, corre el catálogo,
// guarda la evidencia y calcula puntaje y prioridades. Las claves de la base solo viven en memoria
// durante la ejecución: no se guardan, no se registran y no aparecen en la evidencia.
const { PRUEBAS, FUNCIONALES } = require('../catalogo');
const { comoObjetos } = require('../conectores/Conector');
const { normalizarConfiguracion, faltan } = require('../catalogo/funcionales');
const { formatearSqlplus, declararBinds, sqlComoPrompt } = require('./formato');
const { asegurarSoloLectura } = require('./seguridadSql');
const pt = require('./puntaje');

function primeraLinea(e) {
  return String((e && e.message) || e || 'Error desconocido').split('\n')[0].slice(0, 300);
}

function comando(plantilla, datos) {
  return plantilla
    .replace('{usuario}', String(datos.usuario || '').toLowerCase())
    .replace('{host}', datos.host).replace('{puerto}', datos.puerto).replace('{servicio}', datos.servicio);
}

const FILAS_EVIDENCIA = 50;

// Bloque de evidencia tipo terminal. Se guardan como máximo 50 filas para no inflar el historial.
function crearBloque({ comandoTexto, sql, binds, resultado, error }) {
  const filas = resultado ? resultado.filas : [];
  const visibles = filas.slice(0, FILAS_EVIDENCIA);
  let salida = error || formatearSqlplus(resultado.columnas, visibles);
  if (!error && filas.length > FILAS_EVIDENCIA) {
    salida = salida.replace(/\n\d+ rows selected\.$/, `\n... (se muestran ${FILAS_EVIDENCIA} de ${filas.length} filas)\n\n${filas.length} rows selected.`);
  }
  return {
    comando: comandoTexto,
    binds: declararBinds(binds),
    consulta: sqlComoPrompt(sql),
    salida,
    columnas: resultado ? resultado.columnas : [],
    filas: visibles,
    filasTotales: filas.length,
    truncado: Boolean(resultado && resultado.truncado),
    error: error || null,
  };
}

function crearEjecutor({ db, fabricaConectores, auditoria, config }) {
  const progreso = new Map();
  const q = {
    insertar: db.prepare(`INSERT INTO ejecuciones (conexion_id, usuario_id, inicio, estado, total, funcional, perfil, conexion_snapshot)
                          VALUES (?, ?, ?, 'EN CURSO', ?, ?, ?, ?)`),
    avance: db.prepare('UPDATE ejecuciones SET progreso = ?, paso_actual = ? WHERE id = ?'),
    info: db.prepare('UPDATE ejecuciones SET info_bd = ? WHERE id = ?'),
    resultado: db.prepare(`INSERT INTO resultados_prueba (ejecucion_id, orden, prueba_id, control_id, estado, detalle, evidencia, duracion_ms)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    control: db.prepare(`INSERT INTO resultados_control (ejecucion_id, control_id, estado, peso, valor, madurez, motivo)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`),
    fin: db.prepare(`UPDATE ejecuciones SET estado = ?, fin = ?, puntaje = ?, resumen = ?, error = ?, progreso = total, paso_actual = NULL
                      WHERE id = ?`),
  };

  const datosConexion = (cx, usuario, clave) => ({ host: cx.host, puerto: cx.puerto, servicio: cx.servicio, usuario, clave });

  // Probar conexión: versión, contenedor y cifrado del canal
  async function probar(cx, clave) {
    const conector = fabricaConectores(cx.motor);
    try {
      await conector.abrir(datosConexion(cx, cx.usuario_bd, clave));
      return await conector.informacion();
    } finally {
      await conector.cerrar();
    }
  }

  // Valida y prepara las opciones; lanza error de validación antes de crear la ejecución
  function prepararFuncional(funcional) {
    if (!funcional || !funcional.activa) return { activa: false };
    return { activa: true, perfil: funcional.perfil || null, cfg: normalizarConfiguracion(funcional) };
  }

  function iniciar({ conexion: cx, usuario, clave, funcional, ip }) {
    const fx = prepararFuncional(funcional);
    const total = PRUEBAS.length + FUNCIONALES.length;
    const snapshot = { alias: cx.alias, motor: cx.motor, host: cx.host, puerto: cx.puerto, servicio: cx.servicio, usuario_bd: cx.usuario_bd };
    const id = Number(q.insertar.run(cx.id, usuario.id, new Date().toISOString(), total, fx.activa ? 1 : 0,
      fx.perfil, JSON.stringify(snapshot)).lastInsertRowid);
    progreso.set(id, { progreso: 0, total, paso: 'Conectando…' });
    auditoria.registrar({ usuario: usuario.usuario, rol: usuario.rol, ip, accion: 'EJECUCION_INICIO', objeto: `ejecucion:${id}`,
      resultado: 'OK', detalle: { conexion: cx.alias, funcional: fx.activa, perfil: fx.perfil } });
    // Se ejecuta en segundo plano; la clave queda solo en el cierre de esta función
    const tarea = correrEjecucion(id, cx, usuario, clave, fx, ip).catch(() => {});
    return { id, tarea };
  }

  async function correrEjecucion(id, cx, usuario, clave, fx, ip) {
    const conector = fabricaConectores(cx.motor);
    const sesionesFuncionales = new Map();
    const resultados = [];
    let orden = 0;
    const avanzar = (paso) => {
      const p = progreso.get(id);
      p.progreso = Math.min(p.total, orden); p.paso = paso;
      q.avance.run(p.progreso, paso, id);
    };
    const guardar = (prueba, estado, detalle, bloques, duracion, madurez) => {
      orden++;
      const evidencia = {
        tipo: prueba.tipo, nombre: prueba.nombre, descripcion: prueba.descripcion, fuente: prueba.fuente,
        heuristica: Boolean(prueba.heuristica), esperado: prueba.esperado,
        explicacion: estado === 'CUMPLE' ? prueba.explicacionCumple : (estado === 'NO CUMPLE' || estado === 'PARCIAL' ? prueba.explicacionNoCumple : null),
        recomendacion: prueba.recomendacion, bloques, madurez: madurez || 0,
      };
      q.resultado.run(id, orden, prueba.id, prueba.controlId, estado, detalle, JSON.stringify(evidencia), duracion);
      resultados.push({ pruebaId: prueba.id, controlId: prueba.controlId, nombre: prueba.nombre, estado, detalle,
        recomendacion: prueba.recomendacion, madurez });
    };

    try {
      try {
        await conector.abrir(datosConexion(cx, cx.usuario_bd, clave));
      } catch (e) {
        throw new Error(`No se pudo conectar a ${cx.host}:${cx.puerto}/${cx.servicio} como ${cx.usuario_bd}: ${primeraLinea(e)}`);
      }
      const info = await conector.informacion();
      q.info.run(JSON.stringify(info), id);
      const ctx = { info, opciones: null };
      try {
        const o = await conector.consultar('SELECT parameter, value FROM v$option');
        ctx.opciones = Object.fromEntries(o.filas);
      } catch { /* sin V$OPTION: no se descartan pruebas por opción */ }
      const cmdPrincipal = conector.comandoEquivalente();

      // ---- pruebas de diccionario ----
      for (const p of PRUEBAS) {
        avanzar(`${p.controlId} · ${p.nombre}`);
        const t0 = Date.now();
        if (p.requiereOpcion && ctx.opciones && ctx.opciones[p.requiereOpcion] !== 'TRUE') {
          guardar(p, 'NO EVALUABLE', `La opción "${p.requiereOpcion}" no está disponible en esta edición (V$OPTION = ${ctx.opciones[p.requiereOpcion] || 'no existe'}).`, [], 0);
          continue;
        }
        let r; let error = null;
        try {
          asegurarSoloLectura(p.sql);
          r = await conector.consultar(p.sql, p.binds || {}, { timeoutMs: config.timeoutPruebaMs });
        } catch (e) { error = primeraLinea(e); }
        const bloque = crearBloque({ comandoTexto: cmdPrincipal, sql: p.sql, binds: p.binds, resultado: r, error });
        if (error) {
          const motivo = /ORA-00942|ORA-01031/.test(error)
            ? `Sin privilegios para leer la vista: ${error}. Revise sql/crear_usuario_auditoria.sql.`
            : /DPI-1067|ORA-03156|timeout/i.test(error) ? `Tiempo máximo agotado (${config.timeoutPruebaMs} ms): ${error}` : error;
          guardar(p, 'NO EVALUABLE', motivo, [bloque], Date.now() - t0);
          continue;
        }
        let ev;
        try { ev = p.evaluador(comoObjetos(r), ctx); } catch (e) { ev = { estado: 'NO EVALUABLE', detalle: `Error al evaluar el resultado: ${primeraLinea(e)}` }; }
        guardar(p, ev.estado, ev.detalle, [bloque], Date.now() - t0, ev.madurez);
      }

      // ---- pruebas funcionales ----
      const correr = async (rol, sql, binds = {}, opciones = {}) => {
        const cta = fx.cfg.cuentas[rol];
        let s = sesionesFuncionales.get(cta.usuario);
        const datos = datosConexion(cx, cta.usuario, cta.clave);
        const cmd = comando('sqlplus {usuario}/********@//{host}:{puerto}/{servicio}', datos);
        if (!s) {
          s = { conector: fabricaConectores(cx.motor), error: null };
          try { await s.conector.abrir(datos); } catch (e) { s.error = primeraLinea(e); }
          sesionesFuncionales.set(cta.usuario, s);
        }
        const bloques = correr.bloques;
        if (s.error) {
          bloques.push(crearBloque({ comandoTexto: cmd, sql, binds, error: `ERROR al conectar: ${s.error}` }));
          return { error: `No se pudo conectar como ${cta.usuario}: ${s.error}`, filas: [], columnas: [] };
        }
        try {
          const r = await s.conector.consultar(sql, binds, { timeoutMs: config.timeoutPruebaMs, ...opciones });
          bloques.push(crearBloque({ comandoTexto: cmd, sql, binds, resultado: r }));
          return r;
        } catch (e) {
          const err = primeraLinea(e);
          bloques.push(crearBloque({ comandoTexto: cmd, sql, binds, error: err }));
          return { error: err, filas: [], columnas: [] };
        }
      };

      for (const f of FUNCIONALES) {
        avanzar(`${f.controlId} · ${f.nombre}`);
        if (!fx.activa) { guardar(f, 'OMITIDA', 'Pruebas funcionales no activadas en esta ejecución.', [], 0); continue; }
        const falta = faltan(fx.cfg, f.requisitos);
        if (falta) { guardar(f, 'OMITIDA', falta, [], 0); continue; }
        const t0 = Date.now();
        correr.bloques = [];
        let ev;
        try { ev = await f.ejecutar(correr, fx.cfg); } catch (e) { ev = { estado: 'NO EVALUABLE', detalle: primeraLinea(e) }; }
        guardar(f, ev.estado, ev.detalle, correr.bloques, Date.now() - t0, ev.madurez);
      }

      // ---- resumen ----
      const controles = pt.resumirControles(resultados);
      const { puntaje, sumaPesos, obtenido } = pt.puntaje(controles);
      const resumen = {
        conteo: pt.conteoEstados(controles), sumaPesos, obtenido,
        prioridades: pt.prioridades(controles, resultados),
        porTema: pt.agrupar(controles, 'tema'), porTarea: pt.agrupar(controles, 'tarea'),
        pruebas: { total: resultados.length, ...contarPruebas(resultados) },
      };
      db.transaction(() => {
        for (const c of controles) q.control.run(id, c.controlId, c.estado, c.peso, c.valor, c.madurez, c.motivo);
        q.fin.run('TERMINADA', new Date().toISOString(), puntaje, JSON.stringify(resumen), null, id);
      })();
      auditoria.registrar({ usuario: usuario.usuario, rol: usuario.rol, ip, accion: 'EJECUCION_FIN', objeto: `ejecucion:${id}`,
        resultado: 'OK', detalle: { conexion: cx.alias, puntaje, conteo: resumen.conteo } });
    } catch (e) {
      const msg = primeraLinea(e);
      q.fin.run('ERROR', new Date().toISOString(), null, null, msg, id);
      auditoria.registrar({ usuario: usuario.usuario, rol: usuario.rol, ip, accion: 'EJECUCION_FIN', objeto: `ejecucion:${id}`,
        resultado: 'ERROR', detalle: msg });
    } finally {
      await conector.cerrar();
      for (const s of sesionesFuncionales.values()) await s.conector.cerrar();
      sesionesFuncionales.clear();
      if (fx.cfg) for (const c of Object.values(fx.cfg.cuentas)) c.clave = null;
      clave = null; // eslint-disable-line no-param-reassign
      progreso.delete(id);
    }
  }

  function contarPruebas(resultados) {
    const c = {};
    for (const r of resultados) c[r.estado] = (c[r.estado] || 0) + 1;
    return c;
  }

  return { iniciar, probar, progreso: (id) => progreso.get(id) || null };
}

module.exports = { crearEjecutor };

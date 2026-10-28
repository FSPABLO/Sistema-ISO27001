'use strict';
// Catálogo completo: 18 controles, sus pruebas de diccionario y las pruebas funcionales opcionales.
const { RIESGOS, TAREAS, CONTROLES, PORID } = require('./controles');
const { PRUEBAS } = require('./pruebas');
const { FUNCIONALES, ETIQUETAS_CUENTA } = require('./funcionales');
const { PERFILES } = require('./perfiles');

const TODAS = [...PRUEBAS, ...FUNCIONALES];

// Comprobación de consistencia al cargar: cada prueba apunta a un control existente y cada control tiene pruebas
for (const p of TODAS) {
  if (!PORID[p.controlId]) throw new Error(`La prueba ${p.id} apunta a un control inexistente (${p.controlId})`);
}
for (const c of CONTROLES) {
  c.pruebas = TODAS.filter((p) => p.controlId === c.id).map((p) => p.id);
  if (!c.pruebas.length) throw new Error(`El control ${c.id} no tiene pruebas`);
}

// Versión pública del catálogo (sin funciones) para la interfaz
function catalogoPublico() {
  const sinFunciones = (p) => ({
    id: p.id, controlId: p.controlId, tipo: p.tipo, nombre: p.nombre, descripcion: p.descripcion,
    sql: p.sql || p.sqlPlantilla, binds: p.binds || null, esperado: p.esperado, fuente: p.fuente,
    explicacionCumple: p.explicacionCumple, explicacionNoCumple: p.explicacionNoCumple,
    recomendacion: p.recomendacion, comandoEquivalente: p.comandoEquivalente,
    requiereOpcion: p.requiereOpcion || null, heuristica: Boolean(p.heuristica), requisitos: p.requisitos || null,
  });
  return {
    riesgos: RIESGOS, tareas: TAREAS, controles: CONTROLES, pruebas: TODAS.map(sinFunciones),
    perfiles: PERFILES, etiquetasCuenta: ETIQUETAS_CUENTA,
  };
}

module.exports = { RIESGOS, TAREAS, CONTROLES, PORID, PRUEBAS, FUNCIONALES, TODAS, PERFILES, catalogoPublico };

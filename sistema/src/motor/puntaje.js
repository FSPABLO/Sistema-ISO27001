'use strict';
// Estado por control, puntaje global, madurez, lista de prioridades y comparación de ejecuciones.
const { CONTROLES, PORID, RIESGOS } = require('../catalogo/controles');

const VALOR = { CUMPLE: 1, PARCIAL: 0.5, 'NO CUMPLE': 0 };
const BRECHA = { PARCIAL: 0.5, 'NO CUMPLE': 1 };
const EVALUADOS = Object.keys(VALOR);

// El estado de un control resume el de sus pruebas evaluadas (NO EVALUABLE y OMITIDA no cuentan).
function estadoControl(resultados) {
  const evaluados = resultados.filter((r) => EVALUADOS.includes(r.estado));
  if (!evaluados.length) {
    if (resultados.length && resultados.every((r) => r.estado === 'OMITIDA')) {
      return { estado: 'OMITIDA', motivo: resultados.map((r) => r.detalle).find(Boolean) || 'Pruebas omitidas' };
    }
    const noEv = resultados.filter((r) => r.estado === 'NO EVALUABLE');
    return { estado: 'NO EVALUABLE', motivo: noEv.map((r) => `${r.pruebaId}: ${r.detalle}`).join(' | ') || 'Sin pruebas evaluadas' };
  }
  const promedio = evaluados.reduce((s, r) => s + VALOR[r.estado], 0) / evaluados.length;
  const estado = promedio === 1 ? 'CUMPLE' : promedio === 0 ? 'NO CUMPLE' : 'PARCIAL';
  return { estado, motivo: null };
}

// Madurez 0–4: NO CUMPLE = 0 o 1 (1 si alguna prueba indica algo implementado), PARCIAL = 2, CUMPLE = 3.
// El nivel 4 exige pruebas de monitoreo continuo que este sistema no mide.
function madurez(estado, resultados) {
  if (estado === 'CUMPLE') return 3;
  if (estado === 'PARCIAL') return 2;
  if (estado === 'NO CUMPLE') return Math.min(1, Math.max(0, ...resultados.map((r) => r.madurez || 0)));
  return null;
}

function resumirControles(resultadosPrueba) {
  return CONTROLES.map((c) => {
    const propios = resultadosPrueba.filter((r) => r.controlId === c.id);
    const { estado, motivo } = estadoControl(propios);
    return {
      controlId: c.id, nombre: c.nombre, tema: c.tema, tarea: c.tarea, peso: c.peso, estado, motivo,
      valor: estado in VALOR ? VALOR[estado] : null, madurez: madurez(estado, propios),
    };
  });
}

// Puntaje = Σ(peso × valor) / Σ(peso de los controles evaluados) × 100
function puntaje(controles) {
  const ev = controles.filter((c) => c.valor !== null && c.valor !== undefined);
  const sumaPesos = ev.reduce((s, c) => s + c.peso, 0);
  if (!sumaPesos) return { puntaje: null, sumaPesos: 0, obtenido: 0 };
  const obtenido = ev.reduce((s, c) => s + c.peso * c.valor, 0);
  return { puntaje: Math.round((obtenido / sumaPesos) * 1000) / 10, sumaPesos, obtenido };
}

function compararId(a, b) {
  const [pa, na] = a.slice(1).split('.').map(Number);
  const [pb, nb] = b.slice(1).split('.').map(Number);
  return pa - pb || na - nb;
}

// Prioridad = peso × brecha (brecha 1 si no cumple, 0,5 si es parcial). Desempate: peso y luego id.
function prioridades(controles, resultadosPrueba = []) {
  const { sumaPesos } = puntaje(controles);
  return controles
    .filter((c) => c.estado in BRECHA)
    .map((c) => {
      const brecha = BRECHA[c.estado];
      const def = PORID[c.controlId];
      const pruebas = resultadosPrueba.filter((r) => r.controlId === c.controlId && (r.estado === 'NO CUMPLE' || r.estado === 'PARCIAL'));
      return {
        controlId: c.controlId, nombre: c.nombre, estado: c.estado, peso: c.peso, brecha,
        prioridad: c.peso * brecha,
        impacto: sumaPesos ? Math.round(((c.peso * brecha) / sumaPesos) * 1000) / 10 : 0,
        riesgo: def.riesgoPrincipal, riesgoNombre: RIESGOS[def.riesgoPrincipal].nombre, riesgoNivel: RIESGOS[def.riesgoPrincipal].nivel,
        pruebas: pruebas.map((p) => ({ pruebaId: p.pruebaId, nombre: p.nombre, estado: p.estado, detalle: p.detalle, recomendacion: p.recomendacion })),
      };
    })
    .sort((a, b) => b.prioridad - a.prioridad || b.peso - a.peso || compararId(a.controlId, b.controlId))
    .map((p, i) => ({ ...p, posicion: i + 1 }));
}

function conteoEstados(controles) {
  const conteo = { CUMPLE: 0, PARCIAL: 0, 'NO CUMPLE': 0, 'NO EVALUABLE': 0, OMITIDA: 0 };
  for (const c of controles) conteo[c.estado]++;
  return conteo;
}

// Agrupa por tema o por tarea del DBA para los gráficos
function agrupar(controles, clave) {
  const grupos = {};
  for (const c of controles) {
    const g = (grupos[c[clave]] ||= { grupo: c[clave], CUMPLE: 0, PARCIAL: 0, 'NO CUMPLE': 0, 'NO EVALUABLE': 0, OMITIDA: 0, peso: 0, obtenido: 0 });
    g[c.estado]++;
    if (c.valor !== null) { g.peso += c.peso; g.obtenido += c.peso * c.valor; }
  }
  return Object.values(grupos).map((g) => ({ ...g, puntaje: g.peso ? Math.round((g.obtenido / g.peso) * 1000) / 10 : null }))
    .sort((a, b) => String(a.grupo).localeCompare(String(b.grupo)));
}

const ORDEN = { 'NO CUMPLE': 0, PARCIAL: 1, CUMPLE: 2 };

// Compara dos ejecuciones (a = anterior, b = posterior) control por control
function comparar(controlesA, controlesB, puntajeA, puntajeB) {
  const porIdA = Object.fromEntries(controlesA.map((c) => [c.controlId, c]));
  const filas = controlesB.map((b) => {
    const a = porIdA[b.controlId] || {};
    let cambio = 'igual';
    if (a.estado !== b.estado) {
      if (a.estado in ORDEN && b.estado in ORDEN) cambio = ORDEN[b.estado] > ORDEN[a.estado] ? 'mejoró' : 'empeoró';
      else cambio = 'distinto';
    }
    return { controlId: b.controlId, nombre: b.nombre, peso: b.peso, antes: a.estado || null, despues: b.estado, cambio };
  });
  return {
    filas,
    delta: puntajeA === null || puntajeB === null ? null : Math.round((puntajeB - puntajeA) * 10) / 10,
    mejoraron: filas.filter((f) => f.cambio === 'mejoró').length,
    empeoraron: filas.filter((f) => f.cambio === 'empeoró').length,
  };
}

module.exports = { VALOR, estadoControl, madurez, resumirControles, puntaje, prioridades, conteoEstados, agrupar, comparar, compararId };

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pt = require('../src/motor/puntaje');
const { CONTROLES, PORID } = require('../src/catalogo/controles');

// Construye resultados de prueba con un estado por control
function resultados(estados) {
  return Object.entries(estados).map(([controlId, estado]) => ({ pruebaId: controlId + '-1', controlId, estado, detalle: 'x' }));
}

test('pesos fijos según la tabla de riesgos (A5.16 corregido a 10)', () => {
  const esperado = {
    10: ['A8.2', 'A5.15', 'A5.18', 'A8.3', 'A5.16'],
    8: ['A5.17', 'A8.5', 'A8.24', 'A8.13', 'A8.12', 'A8.10', 'A8.11', 'A8.33', 'A5.12'],
    6: ['A8.20', 'A8.8', 'A8.15', 'A5.33'],
  };
  for (const [peso, ids] of Object.entries(esperado)) {
    for (const id of ids) assert.equal(PORID[id].peso, Number(peso), `peso de ${id}`);
  }
  assert.equal(CONTROLES.length, 18);
});

test('estado de un control resume sus pruebas e ignora NO EVALUABLE y OMITIDA', () => {
  const e = (lista) => pt.estadoControl(lista.map((estado) => ({ estado, pruebaId: 'p', detalle: 'd' }))).estado;
  assert.equal(e(['CUMPLE', 'CUMPLE']), 'CUMPLE');
  assert.equal(e(['CUMPLE', 'NO CUMPLE']), 'PARCIAL');
  assert.equal(e(['NO CUMPLE', 'NO CUMPLE']), 'NO CUMPLE');
  assert.equal(e(['PARCIAL']), 'PARCIAL');
  assert.equal(e(['CUMPLE', 'OMITIDA']), 'CUMPLE');
  assert.equal(e(['NO CUMPLE', 'NO EVALUABLE']), 'NO CUMPLE');
  assert.equal(e(['OMITIDA', 'OMITIDA']), 'OMITIDA');
  assert.equal(e(['NO EVALUABLE', 'OMITIDA']), 'NO EVALUABLE');
});

test('madurez 0–4', () => {
  assert.equal(pt.madurez('CUMPLE', []), 3);
  assert.equal(pt.madurez('PARCIAL', []), 2);
  assert.equal(pt.madurez('NO CUMPLE', [{ madurez: 0 }]), 0);
  assert.equal(pt.madurez('NO CUMPLE', [{ madurez: 1 }]), 1);
  assert.equal(pt.madurez('NO EVALUABLE', []), null);
});

test('puntaje: Σ(peso × valor) / Σ(pesos evaluados), sin NO EVALUABLE ni OMITIDA', () => {
  const controles = pt.resumirControles(resultados({
    'A8.2': 'CUMPLE', // 10 × 1
    'A5.17': 'PARCIAL', // 8 × 0,5
    'A8.20': 'NO CUMPLE', // 6 × 0
    'A8.13': 'NO EVALUABLE',
    'A8.33': 'OMITIDA',
  }));
  const r = pt.puntaje(controles.filter((c) => ['A8.2', 'A5.17', 'A8.20', 'A8.13', 'A8.33'].includes(c.controlId)));
  assert.equal(r.sumaPesos, 24);
  assert.equal(r.obtenido, 14);
  assert.equal(r.puntaje, 58.3);
});

test('puntaje sin controles evaluados es nulo', () => {
  assert.equal(pt.puntaje([{ peso: 8, valor: null }]).puntaje, null);
});

test('prioridades ordenadas por peso × brecha, luego peso y luego id', () => {
  const controles = pt.resumirControles(resultados({
    'A8.20': 'NO CUMPLE', // 6
    'A5.17': 'NO CUMPLE', // 8
    'A8.2': 'PARCIAL', // 5
    'A5.15': 'NO CUMPLE', // 10
    'A8.24': 'NO CUMPLE', // 8 (empata con A5.17; A5.17 < A8.24 por id)
    'A5.18': 'CUMPLE',
    'A8.8': 'PARCIAL', // 3
  })).filter((c) => c.estado !== 'NO EVALUABLE');
  const p = pt.prioridades(controles);
  assert.deepEqual(p.map((x) => x.controlId), ['A5.15', 'A5.17', 'A8.24', 'A8.20', 'A8.2', 'A8.8']);
  assert.deepEqual(p.map((x) => x.prioridad), [10, 8, 8, 6, 5, 3]);
  assert.equal(p[0].posicion, 1);
  assert.equal(p[0].riesgo, 'R-CONF-01');
  // impacto = peso × brecha / Σ pesos evaluados × 100
  const suma = pt.puntaje(controles).sumaPesos;
  assert.equal(p[0].impacto, Math.round((10 / suma) * 1000) / 10);
});

test('controles parciales se ordenan por peso × 0,5', () => {
  const controles = [
    { controlId: 'A8.24', nombre: '', peso: 8, estado: 'PARCIAL', valor: 0.5 }, // 4
    { controlId: 'A8.2', nombre: '', peso: 10, estado: 'PARCIAL', valor: 0.5 }, // 5
    { controlId: 'A5.33', nombre: '', peso: 6, estado: 'PARCIAL', valor: 0.5 }, // 3
  ];
  assert.deepEqual(pt.prioridades(controles).map((x) => x.controlId), ['A8.2', 'A8.24', 'A5.33']);
});

test('comparación de ejecuciones detecta mejoras y empeoramientos', () => {
  const a = [{ controlId: 'A8.2', nombre: '', peso: 10, estado: 'NO CUMPLE' }, { controlId: 'A8.20', nombre: '', peso: 6, estado: 'CUMPLE' },
    { controlId: 'A5.12', nombre: '', peso: 8, estado: 'PARCIAL' }];
  const b = [{ controlId: 'A8.2', nombre: '', peso: 10, estado: 'CUMPLE' }, { controlId: 'A8.20', nombre: '', peso: 6, estado: 'PARCIAL' },
    { controlId: 'A5.12', nombre: '', peso: 8, estado: 'PARCIAL' }];
  const c = pt.comparar(a, b, 20, 75.5);
  assert.equal(c.delta, 55.5);
  assert.equal(c.mejoraron, 1);
  assert.equal(c.empeoraron, 1);
  assert.equal(c.filas.find((f) => f.controlId === 'A5.12').cambio, 'igual');
});

test('orden natural de identificadores de control', () => {
  const ids = ['A8.10', 'A8.2', 'A5.33', 'A5.12', 'A8.33'];
  assert.deepEqual([...ids].sort(pt.compararId), ['A5.12', 'A5.33', 'A8.2', 'A8.10', 'A8.33']);
});

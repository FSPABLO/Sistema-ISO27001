'use strict';
// Genera docs/catalogo-controles.md a partir del catálogo del código (una sola fuente de verdad).
// Uso: node herramientas/generar-catalogo-md.js > docs/catalogo-controles.md
const { RIESGOS, TAREAS, CONTROLES, TODAS } = require('../src/catalogo');

const l = [];
const p = (s = '') => l.push(s);

p('# Catálogo de controles, pruebas y pesos');
p();
p('> Archivo generado con `node herramientas/generar-catalogo-md.js` desde `src/catalogo/`. No se edita a mano.');
p();
p('## Riesgos y pesos');
p();
p('| Riesgo | Descripción | P | I | Nivel | Peso que otorga |');
p('|---|---|---|---|---|---|');
for (const [id, r] of Object.entries(RIESGOS)) p(`| ${id} | ${r.nombre} | ${r.probabilidad} | ${r.impacto} | ${r.nivel} | ${Math.ceil(r.nivel / 2)} |`);
p();
p('**Peso del control** = ⌈ mayor nivel de los riesgos que mitiga ÷ 2 ⌉.');
p();
p('**Corrección documentada:** la tabla de pesos del enunciado ubica A5.16 en 8, pero en la tabla 2 del informe A5.16 pertenece a T02, cuyo riesgo es R-CONF-01 (nivel 20). Con la regla "cuenta el riesgo de mayor nivel", A5.16 tiene peso **10**. La corrección está en un solo lugar: `src/catalogo/controles.js`.');
p();
p('## Fórmulas');
p();
p('- **Estado de una prueba:** `CUMPLE`, `PARCIAL`, `NO CUMPLE`, `NO EVALUABLE` (no se pudo consultar; con motivo) u `OMITIDA` (falta configuración opcional).');
p('- **Estado del control:** promedio de sus pruebas evaluadas con 1 / 0,5 / 0. Promedio 1 → CUMPLE, 0 → NO CUMPLE, otro → PARCIAL. Sin pruebas evaluadas → NO EVALUABLE (u OMITIDA si todas se omitieron).');
p('- **Puntaje global** = Σ(peso × valor) ÷ Σ(pesos de los controles evaluados) × 100. NO EVALUABLE y OMITIDA no entran.');
p('- **Madurez (0–4):** NO CUMPLE = 0, o 1 si alguna prueba indica que algo está implementado; PARCIAL = 2; CUMPLE = 3. El 4 exige monitoreo continuo, que el sistema no mide.');
p('- **Prioridad** = peso × brecha (1 si no cumple, 0,5 si es parcial), de mayor a menor; desempate por peso y luego por identificador. **Impacto** = peso × brecha ÷ Σ pesos evaluados × 100 (puntos que sube el puntaje si el control pasa a cumplir).');
p();
p('## Tareas del DBA');
p();
p('| Tarea | Nombre | Controles |');
p('|---|---|---|');
for (const [id, n] of Object.entries(TAREAS)) p(`| ${id} | ${n} | ${CONTROLES.filter((c) => c.tarea === id).map((c) => c.id).join(', ') || '—'} |`);
p();
p('## Controles');
p();
p('| Control | Nombre | Tema | Tarea | Riesgos | Peso | Pruebas |');
p('|---|---|---|---|---|---|---|');
for (const c of CONTROLES) p(`| ${c.id}${c.adicional ? ' *' : ''} | ${c.nombre} | ${c.tema} | ${c.tarea} | ${c.riesgos.join(', ')} | ${c.peso} | ${c.pruebas.join(', ')} |`);
p();
p('\\* Controles adicionales a los 15 de la asignación.');
p();
p('## Pruebas');
for (const c of CONTROLES) {
  p();
  p(`### ${c.id} · ${c.nombre} (peso ${c.peso})`);
  for (const t of TODAS.filter((x) => x.controlId === c.id)) {
    p();
    p(`#### ${t.id} · ${t.nombre}`);
    p();
    p(`- **Tipo:** ${t.tipo === 'funcional' ? 'funcional (opcional)' : 'diccionario de datos'}${t.heuristica ? ' · heurística, requiere revisión humana' : ''}${t.requiereOpcion ? ` · requiere la opción "${t.requiereOpcion}" en V$OPTION` : ''}`);
    p(`- **Fuente:** ${t.fuente}`);
    p(`- **Qué comprueba:** ${t.descripcion}`);
    p(`- **Esperado:** ${t.esperado}`);
    if (t.binds) p(`- **Variables de enlace:** ${Object.entries(t.binds).map(([k, v]) => `\`:${k}\` = ${String(v).length > 40 ? '(patrón de nombres sensibles)' : v}`).join(', ')}`);
    p();
    p('```sql');
    p(t.sql || t.sqlPlantilla);
    p('```');
    p();
    p(`**Recomendación si no cumple:**`);
    p();
    p('```');
    p(t.recomendacion);
    p('```');
  }
}
process.stdout.write(l.join('\n') + '\n');

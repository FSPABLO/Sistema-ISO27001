'use strict';
// Pruebas funcionales opcionales: se conectan como usuarios de prueba (claves solo en memoria) y
// comprueban el comportamiento real de redacción, VPD y denegación de acceso, y comparan el clon.
// Los nombres de esquema, tabla y columna los ingresa el analista: se validan con
// ^[A-Z][A-Z0-9_$#]{0,29}$ y se entrecomillan (citar). Ningún valor real de producción se guarda en
// la evidencia: la cuenta de referencia solo devuelve IGUAL/DISTINTO, conteos o hashes con sal aleatoria.
const crypto = require('node:crypto');
const { citar, validarIdentificador } = require('../motor/seguridadSql');

const MAX_FILAS_CLON = 5000;

const SIN_ACCESO = /ORA-00942|ORA-01031|ORA-41900/;

function tablaCompleta(esquema, tabla) {
  return `${citar(esquema, 'Esquema')}.${citar(tabla, 'Tabla')}`;
}

// Valida y normaliza la configuración funcional; lanza ErrorSeguridadSql si un identificador no es válido.
function normalizarConfiguracion(cfg = {}) {
  const t = cfg.tabla || {};
  const c = cfg.clon || {};
  const out = {
    tabla: t.tabla ? {
      esquema: validarIdentificador(t.esquema, 'Esquema'),
      tabla: validarIdentificador(t.tabla, 'Tabla'),
      clave: validarIdentificador(t.clave, 'Columna clave'),
      columnasSensibles: (t.columnasSensibles || []).filter(Boolean).map((x) => validarIdentificador(x, 'Columna sensible')),
      columnaSegmento: t.columnaSegmento ? validarIdentificador(t.columnaSegmento, 'Columna de segmentación') : null,
    } : null,
    clon: c.tabla ? {
      esquema: validarIdentificador(c.esquema, 'Esquema del clon'),
      tabla: validarIdentificador(c.tabla, 'Tabla del clon'),
      clave: validarIdentificador(c.clave, 'Columna clave del clon'),
      columnas: (c.columnas || []).filter(Boolean).map((x) => validarIdentificador(x, 'Columna del clon')),
    } : null,
    cuentas: {},
  };
  for (const [rol, cta] of Object.entries(cfg.cuentas || {})) {
    if (cta && cta.usuario) out.cuentas[rol] = { usuario: validarIdentificador(cta.usuario, `Usuario (${rol})`), clave: cta.clave || '' };
  }
  return out;
}

function faltan(cfg, requisitos) {
  const f = [];
  for (const r of requisitos) {
    if (r === 'tabla' && !cfg.tabla) f.push('la tabla de producción');
    else if (r === 'sensibles' && !(cfg.tabla && cfg.tabla.columnasSensibles.length)) f.push('las columnas sensibles');
    else if (r === 'clon' && !(cfg.clon && cfg.clon.columnas.length)) f.push('la tabla del clon y sus columnas');
    else if (r.startsWith('cuenta:')) {
      const rol = r.slice(7);
      const cta = cfg.cuentas[rol];
      if (!cta || !cta.usuario || !cta.clave) f.push(`el usuario y la clave de "${ETIQUETAS_CUENTA[rol]}"`);
    }
  }
  return f.length ? `Falta configurar ${f.join(', ')}.` : null;
}

const ETIQUETAS_CUENTA = {
  referencia: 'Cuenta de referencia (dueño de los datos)',
  redaccion: 'Usuario que debe ver datos redactados',
  vpd: 'Usuario restringido por filas (VPD)',
  sinAcceso1: 'Usuario sin acceso al detalle (1)',
  sinAcceso2: 'Usuario sin acceso al detalle (2)',
  comparacion: 'Cuenta que lee el clon (p. ej. su dueño)',
};

const FUNCIONALES = [
  {
    id: 'PB-05b', controlId: 'A8.11', fuente: 'V05 (PB-05b)',
    nombre: 'Prueba funcional: el usuario ve los datos redactados',
    descripcion: 'Consulta una fila como el usuario de atención y, con la cuenta de referencia, compara cada valor visto con el real sin mostrarlo (IGUAL / DISTINTO).',
    requisitos: ['tabla', 'sensibles', 'cuenta:redaccion', 'cuenta:referencia'],
    sqlPlantilla: 'SELECT <clave>, <columnas sensibles> FROM <esquema>.<tabla> ORDER BY <clave> FETCH FIRST 1 ROWS ONLY\n-- y como referencia: SELECT CASE WHEN <columna> = :valor_visto THEN \'IGUAL\' ELSE \'DISTINTO\' END ...',
    esperado: 'Todas las columnas sensibles DISTINTO del valor real (redactadas).',
    async ejecutar(correr, cfg) {
      const t = cfg.tabla;
      const cols = t.columnasSensibles;
      const sqlVisto = `SELECT ${citar(t.clave)}, ${cols.map((c) => citar(c)).join(', ')}
  FROM ${tablaCompleta(t.esquema, t.tabla)}
 ORDER BY ${citar(t.clave)}
 FETCH FIRST 1 ROWS ONLY`;
      const visto = await correr('redaccion', sqlVisto);
      if (visto.error) return sinAccesoONoEvaluable(visto, cfg.cuentas.redaccion.usuario, 'no se puede probar la redacción');
      if (!visto.filas.length) return { estado: 'NO EVALUABLE', detalle: `${cfg.cuentas.redaccion.usuario} no ve ninguna fila de la tabla.` };
      const fila = visto.filas[0];
      const binds = { k: fila[0] };
      cols.forEach((c, i) => { binds['v' + (i + 1)] = fila[i + 1]; });
      const sqlRef = `SELECT ${citar(t.clave)},
${cols.map((c, i) => `       CASE WHEN ${citar(c)} = :v${i + 1} THEN 'IGUAL' ELSE 'DISTINTO' END ${citar(c)}`).join(',\n')}
  FROM ${tablaCompleta(t.esquema, t.tabla)}
 WHERE ${citar(t.clave)} = :k`;
      const ref = await correr('referencia', sqlRef, binds);
      if (ref.error) return { estado: 'NO EVALUABLE', detalle: `La cuenta de referencia no pudo leer la tabla: ${ref.error}` };
      if (!ref.filas.length) return { estado: 'NO EVALUABLE', detalle: 'La cuenta de referencia no encontró la fila para comparar.' };
      const iguales = cols.filter((c, i) => ref.filas[0][i + 1] === 'IGUAL');
      const vistos = cols.map((c, i) => `${c}=${fila[i + 1] === null ? 'NULL' : fila[i + 1]}`).join(', ');
      const quien = cfg.cuentas.redaccion.usuario;
      if (!iguales.length) return { estado: 'CUMPLE', detalle: `${quien} ve ${vistos}: ningún valor coincide con el real.` };
      const estado = iguales.length === cols.length ? 'NO CUMPLE' : 'PARCIAL';
      return { estado, detalle: `${quien} ve el valor real en ${iguales.length} de ${cols.length} columnas (${iguales.join(', ')}).` };
    },
    explicacionCumple: 'El usuario sin privilegio recibe los datos sensibles redactados en una consulta real.',
    explicacionNoCumple: 'El usuario de atención obtiene los valores reales de las columnas sensibles.',
    recomendacion: 'Crear o corregir la política de Data Redaction de la tabla (ver A8.11-1).\nScript del laboratorio: ./ejecutar.sh implementacion I05',
  },
  {
    id: 'PB-06b', controlId: 'A8.3', fuente: 'V06 (PB-06b)',
    nombre: 'Prueba funcional: el usuario restringido ve solo sus filas',
    descripcion: 'Cuenta filas (y valores distintos de la columna de segmentación) como el usuario restringido y como la cuenta de referencia.',
    requisitos: ['tabla', 'cuenta:vpd', 'cuenta:referencia'],
    sqlPlantilla: 'SELECT COUNT(*) filas, COUNT(DISTINCT <columna de segmentación>) valores FROM <esquema>.<tabla>',
    esperado: 'El usuario restringido ve menos filas que la cuenta de referencia.',
    async ejecutar(correr, cfg) {
      const t = cfg.tabla;
      const seg = t.columnaSegmento ? `, COUNT(DISTINCT ${citar(t.columnaSegmento)}) valores` : '';
      const sql = `SELECT COUNT(*) filas${seg}\n  FROM ${tablaCompleta(t.esquema, t.tabla)}`;
      const r = await correr('vpd', sql);
      if (r.error) return sinAccesoONoEvaluable(r, cfg.cuentas.vpd.usuario, 'no se puede medir el filtro por fila');
      const ref = await correr('referencia', sql);
      if (ref.error) return { estado: 'NO EVALUABLE', detalle: `La cuenta de referencia no pudo contar las filas: ${ref.error}` };
      const [filas, valores] = r.filas[0];
      const [total, totalValores] = ref.filas[0];
      const quien = cfg.cuentas.vpd.usuario;
      const segTxt = t.columnaSegmento ? ` en ${valores} de ${totalValores} valor(es) de ${t.columnaSegmento}` : '';
      if (filas < total) return { estado: 'CUMPLE', detalle: `${quien} ve ${filas} de ${total} filas${segTxt}.` };
      return { estado: 'NO CUMPLE', detalle: `${quien} ve las ${filas} filas de ${total}${segTxt}: no hay filtro por fila.` };
    },
    explicacionCumple: 'La política VPD filtra las filas en una consulta real del usuario restringido.',
    explicacionNoCumple: 'El usuario restringido ve todas las filas de la tabla.',
    recomendacion: 'Crear o corregir la política VPD de la tabla (ver A8.3-1).\nScript del laboratorio: ./ejecutar.sh implementacion I06',
  },
  {
    id: 'PB-12a', controlId: 'A5.15', fuente: 'V12 (PB-12a)',
    nombre: 'Prueba funcional: usuario sin acceso al detalle (1)',
    descripcion: 'Intenta leer la tabla de detalle como un usuario que no debería tener acceso.',
    requisitos: ['tabla', 'cuenta:sinAcceso1'],
    sqlPlantilla: 'SELECT COUNT(*) filas FROM <esquema>.<tabla>',
    esperado: 'ORA-00942 u ORA-01031: acceso denegado.',
    async ejecutar(correr, cfg) { return probarDenegado(correr, cfg, 'sinAcceso1'); },
    explicacionCumple: 'El usuario no autorizado no puede leer el detalle de la tabla.',
    explicacionNoCumple: 'Un usuario que no debería ver el detalle logró leer la tabla.',
    recomendacion: 'Revocar privilegios ANY y permisos directos, y dar a este usuario solo las vistas que necesita (A8.2-1, A5.15-1).\nScript del laboratorio: ./ejecutar.sh implementacion I03',
  },
  {
    id: 'PB-12b', controlId: 'A5.15', fuente: 'V12 (PB-12b)',
    nombre: 'Prueba funcional: usuario sin acceso al detalle (2)',
    descripcion: 'Intenta leer la tabla de detalle como un segundo usuario no autorizado (p. ej. el esquema de desarrollo).',
    requisitos: ['tabla', 'cuenta:sinAcceso2'],
    sqlPlantilla: 'SELECT COUNT(*) filas FROM <esquema>.<tabla>',
    esperado: 'ORA-00942 u ORA-01031: acceso denegado.',
    async ejecutar(correr, cfg) { return probarDenegado(correr, cfg, 'sinAcceso2'); },
    explicacionCumple: 'El usuario no autorizado no puede leer el detalle de la tabla.',
    explicacionNoCumple: 'Un usuario que no debería ver el detalle logró leer la tabla.',
    recomendacion: 'Revocar el permiso residual (p. ej. el que quedó del clonado):\n  REVOKE SELECT ON segconf.clientes FROM segconf_dev;\nScript del laboratorio: ./ejecutar.sh implementacion I03',
  },
  {
    id: 'PB-10', controlId: 'A8.33', fuente: 'V10 (PB-10)',
    nombre: 'Prueba funcional: el clon no contiene datos reales',
    descripcion: 'La cuenta de referencia (dueña de producción) y la cuenta del clon calculan un hash con sal aleatoria de cada columna sensible; '
      + 'el sistema empareja las filas por la clave y cuenta las que tienen algún dato idéntico. No se leen ni se guardan valores reales, '
      + 'y la sal solo existe en memoria durante la prueba.',
    requisitos: ['tabla', 'clon', 'cuenta:referencia', 'cuenta:comparacion'],
    sqlPlantilla: "SELECT <clave>, STANDARD_HASH(:sal || TO_CHAR(<columna>), 'SHA256') ... FROM <tabla> ORDER BY <clave> FETCH FIRST 5000 ROWS ONLY\n-- en producción (cuenta de referencia) y en el clon",
    esperado: 'Ninguna fila emparejada del clon con un dato idéntico a producción.',
    async ejecutar(correr, cfg) {
      const t = cfg.tabla;
      const c = cfg.clon;
      const cols = c.columnas;
      const sal = crypto.randomBytes(16).toString('hex');
      const consulta = (esquema, tabla, clave) => `SELECT ${citar(clave)} clave,
${cols.map((x, i) => `       STANDARD_HASH(:sal || TO_CHAR(${citar(x)}), 'SHA256') h${i + 1}`).join(',\n')}
  FROM ${tablaCompleta(esquema, tabla)}
 ORDER BY ${citar(clave)}
 FETCH FIRST ${MAX_FILAS_CLON} ROWS ONLY`;
      const prod = await correr('referencia', consulta(t.esquema, t.tabla, t.clave), { sal }, { maxFilas: MAX_FILAS_CLON });
      if (prod.error) return { estado: 'NO EVALUABLE', detalle: `La cuenta de referencia no pudo leer producción: ${prod.error}` };
      const clon = await correr('comparacion', consulta(c.esquema, c.tabla, c.clave), { sal }, { maxFilas: MAX_FILAS_CLON });
      if (clon.error) return { estado: 'NO EVALUABLE', detalle: `La cuenta del clon no pudo leer ${c.esquema}.${c.tabla}: ${clon.error}` };
      if (!clon.filas.length) return { estado: 'NO EVALUABLE', detalle: 'El clon está vacío.' };
      const porClave = new Map(prod.filas.map((f) => [String(f[0]), f]));
      let emparejadas = 0; let identicas = 0;
      const porCol = cols.map(() => 0);
      for (const f of clon.filas) {
        const p = porClave.get(String(f[0]));
        if (!p) continue;
        emparejadas++;
        let alguna = false;
        cols.forEach((x, i) => { if (f[i + 1] !== null && f[i + 1] === p[i + 1]) { porCol[i]++; alguna = true; } });
        if (alguna) identicas++;
      }
      const total = clon.filas.length;
      if (!emparejadas) {
        return { estado: 'NO EVALUABLE', detalle: `Ninguna de las ${total} filas del clon se pudo emparejar con producción por ${t.clave} (${prod.filas.length} filas visibles en producción). `
          + 'Revise la clave o si la cuenta de referencia ve las filas reales (VPD).' };
      }
      const detalleCols = cols.map((x, i) => `${x}=${porCol[i]}`).join(', ');
      if (!identicas) return { estado: 'CUMPLE', detalle: `0 de ${emparejadas} filas emparejadas del clon tienen datos idénticos a producción (${total} filas en el clon). Coincidencias por columna: ${detalleCols}.` };
      return { estado: 'NO CUMPLE', detalle: `${identicas} de ${emparejadas} filas emparejadas del clon tienen algún dato idéntico a producción. Coincidencias por columna: ${detalleCols}.` };
    },
    explicacionCumple: 'El entorno de desarrollo usa datos enmascarados o ficticios.',
    explicacionNoCumple: 'El clon de desarrollo contiene datos personales reales, accesibles con menos controles.',
    recomendacion: 'Enmascarar el clon de forma irreversible antes de entregarlo a desarrollo:\n  UPDATE segconf_dev.clientes SET cedula = \'9-\' || LPAD(id_cliente, 4, \'0\') || ..., email = \'cliente\' || id_cliente || \'@ejemplo.invalid\', ...;\nScript del laboratorio: ./ejecutar.sh implementacion I10',
  },
];

// Si el usuario ni siquiera puede leer la tabla, la redacción o el filtro por fila no se pueden medir
function sinAccesoONoEvaluable(r, usuario, motivo) {
  if (SIN_ACCESO.test(r.error)) {
    return { estado: 'NO EVALUABLE', detalle: `${usuario} no tiene acceso a la tabla (${r.error.split('\n')[0]}): ${motivo}.` };
  }
  return { estado: 'NO EVALUABLE', detalle: `${usuario}: ${r.error.split('\n')[0]}` };
}

async function probarDenegado(correr, cfg, rol) {
  const t = cfg.tabla;
  const usuario = cfg.cuentas[rol].usuario;
  const r = await correr(rol, `SELECT COUNT(*) filas\n  FROM ${tablaCompleta(t.esquema, t.tabla)}`);
  if (r.error && SIN_ACCESO.test(r.error)) return { estado: 'CUMPLE', detalle: `${usuario}: acceso DENEGADO (${r.error.split('\n')[0]}).` };
  if (r.error) return { estado: 'NO EVALUABLE', detalle: `${usuario}: ${r.error.split('\n')[0]}` };
  return { estado: 'NO CUMPLE', detalle: `${usuario} LEYÓ ${r.filas[0][0]} filas de ${t.esquema}.${t.tabla}.` };
}

for (const f of FUNCIONALES) {
  f.tipo = 'funcional';
  f.comandoEquivalente = 'sqlplus {usuario}/********@//{host}:{puerto}/{servicio}';
}

module.exports = { FUNCIONALES, ETIQUETAS_CUENTA, normalizarConfiguracion, faltan };

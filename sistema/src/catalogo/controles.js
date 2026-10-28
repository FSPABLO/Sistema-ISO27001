'use strict';
// Controles ISO/IEC 27001:2022, riesgos R-CONF, tareas del DBA y pesos fijos.
// Fuente: tablas 1, 2 y 3 del informe "Controles ISO/IEC 27001:2022 para la confidencialidad
// en la administración de bases de datos Oracle". Los pesos no se pueden editar desde la interfaz.

const RIESGOS = {
  'R-CONF-01': { nombre: 'Privilegios excesivos y acceso no autorizado a datos sensibles', probabilidad: 4, impacto: 5 },
  'R-CONF-02': { nombre: 'Autenticación débil y cuentas por defecto', probabilidad: 4, impacto: 4 },
  'R-CONF-03': { nombre: 'Exposición de datos fuera de la base de datos', probabilidad: 3, impacto: 5 },
  'R-CONF-04': { nombre: 'Datos reales en entornos DEV/TEST', probabilidad: 4, impacto: 4 },
  'R-CONF-05': { nombre: 'Exposición en red y vulnerabilidades sin parchear', probabilidad: 3, impacto: 4 },
  'R-CONF-06': { nombre: 'Falta de trazabilidad y logs sin protección', probabilidad: 3, impacto: 4 },
};
for (const r of Object.values(RIESGOS)) r.nivel = r.probabilidad * r.impacto;

const TAREAS = {
  T01: 'Clasificación de datos sensibles',
  T02: 'Gestión de usuarios y roles',
  T03: 'Privilegios y mínimo privilegio',
  T04: 'Autenticación y perfiles de contraseña',
  T05: 'Cifrado en reposo (TDE)',
  T06: 'Enmascaramiento y redacción de datos',
  T07: 'Respaldos cifrados',
  T08: 'Auditoría de la base de datos',
  T09: 'Protección y retención de logs',
  T10: 'Parcheo y gestión de vulnerabilidades',
  T11: 'Seguridad del listener y la red',
  T12: 'Eliminación segura de datos',
  T13: 'Clones DEV/TEST',
  T14: 'Prevención de fuga de datos (DLP)',
};

// Cada control se asocia a una tarea principal del DBA (tabla 2 del informe) y a sus riesgos.
const CONTROLES = [
  { id: 'A5.12', nombre: 'Clasificación de la información', tema: 'Organizacional', tarea: 'T01', riesgos: ['R-CONF-03', 'R-CONF-04'] },
  { id: 'A5.15', nombre: 'Control de acceso', tema: 'Organizacional', tarea: 'T03', riesgos: ['R-CONF-01'] },
  // CORRECCIÓN DE PESO (única, documentada): la tabla de pesos del enunciado pone A5.16 en 8 (R-CONF-02),
  // pero en la tabla 2 del informe A5.16 pertenece a T02, cuyo riesgo es R-CONF-01 (nivel 20). Como un
  // control que mitiga varios riesgos cuenta el de mayor nivel, A5.16 queda con peso ceil(20/2) = 10.
  { id: 'A5.16', nombre: 'Gestión de identidades', tema: 'Organizacional', tarea: 'T02', riesgos: ['R-CONF-01', 'R-CONF-02'] },
  { id: 'A5.17', nombre: 'Información de autenticación', tema: 'Organizacional', tarea: 'T04', riesgos: ['R-CONF-02'] },
  { id: 'A5.18', nombre: 'Derechos de acceso', tema: 'Organizacional', tarea: 'T02', riesgos: ['R-CONF-01', 'R-CONF-02'] },
  { id: 'A5.33', nombre: 'Protección de los registros', tema: 'Organizacional', tarea: 'T09', riesgos: ['R-CONF-06'] },
  { id: 'A8.2', nombre: 'Derechos de acceso privilegiado', tema: 'Tecnológico', tarea: 'T03', riesgos: ['R-CONF-01'] },
  { id: 'A8.3', nombre: 'Restricción del acceso a la información', tema: 'Tecnológico', tarea: 'T03', riesgos: ['R-CONF-01'] },
  { id: 'A8.5', nombre: 'Autenticación segura', tema: 'Tecnológico', tarea: 'T04', riesgos: ['R-CONF-02'] },
  { id: 'A8.8', nombre: 'Gestión de vulnerabilidades técnicas', tema: 'Tecnológico', tarea: 'T10', riesgos: ['R-CONF-05'], adicional: true },
  { id: 'A8.10', nombre: 'Eliminación de información', tema: 'Tecnológico', tarea: 'T12', riesgos: ['R-CONF-03'] },
  { id: 'A8.11', nombre: 'Enmascaramiento de datos', tema: 'Tecnológico', tarea: 'T06', riesgos: ['R-CONF-03', 'R-CONF-04'] },
  { id: 'A8.12', nombre: 'Prevención de fuga de datos', tema: 'Tecnológico', tarea: 'T14', riesgos: ['R-CONF-03'] },
  { id: 'A8.13', nombre: 'Respaldo de la información', tema: 'Tecnológico', tarea: 'T07', riesgos: ['R-CONF-03'] },
  { id: 'A8.15', nombre: 'Registro de eventos', tema: 'Tecnológico', tarea: 'T08', riesgos: ['R-CONF-06'] },
  { id: 'A8.20', nombre: 'Seguridad de redes', tema: 'Tecnológico', tarea: 'T11', riesgos: ['R-CONF-05'] },
  { id: 'A8.24', nombre: 'Uso de criptografía', tema: 'Tecnológico', tarea: 'T05', riesgos: ['R-CONF-03'], adicional: true },
  { id: 'A8.33', nombre: 'Información de prueba', tema: 'Tecnológico', tarea: 'T13', riesgos: ['R-CONF-04'], adicional: true },
];

// Peso = entero hacia arriba de la mitad del mayor nivel de riesgo que mitiga el control (20→10, 16 y 15→8, 12→6)
function calcularPeso(control) {
  const mayor = Math.max(...control.riesgos.map((r) => RIESGOS[r].nivel));
  return Math.ceil(mayor / 2);
}

function riesgoPrincipal(control) {
  return [...control.riesgos].sort((a, b) => RIESGOS[b].nivel - RIESGOS[a].nivel)[0];
}

for (const c of CONTROLES) {
  c.peso = calcularPeso(c);
  c.riesgoPrincipal = riesgoPrincipal(c);
  c.tareaNombre = TAREAS[c.tarea];
}

const PORID = Object.fromEntries(CONTROLES.map((c) => [c.id, c]));

module.exports = { RIESGOS, TAREAS, CONTROLES, PORID, calcularPeso };

'use strict';
// Perfiles predefinidos para las pruebas funcionales. Solo rellenan nombres: las claves de los
// usuarios de prueba se escriben en cada ejecución y nunca se guardan.
const PERFILES = [
  {
    id: 'laboratorio-segconf',
    nombre: 'Laboratorio SEGCONF',
    descripcion: 'Datos ficticios del laboratorio del curso: SEGCONF.CLIENTES y su clon SEGCONF_DEV.CLIENTES.',
    tabla: {
      esquema: 'SEGCONF', tabla: 'CLIENTES', clave: 'ID_CLIENTE',
      columnasSensibles: ['TARJETA', 'EMAIL', 'SALARIO'], columnaSegmento: 'PROVINCIA',
    },
    clon: {
      esquema: 'SEGCONF_DEV', tabla: 'CLIENTES', clave: 'ID_CLIENTE',
      columnas: ['CEDULA', 'NOMBRE', 'EMAIL', 'TELEFONO', 'TARJETA', 'SALARIO'],
    },
    cuentas: {
      referencia: 'SEGCONF',
      redaccion: 'APP_CONSULTA',
      vpd: 'APP_SOPORTE',
      sinAcceso1: 'APP_REPORTES',
      sinAcceso2: 'SEGCONF_DEV',
      comparacion: 'SEGCONF_DEV',
    },
  },
];

module.exports = { PERFILES };

'use strict';
// Registro de conectores por motor. Para agregar otro motor: implementar Conector y registrarlo aquí.
const OracleConector = require('./OracleConector');

const MOTORES = {
  oracle: { nombre: 'Oracle Database', clase: OracleConector, puertoPorDefecto: 1521 },
};

function crearFabricaConectores(config) {
  return function crear(motor = 'oracle') {
    const m = MOTORES[motor];
    if (!m) throw new Error(`Motor no soportado: ${motor}`);
    return new m.clase({ libDir: config.oracleLibDir, timeoutConexionS: config.timeoutConexionS });
  };
}

module.exports = { MOTORES, crearFabricaConectores };

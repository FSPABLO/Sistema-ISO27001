'use strict';
// Interfaz de un conector de base de datos. Las pruebas solo usan estos métodos y nunca el
// controlador del motor directamente, para poder agregar otros motores después.
class Conector {
  /** Nombre del motor, p. ej. 'oracle' */
  static get motor() { throw new Error('No implementado'); }

  /** @param {{host:string, puerto:number, servicio:string, usuario:string, clave:string}} datos */
  async abrir(datos) { throw new Error('No implementado'); } // eslint-disable-line no-unused-vars

  /**
   * Ejecuta una consulta de solo lectura.
   * @returns {Promise<{columnas:string[], filas:any[][]}>}
   */
  async consultar(sql, binds = {}, opciones = {}) { throw new Error('No implementado'); } // eslint-disable-line no-unused-vars

  /** Datos del servidor: versión, contenedor, canal cifrado, usuario de sesión */
  async informacion() { throw new Error('No implementado'); }

  /** Texto del comando de cliente equivalente, con la clave oculta */
  comandoEquivalente() { throw new Error('No implementado'); }

  async cerrar() {}
}

// Convierte filas de arreglos en objetos {COLUMNA: valor} para los evaluadores
function comoObjetos({ columnas, filas }) {
  return filas.map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i]])));
}

module.exports = { Conector, comoObjetos };

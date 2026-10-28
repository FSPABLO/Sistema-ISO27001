-- V10_clon.sql - PB-10: el clon de desarrollo no contiene datos reales de produccion (A.8.11, A.8.33)
@comun/inicio.sql
PROMPT === V10 Enmascaramiento del clon SEGCONF_DEV ===
SELECT d.id_cliente, d.cedula, d.nombre, d.email, d.tarjeta, d.salario FROM segconf_dev.clientes d WHERE d.id_cliente <= 3 ORDER BY 1;
DECLARE
  v_n NUMBER; v_tot NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_tot FROM segconf_dev.clientes;
  SELECT COUNT(*) INTO v_n
    FROM segconf_dev.clientes d JOIN segconf.clientes p ON p.id_cliente = d.id_cliente
   WHERE d.cedula = p.cedula OR d.nombre = p.nombre OR d.email = p.email
      OR d.telefono = p.telefono OR d.tarjeta = p.tarjeta OR d.salario = p.salario;
  segconf.pkg_verif.linea('PB-10', v_tot > 0 AND v_n = 0,
    'Filas del clon con algun dato personal identico a produccion: ' || v_n || ' de ' || v_tot);
END;
/
@comun/fin.sql

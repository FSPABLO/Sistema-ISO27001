-- V12_acceso_integral.sql - PB-12: prueba funcional de acceso no autorizado (A.5.15, A.8.3)
@comun/inicio.sql
PROMPT === V12 Acceso no autorizado a SEGCONF.CLIENTES ===
VARIABLE v_rep VARCHAR2(300)
VARIABLE v_res VARCHAR2(300)
VARIABLE v_dev VARCHAR2(300)
PROMPT -- APP_REPORTES intenta leer el detalle y luego la vista agregada
CONNECT app_reportes/"&PWD_REPORTES"@&CON_PDB
DECLARE n NUMBER;
BEGIN
  BEGIN
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM segconf.clientes' INTO n;
    :v_rep := 'LEYO ' || n || ' filas';
  EXCEPTION WHEN OTHERS THEN :v_rep := 'DENEGADO ' || SQLERRM;
  END;
  BEGIN
    EXECUTE IMMEDIATE 'SELECT SUM(total_clientes) FROM segconf.v_clientes_resumen' INTO n;
    :v_res := 'LEYO resumen de ' || n || ' clientes';
  EXCEPTION WHEN OTHERS THEN :v_res := 'DENEGADO ' || SQLERRM;
  END;
END;
/
PROMPT -- SEGCONF_DEV intenta leer produccion
CONNECT segconf_dev/"&PWD_DEV"@&CON_PDB
DECLARE n NUMBER;
BEGIN
  EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM segconf.clientes' INTO n;
  :v_dev := 'LEYO ' || n || ' filas';
EXCEPTION WHEN OTHERS THEN :v_dev := 'DENEGADO ' || SQLERRM;
END;
/
PRINT v_rep v_res v_dev
@comun/volver_sys.sql
BEGIN
  segconf.pkg_verif.linea('PB-12a', :v_rep LIKE 'DENEGADO%', 'APP_REPORTES sobre el detalle de CLIENTES: ' || :v_rep);
  segconf.pkg_verif.linea('PB-12b', :v_dev LIKE 'DENEGADO%', 'SEGCONF_DEV sobre SEGCONF.CLIENTES: ' || :v_dev);
END;
/
PROMPT Informativo (no es prueba): APP_REPORTES sobre V_CLIENTES_RESUMEN
PRINT v_res
@comun/fin.sql

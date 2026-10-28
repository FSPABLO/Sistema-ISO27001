-- V06_vpd.sql - PB-06: control de acceso por fila con VPD (A.8.3)
@comun/inicio.sql
PROMPT === V06 Virtual Private Database ===
COLUMN object_name FORMAT A12
COLUMN policy_name FORMAT A20
COLUMN function FORMAT A20
SELECT object_name, policy_name, package || '.' || function function, sel, enable FROM dba_policies WHERE object_owner = 'SEGCONF';
VARIABLE v_filas NUMBER
VARIABLE v_prov  NUMBER
VARIABLE v_error VARCHAR2(300)
PROMPT -- Consulta como APP_SOPORTE (autorizado solo para HEREDIA)
CONNECT app_soporte/"&PWD_SOPORTE"@&CON_PDB
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT provincia) INTO :v_filas, :v_prov FROM segconf.clientes;
EXCEPTION WHEN OTHERS THEN :v_error := SQLERRM;
END;
/
PRINT v_filas v_prov v_error
@comun/volver_sys.sql
DECLARE
  v_pol NUMBER; v_esperadas NUMBER;
BEGIN
  IF NOT segconf.pkg_verif.opcion('Fine-grained access control') THEN
    segconf.pkg_verif.no_dispon('PB-06', 'V$OPTION: Fine-grained access control = FALSE');
    RETURN;
  END IF;
  SELECT COUNT(*) INTO v_pol FROM dba_policies
   WHERE object_owner = 'SEGCONF' AND object_name = 'CLIENTES' AND enable = 'YES';
  segconf.pkg_verif.linea('PB-06a', v_pol > 0, 'Politicas VPD habilitadas sobre SEGCONF.CLIENTES: ' || v_pol);
  SELECT COUNT(*) INTO v_esperadas FROM segconf.clientes WHERE provincia = 'HEREDIA';
  IF :v_error IS NOT NULL THEN
    segconf.pkg_verif.linea('PB-06b', FALSE, 'APP_SOPORTE no pudo consultar: ' || :v_error);
  ELSE
    segconf.pkg_verif.linea('PB-06b', :v_filas = v_esperadas AND :v_prov = 1,
      'APP_SOPORTE ve ' || :v_filas || ' de 60 filas en ' || :v_prov || ' provincia(s); esperado ' || v_esperadas || ' en 1 (HEREDIA)');
  END IF;
END;
/
@comun/fin.sql

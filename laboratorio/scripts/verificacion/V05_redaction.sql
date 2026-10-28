-- V05_redaction.sql - PB-05: Data Redaction / enmascaramiento en consulta (A.8.11)
@comun/inicio.sql
PROMPT === V05 Data Redaction ===
COLUMN object_name FORMAT A12
COLUMN policy_name FORMAT A20
COLUMN column_name FORMAT A12
COLUMN function_type FORMAT A22
SELECT object_name, policy_name, enable FROM redaction_policies WHERE object_owner = 'SEGCONF';
SELECT object_name, column_name, function_type FROM redaction_columns WHERE object_owner = 'SEGCONF' ORDER BY 2;
VARIABLE v_tarjeta VARCHAR2(40)
VARIABLE v_email   VARCHAR2(100)
VARIABLE v_salario NUMBER
VARIABLE v_error   VARCHAR2(300)
PROMPT -- Consulta como APP_CONSULTA (rol de atencion al cliente)
CONNECT app_consulta/"&PWD_CONSULTA"@&CON_PDB
BEGIN
  SELECT tarjeta, email, salario INTO :v_tarjeta, :v_email, :v_salario
    FROM segconf.clientes WHERE id_cliente = 1;
EXCEPTION WHEN OTHERS THEN :v_error := SQLERRM;
END;
/
PRINT v_tarjeta v_email v_salario v_error
@comun/volver_sys.sql
DECLARE
  v_pol NUMBER; r segconf.clientes%ROWTYPE;
BEGIN
  IF NOT segconf.pkg_verif.opcion('Data Redaction') THEN
    segconf.pkg_verif.no_dispon('PB-05', 'V$OPTION: Data Redaction = FALSE');
    RETURN;
  END IF;
  SELECT COUNT(*) INTO v_pol FROM redaction_policies
   WHERE object_owner = 'SEGCONF' AND object_name = 'CLIENTES' AND TRIM(enable) = 'YES';
  segconf.pkg_verif.linea('PB-05a', v_pol > 0, 'Politicas de redaccion habilitadas sobre SEGCONF.CLIENTES: ' || v_pol);
  SELECT * INTO r FROM segconf.clientes WHERE id_cliente = 1;
  IF :v_error IS NOT NULL THEN
    segconf.pkg_verif.linea('PB-05b', FALSE, 'APP_CONSULTA no pudo consultar: ' || :v_error);
  ELSE
    segconf.pkg_verif.linea('PB-05b',
      -- un valor NULL tampoco revela el dato; se compara con NVL para no depender de NULL
      NVL(:v_tarjeta, '#') <> r.tarjeta AND NVL(:v_email, '#') <> r.email AND NVL(:v_salario, -1) <> r.salario,
      'APP_CONSULTA ve tarjeta=' || :v_tarjeta || ' email=' || :v_email || ' salario=' || :v_salario);
  END IF;
END;
/
@comun/fin.sql

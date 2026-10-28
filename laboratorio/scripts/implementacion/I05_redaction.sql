-- I05_redaction.sql - Control A.8.11 (enmascaramiento de datos): Oracle Data Redaction
-- Todo usuario distinto del propietario SEGCONF ve los datos sensibles redactados.
@comun/inicio.sql
PROMPT === I05 Data Redaction sobre SEGCONF.CLIENTES ===
BEGIN
  FOR p IN (SELECT policy_name FROM redaction_policies WHERE object_owner = 'SEGCONF' AND object_name = 'CLIENTES') LOOP
    DBMS_REDACT.DROP_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES', policy_name => p.policy_name);
  END LOOP;
  DBMS_REDACT.ADD_POLICY(
    object_schema       => 'SEGCONF',
    object_name         => 'CLIENTES',
    policy_name         => 'POL_RED_CLIENTES',
    policy_description  => 'Redaccion de datos personales para usuarios distintos de SEGCONF',
    column_name         => 'TARJETA',
    function_type       => DBMS_REDACT.PARTIAL,
    function_parameters => DBMS_REDACT.REDACT_CCN16_F12,
    expression          => q'[SYS_CONTEXT('USERENV','SESSION_USER') <> 'SEGCONF']');
  DBMS_REDACT.ALTER_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES', policy_name => 'POL_RED_CLIENTES',
    action => DBMS_REDACT.ADD_COLUMN, column_name => 'EMAIL', function_type => DBMS_REDACT.REGEXP,
    regexp_pattern => DBMS_REDACT.RE_PATTERN_EMAIL_ADDRESS, regexp_replace_string => DBMS_REDACT.RE_REDACT_EMAIL_NAME,
    regexp_position => DBMS_REDACT.RE_BEGINNING, regexp_occurrence => DBMS_REDACT.RE_ALL);
  DBMS_REDACT.ALTER_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES', policy_name => 'POL_RED_CLIENTES',
    action => DBMS_REDACT.ADD_COLUMN, column_name => 'CEDULA', function_type => DBMS_REDACT.PARTIAL,
    function_parameters => 'VFVVVVFVVVV,V-VVVV-VVVV,*,1,5');
  DBMS_REDACT.ALTER_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES', policy_name => 'POL_RED_CLIENTES',
    action => DBMS_REDACT.ADD_COLUMN, column_name => 'TELEFONO', function_type => DBMS_REDACT.PARTIAL,
    function_parameters => 'VVVVFVVVV,VVVV-VVVV,*,1,4');
  DBMS_REDACT.ALTER_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES', policy_name => 'POL_RED_CLIENTES',
    action => DBMS_REDACT.ADD_COLUMN, column_name => 'SALARIO', function_type => DBMS_REDACT.FULL);
END;
/
COLUMN column_name FORMAT A12
COLUMN function_type FORMAT A22
COLUMN function_parameters FORMAT A40
SELECT column_name, function_type, function_parameters FROM redaction_columns
 WHERE object_owner = 'SEGCONF' AND object_name = 'CLIENTES' ORDER BY 1;
@comun/fin.sql

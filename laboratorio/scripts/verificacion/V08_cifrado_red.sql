-- V08_cifrado_red.sql - PB-08a: la sesion por listener (TCP) va cifrada y con integridad (A.8.20, A.8.24)
@comun/inicio.sql
PROMPT === V08 Cifrado de red (Oracle Native Network Encryption) ===
VARIABLE v_cifrado  VARCHAR2(200)
VARIABLE v_checksum VARCHAR2(200)
VARIABLE v_error    VARCHAR2(300)
PROMPT -- Conexion de prueba por listener como SYSTEM
CONNECT system/"&PWD_SYS"@&CON_PDB
COLUMN network_service_banner FORMAT A100
SELECT network_service_banner FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV', 'SID');
BEGIN
  SELECT MAX(CASE WHEN network_service_banner LIKE '%Encryption service adapter%' THEN network_service_banner END),
         MAX(CASE WHEN network_service_banner LIKE '%Crypto-checksumming service adapter%' THEN network_service_banner END)
    INTO :v_cifrado, :v_checksum
    FROM v$session_connect_info WHERE sid = SYS_CONTEXT('USERENV', 'SID');
EXCEPTION WHEN OTHERS THEN :v_error := SQLERRM;
END;
/
@comun/volver_sys.sql
BEGIN
  IF :v_error IS NOT NULL THEN
    segconf.pkg_verif.linea('PB-08a', FALSE, 'No se pudo revisar la sesion: ' || :v_error);
  ELSE
    segconf.pkg_verif.linea('PB-08a', :v_cifrado IS NOT NULL AND :v_checksum IS NOT NULL,
      'Sesion TCP: cifrado=' || NVL(TRIM(SUBSTR(:v_cifrado, 1, INSTR(:v_cifrado, ' ') - 1)), 'NINGUNO')
      || '; integridad=' || NVL(TRIM(SUBSTR(:v_checksum, 1, INSTR(:v_checksum, ' ') - 1)), 'NINGUNA'));
  END IF;
END;
/
@comun/fin.sql

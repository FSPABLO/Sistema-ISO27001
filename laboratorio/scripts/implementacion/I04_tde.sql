-- I04_tde.sql - Control A.8.24: cifrado en reposo con TDE (modo united)
-- Requiere I04a (WALLET_ROOT). Crea el keystore, la clave maestra, un keystore
-- auto-login local, el tablespace cifrado TS_SEGCONF_ENC y mueve SEGCONF.CLIENTES.
@comun/inicio.sql
PROMPT === I04 Transparent Data Encryption ===
ALTER SESSION SET CONTAINER = CDB$ROOT;
-- SERVEROUTPUT se debe reactivar en cada contenedor
SET SERVEROUTPUT ON SIZE UNLIMITED FORMAT WRAPPED
DECLARE
  v_st VARCHAR2(30); v_tipo VARCHAR2(30);
  PROCEDURE estado IS
  BEGIN
    SELECT status, wallet_type INTO v_st, v_tipo FROM v$encryption_wallet WHERE con_id = 1;
    DBMS_OUTPUT.PUT_LINE('  keystore CDB$ROOT: ' || v_st || ' / ' || v_tipo);
  END;
BEGIN
  estado;
  IF v_st = 'NOT_AVAILABLE' THEN
    EXECUTE IMMEDIATE 'ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "&PWD_WALLET"';
    DBMS_OUTPUT.PUT_LINE('Keystore creado en &WALLET_ROOT/tde');
    estado;
  END IF;
  IF v_st = 'CLOSED' THEN
    EXECUTE IMMEDIATE 'ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "&PWD_WALLET" CONTAINER = ALL';
    DBMS_OUTPUT.PUT_LINE('Keystore abierto (CONTAINER = ALL)');
    estado;
  END IF;
  IF v_st = 'OPEN_NO_MASTER_KEY' THEN
    EXECUTE IMMEDIATE 'ADMINISTER KEY MANAGEMENT SET KEY USING TAG ''ISO27001'' IDENTIFIED BY "&PWD_WALLET"'
                   || ' WITH BACKUP USING ''iso27001'' CONTAINER = ALL';
    DBMS_OUTPUT.PUT_LINE('Clave maestra creada en CDB$ROOT y PDB abiertas');
    estado;
  END IF;
  IF v_tipo = 'PASSWORD' THEN
    BEGIN
      EXECUTE IMMEDIATE 'ADMINISTER KEY MANAGEMENT CREATE LOCAL AUTO_LOGIN KEYSTORE FROM KEYSTORE IDENTIFIED BY "&PWD_WALLET"';
      DBMS_OUTPUT.PUT_LINE('Keystore auto-login local creado (abre el keystore tras cada reinicio)');
    EXCEPTION WHEN OTHERS THEN
      IF SQLCODE = -46630 THEN DBMS_OUTPUT.PUT_LINE('Keystore auto-login ya existe (ORA-46630); se conserva');
      ELSE RAISE; END IF;
    END;
  END IF;
END;
/
COLUMN wrl_parameter FORMAT A45
SELECT con_id, wrl_parameter, status, wallet_type, keystore_mode FROM v$encryption_wallet;
ALTER SESSION SET CONTAINER = &PDB;
PROMPT -- Tablespace cifrado y traslado de SEGCONF.CLIENTES
DECLARE
  v_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_n FROM dba_tablespaces WHERE tablespace_name = 'TS_SEGCONF_ENC';
  IF v_n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE TABLESPACE ts_segconf_enc DATAFILE ''&DIR_PDB/ts_segconf_enc01.dbf'''
                   || ' SIZE 20M AUTOEXTEND ON NEXT 10M MAXSIZE 500M ENCRYPTION USING ''AES256'' ENCRYPT';
    DBMS_OUTPUT.PUT_LINE('Tablespace TS_SEGCONF_ENC creado (AES256)');
  END IF;
  EXECUTE IMMEDIATE 'ALTER USER segconf QUOTA UNLIMITED ON ts_segconf_enc';
  EXECUTE IMMEDIATE 'ALTER USER segconf DEFAULT TABLESPACE ts_segconf_enc';
  FOR t IN (SELECT table_name FROM dba_tables
             WHERE owner = 'SEGCONF' AND table_name IN ('CLIENTES','ACCESO_REGION')
               AND tablespace_name <> 'TS_SEGCONF_ENC') LOOP
    EXECUTE IMMEDIATE 'ALTER TABLE segconf.' || t.table_name || ' MOVE ONLINE TABLESPACE ts_segconf_enc';
    DBMS_OUTPUT.PUT_LINE('Movida SEGCONF.' || t.table_name);
  END LOOP;
  FOR i IN (SELECT index_name FROM dba_indexes
             WHERE table_owner = 'SEGCONF' AND table_name IN ('CLIENTES','ACCESO_REGION')
               AND tablespace_name <> 'TS_SEGCONF_ENC') LOOP
    EXECUTE IMMEDIATE 'ALTER INDEX segconf.' || i.index_name || ' REBUILD ONLINE TABLESPACE ts_segconf_enc';
    DBMS_OUTPUT.PUT_LINE('Reconstruido SEGCONF.' || i.index_name);
  END LOOP;
END;
/
COLUMN tablespace_name FORMAT A20
COLUMN segment_name FORMAT A20
SELECT s.segment_name, s.segment_type, s.tablespace_name, t.encrypted
  FROM dba_segments s JOIN dba_tablespaces t ON t.tablespace_name = s.tablespace_name
 WHERE s.owner = 'SEGCONF' ORDER BY 1;
@comun/fin.sql

-- V04_tde.sql - PB-04: cifrado de datos en reposo con TDE (A.8.24)
@comun/inicio.sql
PROMPT === V04 TDE ===
COLUMN wrl_parameter FORMAT A45
COLUMN status FORMAT A20
COLUMN wallet_type FORMAT A12
SELECT con_id, wrl_parameter, status, wallet_type FROM v$encryption_wallet;
COLUMN tablespace_name FORMAT A20
SELECT tablespace_name, encrypted FROM dba_tablespaces ORDER BY 1;
DECLARE
  v_st VARCHAR2(30); v_enc VARCHAR2(3); v_n NUMBER; v_tot NUMBER;
BEGIN
  IF NOT segconf.pkg_verif.opcion('Transparent Data Encryption') THEN
    segconf.pkg_verif.no_dispon('PB-04', 'V$OPTION: Transparent Data Encryption = FALSE');
    RETURN;
  END IF;
  SELECT status INTO v_st FROM v$encryption_wallet WHERE ROWNUM = 1;
  segconf.pkg_verif.linea('PB-04a', v_st = 'OPEN', 'Keystore TDE en &PDB: ' || v_st);
  SELECT NVL(MAX(encrypted), 'N/E') INTO v_enc FROM dba_tablespaces WHERE tablespace_name = 'TS_SEGCONF_ENC';
  segconf.pkg_verif.linea('PB-04b', v_enc = 'YES', 'Tablespace TS_SEGCONF_ENC cifrado: ' || v_enc);
  SELECT COUNT(*), SUM(CASE WHEN t.encrypted = 'YES' THEN 1 ELSE 0 END) INTO v_tot, v_n
    FROM (SELECT tablespace_name FROM dba_tables  WHERE owner = 'SEGCONF' AND table_name = 'CLIENTES'
          UNION ALL
          SELECT tablespace_name FROM dba_indexes WHERE table_owner = 'SEGCONF' AND table_name = 'CLIENTES') s
    JOIN dba_tablespaces t ON t.tablespace_name = s.tablespace_name;
  segconf.pkg_verif.linea('PB-04c', v_tot > 0 AND v_n = v_tot,
    'Segmentos de SEGCONF.CLIENTES (tabla e indices) en tablespace cifrado: ' || v_n || ' de ' || v_tot);
END;
/
@comun/fin.sql

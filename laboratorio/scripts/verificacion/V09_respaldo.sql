-- V09_respaldo.sql - PB-09: respaldos RMAN cifrados (A.8.13, A.8.24)
@comun/inicio.sql
PROMPT === V09 Respaldo cifrado ===
ALTER SESSION SET CONTAINER = CDB$ROOT;
SELECT log_mode FROM v$database;
COLUMN handle FORMAT A70
COLUMN tag FORMAT A20
SELECT p.handle, p.tag, p.encrypted, p.status, ROUND(p.bytes/1024/1024) mb
  FROM v$backup_piece p WHERE p.status = 'A' ORDER BY p.completion_time;
VARIABLE v_modo  VARCHAR2(20)
VARIABLE v_enc   NUMBER
VARIABLE v_noenc NUMBER
BEGIN
  SELECT log_mode INTO :v_modo FROM v$database;
  -- piezas vigentes que contienen datafiles de la PDB del proyecto
  SELECT NVL(SUM(CASE WHEN p.encrypted = 'YES' THEN 1 ELSE 0 END), 0),
         NVL(SUM(CASE WHEN p.encrypted = 'NO'  THEN 1 ELSE 0 END), 0)
    INTO :v_enc, :v_noenc
    FROM v$backup_piece p
   WHERE p.status = 'A'
     AND EXISTS (SELECT 1 FROM v$backup_datafile d JOIN v$pdbs b ON b.con_id = d.con_id
                  WHERE d.set_stamp = p.set_stamp AND d.set_count = p.set_count AND b.name = '&PDB');
END;
/
-- PKG_VERIF vive en la PDB: se vuelve a ella para imprimir el resultado
ALTER SESSION SET CONTAINER = &PDB;
BEGIN
  segconf.pkg_verif.linea('PB-09a', :v_modo = 'ARCHIVELOG', 'Modo de registro de la base: ' || :v_modo);
  IF NOT segconf.pkg_verif.opcion('Backup Encryption') THEN
    segconf.pkg_verif.no_dispon('PB-09b', 'V$OPTION: Backup Encryption = FALSE');
  ELSE
    segconf.pkg_verif.linea('PB-09b', :v_enc > 0 AND :v_noenc = 0,
      'Piezas de respaldo de &PDB: cifradas=' || :v_enc || ', sin cifrar=' || :v_noenc);
  END IF;
END;
/
@comun/fin.sql

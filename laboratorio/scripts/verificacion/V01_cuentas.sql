-- V01_cuentas.sql - PB-01: cuentas por defecto/demostracion (A.5.18, A.8.2)
@comun/inicio.sql
PROMPT === V01 Cuentas por defecto ===
COLUMN username FORMAT A20
COLUMN account_status FORMAT A25
SELECT d.username, u.account_status FROM dba_users_with_defpwd d JOIN dba_users u ON u.username = d.username
 WHERE u.account_status = 'OPEN' ORDER BY 1;
DECLARE
  v_scott VARCHAR2(40); v_n NUMBER; v_lista VARCHAR2(4000);
BEGIN
  SELECT NVL(MAX(account_status), 'NO EXISTE') INTO v_scott FROM dba_users WHERE username = 'SCOTT';
  segconf.pkg_verif.linea('PB-01a', v_scott = 'NO EXISTE' OR v_scott LIKE '%LOCKED%',
    'Cuenta de demostracion SCOTT: ' || v_scott);
  SELECT COUNT(*), LISTAGG(d.username, ',') WITHIN GROUP (ORDER BY d.username) INTO v_n, v_lista
    FROM dba_users_with_defpwd d JOIN dba_users u ON u.username = d.username
   WHERE u.account_status = 'OPEN';
  segconf.pkg_verif.linea('PB-01b', v_n = 0,
    'Cuentas abiertas con clave por defecto: ' || v_n || CASE WHEN v_n > 0 THEN ' (' || v_lista || ')' END);
END;
/
@comun/fin.sql

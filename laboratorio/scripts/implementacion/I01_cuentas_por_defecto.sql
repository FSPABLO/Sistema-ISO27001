-- I01_cuentas_por_defecto.sql - Control A.5.18 / A.8.2
-- Bloquea y expira cuentas de demostracion y cualquier cuenta abierta con clave por defecto.
@comun/inicio.sql
PROMPT === I01 Bloqueo de cuentas por defecto ===
BEGIN
  FOR u IN (SELECT d.username FROM dba_users_with_defpwd d JOIN dba_users u ON u.username = d.username
             WHERE u.account_status NOT LIKE '%LOCKED%'
            UNION
            SELECT username FROM dba_users WHERE username = 'SCOTT' AND account_status NOT LIKE '%LOCKED%') LOOP
    EXECUTE IMMEDIATE 'ALTER USER "' || u.username || '" ACCOUNT LOCK PASSWORD EXPIRE';
    DBMS_OUTPUT.PUT_LINE('Bloqueada y expirada: ' || u.username);
  END LOOP;
END;
/
COLUMN username FORMAT A20
COLUMN account_status FORMAT A25
SELECT username, account_status FROM dba_users WHERE username = 'SCOTT';
@comun/fin.sql

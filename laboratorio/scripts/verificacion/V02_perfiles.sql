-- V02_perfiles.sql - PB-02: politica de contrasenas de las cuentas del proyecto (A.5.17)
@comun/inicio.sql
PROMPT === V02 Perfiles de contrasena ===
COLUMN username FORMAT A14
COLUMN profile FORMAT A14
COLUMN failed FORMAT A10
COLUMN life FORMAT A10
COLUMN verify FORMAT A26
CREATE OR REPLACE VIEW sys.v_iso_limites AS
  SELECT u.username, u.profile,
         MAX(CASE WHEN p.resource_name = 'FAILED_LOGIN_ATTEMPTS'    THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) failed,
         MAX(CASE WHEN p.resource_name = 'PASSWORD_LIFE_TIME'       THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) life,
         MAX(CASE WHEN p.resource_name = 'PASSWORD_VERIFY_FUNCTION' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) verify
    FROM dba_users u
    JOIN dba_profiles p ON p.profile = u.profile
    JOIN dba_profiles d ON d.profile = 'DEFAULT' AND d.resource_name = p.resource_name
   WHERE u.username IN ('SEGCONF','SEGCONF_DEV','APP_CONSULTA','APP_SOPORTE','APP_REPORTES','APP_AUDITOR')
   GROUP BY u.username, u.profile;
SELECT * FROM sys.v_iso_limites ORDER BY 1;
DECLARE
  v_a NUMBER; v_b NUMBER; v_c NUMBER; v_tot NUMBER;
BEGIN
  SELECT COUNT(*),
         SUM(CASE WHEN failed IN ('UNLIMITED','DEFAULT') OR TO_NUMBER(failed) > 5 THEN 1 ELSE 0 END),
         SUM(CASE WHEN verify IS NULL OR verify IN ('NULL','DEFAULT') THEN 1 ELSE 0 END),
         SUM(CASE WHEN life IN ('UNLIMITED','DEFAULT') OR TO_NUMBER(life DEFAULT 9999 ON CONVERSION ERROR) > 90 THEN 1 ELSE 0 END)
    INTO v_tot, v_a, v_b, v_c FROM sys.v_iso_limites;
  segconf.pkg_verif.linea('PB-02a', v_tot = 6 AND v_a = 0, 'Cuentas con FAILED_LOGIN_ATTEMPTS > 5 o ilimitado: ' || v_a || ' de ' || v_tot);
  segconf.pkg_verif.linea('PB-02b', v_tot = 6 AND v_b = 0, 'Cuentas sin PASSWORD_VERIFY_FUNCTION: ' || v_b || ' de ' || v_tot);
  segconf.pkg_verif.linea('PB-02c', v_tot = 6 AND v_c = 0, 'Cuentas con PASSWORD_LIFE_TIME > 90 dias o ilimitado: ' || v_c || ' de ' || v_tot);
END;
/
DROP VIEW sys.v_iso_limites;
@comun/fin.sql

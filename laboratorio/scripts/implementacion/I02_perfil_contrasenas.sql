-- I02_perfil_contrasenas.sql - Control A.5.17 (informacion de autenticacion)
-- Crea el perfil PRF_SEGCONF y lo asigna a las cuentas del proyecto.
@comun/inicio.sql
PROMPT === I02 Perfil de contrasenas PRF_SEGCONF ===
DECLARE
  v_n NUMBER;
  v_limites CONSTANT VARCHAR2(1000) :=
    ' LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24 PASSWORD_LIFE_TIME 90'
 || ' PASSWORD_GRACE_TIME 7 PASSWORD_REUSE_TIME 365 PASSWORD_REUSE_MAX 10'
 || ' INACTIVE_ACCOUNT_TIME 90 PASSWORD_VERIFY_FUNCTION ORA12C_STRONG_VERIFY_FUNCTION'
 || ' SESSIONS_PER_USER 10 IDLE_TIME 30';
BEGIN
  SELECT COUNT(*) INTO v_n FROM dba_profiles WHERE profile = 'PRF_SEGCONF';
  EXECUTE IMMEDIATE CASE WHEN v_n = 0 THEN 'CREATE' ELSE 'ALTER' END || ' PROFILE prf_segconf' || v_limites;
  FOR u IN (SELECT username FROM dba_users
             WHERE username IN ('SEGCONF','SEGCONF_DEV','APP_CONSULTA','APP_SOPORTE','APP_REPORTES','APP_AUDITOR')) LOOP
    EXECUTE IMMEDIATE 'ALTER USER ' || u.username || ' PROFILE prf_segconf';
  END LOOP;
END;
/
COLUMN resource_name FORMAT A28
COLUMN limit FORMAT A32
SELECT resource_name, limit FROM dba_profiles WHERE profile = 'PRF_SEGCONF' AND resource_type = 'PASSWORD' ORDER BY 1;
COLUMN username FORMAT A14
COLUMN profile FORMAT A14
SELECT username, profile FROM dba_users WHERE profile = 'PRF_SEGCONF' ORDER BY 1;
@comun/fin.sql

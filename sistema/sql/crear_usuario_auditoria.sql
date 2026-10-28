-- =====================================================================
-- crear_usuario_auditoria.sql
-- Crea la cuenta ISO_AUDIT que usa el sistema de auditoria ISO/IEC 27001:2022.
-- Minimo privilegio: CREATE SESSION + lectura (READ) de las vistas exactas que
-- consultan las pruebas + rol AUDIT_VIEWER (lectura de UNIFIED_AUDIT_TRAIL).
-- No usa SYS, DBA, SELECT ANY TABLE ni SELECT_CATALOG_ROLE.
--
-- Ejecutar UNA vez por base auditada, como un usuario administrador (SYS o SYSTEM)
-- conectado a la PDB que se va a auditar, por ejemplo:
--   sqlplus sys/********@//localhost:1522/FREEPDB1 as sysdba @crear_usuario_auditoria.sql
-- Recibe la clave de ISO_AUDIT como primer argumento (si falta, SQL*Plus la pide):
--   @crear_usuario_auditoria.sql "<clave>"
-- La clave debe cumplir
-- ORA12C_STRONG_VERIFY_FUNCTION: 9+ caracteres, 2 mayusculas, 2 minusculas,
-- 2 digitos y 2 caracteres especiales.
-- Es idempotente: si la cuenta existe, se actualizan clave, perfil y permisos.
-- =====================================================================
SET VERIFY OFF FEEDBACK OFF SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE
DEFINE PWD_ISO_AUDIT = "&1"

-- 1. Perfil propio con politica de contrasenas fuerte (la cuenta de auditoria
--    tambien debe cumplir A.5.17; no se toca el perfil DEFAULT de la base)
DECLARE
  v_n NUMBER;
  v_lim CONSTANT VARCHAR2(400) := ' LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24'
    || ' PASSWORD_LIFE_TIME 90 PASSWORD_GRACE_TIME 7 PASSWORD_REUSE_TIME 365 PASSWORD_REUSE_MAX 10'
    || ' PASSWORD_VERIFY_FUNCTION ORA12C_STRONG_VERIFY_FUNCTION SESSIONS_PER_USER 5 IDLE_TIME 30';
BEGIN
  SELECT COUNT(*) INTO v_n FROM dba_profiles WHERE profile = 'PRF_ISO_AUDIT';
  EXECUTE IMMEDIATE CASE WHEN v_n = 0 THEN 'CREATE' ELSE 'ALTER' END || ' PROFILE prf_iso_audit' || v_lim;
END;
/

-- 2. Cuenta
DECLARE
  v_n NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_n FROM dba_users WHERE username = 'ISO_AUDIT';
  IF v_n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER iso_audit IDENTIFIED BY "&PWD_ISO_AUDIT" PROFILE prf_iso_audit';
  ELSE
    BEGIN
      EXECUTE IMMEDIATE 'ALTER USER iso_audit IDENTIFIED BY "&PWD_ISO_AUDIT"';
    EXCEPTION WHEN OTHERS THEN
      -- ORA-28007: es la misma clave de antes (el perfil impide reutilizarla); se conserva
      IF SQLCODE <> -28007 THEN RAISE; END IF;
    END;
    EXECUTE IMMEDIATE 'ALTER USER iso_audit PROFILE prf_iso_audit ACCOUNT UNLOCK';
  END IF;
END;
/
GRANT CREATE SESSION TO iso_audit;
GRANT AUDIT_VIEWER TO iso_audit;

-- 3. Lectura de las vistas que usan las pruebas (READ no permite SELECT ... FOR UPDATE)
--    Las vistas V$ se conceden sobre su sinonimo base V_$.
BEGIN
  FOR v IN (SELECT column_value nombre FROM TABLE(sys.odcivarchar2list(
      'DBA_USERS', 'DBA_USERS_WITH_DEFPWD', 'DBA_PROFILES', 'DBA_SYS_PRIVS', 'DBA_ROLE_PRIVS',
      'DBA_ROLES', 'DBA_TAB_PRIVS', 'DBA_DB_LINKS', 'DBA_DIRECTORIES', 'DBA_TABLESPACES',
      'DBA_TABLES', 'DBA_TAB_COLUMNS', 'DBA_COL_COMMENTS', 'DBA_ENCRYPTED_COLUMNS',
      'REDACTION_POLICIES', 'REDACTION_COLUMNS', 'DBA_POLICIES',
      'AUDIT_UNIFIED_ENABLED_POLICIES', 'AUDIT_UNIFIED_POLICIES', 'DBA_AUDIT_MGMT_CONFIG_PARAMS',
      'DBA_AUDIT_MGMT_CLEANUP_JOBS', 'DBA_AUDIT_MGMT_LAST_ARCH_TS',
      'DBA_RECYCLEBIN', 'DBA_REGISTRY_SQLPATCH',
      'V_$VERSION', 'V_$INSTANCE', 'V_$DATABASE', 'V_$PDBS', 'V_$OPTION', 'V_$PWFILE_USERS',
      'V_$ENCRYPTION_WALLET', 'V_$SESSION_CONNECT_INFO', 'V_$BACKUP_PIECE', 'V_$BACKUP_DATAFILE'))) LOOP
    EXECUTE IMMEDIATE 'GRANT READ ON sys.' || v.nombre || ' TO iso_audit';
  END LOOP;
END;
/
PROMPT Permisos de ISO_AUDIT:
SET FEEDBACK ON
COLUMN privilegio FORMAT A60
SELECT 'SISTEMA: ' || privilege privilegio FROM dba_sys_privs WHERE grantee = 'ISO_AUDIT'
UNION ALL SELECT 'ROL: ' || granted_role FROM dba_role_privs WHERE grantee = 'ISO_AUDIT'
UNION ALL SELECT 'OBJETO: ' || privilege || ' ON ' || owner || '.' || table_name FROM dba_tab_privs WHERE grantee = 'ISO_AUDIT'
ORDER BY 1;
EXIT

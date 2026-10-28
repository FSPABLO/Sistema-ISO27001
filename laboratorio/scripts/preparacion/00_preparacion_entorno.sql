-- =====================================================================
-- 00_preparacion_entorno.sql
-- Crea (o recrea desde cero) el entorno de pruebas en FREEPDB1:
--   * usuarios SEGCONF, SEGCONF_DEV, APP_CONSULTA, APP_SOPORTE,
--     APP_REPORTES, APP_AUDITOR y SCOTT
--   * SEGCONF.CLIENTES con 60 filas FICTICIAS y el clon SEGCONF_DEV.CLIENTES
--   * debilidades iniciales DELIBERADAS (ver seccion 5)
--   * paquete SEGCONF.PKG_VERIF usado por los scripts de verificacion
-- Es idempotente: primero elimina todo lo que crean preparacion e implementacion.
-- =====================================================================
@comun/inicio.sql

PROMPT === 1. Limpieza de objetos de corridas anteriores ===
BEGIN
  FOR p IN (SELECT policy_name FROM audit_unified_policies
             WHERE policy_name IN ('POL_AUD_CLIENTES','POL_AUD_ADMIN')
             GROUP BY policy_name) LOOP
    BEGIN EXECUTE IMMEDIATE 'NOAUDIT POLICY ' || p.policy_name; EXCEPTION WHEN OTHERS THEN NULL; END;
    EXECUTE IMMEDIATE 'DROP AUDIT POLICY ' || p.policy_name;
  END LOOP;
END;
/
BEGIN
  FOR u IN (SELECT username FROM dba_users
             WHERE username IN ('SEGCONF','SEGCONF_DEV','APP_CONSULTA','APP_SOPORTE',
                                'APP_REPORTES','APP_AUDITOR','SCOTT')) LOOP
    EXECUTE IMMEDIATE 'DROP USER ' || u.username || ' CASCADE';
  END LOOP;
  FOR r IN (SELECT role FROM dba_roles WHERE role LIKE 'ROL\_%' ESCAPE '\'
              AND role IN ('ROL_CONSULTA_CLIENTES','ROL_SOPORTE_CLIENTES','ROL_REPORTES')) LOOP
    EXECUTE IMMEDIATE 'DROP ROLE ' || r.role;
  END LOOP;
  FOR p IN (SELECT DISTINCT profile FROM dba_profiles WHERE profile = 'PRF_SEGCONF') LOOP
    EXECUTE IMMEDIATE 'DROP PROFILE PRF_SEGCONF CASCADE';
  END LOOP;
  FOR t IN (SELECT tablespace_name FROM dba_tablespaces WHERE tablespace_name = 'TS_SEGCONF_ENC') LOOP
    EXECUTE IMMEDIATE 'DROP TABLESPACE TS_SEGCONF_ENC INCLUDING CONTENTS AND DATAFILES';
  END LOOP;
END;
/

WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT === 2. Usuarios (perfil DEFAULT) ===
CREATE USER segconf      IDENTIFIED BY "&PWD_SEGCONF"  DEFAULT TABLESPACE users QUOTA UNLIMITED ON users;
CREATE USER segconf_dev  IDENTIFIED BY "&PWD_DEV"      DEFAULT TABLESPACE users QUOTA UNLIMITED ON users;
CREATE USER app_consulta IDENTIFIED BY "&PWD_CONSULTA" DEFAULT TABLESPACE users;
CREATE USER app_soporte  IDENTIFIED BY "&PWD_SOPORTE"  DEFAULT TABLESPACE users;
CREATE USER app_reportes IDENTIFIED BY "&PWD_REPORTES" DEFAULT TABLESPACE users;
CREATE USER app_auditor  IDENTIFIED BY "&PWD_AUDITOR"  DEFAULT TABLESPACE users;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE SEQUENCE TO segconf;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW TO segconf_dev;
GRANT CREATE SESSION TO app_consulta, app_soporte, app_reportes, app_auditor;

PROMPT === 3. Tabla SEGCONF.CLIENTES con 60 filas ficticias ===
CREATE TABLE segconf.clientes (
  id_cliente     NUMBER(6)     CONSTRAINT pk_clientes PRIMARY KEY,
  cedula         VARCHAR2(12)  NOT NULL,
  nombre         VARCHAR2(60)  NOT NULL,
  email          VARCHAR2(80),
  telefono       VARCHAR2(9),
  provincia      VARCHAR2(20)  NOT NULL,
  tarjeta        VARCHAR2(19),
  salario        NUMBER(10,2),
  fecha_registro DATE
) TABLESPACE users;

INSERT INTO segconf.clientes
SELECT n,
       TO_CHAR(MOD(n, 7) + 1) || '-' || LPAD(1000 + n * 13, 4, '0') || '-' || LPAD(2000 + n * 37, 4, '0'),
       nom || ' ' || ape,
       LOWER(nom) || '.' || LOWER(ape) || n || '@correo-ficticio.test',
       CASE WHEN MOD(n, 2) = 0 THEN '8' ELSE '6' END || LPAD(MOD(n * 271, 1000), 3, '0') || '-' || LPAD(MOD(n * 997, 10000), 4, '0'),
       prov,
       '4000-0000-0000-' || LPAD(n, 4, '0'),
       450000 + MOD(n * 15485, 1800000),
       DATE '2024-01-01' + n * 5
  FROM (SELECT LEVEL n,
               CASE MOD(LEVEL, 10) WHEN 0 THEN 'Ana' WHEN 1 THEN 'Luis' WHEN 2 THEN 'Maria' WHEN 3 THEN 'Jose'
                    WHEN 4 THEN 'Sofia' WHEN 5 THEN 'Carlos' WHEN 6 THEN 'Valeria' WHEN 7 THEN 'Diego'
                    WHEN 8 THEN 'Lucia' ELSE 'Andres' END nom,
               CASE MOD(LEVEL, 6) WHEN 0 THEN 'Mora' WHEN 1 THEN 'Rojas' WHEN 2 THEN 'Vargas'
                    WHEN 3 THEN 'Jimenez' WHEN 4 THEN 'Solano' ELSE 'Castro' END ape,
               CASE MOD(LEVEL, 7) WHEN 0 THEN 'SAN JOSE' WHEN 1 THEN 'ALAJUELA' WHEN 2 THEN 'CARTAGO'
                    WHEN 3 THEN 'HEREDIA' WHEN 4 THEN 'GUANACASTE' WHEN 5 THEN 'PUNTARENAS' ELSE 'LIMON' END prov
          FROM dual CONNECT BY LEVEL <= 60);
COMMIT;

-- Mapa usuario -> provincia que usara la politica VPD (I06)
CREATE TABLE segconf.acceso_region (
  usuario   VARCHAR2(128) NOT NULL,
  provincia VARCHAR2(20)  NOT NULL,
  CONSTRAINT pk_acceso_region PRIMARY KEY (usuario, provincia)
) TABLESPACE users;
INSERT INTO segconf.acceso_region SELECT u.usuario, p.provincia
  FROM (SELECT 'APP_CONSULTA' usuario FROM dual UNION ALL SELECT 'APP_REPORTES' FROM dual) u,
       (SELECT DISTINCT provincia FROM segconf.clientes) p;
INSERT INTO segconf.acceso_region VALUES ('APP_SOPORTE', 'HEREDIA');
COMMIT;

-- Vista agregada (sin datos personales) para reportes
CREATE VIEW segconf.v_clientes_resumen AS
  SELECT provincia, COUNT(*) total_clientes, ROUND(AVG(salario), -3) salario_promedio
    FROM segconf.clientes GROUP BY provincia;

PROMPT === 4. Clon de desarrollo SEGCONF_DEV.CLIENTES (copia SIN enmascarar) ===
CREATE TABLE segconf_dev.clientes TABLESPACE users AS SELECT * FROM segconf.clientes;
ALTER TABLE segconf_dev.clientes ADD CONSTRAINT pk_clientes_dev PRIMARY KEY (id_cliente);

PROMPT === 5. Debilidades iniciales deliberadas ===
-- 5.1 Cuenta de demostracion con clave por defecto (A.5.18, A.8.2)
CREATE USER scott IDENTIFIED BY tiger DEFAULT TABLESPACE users QUOTA 10M ON users;
GRANT CREATE SESSION, RESOURCE TO scott;
-- 5.2 Privilegio de sistema excesivo (A.8.2)
GRANT SELECT ANY TABLE TO app_reportes;
-- 5.3 Paquetes de red/archivo ejecutables por PUBLIC (A.8.2, A.8.20)
GRANT EXECUTE ON sys.utl_file   TO PUBLIC;
GRANT EXECUTE ON sys.utl_http   TO PUBLIC;
GRANT EXECUTE ON sys.utl_tcp    TO PUBLIC;
GRANT EXECUTE ON sys.utl_smtp   TO PUBLIC;
GRANT EXECUTE ON sys.utl_inaddr TO PUBLIC;
-- 5.4 Permisos directos (sin roles) y permiso residual del clonado (A.5.15)
GRANT SELECT ON segconf.clientes TO app_consulta;
GRANT SELECT ON segconf.clientes TO app_soporte;
GRANT SELECT ON segconf.clientes TO segconf_dev;
-- 5.5 Residuos: copia temporal olvidada y una tabla borrada que queda en la papelera (A.8.10)
CREATE TABLE segconf.clientes_export_tmp TABLESPACE users AS SELECT * FROM segconf.clientes;
CREATE TABLE segconf.clientes_respaldo   TABLESPACE users AS SELECT * FROM segconf.clientes;
DROP TABLE segconf.clientes_respaldo;
-- 5.6 Sin cifrado, sin redaccion, sin VPD, sin auditoria especifica: no se crea nada.

PROMPT === 6. Paquete de apoyo SEGCONF.PKG_VERIF ===
-- Derechos del definidor: solo necesita leer V$OPTION (no requiere INHERIT PRIVILEGES de SYS)
GRANT SELECT ON sys.v_$option TO segconf;
CREATE OR REPLACE PACKAGE segconf.pkg_verif AUTHID DEFINER AS
  -- Imprime "PB-xx | CUMPLE|NO CUMPLE | detalle"
  PROCEDURE linea(p_id IN VARCHAR2, p_cumple IN BOOLEAN, p_detalle IN VARCHAR2);
  -- Imprime "PB-xx | NO DISPON. | detalle"
  PROCEDURE no_dispon(p_id IN VARCHAR2, p_detalle IN VARCHAR2);
  -- TRUE si la opcion aparece como TRUE en V$OPTION
  FUNCTION opcion(p_nombre IN VARCHAR2) RETURN BOOLEAN;
END pkg_verif;
/
CREATE OR REPLACE PACKAGE BODY segconf.pkg_verif AS
  PROCEDURE imprimir(p_id VARCHAR2, p_res VARCHAR2, p_det VARCHAR2) IS
  BEGIN
    DBMS_OUTPUT.PUT_LINE(RPAD(p_id, 6) || ' | ' || RPAD(p_res, 10) || ' | ' || p_det);
  END;
  PROCEDURE linea(p_id IN VARCHAR2, p_cumple IN BOOLEAN, p_detalle IN VARCHAR2) IS
  BEGIN
    imprimir(p_id, CASE WHEN p_cumple THEN 'CUMPLE' ELSE 'NO CUMPLE' END, p_detalle);
  END;
  PROCEDURE no_dispon(p_id IN VARCHAR2, p_detalle IN VARCHAR2) IS
  BEGIN
    imprimir(p_id, 'NO DISPON.', p_detalle);
  END;
  FUNCTION opcion(p_nombre IN VARCHAR2) RETURN BOOLEAN IS
    v VARCHAR2(64);
  BEGIN
    EXECUTE IMMEDIATE 'SELECT value FROM v$option WHERE parameter = :1' INTO v USING p_nombre;
    RETURN v = 'TRUE';
  EXCEPTION WHEN NO_DATA_FOUND THEN RETURN FALSE;
  END;
END pkg_verif;
/

WHENEVER SQLERROR CONTINUE
PROMPT === 7. Resumen ===
COLUMN owner FORMAT A12
COLUMN object_name FORMAT A30
SELECT owner, table_name object_name, num_rows FROM dba_tables WHERE owner IN ('SEGCONF','SEGCONF_DEV') ORDER BY 1, 2;
SELECT 'SEGCONF.CLIENTES' tabla, COUNT(*) filas FROM segconf.clientes
UNION ALL SELECT 'SEGCONF_DEV.CLIENTES', COUNT(*) FROM segconf_dev.clientes;
SELECT owner, original_name, object_name FROM dba_recyclebin WHERE owner IN ('SEGCONF','SEGCONF_DEV');
PROMPT Preparacion terminada.
@comun/fin.sql

# Registro de cambios a los scripts

El repositorio no existía cuando empezó el trabajo (no había zip ni carpeta `proyecto-iso27001-dba`). Por eso los scripts se escribieron desde cero en esta sesión, con la estructura descrita en el enunciado. Este registro recoge las **correcciones** que hicieron falta al ejecutarlos contra Oracle 23.26.3 Free: cada error real detectado, su causa y el cambio mínimo aplicado. Ninguna corrección cambia el significado de una prueba `PB-xx` ni la debilita.

---

### 1. `scripts/preparacion/00_preparacion_entorno.sql`, sección 6 (paquete `SEGCONF.PKG_VERIF`)

**Error:** `ORA-06598: insufficient INHERIT PRIVILEGES privilege` / `ORA-06512: at "SEGCONF.PKG_VERIF", line 6` en todas las verificaciones.
**Causa:** el paquete era de derechos del invocador. Al llamarlo SYS, Oracle 12c+ exige que SYS conceda `INHERIT PRIVILEGES` a SEGCONF, lo que supondría elevar privilegios justo en un proyecto de mínimo privilegio.
**Cambio:** derechos del definidor y un único permiso de lectura sobre `V_$OPTION`.

```sql
-- antes
CREATE OR REPLACE PACKAGE segconf.pkg_verif AUTHID CURRENT_USER AS
-- despues
GRANT SELECT ON sys.v_$option TO segconf;
CREATE OR REPLACE PACKAGE segconf.pkg_verif AUTHID DEFINER AS
```

### 2. `scripts/comun/inicio.sql`, orden de `SET SERVEROUTPUT`

**Error:** V00–V04 y V10–V12 no imprimían ninguna línea `PB-xx`, sin dar error.
**Causa:** `sqlplus /nolog` ejecutaba `SET SERVEROUTPUT ON` antes de `CONNECT`. Sin conexión, SQL*Plus no habilita `DBMS_OUTPUT` en la sesión. Los scripts que reconectaban con `volver_sys.sql` sí imprimían.
**Cambio:**

```sql
-- antes
SET SERVEROUTPUT ON SIZE UNLIMITED FORMAT WRAPPED
WHENEVER SQLERROR CONTINUE
CONNECT / AS SYSDBA
ALTER SESSION SET CONTAINER = &PDB;
-- despues
WHENEVER SQLERROR CONTINUE
CONNECT / AS SYSDBA
ALTER SESSION SET CONTAINER = &PDB;
SET SERVEROUTPUT ON SIZE UNLIMITED FORMAT WRAPPED
```

### 3. `scripts/verificacion/V09_respaldo.sql`, bloque de evaluación

**Error:** `PLS-00201: identifier 'SEGCONF.PKG_VERIF' must be declared`.
**Causa:** `V$BACKUP_PIECE` y `V$DATABASE.LOG_MODE` se consultan en `CDB$ROOT`, pero `PKG_VERIF` solo existe en FREEPDB1.
**Cambio:** los valores se guardan en variables de enlace en `CDB$ROOT` y luego se vuelve a la PDB para imprimir.

```sql
-- antes (en CDB$ROOT)
DECLARE v_modo ...; BEGIN SELECT log_mode INTO v_modo ...; segconf.pkg_verif.linea(...); ... END;
-- despues
VARIABLE v_modo VARCHAR2(20)  -- + v_enc, v_noenc
BEGIN SELECT log_mode INTO :v_modo FROM v$database; ... END;   -- en CDB$ROOT
ALTER SESSION SET CONTAINER = &PDB;
BEGIN segconf.pkg_verif.linea('PB-09a', :v_modo = 'ARCHIVELOG', ...); ... END;
```

### 4. `scripts/implementacion/I04_tde.sql`, bloque del keystore en `CDB$ROOT`

**Error 4a:** no aparecía ningún mensaje del bloque de gestión de claves, aunque el keystore sí se creaba.
**Causa:** `ALTER SESSION SET CONTAINER` deja `DBMS_OUTPUT` sin habilitar en el contenedor nuevo.
**Cambio:** se agrega `SET SERVEROUTPUT ON SIZE UNLIMITED FORMAT WRAPPED` después de `ALTER SESSION SET CONTAINER = CDB$ROOT;`.

**Error 4b:** en la segunda ejecución aparecía `ORA-46630: Keystore cannot be created at location ...`.
**Causa:** el keystore auto-login ya existe. Es el comportamiento esperado, no un fallo.
**Cambio:**

```sql
-- antes
EXCEPTION WHEN OTHERS THEN DBMS_OUTPUT.PUT_LINE('Auto-login no creado: ' || SQLERRM);
-- despues
EXCEPTION WHEN OTHERS THEN
  IF SQLCODE = -46630 THEN DBMS_OUTPUT.PUT_LINE('Keystore auto-login ya existe (ORA-46630); se conserva');
  ELSE RAISE; END IF;
```

### 5. `scripts/implementacion/I09_rman_respaldo_cifrado.sh`, comando `BACKUP`

**Error:** el respaldo de datafiles quedó con el tag automático `TAG20261019T...`. Solo los archivelogs llevaban `ISO27001_CIFRADO`.
**Causa:** en `... PLUS ARCHIVELOG TAG 'x'` el `TAG` se aplica solo a la cláusula `PLUS ARCHIVELOG`.
**Cambio:**

```
# antes
BACKUP AS COMPRESSED BACKUPSET PLUGGABLE DATABASE $PDB PLUS ARCHIVELOG TAG 'ISO27001_CIFRADO';
# despues
BACKUP AS COMPRESSED BACKUPSET TAG 'ISO27001_CIFRADO' PLUGGABLE DATABASE $PDB PLUS ARCHIVELOG TAG 'ISO27001_CIFRADO';
```

### 6. `scripts/implementacion/I03_minimo_privilegio.sql`, revocación de UTL_* a PUBLIC

**Error:** después de I03 quedaron **129 objetos inválidos** en FREEPDB1 (SYS, XDB, MDSYS, CTXSYS, GSMADMIN_INTERNAL). Tras `UTL_RECOMP.RECOMP_SERIAL` seguía inválido `MDSYS.SEM_RDFCTX_DR` con `PLS-00201: identifier 'SYS.UTL_TCP' must be declared`.
**Causa:** revocar un permiso invalida a los dependientes. Además, algunos esquemas de Oracle usaban UTL_* solo a través de PUBLIC.
**Cambio:** antes de revocar, se concede EXECUTE directo a los esquemas `ORACLE_MAINTAINED='Y'` que dependen de cada paquete (es lo que recomienda CIS; en esta versión, CTXSYS, GSMADMIN_INTERNAL y MDSYS). Al final se recompila. Resultado: 0 objetos inválidos. PB-03b sigue exigiendo lo mismo: ningún EXECUTE para PUBLIC.

```sql
-- antes: solo el bucle REVOKE EXECUTE ON sys.<pkg> FROM PUBLIC
-- despues: bloque previo
FOR d IN (SELECT DISTINCT dp.owner, dp.referenced_name FROM dba_dependencies dp
           WHERE dp.referenced_owner = 'SYS' AND dp.referenced_name IN ('UTL_FILE',...)
             AND dp.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'Y') ...) LOOP
  EXECUTE IMMEDIATE 'GRANT EXECUTE ON sys.' || d.referenced_name || ' TO "' || d.owner || '"';
END LOOP;
-- ... y al final del script
EXEC UTL_RECOMP.RECOMP_SERIAL()
SELECT owner, object_name, object_type FROM dba_objects WHERE status = 'INVALID';
```

### 7. `scripts/verificacion/V05_redaction.sql`, lectura del salario redactado

**Error:** PB-05b mostraba `salario=` vacío.
**Causa:** con Data Redaction, una **expresión** sobre una columna redactada (`TO_CHAR(salario)`) devuelve NULL, no el valor redactado (`0`). La comparación quedaba en NULL y no medía lo que decía medir.
**Cambio:** se lee la columna tal cual en una variable `NUMBER` y la comparación trata NULL de forma explícita (un NULL tampoco revela el dato). La condición sigue exigiendo que tarjeta, email **y** salario difieran del valor real.

```sql
-- antes
VARIABLE v_salario VARCHAR2(40)
SELECT tarjeta, email, TO_CHAR(salario) INTO :v_tarjeta, :v_email, :v_salario ...
:v_tarjeta <> r.tarjeta AND :v_email <> r.email AND :v_salario <> TO_CHAR(r.salario)
-- despues
VARIABLE v_salario NUMBER
SELECT tarjeta, email, salario INTO :v_tarjeta, :v_email, :v_salario ...
NVL(:v_tarjeta, '#') <> r.tarjeta AND NVL(:v_email, '#') <> r.email AND NVL(:v_salario, -1) <> r.salario
```

---

### Verificado sin cambios

* `WALLET_ROOT` funcionó en 23.26.3; no hizo falta la alternativa `ENCRYPTION_WALLET_LOCATION`.
* TDE, Data Redaction, VPD, auditoría unificada y cifrado RMAN funcionan en la edición Free; no apareció ORA-00439.
* Las PK tienen nombre explícito (`PK_CLIENTES`, `PK_CLIENTES_DEV`, `PK_ACCESO_REGION`). `ALTER INDEX ... REBUILD ONLINE TABLESPACE` no dio ORA-01418.

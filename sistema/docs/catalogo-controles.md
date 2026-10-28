# Catálogo de controles, pruebas y pesos

> Archivo generado con `node herramientas/generar-catalogo-md.js` desde `src/catalogo/`. No se edita a mano.

## Riesgos y pesos

| Riesgo | Descripción | P | I | Nivel | Peso que otorga |
|---|---|---|---|---|---|
| R-CONF-01 | Privilegios excesivos y acceso no autorizado a datos sensibles | 4 | 5 | 20 | 10 |
| R-CONF-02 | Autenticación débil y cuentas por defecto | 4 | 4 | 16 | 8 |
| R-CONF-03 | Exposición de datos fuera de la base de datos | 3 | 5 | 15 | 8 |
| R-CONF-04 | Datos reales en entornos DEV/TEST | 4 | 4 | 16 | 8 |
| R-CONF-05 | Exposición en red y vulnerabilidades sin parchear | 3 | 4 | 12 | 6 |
| R-CONF-06 | Falta de trazabilidad y logs sin protección | 3 | 4 | 12 | 6 |

**Peso del control** = ⌈ mayor nivel de los riesgos que mitiga ÷ 2 ⌉.

**Corrección documentada:** la tabla de pesos del enunciado ubica A5.16 en 8, pero en la tabla 2 del informe A5.16 pertenece a T02, cuyo riesgo es R-CONF-01 (nivel 20). Con la regla "cuenta el riesgo de mayor nivel", A5.16 tiene peso **10**. La corrección está en un solo lugar: `src/catalogo/controles.js`.

## Fórmulas

- **Estado de una prueba:** `CUMPLE`, `PARCIAL`, `NO CUMPLE`, `NO EVALUABLE` (no se pudo consultar; con motivo) u `OMITIDA` (falta configuración opcional).
- **Estado del control:** promedio de sus pruebas evaluadas con 1 / 0,5 / 0. Promedio 1 → CUMPLE, 0 → NO CUMPLE, otro → PARCIAL. Sin pruebas evaluadas → NO EVALUABLE (u OMITIDA si todas se omitieron).
- **Puntaje global** = Σ(peso × valor) ÷ Σ(pesos de los controles evaluados) × 100. NO EVALUABLE y OMITIDA no entran.
- **Madurez (0–4):** NO CUMPLE = 0, o 1 si alguna prueba indica que algo está implementado; PARCIAL = 2; CUMPLE = 3. El 4 exige monitoreo continuo, que el sistema no mide.
- **Prioridad** = peso × brecha (1 si no cumple, 0,5 si es parcial), de mayor a menor; desempate por peso y luego por identificador. **Impacto** = peso × brecha ÷ Σ pesos evaluados × 100 (puntos que sube el puntaje si el control pasa a cumplir).

## Tareas del DBA

| Tarea | Nombre | Controles |
|---|---|---|
| T01 | Clasificación de datos sensibles | A5.12 |
| T02 | Gestión de usuarios y roles | A5.16, A5.18 |
| T03 | Privilegios y mínimo privilegio | A5.15, A8.2, A8.3 |
| T04 | Autenticación y perfiles de contraseña | A5.17, A8.5 |
| T05 | Cifrado en reposo (TDE) | A8.24 |
| T06 | Enmascaramiento y redacción de datos | A8.11 |
| T07 | Respaldos cifrados | A8.13 |
| T08 | Auditoría de la base de datos | A8.15 |
| T09 | Protección y retención de logs | A5.33 |
| T10 | Parcheo y gestión de vulnerabilidades | A8.8 |
| T11 | Seguridad del listener y la red | A8.20 |
| T12 | Eliminación segura de datos | A8.10 |
| T13 | Clones DEV/TEST | A8.33 |
| T14 | Prevención de fuga de datos (DLP) | A8.12 |

## Controles

| Control | Nombre | Tema | Tarea | Riesgos | Peso | Pruebas |
|---|---|---|---|---|---|---|
| A5.12 | Clasificación de la información | Organizacional | T01 | R-CONF-03, R-CONF-04 | 8 | A5.12-1, A5.12-2 |
| A5.15 | Control de acceso | Organizacional | T03 | R-CONF-01 | 10 | A5.15-1, A5.15-2, PB-12a, PB-12b |
| A5.16 | Gestión de identidades | Organizacional | T02 | R-CONF-01, R-CONF-02 | 10 | A5.16-1, A5.16-2 |
| A5.17 | Información de autenticación | Organizacional | T04 | R-CONF-02 | 8 | A5.17-1, A5.17-2, A5.17-3 |
| A5.18 | Derechos de acceso | Organizacional | T02 | R-CONF-01, R-CONF-02 | 10 | A5.18-1, A5.18-2 |
| A5.33 | Protección de los registros | Organizacional | T09 | R-CONF-06 | 6 | A5.33-1, A5.33-2 |
| A8.2 | Derechos de acceso privilegiado | Tecnológico | T03 | R-CONF-01 | 10 | A8.2-1, A8.2-2, A8.2-3 |
| A8.3 | Restricción del acceso a la información | Tecnológico | T03 | R-CONF-01 | 10 | A8.3-1, PB-06b |
| A8.5 | Autenticación segura | Tecnológico | T04 | R-CONF-02 | 8 | A8.5-1, A8.5-2 |
| A8.8 * | Gestión de vulnerabilidades técnicas | Tecnológico | T10 | R-CONF-05 | 6 | A8.8-1, A8.8-2 |
| A8.10 | Eliminación de información | Tecnológico | T12 | R-CONF-03 | 8 | A8.10-1, A8.10-2 |
| A8.11 | Enmascaramiento de datos | Tecnológico | T06 | R-CONF-03, R-CONF-04 | 8 | A8.11-1, PB-05b |
| A8.12 | Prevención de fuga de datos | Tecnológico | T14 | R-CONF-03 | 8 | A8.12-1, A8.12-2, A8.12-3 |
| A8.13 | Respaldo de la información | Tecnológico | T07 | R-CONF-03 | 8 | A8.13-1, A8.13-2 |
| A8.15 | Registro de eventos | Tecnológico | T08 | R-CONF-06 | 6 | A8.15-1, A8.15-2 |
| A8.20 | Seguridad de redes | Tecnológico | T11 | R-CONF-05 | 6 | A8.20-1 |
| A8.24 * | Uso de criptografía | Tecnológico | T05 | R-CONF-03 | 8 | A8.24-1, A8.24-2 |
| A8.33 * | Información de prueba | Tecnológico | T13 | R-CONF-04 | 8 | PB-10 |

\* Controles adicionales a los 15 de la asignación.

## Pruebas

### A5.12 · Clasificación de la información (peso 8)

#### A5.12-1 · Inventario de columnas sensibles y su protección

- **Tipo:** diccionario de datos · heurística, requiere revisión humana
- **Fuente:** nueva (heurística)
- **Qué comprueba:** HEURÍSTICA por nombre de columna: busca columnas como cédula, tarjeta, correo, teléfono o salario en esquemas de aplicación y revisa si están redactadas o cifradas. Requiere revisión humana.
- **Esperado:** Toda columna sensible detectada está redactada o cifrada.
- **Variables de enlace:** `:patron` = (patrón de nombres sensibles)

```sql
WITH sensibles AS (
  SELECT c.owner, c.table_name, c.column_name
    FROM dba_tab_columns c
    JOIN dba_tables t ON t.owner = c.owner AND t.table_name = c.table_name AND t.dropped = 'NO'
   WHERE c.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
     AND REGEXP_LIKE(c.column_name, :patron)
)
SELECT s.owner, s.table_name, s.column_name,
       CASE WHEN EXISTS (SELECT 1 FROM redaction_columns r
                          WHERE r.object_owner = s.owner AND r.object_name = s.table_name
                            AND r.column_name = s.column_name) THEN 'SI' ELSE 'NO' END redactada,
       CASE WHEN EXISTS (SELECT 1 FROM dba_encrypted_columns e
                          WHERE e.owner = s.owner AND e.table_name = s.table_name AND e.column_name = s.column_name)
              OR EXISTS (SELECT 1 FROM dba_tables t JOIN dba_tablespaces ts ON ts.tablespace_name = t.tablespace_name
                          WHERE t.owner = s.owner AND t.table_name = s.table_name AND ts.encrypted = 'YES')
            THEN 'SI' ELSE 'NO' END cifrada
  FROM sensibles s
 ORDER BY s.owner, s.table_name, s.column_name
```

**Recomendación si no cumple:**

```
Confirmar el inventario con el dueño de los datos y proteger cada columna sensible con redacción (I05) y cifrado (I04).
Scripts del laboratorio: ./ejecutar.sh implementacion I04 e I05
```

#### A5.12-2 · Etiquetas de clasificación en las columnas sensibles

- **Tipo:** diccionario de datos · heurística, requiere revisión humana
- **Fuente:** nueva (heurística)
- **Qué comprueba:** HEURÍSTICA: comprueba si cada columna sensible tiene un comentario de clasificación (CONFIDENCIAL, RESTRINGIDO, INTERNO, PÚBLICO) en DBA_COL_COMMENTS.
- **Esperado:** Cada columna sensible tiene un comentario con su nivel de clasificación.
- **Variables de enlace:** `:patron` = (patrón de nombres sensibles)

```sql
WITH sensibles AS (
  SELECT c.owner, c.table_name, c.column_name
    FROM dba_tab_columns c
    JOIN dba_tables t ON t.owner = c.owner AND t.table_name = c.table_name AND t.dropped = 'NO'
   WHERE c.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
     AND REGEXP_LIKE(c.column_name, :patron)
)
SELECT s.owner, s.table_name, s.column_name, m.comments comentario
  FROM sensibles s
  LEFT JOIN dba_col_comments m
         ON m.owner = s.owner AND m.table_name = s.table_name AND m.column_name = s.column_name
 ORDER BY s.owner, s.table_name, s.column_name
```

**Recomendación si no cumple:**

```
Registrar la clasificación de cada columna, por ejemplo con comentarios:
  COMMENT ON COLUMN segconf.clientes.tarjeta IS 'CONFIDENCIAL - dato de pago';
O mantener una tabla de inventario de clasificación revisada por el dueño de los datos.
```

### A5.15 · Control de acceso (peso 10)

#### A5.15-1 · Permisos directos a usuarios sobre objetos de aplicación

- **Tipo:** diccionario de datos
- **Fuente:** V03 (PB-03c)
- **Qué comprueba:** Permisos de objeto concedidos directamente a cuentas (no a roles) sobre tablas y vistas de esquemas de aplicación.
- **Esperado:** no rows selected: el acceso a los datos se concede solo mediante roles.

```sql
SELECT t.grantee, t.owner, t.table_name objeto, t.type tipo, t.privilege
  FROM dba_tab_privs t
 WHERE t.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
   AND t.grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
   AND t.grantee <> t.owner
 ORDER BY t.grantee, t.owner, t.table_name
```

**Recomendación si no cumple:**

```
Crear roles por función, conceder los permisos al rol y revocar los directos:
  CREATE ROLE rol_consulta_clientes;
  GRANT SELECT ON segconf.clientes TO rol_consulta_clientes;
  GRANT rol_consulta_clientes TO app_consulta;
  REVOKE SELECT ON segconf.clientes FROM app_consulta;
Script del laboratorio: ./ejecutar.sh implementacion I03
```

#### A5.15-2 · Permisos a PUBLIC sobre objetos de aplicación

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Cualquier permiso de objeto de un esquema de aplicación concedido a PUBLIC (todas las cuentas).
- **Esperado:** no rows selected.

```sql
SELECT t.owner, t.table_name objeto, t.type tipo, t.privilege
  FROM dba_tab_privs t
 WHERE t.grantee = 'PUBLIC'
   AND t.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
 ORDER BY t.owner, t.table_name
```

**Recomendación si no cumple:**

```
Revocar el permiso de PUBLIC y concederlo a un rol específico:
  REVOKE <privilegio> ON <esquema>.<objeto> FROM PUBLIC;
```

#### PB-12a · Prueba funcional: usuario sin acceso al detalle (1)

- **Tipo:** funcional (opcional)
- **Fuente:** V12 (PB-12a)
- **Qué comprueba:** Intenta leer la tabla de detalle como un usuario que no debería tener acceso.
- **Esperado:** ORA-00942 u ORA-01031: acceso denegado.

```sql
SELECT COUNT(*) filas FROM <esquema>.<tabla>
```

**Recomendación si no cumple:**

```
Revocar privilegios ANY y permisos directos, y dar a este usuario solo las vistas que necesita (A8.2-1, A5.15-1).
Script del laboratorio: ./ejecutar.sh implementacion I03
```

#### PB-12b · Prueba funcional: usuario sin acceso al detalle (2)

- **Tipo:** funcional (opcional)
- **Fuente:** V12 (PB-12b)
- **Qué comprueba:** Intenta leer la tabla de detalle como un segundo usuario no autorizado (p. ej. el esquema de desarrollo).
- **Esperado:** ORA-00942 u ORA-01031: acceso denegado.

```sql
SELECT COUNT(*) filas FROM <esquema>.<tabla>
```

**Recomendación si no cumple:**

```
Revocar el permiso residual (p. ej. el que quedó del clonado):
  REVOKE SELECT ON segconf.clientes FROM segconf_dev;
Script del laboratorio: ./ejecutar.sh implementacion I03
```

### A5.16 · Gestión de identidades (peso 10)

#### A5.16-1 · Cuentas abiertas sin uso reciente

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Cuentas de aplicación abiertas que nunca se usaron o sin acceso en más de 90 días (DBA_USERS.LAST_LOGIN).
- **Esperado:** Todas las cuentas abiertas tienen situación EN USO (último acceso en los últimos 90 días).
- **Variables de enlace:** `:dias` = 90

```sql
SELECT username, account_status, created,
       last_login,
       CASE WHEN last_login IS NULL THEN 'NUNCA USADA'
            WHEN last_login < SYSTIMESTAMP - NUMTODSINTERVAL(:dias, 'DAY') THEN 'INACTIVA'
            ELSE 'EN USO' END situacion
  FROM dba_users
 WHERE oracle_maintained = 'N'
   AND account_status = 'OPEN'
   AND username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
 ORDER BY situacion, username
```

**Recomendación si no cumple:**

```
Bloquear las cuentas sin uso, o configurar el bloqueo automático por inactividad:
  ALTER USER <cuenta> ACCOUNT LOCK;
  ALTER PROFILE prf_app LIMIT INACTIVE_ACCOUNT_TIME 90;
```

#### A5.16-2 · Cuentas expiradas sin depurar

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Cuentas de aplicación con contraseña expirada que siguen sin bloquear, o bloqueadas desde hace más de 90 días.
- **Esperado:** Ninguna cuenta expirada sin bloquear; las expiradas y bloqueadas no superan 90 días sin depurarse.

```sql
SELECT username, account_status, expiry_date, lock_date,
       TRUNC(SYSDATE - expiry_date) dias_expirada
  FROM dba_users
 WHERE oracle_maintained = 'N'
   AND account_status LIKE 'EXPIRED%'
   AND account_status NOT LIKE 'EXPIRED(GRACE)%'
 ORDER BY username
```

**Recomendación si no cumple:**

```
Bloquear las cuentas expiradas y eliminar las que ya no se necesiten:
  ALTER USER <cuenta> ACCOUNT LOCK;
  DROP USER <cuenta> CASCADE;  -- tras respaldar sus objetos si aplica
```

### A5.17 · Información de autenticación (peso 8)

#### A5.17-1 · Bloqueo por intentos fallidos

- **Tipo:** diccionario de datos
- **Fuente:** V02 (PB-02a)
- **Qué comprueba:** Perfil efectivo de cada cuenta de aplicación no bloqueada: FAILED_LOGIN_ATTEMPTS y PASSWORD_LOCK_TIME.
- **Esperado:** FAILED_LOGIN_ATTEMPTS entre 1 y 5 en todas las cuentas (DEFAULT se resuelve al valor del perfil DEFAULT).

```sql
SELECT u.username, u.profile,
       MAX(CASE WHEN p.resource_name = 'FAILED_LOGIN_ATTEMPTS' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) failed_login_attempts,
       MAX(CASE WHEN p.resource_name = 'PASSWORD_LOCK_TIME' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) password_lock_time
  FROM dba_users u
  JOIN dba_profiles p ON p.profile = u.profile
  JOIN dba_profiles d ON d.profile = 'DEFAULT' AND d.resource_name = p.resource_name
 WHERE u.oracle_maintained = 'N'
   AND u.account_status NOT LIKE '%LOCKED%'
   AND u.username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
   AND p.resource_name IN ('FAILED_LOGIN_ATTEMPTS', 'PASSWORD_LOCK_TIME')
 GROUP BY u.username, u.profile
 ORDER BY u.username
```

**Recomendación si no cumple:**

```
Crear un perfil con límites y asignarlo a las cuentas de aplicación:
  CREATE PROFILE prf_app LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24;
  ALTER USER <cuenta> PROFILE prf_app;
Script del laboratorio: ./ejecutar.sh implementacion I02
```

#### A5.17-2 · Vencimiento de contraseñas

- **Tipo:** diccionario de datos
- **Fuente:** V02 (PB-02c)
- **Qué comprueba:** PASSWORD_LIFE_TIME y PASSWORD_GRACE_TIME efectivos de cada cuenta de aplicación no bloqueada.
- **Esperado:** PASSWORD_LIFE_TIME de 90 días o menos en todas las cuentas.

```sql
SELECT u.username, u.profile,
       MAX(CASE WHEN p.resource_name = 'PASSWORD_LIFE_TIME' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) password_life_time,
       MAX(CASE WHEN p.resource_name = 'PASSWORD_GRACE_TIME' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) password_grace_time
  FROM dba_users u
  JOIN dba_profiles p ON p.profile = u.profile
  JOIN dba_profiles d ON d.profile = 'DEFAULT' AND d.resource_name = p.resource_name
 WHERE u.oracle_maintained = 'N'
   AND u.account_status NOT LIKE '%LOCKED%'
   AND u.username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
   AND p.resource_name IN ('PASSWORD_LIFE_TIME', 'PASSWORD_GRACE_TIME')
 GROUP BY u.username, u.profile
 ORDER BY u.username
```

**Recomendación si no cumple:**

```
Definir el vencimiento en el perfil de las cuentas:
  ALTER PROFILE prf_app LIMIT PASSWORD_LIFE_TIME 90 PASSWORD_GRACE_TIME 7;
Script del laboratorio: ./ejecutar.sh implementacion I02
```

#### A5.17-3 · Función de verificación de complejidad

- **Tipo:** diccionario de datos
- **Fuente:** V02 (PB-02b)
- **Qué comprueba:** PASSWORD_VERIFY_FUNCTION efectiva de cada cuenta de aplicación no bloqueada.
- **Esperado:** Todas las cuentas tienen una función de verificación (p. ej. ORA12C_STRONG_VERIFY_FUNCTION).

```sql
SELECT u.username, u.profile,
       MAX(CASE WHEN p.resource_name = 'PASSWORD_VERIFY_FUNCTION' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) password_verify_function
  FROM dba_users u
  JOIN dba_profiles p ON p.profile = u.profile
  JOIN dba_profiles d ON d.profile = 'DEFAULT' AND d.resource_name = p.resource_name
 WHERE u.oracle_maintained = 'N'
   AND u.account_status NOT LIKE '%LOCKED%'
   AND u.username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
   AND p.resource_name IN ('PASSWORD_VERIFY_FUNCTION')
 GROUP BY u.username, u.profile
 ORDER BY u.username
```

**Recomendación si no cumple:**

```
Asignar una función de verificación en el perfil:
  ALTER PROFILE prf_app LIMIT PASSWORD_VERIFY_FUNCTION ORA12C_STRONG_VERIFY_FUNCTION;
Revise también el perfil DEFAULT, que usan las cuentas sin perfil propio (p. ej. PDBADMIN).
Script del laboratorio: ./ejecutar.sh implementacion I02
```

### A5.18 · Derechos de acceso (peso 10)

#### A5.18-1 · Cuentas de demostración bloqueadas

- **Tipo:** diccionario de datos
- **Fuente:** V01 (PB-01a)
- **Qué comprueba:** Busca cuentas de ejemplo conocidas (SCOTT, HR, OE, SH...) que sigan abiertas.
- **Esperado:** Ninguna cuenta de demostración con estado OPEN (todas inexistentes o LOCKED).

```sql
SELECT username, account_status, created, lock_date
  FROM dba_users
 WHERE username IN ('SCOTT', 'ADAMS', 'JONES', 'CLARK', 'BLAKE', 'HR', 'OE', 'PM', 'IX', 'SH', 'BI', 'CO', 'DEMO', 'SAMPLE')
 ORDER BY username
```

**Recomendación si no cumple:**

```
Bloquear y expirar las cuentas de demostración, o eliminarlas si no se usan:
  ALTER USER scott ACCOUNT LOCK PASSWORD EXPIRE;
  -- o: DROP USER scott CASCADE;
Script del laboratorio: ./ejecutar.sh implementacion I01
```

#### A5.18-2 · Cuentas abiertas con contraseña por defecto

- **Tipo:** diccionario de datos
- **Fuente:** V01 (PB-01b)
- **Qué comprueba:** Cruza DBA_USERS_WITH_DEFPWD con las cuentas no bloqueadas.
- **Esperado:** Ninguna cuenta no bloqueada conserva su contraseña por defecto (no rows selected).

```sql
SELECT d.username, u.account_status, u.oracle_maintained
  FROM dba_users_with_defpwd d
  JOIN dba_users u ON u.username = d.username
 WHERE u.account_status NOT LIKE '%LOCKED%'
 ORDER BY d.username
```

**Recomendación si no cumple:**

```
Cambiar la contraseña o bloquear cada cuenta listada:
  ALTER USER <cuenta> IDENTIFIED BY "<clave nueva>";
  ALTER USER <cuenta> ACCOUNT LOCK PASSWORD EXPIRE;
Script del laboratorio: ./ejecutar.sh implementacion I01
```

### A5.33 · Protección de los registros (peso 6)

#### A5.33-1 · Separación de funciones sobre la traza de auditoría

- **Tipo:** diccionario de datos · requiere la opción "Unified Auditing" en V$OPTION
- **Fuente:** nueva
- **Qué comprueba:** Quién tiene AUDIT_VIEWER (leer) y AUDIT_ADMIN (administrar y purgar) entre las cuentas y roles del cliente.
- **Esperado:** Existe una cuenta auditora (distinta de la de esta herramienta) con AUDIT_VIEWER; ningún dueño de datos tiene AUDIT_ADMIN ni AUDIT_VIEWER.

```sql
SELECT rp.grantee, rp.granted_role, rp.admin_option,
       (SELECT COUNT(*) FROM dba_tables t WHERE t.owner = rp.grantee) tablas_propias,
       CASE WHEN rp.grantee = SYS_CONTEXT('USERENV', 'SESSION_USER') THEN 'SI' ELSE 'NO' END cuenta_auditoria
  FROM dba_role_privs rp
 WHERE rp.granted_role IN ('AUDIT_ADMIN', 'AUDIT_VIEWER')
   AND (rp.grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N') OR rp.grantee IN (SELECT role FROM dba_roles WHERE oracle_maintained = 'N'))
 ORDER BY rp.granted_role, rp.grantee
```

**Recomendación si no cumple:**

```
Asignar la lectura de la traza a una cuenta auditora dedicada y no dar AUDIT_ADMIN a dueños de datos:
  GRANT AUDIT_VIEWER TO app_auditor;
  REVOKE AUDIT_ADMIN FROM <dueño de datos>;
Script del laboratorio: ./ejecutar.sh implementacion I07
```

#### A5.33-2 · Retención y archivo de la traza

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Tareas de purga programadas, marcas de archivo y tablespace de la traza unificada (DBMS_AUDIT_MGMT).
- **Esperado:** Una tarea de purga habilitada y una marca de archivo: la traza se conserva durante un periodo definido y se archiva antes de purgarse.

```sql
SELECT 'TAREA DE PURGA' tipo, job_name nombre, job_status estado, TO_CHAR(job_frequency) detalle
  FROM dba_audit_mgmt_cleanup_jobs
 WHERE audit_trail IN ('UNIFIED AUDIT TRAIL', 'ALL AUDIT TRAILS')
UNION ALL
SELECT 'MARCA DE ARCHIVO', audit_trail, TO_CHAR(last_archive_ts, 'YYYY-MM-DD HH24:MI'), 'instancia ' || rac_instance
  FROM dba_audit_mgmt_last_arch_ts
UNION ALL
SELECT 'TABLESPACE DE LA TRAZA', audit_trail, parameter_value, parameter_name
  FROM dba_audit_mgmt_config_params
 WHERE audit_trail = 'UNIFIED AUDIT TRAIL' AND parameter_name = 'DB AUDIT TABLESPACE'
```

**Recomendación si no cumple:**

```
Definir la retención con DBMS_AUDIT_MGMT (archivar primero y luego purgar lo ya archivado):
  BEGIN DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP(DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, SYSTIMESTAMP - INTERVAL '365' DAY); END;
  BEGIN DBMS_AUDIT_MGMT.CREATE_PURGE_JOB(DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, 24, 'PURGA_TRAZA', TRUE); END;
```

### A8.2 · Derechos de acceso privilegiado (peso 10)

#### A8.2-1 · Privilegios ANY en cuentas o roles no administrativos

- **Tipo:** diccionario de datos
- **Fuente:** V03 (PB-03a)
- **Qué comprueba:** Privilegios de sistema con ANY (SELECT ANY TABLE, etc.) concedidos a cuentas o roles creados por el cliente.
- **Esperado:** no rows selected: ninguna cuenta ni rol propio tiene privilegios ANY.

```sql
SELECT p.grantee,
       CASE WHEN r.role IS NOT NULL THEN 'ROL' ELSE 'USUARIO' END tipo,
       p.privilege, p.admin_option
  FROM dba_sys_privs p
  LEFT JOIN dba_roles r ON r.role = p.grantee
 WHERE p.privilege LIKE '% ANY %'
   AND (p.grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N') OR p.grantee IN (SELECT role FROM dba_roles WHERE oracle_maintained = 'N'))
 ORDER BY p.grantee, p.privilege
```

**Recomendación si no cumple:**

```
Revocar el privilegio y conceder solo los objetos necesarios mediante roles:
  REVOKE SELECT ANY TABLE FROM app_reportes;
  GRANT SELECT ON segconf.v_clientes_resumen TO rol_reportes;
Script del laboratorio: ./ejecutar.sh implementacion I03
```

#### A8.2-2 · Titulares de roles administrativos (DBA y similares)

- **Tipo:** diccionario de datos
- **Fuente:** V03 y nueva
- **Qué comprueba:** Cuentas de aplicación con DBA, PDB_DBA o roles de exportación/importación completa, y si además son dueñas de tablas.
- **Esperado:** Ningún esquema de aplicación (dueño de tablas) tiene roles administrativos; como máximo 2 cuentas administrativas nominales.

```sql
SELECT rp.grantee, rp.granted_role, rp.admin_option,
       (SELECT COUNT(*) FROM dba_tables t WHERE t.owner = rp.grantee) tablas_propias
  FROM dba_role_privs rp
 WHERE rp.granted_role IN ('DBA', 'PDB_DBA', 'DATAPUMP_EXP_FULL_DATABASE', 'DATAPUMP_IMP_FULL_DATABASE',
                           'EXP_FULL_DATABASE', 'IMP_FULL_DATABASE')
   AND rp.grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
 ORDER BY rp.grantee, rp.granted_role
```

**Recomendación si no cumple:**

```
Revocar los roles administrativos a esquemas de aplicación y usar cuentas administrativas nominales:
  REVOKE DBA FROM <esquema>;
```

#### A8.2-3 · Usuarios con privilegios administrativos SYS*

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Usuarios del archivo de contraseñas con SYSDBA, SYSOPER, SYSBACKUP, SYSDG o SYSKM (V$PWFILE_USERS).
- **Esperado:** Solo SYS con SYSDBA/SYSOPER; otros privilegios SYS* solo en cuentas dedicadas (SYSBACKUP, SYSKM...).

```sql
SELECT username, sysdba, sysoper, sysbackup, sysdg, syskm, account_status
  FROM v$pwfile_users
 ORDER BY username
```

**Recomendación si no cumple:**

```
Retirar SYSDBA a cuentas que no lo necesitan y usar privilegios específicos (SYSBACKUP, SYSKM):
  REVOKE SYSDBA FROM <cuenta>;
```

### A8.3 · Restricción del acceso a la información (peso 10)

#### A8.3-1 · Políticas VPD (control por fila) habilitadas

- **Tipo:** diccionario de datos · requiere la opción "Fine-grained access control" en V$OPTION
- **Fuente:** V06 (PB-06a)
- **Qué comprueba:** Políticas de Virtual Private Database sobre objetos de aplicación (DBA_POLICIES).
- **Esperado:** Al menos una política habilitada (ENABLE = YES) que filtre las filas por usuario.

```sql
SELECT object_owner, object_name, policy_name,
       pf_owner || '.' || NVL2(package, package || '.', '') || function funcion,
       sel, ins, upd, del, enable
  FROM dba_policies
 WHERE object_owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
 ORDER BY object_owner, object_name
```

**Recomendación si no cumple:**

```
Crear una función de predicado y registrarla con DBMS_RLS:
  BEGIN DBMS_RLS.ADD_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES',
    policy_name => 'POL_VPD_CLIENTES', function_schema => 'SEGCONF',
    policy_function => 'PKG_SEGURIDAD.PRED_CLIENTES', statement_types => 'SELECT,INSERT,UPDATE,DELETE',
    update_check => TRUE); END;
Script del laboratorio: ./ejecutar.sh implementacion I06
```

#### PB-06b · Prueba funcional: el usuario restringido ve solo sus filas

- **Tipo:** funcional (opcional)
- **Fuente:** V06 (PB-06b)
- **Qué comprueba:** Cuenta filas (y valores distintos de la columna de segmentación) como el usuario restringido y como la cuenta de referencia.
- **Esperado:** El usuario restringido ve menos filas que la cuenta de referencia.

```sql
SELECT COUNT(*) filas, COUNT(DISTINCT <columna de segmentación>) valores FROM <esquema>.<tabla>
```

**Recomendación si no cumple:**

```
Crear o corregir la política VPD de la tabla (ver A8.3-1).
Script del laboratorio: ./ejecutar.sh implementacion I06
```

### A8.5 · Autenticación segura (peso 8)

#### A8.5-1 · Versiones del hash de contraseña

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** PASSWORD_VERSIONS de cada cuenta de aplicación no bloqueada con autenticación por contraseña.
- **Esperado:** Solo la versión 12C (SHA-2 con PBKDF2). 10G (DES) no debe aparecer; 11G (SHA-1) es aceptable pero mejorable.

```sql
SELECT username, password_versions, authentication_type
  FROM dba_users
 WHERE oracle_maintained = 'N'
   AND account_status NOT LIKE '%LOCKED%'
   AND authentication_type = 'PASSWORD'
   AND username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
 ORDER BY username
```

**Recomendación si no cumple:**

```
En el sqlnet.ora del servidor, aceptar solo verificadores modernos y luego cambiar las contraseñas para regenerar los hashes:
  SQLNET.ALLOWED_LOGON_VERSION_SERVER = 12a
  ALTER USER <cuenta> IDENTIFIED BY "<clave nueva>";
```

#### A8.5-2 · Perfiles en uso sin verificación de complejidad

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Agrupa las cuentas de aplicación no bloqueadas por perfil y muestra la función de verificación efectiva.
- **Esperado:** Ningún perfil en uso tiene PASSWORD_VERIFY_FUNCTION en NULL.

```sql
SELECT u.profile,
       NVL(DECODE(p.limit, 'DEFAULT', d.limit, p.limit), 'NULL') password_verify_function,
       COUNT(*) cuentas,
       LISTAGG(u.username, ', ') WITHIN GROUP (ORDER BY u.username) usuarios
  FROM dba_users u
  JOIN dba_profiles p ON p.profile = u.profile AND p.resource_name = 'PASSWORD_VERIFY_FUNCTION'
  JOIN dba_profiles d ON d.profile = 'DEFAULT' AND d.resource_name = 'PASSWORD_VERIFY_FUNCTION'
 WHERE u.oracle_maintained = 'N'
   AND u.account_status NOT LIKE '%LOCKED%'
   AND u.username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
 GROUP BY u.profile, NVL(DECODE(p.limit, 'DEFAULT', d.limit, p.limit), 'NULL')
 ORDER BY u.profile
```

**Recomendación si no cumple:**

```
Configurar la función de verificación en cada perfil listado, incluido DEFAULT si está en uso:
  ALTER PROFILE DEFAULT LIMIT PASSWORD_VERIFY_FUNCTION ORA12C_STRONG_VERIFY_FUNCTION;
O asignar a esas cuentas un perfil propio: ALTER USER <cuenta> PROFILE prf_app;
```

### A8.8 · Gestión de vulnerabilidades técnicas (peso 6)

#### A8.8-1 · Versión del motor con soporte

- **Tipo:** diccionario de datos
- **Fuente:** V00
- **Qué comprueba:** Versión completa de la instancia (V$INSTANCE) y banner del producto (V$VERSION).
- **Esperado:** Versión principal 19 o 23 (26ai), ambas con soporte vigente.

```sql
SELECT i.version_full, i.instance_name, v.banner_full
  FROM v$instance i
 CROSS JOIN v$version v
```

**Recomendación si no cumple:**

```
Planificar la actualización a una versión con soporte (19c o 23ai/26ai) según la política de Oracle.
```

#### A8.8-2 · Parches aplicados y antigüedad

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Historial de parches SQL (DBA_REGISTRY_SQLPATCH). En Oracle Free suele estar vacío porque se actualiza reemplazando la imagen.
- **Esperado:** Último parche aplicado con éxito hace 120 días o menos.

```sql
SELECT patch_id, patch_type, action, status, action_time,
       TRUNC(SYSDATE - CAST(action_time AS DATE)) dias, description
  FROM dba_registry_sqlpatch
 ORDER BY action_time DESC
 FETCH FIRST 10 ROWS ONLY
```

**Recomendación si no cumple:**

```
Aplicar la última Release Update trimestral (OPatch + datapatch) y documentar el proceso. En Oracle Free, recrear el contenedor con la imagen más reciente conservando el volumen de datos.
```

### A8.10 · Eliminación de información (peso 8)

#### A8.10-1 · Objetos en la papelera de reciclaje

- **Tipo:** diccionario de datos
- **Fuente:** V11 (PB-11a)
- **Qué comprueba:** Objetos borrados de esquemas de aplicación que siguen recuperables en DBA_RECYCLEBIN (con sus datos).
- **Esperado:** no rows selected.

```sql
SELECT owner, original_name, object_name, type, droptime
  FROM dba_recyclebin
 WHERE owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
 ORDER BY droptime
```

**Recomendación si no cumple:**

```
Purgar los objetos y borrar en adelante con PURGE:
  PURGE TABLE <esquema>."<nombre BIN$...>";
  DROP TABLE <tabla> PURGE;
Script del laboratorio: ./ejecutar.sh implementacion I11
```

#### A8.10-2 · Copias temporales olvidadas

- **Tipo:** diccionario de datos
- **Fuente:** V11 (PB-11b)
- **Qué comprueba:** Tablas de aplicación con nombres típicos de copias (%_TMP, %_TEMP, %_BAK, %_OLD, %_RESPALDO%, %_EXPORT%, %_COPIA%).
- **Esperado:** no rows selected.

```sql
SELECT owner, table_name, tablespace_name, num_rows
  FROM dba_tables
 WHERE owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
   AND dropped = 'NO'
   AND (table_name LIKE '%\_TMP' ESCAPE '\' OR table_name LIKE '%\_TEMP' ESCAPE '\'
        OR table_name LIKE '%\_BAK' ESCAPE '\' OR table_name LIKE '%\_OLD' ESCAPE '\'
        OR table_name LIKE '%\_RESPALDO%' ESCAPE '\' OR table_name LIKE '%\_EXPORT%' ESCAPE '\'
        OR table_name LIKE '%\_COPIA%' ESCAPE '\')
 ORDER BY owner, table_name
```

**Recomendación si no cumple:**

```
Eliminar las copias que ya no se usan, sin dejarlas en la papelera:
  DROP TABLE <esquema>.<tabla> PURGE;
Script del laboratorio: ./ejecutar.sh implementacion I11
```

### A8.11 · Enmascaramiento de datos (peso 8)

#### A8.11-1 · Políticas de Data Redaction habilitadas

- **Tipo:** diccionario de datos · requiere la opción "Data Redaction" en V$OPTION
- **Fuente:** V05 (PB-05a)
- **Qué comprueba:** Políticas de redacción sobre objetos de esquemas de aplicación (REDACTION_POLICIES).
- **Esperado:** Al menos una política habilitada (YES) sobre las tablas con datos sensibles.

```sql
SELECT r.object_owner, r.object_name, r.policy_name, TRIM(r.enable) habilitada,
       (SELECT COUNT(*) FROM redaction_columns c
         WHERE c.object_owner = r.object_owner AND c.object_name = r.object_name) columnas
  FROM redaction_policies r
 WHERE r.object_owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
 ORDER BY r.object_owner, r.object_name
```

**Recomendación si no cumple:**

```
Crear una política de redacción con DBMS_REDACT sobre las columnas sensibles:
  BEGIN DBMS_REDACT.ADD_POLICY(object_schema => 'SEGCONF', object_name => 'CLIENTES',
    policy_name => 'POL_RED_CLIENTES', column_name => 'TARJETA', function_type => DBMS_REDACT.PARTIAL,
    function_parameters => DBMS_REDACT.REDACT_CCN16_F12,
    expression => q'[SYS_CONTEXT('USERENV','SESSION_USER') <> 'SEGCONF']'); END;
Script del laboratorio: ./ejecutar.sh implementacion I05
```

#### PB-05b · Prueba funcional: el usuario ve los datos redactados

- **Tipo:** funcional (opcional)
- **Fuente:** V05 (PB-05b)
- **Qué comprueba:** Consulta una fila como el usuario de atención y, con la cuenta de referencia, compara cada valor visto con el real sin mostrarlo (IGUAL / DISTINTO).
- **Esperado:** Todas las columnas sensibles DISTINTO del valor real (redactadas).

```sql
SELECT <clave>, <columnas sensibles> FROM <esquema>.<tabla> ORDER BY <clave> FETCH FIRST 1 ROWS ONLY
-- y como referencia: SELECT CASE WHEN <columna> = :valor_visto THEN 'IGUAL' ELSE 'DISTINTO' END ...
```

**Recomendación si no cumple:**

```
Crear o corregir la política de Data Redaction de la tabla (ver A8.11-1).
Script del laboratorio: ./ejecutar.sh implementacion I05
```

### A8.12 · Prevención de fuga de datos (peso 8)

#### A8.12-1 · Paquetes UTL_* ejecutables por PUBLIC

- **Tipo:** diccionario de datos
- **Fuente:** V03 (PB-03b)
- **Qué comprueba:** EXECUTE para PUBLIC sobre UTL_FILE, UTL_HTTP, UTL_SMTP, UTL_TCP y UTL_INADDR.
- **Esperado:** no rows selected.

```sql
SELECT p.table_name paquete, p.grantee, p.privilege
  FROM dba_tab_privs p
 WHERE p.grantee = 'PUBLIC'
   AND p.owner = 'SYS'
   AND p.privilege = 'EXECUTE'
   AND p.table_name IN ('UTL_FILE', 'UTL_HTTP', 'UTL_SMTP', 'UTL_TCP', 'UTL_INADDR')
 ORDER BY p.table_name
```

**Recomendación si no cumple:**

```
Revocar EXECUTE de PUBLIC (antes, conceder el permiso directo a los esquemas de Oracle que lo usan):
  REVOKE EXECUTE ON sys.utl_file FROM PUBLIC;
  REVOKE EXECUTE ON sys.utl_http FROM PUBLIC;
Script del laboratorio: ./ejecutar.sh implementacion I03
```

#### A8.12-2 · Enlaces de base de datos

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Enlaces públicos o de esquemas de aplicación (DBA_DB_LINKS), que pueden copiar datos hacia otra base.
- **Esperado:** Sin enlaces públicos; los enlaces privados deben estar justificados.

```sql
SELECT owner, db_link, username, host, created
  FROM dba_db_links
 WHERE owner = 'PUBLIC' OR owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
 ORDER BY owner, db_link
```

**Recomendación si no cumple:**

```
Eliminar los enlaces que no sean necesarios:
  DROP PUBLIC DATABASE LINK <enlace>;
  DROP DATABASE LINK <enlace>;  -- conectado como el dueño
```

#### A8.12-3 · Directorios con permisos para cuentas no administrativas

- **Tipo:** diccionario de datos
- **Fuente:** nueva
- **Qué comprueba:** Objetos DIRECTORY (DBA_DIRECTORIES) con permisos de lectura o escritura para PUBLIC o cuentas/roles del cliente.
- **Esperado:** Ningún directorio escribible por PUBLIC; escritura solo para cuentas justificadas.

```sql
SELECT d.directory_name, d.directory_path, p.grantee, p.privilege
  FROM dba_directories d
  JOIN dba_tab_privs p ON p.table_name = d.directory_name AND p.type = 'DIRECTORY'
 WHERE p.grantee = 'PUBLIC'
    OR p.grantee IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
    OR p.grantee IN (SELECT role FROM dba_roles WHERE oracle_maintained = 'N')
 ORDER BY d.directory_name, p.grantee, p.privilege
```

**Recomendación si no cumple:**

```
Revocar los permisos que no se necesiten:
  REVOKE WRITE ON DIRECTORY <directorio> FROM <cuenta>;
```

### A8.13 · Respaldo de la información (peso 8)

#### A8.13-1 · Modo ARCHIVELOG

- **Tipo:** diccionario de datos
- **Fuente:** V09 (PB-09a)
- **Qué comprueba:** Modo de registro de la base (V$DATABASE): sin ARCHIVELOG no hay respaldos en caliente ni recuperación a un punto en el tiempo.
- **Esperado:** LOG_MODE = ARCHIVELOG.

```sql
SELECT name, log_mode, force_logging, created
  FROM v$database
```

**Recomendación si no cumple:**

```
Activar ARCHIVELOG (requiere reiniciar la instancia):
  SHUTDOWN IMMEDIATE
  STARTUP MOUNT
  ALTER DATABASE ARCHIVELOG;
  ALTER DATABASE OPEN;
Script del laboratorio: ./ejecutar.sh implementacion I09
```

#### A8.13-2 · Respaldos recientes y cifrados

- **Tipo:** diccionario de datos
- **Fuente:** V09 (PB-09b)
- **Qué comprueba:** Piezas de respaldo RMAN vigentes (V$BACKUP_PIECE, estado A). Desde la PDB se ven las piezas de toda la CDB registradas en el archivo de control.
- **Esperado:** Al menos una pieza de los últimos 30 días y todas las piezas vigentes cifradas (ENCRYPTED = YES).

```sql
SELECT recid, tag, encrypted, status, completion_time,
       TRUNC(SYSDATE - completion_time) dias, ROUND(bytes / 1048576) mb, con_id
  FROM v$backup_piece
 WHERE status = 'A'
 ORDER BY completion_time DESC
 FETCH FIRST 20 ROWS ONLY
```

**Recomendación si no cumple:**

```
Configurar RMAN con cifrado y respaldar periódicamente:
  RMAN> CONFIGURE ENCRYPTION FOR DATABASE ON;
  RMAN> CONFIGURE ENCRYPTION ALGORITHM 'AES256';
  RMAN> BACKUP DATABASE PLUS ARCHIVELOG TAG 'DIARIO_CIFRADO';
Script del laboratorio: ./ejecutar.sh implementacion I09
```

### A8.15 · Registro de eventos (peso 6)

#### A8.15-1 · Políticas de auditoría unificada sobre datos de aplicación

- **Tipo:** diccionario de datos · requiere la opción "Unified Auditing" en V$OPTION
- **Fuente:** V07 (PB-07a)
- **Qué comprueba:** Políticas habilitadas (AUDIT_UNIFIED_ENABLED_POLICIES) y cuántos objetos de aplicación cubre cada una.
- **Esperado:** Al menos una política habilitada que audite objetos de aplicación (OBJETOS_APLICACION > 0).

```sql
SELECT e.policy_name, e.enabled_option, e.entity_name, e.success, e.failure,
       (SELECT COUNT(*) FROM audit_unified_policies p
         WHERE p.policy_name = e.policy_name
           AND p.object_schema IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')) objetos_aplicacion
  FROM audit_unified_enabled_policies e
 ORDER BY objetos_aplicacion DESC, e.policy_name
```

**Recomendación si no cumple:**

```
Crear y habilitar una política sobre las tablas sensibles:
  CREATE AUDIT POLICY pol_aud_clientes ACTIONS SELECT ON segconf.clientes, UPDATE ON segconf.clientes;
  AUDIT POLICY pol_aud_clientes;
Script del laboratorio: ./ejecutar.sh implementacion I07
```

#### A8.15-2 · Registros recientes de acceso a datos de aplicación

- **Tipo:** diccionario de datos · requiere la opción "Unified Auditing" en V$OPTION
- **Fuente:** V07 (PB-07b)
- **Qué comprueba:** Eventos SELECT/INSERT/UPDATE/DELETE sobre objetos de aplicación en UNIFIED_AUDIT_TRAIL en los últimos 30 días.
- **Esperado:** Al menos un registro de acceso a datos de aplicación en los últimos 30 días.
- **Variables de enlace:** `:dias` = 30

```sql
SELECT object_schema, object_name, action_name, COUNT(*) registros, MAX(event_timestamp) ultimo
  FROM unified_audit_trail
 WHERE event_timestamp > SYSTIMESTAMP - NUMTODSINTERVAL(:dias, 'DAY')
   AND object_schema IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
   AND action_name IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
 GROUP BY object_schema, object_name, action_name
 ORDER BY registros DESC
 FETCH FIRST 15 ROWS ONLY
```

**Recomendación si no cumple:**

```
Habilitar la política de auditoría (A8.15-1) y verificar con una consulta de prueba que aparezca en UNIFIED_AUDIT_TRAIL.
Script del laboratorio: ./ejecutar.sh implementacion I07
```

### A8.20 · Seguridad de redes (peso 6)

#### A8.20-1 · Cifrado e integridad de la sesión de red

- **Tipo:** diccionario de datos
- **Fuente:** V08 (PB-08a)
- **Qué comprueba:** Servicios de red negociados por la propia sesión de auditoría (V$SESSION_CONNECT_INFO). El cliente del sistema solo acepta cifrado (ACCEPTED), así que si aparece es porque el servidor lo exige o lo pide.
- **Esperado:** Aparecen un adaptador de cifrado (p. ej. AES256) y uno de integridad (p. ej. SHA512).

```sql
SELECT network_service_banner
  FROM v$session_connect_info
 WHERE sid = SYS_CONTEXT('USERENV', 'SID')
```

**Recomendación si no cumple:**

```
Exigir cifrado nativo e integridad en el sqlnet.ora del servidor:
  SQLNET.ENCRYPTION_SERVER = REQUIRED
  SQLNET.ENCRYPTION_TYPES_SERVER = (AES256, AES192)
  SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED
  SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER = (SHA512, SHA384, SHA256)
O configurar TLS (TCPS). Script del laboratorio: ./ejecutar.sh implementacion I08
```

### A8.24 · Uso de criptografía (peso 8)

#### A8.24-1 · Keystore TDE abierto

- **Tipo:** diccionario de datos · requiere la opción "Transparent Data Encryption" en V$OPTION
- **Fuente:** V04 (PB-04a)
- **Qué comprueba:** Estado del keystore de Transparent Data Encryption visible desde el contenedor auditado.
- **Esperado:** STATUS = OPEN.

```sql
SELECT con_id, wrl_type, status, wallet_type, keystore_mode
  FROM v$encryption_wallet
 ORDER BY con_id
```

**Recomendación si no cumple:**

```
Configurar WALLET_ROOT, crear el keystore, abrirlo y definir la clave maestra:
  ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "<clave>";
  ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "<clave>" CONTAINER = ALL;
  ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "<clave>" WITH BACKUP CONTAINER = ALL;
Scripts del laboratorio: ./ejecutar.sh implementacion I04a y I04
```

#### A8.24-2 · Tablas con datos sensibles cifradas en reposo

- **Tipo:** diccionario de datos
- **Fuente:** V04 (PB-04b, PB-04c)
- **Qué comprueba:** Tablas de aplicación con columnas de nombre sensible y si su tablespace o sus columnas están cifrados.
- **Esperado:** Todas las tablas listadas en tablespace cifrado (YES) o con columnas cifradas.
- **Variables de enlace:** `:patron` = (patrón de nombres sensibles)

```sql
WITH sensibles AS (
  SELECT c.owner, c.table_name, c.column_name
    FROM dba_tab_columns c
    JOIN dba_tables t ON t.owner = c.owner AND t.table_name = c.table_name AND t.dropped = 'NO'
   WHERE c.owner IN (SELECT username FROM dba_users WHERE oracle_maintained = 'N')
     AND REGEXP_LIKE(c.column_name, :patron)
)
SELECT s.owner, s.table_name, t.tablespace_name, NVL(ts.encrypted, 'N/D') tablespace_cifrado,
       (SELECT COUNT(*) FROM dba_encrypted_columns e
         WHERE e.owner = s.owner AND e.table_name = s.table_name) columnas_cifradas
  FROM (SELECT DISTINCT owner, table_name FROM sensibles) s
  JOIN dba_tables t ON t.owner = s.owner AND t.table_name = s.table_name
  LEFT JOIN dba_tablespaces ts ON ts.tablespace_name = t.tablespace_name
 ORDER BY s.owner, s.table_name
```

**Recomendación si no cumple:**

```
Mover las tablas a un tablespace cifrado o cifrar el tablespace en línea:
  CREATE TABLESPACE ts_datos_enc DATAFILE SIZE 100M ENCRYPTION USING 'AES256' ENCRYPT;
  ALTER TABLE <esquema>.<tabla> MOVE ONLINE TABLESPACE ts_datos_enc;
  -- o: ALTER TABLESPACE users ENCRYPTION ONLINE USING 'AES256' ENCRYPT;
Script del laboratorio: ./ejecutar.sh implementacion I04
```

### A8.33 · Información de prueba (peso 8)

#### PB-10 · Prueba funcional: el clon no contiene datos reales

- **Tipo:** funcional (opcional)
- **Fuente:** V10 (PB-10)
- **Qué comprueba:** La cuenta de referencia (dueña de producción) y la cuenta del clon calculan un hash con sal aleatoria de cada columna sensible; el sistema empareja las filas por la clave y cuenta las que tienen algún dato idéntico. No se leen ni se guardan valores reales, y la sal solo existe en memoria durante la prueba.
- **Esperado:** Ninguna fila emparejada del clon con un dato idéntico a producción.

```sql
SELECT <clave>, STANDARD_HASH(:sal || TO_CHAR(<columna>), 'SHA256') ... FROM <tabla> ORDER BY <clave> FETCH FIRST 5000 ROWS ONLY
-- en producción (cuenta de referencia) y en el clon
```

**Recomendación si no cumple:**

```
Enmascarar el clon de forma irreversible antes de entregarlo a desarrollo:
  UPDATE segconf_dev.clientes SET cedula = '9-' || LPAD(id_cliente, 4, '0') || ..., email = 'cliente' || id_cliente || '@ejemplo.invalid', ...;
Script del laboratorio: ./ejecutar.sh implementacion I10
```

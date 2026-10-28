'use strict';
// Pruebas de diccionario: consultas fijas de solo lectura, generalizadas para cualquier base Oracle.
// Los esquemas de aplicación son los que Oracle no mantiene (DBA_USERS.ORACLE_MAINTAINED = 'N').
// Las pruebas de cuentas excluyen la cuenta con la que se conecta el sistema (SESSION_USER, p. ej. ISO_AUDIT):
// la crea sql/crear_usuario_auditoria.sql con su propio perfil y no forma parte de lo auditado.
// Fuente: scripts V00–V12 del laboratorio (indicados en "fuente") y pruebas nuevas.
//
// Estructura de cada prueba: id, controlId, nombre, descripcion, sql, binds, evaluador(filas, ctx),
// esperado, explicacionCumple, explicacionNoCumple, recomendacion, comandoEquivalente, fuente.
// El evaluador recibe las filas como objetos {COLUMNA: valor} y devuelve { estado, detalle, madurez? }.

const APP_USUARIOS = "SELECT username FROM dba_users WHERE oracle_maintained = 'N'";
const APP_ROLES = "SELECT role FROM dba_roles WHERE oracle_maintained = 'N'";
const COMANDO = 'sqlplus {usuario}/********@//{host}:{puerto}/{servicio}';

// Nombres de columna que suelen contener datos personales o confidenciales (heurística de A5.12)
const PATRON_SENSIBLE = 'CEDULA|DNI|PASAPORTE|IDENTIFICACION|NUM_ID|TARJETA|CARD|CCN|CVV|CORREO|EMAIL|MAIL|TELEF|PHONE|CELULAR|MOVIL'
  + '|SALARIO|SALARY|SUELDO|IBAN|NUM_CUENTA|CUENTA_BANC|NACIMIENTO|BIRTH|DIRECCION|ADDRESS|SSN|PASSWORD|CONTRASENA';

const CUENTAS_DEMO = ['SCOTT', 'ADAMS', 'JONES', 'CLARK', 'BLAKE', 'HR', 'OE', 'PM', 'IX', 'SH', 'BI', 'CO', 'DEMO', 'SAMPLE'];

// ---------- utilidades para los evaluadores ----------
function lista(valores, max = 8) {
  const v = [...new Set(valores)];
  if (v.length <= max) return v.join(', ');
  return v.slice(0, max).join(', ') + ` y ${v.length - max} más`;
}

// CUMPLE si no hay hallazgos, NO CUMPLE si todos fallan, PARCIAL en otro caso
function porProporcion(total, malos) {
  if (malos === 0) return 'CUMPLE';
  return malos >= total ? 'NO CUMPLE' : 'PARCIAL';
}

function numeroLimite(valor) {
  const s = String(valor || '').trim().toUpperCase();
  if (s === 'UNLIMITED' || s === '' || s === 'NULL') return Infinity;
  if (/^\d+\/\d+$/.test(s)) { const [a, b] = s.split('/').map(Number); return a / b; }
  const n = Number(s);
  return Number.isFinite(n) ? n : Infinity;
}

// Consulta común de perfiles efectivos (resuelve DEFAULT) de cuentas de aplicación no bloqueadas
function sqlPerfiles(recursos) {
  const columnas = recursos.map((r) => `       MAX(CASE WHEN p.resource_name = '${r}' THEN DECODE(p.limit, 'DEFAULT', d.limit, p.limit) END) ${r.toLowerCase()}`);
  return `SELECT u.username, u.profile,
${columnas.join(',\n')}
  FROM dba_users u
  JOIN dba_profiles p ON p.profile = u.profile
  JOIN dba_profiles d ON d.profile = 'DEFAULT' AND d.resource_name = p.resource_name
 WHERE u.oracle_maintained = 'N'
   AND u.account_status NOT LIKE '%LOCKED%'
   AND u.username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
   AND p.resource_name IN (${recursos.map((r) => `'${r}'`).join(', ')})
 GROUP BY u.username, u.profile
 ORDER BY u.username`;
}

const SQL_SENSIBLES = `WITH sensibles AS (
  SELECT c.owner, c.table_name, c.column_name
    FROM dba_tab_columns c
    JOIN dba_tables t ON t.owner = c.owner AND t.table_name = c.table_name AND t.dropped = 'NO'
   WHERE c.owner IN (${APP_USUARIOS})
     AND REGEXP_LIKE(c.column_name, :patron)
)`;

const PRUEBAS = [
  // ======================= A5.18 Derechos de acceso =======================
  {
    id: 'A5.18-1', controlId: 'A5.18', fuente: 'V01 (PB-01a)',
    nombre: 'Cuentas de demostración bloqueadas',
    descripcion: 'Busca cuentas de ejemplo conocidas (SCOTT, HR, OE, SH...) que sigan abiertas.',
    sql: `SELECT username, account_status, created, lock_date
  FROM dba_users
 WHERE username IN (${CUENTAS_DEMO.map((c) => `'${c}'`).join(', ')})
 ORDER BY username`,
    esperado: 'Ninguna cuenta de demostración con estado OPEN (todas inexistentes o LOCKED).',
    evaluador(filas) {
      const abiertas = filas.filter((f) => !String(f.ACCOUNT_STATUS).includes('LOCKED'));
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No existe ninguna cuenta de demostración conocida.' };
      if (!abiertas.length) {
        return { estado: 'CUMPLE', detalle: `Cuentas de demostración presentes pero bloqueadas: ${lista(filas.map((f) => `${f.USERNAME} (${f.ACCOUNT_STATUS})`))}.` };
      }
      return { estado: 'NO CUMPLE', detalle: `Cuentas de demostración abiertas: ${lista(abiertas.map((f) => `${f.USERNAME} (${f.ACCOUNT_STATUS})`))}.` };
    },
    explicacionCumple: 'Las cuentas de ejemplo no se pueden usar para entrar a la base: no existen o están bloqueadas.',
    explicacionNoCumple: 'Una cuenta de demostración abierta tiene una contraseña públicamente conocida y es una puerta de entrada directa.',
    recomendacion: 'Bloquear y expirar las cuentas de demostración, o eliminarlas si no se usan:\n  ALTER USER scott ACCOUNT LOCK PASSWORD EXPIRE;\n  -- o: DROP USER scott CASCADE;\nScript del laboratorio: ./ejecutar.sh implementacion I01',
  },
  {
    id: 'A5.18-2', controlId: 'A5.18', fuente: 'V01 (PB-01b)',
    nombre: 'Cuentas abiertas con contraseña por defecto',
    descripcion: 'Cruza DBA_USERS_WITH_DEFPWD con las cuentas no bloqueadas.',
    sql: `SELECT d.username, u.account_status, u.oracle_maintained
  FROM dba_users_with_defpwd d
  JOIN dba_users u ON u.username = d.username
 WHERE u.account_status NOT LIKE '%LOCKED%'
 ORDER BY d.username`,
    esperado: 'Ninguna cuenta no bloqueada conserva su contraseña por defecto (no rows selected).',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay cuentas no bloqueadas con contraseña por defecto.' };
      return { estado: 'NO CUMPLE', detalle: `${filas.length} cuenta(s) no bloqueada(s) con contraseña por defecto: ${lista(filas.map((f) => f.USERNAME))}.` };
    },
    explicacionCumple: 'Ninguna cuenta utilizable conserva una contraseña de fábrica.',
    explicacionNoCumple: 'Oracle reconoce estas contraseñas como valores por defecto: cualquiera que conozca la documentación puede entrar.',
    recomendacion: 'Cambiar la contraseña o bloquear cada cuenta listada:\n  ALTER USER <cuenta> IDENTIFIED BY "<clave nueva>";\n  ALTER USER <cuenta> ACCOUNT LOCK PASSWORD EXPIRE;\nScript del laboratorio: ./ejecutar.sh implementacion I01',
  },

  // ======================= A5.17 Información de autenticación =======================
  {
    id: 'A5.17-1', controlId: 'A5.17', fuente: 'V02 (PB-02a)',
    nombre: 'Bloqueo por intentos fallidos',
    descripcion: 'Perfil efectivo de cada cuenta de aplicación no bloqueada: FAILED_LOGIN_ATTEMPTS y PASSWORD_LOCK_TIME.',
    sql: sqlPerfiles(['FAILED_LOGIN_ATTEMPTS', 'PASSWORD_LOCK_TIME']),
    esperado: 'FAILED_LOGIN_ATTEMPTS entre 1 y 5 en todas las cuentas (DEFAULT se resuelve al valor del perfil DEFAULT).',
    evaluador(filas) {
      const malas = filas.filter((f) => numeroLimite(f.FAILED_LOGIN_ATTEMPTS) > 5);
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay cuentas de aplicación no bloqueadas.' };
      const estado = porProporcion(filas.length, malas.length);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} cuentas bloquean tras 5 intentos o menos.`
        : `${malas.length} de ${filas.length} cuentas permiten más de 5 intentos o ilimitados: ${lista(malas.map((f) => `${f.USERNAME}=${f.FAILED_LOGIN_ATTEMPTS} (${f.PROFILE})`))}.` };
    },
    explicacionCumple: 'Un atacante no puede probar contraseñas sin límite: la cuenta se bloquea a los pocos intentos.',
    explicacionNoCumple: 'Sin un límite bajo de intentos, es posible adivinar contraseñas por fuerza bruta.',
    recomendacion: 'Crear un perfil con límites y asignarlo a las cuentas de aplicación:\n  CREATE PROFILE prf_app LIMIT FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24;\n  ALTER USER <cuenta> PROFILE prf_app;\nScript del laboratorio: ./ejecutar.sh implementacion I02',
  },
  {
    id: 'A5.17-2', controlId: 'A5.17', fuente: 'V02 (PB-02c)',
    nombre: 'Vencimiento de contraseñas',
    descripcion: 'PASSWORD_LIFE_TIME y PASSWORD_GRACE_TIME efectivos de cada cuenta de aplicación no bloqueada.',
    sql: sqlPerfiles(['PASSWORD_LIFE_TIME', 'PASSWORD_GRACE_TIME']),
    esperado: 'PASSWORD_LIFE_TIME de 90 días o menos en todas las cuentas.',
    evaluador(filas) {
      const malas = filas.filter((f) => numeroLimite(f.PASSWORD_LIFE_TIME) > 90);
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay cuentas de aplicación no bloqueadas.' };
      const estado = porProporcion(filas.length, malas.length);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} cuentas vencen su contraseña en 90 días o menos.`
        : `${malas.length} de ${filas.length} cuentas con vencimiento mayor a 90 días o ilimitado: ${lista(malas.map((f) => `${f.USERNAME}=${f.PASSWORD_LIFE_TIME}`))}.` };
    },
    explicacionCumple: 'Las contraseñas se renuevan periódicamente, lo que limita el uso de una clave filtrada.',
    explicacionNoCumple: 'Una contraseña que nunca vence puede usarse indefinidamente si se filtra.',
    recomendacion: 'Definir el vencimiento en el perfil de las cuentas:\n  ALTER PROFILE prf_app LIMIT PASSWORD_LIFE_TIME 90 PASSWORD_GRACE_TIME 7;\nScript del laboratorio: ./ejecutar.sh implementacion I02',
  },
  {
    id: 'A5.17-3', controlId: 'A5.17', fuente: 'V02 (PB-02b)',
    nombre: 'Función de verificación de complejidad',
    descripcion: 'PASSWORD_VERIFY_FUNCTION efectiva de cada cuenta de aplicación no bloqueada.',
    sql: sqlPerfiles(['PASSWORD_VERIFY_FUNCTION']),
    esperado: 'Todas las cuentas tienen una función de verificación (p. ej. ORA12C_STRONG_VERIFY_FUNCTION).',
    evaluador(filas) {
      const malas = filas.filter((f) => ['', 'NULL', 'DEFAULT'].includes(String(f.PASSWORD_VERIFY_FUNCTION || '').toUpperCase()));
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay cuentas de aplicación no bloqueadas.' };
      const estado = porProporcion(filas.length, malas.length);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} cuentas validan la complejidad (${lista(filas.map((f) => f.PASSWORD_VERIFY_FUNCTION), 3)}).`
        : `${malas.length} de ${filas.length} cuentas sin función de verificación: ${lista(malas.map((f) => `${f.USERNAME} (${f.PROFILE})`))}.` };
    },
    explicacionCumple: 'Oracle rechaza contraseñas débiles al crearlas o cambiarlas.',
    explicacionNoCumple: 'Sin función de verificación se aceptan contraseñas cortas o triviales.',
    recomendacion: 'Asignar una función de verificación en el perfil:\n  ALTER PROFILE prf_app LIMIT PASSWORD_VERIFY_FUNCTION ORA12C_STRONG_VERIFY_FUNCTION;\nRevise también el perfil DEFAULT, que usan las cuentas sin perfil propio (p. ej. PDBADMIN).\nScript del laboratorio: ./ejecutar.sh implementacion I02',
  },

  // ======================= A5.16 Gestión de identidades =======================
  {
    id: 'A5.16-1', controlId: 'A5.16', fuente: 'nueva',
    nombre: 'Cuentas abiertas sin uso reciente',
    descripcion: 'Cuentas de aplicación abiertas que nunca se usaron o sin acceso en más de :dias días (DBA_USERS.LAST_LOGIN).',
    sql: `SELECT username, account_status, created,
       last_login,
       CASE WHEN last_login IS NULL THEN 'NUNCA USADA'
            WHEN last_login < SYSTIMESTAMP - NUMTODSINTERVAL(:dias, 'DAY') THEN 'INACTIVA'
            ELSE 'EN USO' END situacion
  FROM dba_users
 WHERE oracle_maintained = 'N'
   AND account_status = 'OPEN'
   AND username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
 ORDER BY situacion, username`,
    binds: { dias: 90 },
    esperado: 'Todas las cuentas abiertas tienen situación EN USO (último acceso en los últimos 90 días).',
    evaluador(filas) {
      const malas = filas.filter((f) => f.SITUACION !== 'EN USO');
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay cuentas de aplicación abiertas.' };
      const estado = porProporcion(filas.length, malas.length);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} cuentas abiertas tuvieron acceso en los últimos 90 días.`
        : `${malas.length} de ${filas.length} cuentas abiertas sin uso: ${lista(malas.map((f) => `${f.USERNAME} (${f.SITUACION.toLowerCase()})`))}.` };
    },
    explicacionCumple: 'Todas las identidades abiertas están en uso; no hay cuentas olvidadas.',
    explicacionNoCumple: 'Una cuenta abierta que nadie usa no tiene dueño que note un acceso indebido; debe bloquearse o eliminarse.',
    recomendacion: 'Bloquear las cuentas sin uso, o configurar el bloqueo automático por inactividad:\n  ALTER USER <cuenta> ACCOUNT LOCK;\n  ALTER PROFILE prf_app LIMIT INACTIVE_ACCOUNT_TIME 90;',
  },
  {
    id: 'A5.16-2', controlId: 'A5.16', fuente: 'nueva',
    nombre: 'Cuentas expiradas sin depurar',
    descripcion: 'Cuentas de aplicación con contraseña expirada que siguen sin bloquear, o bloqueadas desde hace más de 90 días.',
    sql: `SELECT username, account_status, expiry_date, lock_date,
       TRUNC(SYSDATE - expiry_date) dias_expirada
  FROM dba_users
 WHERE oracle_maintained = 'N'
   AND account_status LIKE 'EXPIRED%'
   AND account_status NOT LIKE 'EXPIRED(GRACE)%'
 ORDER BY username`,
    esperado: 'Ninguna cuenta expirada sin bloquear; las expiradas y bloqueadas no superan 90 días sin depurarse.',
    evaluador(filas) {
      const sinBloquear = filas.filter((f) => !String(f.ACCOUNT_STATUS).includes('LOCKED'));
      const viejas = filas.filter((f) => String(f.ACCOUNT_STATUS).includes('LOCKED') && Number(f.DIAS_EXPIRADA) > 90);
      if (sinBloquear.length) {
        return { estado: 'NO CUMPLE', detalle: `Cuentas expiradas sin bloquear (pueden reactivarse cambiando la clave): ${lista(sinBloquear.map((f) => f.USERNAME))}.` };
      }
      if (viejas.length) {
        return { estado: 'PARCIAL', detalle: `Cuentas expiradas y bloqueadas hace más de 90 días, pendientes de depurar: ${lista(viejas.map((f) => `${f.USERNAME} (${f.DIAS_EXPIRADA} días)`))}.` };
      }
      return { estado: 'CUMPLE', detalle: filas.length
        ? `Cuentas expiradas, todas bloqueadas y recientes: ${lista(filas.map((f) => `${f.USERNAME} (${f.DIAS_EXPIRADA} días)`))}.`
        : 'No hay cuentas de aplicación expiradas.' };
    },
    explicacionCumple: 'Las cuentas expiradas están bloqueadas y dentro del plazo de depuración.',
    explicacionNoCumple: 'El ciclo de vida de las identidades no se completa: hay cuentas expiradas que no se bloquearon o no se eliminaron.',
    recomendacion: 'Bloquear las cuentas expiradas y eliminar las que ya no se necesiten:\n  ALTER USER <cuenta> ACCOUNT LOCK;\n  DROP USER <cuenta> CASCADE;  -- tras respaldar sus objetos si aplica',
  },

  // ======================= A8.5 Autenticación segura =======================
  {
    id: 'A8.5-1', controlId: 'A8.5', fuente: 'nueva',
    nombre: 'Versiones del hash de contraseña',
    descripcion: 'PASSWORD_VERSIONS de cada cuenta de aplicación no bloqueada con autenticación por contraseña.',
    sql: `SELECT username, password_versions, authentication_type
  FROM dba_users
 WHERE oracle_maintained = 'N'
   AND account_status NOT LIKE '%LOCKED%'
   AND authentication_type = 'PASSWORD'
   AND username <> SYS_CONTEXT('USERENV', 'SESSION_USER')
 ORDER BY username`,
    esperado: 'Solo la versión 12C (SHA-2 con PBKDF2). 10G (DES) no debe aparecer; 11G (SHA-1) es aceptable pero mejorable.',
    evaluador(filas) {
      const con10 = filas.filter((f) => /10G/.test(f.PASSWORD_VERSIONS || ''));
      const con11 = filas.filter((f) => /11G/.test(f.PASSWORD_VERSIONS || ''));
      if (con10.length) {
        return { estado: 'NO CUMPLE', detalle: `${con10.length} cuenta(s) con hash 10G (DES, quebrantable): ${lista(con10.map((f) => `${f.USERNAME} [${String(f.PASSWORD_VERSIONS).trim()}]`))}.` };
      }
      if (con11.length) {
        return { estado: 'PARCIAL', detalle: `Ninguna cuenta usa 10G, pero ${con11.length} de ${filas.length} conservan además el verificador 11G (SHA-1): ${lista(con11.map((f) => f.USERNAME))}.` };
      }
      return { estado: 'CUMPLE', detalle: filas.length ? `Las ${filas.length} cuentas solo tienen verificador 12C.` : 'No hay cuentas con contraseña para revisar.' };
    },
    explicacionCumple: 'Las contraseñas se guardan solo con el algoritmo más fuerte disponible.',
    explicacionNoCumple: 'Los verificadores antiguos facilitan descifrar contraseñas si alguien obtiene el diccionario de la base.',
    recomendacion: 'En el sqlnet.ora del servidor, aceptar solo verificadores modernos y luego cambiar las contraseñas para regenerar los hashes:\n  SQLNET.ALLOWED_LOGON_VERSION_SERVER = 12a\n  ALTER USER <cuenta> IDENTIFIED BY "<clave nueva>";',
  },
  {
    id: 'A8.5-2', controlId: 'A8.5', fuente: 'nueva',
    nombre: 'Perfiles en uso sin verificación de complejidad',
    descripcion: 'Agrupa las cuentas de aplicación no bloqueadas por perfil y muestra la función de verificación efectiva.',
    sql: `SELECT u.profile,
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
 ORDER BY u.profile`,
    esperado: 'Ningún perfil en uso tiene PASSWORD_VERIFY_FUNCTION en NULL.',
    evaluador(filas) {
      const total = filas.reduce((s, f) => s + Number(f.CUENTAS), 0);
      const malos = filas.filter((f) => ['NULL', ''].includes(String(f.PASSWORD_VERIFY_FUNCTION).toUpperCase()));
      const cuentasMalas = malos.reduce((s, f) => s + Number(f.CUENTAS), 0);
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay cuentas de aplicación no bloqueadas.' };
      const estado = porProporcion(total, cuentasMalas);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Todos los perfiles en uso (${lista(filas.map((f) => f.PROFILE))}) verifican la complejidad.`
        : `Perfil(es) sin verificación: ${lista(malos.map((f) => `${f.PROFILE} (${f.CUENTAS} cuenta(s): ${f.USUARIOS})`), 4)}; afectan a ${cuentasMalas} de ${total} cuentas.` };
    },
    explicacionCumple: 'Cada perfil asignado obliga a usar contraseñas complejas.',
    explicacionNoCumple: 'Las cuentas que usan estos perfiles pueden recibir contraseñas débiles.',
    recomendacion: 'Configurar la función de verificación en cada perfil listado, incluido DEFAULT si está en uso:\n  ALTER PROFILE DEFAULT LIMIT PASSWORD_VERIFY_FUNCTION ORA12C_STRONG_VERIFY_FUNCTION;\nO asignar a esas cuentas un perfil propio: ALTER USER <cuenta> PROFILE prf_app;',
  },

  // ======================= A5.15 Control de acceso =======================
  {
    id: 'A5.15-1', controlId: 'A5.15', fuente: 'V03 (PB-03c)',
    nombre: 'Permisos directos a usuarios sobre objetos de aplicación',
    descripcion: 'Permisos de objeto concedidos directamente a cuentas (no a roles) sobre tablas y vistas de esquemas de aplicación.',
    sql: `SELECT t.grantee, t.owner, t.table_name objeto, t.type tipo, t.privilege
  FROM dba_tab_privs t
 WHERE t.owner IN (${APP_USUARIOS})
   AND t.grantee IN (${APP_USUARIOS})
   AND t.grantee <> t.owner
 ORDER BY t.grantee, t.owner, t.table_name`,
    esperado: 'no rows selected: el acceso a los datos se concede solo mediante roles.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay permisos directos de cuentas sobre objetos de aplicación; el acceso es por roles.' };
      return { estado: 'NO CUMPLE', detalle: `${filas.length} permiso(s) directo(s): ${lista(filas.map((f) => `${f.GRANTEE}:${f.PRIVILEGE} ${f.OWNER}.${f.OBJETO}`), 6)}.` };
    },
    explicacionCumple: 'El acceso se administra por roles según la función, lo que facilita revisarlo y retirarlo.',
    explicacionNoCumple: 'Los permisos directos se acumulan, son difíciles de revisar y suelen quedar después de que la persona cambia de función.',
    recomendacion: 'Crear roles por función, conceder los permisos al rol y revocar los directos:\n  CREATE ROLE rol_consulta_clientes;\n  GRANT SELECT ON segconf.clientes TO rol_consulta_clientes;\n  GRANT rol_consulta_clientes TO app_consulta;\n  REVOKE SELECT ON segconf.clientes FROM app_consulta;\nScript del laboratorio: ./ejecutar.sh implementacion I03',
  },
  {
    id: 'A5.15-2', controlId: 'A5.15', fuente: 'nueva',
    nombre: 'Permisos a PUBLIC sobre objetos de aplicación',
    descripcion: 'Cualquier permiso de objeto de un esquema de aplicación concedido a PUBLIC (todas las cuentas).',
    sql: `SELECT t.owner, t.table_name objeto, t.type tipo, t.privilege
  FROM dba_tab_privs t
 WHERE t.grantee = 'PUBLIC'
   AND t.owner IN (${APP_USUARIOS})
 ORDER BY t.owner, t.table_name`,
    esperado: 'no rows selected.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'Ningún objeto de aplicación está concedido a PUBLIC.' };
      return { estado: 'NO CUMPLE', detalle: `Objetos de aplicación abiertos a todas las cuentas: ${lista(filas.map((f) => `${f.PRIVILEGE} ${f.OWNER}.${f.OBJETO}`))}.` };
    },
    explicacionCumple: 'Ninguna cuenta obtiene acceso a datos de aplicación solo por existir.',
    explicacionNoCumple: 'Un permiso a PUBLIC lo hereda cualquier cuenta de la base, incluidas las de demostración.',
    recomendacion: 'Revocar el permiso de PUBLIC y concederlo a un rol específico:\n  REVOKE <privilegio> ON <esquema>.<objeto> FROM PUBLIC;',
  },

  // ======================= A8.2 Derechos de acceso privilegiado =======================
  {
    id: 'A8.2-1', controlId: 'A8.2', fuente: 'V03 (PB-03a)',
    nombre: 'Privilegios ANY en cuentas o roles no administrativos',
    descripcion: 'Privilegios de sistema con ANY (SELECT ANY TABLE, etc.) concedidos a cuentas o roles creados por el cliente.',
    sql: `SELECT p.grantee,
       CASE WHEN r.role IS NOT NULL THEN 'ROL' ELSE 'USUARIO' END tipo,
       p.privilege, p.admin_option
  FROM dba_sys_privs p
  LEFT JOIN dba_roles r ON r.role = p.grantee
 WHERE p.privilege LIKE '% ANY %'
   AND (p.grantee IN (${APP_USUARIOS}) OR p.grantee IN (${APP_ROLES}))
 ORDER BY p.grantee, p.privilege`,
    esperado: 'no rows selected: ninguna cuenta ni rol propio tiene privilegios ANY.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'Ninguna cuenta ni rol no administrativo tiene privilegios ANY.' };
      const sat = filas.filter((f) => f.PRIVILEGE === 'SELECT ANY TABLE');
      return { estado: 'NO CUMPLE', detalle: `${filas.length} privilegio(s) ANY: ${lista(filas.map((f) => `${f.GRANTEE}:${f.PRIVILEGE}`), 6)}.`
        + (sat.length ? ` SELECT ANY TABLE permite leer cualquier tabla (${lista(sat.map((f) => f.GRANTEE))}).` : '') };
    },
    explicacionCumple: 'Las cuentas solo acceden a los objetos que se les conceden de forma explícita.',
    explicacionNoCumple: 'Un privilegio ANY salta la autorización por objeto: la cuenta puede leer o modificar datos de cualquier esquema.',
    recomendacion: 'Revocar el privilegio y conceder solo los objetos necesarios mediante roles:\n  REVOKE SELECT ANY TABLE FROM app_reportes;\n  GRANT SELECT ON segconf.v_clientes_resumen TO rol_reportes;\nScript del laboratorio: ./ejecutar.sh implementacion I03',
  },
  {
    id: 'A8.2-2', controlId: 'A8.2', fuente: 'V03 y nueva',
    nombre: 'Titulares de roles administrativos (DBA y similares)',
    descripcion: 'Cuentas de aplicación con DBA, PDB_DBA o roles de exportación/importación completa, y si además son dueñas de tablas.',
    sql: `SELECT rp.grantee, rp.granted_role, rp.admin_option,
       (SELECT COUNT(*) FROM dba_tables t WHERE t.owner = rp.grantee) tablas_propias
  FROM dba_role_privs rp
 WHERE rp.granted_role IN ('DBA', 'PDB_DBA', 'DATAPUMP_EXP_FULL_DATABASE', 'DATAPUMP_IMP_FULL_DATABASE',
                           'EXP_FULL_DATABASE', 'IMP_FULL_DATABASE')
   AND rp.grantee IN (${APP_USUARIOS})
 ORDER BY rp.grantee, rp.granted_role`,
    esperado: 'Ningún esquema de aplicación (dueño de tablas) tiene roles administrativos; como máximo 2 cuentas administrativas nominales.',
    evaluador(filas) {
      const conDatos = filas.filter((f) => Number(f.TABLAS_PROPIAS) > 0);
      const titulares = [...new Set(filas.map((f) => f.GRANTEE))];
      if (conDatos.length) {
        return { estado: 'NO CUMPLE', detalle: `Esquemas con datos que tienen roles administrativos: ${lista(conDatos.map((f) => `${f.GRANTEE} (${f.GRANTED_ROLE}, ${f.TABLAS_PROPIAS} tablas)`))}.` };
      }
      if (titulares.length > 2) {
        return { estado: 'PARCIAL', detalle: `${titulares.length} cuentas con roles administrativos (${lista(titulares)}); revise si todas son necesarias.` };
      }
      return { estado: 'CUMPLE', detalle: titulares.length
        ? `Solo ${titulares.length} cuenta(s) administrativa(s) sin datos propios: ${lista(filas.map((f) => `${f.GRANTEE} (${f.GRANTED_ROLE})`))}.`
        : 'Ninguna cuenta de aplicación tiene roles administrativos.' };
    },
    explicacionCumple: 'Los roles administrativos están limitados a pocas cuentas que no son dueñas de los datos.',
    explicacionNoCumple: 'El acceso privilegiado debe ser mínimo y separado de las cuentas de aplicación.',
    recomendacion: 'Revocar los roles administrativos a esquemas de aplicación y usar cuentas administrativas nominales:\n  REVOKE DBA FROM <esquema>;',
  },
  {
    id: 'A8.2-3', controlId: 'A8.2', fuente: 'nueva',
    nombre: 'Usuarios con privilegios administrativos SYS*',
    descripcion: 'Usuarios del archivo de contraseñas con SYSDBA, SYSOPER, SYSBACKUP, SYSDG o SYSKM (V$PWFILE_USERS).',
    sql: `SELECT username, sysdba, sysoper, sysbackup, sysdg, syskm, account_status
  FROM v$pwfile_users
 ORDER BY username`,
    esperado: 'Solo SYS con SYSDBA/SYSOPER; otros privilegios SYS* solo en cuentas dedicadas (SYSBACKUP, SYSKM...).',
    evaluador(filas) {
      const otros = filas.filter((f) => f.USERNAME !== 'SYS' && (f.SYSDBA === 'TRUE' || f.SYSOPER === 'TRUE'));
      if (otros.length) return { estado: 'NO CUMPLE', detalle: `Cuentas distintas de SYS con SYSDBA o SYSOPER: ${lista(otros.map((f) => f.USERNAME))}.` };
      return { estado: 'CUMPLE', detalle: filas.length
        ? `Archivo de contraseñas: ${lista(filas.map((f) => f.USERNAME))}. Ninguna cuenta adicional con SYSDBA/SYSOPER.`
        : 'No hay usuarios con privilegios SYS* visibles desde este contenedor.' };
    },
    explicacionCumple: 'El privilegio SYSDBA, que omite todos los controles, no se repartió a otras cuentas.',
    explicacionNoCumple: 'SYSDBA permite leer y cambiar cualquier dato sin restricciones de VPD ni de redacción.',
    recomendacion: 'Retirar SYSDBA a cuentas que no lo necesitan y usar privilegios específicos (SYSBACKUP, SYSKM):\n  REVOKE SYSDBA FROM <cuenta>;',
  },

  // ======================= A8.12 Prevención de fuga de datos =======================
  {
    id: 'A8.12-1', controlId: 'A8.12', fuente: 'V03 (PB-03b)',
    nombre: 'Paquetes UTL_* ejecutables por PUBLIC',
    descripcion: 'EXECUTE para PUBLIC sobre UTL_FILE, UTL_HTTP, UTL_SMTP, UTL_TCP y UTL_INADDR.',
    sql: `SELECT p.table_name paquete, p.grantee, p.privilege
  FROM dba_tab_privs p
 WHERE p.grantee = 'PUBLIC'
   AND p.owner = 'SYS'
   AND p.privilege = 'EXECUTE'
   AND p.table_name IN ('UTL_FILE', 'UTL_HTTP', 'UTL_SMTP', 'UTL_TCP', 'UTL_INADDR')
 ORDER BY p.table_name`,
    esperado: 'no rows selected.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'Ningún paquete UTL_* de red o archivos es ejecutable por PUBLIC.' };
      return { estado: 'NO CUMPLE', detalle: `${filas.length} paquete(s) abiertos a todas las cuentas: ${lista(filas.map((f) => f.PAQUETE))}.` };
    },
    explicacionCumple: 'Las cuentas comunes no pueden enviar datos por red ni escribir archivos con estos paquetes.',
    explicacionNoCumple: 'Con estos paquetes cualquier cuenta puede sacar datos por HTTP, correo, sockets o archivos del servidor.',
    recomendacion: 'Revocar EXECUTE de PUBLIC (antes, conceder el permiso directo a los esquemas de Oracle que lo usan):\n  REVOKE EXECUTE ON sys.utl_file FROM PUBLIC;\n  REVOKE EXECUTE ON sys.utl_http FROM PUBLIC;\nScript del laboratorio: ./ejecutar.sh implementacion I03',
  },
  {
    id: 'A8.12-2', controlId: 'A8.12', fuente: 'nueva',
    nombre: 'Enlaces de base de datos',
    descripcion: 'Enlaces públicos o de esquemas de aplicación (DBA_DB_LINKS), que pueden copiar datos hacia otra base.',
    sql: `SELECT owner, db_link, username, host, created
  FROM dba_db_links
 WHERE owner = 'PUBLIC' OR owner IN (${APP_USUARIOS})
 ORDER BY owner, db_link`,
    esperado: 'Sin enlaces públicos; los enlaces privados deben estar justificados.',
    evaluador(filas) {
      const publicos = filas.filter((f) => f.OWNER === 'PUBLIC');
      if (publicos.length) return { estado: 'NO CUMPLE', detalle: `Enlaces públicos (los usa cualquier cuenta): ${lista(publicos.map((f) => `${f.DB_LINK} → ${f.HOST}`))}.` };
      if (filas.length) return { estado: 'PARCIAL', detalle: `Enlaces privados que requieren justificación: ${lista(filas.map((f) => `${f.OWNER}.${f.DB_LINK} → ${f.HOST}`))}.` };
      return { estado: 'CUMPLE', detalle: 'No hay enlaces de base de datos públicos ni en esquemas de aplicación.' };
    },
    explicacionCumple: 'No existen canales de base a base por los que copiar datos fuera.',
    explicacionNoCumple: 'Un enlace de base de datos permite mover datos a otro servidor con una sola consulta.',
    recomendacion: 'Eliminar los enlaces que no sean necesarios:\n  DROP PUBLIC DATABASE LINK <enlace>;\n  DROP DATABASE LINK <enlace>;  -- conectado como el dueño',
  },
  {
    id: 'A8.12-3', controlId: 'A8.12', fuente: 'nueva',
    nombre: 'Directorios con permisos para cuentas no administrativas',
    descripcion: 'Objetos DIRECTORY (DBA_DIRECTORIES) con permisos de lectura o escritura para PUBLIC o cuentas/roles del cliente.',
    sql: `SELECT d.directory_name, d.directory_path, p.grantee, p.privilege
  FROM dba_directories d
  JOIN dba_tab_privs p ON p.table_name = d.directory_name AND p.type = 'DIRECTORY'
 WHERE p.grantee = 'PUBLIC'
    OR p.grantee IN (${APP_USUARIOS})
    OR p.grantee IN (${APP_ROLES})
 ORDER BY d.directory_name, p.grantee, p.privilege`,
    esperado: 'Ningún directorio escribible por PUBLIC; escritura solo para cuentas justificadas.',
    evaluador(filas) {
      const escrituraPublica = filas.filter((f) => f.GRANTEE === 'PUBLIC' && f.PRIVILEGE === 'WRITE');
      const escritura = filas.filter((f) => f.PRIVILEGE === 'WRITE');
      if (escrituraPublica.length) return { estado: 'NO CUMPLE', detalle: `Directorios escribibles por todas las cuentas: ${lista(escrituraPublica.map((f) => `${f.DIRECTORY_NAME} (${f.DIRECTORY_PATH})`))}.` };
      if (escritura.length) return { estado: 'PARCIAL', detalle: `Cuentas que pueden escribir archivos en el servidor: ${lista(escritura.map((f) => `${f.GRANTEE} → ${f.DIRECTORY_NAME}`))}.` };
      return { estado: 'CUMPLE', detalle: filas.length
        ? `Solo permisos de lectura: ${lista(filas.map((f) => `${f.GRANTEE}:${f.PRIVILEGE} ${f.DIRECTORY_NAME}`))}.`
        : 'Ninguna cuenta no administrativa tiene permisos sobre directorios.' };
    },
    explicacionCumple: 'Las cuentas comunes no pueden exportar datos a archivos del servidor.',
    explicacionNoCumple: 'Escribir en un directorio permite volcar datos a archivos (Data Pump, UTL_FILE) fuera del control de la base.',
    recomendacion: 'Revocar los permisos que no se necesiten:\n  REVOKE WRITE ON DIRECTORY <directorio> FROM <cuenta>;',
  },

  // ======================= A8.24 Uso de criptografía =======================
  {
    id: 'A8.24-1', controlId: 'A8.24', fuente: 'V04 (PB-04a)', requiereOpcion: 'Transparent Data Encryption',
    nombre: 'Keystore TDE abierto',
    descripcion: 'Estado del keystore de Transparent Data Encryption visible desde el contenedor auditado.',
    sql: `SELECT con_id, wrl_type, status, wallet_type, keystore_mode
  FROM v$encryption_wallet
 ORDER BY con_id`,
    esperado: 'STATUS = OPEN.',
    evaluador(filas) {
      const estados = filas.map((f) => f.STATUS);
      if (filas.length && estados.every((s) => s === 'OPEN')) {
        return { estado: 'CUMPLE', detalle: `Keystore ${lista(filas.map((f) => `${f.STATUS} (${f.WALLET_TYPE})`))}.` };
      }
      if (estados.includes('OPEN_NO_MASTER_KEY')) return { estado: 'PARCIAL', detalle: 'El keystore está abierto pero sin clave maestra: no se puede cifrar.', madurez: 1 };
      return { estado: 'NO CUMPLE', detalle: `Estado del keystore: ${lista(estados) || 'sin información'}.` };
    },
    explicacionCumple: 'La base dispone de la clave maestra para cifrar y descifrar datos en reposo.',
    explicacionNoCumple: 'Sin keystore abierto no es posible usar TDE: los archivos de datos quedan en claro.',
    recomendacion: 'Configurar WALLET_ROOT, crear el keystore, abrirlo y definir la clave maestra:\n  ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "<clave>";\n  ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "<clave>" CONTAINER = ALL;\n  ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "<clave>" WITH BACKUP CONTAINER = ALL;\nScripts del laboratorio: ./ejecutar.sh implementacion I04a y I04',
  },
  {
    id: 'A8.24-2', controlId: 'A8.24', fuente: 'V04 (PB-04b, PB-04c)',
    nombre: 'Tablas con datos sensibles cifradas en reposo',
    descripcion: 'Tablas de aplicación con columnas de nombre sensible y si su tablespace o sus columnas están cifrados.',
    sql: `${SQL_SENSIBLES}
SELECT s.owner, s.table_name, t.tablespace_name, NVL(ts.encrypted, 'N/D') tablespace_cifrado,
       (SELECT COUNT(*) FROM dba_encrypted_columns e
         WHERE e.owner = s.owner AND e.table_name = s.table_name) columnas_cifradas
  FROM (SELECT DISTINCT owner, table_name FROM sensibles) s
  JOIN dba_tables t ON t.owner = s.owner AND t.table_name = s.table_name
  LEFT JOIN dba_tablespaces ts ON ts.tablespace_name = t.tablespace_name
 ORDER BY s.owner, s.table_name`,
    binds: { patron: PATRON_SENSIBLE },
    esperado: 'Todas las tablas listadas en tablespace cifrado (YES) o con columnas cifradas.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No se detectaron tablas de aplicación con columnas sensibles (heurística por nombre).' };
      const malas = filas.filter((f) => f.TABLESPACE_CIFRADO !== 'YES' && Number(f.COLUMNAS_CIFRADAS) === 0);
      const estado = porProporcion(filas.length, malas.length);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} tablas con datos sensibles están cifradas en reposo.`
        : `${malas.length} de ${filas.length} tablas con datos sensibles sin cifrar: ${lista(malas.map((f) => `${f.OWNER}.${f.TABLE_NAME} (${f.TABLESPACE_NAME || 'sin tablespace'})`))}.` };
    },
    explicacionCumple: 'Si alguien copia los archivos de datos, no puede leer la información sensible.',
    explicacionNoCumple: 'Los archivos de datos de estas tablas se pueden leer con herramientas de texto si se copian fuera del servidor.',
    recomendacion: 'Mover las tablas a un tablespace cifrado o cifrar el tablespace en línea:\n  CREATE TABLESPACE ts_datos_enc DATAFILE SIZE 100M ENCRYPTION USING \'AES256\' ENCRYPT;\n  ALTER TABLE <esquema>.<tabla> MOVE ONLINE TABLESPACE ts_datos_enc;\n  -- o: ALTER TABLESPACE users ENCRYPTION ONLINE USING \'AES256\' ENCRYPT;\nScript del laboratorio: ./ejecutar.sh implementacion I04',
  },

  // ======================= A8.11 Enmascaramiento de datos =======================
  {
    id: 'A8.11-1', controlId: 'A8.11', fuente: 'V05 (PB-05a)', requiereOpcion: 'Data Redaction',
    nombre: 'Políticas de Data Redaction habilitadas',
    descripcion: 'Políticas de redacción sobre objetos de esquemas de aplicación (REDACTION_POLICIES).',
    sql: `SELECT r.object_owner, r.object_name, r.policy_name, TRIM(r.enable) habilitada,
       (SELECT COUNT(*) FROM redaction_columns c
         WHERE c.object_owner = r.object_owner AND c.object_name = r.object_name) columnas
  FROM redaction_policies r
 WHERE r.object_owner IN (${APP_USUARIOS})
 ORDER BY r.object_owner, r.object_name`,
    esperado: 'Al menos una política habilitada (YES) sobre las tablas con datos sensibles.',
    evaluador(filas) {
      const activas = filas.filter((f) => f.HABILITADA === 'YES');
      if (activas.length) return { estado: 'CUMPLE', detalle: `Políticas habilitadas: ${lista(activas.map((f) => `${f.POLICY_NAME} en ${f.OBJECT_OWNER}.${f.OBJECT_NAME} (${f.COLUMNAS} columnas)`))}.` };
      if (filas.length) return { estado: 'PARCIAL', detalle: `Hay políticas pero deshabilitadas: ${lista(filas.map((f) => f.POLICY_NAME))}.`, madurez: 1 };
      return { estado: 'NO CUMPLE', detalle: 'No existe ninguna política de redacción sobre objetos de aplicación.' };
    },
    explicacionCumple: 'Los usuarios no autorizados reciben los datos sensibles ocultos o parciales al consultar.',
    explicacionNoCumple: 'Cualquier cuenta con permiso de lectura ve los datos sensibles completos.',
    recomendacion: 'Crear una política de redacción con DBMS_REDACT sobre las columnas sensibles:\n  BEGIN DBMS_REDACT.ADD_POLICY(object_schema => \'SEGCONF\', object_name => \'CLIENTES\',\n    policy_name => \'POL_RED_CLIENTES\', column_name => \'TARJETA\', function_type => DBMS_REDACT.PARTIAL,\n    function_parameters => DBMS_REDACT.REDACT_CCN16_F12,\n    expression => q\'[SYS_CONTEXT(\'USERENV\',\'SESSION_USER\') <> \'SEGCONF\']\'); END;\nScript del laboratorio: ./ejecutar.sh implementacion I05',
  },

  // ======================= A8.3 Restricción del acceso a la información =======================
  {
    id: 'A8.3-1', controlId: 'A8.3', fuente: 'V06 (PB-06a)', requiereOpcion: 'Fine-grained access control',
    nombre: 'Políticas VPD (control por fila) habilitadas',
    descripcion: 'Políticas de Virtual Private Database sobre objetos de aplicación (DBA_POLICIES).',
    sql: `SELECT object_owner, object_name, policy_name,
       pf_owner || '.' || NVL2(package, package || '.', '') || function funcion,
       sel, ins, upd, del, enable
  FROM dba_policies
 WHERE object_owner IN (${APP_USUARIOS})
 ORDER BY object_owner, object_name`,
    esperado: 'Al menos una política habilitada (ENABLE = YES) que filtre las filas por usuario.',
    evaluador(filas) {
      const activas = filas.filter((f) => f.ENABLE === 'YES');
      if (activas.length) return { estado: 'CUMPLE', detalle: `Políticas VPD habilitadas: ${lista(activas.map((f) => `${f.POLICY_NAME} en ${f.OBJECT_OWNER}.${f.OBJECT_NAME} → ${f.FUNCION}`))}.` };
      if (filas.length) return { estado: 'PARCIAL', detalle: `Políticas VPD deshabilitadas: ${lista(filas.map((f) => f.POLICY_NAME))}.`, madurez: 1 };
      return { estado: 'NO CUMPLE', detalle: 'No hay políticas VPD sobre objetos de aplicación: quien lee la tabla ve todas las filas.' };
    },
    explicacionCumple: 'Cada usuario solo ve las filas que le corresponden, aunque tenga permiso sobre la tabla.',
    explicacionNoCumple: 'El permiso de lectura sobre una tabla da acceso a todas sus filas, sin importar la función del usuario.',
    recomendacion: 'Crear una función de predicado y registrarla con DBMS_RLS:\n  BEGIN DBMS_RLS.ADD_POLICY(object_schema => \'SEGCONF\', object_name => \'CLIENTES\',\n    policy_name => \'POL_VPD_CLIENTES\', function_schema => \'SEGCONF\',\n    policy_function => \'PKG_SEGURIDAD.PRED_CLIENTES\', statement_types => \'SELECT,INSERT,UPDATE,DELETE\',\n    update_check => TRUE); END;\nScript del laboratorio: ./ejecutar.sh implementacion I06',
  },

  // ======================= A8.15 Registro de eventos =======================
  {
    id: 'A8.15-1', controlId: 'A8.15', fuente: 'V07 (PB-07a)', requiereOpcion: 'Unified Auditing',
    nombre: 'Políticas de auditoría unificada sobre datos de aplicación',
    descripcion: 'Políticas habilitadas (AUDIT_UNIFIED_ENABLED_POLICIES) y cuántos objetos de aplicación cubre cada una.',
    sql: `SELECT e.policy_name, e.enabled_option, e.entity_name, e.success, e.failure,
       (SELECT COUNT(*) FROM audit_unified_policies p
         WHERE p.policy_name = e.policy_name
           AND p.object_schema IN (${APP_USUARIOS})) objetos_aplicacion
  FROM audit_unified_enabled_policies e
 ORDER BY objetos_aplicacion DESC, e.policy_name`,
    esperado: 'Al menos una política habilitada que audite objetos de aplicación (OBJETOS_APLICACION > 0).',
    evaluador(filas) {
      const cubren = filas.filter((f) => Number(f.OBJETOS_APLICACION) > 0);
      if (cubren.length) return { estado: 'CUMPLE', detalle: `Políticas que auditan datos de aplicación: ${lista(cubren.map((f) => `${f.POLICY_NAME} (${f.OBJETOS_APLICACION} acciones/objetos)`))}. Total habilitadas: ${filas.length}.` };
      if (filas.length) {
        return { estado: 'NO CUMPLE', madurez: 1, detalle: `Solo hay políticas generales (${lista(filas.map((f) => f.POLICY_NAME))}); ninguna registra el acceso a los objetos de aplicación.` };
      }
      return { estado: 'NO CUMPLE', detalle: 'No hay ninguna política de auditoría unificada habilitada.' };
    },
    explicacionCumple: 'Las consultas y cambios sobre los datos de aplicación quedan registrados.',
    explicacionNoCumple: 'Sin una política sobre los objetos de aplicación no queda rastro de quién leyó los datos confidenciales.',
    recomendacion: 'Crear y habilitar una política sobre las tablas sensibles:\n  CREATE AUDIT POLICY pol_aud_clientes ACTIONS SELECT ON segconf.clientes, UPDATE ON segconf.clientes;\n  AUDIT POLICY pol_aud_clientes;\nScript del laboratorio: ./ejecutar.sh implementacion I07',
  },
  {
    id: 'A8.15-2', controlId: 'A8.15', fuente: 'V07 (PB-07b)', requiereOpcion: 'Unified Auditing',
    nombre: 'Registros recientes de acceso a datos de aplicación',
    descripcion: 'Eventos SELECT/INSERT/UPDATE/DELETE sobre objetos de aplicación en UNIFIED_AUDIT_TRAIL en los últimos :dias días.',
    sql: `SELECT object_schema, object_name, action_name, COUNT(*) registros, MAX(event_timestamp) ultimo
  FROM unified_audit_trail
 WHERE event_timestamp > SYSTIMESTAMP - NUMTODSINTERVAL(:dias, 'DAY')
   AND object_schema IN (${APP_USUARIOS})
   AND action_name IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
 GROUP BY object_schema, object_name, action_name
 ORDER BY registros DESC
 FETCH FIRST 15 ROWS ONLY`,
    binds: { dias: 30 },
    esperado: 'Al menos un registro de acceso a datos de aplicación en los últimos 30 días.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'NO CUMPLE', detalle: 'No hay registros de acceso a objetos de aplicación en los últimos 30 días.' };
      const total = filas.reduce((s, f) => s + Number(f.REGISTROS), 0);
      return { estado: 'CUMPLE', detalle: `${total} registros en 30 días; el más reciente: ${filas.map((f) => f.ULTIMO).sort().pop()}. Ej.: ${lista(filas.map((f) => `${f.ACTION_NAME} ${f.OBJECT_SCHEMA}.${f.OBJECT_NAME} (${f.REGISTROS})`), 3)}.` };
    },
    explicacionCumple: 'La traza contiene eventos reales de acceso: la auditoría está funcionando, no solo configurada.',
    explicacionNoCumple: 'La traza no muestra accesos a los datos de aplicación, por lo que no se puede reconstruir quién los consultó.',
    recomendacion: 'Habilitar la política de auditoría (A8.15-1) y verificar con una consulta de prueba que aparezca en UNIFIED_AUDIT_TRAIL.\nScript del laboratorio: ./ejecutar.sh implementacion I07',
  },

  // ======================= A5.33 Protección de los registros =======================
  {
    id: 'A5.33-1', controlId: 'A5.33', fuente: 'nueva', requiereOpcion: 'Unified Auditing',
    nombre: 'Separación de funciones sobre la traza de auditoría',
    descripcion: 'Quién tiene AUDIT_VIEWER (leer) y AUDIT_ADMIN (administrar y purgar) entre las cuentas y roles del cliente.',
    sql: `SELECT rp.grantee, rp.granted_role, rp.admin_option,
       (SELECT COUNT(*) FROM dba_tables t WHERE t.owner = rp.grantee) tablas_propias,
       CASE WHEN rp.grantee = SYS_CONTEXT('USERENV', 'SESSION_USER') THEN 'SI' ELSE 'NO' END cuenta_auditoria
  FROM dba_role_privs rp
 WHERE rp.granted_role IN ('AUDIT_ADMIN', 'AUDIT_VIEWER')
   AND (rp.grantee IN (${APP_USUARIOS}) OR rp.grantee IN (${APP_ROLES}))
 ORDER BY rp.granted_role, rp.grantee`,
    esperado: 'Existe una cuenta auditora (distinta de la de esta herramienta) con AUDIT_VIEWER; ningún dueño de datos tiene AUDIT_ADMIN ni AUDIT_VIEWER.',
    evaluador(filas) {
      const duenos = filas.filter((f) => Number(f.TABLAS_PROPIAS) > 0);
      if (duenos.length) return { estado: 'NO CUMPLE', detalle: `Dueños de datos con acceso a su propia traza: ${lista(duenos.map((f) => `${f.GRANTEE} (${f.GRANTED_ROLE})`))}.` };
      const visores = filas.filter((f) => f.GRANTED_ROLE === 'AUDIT_VIEWER' && f.CUENTA_AUDITORIA === 'NO');
      if (!visores.length) {
        return { estado: 'NO CUMPLE', detalle: 'Aparte de la cuenta de esta herramienta, nadie tiene un rol de lectura de la traza: no hay un auditor separado de los administradores.' };
      }
      const admins = filas.filter((f) => f.GRANTED_ROLE === 'AUDIT_ADMIN');
      return { estado: 'CUMPLE', detalle: `Lectura de la traza: ${lista(visores.map((f) => f.GRANTEE))}.` + (admins.length ? ` Administración: ${lista(admins.map((f) => f.GRANTEE))}.` : ' Administración solo por cuentas de Oracle.') };
    },
    explicacionCumple: 'Leer la traza es una función separada de administrar la base y de ser dueño de los datos.',
    explicacionNoCumple: 'Si solo los administradores auditados pueden ver o purgar la traza, los registros no tienen un revisor independiente.',
    recomendacion: 'Asignar la lectura de la traza a una cuenta auditora dedicada y no dar AUDIT_ADMIN a dueños de datos:\n  GRANT AUDIT_VIEWER TO app_auditor;\n  REVOKE AUDIT_ADMIN FROM <dueño de datos>;\nScript del laboratorio: ./ejecutar.sh implementacion I07',
  },
  {
    id: 'A5.33-2', controlId: 'A5.33', fuente: 'nueva',
    nombre: 'Retención y archivo de la traza',
    descripcion: 'Tareas de purga programadas, marcas de archivo y tablespace de la traza unificada (DBMS_AUDIT_MGMT).',
    sql: `SELECT 'TAREA DE PURGA' tipo, job_name nombre, job_status estado, TO_CHAR(job_frequency) detalle
  FROM dba_audit_mgmt_cleanup_jobs
 WHERE audit_trail IN ('UNIFIED AUDIT TRAIL', 'ALL AUDIT TRAILS')
UNION ALL
SELECT 'MARCA DE ARCHIVO', audit_trail, TO_CHAR(last_archive_ts, 'YYYY-MM-DD HH24:MI'), 'instancia ' || rac_instance
  FROM dba_audit_mgmt_last_arch_ts
UNION ALL
SELECT 'TABLESPACE DE LA TRAZA', audit_trail, parameter_value, parameter_name
  FROM dba_audit_mgmt_config_params
 WHERE audit_trail = 'UNIFIED AUDIT TRAIL' AND parameter_name = 'DB AUDIT TABLESPACE'`,
    esperado: 'Una tarea de purga habilitada y una marca de archivo: la traza se conserva durante un periodo definido y se archiva antes de purgarse.',
    evaluador(filas) {
      const tarea = filas.filter((f) => f.TIPO === 'TAREA DE PURGA' && f.ESTADO === 'ENABLED');
      const marca = filas.filter((f) => f.TIPO === 'MARCA DE ARCHIVO');
      const ts = filas.find((f) => f.TIPO === 'TABLESPACE DE LA TRAZA');
      const lugar = ts ? ` La traza está en el tablespace ${ts.ESTADO}.` : '';
      if (tarea.length && marca.length) return { estado: 'CUMPLE', detalle: `Tarea de purga ${tarea[0].NOMBRE} habilitada y última marca de archivo ${marca[0].ESTADO}.${lugar}` };
      if (tarea.length || marca.length) {
        return { estado: 'PARCIAL', detalle: (tarea.length ? 'Hay tarea de purga pero no marca de archivo: se podría purgar sin archivar.' : 'Hay marca de archivo pero no una tarea de purga programada.') + lugar };
      }
      return { estado: 'NO CUMPLE', madurez: 1, detalle: `No hay política de retención: ninguna tarea de purga ni marca de archivo definida.${lugar} La inalterabilidad de la traza no se puede verificar de forma remota.` };
    },
    explicacionCumple: 'La traza se conserva el tiempo definido y se archiva antes de eliminarse.',
    explicacionNoCumple: 'Sin una política de retención, la traza crece sin control o se purga sin respaldo, y no hay garantía de que se conserve lo necesario.',
    recomendacion: 'Definir la retención con DBMS_AUDIT_MGMT (archivar primero y luego purgar lo ya archivado):\n  BEGIN DBMS_AUDIT_MGMT.SET_LAST_ARCHIVE_TIMESTAMP(DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, SYSTIMESTAMP - INTERVAL \'365\' DAY); END;\n  BEGIN DBMS_AUDIT_MGMT.CREATE_PURGE_JOB(DBMS_AUDIT_MGMT.AUDIT_TRAIL_UNIFIED, 24, \'PURGA_TRAZA\', TRUE); END;',
  },

  // ======================= A8.20 Seguridad de redes =======================
  {
    id: 'A8.20-1', controlId: 'A8.20', fuente: 'V08 (PB-08a)',
    nombre: 'Cifrado e integridad de la sesión de red',
    descripcion: 'Servicios de red negociados por la propia sesión de auditoría (V$SESSION_CONNECT_INFO). El cliente del sistema solo acepta cifrado (ACCEPTED), así que si aparece es porque el servidor lo exige o lo pide.',
    sql: `SELECT network_service_banner
  FROM v$session_connect_info
 WHERE sid = SYS_CONTEXT('USERENV', 'SID')`,
    esperado: 'Aparecen un adaptador de cifrado (p. ej. AES256) y uno de integridad (p. ej. SHA512).',
    evaluador(filas) {
      const lineas = filas.map((f) => String(f.NETWORK_SERVICE_BANNER));
      const alg = lineas.map((l) => /^(\S+) Encryption service adapter/.exec(l)).find(Boolean);
      const chk = lineas.map((l) => /^(\S+) Crypto-checksumming service adapter/.exec(l)).find(Boolean);
      if (alg && chk) return { estado: 'CUMPLE', detalle: `Sesión cifrada con ${alg[1]} e integridad ${chk[1]}.` };
      if (alg) return { estado: 'PARCIAL', detalle: `Sesión cifrada con ${alg[1]} pero sin verificación de integridad.` };
      return { estado: 'NO CUMPLE', detalle: 'La sesión viaja en texto claro: no se negoció cifrado ni integridad.' };
    },
    explicacionCumple: 'El tráfico entre clientes y la base no se puede leer ni alterar en la red.',
    explicacionNoCumple: 'Las consultas y sus resultados (incluidos datos confidenciales) viajan legibles por la red.',
    recomendacion: 'Exigir cifrado nativo e integridad en el sqlnet.ora del servidor:\n  SQLNET.ENCRYPTION_SERVER = REQUIRED\n  SQLNET.ENCRYPTION_TYPES_SERVER = (AES256, AES192)\n  SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED\n  SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER = (SHA512, SHA384, SHA256)\nO configurar TLS (TCPS). Script del laboratorio: ./ejecutar.sh implementacion I08',
  },

  // ======================= A8.13 Respaldo de la información =======================
  {
    id: 'A8.13-1', controlId: 'A8.13', fuente: 'V09 (PB-09a)',
    nombre: 'Modo ARCHIVELOG',
    descripcion: 'Modo de registro de la base (V$DATABASE): sin ARCHIVELOG no hay respaldos en caliente ni recuperación a un punto en el tiempo.',
    sql: `SELECT name, log_mode, force_logging, created
  FROM v$database`,
    esperado: 'LOG_MODE = ARCHIVELOG.',
    evaluador(filas) {
      const f = filas[0];
      if (!f) return { estado: 'NO CUMPLE', detalle: 'V$DATABASE no devolvió filas.' };
      if (f.LOG_MODE === 'ARCHIVELOG') return { estado: 'CUMPLE', detalle: `La base ${f.NAME} está en ARCHIVELOG (force_logging=${f.FORCE_LOGGING}).` };
      return { estado: 'NO CUMPLE', detalle: `La base ${f.NAME} está en ${f.LOG_MODE}.` };
    },
    explicacionCumple: 'Los cambios se archivan, lo que permite respaldos en línea y recuperación completa.',
    explicacionNoCumple: 'En NOARCHIVELOG solo se puede respaldar con la base cerrada y se pierden los cambios desde el último respaldo.',
    recomendacion: 'Activar ARCHIVELOG (requiere reiniciar la instancia):\n  SHUTDOWN IMMEDIATE\n  STARTUP MOUNT\n  ALTER DATABASE ARCHIVELOG;\n  ALTER DATABASE OPEN;\nScript del laboratorio: ./ejecutar.sh implementacion I09',
  },
  {
    id: 'A8.13-2', controlId: 'A8.13', fuente: 'V09 (PB-09b)',
    nombre: 'Respaldos recientes y cifrados',
    descripcion: 'Piezas de respaldo RMAN vigentes (V$BACKUP_PIECE, estado A). Desde la PDB se ven las piezas de toda la CDB registradas en el archivo de control.',
    sql: `SELECT recid, tag, encrypted, status, completion_time,
       TRUNC(SYSDATE - completion_time) dias, ROUND(bytes / 1048576) mb, con_id
  FROM v$backup_piece
 WHERE status = 'A'
 ORDER BY completion_time DESC
 FETCH FIRST 20 ROWS ONLY`,
    esperado: 'Al menos una pieza de los últimos 30 días y todas las piezas vigentes cifradas (ENCRYPTED = YES).',
    evaluador(filas) {
      if (!filas.length) {
        return { estado: 'NO CUMPLE', detalle: 'No hay piezas de respaldo vigentes registradas en el archivo de control. (Si se respalda con un catálogo RMAN externo, verifíquelo allí.)' };
      }
      const sinCifrar = filas.filter((f) => f.ENCRYPTED !== 'YES');
      const masReciente = Math.min(...filas.map((f) => Number(f.DIAS)));
      if (sinCifrar.length) return { estado: 'PARCIAL', detalle: `${sinCifrar.length} de ${filas.length} piezas vigentes sin cifrar (${lista(sinCifrar.map((f) => f.TAG || `recid ${f.RECID}`))}).` };
      if (masReciente > 30) return { estado: 'PARCIAL', detalle: `Las ${filas.length} piezas están cifradas, pero el respaldo más reciente tiene ${masReciente} días.` };
      return { estado: 'CUMPLE', detalle: `${filas.length} piezas vigentes, todas cifradas; la más reciente tiene ${masReciente} día(s).` };
    },
    explicacionCumple: 'Hay respaldos recientes y, si se roban los archivos de respaldo, no se pueden leer.',
    explicacionNoCumple: 'Sin respaldos recientes y cifrados, se arriesga la disponibilidad y una copia robada expone todos los datos.',
    recomendacion: 'Configurar RMAN con cifrado y respaldar periódicamente:\n  RMAN> CONFIGURE ENCRYPTION FOR DATABASE ON;\n  RMAN> CONFIGURE ENCRYPTION ALGORITHM \'AES256\';\n  RMAN> BACKUP DATABASE PLUS ARCHIVELOG TAG \'DIARIO_CIFRADO\';\nScript del laboratorio: ./ejecutar.sh implementacion I09',
  },

  // ======================= A8.10 Eliminación de información =======================
  {
    id: 'A8.10-1', controlId: 'A8.10', fuente: 'V11 (PB-11a)',
    nombre: 'Objetos en la papelera de reciclaje',
    descripcion: 'Objetos borrados de esquemas de aplicación que siguen recuperables en DBA_RECYCLEBIN (con sus datos).',
    sql: `SELECT owner, original_name, object_name, type, droptime
  FROM dba_recyclebin
 WHERE owner IN (${APP_USUARIOS})
 ORDER BY droptime`,
    esperado: 'no rows selected.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'La papelera de los esquemas de aplicación está vacía.' };
      return { estado: 'NO CUMPLE', detalle: `${filas.length} objeto(s) borrado(s) pero recuperables: ${lista(filas.map((f) => `${f.OWNER}.${f.ORIGINAL_NAME} (${f.TYPE})`))}.` };
    },
    explicacionCumple: 'Lo que se borra se elimina de verdad y no queda una copia recuperable con FLASHBACK.',
    explicacionNoCumple: 'Una tabla en la papelera conserva todas sus filas y se recupera con FLASHBACK TABLE ... TO BEFORE DROP.',
    recomendacion: 'Purgar los objetos y borrar en adelante con PURGE:\n  PURGE TABLE <esquema>."<nombre BIN$...>";\n  DROP TABLE <tabla> PURGE;\nScript del laboratorio: ./ejecutar.sh implementacion I11',
  },
  {
    id: 'A8.10-2', controlId: 'A8.10', fuente: 'V11 (PB-11b)',
    nombre: 'Copias temporales olvidadas',
    descripcion: 'Tablas de aplicación con nombres típicos de copias (%_TMP, %_TEMP, %_BAK, %_OLD, %_RESPALDO%, %_EXPORT%, %_COPIA%).',
    sql: `SELECT owner, table_name, tablespace_name, num_rows
  FROM dba_tables
 WHERE owner IN (${APP_USUARIOS})
   AND dropped = 'NO'
   AND (table_name LIKE '%\\_TMP' ESCAPE '\\' OR table_name LIKE '%\\_TEMP' ESCAPE '\\'
        OR table_name LIKE '%\\_BAK' ESCAPE '\\' OR table_name LIKE '%\\_OLD' ESCAPE '\\'
        OR table_name LIKE '%\\_RESPALDO%' ESCAPE '\\' OR table_name LIKE '%\\_EXPORT%' ESCAPE '\\'
        OR table_name LIKE '%\\_COPIA%' ESCAPE '\\')
 ORDER BY owner, table_name`,
    esperado: 'no rows selected.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'No hay tablas con nombres de copias temporales.' };
      return { estado: 'NO CUMPLE', detalle: `Copias que duplican datos fuera de los controles: ${lista(filas.map((f) => `${f.OWNER}.${f.TABLE_NAME}`))}.` };
    },
    explicacionCumple: 'No quedan duplicados de datos sin los controles de la tabla original.',
    explicacionNoCumple: 'Las copias temporales suelen quedar sin redacción, sin VPD, sin auditoría y sin cifrar.',
    recomendacion: 'Eliminar las copias que ya no se usan, sin dejarlas en la papelera:\n  DROP TABLE <esquema>.<tabla> PURGE;\nScript del laboratorio: ./ejecutar.sh implementacion I11',
  },

  // ======================= A5.12 Clasificación de la información (heurística) =======================
  {
    id: 'A5.12-1', controlId: 'A5.12', fuente: 'nueva (heurística)', heuristica: true,
    nombre: 'Inventario de columnas sensibles y su protección',
    descripcion: 'HEURÍSTICA por nombre de columna: busca columnas como cédula, tarjeta, correo, teléfono o salario en esquemas de aplicación y revisa si están redactadas o cifradas. Requiere revisión humana.',
    sql: `${SQL_SENSIBLES}
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
 ORDER BY s.owner, s.table_name, s.column_name`,
    binds: { patron: PATRON_SENSIBLE },
    esperado: 'Toda columna sensible detectada está redactada o cifrada.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'La heurística no encontró columnas con nombres sensibles. Confirme manualmente que no existan con otros nombres.' };
      const desprotegidas = filas.filter((f) => f.REDACTADA === 'NO' && f.CIFRADA === 'NO');
      const estado = porProporcion(filas.length, desprotegidas.length);
      const tablas = [...new Set(desprotegidas.map((f) => `${f.OWNER}.${f.TABLE_NAME}`))];
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} columnas sensibles detectadas están redactadas o cifradas.`
        : `${desprotegidas.length} de ${filas.length} columnas sensibles sin redacción ni cifrado, en ${lista(tablas)}.` };
    },
    explicacionCumple: 'Las columnas que parecen sensibles tienen al menos un control técnico de confidencialidad.',
    explicacionNoCumple: 'Hay columnas que por su nombre parecen contener datos personales y no tienen redacción ni cifrado. Revise si son sensibles.',
    recomendacion: 'Confirmar el inventario con el dueño de los datos y proteger cada columna sensible con redacción (I05) y cifrado (I04).\nScripts del laboratorio: ./ejecutar.sh implementacion I04 e I05',
  },
  {
    id: 'A5.12-2', controlId: 'A5.12', fuente: 'nueva (heurística)', heuristica: true,
    nombre: 'Etiquetas de clasificación en las columnas sensibles',
    descripcion: 'HEURÍSTICA: comprueba si cada columna sensible tiene un comentario de clasificación (CONFIDENCIAL, RESTRINGIDO, INTERNO, PÚBLICO) en DBA_COL_COMMENTS.',
    sql: `${SQL_SENSIBLES}
SELECT s.owner, s.table_name, s.column_name, m.comments comentario
  FROM sensibles s
  LEFT JOIN dba_col_comments m
         ON m.owner = s.owner AND m.table_name = s.table_name AND m.column_name = s.column_name
 ORDER BY s.owner, s.table_name, s.column_name`,
    binds: { patron: PATRON_SENSIBLE },
    esperado: 'Cada columna sensible tiene un comentario con su nivel de clasificación.',
    evaluador(filas) {
      if (!filas.length) return { estado: 'CUMPLE', detalle: 'La heurística no encontró columnas con nombres sensibles.' };
      const etiqueta = /CONFIDENCIAL|RESTRINGID|INTERN|P[UÚ]BLIC|SENSIBLE|SECRET/i;
      const sin = filas.filter((f) => !etiqueta.test(f.COMENTARIO || ''));
      const estado = porProporcion(filas.length, sin.length);
      return { estado, detalle: estado === 'CUMPLE'
        ? `Las ${filas.length} columnas sensibles tienen etiqueta de clasificación.`
        : `${sin.length} de ${filas.length} columnas sensibles sin etiqueta de clasificación (no existe un inventario formal en la base).` };
    },
    explicacionCumple: 'La clasificación de los datos está documentada junto a ellos.',
    explicacionNoCumple: 'Sin una clasificación formal, cada persona decide por su cuenta qué es confidencial y qué controles aplicar.',
    recomendacion: 'Registrar la clasificación de cada columna, por ejemplo con comentarios:\n  COMMENT ON COLUMN segconf.clientes.tarjeta IS \'CONFIDENCIAL - dato de pago\';\nO mantener una tabla de inventario de clasificación revisada por el dueño de los datos.',
  },

  // ======================= A8.8 Gestión de vulnerabilidades técnicas =======================
  {
    id: 'A8.8-1', controlId: 'A8.8', fuente: 'V00',
    nombre: 'Versión del motor con soporte',
    descripcion: 'Versión completa de la instancia (V$INSTANCE) y banner del producto (V$VERSION).',
    sql: `SELECT i.version_full, i.instance_name, v.banner_full
  FROM v$instance i
 CROSS JOIN v$version v`,
    esperado: 'Versión principal 19 o 23 (26ai), ambas con soporte vigente.',
    evaluador(filas) {
      const f = filas[0];
      if (!f) return { estado: 'NO CUMPLE', detalle: 'No se obtuvo la versión.' };
      const mayor = Number.parseInt(String(f.VERSION_FULL), 10);
      const banner = String(f.BANNER_FULL || '').split('\n')[0];
      if (mayor === 19 || mayor >= 23) return { estado: 'CUMPLE', detalle: `Versión ${f.VERSION_FULL} (${banner}).` };
      if (mayor === 21) return { estado: 'PARCIAL', detalle: `Versión ${f.VERSION_FULL}: 21c es una versión de innovación con soporte corto.` };
      return { estado: 'NO CUMPLE', detalle: `Versión ${f.VERSION_FULL}: fuera de soporte; no recibe parches de seguridad.` };
    },
    explicacionCumple: 'La versión instalada sigue recibiendo actualizaciones de seguridad de Oracle.',
    explicacionNoCumple: 'Una versión sin soporte acumula vulnerabilidades conocidas sin corrección.',
    recomendacion: 'Planificar la actualización a una versión con soporte (19c o 23ai/26ai) según la política de Oracle.',
  },
  {
    id: 'A8.8-2', controlId: 'A8.8', fuente: 'nueva',
    nombre: 'Parches aplicados y antigüedad',
    descripcion: 'Historial de parches SQL (DBA_REGISTRY_SQLPATCH). En Oracle Free suele estar vacío porque se actualiza reemplazando la imagen.',
    sql: `SELECT patch_id, patch_type, action, status, action_time,
       TRUNC(SYSDATE - CAST(action_time AS DATE)) dias, description
  FROM dba_registry_sqlpatch
 ORDER BY action_time DESC
 FETCH FIRST 10 ROWS ONLY`,
    esperado: 'Último parche aplicado con éxito hace 120 días o menos.',
    evaluador(filas, ctx) {
      const version = (ctx.info && ctx.info.version) || 'desconocida';
      const exitosos = filas.filter((f) => f.STATUS === 'SUCCESS' && f.ACTION === 'APPLY');
      if (!filas.length) {
        return { estado: 'PARCIAL', madurez: 2, detalle: `DBA_REGISTRY_SQLPATCH está vacía (normal en Oracle Free). Se evalúa con la versión ${version}: el sistema no puede confirmar de forma remota que sea la última actualización publicada. Compárela con las Release Updates de Oracle.` };
      }
      if (!exitosos.length) return { estado: 'NO CUMPLE', detalle: `Hay ${filas.length} registro(s) de parches pero ninguno aplicado con éxito.` };
      const dias = Math.min(...exitosos.map((f) => Number(f.DIAS)));
      const ultimo = exitosos.find((f) => Number(f.DIAS) === dias);
      const det = `Último parche ${ultimo.PATCH_ID} (${String(ultimo.DESCRIPTION || '').slice(0, 60)}) aplicado hace ${dias} días.`;
      if (dias <= 120) return { estado: 'CUMPLE', detalle: det };
      if (dias <= 365) return { estado: 'PARCIAL', detalle: det + ' Supera un trimestre de antigüedad.' };
      return { estado: 'NO CUMPLE', detalle: det + ' Más de un año sin parches.' };
    },
    explicacionCumple: 'Los parches de seguridad se aplican con regularidad trimestral.',
    explicacionNoCumple: 'No se puede demostrar que la base tenga las correcciones de seguridad recientes.',
    recomendacion: 'Aplicar la última Release Update trimestral (OPatch + datapatch) y documentar el proceso. En Oracle Free, recrear el contenedor con la imagen más reciente conservando el volumen de datos.',
  },
];

for (const p of PRUEBAS) {
  p.tipo = 'diccionario';
  if (!p.comandoEquivalente) p.comandoEquivalente = COMANDO;
  // La descripción menciona :dias; se muestra con el valor de enlace real
  if (p.binds && p.binds.dias) p.descripcion = p.descripcion.replace(':dias', String(p.binds.dias));
}

module.exports = { PRUEBAS, PATRON_SENSIBLE, porProporcion, numeroLimite, lista };

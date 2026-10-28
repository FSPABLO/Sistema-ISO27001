# Comparación antes / después de los controles

Corrida de referencia: `./ejecutar.sh todo` sobre un contenedor y un volumen **recién creados**, el 2026-10-19 en Oracle AI Database 26ai Free 23.26.3.0.0.
Fuentes: `evidencias/antes/resumen_verificacion.txt` y `evidencias/despues/resumen_verificacion.txt`.

| Prueba | Control ISO/IEC 27001:2022 | Antes | Después | Observación |
|---|---|---|---|---|
| PB-00 | (entorno) | CUMPLE | CUMPLE | FREEPDB1 en READ WRITE, 60 filas en producción y 60 en el clon. Es una precondición, no un control. |
| PB-01a | A.5.18, A.8.2 | NO CUMPLE | CUMPLE | SCOTT pasa de `OPEN` a `EXPIRED & LOCKED` (I01). |
| PB-01b | A.5.18, A.5.17 | NO CUMPLE | CUMPLE | `DBA_USERS_WITH_DEFPWD` detecta SCOTT/TIGER; después no quedan cuentas abiertas con clave por defecto. |
| PB-02a | A.5.17 | NO CUMPLE | CUMPLE | DEFAULT tiene `FAILED_LOGIN_ATTEMPTS UNLIMITED`; PRF_SEGCONF lo fija en 5 para las 6 cuentas del proyecto (I02). |
| PB-02b | A.5.17 | NO CUMPLE | CUMPLE | DEFAULT no tiene función de verificación (`NULL`); PRF_SEGCONF usa `ORA12C_STRONG_VERIFY_FUNCTION`. |
| PB-02c | A.5.17 | NO CUMPLE | CUMPLE | `PASSWORD_LIFE_TIME` pasa de `UNLIMITED` a 90 días. |
| PB-03a | A.8.2 | NO CUMPLE | CUMPLE | Se revoca `SELECT ANY TABLE` a APP_REPORTES (I03). |
| PB-03b | A.8.2, A.8.20 | NO CUMPLE | CUMPLE | Se revoca EXECUTE de PUBLIC sobre UTL_FILE/HTTP/TCP/SMTP/INADDR. Antes, I03 da el permiso directo a CTXSYS, GSMADMIN_INTERNAL y MDSYS, y luego recompila: quedan 0 objetos inválidos. |
| PB-03c | A.5.15 | NO CUMPLE | CUMPLE | Los 3 permisos directos sobre CLIENTES se reemplazan por roles (ROL_CONSULTA_CLIENTES, ROL_SOPORTE_CLIENTES). |
| PB-04a | A.8.24 | NO CUMPLE | CUMPLE | Keystore de `NOT_AVAILABLE` a `OPEN` (I04a + I04). Sigue `OPEN` (LOCAL_AUTOLOGIN) después del reinicio de I09. |
| PB-04b | A.8.24 | NO CUMPLE | CUMPLE | Tablespace TS_SEGCONF_ENC creado con AES256. |
| PB-04c | A.8.24 | NO CUMPLE | CUMPLE | La tabla CLIENTES y su PK quedan en el tablespace cifrado (2 de 2 segmentos). Ver la observación sobre residuos en USERS. |
| PB-05a | A.8.11 | NO CUMPLE | CUMPLE | Política POL_RED_CLIENTES sobre TARJETA, EMAIL, CEDULA, TELEFONO y SALARIO (I05). |
| PB-05b | A.8.11 | NO CUMPLE | CUMPLE | APP_CONSULTA ve `****-****-****-0001`, `xxxx@correo-ficticio.test` y salario `0`. |
| PB-06a | A.8.3 | NO CUMPLE | CUMPLE | Política POL_VPD_CLIENTES con `SEGCONF.PKG_SEGURIDAD.PRED_CLIENTES` (I06). |
| PB-06b | A.8.3 | NO CUMPLE | CUMPLE | APP_SOPORTE pasa de ver 60 filas en 7 provincias a ver 9 filas, solo de HEREDIA. |
| PB-07a | A.8.15 | NO CUMPLE | CUMPLE | POL_AUD_CLIENTES (y POL_AUD_ADMIN) habilitadas (I07). |
| PB-07b | A.8.15 | NO CUMPLE | CUMPLE | El SELECT de prueba de APP_CONSULTA aparece en `UNIFIED_AUDIT_TRAIL`. |
| PB-08a | A.8.20, A.8.24 | NO CUMPLE | CUMPLE | La sesión TCP negocia AES256 y SHA512 (I08, `sqlnet.ora`). |
| PB-08b | A.8.20 | NO CUMPLE | CUMPLE | Un cliente con `SQLNET.ENCRYPTION_CLIENT=REJECTED` se conectaba en claro; después recibe ORA-12660. |
| PB-09a | A.8.13 | NO CUMPLE | CUMPLE | NOARCHIVELOG → ARCHIVELOG (I09: reinicio en MOUNT con autenticación local). |
| PB-09b | A.8.13, A.8.24 | NO CUMPLE | CUMPLE | No había respaldos; después hay 1 pieza de datafiles de FREEPDB1 cifrada y 0 sin cifrar. |
| PB-10 | A.8.11, A.8.33 | NO CUMPLE | CUMPLE | Clon con 60 de 60 filas idénticas a producción → 0 (I10). |
| PB-11a | A.8.10 | NO CUMPLE | CUMPLE | `SEGCONF.CLIENTES_RESPALDO` purgada de la papelera (I11). |
| PB-11b | A.8.10 | NO CUMPLE | CUMPLE | `SEGCONF.CLIENTES_EXPORT_TMP` eliminada con PURGE. |
| PB-12a | A.5.15, A.8.3 | NO CUMPLE | CUMPLE | APP_REPORTES leía 60 filas; ahora recibe ORA-00942 (solo conserva la vista agregada). |
| PB-12b | A.5.15, A.8.31 | NO CUMPLE | CUMPLE | SEGCONF_DEV leía producción; ahora recibe ORA-00942. |

**Totales:** antes 1 CUMPLE / 26 NO CUMPLE / 0 NO DISPON.; después 27 CUMPLE / 0 NO CUMPLE / 0 NO DISPON.

## Segunda corrida (idempotencia)

`./ejecutar.sh todo` se ejecutó dos veces seguidas sin errores `ORA-`, `SP2-` ni `PLS-` (ver `evidencias/idempotencia/`).
El estado "después" es idéntico. En el estado "antes" de la segunda corrida, **PB-04a** y **PB-09a** dan CUMPLE, porque el keystore TDE (auto-login) y el modo ARCHIVELOG son infraestructura persistente de la instancia que la preparación no deshace a propósito (deshacerlos exigiría reiniciar y dejaría inaccesibles los respaldos cifrados). Las otras 25 pruebas vuelven a NO CUMPLE.

## Observación fuera de las pruebas PB: residuos en el datafile USERS

Después de I04 e I11, `users01.dbf` todavía contiene **240 apariciones en claro** del dominio ficticio `correo-ficticio.test` (comprobado con `grep -a` dentro del contenedor). En `ts_segconf_enc01.dbf` hay 0. Son bloques antiguos de la tabla movida y de las copias eliminadas: Oracle los marca como libres, pero no los sobrescribe. PB-04c y PB-11 miden el diccionario, no los bloques físicos, y por eso no lo detectan.
Recomendación (no aplicada, para no cambiar el alcance de las pruebas): crear los datos confidenciales directamente en un tablespace cifrado desde el inicio, o cifrar también USERS (`ALTER TABLESPACE users ENCRYPTION ONLINE USING 'AES256' ENCRYPT`) y validar el resultado con la misma búsqueda.

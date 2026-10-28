# Resultados contra las dos bases del laboratorio

Ejecuciones completas del 25 de octubre de 2026 (34 pruebas de diccionario + 5 funcionales con el perfil "Laboratorio SEGCONF"), hechas por la prueba de punta a punta con un usuario analista (ejecuciones #16 y #17). Las corridas por API (#5 y #6) dieron exactamente lo mismo.

## Resumen

| Base | Puntaje | Cumple | Parcial | No cumple | No evaluable | Omitida | Pruebas (C / P / NC) |
|---|---|---|---|---|---|---|---|
| Débil (puerto 1523) | **17,8 %** | 0 | 6 | **12** | 0 | 0 | 7 / 3 / 29 |
| Endurecida (puerto 1522) | **81,5 %** | **11** | 7 | 0 | 0 | 0 | 28 / 9 / 2 |
| Endurecida sin pruebas funcionales (#18) | 80,4 % | 10 | 7 | 0 | 0 | 1 (A8.33) | — |

Sin pruebas funcionales, A8.33 solo tiene la prueba del clon y queda **Omitida**; por eso sale del puntaje (146 → 138 puntos de peso evaluados).

## Base débil: estado por control

| Control | Peso | Estado | Motivo principal |
|---|---|---|---|
| A5.12 | 8 | No cumple | 15 de 15 columnas sensibles sin redacción ni cifrado y sin etiqueta de clasificación |
| A5.15 | 10 | Parcial | 3 permisos directos sobre SEGCONF.CLIENTES; APP_REPORTES y SEGCONF_DEV leen el detalle (PB-12a/b); sin permisos a PUBLIC |
| A5.16 | 10 | Parcial | 4 de 8 cuentas abiertas nunca usadas (APP_AUDITOR, PDBADMIN, SCOTT, SEGCONF); no hay cuentas expiradas |
| A5.17 | 8 | No cumple | 8 de 8 cuentas con perfil DEFAULT: intentos, vencimiento y verificación ilimitados |
| A5.18 | 10 | No cumple | SCOTT abierta con clave por defecto |
| A5.33 | 6 | No cumple | Nadie aparte de ISO_AUDIT lee la traza; sin política de retención |
| A8.2 | 10 | Parcial | APP_REPORTES tiene SELECT ANY TABLE; roles DBA y SYSDBA en orden |
| A8.3 | 10 | No cumple | Sin políticas VPD; APP_SOPORTE ve 60 de 60 filas en 7 provincias |
| A8.5 | 8 | Parcial | Sin hashes 10G pero con 11G; perfil DEFAULT sin verificación (8 cuentas) |
| A8.8 | 6 | Parcial | Versión 23.26.3 con soporte; sin registro de parches (Oracle Free) |
| A8.10 | 8 | No cumple | SEGCONF.CLIENTES_RESPALDO en la papelera; copia SEGCONF.CLIENTES_EXPORT_TMP |
| A8.11 | 8 | No cumple | Sin políticas de redacción; APP_CONSULTA ve tarjeta, correo y salario reales |
| A8.12 | 8 | Parcial | 5 paquetes UTL_* para PUBLIC; sin enlaces ni directorios expuestos |
| A8.13 | 8 | No cumple | NOARCHIVELOG y sin piezas de respaldo |
| A8.15 | 6 | No cumple | Ninguna política de auditoría unificada habilitada ni registros de acceso |
| A8.20 | 6 | No cumple | Sesión en texto claro |
| A8.24 | 8 | No cumple | Keystore NOT_AVAILABLE; 3 tablas con datos sensibles en USERS sin cifrar |
| A8.33 | 8 | No cumple | 60 de 60 filas del clon con datos idénticos a producción |

Los seis "Parcial" de la base débil son reales: en cada uno hay alguna prueba que sí cumple (por ejemplo, no hay enlaces de base de datos ni permisos a PUBLIC, la versión tiene soporte). Las debilidades sembradas por `00_preparacion_entorno.sql` aparecen todas como "No cumple".

## Base débil: lista de prioridades

Prioridad = peso × brecha; impacto = puntos que subiría el puntaje si el control pasara a cumplir.

| # | Control | Estado | Peso | Prioridad | Impacto | Riesgo |
|---|---|---|---|---|---|---|
| 1 | A5.18 Derechos de acceso | No cumple | 10 | 10 | +6,8 | R-CONF-01 |
| 2 | A8.3 Restricción del acceso a la información | No cumple | 10 | 10 | +6,8 | R-CONF-01 |
| 3 | A5.12 Clasificación de la información | No cumple | 8 | 8 | +5,5 | R-CONF-04 |
| 4 | A5.17 Información de autenticación | No cumple | 8 | 8 | +5,5 | R-CONF-02 |
| 5 | A8.10 Eliminación de información | No cumple | 8 | 8 | +5,5 | R-CONF-03 |
| 6 | A8.11 Enmascaramiento de datos | No cumple | 8 | 8 | +5,5 | R-CONF-04 |
| 7 | A8.13 Respaldo de la información | No cumple | 8 | 8 | +5,5 | R-CONF-03 |
| 8 | A8.24 Uso de criptografía | No cumple | 8 | 8 | +5,5 | R-CONF-03 |
| 9 | A8.33 Información de prueba | No cumple | 8 | 8 | +5,5 | R-CONF-04 |
| 10 | A5.33 Protección de los registros | No cumple | 6 | 6 | +4,1 | R-CONF-06 |
| 11 | A8.15 Registro de eventos | No cumple | 6 | 6 | +4,1 | R-CONF-06 |
| 12 | A8.20 Seguridad de redes | No cumple | 6 | 6 | +4,1 | R-CONF-05 |
| 13 | A5.15 Control de acceso | Parcial | 10 | 5 | +3,4 | R-CONF-01 |
| 14 | A5.16 Gestión de identidades | Parcial | 10 | 5 | +3,4 | R-CONF-01 |
| 15 | A8.2 Derechos de acceso privilegiado | Parcial | 10 | 5 | +3,4 | R-CONF-01 |
| 16 | A8.5 Autenticación segura | Parcial | 8 | 4 | +2,7 | R-CONF-02 |
| 17 | A8.12 Prevención de fuga de datos | Parcial | 8 | 4 | +2,7 | R-CONF-03 |
| 18 | A8.8 Gestión de vulnerabilidades técnicas | Parcial | 6 | 3 | +2,1 | R-CONF-05 |

## Base endurecida: controles que no cumplen del todo y por qué

Ningún control queda en "No cumple". Los siete "Parcial" se revisaron uno por uno: **todos son brechas reales**, no errores de prueba; varias coinciden con las que el informe ya califica como Parcial (T01, T09, T10, T12).

| Control | Prueba que no cumple | Qué se observó | Por qué es real |
|---|---|---|---|
| A5.16 Gestión de identidades | A5.16-1 | PDBADMIN abierta y nunca usada | La crea la imagen `gvenzl/oracle-free`; I01 e I03 no la tocan. Debería bloquearse. |
| A5.17 Información de autenticación | A5.17-1/2/3 | PDBADMIN con perfil DEFAULT: intentos, vencimiento y verificación ilimitados | I02 asigna PRF_SEGCONF solo a las 6 cuentas del proyecto; el perfil DEFAULT sigue débil. |
| A8.5 Autenticación segura | A8.5-1, A8.5-2 | Todas las cuentas conservan el verificador 11G (SHA-1); PDBADMIN sin verificación | Falta `SQLNET.ALLOWED_LOGON_VERSION_SERVER = 12a` en `sqlnet.ora` y cambiar las claves. |
| A8.24 Uso de criptografía | A8.24-2 | SEGCONF_DEV.CLIENTES está en USERS, que no está cifrado | El clon está enmascarado, pero su tablespace no está cifrado; el informe también señala residuos en claro en USERS. |
| A5.12 Clasificación de la información | A5.12-1 (parcial), A5.12-2 (no cumple) | Las 5 columnas sensibles del clon no tienen redacción ni cifrado; ninguna columna tiene etiqueta de clasificación | Coincide con el informe: "No se construyó una tabla formal de clasificación". La prueba es heurística y lo indica. |
| A5.33 Protección de los registros | A5.33-2 (no cumple) | Sin tarea de purga ni marca de archivo de la traza | Coincide con el informe: "No se verificó la retención ni la inalterabilidad del registro". A5.33-1 sí cumple (APP_AUDITOR con AUDIT_VIEWER). |
| A8.8 Gestión de vulnerabilidades técnicas | A8.8-2 | `DBA_REGISTRY_SQLPATCH` vacía; versión 23.26.3 | Coincide con el informe: "No se evaluó el nivel de parches". El sistema no puede confirmar de forma remota que 23.26.3 sea la última RU, y no lo inventa. |

**Lo que el sistema no puede ver**: el informe califica A8.10 como Parcial por los 240 residuos en claro dentro de `users01.dbf`. El sistema da CUMPLE en A8.10 porque evalúa el diccionario (papelera vacía, sin copias temporales); los bloques físicos de un archivo de datos no se pueden leer con consultas remotas. La brecha física se refleja en A8.24-2 (USERS sin cifrar).

## No evaluables y omitidas

En las ejecuciones completas **no quedó ninguna prueba No evaluable ni Omitida**. Casos en que pueden aparecer:

- **Omitida**: las 5 pruebas funcionales (PB-05b, PB-06b, PB-12a, PB-12b, PB-10) si no se activan o si falta un usuario o su clave. A8.33 queda entero en Omitida porque solo tiene la prueba funcional del clon.
- **No evaluable**: la opción no existe en la edición (`V$OPTION` en FALSE para TDE, Data Redaction, VPD o Unified Auditing), falta un permiso de lectura (`ORA-00942`/`ORA-01031`; se indica revisar el script de `ISO_AUDIT`), se agota el tiempo máximo, un usuario funcional no puede conectarse o no tiene acceso a la tabla, o la comparación del clon no logra emparejar filas.

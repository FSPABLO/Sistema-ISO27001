# Entorno de pruebas

## Versión y plataforma

| Elemento | Valor |
|---|---|
| `V$VERSION` (BANNER_FULL) | `Oracle AI Database 26ai Free Release 23.26.3.0.0 - Develop, Learn, and Run for Free` / `Version 23.26.3.0.0` |
| `COMPATIBLE` | 23.6.0 |
| Imagen Docker | `gvenzl/oracle-free:23` (arm64 nativo), digest `sha256:7ed34d0ade89c91a553c9cbe9d42457c758fa29a762aaaa3137541ff30a2d1cb`, construida el 2026-08-30. No hizo falta la variante `23-slim`. |
| Host | macOS en Apple Silicon (arm64), Docker Desktop 29.8.0 |
| Contenedor / volumen | `eif402-iso27001` / `eif402_iso27001_data` (montado en `/opt/oracle/oradata`) |
| Puerto | 1522 del host → 1521 del contenedor |
| CDB / PDB | `FREE` / `FREEPDB1` |
| Carpeta del proyecto | montada en `/work`; los scripts se ejecutan con directorio de trabajo `/work/scripts` |

El contenedor `eif402-oracle`, de otro proyecto, no se usó ni se modificó.

## Opciones de la edición (`V$OPTION`)

| Opción | Valor |
|---|---|
| Transparent Data Encryption | TRUE |
| Data Redaction | TRUE |
| Fine-grained access control (VPD) | TRUE |
| Unified Auditing | TRUE |
| Backup Encryption | TRUE |
| Real Application Security | TRUE |
| Oracle Database Vault | FALSE (no se usa en el proyecto) |

**Funciones no disponibles:** ninguna de las que usa el proyecto. TDE, Data Redaction, VPD, auditoría unificada y respaldo RMAN cifrado funcionaron en esta edición Free sin ORA-00439 ni ningún otro error de "feature not enabled". Las verificaciones V04, V05, V06, V07 y V09 consultan `V$OPTION` y, si la opción estuviera en FALSE en otra versión, imprimen `NO DISPON.` en vez de forzar un resultado.

## Configuración que queda en la instancia tras la implementación

* `WALLET_ROOT=/opt/oracle/oradata/FREE/wallet` (SPFILE) y `TDE_CONFIGURATION='KEYSTORE_CONFIGURATION=FILE'`. Funcionó a la primera, así que no hizo falta la alternativa `ENCRYPTION_WALLET_LOCATION` en `sqlnet.ora`.
* Keystore united con clave de contraseña, más un keystore `LOCAL AUTO_LOGIN` (`cwallet.sso`) para que el keystore se abra solo después de cada reinicio. Ruta: `/opt/oracle/oradata/FREE/wallet/tde/`.
* `ARCHIVELOG` con `LOG_ARCHIVE_DEST_1='LOCATION=/opt/oracle/oradata/archivelog'`, dentro del volumen persistente. El destino por defecto de la imagen (`$ORACLE_HOME/dbs/arch`) se perdería al recrear el contenedor.
* `sqlnet.ora` (`$ORACLE_HOME/network/admin/sqlnet.ora`, un enlace simbólico a `/opt/oracle/oradata/dbconfig/FREE/sqlnet.ora`) con el bloque `ISO27001 I08`: `ENCRYPTION_SERVER=REQUIRED` (AES256/AES192) y `CRYPTO_CHECKSUM_SERVER=REQUIRED` (SHA-2).
* RMAN: `ENCRYPTION FOR DATABASE ON`, algoritmo AES256, respaldos en `/opt/oracle/oradata/backup`.
* Tras cada reinicio se ejecuta `ALTER PLUGGABLE DATABASE ALL OPEN` y `ALTER PLUGGABLE DATABASE FREEPDB1 SAVE STATE`.

## Usuarios y claves de prueba (todos ficticios, solo para este laboratorio)

| Usuario | Clave | Función |
|---|---|---|
| SYS / SYSTEM | `Oracle_2026_Pwd` | administración (`ORACLE_PASSWORD` del contenedor) |
| SEGCONF | `Segconf_2026_Prueba` | dueño de los datos de producción |
| SEGCONF_DEV | `Segdev_2026_Prueba` | dueño del clon de desarrollo |
| APP_CONSULTA | `Consulta_2026_Prueba` | atención al cliente (ve datos redactados, todas las provincias) |
| APP_SOPORTE | `Soporte_2026_Prueba` | soporte regional (VPD: solo HEREDIA) |
| APP_REPORTES | `Reportes_2026_Prueba` | reportes (solo la vista agregada `V_CLIENTES_RESUMEN`) |
| APP_AUDITOR | `Auditor_2026_Prueba` | lectura de la traza de auditoría (rol `AUDIT_VIEWER`) |
| SCOTT | `tiger` | cuenta de demostración (debilidad deliberada; I01 la bloquea) |
| Keystore TDE | `Wallet_2026_Prueba` | contraseña del keystore |

Las claves están definidas en `scripts/comun/config.sql` y `scripts/comun/config.sh`.

## Recrear el entorno desde cero

```bash
cd ~/Desktop/proyecto-iso27001-dba
```
```bash
docker run -d --name eif402-iso27001 -p 1522:1521 -e ORACLE_PASSWORD=Oracle_2026_Pwd -v eif402_iso27001_data:/opt/oracle/oradata -v "$PWD":/work gvenzl/oracle-free:23
```
```bash
docker logs -f eif402-iso27001
```
Cuando aparezca `DATABASE IS READY TO USE!`:
```bash
./ejecutar.sh todo
```

Para empezar otra vez desde una base virgen hay que borrar este contenedor y su volumen. Esto destruye solo el laboratorio `eif402-iso27001`:
```bash
docker rm -f eif402-iso27001
```
```bash
docker volume rm eif402_iso27001_data
```

Conexión desde el host (por ejemplo, DBeaver): `localhost:1522/FREEPDB1`. Después de I08, el cliente debe aceptar el cifrado nativo; el valor por defecto `ACCEPTED` de los drivers JDBC/OCI es suficiente.

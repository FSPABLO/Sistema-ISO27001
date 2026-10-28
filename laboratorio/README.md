# Controles ISO/IEC 27001:2022 para la confidencialidad en Oracle

Proyecto universitario: UNA Costa Rica, curso Administración de Bases de Datos.
Laboratorio reproducible sobre Oracle AI Database 26ai Free (23.26.3) en Docker. Todos los datos son **ficticios**.

## Estructura

```
ejecutar.sh                      ejecuta las fases dentro del contenedor (docker exec)
scripts/comun/                   config.sql / config.sh (parametros y claves de prueba), inicio.sql, volver_sys.sql, fin.sql
scripts/preparacion/             00_preparacion_entorno.sql  usuarios, SEGCONF.CLIENTES (60 filas), clon, debilidades, PKG_VERIF
                                 01_restaurar_red_y_respaldos.sh  revierte sqlnet.ora y borra respaldos RMAN (idempotencia)
scripts/implementacion/          I01 ... I11 (I04a, I08, I09 en shell)
scripts/verificacion/            V00 ... V12 (V08b en shell); imprimen "PB-xx | CUMPLE / NO CUMPLE / NO DISPON. | detalle"
evidencias/antes, despues        logs y resumen_verificacion.txt de cada corrida
evidencias/comparacion_antes_despues.md
docs/entorno.md, docs/CAMBIOS.md
```

## Controles

| Script | Control | Pruebas |
|---|---|---|
| I01 cuentas por defecto | A.5.18, A.8.2 | PB-01a/b |
| I02 perfil de contraseñas | A.5.17 | PB-02a/b/c |
| I03 mínimo privilegio y roles | A.5.15, A.8.2 | PB-03a/b/c, PB-12a/b |
| I04a + I04 TDE (WALLET_ROOT, keystore, tablespace cifrado) | A.8.24 | PB-04a/b/c |
| I05 Data Redaction | A.8.11 | PB-05a/b |
| I06 VPD | A.8.3 | PB-06a/b |
| I07 auditoría unificada | A.8.15 | PB-07a/b |
| I08 cifrado de red nativo | A.8.20, A.8.24 | PB-08a/b |
| I09 ARCHIVELOG y respaldo RMAN cifrado | A.8.13 | PB-09a/b |
| I10 enmascaramiento del clon | A.8.11, A.8.33 | PB-10 |
| I11 purga de residuos | A.8.10 | PB-11a/b |

## Uso

```bash
docker run -d --name eif402-iso27001 -p 1522:1521 -e ORACLE_PASSWORD=Oracle_2026_Pwd -v eif402_iso27001_data:/opt/oracle/oradata -v "$PWD":/work gvenzl/oracle-free:23
```
Espere a ver `DATABASE IS READY TO USE!` en `docker logs eif402-iso27001`. Luego:

```bash
./ejecutar.sh preparacion
```
```bash
./ejecutar.sh verificacion antes
```
```bash
./ejecutar.sh implementacion
```
```bash
./ejecutar.sh verificacion despues
```
O todo junto (idempotente, se puede repetir):
```bash
./ejecutar.sh todo
```
Un solo paso de implementación: `./ejecutar.sh implementacion I05`.

I04a e I09 **reinician la instancia** con autenticación local (`sqlplus / as sysdba`) y reabren y guardan el estado de FREEPDB1. Los comandos de SQL*Plus (`SET`, `DEFINE`, `COLUMN`, `VARIABLE`) solo funcionan en `sqlplus`, no en DBeaver.

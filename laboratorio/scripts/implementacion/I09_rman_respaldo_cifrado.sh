#!/usr/bin/env bash
# I09_rman_respaldo_cifrado.sh - Controles A.8.13 (respaldo) y A.8.24 (criptografia)
# Habilita ARCHIVELOG si hace falta (reinicio en MOUNT, autenticacion local) y genera un
# respaldo RMAN cifrado de FREEPDB1 (cifrado transparente con el keystore TDE de I04).
set -u
cd "$(dirname "$0")/.."
. comun/config.sh
echo "=== I09 Respaldo RMAN cifrado ==="
mkdir -p "$DIR_BACKUP" "$DIR_ARCH"
MODO=$(valor "select log_mode from v\$database;")
echo "Modo actual: $MODO"
if [ "$MODO" != "ARCHIVELOG" ]; then
  echo "Habilitando ARCHIVELOG (destino $DIR_ARCH, dentro del volumen persistente)..."
  sysdba <<SQL
ALTER SYSTEM SET log_archive_dest_1 = 'LOCATION=$DIR_ARCH' SCOPE = SPFILE;
SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;
ALTER PLUGGABLE DATABASE ALL OPEN;
ALTER PLUGGABLE DATABASE $PDB SAVE STATE;
SQL
fi
sysdba <<SQL
ARCHIVE LOG LIST
SET LINESIZE 200
COLUMN name FORMAT A12
SELECT name, open_mode FROM v\$pdbs;
COLUMN wrl_parameter FORMAT A45
SELECT con_id, status, wallet_type FROM v\$encryption_wallet;
SQL
WALLET=$(valor "select status from v\$encryption_wallet where con_id = 1;")
if [ "$WALLET" != "OPEN" ]; then
  echo "ERROR: el keystore TDE no esta OPEN ($WALLET); el cifrado transparente de RMAN no es posible."
  exit 1
fi
rman target / <<RMAN
CONFIGURE ENCRYPTION FOR DATABASE ON;
CONFIGURE ENCRYPTION ALGORITHM 'AES256';
CONFIGURE CHANNEL DEVICE TYPE DISK FORMAT '$DIR_BACKUP/%d_%U';
CONFIGURE CONTROLFILE AUTOBACKUP ON;
CONFIGURE CONTROLFILE AUTOBACKUP FORMAT FOR DEVICE TYPE DISK TO '$DIR_BACKUP/cf_%F';
BACKUP AS COMPRESSED BACKUPSET TAG 'ISO27001_CIFRADO' PLUGGABLE DATABASE $PDB PLUS ARCHIVELOG TAG 'ISO27001_CIFRADO';
LIST BACKUP SUMMARY;
EXIT
RMAN

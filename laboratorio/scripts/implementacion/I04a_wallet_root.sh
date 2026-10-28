#!/usr/bin/env bash
# I04a_wallet_root.sh - Control A.8.24 (uso de criptografia), paso previo a TDE
# Configura WALLET_ROOT (parametro estatico: requiere reiniciar la instancia) y TDE_CONFIGURATION.
# El reinicio se hace con autenticacion local (sqlplus / as sysdba), nunca por el listener.
set -u
cd "$(dirname "$0")/.."
. comun/config.sh
echo "=== I04a WALLET_ROOT y TDE_CONFIGURATION ==="
mkdir -p "$WALLET_ROOT/tde"
ACTUAL=$(valor "select value from v\$parameter where name = 'wallet_root';")
echo "WALLET_ROOT actual: '${ACTUAL}' - deseado: '$WALLET_ROOT'"
if [ "$ACTUAL" != "$WALLET_ROOT" ]; then
  echo "Configurando WALLET_ROOT en el SPFILE y reiniciando la instancia..."
  sysdba <<SQL
ALTER SYSTEM SET wallet_root = '$WALLET_ROOT' SCOPE = SPFILE;
SHUTDOWN IMMEDIATE
STARTUP
ALTER PLUGGABLE DATABASE ALL OPEN;
ALTER PLUGGABLE DATABASE $PDB SAVE STATE;
SQL
else
  echo "WALLET_ROOT ya configurado; no se reinicia."
fi
sysdba <<SQL
ALTER SYSTEM SET tde_configuration = 'KEYSTORE_CONFIGURATION=FILE' SCOPE = BOTH;
SET LINESIZE 200
COLUMN name FORMAT A20
COLUMN value FORMAT A50
SELECT name, value FROM v\$parameter WHERE name IN ('wallet_root', 'tde_configuration');
SELECT name, open_mode FROM v\$pdbs;
COLUMN wrl_parameter FORMAT A45
SELECT con_id, wrl_parameter, status, wallet_type FROM v\$encryption_wallet;
SQL

#!/usr/bin/env bash
# V08b_cifrado_red_cliente.sh - PB-08b: el servidor rechaza clientes que no cifran (A.8.20)
# Se usa un TNS_ADMIN temporal con SQLNET.ENCRYPTION_CLIENT=REJECTED (cliente que se niega a cifrar).
set -u
cd "$(dirname "$0")/.."
. comun/config.sh
echo "=== V08b Cliente sin cifrado contra el servidor ==="
TMP=$(mktemp -d)
cat > "$TMP/sqlnet.ora" <<SQLNET
NAMES.DIRECTORY_PATH = (EZCONNECT)
DISABLE_OOB = ON
SQLNET.ENCRYPTION_CLIENT = REJECTED
SQLNET.CRYPTO_CHECKSUM_CLIENT = REJECTED
SQLNET
echo "--- sqlnet.ora del servidor ---"; cat "$SQLNET_ORA"
echo "--- intento de conexion sin cifrado ---"
SALIDA=$(printf 'set heading off feedback off\nselect '"'"'CONECTADO'"'"' from dual;\nexit\n' \
  | TNS_ADMIN="$TMP" sqlplus -s -L "system/\"$PWD_SYS\"@$CON_PDB" 2>&1)
echo "$SALIDA"
rm -rf "$TMP"
if echo "$SALIDA" | grep -q 'ORA-12660'; then
  printf '%-6s | %-10s | %s\n' PB-08b CUMPLE "Cliente con cifrado REJECTED fue rechazado (ORA-12660)"
elif echo "$SALIDA" | grep -q 'CONECTADO'; then
  printf '%-6s | %-10s | %s\n' PB-08b 'NO CUMPLE' "Cliente sin cifrado logro conectarse en texto claro"
else
  printf '%-6s | %-10s | %s\n' PB-08b 'NO CUMPLE' "Resultado inesperado: $(echo "$SALIDA" | grep -m1 -E 'ORA-|SP2-')"
fi

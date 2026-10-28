#!/usr/bin/env bash
# 01_restaurar_red_y_respaldos.sh
# Devuelve al estado inicial las piezas que viven fuera de la PDB, para que
# "antes" vuelva a mostrar las debilidades en una segunda corrida:
#   * quita el bloque de cifrado de red agregado por I08 en sqlnet.ora
#   * borra los respaldos RMAN del proyecto y limpia la configuracion de cifrado RMAN
# No toca el keystore TDE ni el modo ARCHIVELOG (infraestructura persistente).
set -u
cd "$(dirname "$0")/.."
. comun/config.sh

echo "=== sqlnet.ora: quitar bloque I08 (si existe) ==="
if grep -q '>>> ISO27001 I08' "$SQLNET_ORA"; then
  sed '/>>> ISO27001 I08/,/<<< ISO27001 I08/d' "$SQLNET_ORA" > /tmp/sqlnet.ora.$$
  cat /tmp/sqlnet.ora.$$ > "$SQLNET_ORA"   # cat > conserva el enlace simbolico
  rm -f /tmp/sqlnet.ora.$$
  echo "Bloque eliminado."
else
  echo "No habia bloque I08."
fi
cat "$SQLNET_ORA"

echo "=== RMAN: borrar respaldos del proyecto y limpiar cifrado ==="
rman target / <<RMAN
CONFIGURE ENCRYPTION FOR DATABASE CLEAR;
CONFIGURE ENCRYPTION ALGORITHM CLEAR;
DELETE NOPROMPT BACKUP;
EXIT
RMAN
rm -rf "$DIR_BACKUP"/* 2>/dev/null
exit 0

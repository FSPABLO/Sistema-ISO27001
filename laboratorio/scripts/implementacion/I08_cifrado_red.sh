#!/usr/bin/env bash
# I08_cifrado_red.sh - Controles A.8.20 (seguridad de redes) y A.8.24 (criptografia)
# Exige cifrado nativo (AES) e integridad (SHA-2) en todas las conexiones por listener.
# Los procesos servidor leen sqlnet.ora en cada conexion nueva: no hace falta reiniciar.
set -u
cd "$(dirname "$0")/.."
. comun/config.sh
echo "=== I08 Cifrado de red en $SQLNET_ORA ==="
# quitar un bloque previo (idempotencia); cat > conserva el enlace simbolico de la imagen
sed '/>>> ISO27001 I08/,/<<< ISO27001 I08/d' "$SQLNET_ORA" > /tmp/sqlnet.ora.$$
cat >> /tmp/sqlnet.ora.$$ <<'SQLNET'
# >>> ISO27001 I08 cifrado de red (no editar este bloque a mano)
SQLNET.ENCRYPTION_SERVER = REQUIRED
SQLNET.ENCRYPTION_TYPES_SERVER = (AES256, AES192)
SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED
SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER = (SHA512, SHA384, SHA256)
# <<< ISO27001 I08
SQLNET
cat /tmp/sqlnet.ora.$$ > "$SQLNET_ORA"
rm -f /tmp/sqlnet.ora.$$
cat "$SQLNET_ORA"

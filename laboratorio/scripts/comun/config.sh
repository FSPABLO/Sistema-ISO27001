# config.sh - mismos parametros que config.sql para los scripts shell (valores de PRUEBA)
PDB=FREEPDB1
CON_PDB=//localhost:1521/FREEPDB1
PWD_SYS=Oracle_2026_Pwd
PWD_WALLET=Wallet_2026_Prueba
WALLET_ROOT=/opt/oracle/oradata/FREE/wallet
DIR_BACKUP=/opt/oracle/oradata/backup
DIR_ARCH=/opt/oracle/oradata/archivelog
SQLNET_ORA="$ORACLE_HOME/network/admin/sqlnet.ora"
# Ejecuta SQL como SYSDBA local (bequeath). STARTUP/SHUTDOWN solo funcionan asi.
sysdba() { sqlplus -s -L / as sysdba; }
valor() { printf 'set heading off feedback off pagesize 0 verify off\n%s\nexit\n' "$1" | sysdba | tr -d '[:space:]'; }

#!/usr/bin/env bash
# =====================================================================
# ejecutar.sh - ejecuta las fases del proyecto dentro del contenedor Oracle
# Uso:
#   ./ejecutar.sh preparacion
#   ./ejecutar.sh verificacion [antes|despues|<carpeta>]   (por defecto: ultima)
#   ./ejecutar.sh implementacion [I01 ... I11]              (todas o una)
#   ./ejecutar.sh todo                                      (las cuatro fases)
# Variable opcional: CONTENEDOR (por defecto eif402-iso27001)
# =====================================================================
set -u
CONTENEDOR="${CONTENEDOR:-eif402-iso27001}"
RAIZ="$(cd "$(dirname "$0")" && pwd)"
EVID="$RAIZ/evidencias"

IMPLEMENTACION="I01_cuentas_por_defecto.sql I02_perfil_contrasenas.sql I03_minimo_privilegio.sql
I04a_wallet_root.sh I04_tde.sql I05_redaction.sql I06_vpd.sql I07_auditoria.sql
I08_cifrado_red.sh I09_rman_respaldo_cifrado.sh I10_enmascarar_clon.sql I11_purga_residuos.sql"
VERIFICACION="V00_entorno.sql V01_cuentas.sql V02_perfiles.sql V03_privilegios.sql V04_tde.sql
V05_redaction.sql V06_vpd.sql V07_auditoria.sql V08_cifrado_red.sql V08b_cifrado_red_cliente.sh
V09_respaldo.sql V10_clon.sql V11_residuos.sql V12_acceso_integral.sql"

correr() {   # $1 = ruta relativa a scripts/
  case "$1" in
    *.sql) docker exec -i -w /work/scripts "$CONTENEDOR" sqlplus -s -L /nolog "@$1" </dev/null ;;
    *.sh)  docker exec -i -w /work/scripts "$CONTENEDOR" bash "$1" </dev/null ;;
  esac
}

preparacion() {
  mkdir -p "$EVID/preparacion"
  for f in 00_preparacion_entorno.sql 01_restaurar_red_y_respaldos.sh; do
    echo ">>> preparacion/$f"
    correr "preparacion/$f" 2>&1 | tee "$EVID/preparacion/${f%.*}.log"
  done
}

implementacion() {
  mkdir -p "$EVID/implementacion"
  for f in $IMPLEMENTACION; do
    if [ -n "${1:-}" ] && [ "${f%%_*}" != "$1" ]; then continue; fi
    echo ">>> implementacion/$f"
    correr "implementacion/$f" 2>&1 | tee "$EVID/implementacion/${f%.*}.log"
  done
}

verificacion() {
  local dest="$EVID/${1:-ultima}"
  mkdir -p "$dest"
  for f in $VERIFICACION; do
    echo ">>> verificacion/$f"
    correr "verificacion/$f" > "$dest/${f%.*}.log" 2>&1
    grep -E '^PB-' "$dest/${f%.*}.log"
  done
  {
    echo "Resumen de verificacion - $(date '+%Y-%m-%d %H:%M:%S') - contenedor $CONTENEDOR"
    echo "-----------------------------------------------------------------------------"
    cat "$dest"/V*.log | grep -E '^PB-'
    echo "-----------------------------------------------------------------------------"
    for r in 'CUMPLE ' 'NO CUMPLE' 'NO DISPON.'; do
      printf '%-11s %s\n' "$r" "$(cat "$dest"/V*.log | grep -E '^PB-' | grep -c "| $r")"
    done
  } > "$dest/resumen_verificacion.txt"
  echo; cat "$dest/resumen_verificacion.txt"
}

docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true \
  || { echo "El contenedor $CONTENEDOR no esta en ejecucion." >&2; exit 1; }

case "${1:-}" in
  preparacion)    preparacion ;;
  verificacion)   verificacion "${2:-ultima}" ;;
  implementacion) implementacion "${2:-}" ;;
  todo)           preparacion; verificacion antes; implementacion; verificacion despues ;;
  *) sed -n '3,10p' "$0"; exit 1 ;;
esac

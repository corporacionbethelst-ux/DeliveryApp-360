#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"

INSTALL_BACKEND="true"
INSTALL_FRONTEND="true"
RUN_MIGRATIONS="false"
RUN_SEED="false"
SKIP_DOCKER_CHECK="false"

usage() {
  cat <<'EOF'
Usage: backend/scripts/setup_dev.sh [options]

Prepara un entorno local de desarrollo sin destruir datos.

Options:
  --no-backend-install   Skip pip install -r backend/requirements.txt
  --no-frontend-install  Skip npm install in frontend
  --migrate              Run Alembic migrations after dependency checks
  --seed                 Run seed_data.py after migrations (implies --migrate)
  --skip-docker-check    Do not check docker compose availability
  -h, --help             Show this help

Examples:
  backend/scripts/setup_dev.sh --no-backend-install --no-frontend-install
  backend/scripts/setup_dev.sh --migrate --seed
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-backend-install)
      INSTALL_BACKEND="false"
      shift
      ;;
    --no-frontend-install)
      INSTALL_FRONTEND="false"
      shift
      ;;
    --migrate)
      RUN_MIGRATIONS="true"
      shift
      ;;
    --seed)
      RUN_MIGRATIONS="true"
      RUN_SEED="true"
      shift
      ;;
    --skip-docker-check)
      SKIP_DOCKER_CHECK="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ Opción no reconocida: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_command() {
  local command_name="$1"
  local install_hint="$2"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "❌ Falta '${command_name}'. ${install_hint}" >&2
    exit 127
  fi
}

copy_env_if_missing() {
  local dir="$1"
  if [[ ! -f "${dir}/.env" && -f "${dir}/.env.example" ]]; then
    cp "${dir}/.env.example" "${dir}/.env"
    echo "✅ Creado ${dir}/.env desde .env.example. Revisa secretos antes de producción."
  elif [[ -f "${dir}/.env" ]]; then
    echo "ℹ️ ${dir}/.env ya existe; no se sobrescribe."
  fi
}

run_backend_install() {
  [[ "${INSTALL_BACKEND}" == "true" ]] || return 0
  require_command python "Instala Python 3.11+."
  require_command pip "Instala pip."
  echo "📦 Instalando dependencias backend..."
  (cd "${BACKEND_DIR}" && pip install -r requirements.txt)
}

run_frontend_install() {
  [[ "${INSTALL_FRONTEND}" == "true" ]] || return 0
  if [[ ! -d "${FRONTEND_DIR}" ]]; then
    echo "⚠️ No existe frontend; se omite instalación frontend."
    return 0
  fi
  require_command npm "Instala Node.js y npm."
  echo "📦 Instalando dependencias frontend..."
  (cd "${FRONTEND_DIR}" && npm install)
}

check_docker_compose() {
  [[ "${SKIP_DOCKER_CHECK}" == "false" ]] || return 0
  if docker compose version >/dev/null 2>&1; then
    echo "✅ Docker Compose disponible. Puedes levantar servicios con: docker compose up --build"
  else
    echo "⚠️ Docker Compose no disponible. Si usas DB/Redis locales, ignora este aviso."
  fi
}

run_static_sanity_checks() {
  echo "🔎 Ejecutando checks rápidos de sintaxis..."
  (cd "${REPO_ROOT}" && python -m py_compile backend/scripts/seed_data.py backend/alembic/versions/20260609_add_platform_settings.py)
  if [[ -d "${FRONTEND_DIR}" && -f "${FRONTEND_DIR}/package.json" && -d "${FRONTEND_DIR}/node_modules" ]]; then
    (cd "${FRONTEND_DIR}" && npm run type-check -- --pretty false)
  else
    echo "ℹ️ Type-check frontend omitido porque node_modules no está instalado."
  fi
}

main() {
  echo "🚀 Preparando entorno Delivery360 en ${REPO_ROOT}"
  copy_env_if_missing "${BACKEND_DIR}"
  [[ -d "${FRONTEND_DIR}" ]] && copy_env_if_missing "${FRONTEND_DIR}"
  check_docker_compose
  run_backend_install
  run_frontend_install
  run_static_sanity_checks

  if [[ "${RUN_MIGRATIONS}" == "true" ]]; then
    if [[ "${RUN_SEED}" == "true" ]]; then
      "${SCRIPT_DIR}/run_migrations.sh" --seed
    else
      "${SCRIPT_DIR}/run_migrations.sh"
    fi
  fi

  cat <<EOF

✅ Setup de desarrollo finalizado.

Siguientes comandos útiles:
  docker compose up --build
  backend/scripts/run_migrations.sh
  backend/scripts/run_migrations.sh --seed
  cd frontend && npm run dev
EOF
}

main

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${BACKEND_DIR}"

MODE="upgrade"
RUN_SEED="false"
WAIT_FOR_DB="true"
REVISION="head"

usage() {
  cat <<'EOF'
Usage: backend/scripts/run_migrations.sh [options]

Options:
  --revision <rev>     Alembic revision target (default: head)
  --current            Show current Alembic revision and exit
  --history            Show Alembic history and exit
  --check              Run a dry SQL generation check (offline SQL to stdout)
  --seed               Run backend/scripts/seed_data.py after successful upgrade
  --no-wait            Do not wait for database TCP readiness
  -h, --help           Show this help

Environment:
  Uses backend/.env when present. DATABASE_URL_SYNC or DATABASE_URL must point to PostgreSQL.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --revision)
      REVISION="${2:-}"
      if [[ -z "${REVISION}" ]]; then
        echo "❌ --revision requiere un valor" >&2
        exit 2
      fi
      shift 2
      ;;
    --current)
      MODE="current"
      shift
      ;;
    --history)
      MODE="history"
      shift
      ;;
    --check)
      MODE="check"
      shift
      ;;
    --seed)
      RUN_SEED="true"
      shift
      ;;
    --no-wait)
      WAIT_FOR_DB="false"
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

load_env_file() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0

  # Do not `source` .env: values such as `EMAIL_FROM=Delivery360 <...>`
  # are valid dotenv entries for Pydantic but invalid shell syntax.
  while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
    local line key value
    line="${raw_line%$'\r'}"
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value#\"}"
    value="${value%\"}"
    value="${value#'}"
    value="${value%'}"
    export "${key}=${value}"
  done < "${env_file}"
}

normalize_db_url_for_socket() {
  python - <<'PY'
import os
from urllib.parse import urlparse

url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL") or ""
if not url:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    print(f"{host} {port}")
    raise SystemExit

normalized = url.replace("postgresql+asyncpg://", "postgresql://", 1)
parsed = urlparse(normalized)
print(f"{parsed.hostname or os.getenv('POSTGRES_HOST', 'localhost')} {parsed.port or int(os.getenv('POSTGRES_PORT', '5432'))}")
PY
}

wait_for_db() {
  [[ "${WAIT_FOR_DB}" == "true" ]] || return 0
  read -r host port < <(normalize_db_url_for_socket)
  echo "⏳ Esperando PostgreSQL en ${host}:${port}..."
  python - "${host}" "${port}" <<'PY'
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
deadline = time.time() + int(__import__("os").getenv("DB_WAIT_TIMEOUT", "60"))
last_error = None
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"✅ PostgreSQL disponible en {host}:{port}")
            raise SystemExit(0)
    except OSError as exc:
        last_error = exc
        time.sleep(1)
print(f"❌ PostgreSQL no disponible en {host}:{port}: {last_error}", file=sys.stderr)
raise SystemExit(1)
PY
}

if [[ -f ".env" ]]; then
  load_env_file ".env"
elif [[ -f ".env.example" ]]; then
  echo "⚠️ No existe backend/.env; usando variables actuales y defaults de la app. Puedes copiar .env.example para desarrollo."
fi

export PYTHONPATH="${BACKEND_DIR}:${PYTHONPATH:-}"

if ! command -v alembic >/dev/null 2>&1; then
  echo "❌ Alembic no está instalado o no está en PATH. Instala dependencias con: pip install -r backend/requirements.txt" >&2
  exit 127
fi

case "${MODE}" in
  current)
    alembic current
    ;;
  history)
    alembic history --verbose
    ;;
  check)
    echo "🔎 Generando SQL offline para validar migraciones hasta ${REVISION}..."
    alembic upgrade "${REVISION}" --sql >/tmp/delivery360_alembic_check.sql
    echo "✅ SQL generado correctamente en /tmp/delivery360_alembic_check.sql"
    ;;
  upgrade)
    wait_for_db
    echo "🚀 Ejecutando migraciones Alembic hasta ${REVISION}..."
    alembic upgrade "${REVISION}"
    echo "✅ Migraciones aplicadas correctamente."
    if [[ "${RUN_SEED}" == "true" ]]; then
      echo "🌱 Ejecutando seed_data.py..."
      python scripts/seed_data.py
      echo "✅ Seed completado."
    fi
    ;;
  *)
    echo "❌ Modo inválido: ${MODE}" >&2
    exit 2
    ;;
esac

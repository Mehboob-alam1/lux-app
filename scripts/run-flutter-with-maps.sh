#!/usr/bin/env bash
# Run customer or driver Flutter with Maps/Places keys from .env.local
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.example → .env.local and set GOOGLE_MAPS_API_KEY."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

APP="${1:-customer}"
shift || true

case "$APP" in
  customer) DIR="${ROOT}/apps/customer_flutter" ;;
  driver) DIR="${ROOT}/apps/driver_flutter" ;;
  *)
    echo "Usage: $0 [customer|driver] [extra flutter args…]"
    exit 1
    ;;
esac

if [[ -z "${GOOGLE_MAPS_API_KEY:-}" ]]; then
  echo "GOOGLE_MAPS_API_KEY is empty in .env.local"
  exit 1
fi

PLACES="${PLACES_API_KEY:-$GOOGLE_MAPS_API_KEY}"

cd "$DIR"
exec flutter run \
  --dart-define="GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}" \
  --dart-define="PLACES_API_KEY=${PLACES}" \
  "$@"

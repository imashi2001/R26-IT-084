#!/bin/sh
set -e
# Railway passes PORT at runtime but does not shell-expand `$PORT` in the
# dashboard "Start command". Prefer no custom command and use this script.
BIND_PORT="${PORT:-8080}"
exec gunicorn server:app \
  --bind "0.0.0.0:${BIND_PORT}" \
  --timeout 120 \
  --workers 1

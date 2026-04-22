#!/bin/sh
set -eu

echo "Waiting for PostgreSQL at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
python - <<'PY'
import os
import time

import psycopg2

db_settings = {
    "dbname": os.getenv("POSTGRES_DB"),
    "user": os.getenv("POSTGRES_USER"),
    "password": os.getenv("POSTGRES_PASSWORD"),
    "host": os.getenv("POSTGRES_HOST", "db"),
    "port": os.getenv("POSTGRES_PORT", "5432"),
    "connect_timeout": 3,
}

for attempt in range(1, 31):
    try:
        connection = psycopg2.connect(**db_settings)
        connection.close()
        print("PostgreSQL is ready.")
        break
    except Exception as exc:
        print(f"[{attempt}/30] PostgreSQL is unavailable: {exc}")
        time.sleep(2)
else:
    raise SystemExit("PostgreSQL did not become ready in time.")
PY

echo "Starting gunicorn..."
gunicorn --chdir /app/src -b 127.0.0.1:5000 app:app &

echo "Starting nginx..."
exec nginx -g "daemon off;"

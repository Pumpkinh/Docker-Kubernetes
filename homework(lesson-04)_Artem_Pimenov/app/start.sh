#!/bin/sh
set -e

echo "Starting gunicorn..."
gunicorn --chdir /app/src -b 127.0.0.1:5000 app:app &

echo "Starting nginx..."
nginx -g "daemon off;"

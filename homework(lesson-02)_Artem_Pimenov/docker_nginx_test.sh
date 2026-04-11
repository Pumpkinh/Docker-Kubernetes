#!/bin/bash

START_PORT=8081
COUNT=10

for ((i=0; i<COUNT; i++)); do
  PORT=$((START_PORT+i))
  NAME="nginx_$((i+1))"

  echo "Starting $NAME on port $PORT"

  docker run -d \
    --name $NAME \
    --label project=nginx_test \
    -p $PORT:80 \
    nginx
done

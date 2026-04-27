FROM postgres:16-alpine

ENV POSTGRES_DB=guessdb \
    POSTGRES_USER=guessuser \
    POSTGRES_PASSWORD=guesspass123

COPY app/src/init.sql /docker-entrypoint-initdb.d/init.sql

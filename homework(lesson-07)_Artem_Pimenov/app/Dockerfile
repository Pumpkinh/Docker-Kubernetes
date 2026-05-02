FROM python:3.12-slim

ENV POSTGRES_DB=guessdb \
    POSTGRES_USER=guessuser \
    POSTGRES_PASSWORD=guesspass123 \
    POSTGRES_HOST=db \
    POSTGRES_PORT=5432 \
    FLASK_SECRET_KEY=super-secret-key

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    curl \
    procps \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

RUN rm -f /etc/nginx/sites-enabled/default \
          /etc/nginx/sites-available/default \
          /etc/nginx/conf.d/default.conf

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

COPY src /app/src

EXPOSE 80

CMD ["/app/start.sh"]

# Guess the Number: Docker Swarm Edition

## Опис

Це навчальний проєкт із веб-грою "вгадай число від 1 до 100".
Наповнення проекту майже ідентично попередньому домашньому завданню, але змінено до умов ДЗ та запуску в `Docker Swarm`.

Архітектура:

```text
[ client ]
    |
[ proxy (nginx) ]
    |
[ app (nginx + Flask + gunicorn) ]
    |
[ db (PostgreSQL) ]
```

Функціонал:

- веб-гра з підказками "більше/менше"
- збереження результатів у PostgreSQL
- історія ігор гравця через cookie `player_id`
- reverse proxy через nginx
- готовий стек для `docker stack deploy`

## Що змінено

Проєкт перероблено з `docker compose` під `docker swarm`:

- додано окремий файл `docker-stack.yml`
- додано окремий образ БД `db/Dockerfile`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` і `FLASK_SECRET_KEY` захардкоджені в Dockerfile образів
- файл `.env` повністю прибрано з проєкту
- `init.sql` тепер запікається в образ БД
- `app` сам чекає готовності PostgreSQL у `app/start.sh`
- для Swarm використано `overlay`-мережі та `deploy`-налаштування

## Структура

```text
.
├── docker-compose.yml
├── docker-stack.yml
├── .dockerignore
├── proxy/
│   └── nginx.conf
├── db/
│   └── Dockerfile
└── app/
    ├── Dockerfile
    ├── requirements.txt
    ├── start.sh
    ├── nginx/
    │   └── default.conf
    └── src/
        ├── app.py
        ├── init.sql
        ├── templates/index.html
        └── static/style.css
```

## Запуск у Docker Swarm

### 1. Ініціалізувати Swarm

```bash
docker swarm init
```

### 2. Побудувати образи

```bash
docker build -t guess-app:latest ./app
docker build -t guess-db:latest -f db/Dockerfile .
```

Якщо стек запускається на кількох вузлах, образи потрібно запушити в registry і замінити теги в `docker-stack.yml`.

### 3. Розгорнути стек

```bash
docker stack deploy -c docker-stack.yml guess
```

### 4. Перевірити стан сервісів

```bash
docker stack services guess
docker stack ps guess
docker service logs guess_app -f
```

## Доступ

```text
http://localhost:19080
```

## Ключові деталі

### proxy

- використовує `nginx:stable-alpine`
- публікує порт `19080`
- отримує конфігурацію через `configs`

### app

- запускається з образу `guess-app:latest`
- масштабується до 2 реплік
- має вбудовані змінні конфігурації через `ENV` у Dockerfile
- самостійно чекає готовності PostgreSQL перед запуском gunicorn

### db

- запускається з образу `guess-db:latest`
- містить `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` та `init.sql` усередині образу
- зберігає дані у volume `postgres_data`
- зафіксований на manager-вузлі для передбачуваної роботи локального volume

## Локальний Compose

`docker-compose.yml` теж оновлено під запуск без `.env`: `app` і `db` беруть конфігурацію з власних образів.

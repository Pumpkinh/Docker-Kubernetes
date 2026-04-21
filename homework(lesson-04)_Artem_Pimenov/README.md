# 🎯 Guess the Number — Docker Compose Project

## 📌 Опис проєкту

Це навчальний проєкт, який демонструє побудову багатоконтейнерного застосунку за допомогою **Docker Compose**.

Проєкт реалізує просту веб-гру:

> користувач має вгадати число від 1 до 100

Функціонал:

* інтерактивна веб-гра
* збереження результатів у PostgreSQL
* персональна історія гравця (через cookies)
* reverse proxy через nginx
* повністю автоматичний запуск без ручної конфігурації

---

## 🧱 Архітектура

Проєкт складається з трьох сервісів:

```
[ Client ]
     ↓
[ proxy (nginx) ]
     ↓
[ app (nginx + Flask + gunicorn) ]
     ↓
[ db (PostgreSQL) ]
```

---

## 📁 Структура проєкту

```
.
├── docker-compose.yml
├── .env
├── proxy
│   └── nginx.conf
└── app
    ├── Dockerfile
    ├── requirements.txt
    ├── start.sh
    ├── nginx
    │   └── default.conf
    └── src
        ├── app.py
        ├── init.sql
        ├── templates
        │   └── index.html
        └── static
            └── style.css
```

### 🔹 Пояснення

| Каталог      | Призначення                     |
| ------------ | ------------------------------- |
| `proxy/`     | Reverse proxy (зовнішній nginx) |
| `app/`       | Контейнер застосунку            |
| `app/src/`   | Flask код                       |
| `templates/` | HTML                            |
| `static/`    | CSS                             |
| `.env`       | змінні середовища               |

---

# ⚙️ Основний файл: `docker-compose.yml`

Це ключовий файл проєкту, який описує:

* сервіси
* мережі
* volumes
* залежності
* health checks

---

## 🧩 Сервіси

### 1. 🔵 proxy (nginx)

```yaml
proxy:
  image: nginx:stable-alpine
```

#### Призначення:

* приймає HTTP запити
* проксіює їх у `app`

#### Порти:

```yaml
ports:
  - "19080:80"
```

👉 зовнішній доступ до застосунку

---

#### Volume:

```yaml
volumes:
  - ./proxy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
```

👉 підключення конфігурації nginx

---

#### Залежність:

```yaml
depends_on:
  app:
    condition: service_healthy
```

👉 proxy стартує тільки після того, як app готовий

---

#### Healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1 || exit 1"]
```

👉 перевіряє доступність nginx

---

---

### 2. 🟢 app (Flask + nginx + gunicorn)

```yaml
app:
  build: ./app
```

#### Призначення:

* бізнес-логіка гри
* обробка HTTP
* робота з БД

---

#### Мережі:

```yaml
networks:
  - frontend
  - backend
```

👉 контейнер підключений до двох мереж:

* frontend → для proxy
* backend → для DB

---

#### Volume:

```yaml
volumes:
  - ./app/src:/app/src
```

👉 bind mount для коду (зручно для розробки)

---

#### Environment:

```yaml
environment:
  POSTGRES_DB: ${POSTGRES_DB}
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

👉 передача змінних у Flask

---

#### Залежність:

```yaml
depends_on:
  db:
    condition: service_healthy
```

👉 app стартує тільки після готовності БД

---

#### Healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -fsS http://127.0.0.1/health || exit 1"]
```

👉 перевіряє:

* чи живий Flask
* чи працює nginx

---

---

### 3. 🟡 db (PostgreSQL)

```yaml
db:
  image: postgres:16-alpine
```

#### Призначення:

* зберігання результатів гри

---

#### Volume:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  - ./app/src/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

👉

* перший volume — дані БД
* другий — ініціалізація таблиць

---

#### Healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
```

👉 перевіряє готовність БД до роботи

---

---

## 🌐 Мережі

```yaml
networks:
  frontend:
    driver: bridge

  backend:
    driver: bridge
    internal: true
```

### 🔹 frontend

* використовується між proxy та app
* доступна зовні через порт

### 🔹 backend

* використовується між app і db
* `internal: true` → ізольована від зовнішнього світу

👉 це підвищує безпеку

---

## 💾 Volumes

```yaml
volumes:
  postgres_data:
```

👉 зберігає дані БД між перезапусками

---

# 🚀 Запуск проєкту

```bash
docker compose up -d --build
```

---

## 🌐 Доступ

```
http://localhost:19080
```

---

# 🔐 Змінні середовища

Файл `.env`:

```env
POSTGRES_DB=guess_db
POSTGRES_USER=guess_user
POSTGRES_PASSWORD=guess_pass
FLASK_SECRET_KEY=supersecretkey
```

---

# 🧠 Основні концепції Docker Compose

У проєкті реалізовано:

### ✔ Multiple services

* proxy / app / db

### ✔ Multiple networks

* frontend / backend

### ✔ Volumes

* збереження БД
* bind mount для коду

### ✔ depends_on + healthcheck

* контроль порядку запуску
* перевірка готовності сервісів

### ✔ Reverse proxy

* nginx як точка входу

---

# 🎮 Функціонал гри

* генерація випадкового числа
* перевірка введеного значення
* підказки (більше/менше)
* збереження результату
* статистика гравця
* історія ігор

---

# 🏁 Висновок

Проєкт демонструє:

* побудову мікросервісної архітектури
* роботу з Docker Compose
* ізоляцію мереж
* керування залежностями сервісів
* базову веб-розробку з Flask

---

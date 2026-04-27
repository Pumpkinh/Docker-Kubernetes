# Guess the Number: Kubernetes Edition

## Опис

Це навчальний проєкт із веб-грою "вгадай число від 1 до 100", підготовлений для запуску в локальному Kubernetes-кластері Docker Desktop.

Архітектура:

```text
[ client ]
    |
[ Service: course-app (NodePort) ]
    |
[ Deployment: course-app ]
    |
[ app pods (nginx + Flask + gunicorn) ]
    |
[ Service: db (ClusterIP) ]
    |
[ Deployment: db (PostgreSQL) ]
    |
[ PersistentVolumeClaim: postgres-data ]
```

Функціонал:

- веб-гра з підказками "більше/менше"
- збереження результатів у PostgreSQL
- історія ігор гравця через cookie `player_id`
- запуск застосунку через Kubernetes `Deployment`
- доступ до застосунку через Kubernetes `Service` типу `NodePort`
- збереження даних PostgreSQL через `PersistentVolumeClaim`

## Структура

```text
.
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── postgres.yaml
├── .dockerignore
├── .gitignore
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

## Kubernetes-ресурси

### `k8s/deployment.yaml`

Створює `Deployment` для застосунку:

- назва: `course-app`
- кількість реплік: `2`
- образ: `pimenov2unit/course-app:lesson-06`
- контейнерний порт: `80`
- readiness/liveness probes: `/health`
- стратегія оновлення: `RollingUpdate`

### `k8s/service.yaml`

Створює `Service` для доступу до застосунку:

- назва: `course-app`
- тип: `NodePort`
- service port: `80`
- node port: `30080`

### `k8s/postgres.yaml`

Створює ресурси для PostgreSQL:

- `PersistentVolumeClaim` з назвою `postgres-data`
- `Deployment` з назвою `db`
- `Service` з назвою `db`
- образ: `pimenov2unit/guess-db:lesson-06`
- PostgreSQL доступний для застосунку за DNS-іменем `db`

## Запуск у Docker Desktop Kubernetes

### 1. Увімкнути Kubernetes у Docker Desktop

У Docker Desktop потрібно увімкнути Kubernetes:

```text
Settings -> Kubernetes -> Enable Kubernetes
```

Після запуску перевірити поточний контекст:

```bash
kubectl config current-context
```

Очікуваний контекст:

```text
docker-desktop
```

Якщо активний інший контекст:

```bash
kubectl config use-context docker-desktop
```

### 2. Перевірити node

```bash
kubectl get nodes -o wide
```

Очікувано має бути один локальний node у статусі `Ready`.

### 3. Розгорнути ресурси

Можна застосувати всі Kubernetes-маніфести однією командою:

```bash
kubectl apply -f k8s/
```

Або окремо:

```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

Образи вже опубліковані в Docker Hub:

```text
pimenov2unit/course-app:lesson-06
pimenov2unit/guess-db:lesson-06
```

Тому на чистому Docker Desktop Kubernetes не потрібно локально збирати образи перед запуском.

### 4. Перевірити стан ресурсів

```bash
kubectl get pods -o wide
kubectl get deployments
kubectl get services
kubectl rollout status deployment/course-app
```

Очікуваний стан Pod-ів:

```text
course-app-...   1/1   Running
course-app-...   1/1   Running
db-...           1/1   Running
```

Очікуваний Service для застосунку:

```text
course-app   NodePort   80:30080/TCP
```

### 5. Відкрити застосунок

Service має тип `NodePort` і фіксований порт `30080`.

```text
http://localhost:30080
```

Якщо у Docker Desktop на Windows `NodePort` не відкривається через `localhost`, можна перевірити застосунок через port-forward:

```bash
kubectl port-forward service/course-app 8080:80
```

Після цього відкрити:

```text
http://localhost:8080
```

Health endpoint:

```text
http://localhost:8080/health
```

Очікувана відповідь:

```json
{"status":"healthy"}
```

### 6. Змінити кількість реплік

У файлі `k8s/deployment.yaml` змінити:

```yaml
replicas: 2
```

наприклад на:

```yaml
replicas: 3
```

Потім застосувати оновлений manifest:

```bash
kubectl apply -f k8s/deployment.yaml
```

Перевірити процес оновлення:

```bash
kubectl rollout status deployment/course-app
```

Подивитися Pod-и:

```bash
kubectl get pods -o wide
```

У Docker Desktop Kubernetes зазвичай є тільки один локальний node, тому всі Pod-и будуть розміщені на ньому. Масштабування реплік і rolling update при цьому працюють так само, як у багатовузловому кластері.

## Повторна публікація образів

Якщо потрібно перезібрати й повторно запушити образи в Docker Hub:

```bash
docker build -t guess-app:latest ./app
docker build -t guess-db:latest -f db/Dockerfile .

docker tag guess-app:latest pimenov2unit/course-app:lesson-06
docker tag guess-db:latest pimenov2unit/guess-db:lesson-06

docker push pimenov2unit/course-app:lesson-06
docker push pimenov2unit/guess-db:lesson-06
```

Після цього перезапустити Kubernetes deployment:

```bash
kubectl rollout restart deployment/course-app
kubectl rollout restart deployment/db
```

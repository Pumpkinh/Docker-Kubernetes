# Guess the Number: Kubernetes Ingress and Health Checks

## Опис

Це ДЗ №8 на основі ДЗ №7: веб-гра "Вгадай число" на Flask з PostgreSQL, запущена в Kubernetes через `Deployment`, `Service`, `ConfigMap`, `PersistentVolumeClaim` та `Ingress`.

Мета роботи: налаштувати внутрішній `ClusterIP` Service, коректні `livenessProbe` і `readinessProbe`, зовнішню маршрутизацію через `Ingress` та перевірити, що Kubernetes прибирає неготовий Pod зі списку Endpoints без зупинки контейнера.

## Архітектура

```text
[ client ]
    |
[ Ingress: course-app.local ]
    |
[ Service: course-app (ClusterIP :80) ]
    |
[ Deployment: course-app, 10 replicas ]
    |
[ Service: db (ClusterIP :5432) ]
    |
[ Deployment: db, 1 replica ]
    |
[ PVC: postgres-data ]
```

## Структура

```text
.
├── app/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── start.sh
│   └── src/
│       ├── app.py
│       ├── init.sql
│       ├── templates/index.html
│       └── static/style.css
├── db/
│   └── Dockerfile
├── k8s/
│   ├── configmap.yaml
│   ├── deployment.yaml
│   ├── ingress.yaml
│   ├── postgres.yaml
│   ├── service.yaml
│   └── experiments/
├── docker-compose.yml
├── docker-stack.yml
└── README.md
```

## 1. Service Discovery

У [k8s/service.yaml](k8s/service.yaml) Service застосунку змінено з `NodePort` на `ClusterIP`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: course-app
spec:
  type: ClusterIP
  selector:
    app: course-app
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: http
```

Тепер Service доступний тільки всередині Kubernetes-кластера, а зовнішній доступ виконується через `Ingress`.

Перевірка:

```bash
kubectl get svc course-app
```

Очікувано:

```text
NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)
course-app   ClusterIP   ...             <none>        80/TCP
```

## 2. Health Checks

У [app/src/app.py](app/src/app.py) додано окремі endpoints:

| Endpoint | Призначення |
|---|---|
| `/health` | liveness check: процес живий і HTTP stack відповідає |
| `/ready` | readiness check: Pod готовий приймати трафік |
| `/internal/readiness/fail` | службовий endpoint для симуляції failed readiness через `kubectl exec` |
| `/internal/readiness/ok` | службовий endpoint для повернення Pod-а в ready через `kubectl exec` |

У [k8s/deployment.yaml](k8s/deployment.yaml) `livenessProbe` та `readinessProbe` розділено:

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2

livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 30
  periodSeconds: 20
  timeoutSeconds: 3
  failureThreshold: 3
```

Результат:

| Probe | Що робить Kubernetes |
|---|---|
| `livenessProbe` | перезапускає контейнер, якщо застосунок завис або перестав відповідати |
| `readinessProbe` | прибирає Pod з Endpoints Service, якщо Pod тимчасово не готовий |

## 3. Ingress

У [k8s/ingress.yaml](k8s/ingress.yaml) додано `Ingress`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: course-app
spec:
  ingressClassName: nginx
  rules:
    - host: course-app.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: course-app
                port:
                  name: http
```

Для локального запуску потрібен Ingress Controller. Наприклад, у Minikube:

```bash
minikube addons enable ingress
```

Для Docker Desktop або іншого кластера потрібно встановити `ingress-nginx` або використати вже наявний Ingress Controller.

Запис у `hosts` для локального домену:

```text
127.0.0.1 course-app.local
```

На Windows файл:

```text
C:\Windows\System32\drivers\etc\hosts
```

Перевірка Ingress:

```bash
kubectl get ingress course-app
kubectl describe ingress course-app
curl http://course-app.local
```

## 4. Збірка та розгортання

Зібрати й опублікувати образ застосунку для ДЗ №8:

```bash
docker build -t pimenov2unit/course-app:lesson-08 ./app
docker push pimenov2unit/course-app:lesson-08
```

Застосувати Kubernetes-манифести:

```bash
kubectl apply -f k8s/
kubectl rollout status deployment/db --timeout=180s
kubectl rollout status deployment/course-app --timeout=180s
kubectl get pods,pvc,svc,deploy,ingress
```

Перевірити health endpoints:

```bash
curl http://course-app.local/health
curl http://course-app.local/ready
```

Очікувано:

```json
{"status":"healthy"}
{"status":"ready"}
```

## 5. Zero Downtime Readiness Test

Мета: зробити один Pod неготовим, але не зупиняти його. Kubernetes має прибрати IP цього Pod-а з Endpoints Service, а трафік має йти на інші готові репліки.

1. Переконатися, що всі Pod-и готові:

```bash
kubectl get pods -l app=course-app -o wide
kubectl get endpoints course-app -o wide
```

2. Обрати один Pod:

```bash
kubectl get pods -l app=course-app
```

3. Запам'ятати IP обраного Pod-а:

```bash
kubectl get pod <POD_NAME> -o wide
```

4. Зробити тільки цей Pod неготовим:

```bash
kubectl exec <POD_NAME> -- curl -fsS -X POST http://127.0.0.1:5000/internal/readiness/fail
```

5. Дочекатися, поки readinessProbe спрацює:

```bash
kubectl get pods -l app=course-app -o wide
kubectl get endpoints course-app -o wide
```

Очікуваний результат:

```text
<POD_NAME>   0/1   Running   ...
```

IP цього Pod-а має зникнути зі списку Endpoints `course-app`.

6. Перевірити, що застосунок далі відповідає через Ingress:

```bash
curl http://course-app.local
```

Також у UI відображається ім'я Pod-а, який обробив запит. Після failed readiness трафік має потрапляти на інші репліки.

7. Повернути Pod у ready:

```bash
kubectl exec <POD_NAME> -- curl -fsS -X POST http://127.0.0.1:5000/internal/readiness/ok
kubectl get pods -l app=course-app -o wide
kubectl get endpoints course-app -o wide
```

Після наступної успішної readinessProbe IP Pod-а повернеться до Endpoints.

## 6. HTTPS Optional

Базовий `Ingress` у цьому ДЗ налаштований для HTTP. Для HTTPS можна створити TLS Secret із самопідписаним сертифікатом і додати `tls` секцію в `Ingress`.

Приклад створення сертифіката:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout course-app.local.key \
  -out course-app.local.crt \
  -subj "/CN=course-app.local/O=course-app.local"
```

Створити Secret:

```bash
kubectl create secret tls course-app-tls \
  --cert=course-app.local.crt \
  --key=course-app.local.key
```

Додати до `Ingress`:

```yaml
spec:
  tls:
    - hosts:
        - course-app.local
      secretName: course-app-tls
```

Після цього перевірити:

```bash
curl -k https://course-app.local
```

## Фінальний стан

У фінальному варіанті:

| Компонент | Стан |
|---|---|
| `course-app` Service | `ClusterIP`, порт `80/TCP` |
| `course-app` Deployment | 10 реплік, `RollingUpdate`, image `pimenov2unit/course-app:lesson-08` |
| `readinessProbe` | `/ready`, прибирає неготові Pod-и з Endpoints |
| `livenessProbe` | `/health`, перезапускає завислий контейнер |
| `Ingress` | `course-app.local` -> `service/course-app:80` |
| `db` Service | `ClusterIP`, порт `5432/TCP` |

# Guess the Number: Kubernetes Deployment Practice

## Опис

Це ДЗ №7 на основі проєкту з ДЗ №6: веб-гра "Вгадай число" на Flask з PostgreSQL, запущена в Kubernetes через `Deployment`, `ReplicaSet`, `Pod`, `Service`, `ConfigMap` і `PersistentVolumeClaim`.

Основна мета роботи: дослідити, як Kubernetes керує Pod-ами через Deployment/ReplicaSet, як поводиться rollout при зміні образу контейнера, ConfigMap та стратегії оновлення.

## Архітектура

```text
[ client ]
    |
[ Service: course-app (NodePort :30080) ]
    |
[ Deployment: course-app, 10 replicas ]
    |
[ ReplicaSet -> app Pods ]
    |
[ Service: db (ClusterIP) ]
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
│   ├── postgres.yaml
│   ├── service.yaml
│   └── experiments/
│       ├── rollingupdate-conservative.yaml
│       ├── rollingupdate-balanced.yaml
│       ├── rollingupdate-fast.yaml
│       └── recreate.yaml
├── docker-compose.yml
├── docker-stack.yml
└── README.md
```

## Виконані пункти ДЗ №7

### 1. Deployment з мінімум 10 репліками

У [k8s/deployment.yaml](k8s/deployment.yaml) встановлено:

```yaml
spec:
  replicas: 10
```

Застосування:

```bash
kubectl apply -f k8s/
kubectl rollout status deployment/db --timeout=180s
kubectl rollout status deployment/course-app --timeout=180s
kubectl get pods,pvc,svc,deploy
kubectl get rs -o wide
```

Фактичний результат після розгортання:

```text
deployment.apps/course-app   10/10   10   10
deployment.apps/db           1/1     1    1
```

ReplicaSet для застосунку керує 10 Pod-ами:

```text
course-app-...   DESIRED 10   CURRENT 10   READY 10
```

### 2. ConfigMap і оновлення Pod-ів

Додано [k8s/configmap.yaml](k8s/configmap.yaml):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: course-app-config
data:
  APP_BANNER: "Lesson 07: ConfigMap value v2"
  APP_VERSION: "lesson-07"
```

У Deployment ці значення передаються в контейнер через `env.valueFrom.configMapKeyRef`.

У UI також виводиться ім'я Pod-а, який обробив поточний запит. Flask читає стандартну змінну середовища `HOSTNAME`; у Kubernetes вона дорівнює імені Pod-а, наприклад `course-app-7bdd659497-5mq4h`. Завдяки цьому при 10 репліках можна оновлювати сторінку й бачити, яка саме репліка відповіла через `Service`.

Перевірка:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl exec deployment/course-app -- printenv APP_BANNER
```

Спостереження:

```text
Lesson 07: ConfigMap value v1
```

Після зміни ConfigMap старі Pod-и не підхопили нове значення автоматично, тому що env-змінні з ConfigMap читаються під час старту контейнера.

Щоб Pod-и отримали нове значення, виконано:

```bash
kubectl rollout restart deployment/course-app
kubectl rollout status deployment/course-app --timeout=180s
kubectl exec deployment/course-app -- printenv APP_BANNER
```

Після restart:

```text
Lesson 07: ConfigMap value v2
```

Висновок: якщо ConfigMap підключений як env, зміна ConfigMap не перезапускає Pod-и автоматично. Потрібен `rollout restart`, зміна pod template або інший механізм перезапуску.

### 3. Оновлення образу контейнера та rollout

Для ДЗ №7 зібрано й опубліковано новий образ:

```bash
docker build -t pimenov2unit/course-app:lesson-07 ./app
docker push pimenov2unit/course-app:lesson-07
```

У Deployment використовується:

```yaml
image: pimenov2unit/course-app:lesson-07
```

Для перевірки rollout образ тимчасово перемикався на старий тег і назад:

```bash
kubectl set image deployment/course-app course-app=pimenov2unit/course-app:lesson-06
kubectl rollout status deployment/course-app --timeout=180s
kubectl get rs -o wide

kubectl set image deployment/course-app course-app=pimenov2unit/course-app:lesson-07
kubectl rollout status deployment/course-app --timeout=180s
kubectl get rs -o wide
```

Спостереження: при зміні image Kubernetes створює новий ReplicaSet, поступово переносить репліки зі старого ReplicaSet у новий, а старий ReplicaSet залишає з `DESIRED 0` для історії rollout і можливого rollback.

### 4. RollingUpdate з різними maxUnavailable/maxSurge

Базова стратегія в [k8s/deployment.yaml](k8s/deployment.yaml):

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Це консервативний варіант: Kubernetes додає максимум 1 зайвий Pod і не допускає втрати доступних реплік. Для 10 реплік rollout іде повільніше, але без просідання доступності.

Експериментальні patch-файли:

```text
k8s/experiments/rollingupdate-conservative.yaml
k8s/experiments/rollingupdate-balanced.yaml
k8s/experiments/rollingupdate-fast.yaml
```

Застосування patch:

```bash
kubectl patch deployment course-app --type merge --patch-file k8s/experiments/rollingupdate-fast.yaml
kubectl get deployment course-app -o jsonpath='{.spec.strategy}'
kubectl rollout restart deployment/course-app
kubectl rollout status deployment/course-app --timeout=180s
```

Для `maxUnavailable: 5`, `maxSurge: 5` спостерігалось:

```text
deployment.apps/course-app   5/10   10   5
```

Тобто Kubernetes швидко створив багато нових Pod-ів, але тимчасово доступність просіла до 5 з 10. Rollout завершився швидше, ніж із `maxUnavailable: 0`, `maxSurge: 1`.

Порівняння:

| Варіант | Поведінка | Переваги | Недоліки |
|---|---|---|---|
| `maxUnavailable: 0`, `maxSurge: 1` | Оновлення майже по одному Pod-у | Найкраща доступність | Повільніше, потрібен ресурс для +1 Pod |
| `maxUnavailable: 2`, `maxSurge: 2` | Баланс швидкості й доступності | Швидше за conservative | Може бути невелике просідання |
| `maxUnavailable: 5`, `maxSurge: 5` | Масове оновлення пачками | Швидкий rollout | Помітне тимчасове зниження доступності й більше навантаження на кластер |

### 5. Recreate strategy

У завданні вказано "Replace стратегія". Для Kubernetes `Deployment` відповідна стратегія називається `Recreate`.

Patch-файл:

```text
k8s/experiments/recreate.yaml
```

Перевірка:

```bash
kubectl patch deployment course-app --type json -p '[{"op":"replace","path":"/spec/strategy","value":{"type":"Recreate"}}]'
kubectl rollout restart deployment/course-app
kubectl get pods,pvc,svc,deploy
kubectl rollout status deployment/course-app --timeout=180s
```

Під час Recreate було зафіксовано:

```text
deployment.apps/course-app   0/10   10   0
```

Тобто старі Pod-и були прибрані перед тим, як нові стали доступні. Це створює короткий downtime.

Після експерименту Deployment повернуто до базового RollingUpdate:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl get deployment course-app -o jsonpath='{.spec.strategy}'
```

Фінальна стратегія:

```json
{"rollingUpdate":{"maxSurge":1,"maxUnavailable":0},"type":"RollingUpdate"}
```

## Порівняння RollingUpdate і Recreate

| Стратегія | Як працює | Переваги | Недоліки | Коли використовувати |
|---|---|---|---|---|
| RollingUpdate | Поступово створює нові Pod-и й видаляє старі | Можна оновлювати без простою, є контроль через `maxUnavailable`/`maxSurge` | Старі й нові версії деякий час працюють одночасно | Звичайні stateless web-сервіси |
| Recreate | Спочатку видаляє всі старі Pod-и, потім створює нові | Простий і передбачуваний, одночасно працює тільки одна версія | Є downtime | Коли дві версії не можуть працювати паралельно |

## Команди для швидкої перевірки

```bash
kubectl config current-context
kubectl apply -f k8s/
kubectl rollout status deployment/db --timeout=180s
kubectl rollout status deployment/course-app --timeout=180s
kubectl get pods,pvc,svc,deploy
kubectl get rs -o wide
kubectl get configmap course-app-config -o yaml
```

Доступ до застосунку:

```text
http://localhost:30080
```

Якщо `NodePort` не відкривається через `localhost`, можна використати port-forward:

```bash
kubectl port-forward service/course-app 8080:80
```

Після цього:

```text
http://localhost:8080
http://localhost:8080/health
```

Очікуваний health response:

```json
{"status":"healthy"}
```

## Фінальний стан

На момент перевірки:

```text
deployment.apps/course-app   10/10
deployment.apps/db           1/1
service/course-app           NodePort 80:30080/TCP
persistentvolumeclaim/postgres-data   Bound
```

ConfigMap у нових Pod-ах:

```text
Lesson 07: ConfigMap value v2
```

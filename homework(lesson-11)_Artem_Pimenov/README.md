# Guess the Number: Helm Deployment Automation

## Опис

Це ДЗ №11 як продовження попередніх Kubernetes-завдань. Мета роботи - перенести розгортання застосунку з raw Kubernetes manifests у керований Helm chart.

Застосунок з попередніх ДЗ використовує PostgreSQL, тому вимогу курсу про community chart для бази адаптовано так:

- замість власного `StatefulSet` для бази використано community chart `bitnami/postgresql`;
- власний Helm chart `course-app` містить templates для Flask застосунку;
- PostgreSQL підключено як Helm dependency;
- Redis не додається, бо поточний app реально працює з PostgreSQL.

## Структура

```text
.
├── app/
├── db/
├── helm/
│   └── course-app/
│       ├── Chart.yaml
│       ├── Chart.lock
│       ├── values.yaml
│       ├── charts/
│       │   └── postgresql-*.tgz
│       └── templates/
│           ├── _helpers.tpl
│           ├── configmap.yaml
│           ├── deployment.yaml
│           ├── ingress.yaml
│           ├── postgresql-pv.yaml
│           ├── secret.yaml
│           ├── service.yaml
│           └── storageclass.yaml
├── k8s/
└── README.md
```

Каталог `k8s/` залишено як історичний контекст попереднього ДЗ. Основний спосіб розгортання в ДЗ11 - Helm.

## Helm Chart

Chart застосунку знаходиться у:

```text
helm/course-app
```

У [helm/course-app/Chart.yaml](helm/course-app/Chart.yaml) підключено dependency:

```yaml
dependencies:
  - name: postgresql
    version: 18.1.11
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
```

У [helm/course-app/values.yaml](helm/course-app/values.yaml) винесені основні параметри:

```yaml
replicaCount: 10

image:
  repository: pimenov2unit/course-app
  tag: lesson-11

ingress:
  enabled: true
  className: traefik
  host: course-app.local

postgres:
  database: guessdb
  user: guessuser
  password: guesspass123

postgresql:
  enabled: true
  auth:
    username: guessuser
    password: guesspass123
    database: guessdb
  volumePermissions:
    enabled: false
  primary:
    persistence:
      enabled: true
      storageClass: ""
      size: 1Gi
```

За замовчуванням chart не прив'язаний до конкретної Kubernetes-ноди. `bitnami/postgresql` створює PVC, а Kubernetes використовує default `StorageClass` кластера викладача.

Для bare-metal kubeadm-кластера без dynamic provisioner можна опціонально увімкнути static `StorageClass` і `PersistentVolume`:

```yaml
storage:
  enabled: true
  className: local-storage
  size: 1Gi
  hostPath: /var/lib/course-app/helm-postgresql-data
  nodeName: <node-hostname>
```

У templates перенесено:

| Raw manifest | Helm template |
|---|---|
| `Deployment` | `templates/deployment.yaml` |
| `Service` | `templates/service.yaml` |
| `Ingress` | `templates/ingress.yaml` |
| `ConfigMap` | `templates/configmap.yaml` |
| app secrets | `templates/secret.yaml` |

## PostgreSQL через Bitnami Chart

PostgreSQL більше не описується власним `StatefulSet` у manifests. Його створює chart `bitnami/postgresql`.

Bitnami chart автоматично створює:

- `StatefulSet`;
- `Service`;
- `Secret`;
- `PersistentVolumeClaim`;
- probes;
- init scripts;
- labels/selectors;
- persistent storage.

Власний chart не пише PostgreSQL `StatefulSet` вручну. Workload бази створюється dependency chart-ом `bitnami/postgresql`.

Якщо використовується static `hostPath`, потрібно увімкнути `postgresql.volumePermissions.enabled`, щоб init container Bitnami виставив права на каталог даних перед запуском PostgreSQL.

Ініціалізація таблиці `game_results` задана у `values.yaml`:

```yaml
postgresql:
  primary:
    initdb:
      scripts:
        init.sql: |
          CREATE TABLE IF NOT EXISTS game_results (
              id SERIAL PRIMARY KEY,
              player_id VARCHAR(64) NOT NULL,
              attempts INTEGER NOT NULL,
              played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
```

## Підготовка Helm Dependencies

Додати Bitnami repo:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

Завантажити dependency:

```bash
cd helm/course-app
helm dependency update
```

Перевірити chart:

```bash
helm lint .
helm template course-app . --namespace default
```

## Збірка та публікація image

```bash
docker build -t pimenov2unit/course-app:lesson-11 ./app
docker push pimenov2unit/course-app:lesson-11
```

## Розгортання

З кореня ДЗ11:

```bash
helm upgrade --install course-app ./helm/course-app --namespace default
```

Цей варіант очікує, що у кластері є default `StorageClass`.

Для bare-metal kubeadm-кластера без dynamic provisioner вкажіть ноду для static PV:

```bash
helm upgrade --install course-app ./helm/course-app --namespace default \
  --set storage.enabled=true \
  --set storage.nodeName=<node-hostname> \
  --set postgresql.primary.persistence.storageClass=local-storage \
  --set postgresql.volumePermissions.enabled=true
```

Дочекатися готовності:

```bash
kubectl rollout status deployment/course-app --timeout=180s
kubectl rollout status statefulset/course-app-postgresql --timeout=180s
```

Перевірити ресурси:

```bash
kubectl get deploy,statefulset,pod,svc,ingress,pvc -o wide
```

Очікувано:

```text
deployment/course-app              10/10
statefulset/course-app-postgresql  1/1
ingress/course-app                 CLASS traefik
pvc/data-course-app-postgresql-0   Bound
```

## Перевірка

HTTP endpoints:

```bash
curl -fsS -H 'Host: course-app.local' http://192.168.99.100/health
curl -fsS -H 'Host: course-app.local' http://192.168.99.100/ready
```

Очікувано:

```json
{"status":"healthy"}
{"status":"ready"}
```

Перевірити PostgreSQL:

```bash
kubectl exec course-app-postgresql-0 -- \
  env PGPASSWORD=guesspass123 psql -U guessuser -d guessdb \
  -c "SELECT COUNT(*) AS game_results_count FROM game_results;"
```

## Оновлення

Змінити параметри можна через `values.yaml` або CLI:

```bash
helm upgrade course-app ./helm/course-app \
  --set replicaCount=3 \
  --set ingress.host=course-app.local
```

Переглянути реліз:

```bash
helm list
helm status course-app
helm get values course-app
```

## Видалення

```bash
helm uninstall course-app
```

PVC PostgreSQL може залишитися після uninstall, щоб не втратити дані. Перевірити:

```bash
kubectl get pvc
```

## Підсумок

У ДЗ11:

| Компонент | Реалізація |
|---|---|
| `course-app` | власний Helm chart |
| `Deployment` | Helm template |
| `Service` | Helm template |
| `Ingress` | Helm template, `ingressClassName: traefik` |
| PostgreSQL | `bitnami/postgresql` dependency |
| Конфігурація | `values.yaml` |
| Image | `pimenov2unit/course-app:lesson-11` |

# Guess the Number: CloudNativePG Operator and RBAC

## Опис

Це ДЗ №12 як продовження ДЗ11. У завданні курсу вказано Dragonfly Operator, але поточний застосунок використовує PostgreSQL. Тому операторний підхід адаптовано на PostgreSQL через CloudNativePG.

Що реалізовано:

- встановлення CloudNativePG operator через офіційний Helm chart;
- розгортання PostgreSQL через custom resource `Cluster`;
- підключення `course-app` до operator-managed PostgreSQL;
- RBAC для read-only доступу до `clusters.postgresql.cnpg.io`;
- перевірка прав через `kubectl auth can-i`.

## Структура

```text
.
├── app/
├── helm/
│   └── course-app/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── cnpg-cluster.yaml
│           ├── db-viewer-rbac.yaml
│           ├── deployment.yaml
│           ├── ingress.yaml
│           ├── postgresql-pv.yaml
│           ├── secret.yaml
│           └── storageclass.yaml
├── k8s/
│   ├── postgresql-cluster.yaml
│   └── db-viewer-rbac.yaml
└── README.md
```

Основний спосіб розгортання - Helm chart `helm/course-app`.

## Завдання 1. CloudNativePG Operator

Додати офіційний Helm repository і встановити operator:

```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update
helm upgrade --install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system \
  --create-namespace
```

Перевірити operator:

```bash
kubectl rollout status deployment/cnpg-cloudnative-pg \
  -n cnpg-system \
  --timeout=180s
```

Перевірити CRD/API resources:

```bash
kubectl api-resources | grep postgresql.cnpg.io
```

Очікувано серед ресурсів є:

```text
clusters postgresql.cnpg.io/v1 true Cluster
```

Подивитися поля custom resource:

```bash
kubectl explain cluster.spec
kubectl explain cluster.spec.bootstrap.initdb
kubectl explain cluster.spec.storage
```

## Helm Chart

Chart `course-app` більше не використовує Bitnami PostgreSQL dependency. PostgreSQL описано як CloudNativePG `Cluster`:

```yaml
cnpg:
  enabled: true
  instances: 1
  imageName: ghcr.io/cloudnative-pg/postgresql:16
  storage:
    size: 1Gi
    storageClass: ""
```

У default-режимі `storageClass` порожній, тому Kubernetes використовує default `StorageClass` кластера перевіряючого.

Для bare-metal kubeadm-кластера без dynamic provisioner можна увімкнути static PV:

```bash
helm upgrade --install course-app ./helm/course-app --namespace default \
  --set storage.enabled=true \
  --set storage.nodeName=<node-hostname> \
  --set cnpg.storage.storageClass=local-storage
```

У нашому кластері використовується:

```bash
--set storage.nodeName=k8snode2
```

У цьому режимі chart також запускає Helm hook `course-app-storage-permissions`. Він монтує той самий `hostPath` і виставляє права `26:26`, потрібні CloudNativePG PostgreSQL container-у для `initdb`.

## Збірка Image

```bash
docker build -t pimenov2unit/course-app:lesson-12 ./app
docker push pimenov2unit/course-app:lesson-12
```

## Розгортання

З кореня ДЗ12:

```bash
helm lint ./helm/course-app
helm template course-app ./helm/course-app --namespace default
helm upgrade --install course-app ./helm/course-app --namespace default
```

Для нашого bare-metal кластера:

```bash
helm upgrade --install course-app ./helm/course-app --namespace default \
  --set storage.enabled=true \
  --set storage.nodeName=k8snode2 \
  --set cnpg.storage.storageClass=local-storage
```

Перевірити ресурси:

```bash
kubectl get clusters,pods,svc,pvc,pv -o wide
kubectl rollout status deployment/course-app --timeout=180s
```

`course-app` підключається до PostgreSQL через CloudNativePG read/write service:

```text
course-app-postgresql-rw:5432
```

## Завдання 2. RBAC для Custom Resources

Створено:

- `ServiceAccount`: `db-viewer`;
- `Role`: `db-readonly`;
- `apiGroups`: `postgresql.cnpg.io`;
- `resources`: `clusters`;
- `verbs`: `get`, `list`, `watch`;
- `RoleBinding`: `db-readonly-binding`.

Файл raw manifest:

```text
k8s/db-viewer-rbac.yaml
```

У Helm chart RBAC знаходиться у:

```text
helm/course-app/templates/db-viewer-rbac.yaml
```

## Завдання 3. Верифікація RBAC

Read-only доступ має бути дозволений:

```bash
kubectl auth can-i list clusters.postgresql.cnpg.io \
  --as=system:serviceaccount:default:db-viewer
```

Очікувано:

```text
yes
```

Delete має бути заборонений:

```bash
kubectl auth can-i delete clusters.postgresql.cnpg.io \
  --as=system:serviceaccount:default:db-viewer
```

Очікувано:

```text
no
```

## Перевірка App

Отримати адресу Ingress controller у своєму кластері:

```bash
kubectl get ingress course-app -o wide
```

Підставити IP або DNS Ingress controller:

```bash
curl -fsS -H 'Host: course-app.local' http://<ingress-address>/health
curl -fsS -H 'Host: course-app.local' http://<ingress-address>/ready
```

Очікувано:

```json
{"status":"healthy"}
{"status":"ready"}
```

Перевірити таблицю:

```bash
kubectl exec course-app-postgresql-1 -- \
  env PGPASSWORD=guesspass123 psql -U guessuser -d guessdb \
  -c "SELECT COUNT(*) AS game_results_count FROM game_results;"
```

## Підсумок

| Вимога | Реалізація |
|---|---|
| Operator pattern | CloudNativePG operator |
| Custom resource | `Cluster` |
| API group | `postgresql.cnpg.io` |
| Resource | `clusters` |
| App database | PostgreSQL через `course-app-postgresql-rw` |
| RBAC | `db-viewer` + `db-readonly` |

`postInitApplicationSQL` створює таблицю `game_results` і передає ownership користувачу `guessuser`, щоб застосунок міг читати й писати результати гри.

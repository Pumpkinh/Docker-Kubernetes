# Guess the Number: Persistent Storage in Kubernetes

## Опис

Це ДЗ №10 як логічне продовження ДЗ №8: веб-гра "Вгадай число" на Flask з PostgreSQL працює в Kubernetes на кількох нодах, а дані PostgreSQL зберігаються у persistent storage і не втрачаються після перезапуску Pod-а бази даних.

Мета роботи: налаштувати `StorageClass`, `PersistentVolume`, `PersistentVolumeClaim`, перевести PostgreSQL на `StatefulSet` з `volumeClaimTemplates` і перевірити, що історія ігор зберігається після restart / recreate Pod-а `db-0`.

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
[ StatefulSet: db, 1 replica, Pod db-0 ]
    |
[ PVC: postgres-data-db-0, StorageClass: local-storage ]
    |
[ PV: postgres-data-db-0, Retain, local path on k8scontrol ]
```

## Структура

```text
.
├── app/
├── db/
├── k8s/
│   ├── storageclass.yaml
│   ├── local-pv.yaml
│   ├── postgres.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── ingress.yaml
├── docker-compose.yml
├── docker-stack.yml
└── README.md
```

## Persistent Storage

У [k8s/storageclass.yaml](k8s/storageclass.yaml) створено `StorageClass` для локального static provisioning:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain
```

У [k8s/local-pv.yaml](k8s/local-pv.yaml) створено `PersistentVolume` з локальним шляхом на storage-ноді:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-data-db-0
spec:
  capacity:
    storage: 1Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  hostPath:
    path: /var/lib/course-app/postgres-statefulset-data
    type: DirectoryOrCreate
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values:
                - k8scontrol
```

Це повноцінний multi-node kubeadm-кластер, тому PV має `nodeAffinity`: Kubernetes повинен запускати Pod `db-0` саме на ноді, де фізично доступний каталог з даними. Для навчального стенду використано `hostPath` з `DirectoryOrCreate`, щоб kubelet створив каталог автоматично під час запуску Pod-а.

У [k8s/postgres.yaml](k8s/postgres.yaml) PostgreSQL описаний як `StatefulSet`. PVC створюється не окремим manifest-ом, а через `volumeClaimTemplates`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db
  replicas: 1
  volumeClaimTemplates:
    - metadata:
        name: postgres-data
      spec:
        storageClassName: local-storage
        accessModes:
          - ReadWriteOnce
        resources:
          requests:
            storage: 1Gi
```

Для StatefulSet `db` і ordinal `0` Kubernetes створить PVC з іменем `postgres-data-db-0`.

PostgreSQL монтує PVC у `/var/lib/postgresql/data`, а `PGDATA` вказує на підкаталог:

```yaml
env:
  - name: PGDATA
    value: /var/lib/postgresql/data/pgdata
volumeMounts:
  - name: postgres-data
    mountPath: /var/lib/postgresql/data
```

## Підготовка storage-ноди

На ноді `k8scontrol` каталог для PV буде створений kubelet автоматично завдяки `hostPath.type: DirectoryOrCreate`.

Якщо потрібно підготувати його вручну:

```bash
sudo mkdir -p /var/lib/course-app/postgres-statefulset-data
```

Для тестового стенду достатньо прав:

```bash
sudo chmod 777 /var/lib/course-app/postgres-statefulset-data
```

У production краще виставляти власника і права під конкретний UID/GID контейнера PostgreSQL.

## Збірка образу

```bash
docker build -t pimenov2unit/course-app:lesson-10 ./app
docker push pimenov2unit/course-app:lesson-10
```

## Розгортання

```bash
kubectl apply -f k8s/
kubectl rollout status statefulset/db --timeout=180s
kubectl rollout status deployment/course-app --timeout=180s
kubectl get storageclass,pv,pvc
kubectl get pods -o wide
```

Очікуваний storage-стан:

```text
storageclass.storage.k8s.io/local-storage
persistentvolume/postgres-data-db-0                  Bound
persistentvolumeclaim/postgres-data-db-0             Bound
```

Очікуваний workload-стан:

```text
course-app   10 replicas   Running
db           1 replica     Running
```

`course-app` може розкладатися по worker-нодах, а `db` залишається на ноді, де доступний local PV.

## Перевірка persistence

1. Відкрити застосунок і зіграти гру до успішного результату, щоб у таблицю `game_results` записався рядок.

2. Перевірити кількість записів у PostgreSQL:

```bash
DB_POD=$(kubectl get pod -l app=db -o jsonpath='{.items[0].metadata.name}')

kubectl exec "$DB_POD" -- psql \
  -U guessuser \
  -d guessdb \
  -c "SELECT COUNT(*) AS game_results_count FROM game_results;"
```

3. Перезапустити Pod бази даних:

```bash
kubectl rollout restart statefulset/db
kubectl rollout status statefulset/db --timeout=180s
```

4. Повторно перевірити дані:

```bash
DB_POD=$(kubectl get pod -l app=db -o jsonpath='{.items[0].metadata.name}')

kubectl exec "$DB_POD" -- psql \
  -U guessuser \
  -d guessdb \
  -c "SELECT COUNT(*) AS game_results_count FROM game_results;"
```

Кількість записів має залишитися такою самою. Це підтверджує, що дані живуть не в ephemeral filesystem Pod-а, а в PVC.

## Перевірка після видалення Pod-а

Додаткова перевірка:

```bash
DB_POD=$(kubectl get pod -l app=db -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod "$DB_POD"
kubectl rollout status statefulset/db --timeout=180s
```

Після створення нового Pod-а:

```bash
DB_POD=$(kubectl get pod -l app=db -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$DB_POD" -- psql -U guessuser -d guessdb -c "SELECT * FROM game_results ORDER BY played_at DESC LIMIT 5;"
```

Дані мають залишитися доступними.

## Reclaim Policy

Для PV використано:

```yaml
persistentVolumeReclaimPolicy: Retain
```

Це означає, що після видалення PVC Kubernetes не видаляє дані автоматично. Для навчального стенду це зручно, бо можна явно показати, що storage існує окремо від lifecycle Pod-а і PVC.

## Оновлення з ДЗ8

Порівняно з ДЗ8:

| Компонент | ДЗ8 | ДЗ10 |
|---|---|---|
| Тема | Ingress, probes, service discovery | Persistent Storage |
| StorageClass | не виділено окремо | `local-storage` |
| PV | базовий local/host path | local PV з `nodeAffinity` |
| PVC | `postgres-data` | `postgres-data-db-0` з `storageClassName: local-storage` |
| Перевірка | health/readiness/Ingress | збереження даних після recreate `db` |
| App version | `lesson-08` | `lesson-10` |

## Фінальний стан

У фінальному варіанті:

| Компонент | Стан |
|---|---|
| `course-app` Deployment | 10 реплік, image `pimenov2unit/course-app:lesson-10` |
| `course-app` Service | `ClusterIP`, порт `80/TCP` |
| `Ingress` | `course-app.local` -> `service/course-app:80` |
| `db` StatefulSet | 1 репліка, Pod `db-0`, PostgreSQL з PVC |
| `db` Service | `ClusterIP`, порт `5432/TCP` |
| `StorageClass` | `local-storage`, `kubernetes.io/no-provisioner` |
| `PV` | `postgres-data-db-0`, `Retain`, local path на `k8scontrol` |
| `PVC` | `postgres-data-db-0`, `Bound` |

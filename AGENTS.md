# Repository Guidelines

## Project Structure & Module Organization

This repository is organized by homework folders, for example `homework(lesson-10)_Artem_Pimenov/` and `homework(lesson-11)_Artem_Pimenov/`. Treat the latest lesson folder as the active implementation and older folders as historical context.

Inside each homework folder:
- `app/` contains the Flask application, Dockerfile, Nginx config, templates, static files, and startup script.
- `db/` contains database image context where used by earlier lessons.
- `k8s/` contains raw Kubernetes manifests from previous assignments.
- `helm/course-app/` contains the Helm chart for lesson 11, including `values.yaml`, templates, and chart dependencies.
- `README.md` documents lesson-specific deployment steps.

## Build, Test, and Development Commands

Run commands from the relevant homework folder unless noted.

```bash
docker build -t pimenov2unit/course-app:lesson-11 ./app
docker push pimenov2unit/course-app:lesson-11
```
Builds and publishes the application image.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update ./helm/course-app
helm lint ./helm/course-app
helm template course-app ./helm/course-app --namespace default
```
Prepares and validates the Helm chart.

```bash
helm upgrade --install course-app ./helm/course-app --namespace default
kubectl get deploy,statefulset,pod,svc,ingress,pvc,pv -o wide
```
Deploys and checks Kubernetes resources.

## Coding Style & Naming Conventions

Use concise, readable Python with 4-space indentation. Keep Flask routes and helpers simple and local to `app/src/app.py` unless reuse justifies extraction. YAML files use 2-space indentation. Prefer descriptive Kubernetes names such as `course-app`, `course-app-config`, and `course-app-postgresql`.

Avoid hardcoding environment-specific values in templates. Put image tags, replica counts, ingress host, storage options, and database settings in `values.yaml`.

## Testing Guidelines

There is no formal test suite yet. Validate changes with:
- `helm lint` and `helm template` for chart syntax and rendering.
- `kubectl rollout status deployment/course-app`.
- `kubectl rollout status statefulset/course-app-postgresql`.
- HTTP checks for `/health` and `/ready`.

For database changes, verify PostgreSQL directly with `kubectl exec` and `psql`.

## Commit & Pull Request Guidelines

Existing commits use short imperative or descriptive messages, for example `Homework for lesson10` and `Use Traefik ingress for lesson10`. Keep new messages similarly focused: `Add Helm chart for lesson11`.

Pull requests should include the lesson folder changed, deployment commands run, verification output summary, and any cluster-specific assumptions such as StorageClass, Ingress class, or static PV node binding.

## Security & Configuration Tips

Do not commit real production secrets. Lesson credentials in `values.yaml` are acceptable only for local homework use. Prefer Helm values overrides for environment-specific settings.

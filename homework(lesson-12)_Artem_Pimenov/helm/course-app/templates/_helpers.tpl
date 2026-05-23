{{- define "course-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "course-app.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "course-app.labels" -}}
app.kubernetes.io/name: {{ include "course-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "course-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "course-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "course-app.postgresHost" -}}
{{- if .Values.postgres.host -}}
{{- .Values.postgres.host -}}
{{- else if .Values.cnpg.enabled -}}
{{- printf "%s-rw" (include "course-app.cnpgClusterName" .) -}}
{{- else -}}
{{- printf "%s-postgresql" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "course-app.cnpgClusterName" -}}
{{- if .Values.cnpg.clusterName -}}
{{- .Values.cnpg.clusterName | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-postgresql" (include "course-app.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "course-app.cnpgCredentialsSecretName" -}}
{{- printf "%s-credentials" (include "course-app.cnpgClusterName" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

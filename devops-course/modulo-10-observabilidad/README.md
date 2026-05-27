# Módulo 10 — Observabilidad & Monitoring

> **Objetivo:** Ver, entender y actuar sobre el estado de sistemas distribuidos

---

## 1. Los Tres Pilares + el Cuarto

```
MÉTRICAS     → ¿qué está pasando? (números en el tiempo)
LOGS         → ¿qué pasó exactamente? (eventos)
TRAZAS       → ¿dónde tardó? (request path entre servicios)
PERFILES     → ¿por qué consume tanto? (CPU/memoria por función)
```

---

## 2. Prometheus — Métricas

### Instalación con Helm (kube-prometheus-stack)
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
    --namespace monitoring \
    --create-namespace \
    -f values/prometheus-stack.yaml
```

```yaml
# values/prometheus-stack.yaml
prometheus:
  prometheusSpec:
    retention: 30d
    retentionSize: 50GB
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          resources:
            requests:
              storage: 50Gi
    
    # Scrape adicional para apps propias
    additionalScrapeConfigs:
    - job_name: 'mi-app'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: (.+)
        replacement: $1

    # Alertas de producción
    additionalPrometheusRules:
    - name: mi-app-alerts
      groups:
      - name: mi-app
        rules:
        - alert: HighErrorRate
          expr: |
            rate(http_requests_total{status=~"5..",job="mi-app"}[5m]) /
            rate(http_requests_total{job="mi-app"}[5m]) > 0.05
          for: 2m
          labels:
            severity: critical
            team: backend
          annotations:
            summary: "Tasa de errores alta en {{ $labels.instance }}"
            description: "Error rate: {{ $value | humanizePercentage }}"
            runbook_url: "https://wiki.empresa.com/runbooks/high-error-rate"

        - alert: HighLatency
          expr: |
            histogram_quantile(0.99, 
              rate(http_request_duration_seconds_bucket{job="mi-app"}[5m])
            ) > 2
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "P99 latencia alta: {{ $value }}s"

        - alert: PodNotReady
          expr: kube_pod_status_ready{condition="false", namespace="produccion"} == 1
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Pod {{ $labels.pod }} no está listo"

grafana:
  grafana.ini:
    security:
      admin_password: "${GRAFANA_ADMIN_PASSWORD}"
    smtp:
      enabled: true
      host: smtp.empresa.com:587
  
  sidecar:
    dashboards:
      enabled: true
      searchNamespace: ALL
  
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: default
        orgId: 1
        folder: ''
        type: file
        options:
          path: /var/lib/grafana/dashboards

alertmanager:
  config:
    global:
      slack_api_url: "${SLACK_WEBHOOK_URL}"
      pagerduty_url: "https://events.pagerduty.com/v2/enqueue"

    route:
      group_by: ['alertname', 'namespace']
      group_wait: 10s
      group_interval: 5m
      repeat_interval: 4h
      receiver: slack-notifications
      routes:
      - match:
          severity: critical
        receiver: pagerduty-critical
      - match:
          severity: warning
        receiver: slack-notifications

    receivers:
    - name: slack-notifications
      slack_configs:
      - channel: '#alertas-infra'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true

    - name: pagerduty-critical
      pagerduty_configs:
      - routing_key: "${PAGERDUTY_KEY}"
        description: '{{ .GroupLabels.alertname }}'
```

### PromQL — Queries Esenciales
```promql
# Error rate de HTTP
rate(http_requests_total{status=~"5.."}[5m]) /
rate(http_requests_total[5m])

# Latencia P50, P95, P99
histogram_quantile(0.99, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
)

# CPU por pod
sum(rate(container_cpu_usage_seconds_total{namespace="produccion"}[5m]))
  by (pod)

# Memoria usada vs límite
sum(container_memory_working_set_bytes{namespace="produccion"}) by (pod) /
sum(kube_pod_container_resource_limits{resource="memory", namespace="produccion"}) by (pod)

# Pods no listos
kube_pod_status_ready{condition="false", namespace="produccion"}

# Saturación de nodo (CPU)
1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) by (node)

# Capacidad de disco (alerta cuando queda < 10%)
(node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.10

# Tasa de requests por servicio
sum(rate(http_requests_total[5m])) by (service)

# SLO: 99.9% de requests < 500ms
sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m])) /
sum(rate(http_request_duration_seconds_count[5m]))
```

### Instrumentación de la App (Go)
```go
package main

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promauto"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpRequestsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total de requests HTTP",
        },
        []string{"method", "path", "status"},
    )

    httpDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "Duración de requests HTTP",
            Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
        },
        []string{"method", "path"},
    )

    activeConnections = promauto.NewGauge(
        prometheus.GaugeOpts{
            Name: "active_connections",
            Help: "Conexiones activas actuales",
        },
    )

    dbQueryDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "db_query_duration_seconds",
            Help:    "Duración de queries a la BD",
            Buckets: prometheus.DefBuckets,
        },
        []string{"query_type"},
    )
)
```

---

## 3. Loki — Logs

```yaml
# values/loki-stack.yaml
loki:
  auth_enabled: false
  
  storage:
    type: s3
    s3:
      s3: s3://mi-empresa-logs/loki
      region: eu-west-1

  limits_config:
    retention_period: 30d
    ingestion_rate_mb: 50
    max_streams_per_user: 10000

promtail:
  config:
    clients:
    - url: http://loki:3100/loki/api/v1/push
    
    scrape_configs:
    - job_name: kubernetes-pods
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: drop
        regex: false
      pipeline_stages:
      - docker: {}
      - json:
          expressions:
            level: level
            message: message
            timestamp: timestamp
      - labels:
          level:
      - timestamp:
          source: timestamp
          format: RFC3339
```

```
# LogQL — Queries de Loki

# Ver logs de un pod específico
{namespace="produccion", pod="mi-app-abc123"}

# Filtrar por nivel
{namespace="produccion", app="mi-app"} |= "ERROR"

# Parsear JSON y filtrar
{namespace="produccion", app="mi-app"} | json | level="error" | duration > 1s

# Tasa de logs de error
sum(rate({namespace="produccion"} |= "ERROR" [5m])) by (app)

# Top 10 mensajes de error más frecuentes
topk(10, sum(count_over_time({namespace="produccion"} |= "ERROR" [1h])) by (message))

# Extracción de campos para métricas desde logs
{app="nginx"} | regexp `(?P<method>\w+) (?P<path>[^\s]+) HTTP/\d\.\d" (?P<status>\d+) (?P<size>\d+)`
| status >= 500
```

---

## 4. Jaeger / Tempo — Distributed Tracing

```yaml
# Instrumentación con OpenTelemetry (el estándar)
# otel-collector.yaml
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
  namespace: monitoring
spec:
  mode: DaemonSet
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    processors:
      batch:
        timeout: 10s
        send_batch_size: 1024
      memory_limiter:
        check_interval: 1s
        limit_mib: 512

    exporters:
      otlp/tempo:
        endpoint: http://tempo:4317
        tls:
          insecure: true
      prometheusremotewrite:
        endpoint: http://prometheus:9090/api/v1/write

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [memory_limiter, batch]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [prometheusremotewrite]
```

```python
# Instrumentación en Python con OpenTelemetry
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

# Configurar proveedor de trazas
provider = TracerProvider()
otlp_exporter = OTLPSpanExporter(endpoint="http://otel-collector:4317", insecure=True)
provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
trace.set_tracer_provider(provider)

tracer = trace.get_tracer(__name__)

# Auto-instrumentar FastAPI y SQLAlchemy
FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument(engine=engine)

# Traza manual
with tracer.start_as_current_span("procesar-pedido") as span:
    span.set_attribute("pedido.id", pedido_id)
    span.set_attribute("usuario.id", usuario_id)
    
    resultado = procesar(pedido)
    
    if resultado.error:
        span.record_exception(resultado.error)
        span.set_status(trace.Status(trace.StatusCode.ERROR))
```

---

## 5. SLOs / SLIs / Error Budgets

```yaml
# SLO — Service Level Objectives
# Usando Sloth (generador de SLO para Prometheus)

version: "prometheus/v1"
service: "mi-app"
labels:
  team: backend
  tier: "1"

slos:
- name: "requests-availability"
  objective: 99.9
  description: "99.9% de requests exitosos"
  
  sli:
    events:
      error_query: sum(rate(http_requests_total{job="mi-app",status=~"5.."}[{{.window}}]))
      total_query: sum(rate(http_requests_total{job="mi-app"}[{{.window}}]))
  
  alerting:
    name: MiAppHighErrorRate
    labels:
      severity: critical
    annotations:
      summary: "Mi App disponibilidad por debajo del SLO"
    page_alert:
      labels:
        severity: critical
    ticket_alert:
      labels:
        severity: warning

- name: "requests-latency"
  objective: 99.0
  description: "99% de requests responden en menos de 500ms"
  
  sli:
    events:
      error_query: |
        sum(rate(http_request_duration_seconds_bucket{
          job="mi-app",le="0.5"
        }[{{.window}}]))
      total_query: sum(rate(http_request_duration_seconds_count{job="mi-app"}[{{.window}}]))
```

```bash
# Calcular error budget restante
# Error budget = (1 - SLO) * tiempo
# Para SLO 99.9% en 30 días:
# Budget = 0.001 * 30 * 24 * 60 = 43.2 minutos de downtime permitido

# Consulta PromQL para error budget
(
  1 - (
    sum(increase(http_requests_total{job="mi-app",status!~"5.."}[30d])) /
    sum(increase(http_requests_total{job="mi-app"}[30d]))
  )
) / 0.001  # 0.001 = 1 - SLO (99.9%)
# Resultado: 1.0 = 100% de budget, 0.0 = 0% de budget
```

---

## 6. Dashboards — Golden Signals

```
Los 4 Golden Signals (Google SRE Book):

1. LATENCIA     → tiempo de respuesta (P50, P95, P99)
2. TRÁFICO      → requests por segundo (RPS)
3. ERRORES      → tasa de errores (5xx, timeouts)
4. SATURACIÓN   → cuán cerca está del límite (CPU, memoria, colas)
```

```json
// Panel de Grafana — Golden Signals
// (snippet del JSON del dashboard)
{
  "title": "Golden Signals — Mi App",
  "panels": [
    {
      "title": "Request Rate (RPS)",
      "type": "graph",
      "targets": [{
        "expr": "sum(rate(http_requests_total{job='mi-app'}[5m])) by (service)"
      }]
    },
    {
      "title": "Error Rate",
      "type": "stat",
      "targets": [{
        "expr": "sum(rate(http_requests_total{job='mi-app',status=~'5..'}[5m])) / sum(rate(http_requests_total{job='mi-app'}[5m]))",
        "legendFormat": "Error Rate"
      }],
      "thresholds": {
        "steps": [
          {"color": "green", "value": 0},
          {"color": "yellow", "value": 0.01},
          {"color": "red", "value": 0.05}
        ]
      }
    },
    {
      "title": "Latencia P99",
      "type": "graph",
      "targets": [{
        "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job='mi-app'}[5m])) by (le))",
        "legendFormat": "P99"
      }]
    }
  ]
}
```

---

## 📝 Proyectos del Módulo

1. **Stack LGTM completo** — Loki + Grafana + Tempo + Mimir en K8s
2. **SLO Dashboard** — Dashboards con error budgets en tiempo real
3. **Instrumentar app** — OpenTelemetry en app real con trazas end-to-end
4. **Runbook automatizado** — Alerta que ejecuta script de remediación

## 📌 [Cheatsheet](cheatsheet.md)

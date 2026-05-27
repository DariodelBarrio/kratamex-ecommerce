# Módulo 12 — GitOps & Workflows Avanzados

> **Objetivo:** Gestionar infraestructura y aplicaciones con Git como fuente de verdad

---

## 1. GitOps — Principios

```
PRINCIPIOS GITOPS (OpenGitOps):

1. DECLARATIVO      → el sistema deseado se describe declarativamente
2. VERSIONADO       → el estado deseado está en Git (historial, audit)
3. AUTOMÁTICAMENTE  → agentes aplican automáticamente el estado deseado
4. CONTINUAMENTE    → agentes aseguran y corrigen divergencias (self-healing)

FLUJO:
Developer → PR → Review → Merge → Git → Agente GitOps → Cluster
                                         (ArgoCD/Flux)
```

---

## 2. ArgoCD — GitOps para Kubernetes

### App of Apps Pattern
```yaml
# El patrón "App of Apps" permite gestionar múltiples aplicaciones
# desde una sola aplicación raíz

# argocd/root-app.yaml — La aplicación raíz
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/empresa/k8s-configs
    targetRevision: HEAD
    path: argocd/apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```
k8s-configs/
├── argocd/
│   ├── root-app.yaml        # App raíz
│   └── apps/
│       ├── mi-app.yaml      # App de la aplicación
│       ├── monitoring.yaml  # App de monitoring
│       └── ingress.yaml     # App del ingress controller
├── apps/
│   ├── mi-app/
│   │   ├── base/
│   │   └── overlays/
│   │       ├── staging/
│   │       └── produccion/
└── infrastructure/
    ├── monitoring/
    ├── ingress-nginx/
    └── cert-manager/
```

### ApplicationSet — Multi-cluster y multi-entorno
```yaml
# Crear la misma app en múltiples clusters automáticamente
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: mi-app
  namespace: argocd
spec:
  generators:
  # Generar una app por cluster registrado en ArgoCD
  - clusters:
      selector:
        matchLabels:
          environment: produccion

  # Generar una app por entorno (desde lista)
  - list:
      elements:
      - cluster: staging
        url: https://staging-k8s.empresa.com
        namespace: staging
        revision: develop
      - cluster: produccion
        url: https://prod-k8s.empresa.com
        namespace: produccion
        revision: main

  template:
    metadata:
      name: 'mi-app-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/empresa/k8s-configs
        targetRevision: '{{revision}}'
        path: 'apps/mi-app/overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
        - CreateNamespace=true
```

### Rollouts — Deploys Avanzados
```yaml
# Argo Rollouts — Canary y Blue/Green deployments
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: mi-app
  namespace: produccion
spec:
  replicas: 10
  selector:
    matchLabels:
      app: mi-app
  template:
    metadata:
      labels:
        app: mi-app
    spec:
      containers:
      - name: mi-app
        image: registry.empresa.com/mi-app:v2.1.0
        ports:
        - containerPort: 8080

  strategy:
    canary:
      canaryService: mi-app-canary
      stableService: mi-app-stable
      trafficRouting:
        nginx:
          stableIngress: mi-app-ingress
      
      steps:
      # Paso 1: enviar 5% al canary
      - setWeight: 5
      # Paso 2: análisis automático durante 5 minutos
      - analysis:
          templates:
          - templateName: success-rate
          args:
          - name: service-name
            value: mi-app-canary
      # Paso 3: si bien, subir a 20%
      - setWeight: 20
      - pause: {duration: 5m}
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 100  # full rollout

      # Análisis: si error rate > 5%, rollback automático
      analysis:
        successCondition: result[0] >= 0.95
        failureLimit: 3
        interval: 1m

---
# AnalysisTemplate para validar el canary
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
  - name: service-name
  metrics:
  - name: success-rate
    interval: 1m
    successCondition: result[0] >= 0.95
    failureLimit: 3
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          sum(rate(http_requests_total{
            job="{{args.service-name}}",
            status!~"5.."
          }[5m])) /
          sum(rate(http_requests_total{
            job="{{args.service-name}}"
          }[5m]))
```

---

## 3. Flux CD — Alternativa GitOps

```yaml
# Flux — GitOps toolkit modular
# Bootstrap (instalar Flux en el cluster)
flux bootstrap github \
    --owner=empresa \
    --repository=k8s-configs \
    --branch=main \
    --path=./clusters/produccion \
    --personal

# GitRepository — fuente de verdad
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: k8s-configs
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/empresa/k8s-configs
  ref:
    branch: main
  secretRef:
    name: github-credentials

---
# Kustomization — qué aplicar del repositorio
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: mi-app
  namespace: flux-system
spec:
  interval: 10m
  path: ./apps/mi-app/overlays/produccion
  prune: true
  sourceRef:
    kind: GitRepository
    name: k8s-configs
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: mi-app
    namespace: produccion
  postBuild:
    substituteFrom:
    - kind: ConfigMap
      name: cluster-vars
    - kind: Secret
      name: cluster-secrets

---
# HelmRelease — gestionar Helm con Flux
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: nginx-ingress
  namespace: ingress-nginx
spec:
  interval: 1h
  chart:
    spec:
      chart: ingress-nginx
      version: "4.x"
      sourceRef:
        kind: HelmRepository
        name: ingress-nginx
        namespace: flux-system
  values:
    controller:
      replicaCount: 2
      service:
        type: LoadBalancer
  upgrade:
    remediation:
      remediateLastFailure: true
      retries: 3
  rollback:
    timeout: 5m
```

---

## 4. Image Automation con Flux

```yaml
# Actualización automática de imágenes cuando hay nuevo tag en el registry
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: mi-app
  namespace: flux-system
spec:
  image: registry.empresa.com/mi-app
  interval: 1m
  secretRef:
    name: registry-credentials

---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: mi-app
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: mi-app
  policy:
    semver:
      range: '>=1.0.0 <2.0.0'

---
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 30m
  sourceRef:
    kind: GitRepository
    name: k8s-configs
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@empresa.com
        name: fluxcdbot
      messageTemplate: |
        Auto-update: {{ range .Updated.Images }}{{ println .}}{{ end }}
    push:
      branch: main
  update:
    path: ./apps
    strategy: Setters
```

---

## 5. GitOps para Infraestructura (IaC + GitOps)

```yaml
# Atlantis — GitOps para Terraform
# atlantis.yaml
version: 3
automerge: false
delete_source_branch_on_merge: false

projects:
- name: produccion-eks
  dir: infraestructura/environments/produccion
  workspace: default
  terraform_version: v1.6.0
  autoplan:
    when_modified:
    - "**/*.tf"
    - "**/*.tfvars"
    enabled: true
  apply_requirements:
  - approved    # requiere aprobación
  - mergeable   # PR sin conflictos

- name: staging-eks
  dir: infraestructura/environments/staging
  workspace: default
  autoplan:
    enabled: true
  apply_requirements: []  # staging sin aprobación
```

```
FLUJO GITOPS + TERRAFORM:

1. Developer crea PR con cambio en .tf
2. Atlantis detecta el PR → ejecuta terraform plan
3. Plan se comenta en el PR (con cambios, costos estimados)
4. Team Leader aprueba el PR
5. Se hace merge
6. Atlantis ejecuta terraform apply automáticamente
7. Infracost comenta el impacto de costos
8. Resultado del apply se comenta en el PR cerrado
```

---

## 6. DORA Metrics — Medir la Madurez DevOps

```
Las 4 métricas clave de DORA:

1. DEPLOYMENT FREQUENCY      → ¿Con qué frecuencia deploys?
   Elite: múltiples veces al día
   High: 1 vez/día a 1 vez/semana

2. LEAD TIME FOR CHANGES      → commit → producción
   Elite: < 1 hora
   High: 1 día - 1 semana

3. MEAN TIME TO RESTORE (MTTR) → tiempo de recuperación ante incidente
   Elite: < 1 hora
   High: < 1 día

4. CHANGE FAILURE RATE        → % de deploys que causan incidente
   Elite: 0-15%
   High: 16-30%
```

```python
# Script para calcular DORA metrics desde GitHub/GitLab
import requests
from datetime import datetime, timedelta

def deployment_frequency(owner, repo, token, days=30):
    """Cuenta deploys exitosos en los últimos N días"""
    since = (datetime.now() - timedelta(days=days)).isoformat()
    
    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/deployments",
        headers={"Authorization": f"Bearer {token}"},
        params={"environment": "production", "per_page": 100}
    )
    
    deployments = response.json()
    successful = [d for d in deployments 
                  if d['created_at'] > since]
    
    freq_per_day = len(successful) / days
    return {
        "total": len(successful),
        "per_day": freq_per_day,
        "rating": "elite" if freq_per_day > 1 else 
                  "high" if freq_per_day > 0.14 else
                  "medium" if freq_per_day > 0.033 else "low"
    }
```

---

## 7. Incident Management

```markdown
## Runbook Template — Incidente de Alta Latencia

**Nombre:** Alta latencia en API de pagos
**Severidad:** SEV-1 (impacto en ingresos)
**SLO impactado:** Latencia P99 < 500ms

### Diagnóstico (5 min)

1. Verificar Golden Signals en Grafana:
   - Dashboard: [API Payments - Golden Signals](https://grafana.empresa.com/d/payments)
   - Buscar: latencia P99, error rate, RPS

2. Verificar Pods:
   ```bash
   kubectl get pods -n pagos -l app=api-pagos
   kubectl top pods -n pagos
   ```

3. Ver logs recientes:
   ```bash
   kubectl logs -l app=api-pagos -n pagos --tail=100 | grep -E "ERROR|WARN|timeout"
   ```

4. Verificar dependencias:
   - [ ] Base de datos: `kubectl exec -it pg-pod -- psql -c "SELECT count(*), wait_event_type FROM pg_stat_activity GROUP BY 2;"`
   - [ ] Redis: `kubectl exec -it redis-pod -- redis-cli info stats | grep rejected`
   - [ ] Servicios externos: Jaeger traces para ver dónde se acumula la latencia

### Mitigaciones (en orden)

1. **Scale up** si CPU/memoria > 80%:
   ```bash
   kubectl scale deployment api-pagos --replicas=10 -n pagos
   ```

2. **Rollback** si el problema coincide con un deploy reciente:
   ```bash
   kubectl rollout undo deployment/api-pagos -n pagos
   ```

3. **Circuit breaker** si una dependencia está saturada — activar desde feature flag

### Resolución y Post-mortem

- Crear issue en Jira con categoría "Incident"
- Completar post-mortem en 48h: [Template](https://confluence.empresa.com/postmortem)
- Blameless: foco en sistemas, no personas
```

---

## 8. Platform Engineering

```
El paso siguiente al DevOps: construir una "plataforma interna"
que abstraiga la complejidad para los equipos de producto.

┌────────────────────────────────────────────┐
│           Internal Developer Platform      │
├────────────────────────────────────────────┤
│  Self-service Portal (Backstage)           │
│  ├─ Crear nuevo servicio (template)        │
│  ├─ Ver catálogo de servicios              │
│  └─ Deploy con un click                   │
├────────────────────────────────────────────┤
│  Golden Paths                              │
│  ├─ Templates de repo estandarizados       │
│  ├─ Pipelines CI/CD pre-configurados      │
│  └─ Infraestructura por defecto segura    │
├────────────────────────────────────────────┤
│  Abstraction Layer                         │
│  ├─ Crossplane (infraestructura como CRDs) │
│  ├─ ArgoCD (despliegue)                   │
│  └─ Port / Humanitec (orquestación)       │
└────────────────────────────────────────────┘
```

```yaml
# Backstage — Catálogo de servicios
# catalog-info.yaml en cada repo
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: api-pagos
  description: API de procesamiento de pagos
  annotations:
    github.com/project-slug: empresa/api-pagos
    prometheus.io/alert: api-pagos
    grafana/dashboard-selector: "app=api-pagos"
    opsgenie.com/component-selector: "api-pagos"
    backstage.io/techdocs-ref: dir:.
  tags:
  - payments
  - nodejs
  - tier-1
  links:
  - url: https://grafana.empresa.com/d/api-pagos
    title: Dashboard de producción
  - url: https://wiki.empresa.com/runbooks/api-pagos
    title: Runbook
spec:
  type: service
  lifecycle: production
  owner: team-payments
  dependsOn:
  - component:postgres-payments
  - component:redis-payments
  providesApis:
  - api-pagos-rest
```

---

## 📝 Proyecto Final Integrador

### Construir una plataforma DevOps completa:

```
1. INFRAESTRUCTURA (Terraform + GitOps)
   └─ EKS/GKE + VPC + RDS + Redis
      + ArgoCD + Prometheus Stack

2. CI/CD (GitHub Actions)
   └─ Test → SAST → Build → Sign →
      Push → Deploy Staging →
      Smoke Test → Deploy Prod (canary)

3. APLICACIÓN (microservicios)
   └─ API Gateway + 3 microservicios
      + instrumentación OpenTelemetry

4. OBSERVABILIDAD
   └─ Prometheus + Grafana + Loki + Tempo
      + Alertas + SLOs + On-call rotation

5. SEGURIDAD
   └─ Vault + Falco + Kyverno +
      Network Policies + Image signing

6. GITOPS
   └─ ArgoCD App of Apps + Argo Rollouts
      + Image Automation + Atlantis
```

---

## 📚 Recursos Finales

Ver [`../recursos/README.md`](../recursos/README.md) para:
- Libros recomendados
- Canales y conferencias
- Labs online (Katacoda, KillerKoda, etc.)
- Certificaciones relevantes (CKA, CKAD, CKS, AWS-SAP, etc.)

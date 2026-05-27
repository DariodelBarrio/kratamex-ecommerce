# Módulo 05 — Kubernetes

> **Objetivo:** Operar y administrar clusters Kubernetes en producción

---

## 1. Arquitectura de Kubernetes

```
┌─────────────────── Control Plane ──────────────────────┐
│  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│  │  API     │  │  etcd   │  │Scheduler │  │Ctrl Mgr│  │
│  │  Server  │  │(estado) │  │          │  │        │  │
│  └──────────┘  └─────────┘  └──────────┘  └────────┘  │
└────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Worker Node   │  │   Worker Node   │  │   Worker Node   │
│  ┌───────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │
│  │  kubelet  │  │  │  │  kubelet  │  │  │  │  kubelet  │  │
│  │  kube-    │  │  │  │  kube-    │  │  │  │  kube-    │  │
│  │  proxy    │  │  │  │  proxy    │  │  │  │  proxy    │  │
│  │  runtime  │  │  │  │  runtime  │  │  │  │  runtime  │  │
│  └───────────┘  │  │  └───────────┘  │  │  └───────────┘  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 2. Recursos Fundamentales

### Deployments
```yaml
# deployment-produccion.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mi-app
  namespace: produccion
  labels:
    app: mi-app
    version: v2.1.0
  annotations:
    kubernetes.io/change-cause: "Actualización a v2.1.0 — fix crítico de seguridad"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mi-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # pods adicionales durante actualización
      maxUnavailable: 0    # nunca bajar por debajo de réplicas deseadas
  template:
    metadata:
      labels:
        app: mi-app
        version: v2.1.0
    spec:
      # Anti-affinity: pods en distintos nodos
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  app: mi-app
              topologyKey: kubernetes.io/hostname

      # Tolerations para nodos con taints
      tolerations:
      - key: "dedicated"
        operator: "Equal"
        value: "app-tier"
        effect: "NoSchedule"

      terminationGracePeriodSeconds: 60

      containers:
      - name: mi-app
        image: registry.empresa.com/mi-app:v2.1.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP

        # Recursos — SIEMPRE especificar
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"

        # Health checks
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3

        startupProbe:
          httpGet:
            path: /health/live
            port: 8080
          failureThreshold: 30
          periodSeconds: 10

        # Variables de entorno desde ConfigMap y Secret
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        envFrom:
        - configMapRef:
            name: mi-app-config
        - secretRef:
            name: mi-app-secrets

        # Seguridad
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1000
          capabilities:
            drop: ["ALL"]

        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: config
          mountPath: /etc/app
          readOnly: true

      volumes:
      - name: tmp
        emptyDir: {}
      - name: config
        configMap:
          name: mi-app-config

      imagePullSecrets:
      - name: registry-credentials
```

### Services y Ingress
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mi-app
  namespace: produccion
spec:
  selector:
    app: mi-app
  ports:
  - port: 80
    targetPort: 8080
    name: http
  type: ClusterIP  # ClusterIP | NodePort | LoadBalancer

---
# ingress.yaml — con nginx-ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mi-app
  namespace: produccion
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.empresa.com
    secretName: api-tls
  rules:
  - host: api.empresa.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mi-app
            port:
              name: http
```

### HPA — Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mi-app
  namespace: produccion
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mi-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  # Métricas custom (con KEDA)
  # - type: External
  #   external:
  #     metric:
  #       name: queue_length
  #     target:
  #       type: AverageValue
  #       averageValue: "10"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # esperar 5min antes de escalar hacia abajo
      policies:
      - type: Percent
        value: 20
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Pods
        value: 4
        periodSeconds: 60
```

---

## 3. Configuración y Secretos

```yaml
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: mi-app-config
  namespace: produccion
data:
  LOG_LEVEL: "info"
  DB_HOST: "postgres.produccion.svc.cluster.local"
  DB_PORT: "5432"
  app.yaml: |
    server:
      port: 8080
      timeout: 30s
    cache:
      ttl: 5m

---
# Secret (en producción usar Vault + External Secrets Operator)
apiVersion: v1
kind: Secret
metadata:
  name: mi-app-secrets
  namespace: produccion
type: Opaque
stringData:  # se codifica automáticamente en base64
  DB_PASSWORD: "mi-password-seguro"
  API_KEY: "mi-api-key"
```

```yaml
# External Secrets Operator (Vault como backend)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: mi-app-secrets
  namespace: produccion
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: mi-app-secrets
    creationPolicy: Owner
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: secret/produccion/mi-app
      property: db_password
  - secretKey: API_KEY
    remoteRef:
      key: secret/produccion/mi-app
      property: api_key
```

---

## 4. RBAC y Seguridad

```yaml
# ServiceAccount para la app
apiVersion: v1
kind: ServiceAccount
metadata:
  name: mi-app
  namespace: produccion
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/mi-app-role  # IRSA en EKS

---
# Role — permisos dentro del namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: mi-app-role
  namespace: produccion
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: mi-app-rolebinding
  namespace: produccion
subjects:
- kind: ServiceAccount
  name: mi-app
  namespace: produccion
roleRef:
  kind: Role
  name: mi-app-role
  apiGroup: rbac.authorization.k8s.io
```

```yaml
# PodSecurityPolicy / Pod Security Standards (moderno)
# Aplica el standard "restricted" al namespace
apiVersion: v1
kind: Namespace
metadata:
  name: produccion
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

---

## 5. Operaciones y Debugging

```bash
# kubectl — comandos esenciales para operaciones

# Ver estado del cluster
kubectl get nodes -o wide
kubectl describe node worker-01
kubectl top nodes

# Pods problemáticos
kubectl get pods -A --field-selector=status.phase!=Running,status.phase!=Succeeded
kubectl get pods -A | awk '$4 != "Running" && $4 != "Completed" && NR > 1'

# Debug de un pod
kubectl describe pod mi-app-abc123 -n produccion
kubectl logs mi-app-abc123 -n produccion --previous  # logs del container anterior
kubectl logs -l app=mi-app -n produccion --all-containers --tail=100

# Exec en pod
kubectl exec -it mi-app-abc123 -n produccion -- sh

# Port-forward para debugging
kubectl port-forward svc/mi-app 8080:80 -n produccion
kubectl port-forward pod/mi-app-abc123 5432:5432 -n produccion

# Copiar archivos
kubectl cp produccion/mi-app-abc123:/var/log/app.log ./app-debug.log

# Forzar rollout (si la imagen tiene mismo tag)
kubectl rollout restart deployment/mi-app -n produccion

# Historial y rollback
kubectl rollout history deployment/mi-app -n produccion
kubectl rollout undo deployment/mi-app -n produccion
kubectl rollout undo deployment/mi-app --to-revision=3 -n produccion

# Escalar manualmente
kubectl scale deployment mi-app --replicas=5 -n produccion

# Cordon y drain de nodo (mantenimiento)
kubectl cordon worker-02        # no programar nuevos pods
kubectl drain worker-02 --ignore-daemonsets --delete-emptydir-data --grace-period=60
# (mantenimiento)
kubectl uncordon worker-02

# Eventos del cluster (muy útil para diagnóstico)
kubectl get events -n produccion --sort-by='.lastTimestamp'
kubectl get events -A --field-selector=type=Warning

# Acceso rápido con contextos
kubectl config get-contexts
kubectl config use-context produccion-cluster
kubectx produccion  # con kubectx instalado

# k9s — UI de terminal para Kubernetes
k9s -n produccion
```

---

## 6. Helm — Package Manager

```bash
# Instalar / actualizar un chart
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm search repo bitnami/postgresql

# Instalar con valores personalizados
helm install mi-postgres bitnami/postgresql \
    --namespace produccion \
    --create-namespace \
    -f values/postgres-produccion.yaml \
    --set auth.postgresPassword="${DB_PASSWORD}"

# Ver valores por defecto
helm show values bitnami/postgresql > postgres-defaults.yaml

# Actualizar release
helm upgrade mi-postgres bitnami/postgresql \
    -n produccion \
    -f values/postgres-produccion.yaml \
    --atomic \           # rollback automático si falla
    --cleanup-on-fail \
    --wait

# Historial y rollback
helm history mi-postgres -n produccion
helm rollback mi-postgres 2 -n produccion

# Crear chart propio
helm create mi-app-chart
helm lint mi-app-chart/
helm template mi-app-chart/ | kubectl apply --dry-run=client -f -
helm package mi-app-chart/
helm push mi-app-chart-1.0.0.tgz oci://registry.empresa.com/charts
```

```yaml
# values/produccion.yaml — valores para entorno de producción
replicaCount: 3

image:
  repository: registry.empresa.com/mi-app
  tag: "v2.1.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: nginx
  hosts:
  - host: api.empresa.com
    paths:
    - path: /
      pathType: Prefix

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

postgresql:
  enabled: false
  external:
    host: postgres.produccion.svc.cluster.local
    port: 5432
```

---

## 7. Kustomize — Configuración por Entorno

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patch-replicas.yaml
    └── produccion/
        ├── kustomization.yaml
        ├── patch-replicas.yaml
        └── patch-resources.yaml
```

```yaml
# k8s/overlays/produccion/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: produccion

resources:
- ../../base

images:
- name: mi-app
  newTag: v2.1.0

replicas:
- name: mi-app
  count: 5

patches:
- path: patch-resources.yaml
  target:
    kind: Deployment
    name: mi-app

configMapGenerator:
- name: mi-app-config
  behavior: merge
  literals:
  - LOG_LEVEL=warn
  - ENV=produccion
```

```bash
# Usar Kustomize
kubectl apply -k k8s/overlays/produccion/
kubectl diff -k k8s/overlays/produccion/
kustomize build k8s/overlays/produccion/ | kubectl apply -f -
```

---

## 📝 Laboratorios

1. `lab-01-cluster-local/` — Cluster con kind/k3d + deploy de app
2. `lab-02-rbac/` — RBAC completo con ServiceAccounts
3. `lab-03-hpa-stress/` — HPA con prueba de carga
4. `lab-04-helm-chart/` — Crear y publicar chart propio
5. `lab-05-troubleshooting/` — Diagnosticar cluster roto

## 📌 [Cheatsheet](cheatsheet.md)

# Módulo 11 — DevSecOps

> **Objetivo:** Integrar seguridad en cada fase del ciclo de desarrollo y operaciones

---

## 1. Shift Left Security — Seguridad desde el Principio

```
Desarrollador → Commit → Build → Test → Deploy → Producción
     │            │        │       │        │          │
   Pre-commit   SAST    Dep-Scan  DAST  Container  Runtime
   Secrets      SCA    License   API    Scan       Security
   Linting      IaC    Check     Test   Sign       Monitoring
```

---

## 2. Pre-commit Hooks de Seguridad

```bash
# .pre-commit-config.yaml
repos:
- repo: https://github.com/pre-commit/pre-commit-hooks
  rev: v4.5.0
  hooks:
  - id: check-merge-conflict
  - id: detect-private-key
  - id: detect-aws-credentials

- repo: https://github.com/gitleaks/gitleaks
  rev: v8.18.0
  hooks:
  - id: gitleaks
    args: ['--config', '.gitleaks.toml']

- repo: https://github.com/aquasecurity/tfsec
  rev: v1.28.4
  hooks:
  - id: tfsec

- repo: https://github.com/hadolint/hadolint
  rev: v2.12.0
  hooks:
  - id: hadolint
    args: ['--failure-threshold', 'warning']

# Instalar
pre-commit install
pre-commit run --all-files  # ejecutar en todo el repo
```

```toml
# .gitleaks.toml — reglas personalizadas para detectar secretos
[allowlist]
regexes = [
    "EXAMPLE_KEY",
    "test-placeholder"
]

[[rules]]
description = "AWS Access Key"
id = "aws-access-key"
regex = '''(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}'''
tags = ["key", "AWS"]
severity = "CRITICAL"

[[rules]]
description = "Empresa API Key"
id = "empresa-api-key"
regex = '''empresa_[0-9a-zA-Z]{32,}'''
severity = "HIGH"
```

---

## 3. SAST y SCA en CI/CD

```yaml
# .github/workflows/security.yml
name: Security Scanning

on: [push, pull_request]

jobs:
  sast:
    name: Static Analysis
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    # Semgrep — SAST multi-lenguaje
    - name: Semgrep SAST
      uses: semgrep/semgrep-action@v1
      with:
        config: >-
          p/security-audit
          p/secrets
          p/owasp-top-ten
          p/kubernetes

    # CodeQL — análisis profundo (GitHub)
    - name: Initialize CodeQL
      uses: github/codeql-action/init@v3
      with:
        languages: javascript, python
        queries: security-and-quality

    - name: Perform CodeQL Analysis
      uses: github/codeql-action/analyze@v3

  sca:
    name: Software Composition Analysis
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    # Trivy — vulnerabilidades en dependencias
    - name: Trivy FS scan
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: fs
        scan-ref: .
        vuln-type: library
        severity: CRITICAL,HIGH
        exit-code: 1
        format: sarif
        output: trivy-sca.sarif

    # OWASP Dependency-Check
    - name: OWASP Dependency Check
      uses: dependency-check/Dependency-Check_Action@main
      with:
        project: 'mi-app'
        path: '.'
        format: 'ALL'
        args: >
          --failOnCVSS 7
          --enableRetired

    # Snyk
    - name: Snyk test
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high
```

---

## 4. Container Security

```bash
# Trivy — escaneo comprehensivo de imágenes
trivy image nginx:latest

# Escaneo con formato tabla para CI (falla en CRITICAL)
trivy image \
    --severity CRITICAL,HIGH \
    --exit-code 1 \
    --no-progress \
    mi-app:v2.1.0

# Escaneo de configuración (Dockerfile, K8s manifests)
trivy config .
trivy config --tf-vars terraform.tfvars ./infraestructura/

# Grype — alternativa a Trivy
grype mi-app:v2.1.0
grype dir:.  # escanear filesystem

# Firma y verificación de imágenes con Cosign
# Firmar imagen (después de push)
cosign sign --key cosign.key registry.empresa.com/mi-app:v2.1.0

# Verificar firma
cosign verify --key cosign.pub registry.empresa.com/mi-app:v2.1.0

# SBOM — Software Bill of Materials
syft mi-app:v2.1.0 -o spdx-json > sbom.json
trivy image --format spdx-json --output sbom.json mi-app:v2.1.0

# Política de admisión con Kyverno
# Rechazar imágenes no firmadas
cat << 'EOF' | kubectl apply -f -
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce
  background: false
  rules:
  - name: check-image-signature
    match:
      resources:
        kinds: [Pod]
        namespaces: [produccion]
    verifyImages:
    - imageReferences:
      - "registry.empresa.com/*"
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
              -----END PUBLIC KEY-----
EOF
```

---

## 5. Kubernetes Security

```yaml
# OPA Gatekeeper — políticas de seguridad como código

# ConstraintTemplate: prohibir contenedores privilegiados
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8spspprivilegedcontainer
spec:
  crd:
    spec:
      names:
        kind: K8sPSPPrivilegedContainer
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8spspprivilegedcontainer
      
      violation[{"msg": msg, "details": {}}] {
        c := input_containers[_]
        c.securityContext.privileged
        msg := sprintf("Container privilegiado no permitido: %v", [c.name])
      }
      
      input_containers[c] {
        c := input.review.object.spec.containers[_]
      }
      input_containers[c] {
        c := input.review.object.spec.initContainers[_]
      }

---
# Constraint: aplicar la plantilla
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sPSPPrivilegedContainer
metadata:
  name: psp-privileged-container
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
    namespaces: ["produccion", "staging"]
```

```yaml
# NetworkPolicy — zero-trust networking en K8s
# Denegar todo por defecto
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: produccion
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]

---
# Permitir solo lo necesario para mi-app
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mi-app-netpol
  namespace: produccion
spec:
  podSelector:
    matchLabels:
      app: mi-app
  policyTypes: [Ingress, Egress]
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - port: 5432
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - port: 53    # DNS
      protocol: UDP
    - port: 53
      protocol: TCP
```

---

## 6. Vault — Gestión de Secretos

```bash
# Instalar Vault en K8s con Helm
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
    --namespace vault \
    --create-namespace \
    -f values/vault.yaml

# Configurar Vault
vault auth enable kubernetes
vault write auth/kubernetes/config \
    kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"

# Crear política para mi-app
vault policy write mi-app - << 'EOF'
path "secret/data/produccion/mi-app/*" {
  capabilities = ["read"]
}
path "database/creds/mi-app-role" {
  capabilities = ["read"]
}
EOF

# Vincular ServiceAccount con política
vault write auth/kubernetes/role/mi-app \
    bound_service_account_names=mi-app \
    bound_service_account_namespaces=produccion \
    policies=mi-app \
    ttl=1h

# Database Secrets Engine — credenciales dinámicas para PostgreSQL
vault secrets enable database
vault write database/config/mi-postgres \
    plugin_name=postgresql-database-plugin \
    allowed_roles="mi-app-role" \
    connection_url="postgresql://vault:{{password}}@postgres:5432/appdb" \
    username="vault" \
    password="vault-password"

vault write database/roles/mi-app-role \
    db_name=mi-postgres \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

# Verificar: obtener credencial dinámica
vault read database/creds/mi-app-role
```

---

## 7. Falco — Runtime Security

```yaml
# Falco — detección de comportamiento anómalo en producción
# falco-rules.yaml (reglas personalizadas)

- rule: Escritura en directorio del sistema por contenedor
  desc: Detectar escrituras en /etc, /usr, /bin desde container
  condition: >
    container and open_write and
    (fd.name startswith /etc or
     fd.name startswith /usr/bin or
     fd.name startswith /bin)
  output: >
    Escritura sospechosa en %fd.name
    (user=%user.name container=%container.id image=%container.image.repository)
  priority: WARNING
  tags: [container, filesystem]

- rule: Shell en contenedor de producción
  desc: Detectar ejecución de shell en contenedor
  condition: >
    container and
    (proc.name in (bash, sh, zsh)) and
    not proc.pname in (known_shell_parents) and
    k8s.ns.name = "produccion"
  output: >
    Shell detectado en contenedor de producción
    (user=%user.name container=%container.id image=%container.image.repository
     pod=%k8s.pod.name cmd=%proc.cmdline)
  priority: CRITICAL
  tags: [container, shell, produccion]

- rule: Conexión saliente inesperada
  desc: Contenedor haciendo conexión a IP no esperada
  condition: >
    container and outbound and
    not fd.sip in (allowed_ips) and
    k8s.ns.name = "produccion"
  output: >
    Conexión saliente inesperada: %fd.sip:%fd.sport
    (container=%container.id image=%container.image.repository)
  priority: WARNING
```

---

## 8. Cumplimiento y Auditoría

```bash
# CIS Benchmarks para Kubernetes
kube-bench run --targets master,node,etcd,policies

# CIS Benchmarks para Docker
docker-bench-security

# OpenSCAP — compliance con estándares (PCI-DSS, HIPAA, etc.)
oscap xccdf eval \
    --profile xccdf_org.ssgproject.content_profile_pci-dss \
    --report report.html \
    /usr/share/xml/scap/ssg/content/ssg-rhel9-xccdf.xml

# Auditoría de API de Kubernetes
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Loggear todo a nivel Request
- level: Request
  users: ["system:anonymous"]
  verbs: ["create", "delete", "patch"]
  
# Loggear secrets (sin contenido) 
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets", "configmaps"]

# Loggear modificaciones de RBAC
- level: RequestResponse
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]

# Todo lo demás: solo metadata
- level: Metadata
```

---

## 📝 Proyectos del Módulo

1. **Pipeline seguro completo** — Pre-commit → SAST → SCA → Image Scan → Policy
2. **Vault en K8s** — Secretos dinámicos + rotación automática
3. **Zero-trust en K8s** — NetworkPolicies + Gatekeeper + Falco

## 📌 [Cheatsheet](cheatsheet.md)

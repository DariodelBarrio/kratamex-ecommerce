# Módulo 06 — CI/CD Pipelines

> **Objetivo:** Diseñar e implementar pipelines de entrega continua robustos y seguros

---

## 1. Conceptos Fundamentales

```
Commit → Build → Test → Scan → Push → Deploy Staging → Test E2E → Deploy Prod
  │        │       │      │      │          │               │           │
  │        │       │      │      │          │               │           └─ Smoke Tests
  │        │       │      │      │          │               └─ Integration Tests
  │        │       │      │      │          └─ Health Check + Rollback automático
  │        │       │      │      └─ Container Registry
  │        │       │      └─ SAST + Dependency scan + Container scan
  │        │       └─ Unit + Integration + Coverage
  │        └─ Compilar + Dockerizar
  └─ Trigger del pipeline
```

**Principios clave:**
- **Fast Feedback:** El pipeline debe fallar rápido (test en < 5 min)
- **Idempotencia:** Re-ejecutar un pipeline produce el mismo resultado
- **Trazabilidad:** Cada artefacto está ligado a un commit
- **Rollback:** Siempre hay un mecanismo de vuelta atrás

---

## 2. GitHub Actions — Pipeline Completo

```yaml
# .github/workflows/ci-cd.yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ── Job 1: Tests ─────────────────────────────────────────────────
  test:
    name: Test & Lint
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Lint
      run: npm run lint

    - name: Type check
      run: npm run typecheck

    - name: Unit tests
      run: npm run test:unit -- --coverage
      env:
        DATABASE_URL: postgresql://postgres:testpass@localhost:5432/testdb

    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        token: ${{ secrets.CODECOV_TOKEN }}

  # ── Job 2: Security Scan ──────────────────────────────────────────
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: test
    permissions:
      security-events: write

    steps:
    - uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner (code)
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'

    - name: Upload Trivy results to Security tab
      uses: github/codeql-action/upload-sarif@v3
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'

    - name: Dependency audit
      run: npm audit --audit-level=high

  # ── Job 3: Build & Push Image ─────────────────────────────────────
  build:
    name: Build & Push
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.event_name != 'pull_request'
    permissions:
      contents: read
      packages: write
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
      image-tags: ${{ steps.meta.outputs.tags }}

    steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha,prefix=sha-,format=short

    - name: Build and push
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        build-args: |
          APP_VERSION=${{ github.ref_name }}
          BUILD_DATE=${{ github.event.head_commit.timestamp }}
          GIT_COMMIT=${{ github.sha }}

    - name: Scan built image
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}@${{ steps.build.outputs.digest }}
        format: 'table'
        exit-code: '1'
        severity: 'CRITICAL'

  # ── Job 4: Deploy a Staging ───────────────────────────────────────
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: https://staging.empresa.com

    steps:
    - uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}

    - name: Deploy to staging
      run: |
        IMAGE_TAG=$(echo "${{ needs.build.outputs.image-tags }}" | head -1)
        kubectl set image deployment/mi-app mi-app="${IMAGE_TAG}" -n staging
        kubectl rollout status deployment/mi-app -n staging --timeout=300s

    - name: Run smoke tests
      run: |
        sleep 10
        curl -sf https://staging.empresa.com/health
        curl -sf https://staging.empresa.com/api/status

    - name: Notify on failure
      if: failure()
      uses: slackapi/slack-github-action@v1
      with:
        payload: |
          {"text": "❌ Deploy a staging falló: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

  # ── Job 5: Deploy a Producción ────────────────────────────────────
  deploy-produccion:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    environment:
      name: production
      url: https://api.empresa.com

    steps:
    - uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.PROD_KUBECONFIG }}

    - name: Deploy with canary (10% tráfico)
      run: |
        # Primero deploy canary
        kubectl apply -f k8s/canary/
        kubectl wait --for=condition=available deployment/mi-app-canary -n produccion --timeout=120s

    - name: Monitor canary (5 minutos)
      run: |
        echo "Monitoreando canary durante 5 minutos..."
        # Verificar error rate en Prometheus
        for i in $(seq 1 10); do
          ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query" \
            --data-urlencode 'query=rate(http_requests_total{status=~"5..",deployment="mi-app-canary"}[1m]) / rate(http_requests_total{deployment="mi-app-canary"}[1m])' \
            | jq -r '.data.result[0].value[1] // "0"')
          if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
            echo "Error rate demasiado alto: $ERROR_RATE. Abortando..."
            kubectl delete -f k8s/canary/
            exit 1
          fi
          echo "Minuto $i/10: Error rate OK ($ERROR_RATE)"
          sleep 30
        done

    - name: Promote canary to full rollout
      run: |
        IMAGE_TAG=$(echo "${{ needs.build.outputs.image-tags }}" | grep -E 'v[0-9]' | head -1)
        kubectl set image deployment/mi-app mi-app="${IMAGE_TAG}" -n produccion
        kubectl rollout status deployment/mi-app -n produccion --timeout=300s
        kubectl delete -f k8s/canary/

    - name: Create release notes
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.repos.createRelease({
            owner: context.repo.owner,
            repo: context.repo.repo,
            tag_name: context.ref.replace('refs/tags/', ''),
            generate_release_notes: true
          })
```

---

## 3. GitLab CI — Pipeline Avanzado

```yaml
# .gitlab-ci.yml
stages:
  - test
  - security
  - build
  - staging
  - produccion

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

# Template para jobs con Docker
.docker-template: &docker-template
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

# Template para deploy
.deploy-template: &deploy-template
  image: bitnami/kubectl:latest
  before_script:
    - kubectl config use-context $KUBE_CONTEXT

# ── Tests ──────────────────────────────────────────────────────────
unit-tests:
  stage: test
  image: node:20-alpine
  cache:
    key: "$CI_COMMIT_REF_SLUG"
    paths: [node_modules/]
  script:
    - npm ci
    - npm run test:unit -- --coverage --ci
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
      junit: coverage/junit.xml
    expire_in: 1 week

# ── Security ───────────────────────────────────────────────────────
sast:
  stage: security
  include:
    - template: Security/SAST.gitlab-ci.yml
  variables:
    SAST_EXCLUDED_PATHS: node_modules, dist, coverage

dependency-scan:
  stage: security
  image: node:20-alpine
  script:
    - npm audit --audit-level=high
  allow_failure: false

# ── Build ──────────────────────────────────────────────────────────
build-image:
  <<: *docker-template
  stage: build
  script:
    - |
      docker build \
        --build-arg APP_VERSION=$CI_COMMIT_TAG \
        --build-arg GIT_COMMIT=$CI_COMMIT_SHORT_SHA \
        --cache-from $IMAGE \
        --tag $IMAGE \
        --tag $CI_REGISTRY_IMAGE:latest \
        .
    - docker push $IMAGE
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
    - tags

# ── Staging ────────────────────────────────────────────────────────
deploy-staging:
  <<: *deploy-template
  stage: staging
  variables:
    KUBE_CONTEXT: staging-cluster
  script:
    - kubectl set image deployment/mi-app mi-app=$IMAGE -n staging
    - kubectl rollout status deployment/mi-app -n staging --timeout=300s
  environment:
    name: staging
    url: https://staging.empresa.com
  only:
    - main

# ── Producción ─────────────────────────────────────────────────────
deploy-produccion:
  <<: *deploy-template
  stage: produccion
  variables:
    KUBE_CONTEXT: prod-cluster
  script:
    - kubectl set image deployment/mi-app mi-app=$IMAGE -n produccion
    - kubectl rollout status deployment/mi-app -n produccion --timeout=300s
  environment:
    name: production
    url: https://api.empresa.com
  when: manual   # requiere aprobación manual
  only:
    - tags
```

---

## 4. ArgoCD — GitOps Continuo

```yaml
# argocd-app.yaml — Application en ArgoCD
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: mi-app
  namespace: argocd
  finalizers:
  - resources-finalizer.argocd.argoproj.io
spec:
  project: produccion

  source:
    repoURL: https://github.com/empresa/k8s-configs
    targetRevision: HEAD
    path: apps/mi-app/overlays/produccion

  destination:
    server: https://kubernetes.default.svc
    namespace: produccion

  syncPolicy:
    automated:
      prune: true        # eliminar recursos no en Git
      selfHeal: true     # corregir drift manual
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
    - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  # Ignorar diferencias (campo gestionado por otro controlador)
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas  # ignoramos replicas (gestionado por HPA)
```

```bash
# ArgoCD CLI
argocd app get mi-app
argocd app sync mi-app
argocd app sync mi-app --strategy=hook
argocd app diff mi-app
argocd app rollback mi-app 2
argocd app history mi-app

# Refresh manual
argocd app get mi-app --refresh

# Actualizar imagen (triggear deploy)
argocd image updater \
    --annotations 'argocd-image-updater.argoproj.io/image-list: mi-app=registry.empresa.com/mi-app' \
    --update-strategy digest
```

---

## 5. Mejores Prácticas de CI/CD

```bash
# Feature flags con LaunchDarkly / Unleash
# Permite deployar código desacoplado del release

# Semantic versioning automático
# Conventional Commits → semver automático
# feat: → minor bump
# fix: → patch bump
# BREAKING CHANGE: → major bump

# Ejemplo con semantic-release
cat > .releaserc.json << 'EOF'
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    ["@semantic-release/exec", {
      "publishCmd": "docker build -t mi-app:${nextRelease.version} . && docker push mi-app:${nextRelease.version}"
    }],
    "@semantic-release/github",
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"]
    }]
  ]
}
EOF

# Pruebas de contrato (contract testing)
# Pact para microservicios
npm test -- --testPathPattern=pact

# Test de carga en staging antes de producción
k6 run --vus=50 --duration=2m scripts/load-test.js
```

---

## 📝 Proyectos del Módulo

1. **Pipeline completo en GitHub Actions** — desde commit a producción con canary
2. **GitOps con ArgoCD** — sincronización automática desde Git
3. **Pipeline multi-repo** — app + infraestructura como código coordinados

## 📌 [Cheatsheet](cheatsheet.md)

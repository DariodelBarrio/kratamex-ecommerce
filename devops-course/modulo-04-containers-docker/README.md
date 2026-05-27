# Módulo 04 — Containers & Docker

> **Objetivo:** Dominar contenedores desde los fundamentos hasta producción

---

## 1. Internals: Cómo Funcionan los Contenedores

Los contenedores NO son VMs. Son procesos aislados usando primitivas del kernel Linux:

```
┌─────────────────────────────────────────┐
│          Proceso del Container          │
├─────────────────────────────────────────┤
│  Namespaces (aislamiento)               │
│  ├─ pid      → procesos aislados        │
│  ├─ net      → red aislada              │
│  ├─ mnt      → filesystem aislado       │
│  ├─ uts      → hostname aislado         │
│  ├─ ipc      → IPC aislado              │
│  └─ user     → usuarios aislados        │
├─────────────────────────────────────────┤
│  cgroups (límites de recursos)          │
│  ├─ cpu, memory, blkio, net_cls         │
├─────────────────────────────────────────┤
│  Union Filesystem (overlay2)            │
│  ├─ Capas de imagen (solo lectura)      │
│  └─ Capa del container (escritura)      │
└─────────────────────────────────────────┘
```

```bash
# Verificar las primitivas en acción
# Namespaces de un container en ejecución
CID=$(docker run -d nginx)
PID=$(docker inspect --format '{{.State.Pid}}' $CID)
ls -la /proc/$PID/ns/

# Ver cgroups del container
cat /sys/fs/cgroup/system.slice/docker-${CID}.scope/memory.current
cat /sys/fs/cgroup/system.slice/docker-${CID}.scope/cpu.stat

# Union filesystem — capas de la imagen
docker inspect nginx | jq '.[0].GraphDriver'
ls /var/lib/docker/overlay2/
```

---

## 2. Dockerfiles Optimizados

### Multi-stage build (el patrón más importante)
```dockerfile
# Dockerfile para app Go — imagen final < 10MB
# ── Stage 1: Build ─────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app
# Copiar y cachear dependencias PRIMERO
COPY go.mod go.sum ./
RUN go mod download

# Construir binario
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s -X main.version=$(cat VERSION)" \
    -o /bin/server ./cmd/server

# ── Stage 2: Runtime ───────────────────────────
FROM scratch
# Certificados CA para llamadas HTTPS
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Usuario sin privilegios (desde scratch)
COPY --from=builder /etc/passwd /etc/passwd
USER nobody

COPY --from=builder /bin/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

```dockerfile
# Dockerfile para Node.js — optimizado para cache
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Crear usuario no-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --chown=nextjs:nodejs package.json .

USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "dist/index.js"]
```

### Mejores prácticas en Dockerfiles
```dockerfile
# ✅ DO: Un proceso por container
# ✅ DO: COPY específico (nunca COPY . . en producción sin .dockerignore)
# ✅ DO: Capas ordenadas: raro → frecuente (cache efficiency)
# ✅ DO: Imagen base oficial y específica (node:20.10.0-alpine, no node:latest)
# ✅ DO: Usar HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# ✅ DO: Variables de configuración via ENV/ARG
ARG APP_VERSION=unknown
ENV APP_VERSION=$APP_VERSION

# ❌ NO: apt-get sin versión fija
# ❌ NO: secretos en Dockerfile (incluso en capas borradas)
# ❌ NO: root como usuario final
# ❌ NO: curl | bash en RUN
```

```bash
# .dockerignore (tan importante como .gitignore)
cat > .dockerignore << 'EOF'
.git
.gitignore
.env
.env.*
node_modules
npm-debug.log
Dockerfile*
docker-compose*
.dockerignore
dist
build
coverage
*.test.*
README.md
docs/
EOF
```

---

## 3. Docker Compose para Desarrollo y Staging

```yaml
# docker-compose.yml — Stack completo de desarrollo
version: "3.9"

networks:
  frontend:
  backend:
  monitoring:

volumes:
  postgres_data:
  redis_data:
  prometheus_data:

services:
  # ── Aplicación ─────────────────────────────────────────────────
  app:
    build:
      context: .
      target: runner   # stage del multi-stage
      args:
        APP_VERSION: ${VERSION:-dev}
    image: mi-app:${VERSION:-dev}
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://app:${DB_PASSWORD}@postgres:5432/appdb
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: ${LOG_LEVEL:-info}
    env_file:
      - .env.local
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - frontend
      - backend
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    volumes:
      - ./logs:/app/logs

  # ── Base de Datos ───────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/db/init:/docker-entrypoint-initdb.d
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d appdb"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Cache ────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Observabilidad ───────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - monitoring
      - backend
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - monitoring
    restart: unless-stopped
```

```bash
# Comandos docker-compose esenciales
docker compose up -d                          # levantar en background
docker compose up -d --build app              # reconstruir solo la app
docker compose down -v                        # destruir todo incluyendo volúmenes
docker compose logs -f app                    # seguir logs
docker compose exec app sh                    # shell en container
docker compose ps                             # estado de servicios
docker compose top                            # procesos en cada container
docker compose config                         # ver config interpolada

# Escalar un servicio
docker compose up -d --scale app=3
```

---

## 4. Seguridad en Containers

```bash
# Escaneo de vulnerabilidades con Trivy
trivy image nginx:latest
trivy image --severity HIGH,CRITICAL mi-app:v1.0
trivy fs .                          # escanear filesystem/código
trivy config .                      # escanear Dockerfiles, k8s manifests

# Docker Bench Security (CIS Benchmarks)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v /etc:/etc:ro -v /usr/lib/systemd:/usr/lib/systemd:ro \
    docker/docker-bench-security

# Ejecutar container sin privilegios
docker run --rm \
    --user 1000:1000 \
    --read-only \
    --tmpfs /tmp \
    --cap-drop ALL \
    --cap-add NET_BIND_SERVICE \
    --security-opt no-new-privileges \
    --security-opt seccomp=seccomp-profile.json \
    mi-app:latest

# Secrets en Docker (sin docker swarm)
# Nunca pasar secretos como ENV en producción
# Usar Docker Secrets o montar desde Vault
echo "mi-secreto" | docker secret create db_password -

# AppArmor / seccomp profiles
docker run --security-opt apparmor=docker-nginx nginx

# Limitar syscalls con seccomp personalizado
# Ver perfil default y crear uno más restrictivo
docker run --rm --security-opt seccomp=/path/to/profile.json mi-app
```

---

## 5. Docker Registry

```bash
# Registry privado
docker run -d \
    -p 5000:5000 \
    --name registry \
    -v /opt/registry:/var/lib/registry \
    -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/server.crt \
    -e REGISTRY_HTTP_TLS_KEY=/certs/server.key \
    -e REGISTRY_AUTH=htpasswd \
    -e REGISTRY_AUTH_HTPASSWD_REALM="Registry Realm" \
    -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd \
    registry:2

# Tagging y push
docker tag mi-app:v1.0 registry.empresa.com/team/mi-app:v1.0
docker push registry.empresa.com/team/mi-app:v1.0

# Listar imágenes en registry
curl -s https://registry.empresa.com/v2/_catalog | jq .
curl -s https://registry.empresa.com/v2/team/mi-app/tags/list | jq .

# Limpiar imágenes no usadas
docker image prune -a --filter "until=720h"
docker system prune -a -f --volumes
```

---

## 6. Debugging de Containers

```bash
# Entrar a container en ejecución
docker exec -it container-id sh
docker exec -it --user root container-id sh  # como root

# Debug de imagen sin entrypoint
docker run --rm -it --entrypoint sh mi-app:latest

# Container sin red (debug de filesystem)
docker run --rm -it --network none mi-app:latest sh

# Copiar archivos
docker cp container-id:/etc/nginx/nginx.conf ./nginx-debug.conf

# Ver eventos en tiempo real
docker events --filter container=mi-container

# Estadísticas de recursos
docker stats --no-stream

# Inspección profunda
docker inspect container-id | jq '.[0] | {
    pid: .State.Pid,
    ip: .NetworkSettings.IPAddress,
    mounts: .Mounts,
    env: .Config.Env
}'

# nsenter — entrar al namespace sin exec
PID=$(docker inspect --format '{{.State.Pid}}' mi-container)
nsenter -t $PID -m -u -i -n -p -- sh

# kubectl debug (Kubernetes)
kubectl debug -it mi-pod --image=busybox --target=mi-container
kubectl debug node/worker-01 -it --image=ubuntu
```

---

## 📝 Laboratorios

1. `lab-01-dockerfile-optimizado/` — Optimizar imagen Node.js de 800MB a <100MB
2. `lab-02-compose-stack/` — Stack completo con app + BD + cache + monitoreo
3. `lab-03-seguridad/` — Hardening de container con seccomp y AppArmor
4. `lab-04-registry/` — Registry privado con autenticación
5. `lab-05-debugging/` — Diagnosticar un container roto

## 📌 [Cheatsheet](cheatsheet.md)

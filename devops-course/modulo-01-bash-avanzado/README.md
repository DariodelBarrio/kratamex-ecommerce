# Módulo 01 — Bash Scripting Avanzado

> **Prerequisito:** Conoces loops, pipes y redirección básica  
> **Objetivo:** Dominar Bash para automatización de infraestructura real

---

## 1. Tipos de Datos y Arrays

```bash
# Arrays indexados
declare -a servidores=("web-01" "web-02" "db-01")
for s in "${servidores[@]}"; do
    ping -c1 "$s" &>/dev/null && echo "$s OK" || echo "$s FAIL"
done

# Arrays asociativos (mapas)
declare -A config=(
    [host]="10.0.0.1"
    [puerto]="5432"
    [usuario]="admin"
)
echo "Conectando a ${config[host]}:${config[puerto]}"

# Slicing de arrays
echo "${servidores[@]:1:2}"   # elementos 1 y 2
echo "${#servidores[@]}"       # longitud del array
```

---

## 2. Procesamiento de Strings

```bash
# Expansión de parámetros
archivo="/var/log/nginx/access.log"
echo "${archivo##*/}"      # access.log        (basename)
echo "${archivo%/*}"       # /var/log/nginx    (dirname)
echo "${archivo%.log}"     # ...access         (quitar extensión)
echo "${archivo^^}"        # TODO MAYÚSCULAS
echo "${archivo,,}"        # todo minúsculas

# Sustitución en strings
texto="servidor-produccion-01"
echo "${texto/produccion/staging}"    # reemplaza primera ocurrencia
echo "${texto//0/X}"                  # reemplaza todas las ocurrencias

# Longitud y substrings
nombre="kubernetes"
echo "${#nombre}"          # 10
echo "${nombre:0:4}"       # kube
echo "${nombre: -4}"       # etes

# Valores por defecto
echo "${ENV:-development}"         # usa development si ENV está vacía
echo "${PUERTO:=8080}"             # asigna 8080 si PUERTO no está definida
echo "${DB_HOST:?"DB_HOST requerida"}"  # error si no está definida
```

---

## 3. Funciones Avanzadas

```bash
#!/usr/bin/env bash
# Mejores prácticas para funciones en scripts de infra

# Función con retorno de valor (via stdout)
get_container_ip() {
    local container_name="$1"
    docker inspect \
        --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' \
        "$container_name" 2>/dev/null
}

# Función con código de retorno explícito
check_port() {
    local host="$1" port="$2" timeout="${3:-3}"
    timeout "$timeout" bash -c ">/dev/tcp/$host/$port" 2>/dev/null
    return $?
}

# Función variádica
log() {
    local level="${1^^}"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%dT%H:%M:%S%z')
    printf '[%s] [%s] %s\n' "$timestamp" "$level" "$message" >&2
}

# Uso:
log "info"  "Iniciando despliegue v${VERSION}"
log "error" "Falló la conexión a ${DB_HOST}:${DB_PORT}"

# Función con opciones usando getopts
deploy() {
    local env="" version="" dry_run=0

    while getopts "e:v:n" opt; do
        case $opt in
            e) env="$OPTARG" ;;
            v) version="$OPTARG" ;;
            n) dry_run=1 ;;
            *) echo "Uso: deploy -e <env> -v <version> [-n]" >&2; return 1 ;;
        esac
    done

    [[ -z "$env" || -z "$version" ]] && {
        echo "Error: -e y -v son obligatorios" >&2
        return 1
    }

    if (( dry_run )); then
        echo "[DRY-RUN] Desplegaría $version en $env"
    else
        echo "Desplegando $version en $env..."
    fi
}
```

---

## 4. Control de Flujo Avanzado

```bash
# Pattern matching en case
clasificar_archivo() {
    local file="$1"
    case "${file,,}" in
        *.tar.gz|*.tgz)    echo "tarball comprimido" ;;
        *.zip)              echo "zip archive" ;;
        *.yaml|*.yml)       echo "YAML config" ;;
        *.json)             echo "JSON file" ;;
        Dockerfile*)        echo "Dockerfile" ;;
        *)                  echo "archivo desconocido" ;;
    esac
}

# While con IFS para parsear CSV
while IFS=',' read -r host port service; do
    echo "Revisando $service en $host:$port"
    check_port "$host" "$port" || echo "⚠️  $service no responde"
done < servicios.csv

# Condicionales avanzadas
[[ -v VAR ]]          # VAR está declarada (aunque esté vacía)
[[ -z "$VAR" ]]       # VAR está vacía o no declarada
[[ "$a" =~ ^[0-9]+$ ]] # regex match
(( a > b ))           # comparación aritmética

# Subshells y grupos de comandos
(cd /tmp && ls)        # subshell — no cambia el directorio del padre
{ cd /tmp; ls; }       # grupo — SÍ afecta el directorio del padre (¡cuidado!)
```

---

## 5. Manejo de Errores y Señales

```bash
#!/usr/bin/env bash
set -euo pipefail  # El trío sagrado para scripts robustos
# -e: sale al primer error
# -u: error si variable no definida
# -o pipefail: error si cualquier parte de un pipe falla

# Trap: limpieza garantizada
TMPDIR_TRABAJO=""

cleanup() {
    local exit_code=$?
    [[ -n "$TMPDIR_TRABAJO" && -d "$TMPDIR_TRABAJO" ]] && rm -rf "$TMPDIR_TRABAJO"
    log "info" "Script finalizado con código: $exit_code"
    exit "$exit_code"
}
trap cleanup EXIT
trap 'log "error" "Señal SIGINT recibida"; exit 130' INT
trap 'log "warn" "Señal SIGTERM recibida"; exit 143' TERM

TMPDIR_TRABAJO=$(mktemp -d)

# Error handling explícito
run_migration() {
    local db_url="$1"
    if ! psql "$db_url" -f migration.sql; then
        log "error" "Migración fallida para $db_url"
        # Notificar a Slack, PagerDuty, etc.
        notify_oncall "DB migration failed on $db_url"
        return 1
    fi
}

# Retry con backoff exponencial
retry() {
    local max_attempts="${1}" delay="${2}" cmd=("${@:3}")
    local attempt=1

    until "${cmd[@]}"; do
        (( attempt >= max_attempts )) && {
            log "error" "Comando falló después de $max_attempts intentos: ${cmd[*]}"
            return 1
        }
        log "warn" "Intento $attempt falló. Reintentando en ${delay}s..."
        sleep "$delay"
        delay=$(( delay * 2 ))
        (( attempt++ ))
    done
}

# Uso:
retry 5 2 curl -sf "https://api.ejemplo.com/health"
```

---

## 6. Procesamiento de Texto (awk, sed, jq)

```bash
# AWK para análisis de logs
# Extraer IPs con más de 100 requests en access.log
awk '{print $1}' /var/log/nginx/access.log \
    | sort | uniq -c | sort -rn \
    | awk '$1 > 100 {print $2, $1, "requests"}'

# AWK para procesar salida de kubectl
kubectl get pods -A --no-headers \
    | awk '$4 != "Running" && $4 != "Completed" {
        printf "⚠️  %s/%s está en estado %s\n", $1, $2, $4
      }'

# SED avanzado
# Reemplazar en múltiples archivos (in-place)
find . -name "*.yaml" -exec sed -i 's/image: myapp:.*/image: myapp:v2.1.0/g' {} +

# Extraer bloque entre marcadores
sed -n '/^# BEGIN CONFIG/,/^# END CONFIG/p' config.sh

# JQ para APIs y Kubernetes
# Listar todos los containers y sus imágenes en un namespace
kubectl get pods -n produccion -o json \
    | jq -r '.items[].spec.containers[] | "\(.name): \(.image)"'

# Filtrar logs de CloudWatch/JSON estructurado
cat app.log | jq -r 'select(.level == "ERROR") | "\(.timestamp) \(.message)"'

# Transformar JSON para Terraform variables
aws ec2 describe-instances \
    | jq -r '.Reservations[].Instances[] | select(.State.Name == "running") | 
        {id: .InstanceId, ip: .PrivateIpAddress, type: .InstanceType}' \
    | jq -s '.'
```

---

## 7. Concurrencia en Bash

```bash
#!/usr/bin/env bash
# Paralelización controlada con semáforos

MAX_WORKERS=5
semaforo() {
    while (( $(jobs -r | wc -l) >= MAX_WORKERS )); do
        sleep 0.1
    done
}

check_host() {
    local host="$1"
    if ping -c1 -W2 "$host" &>/dev/null; then
        echo "✅ $host"
    else
        echo "❌ $host"
    fi
}

hosts=($(cat hosts.txt))
for host in "${hosts[@]}"; do
    semaforo
    check_host "$host" &
done
wait  # esperar a que terminen todos los jobs en background

# Con GNU Parallel (más robusto)
cat hosts.txt | parallel -j20 'ping -c1 -W2 {} &>/dev/null && echo "✅ {}" || echo "❌ {}"'

# Pipe a múltiples comandos simultáneos (tee)
curl -s "https://api.ejemplo.com/datos" \
    | tee >(jq '.errores[]' >> errors.log) \
           >(jq '.metricas' | ./procesar_metricas.sh) \
    | jq '.total'
```

---

## 8. Script de Producción: Ejemplo Completo

```bash
#!/usr/bin/env bash
# deploy.sh — Script de despliegue production-grade
set -euo pipefail

# ── Constantes ─────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="/var/log/deployments/$(date +%Y%m%d_%H%M%S).log"

# ── Configuración ──────────────────────────────────────────────────────────
: "${APP_NAME:?La variable APP_NAME es requerida}"
: "${ENVIRONMENT:?La variable ENVIRONMENT es requerida}"
: "${VERSION:?La variable VERSION es requerida}"
: "${KUBECONFIG:?La variable KUBECONFIG es requerida}"

SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-15}"

# ── Logging ────────────────────────────────────────────────────────────────
log() {
    local level="$1"; shift
    printf '[%s] [%-5s] %s\n' "$(date -Iseconds)" "$level" "$*" | tee -a "$LOG_FILE" >&2
}
info()  { log INFO  "$@"; }
warn()  { log WARN  "$@"; }
error() { log ERROR "$@"; }

# ── Notificaciones ─────────────────────────────────────────────────────────
notify() {
    local status="$1" message="$2"
    [[ -z "$SLACK_WEBHOOK" ]] && return 0
    local color
    color=$([[ "$status" == "success" ]] && echo "good" || echo "danger")
    curl -sf -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        -d "{\"attachments\":[{\"color\":\"$color\",\"text\":\"$message\"}]}" \
        || warn "No se pudo enviar notificación Slack"
}

# ── Limpieza ───────────────────────────────────────────────────────────────
PREVIOUS_VERSION=""
cleanup() {
    local exit_code=$?
    if (( exit_code != 0 )) && [[ "$ROLLBACK_ON_FAILURE" == "true" ]] && [[ -n "$PREVIOUS_VERSION" ]]; then
        warn "Fallo detectado. Iniciando rollback a $PREVIOUS_VERSION..."
        kubectl set image deployment/"$APP_NAME" \
            "$APP_NAME=${APP_NAME}:${PREVIOUS_VERSION}" \
            -n "$ENVIRONMENT" || error "¡Rollback también falló!"
        notify "failure" "❌ Deploy de $APP_NAME:$VERSION falló. Rollback a $PREVIOUS_VERSION iniciado."
    fi
}
trap cleanup EXIT

# ── Health Check ───────────────────────────────────────────────────────────
wait_for_rollout() {
    local deployment="$1" namespace="$2"
    info "Esperando rollout de $deployment..."
    
    if ! kubectl rollout status deployment/"$deployment" \
        -n "$namespace" \
        --timeout=300s; then
        error "Timeout esperando rollout de $deployment"
        return 1
    fi

    local attempt=1
    while (( attempt <= HEALTH_CHECK_RETRIES )); do
        local ready
        ready=$(kubectl get deployment "$deployment" -n "$namespace" \
            -o jsonpath='{.status.readyReplicas}')
        local desired
        desired=$(kubectl get deployment "$deployment" -n "$namespace" \
            -o jsonpath='{.spec.replicas}')
        
        if [[ "$ready" == "$desired" ]]; then
            info "✅ $deployment: $ready/$desired réplicas listas"
            return 0
        fi
        
        warn "Intento $attempt/$HEALTH_CHECK_RETRIES: $ready/$desired réplicas listas"
        sleep "$HEALTH_CHECK_INTERVAL"
        (( attempt++ ))
    done
    
    error "Health check falló después de $HEALTH_CHECK_RETRIES intentos"
    return 1
}

# ── Main ───────────────────────────────────────────────────────────────────
main() {
    info "=== Iniciando deploy: $APP_NAME:$VERSION en $ENVIRONMENT ==="
    
    # Guardar versión anterior para posible rollback
    PREVIOUS_VERSION=$(kubectl get deployment "$APP_NAME" -n "$ENVIRONMENT" \
        -o jsonpath='{.spec.template.spec.containers[0].image}' \
        | cut -d: -f2)
    info "Versión anterior: $PREVIOUS_VERSION"

    # Actualizar imagen
    info "Actualizando imagen a $VERSION..."
    kubectl set image deployment/"$APP_NAME" \
        "$APP_NAME=${APP_NAME}:${VERSION}" \
        -n "$ENVIRONMENT"

    # Esperar y verificar
    wait_for_rollout "$APP_NAME" "$ENVIRONMENT"
    
    info "=== ✅ Deploy completado exitosamente ==="
    notify "success" "✅ Deploy de $APP_NAME:$VERSION a $ENVIRONMENT completado"
}

main "$@"
```

---

## 📝 Laboratorios

Ver [`labs/`](labs/) para ejercicios prácticos:
1. `lab-01-arrays-strings.sh` — Manipulación avanzada de datos
2. `lab-02-funciones-getopts.sh` — CLI con opciones
3. `lab-03-error-handling.sh` — Scripts robustos con traps
4. `lab-04-concurrencia.sh` — Paralelización controlada
5. `lab-05-deploy-script.sh` — Script de deploy real

## 📌 Cheatsheet

Ver [`cheatsheet.md`](cheatsheet.md)

# Módulo 02 — Redes Avanzadas para DevOps

> **Prerequisito:** Modelo OSI, subnetting, TCP/IP básico  
> **Objetivo:** Dominar redes desde la perspectiva de infraestructura y diagnóstico

---

## 1. Diagnóstico de Redes con Herramientas Avanzadas

### ss / netstat (conexiones y sockets)
```bash
# Todas las conexiones TCP activas con PID
ss -tulnp

# Conexiones ESTABLISHED al puerto 443
ss -tnp state established '( dport = :443 or sport = :443 )'

# Ver backlog de conexiones (útil para debugging de carga)
ss -lnt

# Estadísticas por protocolo
ss -s

# Conexiones por proceso (requiere root para otros procesos)
ss -tulnpe
```

### tcpdump — Captura de paquetes
```bash
# Captura básica en interfaz
tcpdump -i eth0 -n

# Filtrar por host y puerto
tcpdump -i any host 10.0.0.5 and port 5432 -n

# Guardar captura para Wireshark
tcpdump -i eth0 -w captura.pcap -C 100  # -C: max 100MB por archivo

# Ver handshake TCP (SYN, SYN-ACK, ACK)
tcpdump -i eth0 'tcp[tcpflags] & (tcp-syn|tcp-fin) != 0' -n

# Captura de DNS
tcpdump -i eth0 port 53 -n -v

# Debugging HTTP (sin TLS)
tcpdump -i eth0 -A -s 0 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)'
```

### ip — Gestión de interfaces y rutas
```bash
# Ver interfaces con estadísticas
ip -s link show

# Ver tabla de rutas
ip route show table all

# Añadir ruta específica
ip route add 192.168.100.0/24 via 10.0.0.1 dev eth0

# Política de enrutamiento (policy routing)
ip rule add from 10.0.1.0/24 table 100
ip route add default via 10.0.1.1 table 100

# Namespaces de red (base de containers)
ip netns add test-ns
ip netns exec test-ns ip link show
ip netns exec test-ns bash  # shell en el namespace

# Crear par veth (virtual ethernet)
ip link add veth0 type veth peer name veth1
ip link set veth1 netns test-ns
ip addr add 192.168.99.1/30 dev veth0
ip netns exec test-ns ip addr add 192.168.99.2/30 dev veth1
ip link set veth0 up
ip netns exec test-ns ip link set veth1 up
```

---

## 2. DNS Profundo

### Resolución y diagnóstico
```bash
# dig — La herramienta definitiva de DNS
dig google.com A +short
dig google.com MX
dig google.com ANY

# Consulta a servidor específico
dig @8.8.8.8 google.com A

# Traza completa de resolución (delegation path)
dig +trace google.com A

# Reverse DNS
dig -x 8.8.8.8

# DNSSEC
dig google.com A +dnssec +multiline

# Ver TTL y flags
dig google.com A +ttlunits

# delv — verificación DNSSEC
delv @8.8.8.8 google.com A +rtrace

# Diagnóstico de problemas de DNS en containers/k8s
kubectl exec -it debug-pod -- nslookup kubernetes.default.svc.cluster.local
kubectl exec -it debug-pod -- dig @10.96.0.10 kubernetes.default.svc.cluster.local
```

### Configuración de resolv.conf
```
# /etc/resolv.conf optimizado
nameserver 1.1.1.1
nameserver 8.8.8.8
search prod.empresa.local empresa.local
options ndots:2 timeout:2 attempts:3 rotate
```

### CoreDNS (Kubernetes)
```yaml
# ConfigMap de CoreDNS con reenvío personalizado
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health {
           lameduck 5s
        }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        # Reenviar dominio interno a DNS corporativo
        empresa.local:53 {
           forward . 10.0.0.53
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
```

---

## 3. TLS/SSL en Profundidad

```bash
# Inspeccionar certificado de un servidor
openssl s_client -connect ejemplo.com:443 -servername ejemplo.com 2>/dev/null \
    | openssl x509 -noout -text

# Ver fechas de expiración (útil en scripts de monitoreo)
echo | openssl s_client -connect ejemplo.com:443 -servername ejemplo.com 2>/dev/null \
    | openssl x509 -noout -dates

# Verificar cadena de certificados
openssl s_client -connect ejemplo.com:443 -showcerts 2>/dev/null

# Comprobar si cert expira en menos de 30 días
check_cert_expiry() {
    local host="$1" port="${2:-443}"
    local days_left
    days_left=$(echo | openssl s_client -connect "$host:$port" -servername "$host" 2>/dev/null \
        | openssl x509 -noout -enddate \
        | sed 's/notAfter=//' \
        | xargs -I{} date -d "{}" +%s \
        | xargs -I{} bash -c 'echo $(( ({} - $(date +%s)) / 86400 ))')
    
    if (( days_left < 30 )); then
        echo "⚠️  ALERTA: $host expira en $days_left días"
        return 1
    fi
    echo "✅ $host: $days_left días restantes"
}

# Generar certificado auto-firmado para desarrollo
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout server.key -out server.crt \
    -subj "/C=ES/ST=Madrid/L=Madrid/O=DevOps/CN=*.local.dev" \
    -addext "subjectAltName=DNS:*.local.dev,DNS:localhost,IP:127.0.0.1"

# Crear CA interna para laboratorio
# 1. Crear CA key y certificado
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
    -out ca.crt -subj "/CN=DevOps Lab CA"

# 2. Crear CSR para servidor
openssl req -new -newkey rsa:2048 -nodes \
    -keyout servidor.key -out servidor.csr \
    -subj "/CN=*.lab.local"

# 3. Firmar con CA
openssl x509 -req -in servidor.csr -CA ca.crt -CAkey ca.key \
    -CAcreateserial -out servidor.crt -days 365 -sha256
```

---

## 4. Firewalls y iptables / nftables

```bash
# iptables — reglas de firewall
# Ver reglas actuales
iptables -L -n -v --line-numbers

# Permitir tráfico entrante a puerto 443
iptables -A INPUT -p tcp --dport 443 -m conntrack --ctstate NEW,ESTABLISHED -j ACCEPT
iptables -A OUTPUT -p tcp --sport 443 -m conntrack --ctstate ESTABLISHED -j ACCEPT

# Rate limiting (protección contra DDoS básico)
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
    -m recent --set --name SSH
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \
    -m recent --update --seconds 60 --hitcount 10 --name SSH -j DROP

# NAT/Masquerade para routing
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
echo 1 > /proc/sys/net/ipv4/ip_forward

# nftables (moderno — reemplaza iptables)
nft list ruleset

# Regla básica con nftables
nft add table inet filter
nft add chain inet filter input  { type filter hook input priority 0 \; policy drop \; }
nft add rule inet filter input ct state established,related accept
nft add rule inet filter input tcp dport {22, 80, 443} accept
nft add rule inet filter input iif lo accept
```

---

## 5. Redes de Contenedores

### Docker Networking
```bash
# Tipos de red en Docker
docker network ls
# bridge (default), host, none, overlay (Swarm), macvlan

# Crear red personalizada con subnet
docker network create \
    --driver bridge \
    --subnet 172.20.0.0/16 \
    --ip-range 172.20.240.0/20 \
    --gateway 172.20.0.1 \
    mi-red

# Inspeccionar red
docker network inspect mi-red | jq '.[0].Containers'

# Conectar container a múltiples redes
docker network connect mi-red contenedor-existente

# Debug: entrar al namespace de red de un container
PID=$(docker inspect --format '{{.State.Pid}}' mi-container)
nsenter -t $PID -n ip addr show
nsenter -t $PID -n ss -tulnp
```

### CNI en Kubernetes
```bash
# Ver CNI configurado
kubectl get nodes -o wide
ls /etc/cni/net.d/

# Calico — Diagnóstico
kubectl exec -n kube-system -it $(kubectl get po -n kube-system -l k8s-app=calico-node -o name | head -1) \
    -- calicoctl node status

# Verificar conectividad pod-to-pod
kubectl exec -it pod-a -- ping pod-b-ip
kubectl exec -it pod-a -- curl -v http://servicio-b:8080/health

# Network Policies — debug
kubectl describe networkpolicy -n produccion
# Herramienta: network-policy-viewer
```

---

## 6. Load Balancers y Reverse Proxies

### Nginx como reverse proxy de alto rendimiento
```nginx
# /etc/nginx/nginx.conf — Configuración optimizada
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 65535;
    use epoll;
    multi_accept on;
}

http {
    # Conexiones keepalive al upstream
    upstream backend {
        least_conn;  # o ip_hash, random, etc.
        keepalive 32;
        
        server 10.0.0.10:8080 weight=3 max_fails=3 fail_timeout=30s;
        server 10.0.0.11:8080 weight=2 max_fails=3 fail_timeout=30s;
        server 10.0.0.12:8080 backup;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

    server {
        listen 443 ssl http2;
        server_name api.ejemplo.com;

        ssl_certificate     /etc/ssl/certs/api.crt;
        ssl_certificate_key /etc/ssl/private/api.key;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            
            proxy_connect_timeout 5s;
            proxy_read_timeout 60s;
            
            # Health check pasivo
            proxy_next_upstream error timeout http_500 http_502 http_503;
        }
    }
}
```

---

## 7. Herramientas de Diagnóstico Avanzadas

```bash
# MTR — traceroute + ping combinados
mtr --report --report-cycles 100 8.8.8.8

# iperf3 — benchmark de ancho de banda
# Servidor:
iperf3 -s -p 5201
# Cliente:
iperf3 -c 10.0.0.5 -p 5201 -t 30 -P 4  # 4 streams paralelos

# hping3 — ping avanzado y generación de paquetes
hping3 -S --flood -V -p 80 objetivo.com  # (solo con autorización)
hping3 -S -p 80 -c 3 objetivo.com       # 3 paquetes TCP SYN

# nmap — escaneo de red
nmap -sV -sC -p- 10.0.0.0/24             # escaneo completo
nmap -sU -p 53,123,161 10.0.0.1          # UDP (DNS, NTP, SNMP)
nmap --script ssl-cert 10.0.0.1 -p 443  # verificar certificado

# Simular latencia y pérdida de paquetes (testing)
# Añadir 100ms de latencia en eth0
tc qdisc add dev eth0 root netem delay 100ms
# Con variabilidad (jitter)
tc qdisc change dev eth0 root netem delay 100ms 20ms distribution normal
# Añadir 10% de pérdida de paquetes
tc qdisc change dev eth0 root netem loss 10%
# Remover
tc qdisc del dev eth0 root
```

---

## 📝 Laboratorios

1. `lab-01-tcpdump-analisis.md` — Analizar tráfico HTTP y TLS
2. `lab-02-namespaces-red.sh` — Crear red con namespaces (simular containers)
3. `lab-03-tls-ca-interna.sh` — Montar CA interna y firmar certificados
4. `lab-04-nginx-lb.md` — Load balancer con health checks
5. `lab-05-network-policies-k8s.yaml` — Políticas de red en Kubernetes

## 📌 Cheatsheet

Ver [`cheatsheet.md`](cheatsheet.md)

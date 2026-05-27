# Cheatsheet — Redes Avanzadas

## Diagnóstico
```bash
# Ver conexiones y puertos
ss -tulnp                        # TCP/UDP listening + PID
ss -tnp state established        # conexiones activas
ss -s                            # estadísticas

# Captura de paquetes
tcpdump -i eth0 -n port 443
tcpdump -i any host 10.0.0.5 -w captura.pcap
tcpdump -r captura.pcap          # leer captura

# Rutas
ip route show
ip route get 8.8.8.8             # qué ruta usa para un destino
traceroute -n 8.8.8.8
mtr --report 8.8.8.8

# Interfaces
ip -s link show                  # estadísticas de interfaces
ip addr show eth0
ethtool eth0                     # configuración de NIC
```

## DNS
```bash
dig google.com A +short
dig +trace google.com            # traza completa
dig @8.8.8.8 google.com         # servidor específico
dig -x 8.8.8.8                  # reverse DNS
host google.com
nslookup google.com 8.8.8.8
```

## TLS/SSL
```bash
# Inspeccionar certificado
openssl s_client -connect host:443 -servername host 2>/dev/null | openssl x509 -noout -text
echo | openssl s_client -connect host:443 2>/dev/null | openssl x509 -noout -dates

# Verificar expiración
openssl x509 -in cert.crt -noout -enddate

# Generar par clave/certificado autofirmado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout key.pem -out cert.pem

# Ver cadena de certificados
openssl s_client -connect host:443 -showcerts 2>/dev/null
```

## iptables
```bash
iptables -L -n -v --line-numbers  # ver reglas
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -D INPUT 3               # borrar regla #3
iptables -I INPUT 1 -s 10.0.0.0/8 -j ACCEPT  # insertar al principio
iptables -t nat -L -n -v          # tabla NAT
iptables-save > /etc/iptables/rules.v4
iptables-restore < /etc/iptables/rules.v4
```

## Namespaces de Red
```bash
ip netns add myns
ip netns list
ip netns exec myns ip link show
ip netns exec myns bash
ip link add veth0 type veth peer name veth1
ip link set veth1 netns myns
ip netns del myns
```

## Benchmarking de Red
```bash
iperf3 -s                         # servidor
iperf3 -c <server> -t 30 -P 4   # cliente, 30s, 4 streams
iperf3 -c <server> -u -b 100M   # UDP a 100Mbps

# Simular latencia
tc qdisc add dev eth0 root netem delay 100ms 20ms
tc qdisc del dev eth0 root
```

## Puertos Comunes
| Puerto | Protocolo | Servicio |
|--------|-----------|---------|
| 22 | TCP | SSH |
| 53 | TCP/UDP | DNS |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 2379-2380 | TCP | etcd |
| 6443 | TCP | K8s API |
| 10250 | TCP | Kubelet |

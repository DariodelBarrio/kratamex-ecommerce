# Módulo 03 — Linux SysAdmin Profundo

> **Objetivo:** Administración de sistemas Linux a nivel de producción

---

## 1. systemd — Gestión de Servicios

```bash
# Ciclo de vida de servicios
systemctl start|stop|restart|reload|status nginx
systemctl enable|disable nginx   # inicio automático
systemctl mask|unmask nginx      # prevenir inicio total

# Analizar dependencias y orden de boot
systemctl list-dependencies nginx
systemctl list-units --type=service --state=running
systemd-analyze blame              # qué ralentiza el arranque
systemd-analyze critical-chain     # cadena crítica de boot

# Journald — logging centralizado
journalctl -u nginx -f             # seguir logs de nginx
journalctl -u nginx --since "1 hour ago"
journalctl -p err -b               # errores desde el último boot
journalctl -k                      # mensajes del kernel (dmesg)
journalctl --disk-usage
journalctl --vacuum-size=1G        # limpiar logs antiguos
```

### Crear un servicio systemd propio
```ini
# /etc/systemd/system/mi-app.service
[Unit]
Description=Mi Aplicación DevOps
Documentation=https://docs.ejemplo.com
After=network-online.target postgresql.service
Requires=postgresql.service

[Service]
Type=notify
User=appuser
Group=appuser
WorkingDirectory=/opt/mi-app
ExecStartPre=/opt/mi-app/scripts/pre-start.sh
ExecStart=/opt/mi-app/bin/server --config /etc/mi-app/config.yaml
ExecReload=/bin/kill -HUP $MAINPID
ExecStopPost=/opt/mi-app/scripts/post-stop.sh

# Reinicio automático
Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60s
StartLimitBurst=3

# Seguridad (hardening)
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/mi-app /var/log/mi-app
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

# Límites de recursos
LimitNOFILE=65536
MemoryMax=2G
CPUQuota=80%

# Variables de entorno
EnvironmentFile=/etc/mi-app/env
Environment="LOG_LEVEL=info"

[Install]
WantedBy=multi-user.target
```

---

## 2. Gestión de Recursos

```bash
# CPU
mpstat -P ALL 1          # uso por core
pidstat -u 1             # CPU por proceso
perf top                 # análisis de rendimiento en tiempo real
perf stat -a sleep 5     # estadísticas del sistema 5s

# Memoria
free -h
vmstat 1 10              # memoria virtual + IO
/proc/meminfo            # información detallada
smem -tkP "nginx"        # memoria real por proceso (PSS)

# Discos e I/O
iostat -xz 1             # I/O por dispositivo
iotop -o                 # procesos con I/O activo
lsblk -f                 # dispositivos y sistemas de archivos
df -h --output=source,fstype,size,used,avail,pcent,target

# Límites del sistema
ulimit -a                # límites del shell actual
cat /proc/sys/fs/file-max  # máximo de file descriptors global
# Ajustar permanentemente en /etc/security/limits.conf:
# appuser soft nofile 65536
# appuser hard nofile 65536

# cgroups v2 — control de recursos
# Ver jerarquía
systemd-cgls
# Ver uso de recursos por cgroup
systemd-cgtop

# Namespaces del sistema
lsns                     # listar todos los namespaces
ls -la /proc/1/ns/       # namespaces del proceso 1
```

---

## 3. Gestión de Paquetes y Dependencias

```bash
# Debian/Ubuntu — APT
apt-get update && apt-get upgrade -y
apt-cache policy nginx         # ver versiones disponibles
apt-mark hold nginx            # prevenir actualización
dpkg -l | grep -i nginx        # paquetes instalados
dpkg -L nginx                  # archivos de un paquete
apt-get install --no-install-recommends nginx  # mínimo necesario

# RHEL/CentOS/Rocky — DNF/YUM
dnf install nginx
dnf history                    # historial de transacciones
dnf history undo <id>          # revertir transacción
rpm -qa | grep nginx
rpm -ql nginx                  # archivos del paquete
rpm -qf /etc/nginx/nginx.conf  # qué paquete instaló este archivo

# Compilar desde fuentes (cuando necesitas versión específica)
# Ejemplo: Nginx con módulos custom
./configure \
    --prefix=/etc/nginx \
    --with-http_ssl_module \
    --with-http_v2_module \
    --with-http_stub_status_module \
    --add-module=/tmp/ngx_brotli
make -j$(nproc)
make install
```

---

## 4. Seguridad del Sistema

### SSH Hardening
```bash
# /etc/ssh/sshd_config — configuración segura
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
LoginGraceTime 20
AllowUsers deployer monitor
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
AllowTcpForwarding no
# Para usuarios con túneles:
# Match User tunnel-user
#     AllowTcpForwarding yes

# Rotación de claves SSH (automatizada)
ssh-keygen -t ed25519 -C "servidor-$(hostname)-$(date +%Y%m)" -f ~/.ssh/id_ed25519_new
```

### Sudo y Privilegios
```bash
# /etc/sudoers.d/devops — configuración sin contraseña para tareas específicas
# Operador de deploy: solo puede recargar nginx y reiniciar la app
deploy-user ALL=(root) NOPASSWD: /bin/systemctl reload nginx, \
                                  /bin/systemctl restart mi-app, \
                                  /usr/bin/docker pull *

# Monitoreo: solo lectura
monitor-user ALL=(root) NOPASSWD: /bin/ss -tulnp, \
                                   /bin/journalctl -u * --no-pager
```

### Auditoría con auditd
```bash
# Instalar y configurar auditd
auditctl -l              # listar reglas actuales
auditctl -w /etc/passwd -p wa -k auth-changes
auditctl -w /etc/sudoers -p wa -k sudo-changes
auditctl -a always,exit -F arch=b64 -S execve -k command-execution

# Consultar logs de auditoría
ausearch -k auth-changes -ts today
aureport --login --summary -ts this-week
```

---

## 5. Performance Tuning

```bash
# sysctl — parámetros del kernel para producción
cat >> /etc/sysctl.d/99-devops.conf << 'EOF'
# Red
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535

# Memoria
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Archivos
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
EOF
sysctl -p /etc/sysctl.d/99-devops.conf

# Huge Pages para bases de datos (PostgreSQL, Redis)
echo "vm.nr_hugepages = 1024" >> /etc/sysctl.d/99-devops.conf

# CPU Governor (performance mode)
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
    echo performance > "$cpu"
done

# NUMA awareness
numactl --hardware
numactl --membind=0 --cpunodebind=0 ./mi-app  # anclar a NUMA node 0
```

---

## 6. Automatización con Cron y Timers

```bash
# Cron tradicional
crontab -e
# Formato: minuto hora día mes día_semana comando
# 0 2 * * 1-5 /opt/scripts/backup.sh >> /var/log/backup.log 2>&1

# systemd timers (más robusto y con logs)
# /etc/systemd/system/backup.service
[Unit]
Description=Backup diario de base de datos
[Service]
Type=oneshot
User=backup
ExecStart=/opt/scripts/backup.sh

# /etc/systemd/system/backup.timer
[Unit]
Description=Ejecutar backup.service diariamente a las 2am
[Timer]
OnCalendar=Mon-Fri 02:00
RandomizedDelaySec=5min
Persistent=true
[Install]
WantedBy=timers.target

# Activar
systemctl enable --now backup.timer
systemctl list-timers --all
```

---

## 7. Observabilidad del Sistema

```bash
# strace — qué syscalls hace un proceso
strace -p $PID -f -e trace=network,file
strace -c -f -p $PID sleep 10  # resumen estadístico

# lsof — archivos y puertos abiertos
lsof -p $PID
lsof -i :8080            # qué proceso usa el puerto 8080
lsof +D /var/log/app/    # qué procesos tienen archivos abiertos en directorio

# perf — profiling
perf record -g -p $PID sleep 10
perf report
# Flame graphs
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg

# /proc filesystem
cat /proc/$PID/status     # estado del proceso
cat /proc/$PID/maps       # mapa de memoria
cat /proc/$PID/net/tcp    # conexiones TCP del proceso
ls -la /proc/$PID/fd/     # descriptores de archivo abiertos

# Diagnóstico de problemas de rendimiento (metodología USE)
# Utilization, Saturation, Errors por recurso
# CPU: mpstat, perf
# Memoria: vmstat, smem
# Discos: iostat, iotop
# Red: sar -n DEV, ss
```

---

## 📝 Proyectos del Módulo

1. **Hardenizar un servidor fresh** — checklist de seguridad completo
2. **Servicio systemd con health check** — app con monitoreo integrado
3. **Tuning de kernel para carga alta** — benchmark antes/después

## 📌 [Cheatsheet](cheatsheet.md)

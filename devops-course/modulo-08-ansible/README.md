# Módulo 08 — Ansible & Configuration Management

> **Objetivo:** Automatizar configuración y gestión de flota de servidores

---

## 1. Arquitectura y Conceptos

```
Control Node (tu máquina / CI runner)
      │
      │  SSH (sin agente, push-based)
      │
  ┌───┴──────────────────────────────────────────┐
  │  Managed Nodes (servidores a gestionar)      │
  │  web-01  web-02  web-03  db-01  db-02  ...  │
  └──────────────────────────────────────────────┘

Ansible trabaja con:
  - Inventario   → qué servidores gestionar
  - Playbooks    → qué hacer en esos servidores
  - Roles        → código reutilizable y organizado
  - Variables    → parametrizar el comportamiento
  - Vault        → secretos cifrados
```

---

## 2. Inventario Avanzado

```ini
# inventario/produccion.ini — inventario estático
[webservers]
web-01.empresa.com ansible_user=deploy ansible_port=22022
web-02.empresa.com ansible_user=deploy
web-03.empresa.com

[dbservers]
db-primary.empresa.com ansible_host=10.0.0.10
db-replica.empresa.com ansible_host=10.0.0.11

[monitoring]
prometheus-01.empresa.com
grafana-01.empresa.com

# Grupos de grupos
[produccion:children]
webservers
dbservers
monitoring

# Variables de grupo
[webservers:vars]
nginx_version=1.25
app_port=8080

[produccion:vars]
ansible_python_interpreter=/usr/bin/python3
env=produccion
```

```yaml
# inventario/aws_ec2.yaml — inventario dinámico (AWS)
plugin: amazon.aws.aws_ec2
regions:
  - eu-west-1

filters:
  instance-state-name: running
  tag:Environment: produccion

keyed_groups:
  - key: tags.Role
    prefix: role
  - key: tags.Team
    prefix: team

hostnames:
  - tag:Name
  - private-dns-name

compose:
  ansible_host: private_ip_address
```

```bash
# Verificar inventario
ansible-inventory -i inventario/produccion.ini --list
ansible-inventory -i inventario/aws_ec2.yaml --graph

# Comandos ad-hoc
ansible webservers -i inventario/ -m ping
ansible webservers -i inventario/ -m shell -a "uptime"
ansible dbservers -i inventario/ -m setup  # recopilar facts
ansible all -i inventario/ -m shell -a "df -h" --become
```

---

## 3. Playbooks

```yaml
# playbooks/deploy-app.yaml
---
- name: Deploy aplicación web
  hosts: webservers
  become: true
  serial: "30%"        # rolling update: 30% de hosts a la vez
  max_fail_percentage: 10  # abortar si más del 10% falla

  vars:
    app_version: "{{ lookup('env', 'APP_VERSION') | default('latest') }}"
    app_dir: /opt/mi-app
    app_user: appuser

  pre_tasks:
    - name: Sacar nodo del load balancer
      uri:
        url: "http://lb.interna/api/drain/{{ inventory_hostname }}"
        method: POST
        status_code: 200
      delegate_to: localhost

    - name: Esperar a que las conexiones drenen
      wait_for:
        timeout: 30

  roles:
    - common
    - nginx
    - mi-app

  post_tasks:
    - name: Verificar que la app responde
      uri:
        url: "http://localhost:{{ app_port }}/health"
        status_code: 200
      register: health_result
      retries: 5
      delay: 10
      until: health_result.status == 200

    - name: Reintroducir nodo en el load balancer
      uri:
        url: "http://lb.interna/api/enable/{{ inventory_hostname }}"
        method: POST
      delegate_to: localhost

  handlers:
    - name: reload nginx
      service:
        name: nginx
        state: reloaded

    - name: restart app
      systemd:
        name: mi-app
        state: restarted
        daemon_reload: yes
```

---

## 4. Roles — Estructura y Mejores Prácticas

```
roles/
└── mi-app/
    ├── tasks/
    │   ├── main.yaml         # tareas principales
    │   ├── install.yaml
    │   └── configure.yaml
    ├── handlers/
    │   └── main.yaml
    ├── templates/
    │   ├── app.conf.j2       # Jinja2 templates
    │   └── systemd.service.j2
    ├── files/
    │   └── logrotate.conf
    ├── vars/
    │   └── main.yaml         # variables no sobreescribibles
    ├── defaults/
    │   └── main.yaml         # valores por defecto (sobreescribibles)
    ├── meta/
    │   └── main.yaml         # dependencias del rol
    └── tests/
        └── test.yaml
```

```yaml
# roles/mi-app/defaults/main.yaml
app_version: latest
app_port: 8080
app_user: appuser
app_group: appgroup
app_dir: /opt/mi-app
app_log_dir: /var/log/mi-app

app_resources:
  cpu_quota: "80%"
  memory_max: "512M"

app_config:
  log_level: info
  db_pool_size: 10
  cache_ttl: 300
```

```yaml
# roles/mi-app/tasks/main.yaml
---
- name: Incluir tareas de instalación
  include_tasks: install.yaml
  tags: [install]

- name: Incluir tareas de configuración
  include_tasks: configure.yaml
  tags: [configure]

- name: Asegurar que el servicio está iniciado y habilitado
  systemd:
    name: mi-app
    state: started
    enabled: yes
  tags: [service]
```

```yaml
# roles/mi-app/tasks/install.yaml
---
- name: Crear grupo de sistema
  group:
    name: "{{ app_group }}"
    system: yes
    state: present

- name: Crear usuario de sistema
  user:
    name: "{{ app_user }}"
    group: "{{ app_group }}"
    system: yes
    shell: /sbin/nologin
    createhome: no
    state: present

- name: Crear directorios de la aplicación
  file:
    path: "{{ item }}"
    state: directory
    owner: "{{ app_user }}"
    group: "{{ app_group }}"
    mode: '0750'
  loop:
    - "{{ app_dir }}"
    - "{{ app_log_dir }}"
    - "{{ app_dir }}/config"

- name: Descargar binario de la aplicación
  get_url:
    url: "https://releases.empresa.com/mi-app/{{ app_version }}/mi-app-linux-amd64"
    dest: "{{ app_dir }}/mi-app"
    mode: '0750'
    owner: "{{ app_user }}"
    checksum: "sha256:{{ app_checksum }}"
  notify: restart app

- name: Configurar systemd service
  template:
    src: systemd.service.j2
    dest: "/etc/systemd/system/mi-app.service"
    mode: '0644'
  notify:
    - reload systemd daemon
    - restart app
```

```yaml
# roles/mi-app/tasks/configure.yaml
---
- name: Generar archivo de configuración
  template:
    src: app.conf.j2
    dest: "{{ app_dir }}/config/app.yaml"
    owner: "{{ app_user }}"
    group: "{{ app_group }}"
    mode: '0640'
    validate: "/usr/bin/mi-app validate-config %s"  # validar antes de copiar
  notify: restart app

- name: Configurar logrotate
  copy:
    src: logrotate.conf
    dest: "/etc/logrotate.d/mi-app"
    mode: '0644'
```

```jinja2
{# roles/mi-app/templates/app.conf.j2 #}
# Generado por Ansible — NO editar manualmente
# Host: {{ inventory_hostname }} | Fecha: {{ ansible_date_time.iso8601 }}

server:
  port: {{ app_port }}
  host: 0.0.0.0

database:
  host: {{ db_host }}
  port: {{ db_port | default(5432) }}
  name: {{ db_name }}
  pool_size: {{ app_config.db_pool_size }}

cache:
  {% if redis_sentinel_enabled | default(false) %}
  mode: sentinel
  master_name: {{ redis_master_name }}
  sentinels:
    {% for sentinel in redis_sentinels %}
    - host: {{ sentinel.host }}
      port: {{ sentinel.port | default(26379) }}
    {% endfor %}
  {% else %}
  mode: standalone
  host: {{ redis_host }}
  port: {{ redis_port | default(6379) }}
  {% endif %}
  ttl: {{ app_config.cache_ttl }}

logging:
  level: {{ app_config.log_level }}
  format: json
  output: {{ app_log_dir }}/app.log
```

---

## 5. Ansible Vault — Gestión de Secretos

```bash
# Crear archivo cifrado
ansible-vault create group_vars/produccion/vault.yaml

# Editar archivo cifrado
ansible-vault edit group_vars/produccion/vault.yaml

# Cifrar string individual (para incluir en variables)
ansible-vault encrypt_string 'mi-password-secreto' --name 'db_password'

# Ejecutar playbook con vault
ansible-playbook playbooks/deploy-app.yaml \
    --vault-password-file ~/.vault_pass \
    -i inventario/produccion.ini

# Múltiples vault IDs (distintas contraseñas)
ansible-vault encrypt_string 'valor' --vault-id dev@~/.vault_dev --name 'db_pass'
ansible-playbook playbooks/site.yaml --vault-id dev@~/.vault_dev --vault-id prod@~/.vault_prod
```

```yaml
# group_vars/produccion/vault.yaml (contenido cifrado con vault)
vault_db_password: "mi-password-produccion-super-seguro"
vault_redis_password: "redis-pass-produccion"
vault_api_key: "sk-produccion-api-key"

# group_vars/produccion/main.yaml (referencia las vars del vault)
db_password: "{{ vault_db_password }}"
redis_password: "{{ vault_redis_password }}"
```

---

## 6. Ansible en CI/CD + AWX/Tower

```yaml
# .github/workflows/ansible.yml
name: Ansible Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        required: true
        type: choice
        options: [staging, produccion]
      app_version:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
    - uses: actions/checkout@v4

    - name: Install Ansible
      run: |
        pip install ansible ansible-lint

    - name: Configure SSH
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
        chmod 600 ~/.ssh/id_ed25519
        echo "StrictHostKeyChecking no" >> ~/.ssh/config

    - name: Lint playbooks
      run: ansible-lint playbooks/

    - name: Deploy
      run: |
        ansible-playbook playbooks/deploy-app.yaml \
          -i inventario/${{ inputs.environment }}.yaml \
          -e "app_version=${{ inputs.app_version }}" \
          --vault-password-file <(echo "${{ secrets.VAULT_PASSWORD }}")
      env:
        ANSIBLE_HOST_KEY_CHECKING: "False"
        ANSIBLE_STDOUT_CALLBACK: yaml
```

```bash
# AWX / Ansible Automation Platform (Tower)
# Gestión de inventarios, credenciales y jobs desde una UI/API

# Ejecutar job template via API
curl -s -X POST \
    -H "Authorization: Bearer $AWX_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"extra_vars": {"app_version": "v2.1.0"}}' \
    "https://awx.empresa.com/api/v2/job_templates/42/launch/"
```

---

## 7. Módulo de Testing con Molecule

```bash
# Molecule — testing de roles Ansible
cd roles/mi-app
molecule init scenario --driver-name docker

# molecule/default/converge.yml
---
- name: Converge
  hosts: all
  tasks:
    - name: Include role
      include_role:
        name: mi-app
      vars:
        app_version: latest
        db_host: localhost

# molecule/default/verify.yml
---
- name: Verify
  hosts: all
  tasks:
    - name: Check service is running
      systemd:
        name: mi-app
      register: service_status
      failed_when: service_status.status.ActiveState != 'active'

    - name: Check app responds
      uri:
        url: "http://localhost:8080/health"
        status_code: 200

# Ejecutar tests
molecule test          # ciclo completo: create → converge → verify → destroy
molecule converge      # solo aplicar el rol
molecule verify        # solo verificar
molecule login         # entrar al container de test
```

---

## 📝 Proyectos del Módulo

1. **Configurar 3 servidores web** — Nginx + app + monitoreo con Ansible
2. **Rol de base de datos** — PostgreSQL con replicación y backup automático
3. **Pipeline de configuración** — Ansible + Molecule + CI/CD

## 📌 [Cheatsheet](cheatsheet.md)

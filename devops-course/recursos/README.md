# 📚 Recursos del Curso DevOps

## Libros Esenciales

| Libro | Por qué leerlo |
|-------|---------------|
| **Site Reliability Engineering** — Google | La biblia del SRE/DevOps. Gratis online: sre.google/books |
| **The DevOps Handbook** — Kim, Humble et al. | Fundamentos de la cultura DevOps |
| **Accelerate** — Nicole Forsgren | Las métricas DORA con base científica |
| **Release It!** — Michael Nygard | Patrones de resiliencia para producción |
| **Kubernetes in Action** — Marko Luksa | K8s en profundidad |
| **Terraform: Up & Running** — Brikman | IaC con Terraform |
| **Infrastructure as Code** — Kief Morris | Principios generales de IaC |
| **The Unicorn Project** — Kim | Comprensión de la deuda técnica y DevOps |

---

## Documentación Oficial

| Tecnología | URL |
|------------|-----|
| Kubernetes | https://kubernetes.io/docs |
| Docker | https://docs.docker.com |
| Terraform | https://developer.hashicorp.com/terraform/docs |
| Ansible | https://docs.ansible.com |
| ArgoCD | https://argo-cd.readthedocs.io |
| Flux | https://fluxcd.io/flux/concepts |
| Prometheus | https://prometheus.io/docs |
| OpenTelemetry | https://opentelemetry.io/docs |
| Vault | https://developer.hashicorp.com/vault/docs |
| AWS | https://docs.aws.amazon.com |
| GCP | https://cloud.google.com/docs |
| Azure | https://learn.microsoft.com/azure |

---

## Labs Interactivos

| Plataforma | Contenido | Costo |
|-----------|-----------|-------|
| **KillerKoda** | K8s, Linux, Docker | Gratis |
| **Killercoda** | CKA/CKAD/CKS prep | Gratis + premium |
| **Play with Kubernetes** | Cluster temporal | Gratis |
| **Instruqt** | Labs multi-cloud | Gratis + premium |
| **AWS Skill Builder** | Labs AWS oficiales | Gratis + premium |
| **Google Cloud Skills Boost** | Labs GCP | Créditos gratis |
| **Microsoft Learn** | Labs Azure | Gratis |
| **HashiCorp Learn** | Terraform, Vault, Consul | Gratis |

---

## Certificaciones Recomendadas

### Kubernetes
- **CKA** — Certified Kubernetes Administrator
- **CKAD** — Certified Kubernetes Application Developer
- **CKS** — Certified Kubernetes Security Specialist
- Exámenes en: training.linuxfoundation.org

### Cloud
- **AWS Solutions Architect Professional**
- **AWS DevOps Engineer Professional**
- **GCP Professional Cloud DevOps Engineer**
- **Azure DevOps Engineer Expert (AZ-400)**

### Otras
- **Terraform Associate** — HashiCorp
- **Vault Associate** — HashiCorp
- **GitLab Certified CI/CD Associate**
- **Prometheus Certified Associate (PCA)**

---

## Canales y Comunidades

### YouTube
- **TechWorld with Nana** — K8s, Docker, DevOps
- **DevOps Toolkit** — Viktor Farcic
- **That DevOps Guy** — Marcel Dempers
- **KodeKloud** — Mumshad Mannambeth

### Podcasts
- **Kubernetes Podcast** — Google
- **Screaming in the Cloud** — Corey Quinn (AWS)
- **The Ship It Podcast** — Gerhard Lazu
- **DevOps and Docker Talk**

### Comunidades
- **CNCF Slack** — cloud-native community
- **KubeWeekly** — newsletter
- **DevOps subreddit** — reddit.com/r/devops
- **Hacker News** — YCombinator

---

## Repositorios de Referencia

```bash
# Ejemplos y templates de referencia
git clone https://github.com/kubernetes/examples
git clone https://github.com/argoproj/argocd-example-apps
git clone https://github.com/fluxcd/flux2-multi-tenancy
git clone https://github.com/terraform-aws-modules
git clone https://github.com/prometheus-operator/kube-prometheus
git clone https://github.com/open-telemetry/opentelemetry-demo
```

---

## Herramientas CLI Imprescindibles

```bash
# Instalar el toolkit completo de DevOps
brew install \
    kubectl kubectx krew k9s \    # Kubernetes
    helm helmfile \               # Helm
    terraform terragrunt tfsec infracost \  # IaC
    argocd flux \                 # GitOps
    aws-cli awscli \              # Cloud
    gcloud azure-cli \            # Cloud
    docker docker-compose \       # Containers
    ansible molecule \            # Config Mgmt
    trivy cosign \                # Security
    jq yq \                      # Data processing
    httpie curlie \               # HTTP testing
    stern \                       # Log tailing k8s
    mtr iperf3 nmap               # Red

# kubectl plugins con Krew
kubectl krew install \
    ctx ns view-secret \          # Básicos
    tree neat \                   # Visualización
    ktop neat \                   # Top mejorado
    doctor \                      # Diagnóstico
    resource-capacity             # Capacidad del cluster
```

---

## Roadmap Sugerido

```
MES 1-2: Fundamentos
  ├─ Módulo 01: Bash Avanzado
  └─ Módulo 02: Redes Avanzadas

MES 3-4: Infraestructura Base
  ├─ Módulo 03: Linux SysAdmin
  ├─ Módulo 04: Docker
  └─ Módulo 05: Kubernetes (CKA)

MES 5-6: Automatización
  ├─ Módulo 06: CI/CD
  ├─ Módulo 07: Terraform
  └─ Módulo 08: Ansible

MES 7-8: Cloud y Operaciones
  ├─ Módulo 09: Cloud (AWS + GCP)
  └─ Módulo 10: Observabilidad

MES 9-10: Madurez
  ├─ Módulo 11: DevSecOps (CKS)
  └─ Módulo 12: GitOps

MES 11-12: Proyecto Final + Certificaciones
  └─ Construir plataforma completa
     + CKA/CKAD/CKS + AWS DevOps Pro
```

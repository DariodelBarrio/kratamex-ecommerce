# Módulo 07 — Terraform & Infrastructure as Code

> **Objetivo:** Gestionar infraestructura cloud completa como código versionado

---

## 1. Fundamentos de Terraform

```hcl
# main.tf — estructura básica de un módulo Terraform
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }

  # Backend remoto (SIEMPRE usar en equipo)
  backend "s3" {
    bucket         = "mi-empresa-terraform-state"
    key            = "produccion/eks/terraform.tfstate"
    region         = "eu-west-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"  # bloqueo concurrencia
  }
}
```

### Variables y Outputs
```hcl
# variables.tf
variable "environment" {
  description = "Nombre del entorno (dev, staging, produccion)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "produccion"], var.environment)
    error_message = "El entorno debe ser dev, staging o produccion."
  }
}

variable "cluster_config" {
  description = "Configuración del cluster EKS"
  type = object({
    version        = string
    instance_types = list(string)
    min_size       = number
    max_size       = number
    desired_size   = number
  })
  default = {
    version        = "1.28"
    instance_types = ["t3.medium"]
    min_size       = 2
    max_size       = 10
    desired_size   = 3
  }
}

variable "tags" {
  description = "Tags comunes para todos los recursos"
  type        = map(string)
  default     = {}
}

# outputs.tf
output "cluster_endpoint" {
  description = "Endpoint del cluster EKS"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "cluster_certificate_authority_data" {
  description = "CA data del cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}
```

---

## 2. Módulos Reutilizables

```
infraestructura/
├── modules/
│   ├── eks/           # módulo EKS
│   ├── rds/           # módulo RDS
│   ├── vpc/           # módulo VPC
│   └── bastion/       # módulo bastion host
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── produccion/
└── global/
    ├── iam/
    └── s3-state/
```

```hcl
# modules/vpc/main.tf — Módulo VPC completo
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.name}-vpc"
  })
}

# Subnets públicas (para ALB, NAT Gateways)
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.name}-public-${var.availability_zones[count.index]}"
    "kubernetes.io/role/elb" = "1"  # para ALB en EKS
  })
}

# Subnets privadas (para workers de EKS, RDS)
resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.name}-private-${var.availability_zones[count.index]}"
    "kubernetes.io/role/internal-elb" = "1"
  })
}

# NAT Gateway (alta disponibilidad: uno por AZ)
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? length(var.availability_zones) : 0
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? length(var.availability_zones) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "${var.name}-nat-${var.availability_zones[count.index]}"
  })
}
```

```hcl
# modules/eks/main.tf — EKS con node groups gestionados
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "${var.name}-${var.environment}"
  cluster_version = var.cluster_config.version

  vpc_id                         = var.vpc_id
  subnet_ids                     = var.private_subnet_ids
  cluster_endpoint_public_access = false  # solo acceso privado en producción

  # Addons gestionados
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa_role.iam_role_arn
    }
  }

  # Node groups
  eks_managed_node_groups = {
    # Nodos generales
    general = {
      instance_types = var.cluster_config.instance_types
      min_size       = var.cluster_config.min_size
      max_size       = var.cluster_config.max_size
      desired_size   = var.cluster_config.desired_size

      disk_size = 50  # GB

      labels = {
        "node-type" = "general"
      }
    }

    # Nodos para cargas intensivas (si necesario)
    compute = {
      instance_types = ["c5.2xlarge", "c5.4xlarge"]
      min_size       = 0
      max_size       = 5
      desired_size   = 0

      taints = {
        compute = {
          key    = "dedicated"
          value  = "compute"
          effect = "NO_SCHEDULE"
        }
      }

      labels = {
        "node-type" = "compute"
      }
    }
  }

  tags = var.tags
}
```

---

## 3. Manejo de Estado Avanzado

```bash
# Operaciones de estado que debes dominar

# Ver estado actual
terraform show
terraform state list
terraform state show aws_eks_cluster.main

# Importar recurso existente al state
terraform import aws_s3_bucket.logs mi-empresa-logs-bucket

# Mover recurso (refactoring)
terraform state mv aws_instance.old aws_instance.new

# Eliminar del state SIN destruir el recurso
terraform state rm aws_instance.a_mantener

# Manipulación directa del state (con mucho cuidado)
terraform state pull > backup.tfstate
terraform state push backup.tfstate  # solo si sabes lo que haces

# Bloqueo de state (DynamoDB)
# Se hace automáticamente. Ver con:
aws dynamodb scan --table-name terraform-state-lock

# Workspaces (alternativa simple a múltiples backends)
terraform workspace new staging
terraform workspace select staging
terraform workspace list

# Generar plan y guardarlo
terraform plan -out=tfplan.bin
terraform show -json tfplan.bin | jq .
terraform apply tfplan.bin
```

---

## 4. Terraform en CI/CD

```yaml
# .github/workflows/terraform.yml
name: Terraform CI/CD

on:
  push:
    branches: [main]
    paths: ['infraestructura/**']
  pull_request:
    branches: [main]
    paths: ['infraestructura/**']

env:
  TF_VERSION: '1.6.0'
  AWS_REGION: 'eu-west-1'
  WORKING_DIR: './infraestructura/environments/produccion'

jobs:
  terraform:
    name: Terraform
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${{ env.WORKING_DIR }}

    steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/github-actions-terraform
        aws-region: ${{ env.AWS_REGION }}

    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v3
      with:
        terraform_version: ${{ env.TF_VERSION }}

    - name: Terraform Format Check
      run: terraform fmt -check -recursive

    - name: Terraform Init
      run: terraform init

    - name: Terraform Validate
      run: terraform validate

    - name: tfsec — Security scan
      uses: aquasecurity/tfsec-action@v1
      with:
        working_directory: ${{ env.WORKING_DIR }}

    - name: terraform-docs — Documentación
      uses: terraform-docs/gh-actions@v1
      with:
        working-dir: ${{ env.WORKING_DIR }}
        output-file: README.md
        output-method: inject

    - name: Terraform Plan
      id: plan
      run: terraform plan -no-color -out=tfplan.bin
      continue-on-error: true

    - name: Comment plan on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const plan = `${{ steps.plan.outputs.stdout }}`
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## Terraform Plan\n\`\`\`\n${plan}\n\`\`\``
          })

    - name: Terraform Apply
      if: github.ref == 'refs/heads/main' && github.event_name == 'push'
      run: terraform apply -auto-approve tfplan.bin
```

---

## 5. Módulo Completo — EKS + RDS + Redis

```hcl
# environments/produccion/main.tf
locals {
  name        = "mi-empresa"
  environment = "produccion"
  region      = "eu-west-1"
  azs         = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]

  tags = {
    Environment = local.environment
    Terraform   = "true"
    Team        = "platform"
    CostCenter  = "infra-produccion"
  }
}

provider "aws" {
  region = local.region
  default_tags {
    tags = local.tags
  }
}

# ── VPC ────────────────────────────────────────────────────────────
module "vpc" {
  source = "../../modules/vpc"

  name               = local.name
  environment        = local.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = local.azs
  enable_nat_gateway = true
  tags               = local.tags
}

# ── EKS ────────────────────────────────────────────────────────────
module "eks" {
  source = "../../modules/eks"

  name               = local.name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  cluster_config = {
    version        = "1.28"
    instance_types = ["t3.large"]
    min_size       = 3
    max_size       = 20
    desired_size   = 5
  }
  tags = local.tags
}

# ── RDS PostgreSQL ─────────────────────────────────────────────────
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "${local.name}-${local.environment}"
  engine     = "postgres"
  engine_version = "16.1"
  instance_class = "db.t3.medium"

  allocated_storage     = 100
  max_allocated_storage = 500  # auto-scaling de almacenamiento
  storage_encrypted     = true

  db_name  = "appdb"
  username = "appuser"
  port     = 5432

  multi_az               = true  # alta disponibilidad
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [module.sg_rds.security_group_id]

  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = false

  parameters = [
    { name = "max_connections", value = "200" },
    { name = "shared_preload_libraries", value = "pg_stat_statements" }
  ]

  tags = local.tags
}

# ── ElastiCache Redis ──────────────────────────────────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name}-${local.environment}"
  description          = "Redis cluster para ${local.name} ${local.environment}"

  node_type            = "cache.t3.micro"
  num_cache_clusters   = 2  # primario + réplica
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [module.sg_redis.security_group_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  automatic_failover_enabled = true
  multi_az_enabled           = true

  snapshot_retention_limit = 3
  snapshot_window          = "03:00-05:00"

  tags = local.tags
}
```

---

## 6. Herramientas del Ecosistema

```bash
# terraform-docs — Documentación automática
terraform-docs markdown . > README.md

# tfsec — Security scanning
tfsec .
tfsec . --format sarif --out tfsec.sarif

# infracost — Estimación de costos
infracost breakdown --path .
infracost diff --path . --compare-to tfplan.json

# Terragrunt — DRY para Terraform
# terragrunt.hcl
remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket = "mi-empresa-terraform-state"
    key    = "${path_relative_to_include()}/terraform.tfstate"
    region = "eu-west-1"
  }
}

# Checkov — compliance como código
checkov -d . --framework terraform
checkov -d . --check CKV_AWS_20,CKV_AWS_21  # chequeos específicos
```

---

## 📝 Proyectos del Módulo

1. **VPC + EKS completo** — infraestructura de producción desde cero
2. **Módulo reutilizable** — crear módulo con tests usando Terratest
3. **Pipeline de Terraform** — CI/CD con plan, revisión y apply

## 📌 [Cheatsheet](cheatsheet.md)

# Módulo 09 — Cloud (AWS / GCP / Azure)

> **Objetivo:** Arquitectar y operar infraestructura cloud en los tres proveedores principales

---

## 1. AWS — Servicios Clave para DevOps

### IAM — Identity and Access Management
```bash
# Principio de mínimo privilegio con IAM

# Crear política con permisos específicos
aws iam create-policy \
    --policy-name EKSDeployPolicy \
    --policy-document file://policies/eks-deploy.json

# IAM Roles para EC2 (Instance Profile)
aws iam create-role \
    --role-name ec2-worker-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# IRSA — IAM Roles for Service Accounts (EKS)
# Permite que pods de K8s asuman roles IAM sin credenciales hardcodeadas
eksctl create iamserviceaccount \
    --cluster mi-cluster \
    --namespace produccion \
    --name mi-app-sa \
    --attach-policy-arn arn:aws:iam::123456789:policy/MiAppPolicy \
    --approve

# STS AssumeRole — asumir rol temporalmente
aws sts assume-role \
    --role-arn arn:aws:iam::123456789:role/DeployRole \
    --role-session-name deploy-session \
    --duration-seconds 3600

# Analizar políticas efectivas
aws iam simulate-principal-policy \
    --policy-source-arn arn:aws:iam::123456789:user/deploy-user \
    --action-names s3:PutObject \
    --resource-arns arn:aws:s3:::mi-bucket/*
```

### EKS — Elastic Kubernetes Service
```bash
# Crear cluster con eksctl
cat > eks-cluster.yaml << 'EOF'
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: produccion
  region: eu-west-1
  version: "1.28"

iam:
  withOIDC: true  # Necesario para IRSA

vpc:
  clusterEndpoints:
    publicAccess: false
    privateAccess: true

managedNodeGroups:
- name: workers
  instanceType: t3.large
  minSize: 3
  maxSize: 20
  desiredCapacity: 5
  privateNetworking: true
  spot: false
  iam:
    withAddonPolicies:
      autoScaler: true
      albIngress: true
      ebs: true
      efs: true
      cloudWatch: true

addons:
- name: vpc-cni
  version: latest
- name: coredns
  version: latest
- name: kube-proxy
  version: latest
- name: aws-ebs-csi-driver
  version: latest
EOF

eksctl create cluster -f eks-cluster.yaml

# Actualizar kubeconfig
aws eks update-kubeconfig --region eu-west-1 --name produccion

# AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName=produccion \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller
```

### S3, CloudFront y Route53
```bash
# S3 — almacenamiento con políticas de ciclo de vida
aws s3 mb s3://mi-empresa-assets --region eu-west-1

# Política de ciclo de vida (mover a IA y Glacier)
aws s3api put-bucket-lifecycle-configuration \
    --bucket mi-empresa-assets \
    --lifecycle-configuration file://s3-lifecycle.json

# CloudFront con S3 y certificado ACM
aws cloudfront create-distribution \
    --distribution-config file://cloudfront-config.json

# Route53 — crear registro
aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456789 \
    --change-batch '{
        "Changes": [{
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "api.empresa.com",
                "Type": "A",
                "AliasTarget": {
                    "HostedZoneId": "Z215JYRZR1TBD5",
                    "DNSName": "mi-alb.eu-west-1.elb.amazonaws.com",
                    "EvaluateTargetHealth": true
                }
            }
        }]
    }'
```

### CloudWatch y Observabilidad AWS
```bash
# Crear dashboard
aws cloudwatch put-dashboard \
    --dashboard-name MiApp \
    --dashboard-body file://dashboard.json

# Alarma de error rate
aws cloudwatch put-metric-alarm \
    --alarm-name "MiApp-ErrorRate-High" \
    --alarm-description "Tasa de errores HTTP 5xx > 5%" \
    --metric-name "5XXError" \
    --namespace "AWS/ApplicationELB" \
    --statistic Average \
    --period 60 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=LoadBalancer,Value="app/mi-alb/abc123" \
    --evaluation-periods 3 \
    --alarm-actions arn:aws:sns:eu-west-1:123456789:alertas-produccion \
    --treat-missing-data breaching

# Logs Insights — queries
aws logs start-query \
    --log-group-name /aws/eks/produccion/cluster \
    --start-time $(date -d "1 hour ago" +%s) \
    --end-time $(date +%s) \
    --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100'
```

---

## 2. GCP — Google Cloud Platform

### GKE — Google Kubernetes Engine
```bash
# Crear cluster GKE con Autopilot
gcloud container clusters create-auto mi-cluster \
    --region europe-west1 \
    --project mi-proyecto

# GKE Standard con configuración avanzada
gcloud container clusters create produccion \
    --region europe-west1 \
    --num-nodes 3 \
    --enable-autoscaling --min-nodes 3 --max-nodes 20 \
    --machine-type n2-standard-4 \
    --enable-autorepair \
    --enable-autoupgrade \
    --enable-ip-alias \
    --enable-network-policy \
    --enable-shielded-nodes \
    --workload-pool mi-proyecto.svc.id.goog \  # Workload Identity
    --addons HorizontalPodAutoscaling,HttpLoadBalancing,GcpFilestoreCsiDriver

# Workload Identity (equiv. IRSA de AWS)
# Vincular SA de K8s con SA de GCP
gcloud iam service-accounts add-iam-policy-binding \
    mi-app@mi-proyecto.iam.gserviceaccount.com \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:mi-proyecto.svc.id.goog[produccion/mi-app]"
```

### Cloud Run — Serverless Containers
```bash
# Deploy en Cloud Run (serverless, sin gestionar K8s)
gcloud run deploy mi-app \
    --image gcr.io/mi-proyecto/mi-app:v2.1.0 \
    --region europe-west1 \
    --platform managed \
    --allow-unauthenticated \
    --min-instances 2 \
    --max-instances 100 \
    --concurrency 80 \
    --cpu 1 \
    --memory 512Mi \
    --set-env-vars ENV=produccion \
    --set-secrets DB_PASSWORD=db-password:latest \
    --vpc-connector mi-vpc-connector \
    --vpc-egress all-traffic

# Tráfico gradual entre revisiones
gcloud run services update-traffic mi-app \
    --to-revisions mi-app-v210=90,mi-app-v211=10
```

### Cloud SQL y Pub/Sub
```bash
# Cloud SQL PostgreSQL con HA
gcloud sql instances create produccion-db \
    --database-version POSTGRES_16 \
    --tier db-n1-standard-4 \
    --region europe-west1 \
    --availability-type REGIONAL \  # Alta disponibilidad
    --backup-start-time 02:00 \
    --enable-bin-log \
    --storage-auto-increase \
    --retained-backups-count 7

# Pub/Sub para comunicación async entre microservicios
gcloud pubsub topics create pedidos-nuevos
gcloud pubsub subscriptions create pedidos-procesador \
    --topic pedidos-nuevos \
    --ack-deadline 60 \
    --message-retention-duration 7d \
    --expiration-period never
```

---

## 3. Azure — Microsoft Azure

### AKS — Azure Kubernetes Service
```bash
# Crear cluster AKS
az aks create \
    --resource-group mi-rg \
    --name produccion \
    --node-count 3 \
    --node-vm-size Standard_D4s_v3 \
    --enable-cluster-autoscaler \
    --min-count 3 \
    --max-count 20 \
    --network-plugin azure \
    --network-policy azure \
    --enable-managed-identity \
    --enable-workload-identity \
    --enable-oidc-issuer \
    --enable-addons monitoring \
    --generate-ssh-keys

# Obtener credenciales
az aks get-credentials --resource-group mi-rg --name produccion

# Workload Identity en AKS
az identity create \
    --resource-group mi-rg \
    --name mi-app-identity

az aks pod-identity add \
    --resource-group mi-rg \
    --cluster-name produccion \
    --namespace produccion \
    --name mi-app \
    --identity-resource-id /subscriptions/.../resourcegroups/mi-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/mi-app-identity
```

### Azure Container Registry y Service Bus
```bash
# ACR — Container Registry privado
az acr create \
    --resource-group mi-rg \
    --name miempresaacr \
    --sku Premium \
    --admin-enabled false

# Integrar ACR con AKS
az aks update \
    --resource-group mi-rg \
    --name produccion \
    --attach-acr miempresaacr

# Service Bus — mensajería async
az servicebus namespace create \
    --resource-group mi-rg \
    --name mi-empresa-bus \
    --sku Premium \
    --location westeurope

az servicebus topic create \
    --resource-group mi-rg \
    --namespace-name mi-empresa-bus \
    --name pedidos
```

---

## 4. Multi-Cloud y Herramientas Cross-Cloud

```bash
# Comparativa de servicios equivalentes
# ┌─────────────────────┬─────────────┬───────────────┬─────────────────┐
# │ Servicio            │ AWS         │ GCP           │ Azure           │
# ├─────────────────────┼─────────────┼───────────────┼─────────────────┤
# │ Kubernetes          │ EKS         │ GKE           │ AKS             │
# │ Serverless Cont.    │ Fargate     │ Cloud Run     │ Container Apps  │
# │ Registry            │ ECR         │ Artifact Reg  │ ACR             │
# │ SQL DB              │ RDS         │ Cloud SQL     │ Azure SQL       │
# │ NoSQL               │ DynamoDB    │ Firestore     │ Cosmos DB       │
# │ Object Storage      │ S3          │ Cloud Storage │ Blob Storage    │
# │ CDN                 │ CloudFront  │ Cloud CDN     │ Azure CDN       │
# │ Message Queue       │ SQS/SNS     │ Pub/Sub       │ Service Bus     │
# │ Secrets             │ Secrets Mgr │ Secret Mgr    │ Key Vault       │
# │ DNS                 │ Route53     │ Cloud DNS     │ Azure DNS       │
# │ VPN                 │ Site2Site   │ Cloud VPN     │ VPN Gateway     │
# │ Monitoring          │ CloudWatch  │ Cloud Mon     │ Azure Monitor   │
# └─────────────────────┴─────────────┴───────────────┴─────────────────┘

# Crossplane — gestión multi-cloud con K8s
kubectl apply -f https://raw.githubusercontent.com/crossplane/crossplane/v1.14.0/cluster/install.yaml

# Pulumi — IaC multi-cloud con lenguajes reales
pulumi new aws-typescript
# o
pulumi new gcp-python
```

### Cost Optimization
```bash
# AWS Cost Explorer
aws ce get-cost-and-usage \
    --time-period Start=2024-01-01,End=2024-01-31 \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE

# Identificar recursos sin usar
# EC2 con < 5% CPU promedio en 30 días
aws cloudwatch get-metric-statistics \
    --namespace AWS/EC2 \
    --metric-name CPUUtilization \
    --dimensions Name=InstanceId,Value=i-1234567890abcdef0 \
    --start-time $(date -d "30 days ago" -Iseconds) \
    --end-time $(date -Iseconds) \
    --period 2592000 \
    --statistics Average

# Instancias Spot / Preemptible para cargas tolerantes a interrupción
aws ec2 request-spot-instances \
    --instance-count 5 \
    --spot-price "0.05" \
    --launch-specification file://spot-spec.json
```

---

## 5. Well-Architected Framework

```
Los 6 pilares del Well-Architected Framework (AWS, pero aplicable a todos):

1. EXCELENCIA OPERACIONAL
   - IaC para toda la infraestructura
   - Eventos y respuestas automatizadas
   - Mejora continua de procesos

2. SEGURIDAD
   - Mínimo privilegio en IAM
   - Cifrado en tránsito y reposo
   - Logging y auditoría de todo
   - Separación de responsabilidades

3. CONFIABILIDAD
   - Multi-AZ para HA
   - Health checks + circuit breakers
   - Backup y restore probado (GameDay)
   - Runbooks para incidentes

4. EFICIENCIA DE RENDIMIENTO
   - Tipo de recurso correcto para la carga
   - Benchmarking regular
   - Cacheo a múltiples niveles

5. OPTIMIZACIÓN DE COSTOS
   - Reserved/Committed instances para carga base
   - Spot/Preemptible para carga variable
   - Rightsizing regular
   - Apagar recursos fuera de horas de negocio

6. SOSTENIBILIDAD
   - Maximizar utilización
   - Seleccionar regiones con energía renovable
   - Apagar recursos innecesarios
```

---

## 📝 Proyectos del Módulo

1. **AWS Landing Zone** — cuenta multi-entorno con Organizations + SSO
2. **GKE + Cloud SQL** — app en GKE con base de datos gestionada
3. **Multi-cloud failover** — arquitectura que falla entre clouds

## 📌 [Cheatsheet](cheatsheet.md)

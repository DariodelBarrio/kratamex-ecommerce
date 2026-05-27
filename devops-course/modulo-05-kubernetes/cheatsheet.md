# Cheatsheet — Kubernetes

## Pods y Deployments
```bash
kubectl get pods -A -o wide
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> -f --previous
kubectl exec -it <pod> -n <ns> -- sh
kubectl delete pod <pod> --force --grace-period=0
kubectl rollout restart deployment/<name> -n <ns>
kubectl rollout status deployment/<name> -n <ns>
kubectl rollout undo deployment/<name> -n <ns>
kubectl rollout history deployment/<name>
kubectl scale deployment <name> --replicas=5
```

## Debugging
```bash
# Pod que no arranca
kubectl describe pod <pod>              # ver Events
kubectl logs <pod> --previous           # logs del crash anterior
kubectl get events --sort-by='.lastTimestamp'

# DNS
kubectl exec -it <pod> -- nslookup kubernetes.default
kubectl exec -it <pod> -- cat /etc/resolv.conf

# Recursos
kubectl top pods -n <ns>
kubectl top nodes
kubectl describe node <node> | grep -A 5 "Allocated"

# Debug con imagen efímera
kubectl debug -it <pod> --image=busybox --target=<container>
```

## Nodos
```bash
kubectl get nodes -o wide
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node>
kubectl taint nodes <node> key=value:NoSchedule
kubectl label nodes <node> disktype=ssd
```

## RBAC
```bash
kubectl auth can-i create deployments --as system:serviceaccount:ns:sa
kubectl auth can-i '*' '*' --all-namespaces
kubectl get rolebindings,clusterrolebindings -A | grep <user>
```

## Helm
```bash
helm list -A
helm history <release> -n <ns>
helm rollback <release> <revision> -n <ns>
helm get values <release> -n <ns>
helm diff upgrade <release> <chart> -f values.yaml  # requiere helm-diff
helm template <chart> -f values.yaml | kubectl apply --dry-run=client -f -
```

## Recursos y Limits
```bash
# Ver recursos asignados vs disponibles
kubectl describe nodes | grep -A 5 "Allocated resources"

# QoS classes
# Guaranteed: request == limit
# Burstable:  request < limit
# BestEffort: sin request ni limit (eviccionado primero)
```

## Contextos
```bash
kubectl config get-contexts
kubectl config use-context <context>
kubectl config set-context --current --namespace=<ns>
# Con kubectx/kubens:
kubectx <context>
kubens <namespace>
```

## JSONPath útiles
```bash
# IPs de todos los pods
kubectl get pods -o jsonpath='{.items[*].status.podIP}'

# Imágenes en uso
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# Nodos con taint
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.spec.taints}{"\n"}{end}'
```

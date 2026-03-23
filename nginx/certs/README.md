# Certificados TLS

Los archivos `cert.pem` y `key.pem` **no se incluyen en el repositorio**.

Genéralos localmente con:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem \
  -out nginx/certs/cert.pem \
  -subj "/CN=localhost"
```

> Estos certificados son autofirmados y solo para desarrollo local.
> Nunca subas archivos `.pem`, `.key` o `.crt` al repositorio.

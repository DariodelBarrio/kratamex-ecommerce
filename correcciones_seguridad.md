# Correcciones de Seguridad

## [ID-001] Hardcoded Credentials en Código Fuente
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
Se detectaron credenciales hardcodeadas directamente en el código fuente (`backend/src/index.js`), incluyendo contraseñas de usuarios por defecto (`admin123`, `user123`). Esto es una vulnerabilidad de tipo **CWE-259** (Hard-coded Password).

### 2. Impacto
- Cualquier persona con acceso al código fuente puede obtener credenciales válidas
- Exposición de credenciales en el control de versiones (history)
- Posibilidad de acceso no autorizado al panel de administración

### 3. Solución (Parche)
- Se creó archivo `.env` para almacenar credenciales como variables de entorno
- Se creó `.env.example` como plantilla (sin valores sensibles)
- Se modificó el código para leer credenciales desde `process.env`
- Se verificó que `.env` esté en `.gitignore`

### 4. Commits relacionados
- `87fee00` - fix: move hardcoded credentials to .env file

---

## [ID-002] Broken Access Control - Panel Admin
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
El panel de administración (`/admin`) solo verificaba la contraseña sin validar el rol del usuario. Un usuario con rol `standard` podría acceder al panel de admin si conoce la URL.

### 2. Impacto
- Acceso no autorizado a funcionalidades administrativas
- Posibilidad de eliminar/modificar productos
- Acceso a datos sensibles de pedidos

### 3. Solución (Parche)
- Implementación de sistema RBAC (Role-Based Access Control)
- Middleware de autenticación con tokens de sesión
- Verificación de rol `admin` en rutas protegidas (`/api/admin/pedidos`)

### 4. Commits relacionados
- `df17f91` - feat: implement RBAC, user profiles, search filters and UI improvements

---

## [ID-003] Inyección SQL en Búsqueda de Productos
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
Cualquier endpoint que construya queries SQL concatenando input del usuario es vulnerable a SQL Injection. Un atacante puede manipular la query para extraer datos de otras tablas, modificar registros o destruir la base de datos.

### 2. Impacto
- Extracción de credenciales de la tabla `usuarios` mediante UNION attack
- Bypass de autenticación con `1 OR 1=1`
- Destrucción de datos con `DROP TABLE`

### 3. Prueba de Concepto (PoC)

**Función vulnerable (concatenación directa):**
```javascript
// ❌ NUNCA hacer esto
const sql = `SELECT * FROM productos WHERE id = ${req.params.id}`;
```

**Ataques simulados y resultado:**

| Payload del atacante | Función vulnerable | Función segura |
|---------------------|-------------------|----------------|
| `1` (legítimo) | MacBook Pro ✅ | MacBook Pro ✅ |
| `1 OR 1=1` | Devuelve 1er registro 🚨 | Sin resultado ✅ |
| `0 UNION SELECT id,username,password FROM usuarios LIMIT 1--` | Expone credenciales 🚨 | Sin resultado ✅ |
| `1; DROP TABLE productos--` | Destruye tabla 🚨 | Sin resultado ✅ |

**Demo ejecutable:** `node backend/src/security-demo.js`

### 4. Solución (Parche)
```javascript
// ✅ Prepared statement: el payload NUNCA se interpreta como SQL
const stmt = db.prepare('SELECT * FROM productos WHERE id = ?');
const result = stmt.get(req.params.id); // "1 OR 1=1" → dato literal
```
- Todos los endpoints usan `db.prepare('...').get/all(...params)` con `better-sqlite3`
- Parámetros de precio validados con `parseFloat()`
- Demo completo de ataques neutralizados en `backend/src/security-demo.js`

### 5. Commits relacionados
- `d86a27e` - Merge branch 'feature/search-filters'
- `05a8508` - security-demo.js añadido con PoC completo

---

## [ID-004] Sin Limitación de Rate en Login
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
El endpoint `/api/login` no tenía limitación de intentos, permitiendo ataques de fuerza bruta ilimitados contra las credenciales de usuario.

### 2. Impacto
- Ataques de fuerza bruta para descifrar contraseñas
- Denegación de servicio por sobrecarga de peticiones

### 3. Solución (Parche)
- Implementado rate limiter en memoria en `backend/src/index.js`
- Máximo 5 intentos fallidos por IP antes de bloqueo
- Bloqueo de 15 minutos tras superar el límite
- La respuesta informa de los intentos restantes antes del bloqueo
- Los bloqueos quedan registrados en `access.log`
- El contador se resetea al hacer login correcto

### 4. Commits relacionados
- `0abda08` - fix: add login rate limiting to prevent brute force attacks

---

## [ID-005] Logging Insuficiente
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🟢 Bajo

### 1. Descripción del fallo
No se registraban intentos de acceso fallidos ni acciones importantes en el sistema.

### 2. Impacto
- Dificultad para investigar incidentes de seguridad
- Sin auditoría de acciones administrativas

### 3. Solución (Parche)
- Implementado sistema de logging básico en `access.log`
- Registro de IP, método y URL de cada petición

### 4. Commits relacionados
- `3bddcba` - Merge branch 'feature/logging' with file-upload

---

## [ID-006] Falta de Validación en Subida de Archivos
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
El sistema permite subir archivos sin validación suficiente del tipo de contenido, permitiendo potencialmente subir archivos maliciosos.

### 2. Impacto
- Possible remote code execution
- Subida de archivos maliciosos (webshells, malware)

### 3. Solución (Parche)
- Validación de extensión de archivo (jpeg, jpg, png, gif, webp)
- Validación de MIME type
- Límite de tamaño (5MB para productos, 2MB para avatares)

---

## [ID-007] Contraseñas Sin Hash
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
Las contraseñas se almacenaban en texto plano en la base de datos. Un volcado de la BD exponía todas las credenciales directamente.

### 2. Impacto
- Exposición de contraseñas si la base de datos es comprometida
- Violación de principios de seguridad (OWASP A02)

### 3. Solución (Parche)
- Instalada librería `bcryptjs` (pure JS, compatible con Alpine/Docker)
- Contraseñas hasheadas con bcrypt (10 rondas) en el seed de usuarios
- Login actualizado para usar `bcrypt.compareSync` en vez de comparación directa
- Migración automática al arrancar: si existen contraseñas en texto plano en la BD, se hashean automáticamente

### 4. Commits relacionados
- `0385f5c` - fix: hash passwords with bcrypt and add HTTPS via nginx

---

## [ID-008] Falta de HTTPS
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
La aplicación funcionaba solo sobre HTTP sin cifrado TLS/SSL, exponiendo credenciales y datos en tránsito.

### 2. Impacto
- Interceptación de tráfico (man-in-the-middle)
- Exposición de credenciales en texto plano durante transmisión

### 3. Solución (Parche)
- Añadido servicio nginx como reverse proxy con terminación TLS en `docker-compose.yml`
- Certificado SSL autofirmado (RSA 2048, válido 365 días) en `nginx/certs/`
- nginx escucha en puerto 443 (HTTPS) con TLSv1.2 y TLSv1.3
- HTTP (puerto 80) redirige automáticamente a HTTPS con código 301
- nginx enruta `/api/` al backend y `/` al frontend internamente

### 4. Commits relacionados
- `0385f5c` - fix: hash passwords with bcrypt and add HTTPS via nginx

---

## [ID-010] Broken Access Control en CRUD de Productos
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
Los endpoints `POST`, `PUT` y `DELETE /api/productos` no requerían autenticación. Cualquier persona anónima podía crear, modificar o eliminar productos del catálogo sin necesidad de token.

### 2. Impacto
- Destrucción del catálogo completo desde un script
- Inyección de productos maliciosos con URLs de imagen peligrosas
- Modificación de precios por usuarios no autorizados

### 3. PoC del ataque
```bash
# Sin token, borramos el producto 1
curl -X DELETE http://localhost:3001/api/productos/1   # → 200 OK ❌ (antes del fix)
curl -X DELETE http://localhost:3001/api/productos/1   # → 401 ✅ (después)
```

### 4. Solución (Parche)
Añadidos middlewares `authenticate` + `requireAdmin` a los tres endpoints.

### 5. Commits relacionados
- `pendiente`

---

## [ID-011] IDOR en Endpoints de Pedidos
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
`GET /api/pedidos` y `GET /api/pedidos/:id` eran públicos. Cualquier usuario podía enumerar todos los pedidos y obtener nombre, email y dirección de todos los clientes.

### 2. Impacto
- Extracción masiva de PII (datos personales) de clientes
- Enumeración de pedidos con IDs secuenciales (`/api/pedidos/1`, `/api/pedidos/2`...)

### 3. PoC del ataque
```bash
curl http://localhost:3001/api/pedidos/1
# → {"id":1,"cliente":"Ana García","email":"ana@gmail.com","direccion":"..."} ❌
```

### 4. Solución (Parche)
Añadido middleware `authenticate` a ambos endpoints. Solo usuarios autenticados pueden acceder.

### 5. Commits relacionados
- `pendiente`

---

## [ID-012] IDOR + Price Manipulation en Checkout
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
`POST /api/pedidos` aceptaba el precio enviado por el cliente en el body. Un atacante podía modificar el precio de cualquier producto antes de enviarlo, comprando artículos de 2.000€ por 0.01€.

### 2. Impacto
- Compra de cualquier producto al precio que el atacante decida
- Pérdidas económicas directas para la tienda

### 3. PoC del ataque
```bash
curl -X POST http://localhost:3001/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Hacker","email":"h@x.com","direccion":"Evil St",
       "items":[{"id":1,"cantidad":1,"precio":0.01}]}'
# → Pedido creado con total: 0.01€ en vez de 2249€ ❌
```

### 4. Solución (Parche)
El backend ahora obtiene el precio real de cada producto directamente desde la BD, ignorando completamente el precio enviado por el cliente.
```javascript
const producto = db.prepare('SELECT id, precio FROM productos WHERE id = ?').get(item.id);
total += producto.precio * cantidad; // precio real, no el del cliente
```

### 5. Commits relacionados
- `pendiente`

---

## [ID-013] Information Exposure en Login (intentos_restantes)
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
La respuesta de login fallido incluía el campo `intentos_restantes`, informando al atacante exactamente cuántos intentos de fuerza bruta le quedaban antes del bloqueo.

### 2. Impacto
- El atacante puede gestionar su ataque para no activar el bloqueo
- Confirma implícitamente que el sistema tiene rate limiting y cómo funciona

### 3. Solución (Parche)
Eliminado el campo `intentos_restantes` de la respuesta. Solo se devuelve `{ error: 'Credenciales incorrectas' }`.

### 4. Commits relacionados
- `pendiente`

---

## [ID-009] XSS: Doble Encoding por sanitize() en onChange
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
La función `sanitize()` se llamaba en los handlers `onChange` de los inputs (formulario de checkout y panel admin). Esto causa **doble encoding**: el usuario escribe `O'Brien` y el campo muestra `O&#039;Brien`. Además, es un antipatrón: la sanitización en input no aporta seguridad real porque React ya escapa el output en JSX por defecto.

### 2. Impacto
- UX degradada: caracteres especiales (`'`, `"`, `<`) se muestran como entidades HTML en los campos
- Datos almacenados incorrectamente en BD (con entidades en vez de caracteres reales)

### 3. Prueba de Concepto XSS (PoC)

**¿Por qué React es seguro contra Stored XSS por defecto?**

Cuando React renderiza `{producto.nombre}` en JSX, el valor se inyecta como **nodo de texto** en el DOM, nunca como HTML. Esto hace que cualquier payload XSS quede inerte:

| Payload almacenado en BD | Renderizado por React | ¿Se ejecuta? |
|--------------------------|----------------------|--------------|
| `<script>alert(1)</script>` | Texto literal visible | ❌ No |
| `<img src=x onerror=alert(1)>` | Texto literal visible | ❌ No |
| `<ScRiPt>alert(document.cookie)</ScRiPt>` | Texto literal visible | ❌ No |

**El único vector real de XSS en React sería `dangerouslySetInnerHTML`** — no presente en este proyecto.

### 4. Solución (Parche)
- Eliminado `sanitize(e.target.value)` de todos los `onChange` → reemplazado por `e.target.value`
- Mantenido `sanitize()` en el render como defensa en profundidad
- No se necesita DOMPurify porque no se usa `dangerouslySetInnerHTML`

### 5. Cuándo SÍ usar DOMPurify
Solo si el proyecto necesita renderizar HTML real del servidor:
```tsx
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(htmlContent) }} />
```

### 6. Commits relacionados
- `319624a` - fix: remove sanitize from onChange handlers + add SQLi/XSS security demo

---

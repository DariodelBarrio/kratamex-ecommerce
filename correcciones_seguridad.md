# Correcciones de Seguridad

> Nota de contexto: este documento recoge la evolucion real del hardening del proyecto a lo largo de varias etapas. Algunas vulnerabilidades nacieron cuando la aplicacion todavia usaba una persistencia local basada en SQLite. La arquitectura vigente es Hono + Drizzle + PostgreSQL, asi que las referencias historicas a SQLite deben leerse como contexto de origen del fallo, no como descripcion del stack actual.

## Resumen de Vulnerabilidades

| ID | Título | Nivel | Estado |
|---|---|---|---|
| ID-001 | Credenciales hardcodeadas en código fuente | 🔴 Crítico | ✅ Corregido |
| ID-002 | Broken Access Control — Panel Admin | 🟠 Alto | ✅ Corregido |
| ID-003 | SQL Injection en búsqueda de productos | 🟡 Medio | ✅ Corregido |
| ID-004 | Sin rate limiting en login (fuerza bruta) | 🟡 Medio | ✅ Corregido |
| ID-005 | Logging insuficiente | 🟢 Bajo | ✅ Corregido |
| ID-006 | File upload sin validación de tipo | 🟠 Alto | ✅ Corregido |
| ID-007 | Contraseñas en texto plano → argon2id | 🔴 Crítico | ✅ Corregido |
| ID-008 | Sin HTTPS → nginx + TLS | 🔴 Crítico | ✅ Corregido |
| ID-009 | XSS por doble encoding en onChange | 🟡 Medio | ✅ Corregido |
| ID-010 | CRUD productos sin autenticación | 🔴 Crítico | ✅ Corregido |
| ID-011 | IDOR en pedidos — PII expuesta | 🔴 Crítico | ✅ Corregido |
| ID-012 | Price manipulation en checkout | 🔴 Crítico | ✅ Corregido |
| ID-013 | Information exposure en login (intentos_restantes) | 🟡 Medio | ✅ Corregido |
| ID-014 | IDOR persistente — requireAdmin omitido | 🔴 Crítico | ✅ Corregido |
| ID-015 | Token de sesión débil con Math.random() | 🟠 Alto | ✅ Corregido |
| ID-016 | CORS completamente abierto | 🟠 Alto | ✅ Corregido |
| ID-017 | Information exposure — enumeración de IDs | 🟡 Medio | ✅ Corregido |
| ID-018 | URLs hardcodeadas bypassan HTTPS | 🔴 Crítico | ✅ Corregido |
| ID-019 | Sin rate limiting en checkout — Order Flood | 🟠 Alto | ✅ Corregido |
| ID-020 | nginx sin security headers | 🟠 Alto | ✅ Corregido |
| ID-021 | sanitize() aplicado a URLs rompe links | 🟡 Medio | ✅ Corregido |
| ID-022 | Security headers ausentes en backend | 🟠 Alto | ✅ Corregido |
| ID-023 | Sesiones sin expiración — session hijacking permanente | 🔴 Crítico | ✅ Corregido |
| ID-024 | Stored XSS vía descripción de producto | 🟠 Alto | ✅ Corregido |
| ID-025 | Sin límite de body size — DoS por payload masivo | 🟡 Medio | ✅ Corregido |
| ID-026 | Validación de email ausente en checkout | 🟡 Medio | ✅ Corregido |
| ID-027 | Rate limiting memory leak | 🟡 Medio | ✅ Corregido |
| ID-028 | File upload — nombres predecibles y validación débil | 🟠 Alto | ✅ Corregido |
| ID-029 | Containers Docker corriendo como root | 🟠 Alto | ✅ Corregido |
| ID-030 | nginx — ciphers débiles y sin rate limiting | 🟠 Alto | ✅ Corregido |
| ID-031 | Archivos de base de datos en git | 🔴 Crítico | ✅ Corregido |
| ID-032 | IP spoofing en rate limiting (trust proxy) | 🟡 Medio | ✅ Corregido |
| ID-033 | Static files serving sin protección dotfiles | 🟡 Medio | ✅ Corregido |
| ID-034 | Validaciones manuales inconsistentes → Zod | 🟡 Medio | ✅ Corregido |
| ID-035 | CSP misconfiguration — Google Fonts bloqueadas | 🟡 Medio | ✅ Corregido |
| ID-036 | Sesiones y rate limits en memoria RAM — pérdida en restart | 🟠 Alto | ✅ Corregido |
| ID-037 | handleLogout no invalida sesión en servidor | 🔴 Crítico | ✅ Corregido |

---

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
// ✅ Query parametrizada: el payload NUNCA se interpreta como SQL
await db.select().from(productos).where(eq(productos.id, Number(req.params.id)));
```
- Las consultas expuestas a input externo se resuelven ahora con Drizzle ORM y parámetros tipados
- Los parámetros numéricos se validan antes de llegar a la query
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
- Instalada librería `argon2` (argon2id, ganador del PHC — Password Hashing Competition)
- Contraseñas hasheadas con argon2id (async) en el seed de usuarios
- Login actualizado para usar `argon2.verify()` en vez de comparación directa
- Migración automática al arrancar: si existen contraseñas sin prefijo `$argon2`, se re-hashean

> **Nota**: El proyecto inicialmente usó `bcryptjs` y posteriormente migró a `argon2id` por ser el estándar recomendado actual (OWASP 2025).

### 4. Commits relacionados
- `0385f5c` - fix: hash passwords with bcrypt and add HTTPS via nginx
- `0623527` - fix: replace bcryptjs with argon2id for password hashing

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
- `35c837b` - fix: patch IDOR, broken access control, price manipulation and info exposure

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
- `35c837b` - fix: patch IDOR, broken access control, price manipulation and info exposure

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
- `35c837b` - fix: patch IDOR, broken access control, price manipulation and info exposure

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
- `35c837b` - fix: patch IDOR, broken access control, price manipulation and info exposure

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

## [ID-014] IDOR Persistente en GET /api/pedidos (requireAdmin omitido)
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
El fix ID-011 añadió `authenticate` a `GET /api/pedidos` y `GET /api/pedidos/:id` pero olvidó `requireAdmin`. Un usuario con rol `standard` con token válido podía enumerar todos los pedidos y ver PII (nombre, email, dirección) de todos los clientes.

### 2. Impacto
- Extracción masiva de datos personales de clientes por cualquier usuario registrado
- Enumeración de pedidos por ID secuencial desde una cuenta `standard`

### 3. PoC del ataque
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
  -d '{"username":"user","password":"user123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl http://localhost:3001/api/pedidos -H "Authorization: $TOKEN"
# → Lista completa de pedidos con PII ❌ (antes del fix)
# → HTTP 403 ✅ (después del fix)
```

### 4. Solución (Parche)
Añadido `requireAdmin` a ambos endpoints:
```javascript
app.get('/api/pedidos', authenticate, requireAdmin, ...)
app.get('/api/pedidos/:id', authenticate, requireAdmin, ...)
```

### 5. Commits relacionados
- `20173bb` - fix: IDOR on /api/pedidos, weak token entropy, open CORS, product ID enumeration

---

## [ID-015] Token de Sesión Criptográficamente Débil
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
Los tokens de sesión se generaban con `Math.random()`, que no usa CSPRNG (Cryptographically Secure Pseudo-Random Number Generator). El timestamp del token era predecible desde la cabecera HTTP `Date:`, reduciendo el espacio de búsqueda.

### 2. Impacto
- Un atacante con conocimiento del timestamp aproximado puede reducir el espacio de tokens a ~2^32 valores
- Token predecible = posible session hijacking sin credenciales

### 3. PoC conceptual
```javascript
// Token viejo: "token_1710876123456_k3f9m2x"
// Date: header revela el timestamp → brute-force de la parte random (~36^7 ≈ 78 billones reducibles)
```

### 4. Solución (Parche)
```javascript
// ✅ 256 bits de entropía criptográfica real
const token = crypto.randomBytes(32).toString('hex');
```

### 5. Commits relacionados
- `20173bb` - fix: IDOR on /api/pedidos, weak token entropy, open CORS, product ID enumeration

---

## [ID-016] CORS Completamente Abierto
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
`app.use(cors())` sin configuración permite que cualquier dominio haga peticiones autenticadas a la API, facilitando ataques desde sitios maliciosos.

### 2. Impacto
- Un atacante puede alojar `evil.com` que robe datos usando el token de sesión de la víctima

### 3. Solución (Parche)
```javascript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin === ALLOWED_ORIGIN) return callback(null, true);
    callback(new Error('Origen no permitido por CORS'));
  }
}));
```
- `CORS_ORIGIN` configurado en `.env` (por defecto `https://localhost`)

### 4. Commits relacionados
- `20173bb` - fix: IDOR on /api/pedidos, weak token entropy, open CORS, product ID enumeration

---

## [ID-017] Information Exposure: Enumeración de IDs de Producto en Checkout
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
`POST /api/pedidos` devolvía `"Producto 999 no encontrado"`, revelando si un ID concreto existe en la base de datos. Un atacante podía enumerar todo el catálogo interno sin autenticación.

### 2. Impacto
- Descubrimiento de IDs internos de productos (incluso eliminados o en borrador)
- Facilita ataques IDOR sobre otros endpoints

### 3. PoC del ataque
```bash
for i in $(seq 1 100); do
  curl -s -X POST http://localhost:3001/api/pedidos \
    -d "{\"cliente\":\"x\",\"email\":\"x@x.com\",\"direccion\":\"x\",\"items\":[{\"id\":$i,\"cantidad\":1}]}" \
  | grep -q "no encontrado" && echo "ID $i: no existe"
done
```

### 4. Solución (Parche)
```javascript
// ❌ Antes: return res.status(400).json({ error: `Producto ${item.id} no encontrado` });
// ✅ Después:
return res.status(400).json({ error: 'Uno o más artículos no están disponibles' });
```

### 5. Commits relacionados
- `20173bb` - fix: IDOR on /api/pedidos, weak token entropy, open CORS, product ID enumeration

---

## [ID-018] URLs Hardcodeadas en Frontend Bypassan HTTPS
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
`App.tsx` usaba `http://localhost:3001/api/...` para obtener productos y procesar checkout. Esto bypasea completamente el proxy nginx con TLS, enviando datos sensibles (nombre, email, dirección, carrito) en texto plano. En producción, `localhost:3001` resolvería a la máquina del usuario final, rompiendo la tienda por completo.

### 2. Impacto
- Datos de checkout (PII) transmitidos sin cifrar pese a tener HTTPS configurado
- Tienda completamente inoperativa en cualquier entorno de producción
- HTTPS efectivamente inutilizado para el flujo principal de la aplicación

### 3. PoC del ataque
```bash
# Capturar tráfico de red mientras se hace un pedido:
tcpdump -i lo port 3001 -A 2>/dev/null | grep -i "cliente\|email\|direccion"
# → Datos del cliente visibles en texto plano ❌
```

### 4. Solución (Parche)
```javascript
// ❌ Antes (bypasea nginx/HTTPS):
fetch('http://localhost:3001/api/productos?...')
fetch('http://localhost:3001/api/pedidos', ...)

// ✅ Después (pasa por nginx → HTTPS):
fetch('/api/productos?...')
fetch('/api/pedidos', ...)
```

### 5. Commits relacionados
- `c80d987` - fix: hardcoded HTTP URLs, checkout flood, nginx security headers, sanitize on URLs

---

## [ID-019] Sin Rate Limiting en Checkout — Order Flood / DoS
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
`POST /api/pedidos` no tenía ningún límite de peticiones. Cualquier persona podía generar miles de pedidos falsos sin autenticación, saturando la base de datos y el disco del servidor.

### 2. Impacto
- Llenado de disco con registros falsos
- Presión innecesaria sobre la base de datos por escrituras masivas concurrentes
- Denegación de servicio para clientes legítimos

### 3. PoC del ataque
```bash
for i in $(seq 1 10000); do
  curl -s -X POST http://localhost:3001/api/pedidos \
    -d '{"cliente":"bot","email":"x@x.com","direccion":"x","items":[{"id":1,"cantidad":1}]}' &
done
```

### 4. Solución (Parche)
Rate limiter de ventana deslizante: máximo 10 pedidos por IP cada 60 segundos.
```javascript
app.post('/api/pedidos', checkoutRateLimiter, ...)
// → HTTP 429 al superar el límite
```

### 5. Commits relacionados
- `c80d987` - fix: hardcoded HTTP URLs, checkout flood, nginx security headers, sanitize on URLs

---

## [ID-020] nginx Sin Headers de Seguridad (Clickjacking, MIME Sniffing, Sin HSTS)
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
La configuración nginx no emitía ningún header de seguridad estándar, dejando la aplicación expuesta a múltiples vectores:

| Header ausente | Vulnerabilidad |
|---|---|
| `Strict-Transport-Security` | Downgrade HTTP sin HSTS |
| `X-Frame-Options` | Clickjacking vía iframe |
| `X-Content-Type-Options` | MIME sniffing |
| `Content-Security-Policy` | Sin defensa en profundidad XSS |
| `Referrer-Policy` | Fuga de URL completa |

### 2. Solución (Parche)
Añadidos los 5 headers en cada `location` block de nginx (deben repetirse por limitación de herencia de `add_header` en nginx):
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; ..." always;
```

### 3. Commits relacionados
- `c80d987` - fix: hardcoded HTTP URLs, checkout flood, nginx security headers, sanitize on URLs

---

## [ID-021] sanitize() Aplicado a URLs Rompe Links y No Filtra javascript:
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
`sanitize()` se aplicaba a URLs de imágenes de productos (`sanitize(producto.imagen)`). La función codifica `&` → `&amp;`, rompiendo cualquier URL con parámetros. Adicionalmente, no filtra el protocolo `javascript:`, que es el vector real de XSS en atributos `src`/`href`.

### 2. Impacto
- URLs con parámetros rotas (imágenes no cargan)
- Falsa sensación de seguridad: `javascript:alert(1)` pasa sin modificar
- React ya escapa atributos de forma segura, haciendo la sanitización redundante e incorrecta

### 3. Solución (Parche)
```tsx
// ❌ Antes: rompe URLs, no filtra javascript:
<OptimizedImage src={sanitize(producto.imagen)} ...>

// ✅ Después: React gestiona el atributo src de forma segura
<OptimizedImage src={producto.imagen} ...>
```
`sanitize()` solo debe usarse en **contenido de texto** renderizado, nunca en URLs.

### 4. Commits relacionados
- `c80d987` - fix: hardcoded HTTP URLs, checkout flood, nginx security headers, sanitize on URLs

---

## [ID-022] Security Headers Ausentes en Backend Express
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
El servidor Express no emitía ningún header de seguridad propio (`X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`). Además, exponía `X-Powered-By: Express`, facilitando fingerprinting del stack tecnológico.

### 2. Impacto
- Fingerprinting del servidor permite ataques dirigidos a vulnerabilidades conocidas de Express
- Sin protección contra MIME sniffing en respuestas de la API directa (sin pasar por nginx)

### 3. Solución (Parche)
Middleware de seguridad añadido al inicio de la cadena:
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
});
```

---

## [ID-023] Sesiones Sin Expiración — Session Hijacking Permanente
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
Los tokens de sesión almacenados en `sessions = {}` nunca expiraban. Un token robado era válido indefinidamente (hasta reinicio del servidor). No había mecanismo de timeout ni renovación.

### 2. Impacto
- Token robado = acceso permanente sin posibilidad de revocación automática
- Sesiones huérfanas acumulándose en memoria (memory leak)

### 3. Solución (Parche)
- TTL de 8 horas por sesión (`SESSION_TTL = 8 * 60 * 60 * 1000`)
- Campo `createdAt` añadido a cada sesión
- Validación de expiración en el middleware `authenticate`
- Limpieza periódica automática cada 15 minutos con `setInterval`

---

## [ID-024] Stored XSS via Descripción de Producto
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
Los endpoints `POST /api/productos` y `PUT /api/productos/:id` almacenaban los campos `nombre`, `descripcion` y `categoria` sin sanitizar. Un admin malicioso (o un atacante con token admin robado) podía inyectar payloads HTML/JS que se almacenarían en la BD.

### 2. Impacto
- Si el frontend usara `dangerouslySetInnerHTML`, los payloads se ejecutarían
- Defensa en profundidad: sanitizar en backend aunque React escape por defecto

### 3. Solución (Parche)
- Función `sanitizeText()` aplicada a todos los campos de texto almacenados
- Límites de longitud: nombre (200), descripcion (1000), categoria (50), imagen URL (500)
- Validación numérica de precio (rango 0-999999)

---

## [ID-025] Sin Límite de Body Size — DoS por Payload Masivo
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
`express.json()` sin parámetro `limit` aceptaba payloads de tamaño ilimitado. Un atacante podía enviar un JSON de 100MB+ causando agotamiento de memoria.

### 2. Impacto
- Denegación de servicio por agotamiento de memoria del contenedor
- Stack traces del error expuestos al atacante (información sensible)

### 3. Solución (Parche)
```javascript
app.use(express.json({ limit: '10kb' }));
```
- Error handler global añadido para ocultar stack traces:
```javascript
app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload demasiado grande' });
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});
```

---

## [ID-026] Validación de Email Ausente en Checkout
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
`POST /api/pedidos` aceptaba cualquier string como email sin validación de formato. Podía almacenar payloads XSS, strings vacíos o datos arbitrarios en el campo email.

### 2. Impacto
- Datos basura en BD
- Potencial SMTP injection si se implementa envío de emails

### 3. Solución (Parche)
- Validación regex de email en backend: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Límite de longitud: 254 caracteres (RFC 5321)
- Validación de longitud de cliente (200) y dirección (500)
- Límite de 50 items por pedido y cantidad máxima de 999 por item
- Validación duplicada en frontend con `maxLength` en inputs

---

## [ID-027] Rate Limiting Memory Leak
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
Los mapas `loginAttempts` y `checkoutAttempts` almacenaban entradas indefinidamente sin limpieza, causando memory leak progresivo.

### 2. Impacto
- Consumo creciente de memoria con el tiempo
- Potencial OOM (Out of Memory) del contenedor en producción

### 3. Solución (Parche)
- `setInterval` cada 5 minutos limpia entradas expiradas de los 3 mapas de rate limiting
- Rate limiter general (60 req/min por IP) añadido a endpoints públicos (`GET /api/productos`)

---

## [ID-028] File Upload — Nombres Predecibles y Validación Débil
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
Los nombres de archivos subidos usaban `Date.now() + Math.random()`, que es predecible. La validación de extensión con regex parcial (`/jpeg|jpg|png/`) podía ser engañada.

### 2. Impacto
- Nombres de archivo predecibles permiten acceso directo sin enumerar
- Regex parcial podría permitir extensiones como `.jpegx` o similares

### 3. Solución (Parche)
- Nombres generados con `crypto.randomBytes(16).toString('hex')` (128 bits de entropía)
- Regex de extensión anclada: `/^\.(jpe?g|png|gif|webp)$/i`
- Regex de MIME type anclada: `/^image\/(jpe?g|png|gif|webp)$/i`
- Reutilización de funciones `safeFileFilter` y `safeFilename` para ambos uploads

---

## [ID-029] Containers Docker Corriendo como Root
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
Los Dockerfiles de backend y frontend no especificaban `USER`, por lo que los procesos corrían como root dentro del contenedor. Un escape de contenedor daría acceso root al host.

### 2. Impacto
- Container escape → root en host
- Archivos creados con permisos de root

### 3. Solución (Parche)
- `USER node` añadido a ambos Dockerfiles
- `chown -R node:node /app` para permisos correctos
- `mkdir -p src/uploads src/avatars` en backend para que el usuario node pueda escribir
- Healthcheck añadido al backend Dockerfile

---

## [ID-030] nginx — Ciphers Débiles y Sin Rate Limiting
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟠 Alto

### 1. Descripción del fallo
nginx usaba `ssl_ciphers HIGH:!aNULL:!MD5` que incluye ciphers débiles. No tenía rate limiting propio, dependiendo solo del backend. Los endpoints de uploads/avatars no tenían HSTS ni headers de seguridad completos.

### 2. Impacto
- Ciphers débiles podrían ser explotados en ataques de downgrade
- Sin rate limiting en nginx, el backend recibe toda la carga de DDoS
- Uploads servidos sin CSP restrictivo podían ejecutar SVG maliciosos

### 3. Solución (Parche)
- Ciphers actualizados a suite moderna (ECDHE-ECDSA/RSA con AES-GCM y CHACHA20)
- `ssl_prefer_server_ciphers on` y `ssl_session_cache`
- Rate limiting zones: `general` (30r/s burst 50) y `login` (5r/m burst 3)
- CSP restrictivo en uploads: `default-src 'none'; img-src 'self'`
- HSTS en todas las locations
- `server_tokens off` para ocultar versión de nginx
- `client_max_body_size 5m`
- CSP actualizado para permitir imágenes de `images.unsplash.com`

---

## [ID-031] Archivos de Base de Datos en Git
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
`.gitignore` tenía comentada la línea para ignorar `tienda.db`. Archivos de base de datos locales llegaron a estar trackeados en el repositorio, potencialmente con credenciales hasheadas y datos de clientes.

### 2. Impacto
- Datos personales de clientes expuestos en historial de git
- Hashes de contraseñas en el repositorio

### 3. Solución (Parche)
- Descomentado y expandido el patrón en `.gitignore`: `*.db`, `*.sqlite`, `*.sqlite3`

---

## [ID-032] IP Spoofing en Rate Limiting (trust proxy)
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
Express no tenía configurado `trust proxy`, por lo que `req.ip` detrás de nginx devolvía la IP del proxy, no la del cliente real. Todos los usuarios compartían la misma IP para rate limiting.

### 2. Impacto
- Rate limiting bloquea a todos los usuarios cuando uno excede el límite
- O alternativamente, nunca funciona correctamente

### 3. Solución (Parche)
```javascript
app.set('trust proxy', 1);
```
Nginx ya envía `X-Real-IP` y `X-Forwarded-For` correctamente.

---

## [ID-033] Static Files Serving Sin Protección dotfiles
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
`express.static()` para `/uploads` y `/avatars` no restringía acceso a dotfiles (`.env`, `.htaccess`, etc.).

### 2. Solución (Parche)
```javascript
app.use('/uploads', express.static(..., { dotfiles: 'deny' }));
app.use('/avatars', express.static(..., { dotfiles: 'deny' }));
```

---

## [ID-034] Validaciones Manuales Inconsistentes — Reemplazadas por Zod
**Fecha:** 19/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
Las validaciones de input en el backend (Express) y el frontend eran manuales, inconsistentes y propensas a errores de omisión. Ejemplos:
- `POST /api/pedidos` validaba email con regex custom pero no validaba tipos de `items[]`
- `POST /api/productos` no validaba que `precio` fuera un número positivo antes de `parseFloat()`
- El frontend enviaba peticiones sin validar el formulario con reglas consistentes
- Errores de validación devolvían mensajes diferentes según la ruta (inconsistencia de API)

### 2. Impacto
- Payloads inesperados podían llegar a la base de datos o causar errores 500
- Un `precio` de tipo string `"abc"` resultaba en `NaN` siendo almacenado en PostgreSQL
- Sin esquema formal, cualquier campo nuevo añadido al body pasaba sin validar

### 3. Solución (Parche)
Migración a **Zod** + `@hono/zod-validator` en el backend y Zod en el frontend:

**Backend** (`backend/src/schemas.ts`):
```typescript
export const PedidoSchema = z.object({
  cliente:   z.string().min(1).max(200),
  email:     z.string().email().max(254),      // RFC 5321 + formato correcto
  direccion: z.string().min(1).max(500),
  items: z.array(z.object({
    id:       z.number().int().positive(),      // debe ser entero positivo
    cantidad: z.number().int().min(1).max(999), // rango seguro
  })).min(1).max(50),
});

// Aplicado por ruta — Hono devuelve HTTP 400 automáticamente si falla
app.post('/api/pedidos', zValidator('json', PedidoSchema), async (c) => {
  const data = c.req.valid('json'); // tipado completo garantizado
});
```

**Frontend** (`src/App.tsx`, `src/components/ProductoDetalle.tsx`):
```typescript
const result = CheckoutSchema.safeParse(formulario);
if (!result.success) {
  setFormError(result.error.issues[0].message);
  return; // nunca llega al servidor con datos inválidos
}
checkoutMutation.mutate(result.data);
```

Beneficios de seguridad adicionales:
- Imposible almacenar `NaN` o `Infinity` en precio (Zod rechaza con tipo error claro)
- `items` siempre es un array con entre 1 y 50 elementos, nunca `undefined` o `null`
- Mensajes de error uniformes en toda la API

### 4. Commits relacionados
- `d1bed9c` - feat: migrate to Hono + Drizzle ORM + TanStack Query + Zod

---

## [ID-035] CSP Misconfiguration — Google Fonts Bloqueadas
**Fecha:** 22/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
El header `Content-Security-Policy` en nginx incluía `font-src 'self' https://fonts.gstatic.com` pero omitía `https://fonts.googleapis.com` en `style-src`. El frontend carga las fuentes Inter y JetBrains Mono mediante `@import url('https://fonts.googleapis.com/...')` en los ficheros CSS. Al no estar permitido ese origen en `style-src`, los navegadores bloqueaban silenciosamente las hojas de estilo externas, degradando la tipografía de toda la aplicación.

### 2. Impacto
- La fuente Inter (interfaz principal) y JetBrains Mono (panel SOC) no se cargan
- El navegador hace fallback a la fuente del sistema sin avisar al usuario
- Error silencioso: no produce un fallo visible pero sí una violación de CSP en la consola del desarrollador

### 3. Diagnóstico
```
# En la consola del navegador:
Refused to load the stylesheet 'https://fonts.googleapis.com/css2?...'
because it violates the following Content Security Policy directive:
"style-src 'self' 'unsafe-inline'"
```

### 4. Solución (Parche)
Añadido `https://fonts.googleapis.com` a la directiva `style-src` en `nginx/nginx.conf`:

```nginx
# ❌ Antes:
add_header Content-Security-Policy "... style-src 'self' 'unsafe-inline'; ..." always;

# ✅ Después:
add_header Content-Security-Policy "... style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ..." always;
```

> **Nota**: `fonts.gstatic.com` ya estaba en `font-src` (carga los archivos `.woff2`). El problema era solo la hoja de estilo CSS inicial que sirve `fonts.googleapis.com`.

---

## [ID-036] Sesiones y Rate Limits en Memoria RAM — Pérdida en Restart
**Fecha:** 22/03/2026
**Nivel de Riesgo:** 🟠 Alto
**Estado:** ⚠️ Conocido — pendiente de corrección

### 1. Descripción del fallo
Las sesiones de usuario y los contadores de rate limiting se almacenan en objetos JavaScript en memoria (`const sessions = {}`, `const loginAttempts = {}`). Al reiniciar el servidor (deployment, crash, Docker restart), toda esta información se pierde:

- Todos los usuarios autenticados quedan deslogueados
- Los bloqueos de IP por fuerza bruta se resetean

### 2. Impacto
- **Bypass de rate limiting**: un atacante que provoque un crash del servidor (vía DoS o error) elimina sus propios bloqueos activos y puede reanudar un ataque de fuerza bruta desde cero
- **DoS de sesiones**: un restart forzado deja a todos los usuarios sin sesión simultáneamente
- **No escalable**: en un entorno con múltiples instancias del backend, cada instancia tiene su propio `sessions = {}`, haciendo imposible el balanceo de carga

### 3. PoC del impacto
```bash
# 1. Atacante genera 11 intentos de login fallidos → queda bloqueado
# 2. Atacante envía un payload malformado que causa un error 500 y restart del proceso
# 3. loginAttempts = {} → bloqueo eliminado → puede continuar el ataque
```

### 4. Solución prevista
Persistir sesiones y contadores de rate limiting en PostgreSQL (ya disponible en el stack):

```sql
-- Tabla de sesiones persistentes
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Tabla de intentos de login por IP
CREATE TABLE login_attempts (
  ip           TEXT PRIMARY KEY,
  count        INTEGER DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ DEFAULT NOW()
);
```

Alternativa: usar **Redis** como store de sesiones para mayor rendimiento (O(1) en lecturas).

### 5. Mitigación actual
- TTL de 8 horas por sesión reduce la ventana de exposición (ID-023)
- El rate limiting de nginx actúa como primera línea independiente del proceso Node.js

---

## [ID-037] handleLogout no invalida sesión en servidor
**Fecha:** 29/03/2026
**Nivel de Riesgo:** 🔴 Crítico
**Estado:** ✅ Corregido

### 1. Descripción del fallo
En `frontend/src/App.tsx`, la función `handleLogout` eliminaba el token del `localStorage` **antes** de usarlo en la llamada `fetch('/api/logout')`:

```typescript
// ❌ Antes — VULNERABLE
const handleLogout = useCallback(() => {
  localStorage.removeItem('kratamex_token')   // token eliminado aquí
  localStorage.removeItem('kratamex_user')
  setAuthUser(null)
  fetch('/api/logout', {
    method: 'POST',
    headers: { Authorization: localStorage.getItem('kratamex_token') || '' }
    // ↑ siempre envía cadena vacía — sesión nunca invalidada en servidor
  })
}, [])
```

### 2. Impacto
- La sesión del usuario permanecía activa en el servidor hasta que expirara su TTL de 8 horas
- Un atacante con acceso al token podía continuar usándolo tras el logout visible del usuario
- El `POST /api/logout` recibía `Authorization: ''`, nunca encontraba la sesión y no la eliminaba de `sessions{}`

### 3. Solución (Parche)

```typescript
// ✅ Después — CORREGIDO
const handleLogout = useCallback(() => {
  const token = localStorage.getItem('kratamex_token')  // guardar antes de borrar
  localStorage.removeItem('kratamex_token')
  localStorage.removeItem('kratamex_user')
  setAuthUser(null)
  fetch('/api/logout', {
    method: 'POST',
    headers: { Authorization: token || '' }  // token correcto
  })
}, [])
```

### 4. Archivos afectados
- `frontend/src/App.tsx` — función `handleLogout`

### 5. Tests actualizados
Se corrigieron 2 tests en `frontend/src/test/App.test.tsx` que verifican el flujo de login/logout. Los tests ahora abren el menú desplegable de usuario antes de interactuar con sus elementos, alineándose con el nuevo diseño de `StoreHeader`.

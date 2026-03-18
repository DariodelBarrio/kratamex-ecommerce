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
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🟡 Medio

### 1. Descripción del fallo
El endpoint `/api/productos` permite filtros de búsqueda que podrían ser vulnerables a inyección SQL si no se usan prepared statements correctamente.

### 2. Impacto
- Posibilidad de extraer datos sensibles de la base de datos
- Manipulación de consultas SQL

### 3. Solución (Parche)
- Uso de prepared statements con parámetros binds
- Validación de tipos (parseFloat para precios)

### 4. Commits relacionados
- `d86a27e` - Merge branch 'feature/search-filters'

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
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
Las contraseñas se almacenan en texto plano en la base de datos.

### 2. Impacto
- Exposición de contraseñas si la base de datos es comprometida
- Violación de principios de seguridad

### 3. Solución (Parche)
- No implementado aún (necesario para producción)

---

## [ID-008] Falta de HTTPS
**Fecha:** 18/03/2026
**Nivel de Riesgo:** 🔴 Crítico

### 1. Descripción del fallo
La aplicación funciona solo sobre HTTP sin cifrado TLS/SSL.

### 2. Impacto
- Interceptación de tráfico (man-in-the-middle)
- Exposición de credenciales en texto plano durante transmisión

### 3. Solución (Parche)
- No implementado aún (necesario para producción)

---

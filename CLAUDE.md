# CLAUDE.md — Proyecto Web

## Modelo a usar — regla de oro

SIEMPRE empieza con Haiku para:
- Orquestar y decidir qué delegar
- Tareas simples y mecánicas
- Verificar resultados de delegaciones
- Respuestas cortas y confirmaciones
- Leer archivos y reportes

Escala a Sonnet SOLO cuando:
- Haiku falla o da resultado incorrecto
- La tarea requiere razonamiento complejo
- Hay lógica de negocio crítica (pagos, auth)
- Yo te lo pida explícitamente

NUNCA uses Opus salvo que yo lo pida expresamente.

Antes de cada tarea pregúntate:
¿Puede Haiku hacer esto bien? → úsalo
¿Necesita razonamiento profundo? → Sonnet
¿Es crítico para el negocio? → Sonnet

## Sistema de delegación de tareas

Antes de cualquier tarea evalúa la complejidad y SIEMPRE pregúntame
antes de delegar con este formato exacto:
"Esta tarea [descripción] es [mecánica/análisis/refactor/compleja].
¿La delego a [modelo] para ahorrar tokens?"

### Delega a Groq — mecánico y predecible:
- Issues SonarCloud Minor/Major (replaceAll, Readonly, globalThis, parseInt)
- Cambios repetitivos en múltiples archivos
- Tests simples con patrón fijo
- Formateo y limpieza de código

### Delega a Codestral — refactors de código:
- Reducir cognitive complexity
- Extraer funciones anidadas
- Ternarios anidados
- Refactors sin lógica de negocio

### Delega a Gemini — análisis y lectura:
- Explicar reportes de CI
- Analizar cobertura de tests
- Resumir documentación
- Cualquier tarea de solo lectura

### Delega a OpenRouter — fallback:
- Cuando otro modelo falla
- Como segunda opinión

### NUNCA delegues — siempre Claude:
- Carrito, pagos, checkout
- Auth, permisos, sesiones
- Bugs con lógica compleja
- Seguridad en general
- Cuando el resultado no es fácil de verificar
- Cuando otro modelo ha fallado ya

### Verificación obligatoria tras cada delegación:
1. npx tsc --noEmit
2. npx vitest run
3. Si falla → reviértelo y hazlo tú Claude
4. Si pasa → commitea

### Reglas de conversación para no quemar tokens:
- Máximo 15 mensajes por conversación
- Tasks grandes → divídelos en subtareas pequeñas
- Solo el fragmento de código relevante, nunca el archivo entero
- Una feature por conversación

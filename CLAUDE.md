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

## ⚠️ Delegación de tareas — DESACTIVADA (temporalmente)

**MOTIVO**: Las APIs gratuitas (Groq, Gemini, etc.) se gastan en el autofix nocturno.
Mejor preservarlas íntegras para la ejecución automática del autofix cada medianoche.

Mientras el autofix esté activo:
- **Todo lo maneja Claude** (yo) durante el día
- Las APIs se regeneran para el autofix nocturno
- Máxima capacidad para fixes automáticos

Si después se agota el autofix o hay cambios de estrategia, reactivar delegación.

### Reglas de conversación para no quemar tokens:
- Máximo 15 mensajes por conversación
- Tasks grandes → divídelos en subtareas pequeñas
- Solo el fragmento de código relevante, nunca el archivo entero
- Una feature por conversación

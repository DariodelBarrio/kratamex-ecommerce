# Sistema de Autofix Automatizado

## Estado actual

Documento alineado con la implementacion real del repositorio a fecha `2026-04-03`.

El repositorio ya tiene un autofix real basado en IA y validacion local antes de commitear.

Workflows activos:

- `.github/workflows/sonarcloud-autofix.yml`
- `.github/workflows/groq-autofix.yml`
- script compartido: `.github/scripts/groq-autofix.mjs`

## Que hace hoy

El sistema actual:

1. lee un issue concreto desde `repository_dispatch` o escanea issues abiertos en SonarCloud
2. agrupa issues por archivo
3. limita el alcance a `frontend/src/*` y `backend/src/*`
4. construye un prompt con archivo actual e issues de SonarCloud
5. prueba proveedores LLM configurados por orden de disponibilidad
6. valida cada propuesta con `npx tsc --noEmit` en `frontend/` o `backend/`
7. solo deja el cambio si el archivo sigue compilando
8. ejecuta `npm run build` y `npm run test` antes de hacer commit en GitHub Actions
9. commitea y hace push solo si hubo cambios reales y validos

## Workflows

### 1. `sonarcloud-autofix.yml`

Uso principal:

- trigger por `repository_dispatch`
- trigger manual por `workflow_dispatch`
- pensado para arreglar un issue concreto enviado desde SonarCloud o desde otro integrador

Payload soportado:

```json
{
  "issueKey": "AXXXX",
  "message": "Descripcion del issue",
  "filePath": "frontend/src/algo.tsx",
  "line": 42,
  "rule": "typescript:SXXXX",
  "severity": "MAJOR"
}
```

Si `filePath` llega en el payload, el script intenta arreglar solo ese archivo. Si no llega, hace barrido de issues abiertos en SonarCloud.

### 2. `groq-autofix.yml`

Uso secundario:

- trigger programado cada 4 horas
- sin `workflow_dispatch` para evitar duplicidad manual con el workflow principal
- hace un barrido completo de issues abiertos en SonarCloud usando el mismo script compartido

## Script real

Archivo: `.github/scripts/groq-autofix.mjs`

Capacidades actuales:

- soporte para issue puntual por variables `ISSUE_*`
- fallback entre multiples proveedores
- normalizacion de respuesta de modelo
- filtros de elegibilidad por carpeta, tamano y numero de issues por archivo
- validacion TypeScript antes de aceptar el parche
- escritura de resumen en `GITHUB_STEP_SUMMARY`
- export de `fixed_count` y `attempted_count` a `GITHUB_OUTPUT`

## Proveedores soportados

El script usa solo las claves realmente configuradas. Si una API key no existe, ese proveedor no entra en la cadena de intento.

Proveedores soportados:

- Groq
- Gemini
- OpenRouter
- DeepSeek
- Together
- Mistral
- Replicate
- Cohere
- HuggingFace

## Validacion

Validacion por archivo:

- `backend/*` -> `cd backend && npx tsc --noEmit`
- `frontend/*` -> `cd frontend && npx tsc --noEmit`

Validacion posterior en GitHub Actions cuando hubo fixes:

- `npm run build`
- `npm run test`

## Causa del comportamiento inestable anterior

El comportamiento de "se arregla y luego reaparece" venia de una combinacion de problemas:

- habia dos workflows distintos para autofix con logica y validaciones diferentes
- uno de ellos seguia permitiendo ejecucion manual duplicada y el otro respondia a eventos externos
- la documentacion no reflejaba el estado real, lo que ocultaba la duplicidad
- el workflow principal anterior no ejecutaba el script de autofix real de extremo a extremo

Con la unificacion actual:

- el workflow por evento/manual se usa para issue puntual
- el workflow programado se usa para barrido completo
- ambos comparten el mismo script y las mismas validaciones finales

## Condiciones para commitear

El workflow solo commitea si se cumplen todas:

- el script produjo al menos un archivo corregido
- existe diff real en git
- build y tests del workspace pasan

## Limitaciones reales

Lo que sigue sin ser cierto:

- no existe garantia de fix para todos los issues de SonarCloud
- no hay analisis semantico multiarchivo profundo
- no hay rollback selectivo por hunk; el rollback es por archivo
- no se corrigen archivos fuera de `frontend/src` y `backend/src`

## Secretos necesarios

Minimos:

- `SONAR_TOKEN`
- `SONAR_PROJECT_KEY`
- al menos una API key de proveedor LLM

Opcionales:

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `DEEPSEEK_API_KEY`
- `TOGETHER_API_KEY`
- `MISTRAL_API_KEY`
- `REPLICATE_API_KEY`
- `COHERE_API_KEY`
- `HUGGINGFACE_API_KEY`

## Archivos relacionados

- `.github/workflows/sonarcloud-autofix.yml`
- `.github/workflows/groq-autofix.yml`
- `.github/scripts/groq-autofix.mjs`
- `sonar-project.properties`

## Ultima actualizacion

`2026-04-03`

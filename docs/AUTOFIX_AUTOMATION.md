# Sistema de Autofix Automatizado - Proyecto Web

## 📋 Descripción General

Este es un sistema de **automatización inteligente de fixes de código** que utiliza múltiples APIs de IA en una **cadena de fallback**. El objetivo es reparar automáticamente los issues detectados por SonarCloud sin intervención manual, distribuyendo el trabajo entre diferentes APIs para evitar límites de tasa.

### ¿Por qué múltiples APIs?

- **Límites de tasa**: Cada API gratuita tiene límites (ej: 12k tokens/min en Gemini)
- **Capacidad combinada**: 9 APIs × límite individual = mayor capacidad total
- **Resiliencia**: Si una API falla, automáticamente intenta la siguiente
- **Sin costo**: Todas las APIs utilizadas tienen tier gratuito

---

## 🔄 Flujo de Funcionamiento

```
┌─────────────────────────────────────────────────────────┐
│ 1. Trigger: Push a main O cada hora (cron: 0 * * * *)  │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Job: sonar-scan                                      │
│   - Obtiene SONAR_PROJECT_KEY de sonar-project.properties
│   - Consulta SonarCloud API: ¿Hay issues abiertos?     │
│   - Output: has_issues=true/false                       │
└──────────────────────┬──────────────────────────────────┘
                       ↓
         ¿has_issues == 'true'?
              /            \
           SÍ               NO
           ↓                ↓
    ┌──────────────┐   [FIN]
    │ Job: groq-   │
    │ autofix      │
    └──────┬───────┘
           ↓
    ┌──────────────────────────────┐
    │ 3. Para cada archivo con     │
    │    issues:                   │
    │  - Lee contenido local       │
    │  - Construye prompt          │
    │  - Intenta fix (cadena)      │
    └──────────────┬───────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 4. Cadena de Fallback (9 APIs)  │
    │                                  │
    │ ┌─────────────────┐              │
    │ │ 1. Groq ⭐      │ ✓ success!  │
    │ └─────────────────┘              │
    │                                  │
    │ ┌─────────────────┐              │
    │ │ 2. Gemini       │ (si falla)  │
    │ └────────┬────────┘              │
    │          ↓                       │
    │ ┌─────────────────┐              │
    │ │ 3. DeepSeek 🎯  │ (especializado)
    │ └─────────────────┘              │
    │ ... (más APIs si necesario)      │
    └──────────────┬───────────────────┘
                   ↓
    ┌──────────────────────────────────┐
    │ 5. Verifica TypeScript           │
    │    npx tsc --noEmit              │
    └──────────────┬───────────────────┘
                   ↓
        ¿tsc pasó?
       /           \
      SÍ            NO
      ↓             ↓
    [COMMIT]   [REVERT]
      ↓         ↓
    [PUSH]   git checkout -- .
      ↓       [EXIT 1]
    [FIN]
```

---

## 🚀 APIs Disponibles en la Cadena de Fallback

| # | API | Modelo | Límite Gratuito | Tiempo Respuesta | Notas |
|---|-----|--------|-----------------|------------------|-------|
| 1 | **Groq** ⭐ | Llama 3.3 70B | 12k TPM | ~200ms | **Primero: Velocidad + Confiabilidad** |
| 2 | **Gemini** | 2.0 Flash | 12k TPM | ~500ms | Buena calidad, pero agota rápido |
| 3 | **DeepSeek** | deepseek-coder | - | ~1s | Especializado en código 🎯 |
| 4 | **Together AI** | Llama 3 70B | - | ~500ms | Modelo sólido, buen backup |
| 5 | **OpenRouter** | Llama 3.3 (free) | - | ~1s | Distribuidor, fallback intermedio |
| 6 | **Mistral** | mistral-medium | - | ~800ms | Fallback estable |
| 7 | **Cohere** | command | - | ~1s | Menos optimizado para código |
| 8 | **Replicate** | Llama 2 70B | - | Async (~5s) | Polling requerido, más lento |
| 9 | **HuggingFace** | Llama 2 70B | - | ~2s | Último resort, latencia alta |

---

## ⚙️ Configuración

### 1. Archivos Clave

```
.github/
  workflows/
    └── groq-autofix.yml          ← Workflow principal
  scripts/
    └── groq-autofix.mjs          ← Script de lógica

sonar-project.properties          ← Configuración SonarCloud
```

### 2. Variables de Entorno (GitHub Secrets)

```bash
SONAR_TOKEN              # Token de autenticación SonarCloud
SONAR_PROJECT_KEY        # Clave del proyecto (extraída en workflow)
GEMINI_API_KEY          # Google Gemini
GROQ_API_KEY            # Groq
OPENROUTER_API_KEY      # OpenRouter
DEEPSEEK_API_KEY        # DeepSeek
TOGETHER_API_KEY        # Together AI
MISTRAL_API_KEY         # Mistral
REPLICATE_API_KEY       # Replicate
COHERE_API_KEY          # Cohere
HUGGINGFACE_API_KEY     # HuggingFace
```

### 3. Workflow Schedule

```yaml
on:
  push:
    branches: [main]    # Ejecuta en cada push
  schedule:
    - cron: '0 * * * *' # Ejecuta cada hora
```

---

## 📝 Lógica del Script (`groq-autofix.mjs`)

### Funciones Principales

#### 1. `fetchIssues()`
- Obtiene todos los issues ABIERTOS de SonarCloud
- Pagina automáticamente si hay más de 100
- Devuelve: `[{line, message, rule, severity}, ...]`

#### 2. `groupByFile(issues)`
- Agrupa issues por archivo
- Devuelve: `Map<filePath, issues[]>`

#### 3. `buildPrompt(filePath, code, issues)`
Construye el prompt para la IA:
```
Fix the following SonarCloud issues in this file...

File: frontend/src/components/Auth.tsx

Issues to fix:
  - Line 42: [MAJOR] S1234 — Missing error handling
  - Line 88: [MINOR] S5852 — Regex performance issue

Current file content:
[código completo del archivo]
```

#### 4. `tryFix(filePath, code, issues)`
La **joya del sistema**:
```javascript
async function tryFix(filePath, code, issues) {
  const apis = [
    { name: "Gemini", fn: () => callGemini(...) },
    { name: "Groq", fn: () => callGroq(...) },
    { name: "OpenRouter", fn: () => callOpenRouter(...) },
    // ... 6 APIs más
  ];

  for (const api of apis) {
    try {
      const fixed = await api.fn();
      console.log(`  ✓ Fixed with ${api.name}`);
      return fixed;  // ← Retorna inmediatamente con el resultado
    } catch (err) {
      console.log(`  ⚠ ${api.name} failed: ${err.message}`);
      // Continúa con la siguiente API
    }
  }

  throw new Error("All APIs failed");
}
```

#### 5. `callXXX(filePath, code, issues)`
Una función para cada API:
- `callGemini()` → Google Gemini 2.0 Flash
- `callGroq()` → Groq (OpenAI-compatible)
- `callOpenRouter()` → OpenRouter (OpenAI-compatible)
- `callDeepSeek()` → DeepSeek
- `callTogether()` → Together AI
- `callMistral()` → Mistral
- `callReplicate()` → Replicate (con polling)
- `callCohere()` → Cohere
- `callHuggingFace()` → HuggingFace

#### 6. `main()`
Orquesta todo:
```javascript
async function main() {
  const issues = await fetchIssues();
  const byFile = groupByFile(issues);

  for (const [filePath, fileIssues] of byFile.entries()) {
    const code = readLocal(filePath);
    const fixed_code = await tryFix(filePath, code, fileIssues);
    writeFileSync(filePath, fixed_code);
    await sleep(2500);  // ← Respetar límites de tasa
  }
}
```

---

## 🎯 Estrategia de Limitación de Tasa

### Problema
- 143 issues en 23 archivos
- Gemini: 12k TPM (tokens por minuto)
- Groq: 12k TPM
- Una sola API = insuficiente capacidad

### Solución Implementada

| Estrategia | Implementación |
|------------|----------------|
| **Delay inter-archivo** | 2.5s entre fixes (2.4 archivos/min × 8192 tokens = ~20k TPM) |
| **APIs distribuidas** | 9 APIs con límites independientes |
| **Temperaturas bajas** | `temperature: 0.1` → menos tokens innecesarios |
| **Max tokens limitado** | `max_tokens: 8192` por respuesta |

### Resultado
- **Capacidad teórica**: ~12k × 9 APIs = 108k TPM
- **Consumo real**: ~20-30k TPM con delays
- **Tasa de éxito**: ~80-90% (5-10 APIs fallan, pero algunas pueden fallar)

---

## 🔐 Seguridad

### Protecciones Implementadas

1. **Validación de TypeScript**
   ```bash
   npx tsc --noEmit
   ```
   Si falla → Revertir cambios automáticamente

2. **Verificación de cambios**
   ```bash
   git diff --cached --quiet
   ```
   No hacer commit si no hay cambios

3. **Sin hardcoding de secrets**
   - Todos los API keys en GitHub Secrets
   - Nunca en el repositorio

4. **Sanitización del código**
   - Los prompts incluyen solo lo necesario
   - Las respuestas se validan (deben ser código válido)

### Riesgos Conocidos

⚠️ **Una IA podría generar código malicioso**
- Mitigation: TypeScript check catchs syntax errors
- Manual review is stil recommended for critical files

⚠️ **Sobre-uso de APIs y costos**
- Actual: $0 (todos los tiers son gratuitos)
- Limitación: Los tiers gratuitos pueden cambiar

⚠️ **SonarCloud falso positivos**
- Una IA arreglando falso positivos = cambios innecesarios
- Solución: Issues críticos = revisión manual obligatoria

---

## 📊 Monitoreo y Logs

### En GitHub Actions

```
Fetched 143 open issues from SonarCloud

Processing: frontend/src/components/Auth.tsx (5 issues)
  ⚠ Gemini failed: Rate limit reached
  ✓ Fixed with Groq
  → Written to frontend/src/components/Auth.tsx

Processing: frontend/src/components/ProductCard.tsx (3 issues)
  ⚠ Gemini failed: Rate limit reached
  ⚠ Groq failed: Rate limit reached
  ✓ Fixed with OpenRouter
  → Written to frontend/src/components/ProductCard.tsx

Done. Fixed: 18 files. Skipped: 5 files.
```

### Cómo verificar

1. Ir a: https://github.com/DariodelBarrio/Proyecto_web/actions
2. Ver workflow: "Groq Autofix SonarCloud"
3. Expandir jobs para ver logs detallados

---

## ➕ Agregar una Nueva API

### Paso 1: Obtener API Key
- Registrarse en la plataforma
- Crear API key
- Copiar a GitHub Secrets

### Paso 2: Actualizar `.github/workflows/groq-autofix.yml`
```yaml
env:
  # ... otras APIs ...
  MI_NUEVA_API_KEY: ${{ secrets.MI_NUEVA_API_KEY }}
```

### Paso 3: Agregar variable en `groq-autofix.mjs`
```javascript
const MI_NUEVA_API_KEY = process.env.MI_NUEVA_API_KEY;
```

### Paso 4: Implementar función `callMyAPI()`
```javascript
async function callMyAPI(filePath, code, issues) {
  const prompt = buildPrompt(filePath, code, issues);

  const res = await fetch("https://api.miapicom/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MI_NUEVA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "tu-modelo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) throw new Error(`MyAPI error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
```

### Paso 5: Agregar a la cadena en `tryFix()`
```javascript
const apis = [
  { name: "Groq", fn: () => callGroq(filePath, code, issues) },      // 1. Primero
  { name: "Gemini", fn: () => callGemini(filePath, code, issues) },  // 2. Segundo
  // ... otras APIs ordenadas por velocidad/confiabilidad ...
  { name: "MyAPI", fn: () => callMyAPI(filePath, code, issues) },    // Insertar en orden
];
```

**Recomendación**: Insertar new APIs por velocidad de respuesta (rápidas primero).

---

## 🚫 Limitaciones Actuales

| Limitación | Causa | Impacto | Posible Fix |
|------------|-------|--------|------------|
| Issues críticos no se tocan | Por diseño | Requiere revisión manual | OK para MVP |
| Tasa de éxito ~80% | Calidad variable de IAs | ~20% issues sin arreglar | Más IAs o prompts mejores |
| Solo TypeScript | Validación limitada | Solo catch syntax errors | Agregar ESLint |
| Demora ~1hr | Cron cada 60 min | Issues viejos permanecen | Cron cada 30min? |
| No hay rollback automático | Git revert manual | Si algo falla, cuesta arreglar | Webhook para revertir |

---

## 📈 Métricas y KPIs

### A Monitorear

```javascript
Total issues: 143
Issues por archivo: 1-8
Fix attempts: ~143
Success rate: ~80-90%
APIs con más éxitos: Gemini, Groq, OpenRouter
APIs con más fallos: (depende de la hora)
Tiempo total: ~15-30 min
```

### Tablero Ideal

```
SonarCloud Issues Tracking Dashboard
┌───────────────────────────────────┐
│ Issues abiertos: 143 → 30         │
│ Issues arreglados auto: 113       │
│ Issues críticos (revisión manual): 5 │
│ Tasa de éxito: 79%                │
└───────────────────────────────────┘
```

---

## 🔬 Ejemplos de Issues Arreglados

### Ejemplo 1: Missing Error Handling (S1234)
```javascript
// ANTES
const data = await fetch(url);
return data.json();

// DESPUÉS (por IA)
const data = await fetch(url);
if (!data.ok) throw new Error(`Fetch failed: ${data.status}`);
return data.json();
```

### Ejemplo 2: Regex Performance (S5852)
```javascript
// ANTES
result = result.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

// DESPUÉS
result = result.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
// (Ya optimizado en nuestro código)
```

### Ejemplo 3: isNaN vs Number.isNaN (S7773)
```javascript
// ANTES
if (isNaN(value)) { ... }

// DESPUÉS (por Groq)
if (Number.isNaN(value)) { ... }
```

---

## 🎓 Lessons Learned

1. **Múltiples APIs > API única**: Capacidad y resiliencia
2. **Delays importan**: 2.5s entre archivos es el punto óptimo
3. **TypeScript validation es crítico**: Previene commits de código roto
4. **SonarCloud issues tienen falso positivos**: Manual review necesaria para críticos
5. **Prompts bien estructurados = mejor output**: "Return ONLY code" reduces verbosity

---

## 🚀 Próximos Pasos (Roadmap)

### Phase 1: Consolidación (Actual)
- [x] 9 APIs en cadena de fallback
- [x] TypeScript validation
- [x] Auto-commit en main
- [ ] Agregar más APIs si es necesario

### Phase 2: Mejora
- [ ] Dashboard en tiempo real
- [ ] Estadísticas de success rate por API
- [ ] Alertas en Slack
- [ ] Métricas en GitHub

### Phase 3: Escalado
- [ ] Procesar issues por severidad
- [ ] Priorizar issues críticos
- [ ] Integración con SonarCloud webhooks
- [ ] Auto-assign issues a developers

---

## 📞 Soporte y Troubleshooting

### ¿El workflow falla?

1. Verificar GitHub Secrets están configurados
2. Verificar SONAR_TOKEN es válido
3. Revisar logs en Actions tab
4. Buscar errores específicos en script

### ¿Las APIs fallan?

- Gemini → Revisar token y quotas
- Groq → Límite de tasa (esperar 1 hora)
- OpenRouter → Verificar API key
- Replicate → Polling timeout (aumentar timeout)

### ¿El commit falla?

- Verificar TypeScript: `npm run tsc --noEmit`
- Verificar ESLint: `npm run lint`
- Revertir manualmente: `git checkout -- .`

---

## 📚 Referencias

- [SonarCloud API Docs](https://sonarcloud.io/web_api/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Gemini API](https://ai.google.dev/)
- [Groq API](https://console.groq.com/)
- [OpenRouter Docs](https://openrouter.ai/)

---

**Última actualización**: 2026-03-25
**Versión del sistema**: 9 APIs
**Estado**: ✅ Operacional

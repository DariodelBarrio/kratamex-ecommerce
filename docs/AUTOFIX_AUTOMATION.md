# Sistema de Autofix Automatizado - Proyecto Web

**Última actualización**: 2026-03-26
**Versión**: 2.1 (Schedule cada 4h — repo público, minutos ilimitados)
**Estado**: ✅ Operacional y en presupuesto GitHub Actions

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
┌──────────────────────────────────────────────────────────┐
│ 1. Trigger: Schedule diaria (cron: 0 0 * * *)           │
│    (SIN push trigger — solo medianoche UTC)             │
└──────────────────────┬───────────────────────────────────┘
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

### 3. Workflow Schedule (Cada 4 horas)

```yaml
on:
  schedule:
    # Ejecuta cada 4 horas — repo público = minutos ilimitados en GitHub Actions
    - cron: '0 */4 * * *'
```

**Por qué cada 4 horas:**
- El repositorio es **público** → GitHub Actions es gratuito e ilimitado
- Los límites diarios de las APIs (RPD) se recuperan gradualmente
- Si una ejecución satura a mitad, la siguiente (4h después) retoma con APIs recuperadas
- 6 ejecuciones/día × 25 min = ~150 min/día (sin restricción en repo público)

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

## 🎯 Estrategia de Limitación de Tasa (Optimizada)

### Problema Original
- 143 issues en 23 archivos
- Gemini: 12k TPM (tokens por minuto)
- Groq: 12k TPM
- Una sola API = insuficiente capacidad

### Evolución de la Solución
1. **Intento 1**: Delay de 2.5s entre fixes → Gemini agotado en 2 archivos
2. **Intento 2**: Delay de 60s + agregar más APIs → Mejor, pero aún insuficiente
3. **Intento 3**: Delay de 90s + ajustar modelo → Más estable
4. **Intento Final**: Delay de 120s + 9 APIs + schedule diaria → **Operacional**

### Solución Implementada (Final)

| Estrategia | Implementación | Justificación |
|------------|----------------|---------------|
| **Delay inter-archivo** | **120 segundos** (2 minutos) | Distribuye carga: ~2 archivos/min × 8192 tokens ≈ 15-20k TPM |
| **APIs distribuidas** | 9 APIs con límites independientes | Capacidad total ~108k TPM en fallback chain |
| **Temperaturas bajas** | `temperature: 0.1` | Reduce verbosidad, menos tokens desperdiciados |
| **Max tokens limitado** | `max_tokens: 8192` por respuesta | Previene respuestas excesivas |
| **Schedule cada 4h** | `cron: '0 */4 * * *'` | 6 ejecuciones/día — repo público = minutos ilimitados |

### Resultado Final
- **Capacidad teórica**: ~12k × 9 APIs = 108k TPM distribuida
- **Consumo real**: ~15-20k TPM con delay de 120s
- **Tasa de éxito**: ~80-95% (mayoría de archivos se arreglan en primeras 3 APIs)
- **Duración estimada**: 25 minutos por ejecución diaria
- **GitHub Actions min/mes**: ~750 min (dentro de presupuesto de 2000)

---

## 🛑 Detección de Saturación (Protección contra Desgaste)

El sistema implementa **2 capas de detección de saturación** para evitar desperdiciar GitHub Actions minutes cuando las APIs se agotan:

### Capa 1: Fallos Consecutivos de Archivos (Soft Stop)
```javascript
let consecutiveFails = 0;
const MAX_CONSECUTIVE_FAILS = 3;

// Si 3 archivos seguidos fallan en TODAS las APIs...
if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
  console.log(`⚠️  SATURATION DETECTED: All APIs exhausted for 3 consecutive files`);
  console.log(`Stopping workflow to avoid wasting GitHub minutes...`);
  break;  // ← Detiene el procesamiento
}
```

**Cuándo se dispara**: Cuando 3 archivos consecutivos no se pueden arreglar (todas las 9 APIs agotadas)

**Acción**: Detiene el workflow inmediatamente para evitar loops infinitos

### Capa 2: API Última Agotada (Critical Stop) 🔴
```javascript
// Si HuggingFace (API #9) falla, significa que todas las 9 APIs están saturadas
if (isLastApi) {
  console.log(`  ✗ LAST API FAILED (9/9) — Complete saturation detected`);
  return { exhausted: true };  // ← Señal crítica
}

// En main():
if (result && result.exhausted) {
  console.log(`🛑 CRITICAL SATURATION: All 9 APIs completely exhausted`);
  console.log(`Stopping workflow immediately to preserve GitHub minutes...`);
  break;
}
```

**Cuándo se dispara**: Cuando la última API en la cadena (HuggingFace) falla

**Acción**: Detiene el workflow **inmediatamente** sin esperar a 3 fallos consecutivos

### Ejemplo de Ejecución
```
Processing: frontend/src/Auth.tsx (5 issues)
  ⚠ Groq failed: Rate limit reached
  ⚠ Gemini failed: Rate limit reached
  ⚠ DeepSeek failed: Rate limit reached
  ⚠ Together failed: Rate limit reached
  ⚠ OpenRouter failed: Rate limit reached
  ⚠ Mistral failed: Rate limit reached
  ⚠ Cohere failed: Rate limit reached
  ⚠ Replicate failed: Rate limit reached
  ✗ LAST API FAILED (9/9) — Complete saturation detected
  → Skipped (all APIs exhausted) [1/3]

Processing: frontend/src/ProductCard.tsx (3 issues)
  [Idem: todas fallan]
  → Skipped (all APIs exhausted) [2/3]

Processing: frontend/src/OrderHistory.tsx (2 issues)
  [Idem: todas fallan]
  → Skipped (all APIs exhausted) [3/3]

⚠️  SATURATION DETECTED: All APIs exhausted for 3 consecutive files
Stopping workflow to avoid wasting GitHub minutes...

Done. Fixed: 14 files. Skipped: 9 files.
Workflow completed in 18 minutes (7 min ahorrados)
```

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

| Limitación | Causa | Impacto | Solución/Nota |
|------------|-------|--------|---------------|
| Issues críticos no se tocan | Por diseño | Requieren revisión manual | ✅ Aceptable: seguridad primero |
| Tasa de éxito ~80-90% | Calidad variable de IAs | ~10-20% issues sin arreglar | ✅ Normal: algunas falso positivos |
| Solo TypeScript validation | Herramientas limitadas | Solo catch syntax errors | ✅ Suficiente para MVP |
| Ejecución cada 4h | Repo público = minutos ilimitados | Issues se arreglan progresivamente | ✅ APIs recuperan cuota entre ejecuciones |
| No hay rollback automático | Git revert manual | Si algo crítico falla, manual fix | ✅ Rara vez ocurre (tsc valida) |
| Demora entre archivos (120s) | Rate limiting | El workflow toma ~25 minutos | ✅ Necesario para evitar saturación de APIs |

---

## 📈 Métricas y KPIs (Proyectadas)

### Baseline Actual (Antes de Autofix)

```
SonarCloud Dashboard (Estado inicial)
┌──────────────────────────────────────────┐
│ Total issues abiertos: 143               │
│ ├─ BLOCKER: ~2-3                         │
│ ├─ CRITICAL: ~8-10 (seguridad, pagos)   │
│ ├─ MAJOR: ~30-40 (lógica)                │
│ └─ MINOR: ~90-100 (estilo, optimización)│
│                                          │
│ Code Smells: ~120                        │
│ Bugs: ~15                                │
│ Security Hotspots: ~5                    │
└──────────────────────────────────────────┘
```

### Métricas por Ejecución (Diaria)

```javascript
// Estadísticas esperadas después de 1 día de autofix

Total issues: 143
├─ Auto-fixed: 110-120 (77-84%)
│  ├─ Por Groq: ~40 (rápido, confiable)
│  ├─ Por Gemini: ~25
│  ├─ Por DeepSeek: ~20 (código especializado)
│  └─ Por otras APIs: ~25-35
├─ Skipped (falso positivos): 10-15
├─ Manual review needed: 20-30 (críticos, seguridad)
│
Success rate by severity:
├─ MINOR: ~95% (replaceAll, imports, etc)
├─ MAJOR: ~85% (lógica, manejo de errores)
├─ CRITICAL: ~30% (seguridad - NO AUTOMÁTICO)
└─ BLOCKER: ~0% (siempre manual)

API hitrate (promedio):
├─ Groq: ~35% (primera intención)
├─ Gemini: ~25% (segundo fallback)
├─ DeepSeek: ~18% (especializado)
└─ Otros: ~22% (distribuidos)

Duration: ~25 minutes
GitHub Actions minutes: 25 (presupuesto: 750/mes)
```

### Proyección de Mejora (Mes Completo)

```
SonarCloud Dashboard (Proyectado después de 30 días)
┌──────────────────────────────────────────────┐
│ Total issues abiertos: 15-25                 │
│                                              │
│ Reducción por tipo:                          │
│ ├─ Code Smells: 120 → 35 (-70%)              │
│ ├─ Bugs: 15 → 4 (-75%)                       │
│ ├─ Security Hotspots: 5 → 5 (sin cambio)     │
│                                              │
│ Issues que requieren manual:                 │
│ ├─ Falso positivos SonarCloud: ~8-12         │
│ ├─ Críticos de seguridad: ~5-8               │
│ └─ Pagos/checkout: ~2-3                      │
│                                              │
│ GitHub Actions budget:                       │
│ ├─ Consumido: ~750 min (30 ejecuciones)      │
│ ├─ Presupuesto: 2000 min                     │
│ └─ Margen: +1250 min (~43% disponible)       │
└──────────────────────────────────────────────┘
```

### Cómo Monitorear en Tiempo Real

1. **GitHub Actions**: https://github.com/DariodelBarrio/Proyecto_web/actions
   - Ver workflow "Groq Autofix SonarCloud"
   - Expandir logs para ver cada API y sus resultados

2. **SonarCloud**: https://sonarcloud.io/summary/overall?id=ddelbarriojuan-code_Proyecto_web
   - Dashboard actualiza cada 24h después del autofix
   - Monitorear reducción de Code Smells y Bugs

3. **Comando Local** (opcional):
   ```bash
   # Ver últimas 10 ejecuciones
   gh run list --workflow groq-autofix.yml --limit 10

   # Ver detalles de ejecución más reciente
   gh run view --workflow groq-autofix.yml --json status,conclusion,duration
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

## 🚀 Roadmap de Evolución

### Phase 1: MVP ✅ (Completada)
- [x] 9 APIs en cadena de fallback
- [x] TypeScript validation (gate crítico)
- [x] Auto-commit en main
- [x] Detección de saturación (2 capas)
- [x] Schedule optimizado (750 min/mes)
- [x] Soporte para 143 issues

### Phase 2: Observabilidad (Próxima)
- [ ] Dashboard GitHub Actions con métricas
- [ ] Estadísticas de success rate por API
- [ ] Alertas en Slack cuando falle TypeScript
- [ ] Seguimiento de issues auto-arreglados vs manuales
- [ ] Tracking de APIs más/menos exitosas

### Phase 3: Inteligencia
- [ ] Priorizar por severidad (CRITICAL primero)
- [ ] Detectar patrones de falsos positivos
- [ ] Machine learning para mejorar prompts
- [ ] Reorden dinámico de APIs según hitrate
- [ ] Reporte semanal de mejoras

### Phase 4: Escalado
- [ ] Procesar issues nuevos en tiempo real (webhooks)
- [ ] Soporte para más lenguajes (Python, Go, Java)
- [ ] Integration con CI/CD para diferentes eventos
- [ ] Auto-review de cambios antes de commit
- [ ] Documentación automática de fixes

---

## 💰 Presupuesto GitHub Actions (Optimizado)

### Repositorio Público = Minutos Ilimitados

GitHub Actions es **completamente gratuito e ilimitado** en repositorios públicos.
El límite de 2,000 min/mes solo aplica a repositorios privados en el free tier.

### Schedule Actual (Cada 4 horas)

```
6 ejecuciones/día × 25 min = ~150 min/día
Sin restricción de presupuesto (repo público)
```

**Ventaja del schedule cada 4h:**
- Si una ejecución satura (todas las APIs con cuota diaria agotada), la siguiente ejecución 4h después las encuentra parcialmente recuperadas
- Los fixes se acumulan a lo largo del día en lugar de esperar 24h
- Máxima velocidad de reducción de issues en SonarCloud

### Desglose de Consumo por Ejecución

```
Workflow: Groq Autofix SonarCloud

Job 1: sonar-scan (2-3 min)
├─ Checkout código
├─ Fetch issues desde SonarCloud API
└─ Output: has_issues=true/false

Job 2: groq-autofix (22-25 min) [solo si has_issues=true]
├─ Checkout código
├─ npm ci --legacy-peer-deps (3-4 min)
├─ Procesar archivos × 2.5 archivos/min:
│  ├─ Delay: 120 segundos entre archivos (rate limiting de APIs)
│  └─ ... repite ...
├─ npx tsc --noEmit (2-3 min)
└─ git commit y push (1-2 min)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total por ejecución: ~25 minutos
```

### Comparativa de Schedules

| Métrica | Antes (Diaria) | Ahora (Cada 4h) |
|---------|----------------|-----------------|
| Ejecuciones/día | 1 | 6 |
| Tiempo hasta nuevo intento tras saturación | 24h | 4h |
| Costo GitHub Actions | $0 | $0 (repo público) |
| Velocidad de fixes | Lenta | 6x más rápida |

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

**Última actualización**: 2026-03-26
**Versión del sistema**: 2.1 — Schedule cada 4h (repo público = minutos ilimitados)
**Estado**: ✅ Operacional
**Presupuesto GitHub Actions**: ✅ Ilimitado (repositorio público)
**Schedule**: ✅ Cada 4 horas (0 */4 * * *) — 6 ejecuciones/día
**Saturación**: ✅ 2 capas de protección implementadas

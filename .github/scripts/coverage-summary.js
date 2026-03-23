'use strict';
// Genera un bloque Markdown con la cobertura y lo escribe en stdout.
// Uso: node coverage-summary.js <ruta/coverage-summary.json> <nombre-del-job> <estado: success|failure>
const { readFileSync, existsSync } = require('fs');
const { basename } = require('path');

const [,, summaryFile, jobName = 'Job', jobStatus = 'success'] = process.argv;
const THRESHOLD     = 30;   // umbral de referencia para el resumen visual
const LOW_FILE_PCT  = 50;   // archivos por debajo de esto se consideran "mejorables"
const GOOD_COVERAGE = 50;   // a partir de aquí la cobertura se considera buena

const icon = (pct) => pct >= THRESHOLD ? '✅' : '❌';
const fmt  = (x)   => x.pct.toFixed(1) + '%';

// =================================================================
// MAPEO: nombre de archivo → descripción humana
// =================================================================
function fileDescription(filePath) {
  const name = basename(filePath).replace(/\.(tsx?|jsx?)$/, '').toLowerCase();
  const map = {
    'index':              'la lógica principal del servidor (rutas, auth, middlewares)',
    'schemas':            'los esquemas de validación Zod de todos los endpoints',
    'admin':              'el panel de administración',
    'securitydashboard':  'el dashboard SOC de seguridad',
    'auth':               'el formulario de inicio de sesión y registro',
    'forgotpassword':     'el flujo de recuperación de contraseña',
    'resetpassword':      'el formulario de restablecimiento de contraseña',
    'tienda':             'la página principal de la tienda',
    'productcard':        'las tarjetas de producto',
    'productdetalle':     'la página de detalle de producto',
    'app':                'el enrutamiento y la sesión global de la aplicación',
    'orderhistory':       'el historial de pedidos del usuario',
    'userprofile':        'el perfil de usuario',
    'starrating':         'el sistema de valoraciones',
    'passwordstrength':   'el indicador de seguridad de contraseñas',
    'optimizedimage':     'el componente de imágenes con lazy-loading',
  };
  return map[name] || `\`${basename(filePath)}\``;
}

// =================================================================
// GENERADOR DE PÁRRAFO EN LENGUAJE NATURAL
// =================================================================
function generateParagraph(jobStatus, data, jobName) {
  if (!data) {
    // No hay datos de cobertura — el fallo ocurrió antes de correr los tests
    const who = jobName === 'Backend' ? 'backend' : 'frontend';
    return [
      `Los tests del ${who} no han llegado a ejecutarse, lo que indica un error en la compilación o en la instalación de dependencias.`,
      `Esto es importante porque sin cobertura no hay garantía de que ningún flujo funcione correctamente.`,
      `El primer paso es revisar el log completo del paso que ha fallado y ejecutar \`npx tsc --noEmit\` localmente para identificar el error de compilación.`,
    ].join(' ');
  }

  const total   = data.total;
  const files   = Object.entries(data).filter(([k]) => k !== 'total');
  const sorted  = [...files].sort((a, b) => a[1].lines.pct - b[1].lines.pct);
  const worst   = sorted[0];
  const worstDesc = worst ? fileDescription(worst[0]) : 'los archivos sin cobertura';
  const worstPct  = worst ? worst[1].lines.pct.toFixed(0) + '%' : '0%';

  const coverageFailing = [total.lines, total.functions, total.branches, total.statements]
    .some(m => m.pct < THRESHOLD);
  const isBackend  = jobName === 'Backend';
  const linesPct   = total.lines.pct.toFixed(0);
  const funcsPct   = total.functions.pct.toFixed(0);

  // ── FALLO ────────────────────────────────────────────────────────
  if (jobStatus !== 'success') {
    if (coverageFailing) {
      // La cobertura ha bajado por debajo del umbral
      if (isBackend) {
        const worstFile = worst ? basename(worst[0]) : 'index.ts';
        return [
          `La cobertura del backend no cumple el umbral mínimo del ${THRESHOLD}%: ${worstDesc} solo alcanza el ${worstPct} de cobertura de líneas.`,
          `Esto es un riesgo real porque código sin tests puede ocultar bugs en la autenticación, la autorización o el cálculo de precios, y esos errores llegarían a producción sin aviso.`,
          `El primer paso concreto es añadir un test para el flujo menos cubierto — ejecuta \`cd backend && npm run test:coverage\` para ver exactamente qué líneas de \`${worstFile}\` no están siendo ejercitadas, y empieza por un endpoint de seguridad crítico.`,
        ].join(' ');
      } else {
        return [
          `La cobertura del frontend ha bajado al ${linesPct}%, por debajo del umbral configurado, principalmente porque ${worstDesc} está prácticamente sin tests (${worstPct} de cobertura).`,
          `Los componentes de autenticación y administración son los más críticos — sin tests, un cambio en Auth.tsx o Admin.tsx podría romper el acceso al panel sin que nadie lo detecte.`,
          `El primer test que añadirías debería usar \`@testing-library/react\` para renderizar el componente de login y verificar que muestra un error cuando las credenciales son incorrectas — es el flujo de seguridad más importante del frontend.`,
        ].join(' ');
      }
    } else {
      // Los tests han fallado (pero la cobertura en sí está bien)
      if (isBackend) {
        return [
          `Uno o más tests del backend han fallado, aunque la cobertura de código está por encima del umbral — esto indica que un cambio reciente ha roto una aserción existente, no que falte cobertura.`,
          `Es especialmente importante arreglarlo rápido si el test que falla cubre autenticación, autorización o el cálculo de precios, que son las tres protecciones de seguridad principales del proyecto.`,
          `Ejecuta \`cd backend && npm test\` para ver el error exacto; el mensaje de aserción te dirá qué valor esperaba el test y qué está devolviendo el código ahora mismo.`,
        ].join(' ');
      } else {
        return [
          `Uno o más tests del frontend han fallado — revisa cuál con \`cd frontend && npm run test:run\` para ver el error exacto.`,
          `Si el test que falla es de ProductCard, Auth o PasswordStrength, prioriza arreglarlo porque afectan directamente a flujos que el usuario final ve en cada visita.`,
          `Comprueba si el fallo es una regresión (cambio de comportamiento en el código) o un test que ya no refleja la UI actual y necesita actualizarse.`,
        ].join(' ');
      }
    }
  }

  // ── ÉXITO ────────────────────────────────────────────────────────
  if (total.lines.pct < GOOD_COVERAGE) {
    // Tests pasan pero cobertura todavía baja
    if (isBackend) {
      // Identifica el área sin cubrir más concreta
      const uncoveredArea = worst
        ? `cambios en ${worstDesc} (${worstPct} de cobertura)`
        : 'cambios en rutas sin tests';
      return [
        `Los tests pasan, pero el ${linesPct}% de cobertura de líneas indica que todavía hay zonas importantes del backend sin probar — especialmente ${worstDesc}, que solo alcanza el ${worstPct}.`,
        `El riesgo concreto es que ${uncoveredArea} podrían introducir bugs en rutas como la gestión de cupones, las exportaciones de datos o las notificaciones push sin que los tests lo detecten.`,
        `El siguiente test prioritario debería cubrir un flujo de autorización aún no testado — por ejemplo, intentar modificar un producto sin ser administrador y verificar que el servidor devuelve 403.`,
      ].join(' ');
    } else {
      return [
        `Los tests del frontend pasan, pero el ${linesPct}% de cobertura de líneas y el ${funcsPct}% de funciones indican que la mayoría de componentes no tienen tests todavía — principalmente ${worstDesc} (${worstPct}).`,
        `Sin cobertura en el panel de administración y en los formularios de autenticación, un cambio en la lógica de permisos o en la validación de inputs podría pasar desapercibido.`,
        `El primer test que añadirías debería ser para el componente Auth: renderízalo con \`@testing-library/react\`, envía credenciales incorrectas y verifica que aparece el mensaje de error — es el flujo más crítico y más fácil de empezar.`,
      ].join(' ');
    }
  }

  // Cobertura buena y tests en verde
  if (isBackend) {
    return [
      `Excelente — todos los tests del backend pasan y la cobertura de líneas está al ${linesPct}%, por encima del umbral del ${THRESHOLD}%.`,
      `Como mejora concreta al proyecto (no a los tests), considera migrar el almacenamiento de sesiones de la memoria RAM del servidor a Redis: actualmente, si el servidor se reinicia o se añade una segunda instancia, todos los usuarios pierden su sesión inmediatamente.`,
      `Redis resolvería ambos problemas con un cambio relativamente pequeño en la función que crea y valida los tokens de sesión en \`backend/src/index.ts\`.`,
    ].join(' ');
  } else {
    return [
      `Muy bien — los tests del frontend están en verde y la cobertura supera el ${linesPct}% de líneas.`,
      `Como mejora concreta al proyecto, considera añadir tests de accesibilidad con \`@testing-library/jest-dom\` para verificar que los formularios tienen \`aria-label\` correctos y que los botones son navegables por teclado — es especialmente relevante en el panel de admin, que es la parte más usada por el equipo internamente.`,
      `Estos tests también detectarán regresiones de UI antes de que lleguen a producción.`,
    ].join(' ');
  }
}

// =================================================================
// SALIDA PRINCIPAL
// =================================================================
const statusIcon = jobStatus === 'success' ? '✅' : '❌';
let md = `## ${statusIcon} ${jobName}\n\n`;

if (!summaryFile || !existsSync(summaryFile)) {
  md += '> ⚠️ No se generó cobertura (los tests fallaron antes de completarse).\n\n';
  md += '---\n\n';
  md += `> ${generateParagraph(jobStatus, null, jobName)}\n`;
  process.stdout.write(md);
  process.exit(0);
}

const data  = JSON.parse(readFileSync(summaryFile, 'utf8'));
const total = data.total;
const files = Object.entries(data).filter(([k]) => k !== 'total');

// Tabla resumen global
md += '### Cobertura global\n\n';
md += '| Métrica | Cobertura | Umbral | Estado |\n';
md += '|---------|-----------|--------|--------|\n';
md += `| Líneas      | ${fmt(total.lines)}      | ${THRESHOLD}% | ${icon(total.lines.pct)}      |\n`;
md += `| Funciones   | ${fmt(total.functions)}  | ${THRESHOLD}% | ${icon(total.functions.pct)}  |\n`;
md += `| Ramas       | ${fmt(total.branches)}   | ${THRESHOLD}% | ${icon(total.branches.pct)}   |\n`;
md += `| Sentencias  | ${fmt(total.statements)} | ${THRESHOLD}% | ${icon(total.statements.pct)} |\n`;
md += '\n';

// Bloque de métricas que fallan (solo en fallo)
if (jobStatus !== 'success') {
  const failing = [
    total.lines.pct      < THRESHOLD && `**Líneas** (${fmt(total.lines)}) por debajo del ${THRESHOLD}%`,
    total.functions.pct  < THRESHOLD && `**Funciones** (${fmt(total.functions)}) por debajo del ${THRESHOLD}%`,
    total.branches.pct   < THRESHOLD && `**Ramas** (${fmt(total.branches)}) por debajo del ${THRESHOLD}%`,
    total.statements.pct < THRESHOLD && `**Sentencias** (${fmt(total.statements)}) por debajo del ${THRESHOLD}%`,
  ].filter(Boolean);

  if (failing.length > 0) {
    md += '### ❌ Métricas por debajo del umbral\n\n';
    for (const msg of failing) md += `- ${msg}\n`;
    md += '\n';
  }
}

// Archivos con baja cobertura
const low = files
  .filter(([, v]) => v.lines.pct < LOW_FILE_PCT)
  .sort((a, b) => a[1].lines.pct - b[1].lines.pct)
  .slice(0, 10);

if (low.length > 0) {
  const title = jobStatus === 'success'
    ? `### 💡 Archivos con cobertura mejorable (< ${LOW_FILE_PCT}%)`
    : `### Archivos que necesitan más tests`;
  md += title + '\n\n';
  md += '| Archivo | Líneas | Funciones | Ramas |\n';
  md += '|---------|--------|-----------|-------|\n';
  for (const [file, v] of low) {
    const parts = file.split('/src/');
    const name  = parts.length > 1 ? parts[1] : basename(file);
    md += `| \`${name}\` | ${fmt(v.lines)} | ${fmt(v.functions)} | ${fmt(v.branches)} |\n`;
  }
  md += '\n';
} else if (jobStatus === 'success') {
  md += '### ✅ Todos los archivos superan el umbral de cobertura\n\n';
}

// Párrafo en lenguaje natural
md += '---\n\n';
md += `> ${generateParagraph(jobStatus, data, jobName)}\n`;

process.stdout.write(md);

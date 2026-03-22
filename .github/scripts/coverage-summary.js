'use strict';
// Genera un bloque Markdown con la cobertura y lo escribe en stdout.
// Uso: node coverage-summary.js <ruta/coverage-summary.json> <nombre-del-job> <estado: success|failure>
const { readFileSync, existsSync } = require('fs');
const { basename } = require('path');

const [,, summaryFile, jobName = 'Job', jobStatus = 'success'] = process.argv;
const THRESHOLD = 30;
const LOW_FILE_PCT = 50;

const icon = (pct) => pct >= THRESHOLD ? '✅' : '❌';
const fmt  = (x)   => x.pct.toFixed(1) + '%';
const statusIcon   = jobStatus === 'success' ? '✅' : '❌';

let md = `## ${statusIcon} ${jobName}\n\n`;

if (!summaryFile || !existsSync(summaryFile)) {
  md += '> ⚠️ No se generó cobertura (los tests fallaron antes de completarse).\n';
  process.stdout.write(md);
  process.exit(0);
}

const data  = JSON.parse(readFileSync(summaryFile, 'utf8'));
const total = data.total;

// Tabla resumen global
md += '### Cobertura global\n\n';
md += '| Métrica | Cobertura | Umbral | Estado |\n';
md += '|---------|-----------|--------|--------|\n';
md += `| Líneas      | ${fmt(total.lines)}      | ${THRESHOLD}% | ${icon(total.lines.pct)}      |\n`;
md += `| Funciones   | ${fmt(total.functions)}  | ${THRESHOLD}% | ${icon(total.functions.pct)}  |\n`;
md += `| Ramas       | ${fmt(total.branches)}   | ${THRESHOLD}% | ${icon(total.branches.pct)}   |\n`;
md += `| Sentencias  | ${fmt(total.statements)} | ${THRESHOLD}% | ${icon(total.statements.pct)} |\n`;
md += '\n';

const files = Object.entries(data).filter(([k]) => k !== 'total');

if (jobStatus !== 'success') {
  // Modo fallo: explica qué está mal
  const failing = [
    total.lines.pct      < THRESHOLD && `**Líneas** (${fmt(total.lines)}) está por debajo del ${THRESHOLD}%`,
    total.functions.pct  < THRESHOLD && `**Funciones** (${fmt(total.functions)}) está por debajo del ${THRESHOLD}%`,
    total.branches.pct   < THRESHOLD && `**Ramas** (${fmt(total.branches)}) está por debajo del ${THRESHOLD}%`,
    total.statements.pct < THRESHOLD && `**Sentencias** (${fmt(total.statements)}) está por debajo del ${THRESHOLD}%`,
  ].filter(Boolean);

  if (failing.length > 0) {
    md += '### ❌ Por qué falló la cobertura\n\n';
    for (const msg of failing) md += `- ${msg}\n`;
    md += '\n> 💡 **Cómo arreglarlo:** añade tests para los archivos con menos cobertura (ver tabla de abajo).\n\n';
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

process.stdout.write(md);

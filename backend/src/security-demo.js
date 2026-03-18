/**
 * =================================================================
 * KRATAMEX - DEMO DE SEGURIDAD
 * SQL Injection: ataque simulado vs. prepared statements
 * =================================================================
 *
 * Ejecutar con: node backend/src/security-demo.js
 */

const Database = require('better-sqlite3');
const db = new Database('tienda.db');

console.log('\n========================================================');
console.log('  DEMO DE SEGURIDAD: SQL INJECTION');
console.log('========================================================\n');

// ----------------------------------------------------------------
// FUNCIÓN SEGURA: buscar producto por ID con prepared statement
// ----------------------------------------------------------------
function buscarProductoPorId(id) {
  // El placeholder "?" nunca se concatena: es un parámetro enlazado.
  // better-sqlite3 envía query y parámetro por separado al motor SQL.
  const stmt = db.prepare('SELECT id, nombre, precio FROM productos WHERE id = ?');
  return stmt.get(id);
}

// ----------------------------------------------------------------
// FUNCIÓN VULNERABLE (solo para demostración - NUNCA usar en prod)
// ----------------------------------------------------------------
function buscarProductoVULNERABLE(id) {
  // PELIGRO: concatenación directa de string
  const sql = `SELECT id, nombre, precio FROM productos WHERE id = ${id}`;
  console.log('  SQL ejecutado:', sql);
  return db.prepare(sql).get();
}

// ================================================================
// CASO 1 — Uso normal (ambas funciones)
// ================================================================
console.log('--- CASO 1: ID legítimo (id = 1) ---\n');

const resultadoSeguro = buscarProductoPorId(1);
console.log('  [SEGURA]     Resultado:', resultadoSeguro?.nombre ?? 'No encontrado');

const resultadoVuln = buscarProductoVULNERABLE(1);
console.log('  [VULNERABLE] Resultado:', resultadoVuln?.nombre ?? 'No encontrado');

// ================================================================
// CASO 2 — Ataque clásico: bypass con 1=1
// ================================================================
console.log('\n--- CASO 2: Ataque SQLi clásico ("1 OR 1=1") ---\n');

const payloadSQLi = '1 OR 1=1';

const ataqueSobre = buscarProductoPorId(payloadSQLi);
console.log('  [SEGURA]     Resultado:', ataqueSobre ?? 'Sin resultado (ataque neutralizado ✅)');

try {
  const ataqueVuln = buscarProductoVULNERABLE(payloadSQLi);
  console.log('  [VULNERABLE] Resultado:', ataqueVuln?.nombre, '← PRIMER REGISTRO DEVUELTO 🚨');
} catch (e) {
  console.log('  [VULNERABLE] Error inesperado:', e.message);
}

// ================================================================
// CASO 3 — Ataque UNION-based (extracción de datos de otra tabla)
// ================================================================
console.log('\n--- CASO 3: UNION Attack (extrae datos de "usuarios") ---\n');

const payloadUnion = "0 UNION SELECT id, username, password FROM usuarios LIMIT 1--";

const unionSeguro = buscarProductoPorId(payloadUnion);
console.log('  [SEGURA]     Resultado:', unionSeguro ?? 'Sin resultado (ataque neutralizado ✅)');

try {
  const unionVuln = buscarProductoVULNERABLE(payloadUnion);
  console.log('  [VULNERABLE] Datos filtrados:',
    unionVuln ? `usuario="${unionVuln.nombre}" hash="${unionVuln.precio}"` : 'null');
  if (unionVuln) console.log('  ☠️  CREDENCIALES EXPUESTAS 🚨');
} catch (e) {
  console.log('  [VULNERABLE] Error:', e.message);
}

// ================================================================
// CASO 4 — DROP TABLE (ataque destructivo)
// ================================================================
console.log('\n--- CASO 4: DROP TABLE (ataque destructivo) ---\n');

const payloadDrop = "1; DROP TABLE productos--";

const dropSeguro = buscarProductoPorId(payloadDrop);
console.log('  [SEGURA]     Resultado:', dropSeguro ?? 'Sin resultado (ataque neutralizado ✅)');
console.log('  [SEGURA]     Tabla productos intacta:',
  db.prepare("SELECT COUNT(*) as c FROM productos").get().c, 'productos');

// ================================================================
// CONCLUSIÓN
// ================================================================
console.log('\n========================================================');
console.log('  CONCLUSIÓN');
console.log('========================================================');
console.log(`
  FUNCIÓN VULNERABLE:
    SELECT id, nombre, precio FROM productos WHERE id = ${payloadUnion}
    → El atacante controla la query completa.
    → Puede extraer usuarios, hashes, datos sensibles.

  FUNCIÓN SEGURA (prepared statement):
    db.prepare('SELECT ... WHERE id = ?').get(payload)
    → El motor SQLite recibe el payload como dato literal.
    → Nunca se interpreta como SQL. Ataque neutralizado.

  REGLA: Nunca concatenes input de usuario en SQL.
         Siempre usa placeholders (?, :param, $param).
`);

db.close();

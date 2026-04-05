// =================================================================
// FUNCIÓN DE SEGURIDAD: SANITIZE
// =================================================================
// Esta función protege contra ataques XSS (Cross-Site Scripting)
// Evita que código malicioso se ejecute en el navegador
// Elimina todas las etiquetas HTML y luego escapa caracteres especiales
export const sanitize = (str: string | null | undefined): string => {
  if (!str) return '';
  
  let result = str;
  
  // Remove script tags without catastrophic backtracking (S5852)
  result = result.replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  result = result.replaceAll(/<[^>]*>/g, '');
  result = result.replaceAll('&', '&amp;');
  result = result.replaceAll('<', '&lt;');
  result = result.replaceAll('>', '&gt;');
  result = result.replaceAll('"', '&quot;');
  result = result.replaceAll("'", '&#039;');
  
  return result;
};

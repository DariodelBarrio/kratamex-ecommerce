// =================================================================
// FUNCIÓN DE SEGURIDAD: SANITIZE
// =================================================================
// Esta función protege contra ataques XSS (Cross-Site Scripting)
// Evita que código malicioso se ejecute en el navegador
// Elimina todas las etiquetas HTML y luego escapa caracteres especiales
export const sanitize = (str: string | null | undefined): string => {
  if (!str) return '';
  
  let result = str;
  
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/<[^>]*>/g, '');
  result = result.replace(/&/g, '&amp;');
  result = result.replace(/</g, '&lt;');
  result = result.replace(/>/g, '&gt;');
  result = result.replace(/"/g, '&quot;');
  result = result.replace(/'/g, '&#039;');
  
  return result;
};

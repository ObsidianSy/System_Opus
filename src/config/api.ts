/**
 * Configuração da URL base da API
 * Em produção, usa URLs relativas (mesmo domínio)
 * Em desenvolvimento, usa localhost:3001
 */

// Detecta ambiente pelo hostname do navegador (mais confiável)
const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3001' 
  : ''; // Em produção, usa URL relativa (mesmo domínio)

export const getApiUrl = (endpoint: string): string => {
  // Remove barra inicial do endpoint se existir
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

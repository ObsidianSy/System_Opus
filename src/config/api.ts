/**
 * Configuração da URL base da API
 * Em produção, usa URLs relativas (mesmo domínio)
 * Em desenvolvimento, usa localhost:3001
 */

const isDevelopment = import.meta.env.MODE === 'development';

export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3001' 
  : ''; // Em produção, usa URL relativa (mesmo domínio)

export const getApiUrl = (endpoint: string): string => {
  // Remove barra inicial do endpoint se existir
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

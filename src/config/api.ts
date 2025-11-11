/**
 * Configuração da URL base da API
 * Em produção, usa URLs relativas (mesmo domínio)
 * Em desenvolvimento, usa VITE_API_URL do .env ou localhost:3001
 */

// Detecta ambiente pelo hostname do navegador (mais confiável)
const isDevelopment = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = isDevelopment
    ? (import.meta.env.VITE_API_URL || 'http://localhost:3001')
    : ''; // Em produção, usa URL relativa (mesmo domínio)

export const getApiUrl = (endpoint: string): string => {
    // Remove barra inicial do endpoint se existir
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_BASE_URL}${cleanEndpoint}`;
};

/**
 * Helper para fazer requisições à API com tratamento de erros
 * Adiciona automaticamente o token de autenticação
 */
export async function apiRequest<T>(
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const url = getApiUrl(`/api${endpoint}`);

    // Pegar token do localStorage
    const token = localStorage.getItem('token');

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Erro na requisição: ${response.status}`);
    }

    return response.json();
}

/**
 * Helper para fazer requisições fetch com token automático
 * Útil quando você precisa fazer fetch direto com mais controle
 */
export function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
}

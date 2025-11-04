/**
 * Helper para normalização de client_id
 * 
 * Garante que client_id seja sempre number ou null
 * Seguindo as regras de negócio do sistema
 */

/**
 * Normaliza client_id para garantir tipo correto
 * @param clientId - Valor do client_id (pode ser string, number ou null)
 * @returns number ou null
 */
export function normalizeClientId(clientId: any): number | null {
    // Se já é null ou undefined, retorna null
    if (clientId === null || clientId === undefined) {
        return null;
    }

    // Se é string, tenta converter para número
    if (typeof clientId === 'string') {
        const parsed = parseInt(clientId, 10);
        return isNaN(parsed) ? null : parsed;
    }

    // Se é número, retorna diretamente
    if (typeof clientId === 'number') {
        return isNaN(clientId) ? null : clientId;
    }

    // Qualquer outro tipo retorna null
    return null;
}

/**
 * Valida se um client_id é válido (number > 0)
 * @param clientId - Valor a validar
 * @returns true se válido, false caso contrário
 */
export function isValidClientId(clientId: any): boolean {
    const normalized = normalizeClientId(clientId);
    return normalized !== null && normalized > 0;
}

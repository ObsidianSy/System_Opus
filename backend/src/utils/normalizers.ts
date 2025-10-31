/**
 * Utilitários de normalização de dados brasileiros
 * Compatível com o padrão do n8n
 */

/**
 * Converte data BR (DD/MM/YYYY) para formato ISO (YYYY-MM-DD)
 * @param dataBR - Data em formato brasileiro "31/10/2025"
 * @returns Data em formato ISO "2025-10-31"
 */
export function parseDateBR(dataBR: string): string {
    if (!dataBR) return new Date().toISOString().split('T')[0];

    // Se já estiver em ISO (YYYY-MM-DD), retorna direto
    if (/^\d{4}-\d{2}-\d{2}/.test(dataBR)) {
        return dataBR.split('T')[0];
    }

    // Converte DD/MM/YYYY → YYYY-MM-DD
    const parts = dataBR.split('/');
    if (parts.length === 3) {
        const [dia, mes, ano] = parts;
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    return new Date().toISOString().split('T')[0];
}

/**
 * Converte moeda BR (1.250,50) para número decimal (1250.50)
 * @param valorBR - Valor em formato brasileiro "1.250,50" ou "1250,50"
 * @returns Número decimal 1250.50
 */
export function parseMoneyBR(valorBR: string | number): number {
    if (typeof valorBR === 'number') return valorBR;
    if (!valorBR) return 0;

    // Remove espaços e R$
    let valor = String(valorBR).trim().replace(/R\$/g, '').trim();

    // Substitui ponto de milhar por nada e vírgula por ponto
    valor = valor.replace(/\./g, '').replace(/,/g, '.');

    return parseFloat(valor) || 0;
}

/**
 * Normaliza SKU para maiúsculas e remove espaços
 * @param sku - SKU em qualquer formato "col-007" ou "COL-007"
 * @returns SKU normalizado "COL-007"
 */
export function normalizeSku(sku: string): string {
    if (!sku) return '';
    return String(sku).trim().toUpperCase();
}

/**
 * Gera chave de idempotência para pagamentos
 * Formato: "YYYY-MM-DD|CLIENTE|VALOR|FORMA"
 * @param data - Data do pagamento (ISO ou BR)
 * @param cliente - Nome do cliente
 * @param valor - Valor do pagamento
 * @param forma - Forma de pagamento
 * @returns Chave de idempotência "2025-10-31|JOAO SILVA|1250.50|PIX"
 */
export function buildIdempotencyKey(
    data: string,
    cliente: string,
    valor: string | number,
    forma: string
): string {
    const dataNorm = parseDateBR(data);
    const valorNorm = typeof valor === 'number'
        ? valor.toFixed(2)
        : parseMoneyBR(valor).toFixed(2);
    const clienteNorm = String(cliente).trim().toUpperCase();
    const formaNorm = String(forma || 'INDEFINIDO').trim().toUpperCase();

    return `${dataNorm}|${clienteNorm}|${valorNorm}|${formaNorm}`;
}

/**
 * Normaliza nome de cliente (remove espaços extras, capitaliza)
 * @param nome - Nome do cliente
 * @returns Nome normalizado
 */
export function normalizeClientName(nome: string): string {
    if (!nome) return '';
    return String(nome)
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Valida e formata documento (CPF/CNPJ)
 * @param documento - CPF ou CNPJ
 * @returns Documento formatado apenas com números
 */
export function normalizeDocumento(documento: string): string {
    if (!documento) return '';
    return String(documento).replace(/\D/g, '');
}

/**
 * Normaliza telefone (remove caracteres especiais)
 * @param telefone - Telefone com ou sem formatação
 * @returns Telefone apenas com números
 */
export function normalizeTelefone(telefone: string): string {
    if (!telefone) return '';
    return String(telefone).replace(/\D/g, '');
}

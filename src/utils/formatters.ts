/**
 * Utility functions for formatting values throughout the application
 */

/**
 * Format large numbers with abbreviations (K, M, B)
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Abbreviated number string
 */
export function formatAbbreviated(value: number | string | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null) {
    return '0';
  }
  
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return '0';
  }
  
  const absValue = Math.abs(numericValue);
  
  if (absValue >= 1_000_000_000) {
    return `${(numericValue / 1_000_000_000).toFixed(decimals)}B`;
  } else if (absValue >= 1_000_000) {
    return `${(numericValue / 1_000_000).toFixed(decimals)}M`;
  } else if (absValue >= 1_000) {
    return `${(numericValue / 1_000).toFixed(decimals)}K`;
  }
  
  return numericValue.toFixed(decimals);
}

/**
 * Format currency values with abbreviations for large numbers
 * @param value - The numeric value to format
 * @param abbreviate - Whether to abbreviate large numbers (default: true for values > 10000)
 * @returns Formatted currency string
 */
export function formatCurrencyAbbreviated(value: number | string | undefined | null): string {
  if (value === undefined || value === null) {
    return 'R$ 0,00';
  }
  
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return 'R$ 0,00';
  }
  
  const absValue = Math.abs(numericValue);
  
  // For large values, use abbreviation
  if (absValue >= 1_000_000_000) {
    return `R$ ${(numericValue / 1_000_000_000).toFixed(1).replace('.', ',')}bi`;
  } else if (absValue >= 1_000_000) {
    return `R$ ${(numericValue / 1_000_000).toFixed(1).replace('.', ',')}mi`;
  } else if (absValue >= 10_000) {
    return `R$ ${(numericValue / 1_000).toFixed(1).replace('.', ',')}mil`;
  }
  
  // For smaller values, use full format
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format currency values in Brazilian Real (R$) - full format without abbreviation
 * @param value - The numeric value to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null) {
    return 'R$ 0,00';
  }
  
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return 'R$ 0,00';
  }
  
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format large numbers with thousand separators
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number | string | undefined | null, decimals: number = 0): string {
  if (value === undefined || value === null) {
    return '0';
  }
  
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return '0';
  }
  
  return numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format percentage values
 * @param value - The numeric value to format (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format quantity values (whole numbers)
 * @param value - The numeric value to format
 * @returns Formatted quantity string
 */
export function formatQuantity(value: number | string | undefined | null): string {
  if (value === undefined || value === null) {
    return '0';
  }
  
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '0';
  }
  
  return Math.floor(numericValue).toLocaleString('pt-BR');
}

/**
 * Normaliza valores numéricos que podem vir como string formatada
 * Exemplos: "R$ 1.234,56" → 1234.56 | "1.234,56" → 1234.56 | 1234.56 → 1234.56
 * @param val - O valor a ser convertido para número
 * @returns Valor numérico ou 0 se inválido
 */
export function toNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  if (typeof val === 'string') {
    // Remove moeda e espaços
    let s = val.replace(/\s|\u00A0/g, '').replace(/R\$/gi, '');
    if (s === '') return 0;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    // Caso tenha os dois separadores, decidimos pelo último como decimal
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastComma > lastDot) {
        // vírgula decimal, ponto milhar
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // ponto decimal, vírgula milhar
        s = s.replace(/,/g, '');
      }
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }

    // Apenas vírgula presente: tratar como decimal
    if (hasComma) {
      s = s.replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }

    // Apenas ponto presente: decidir heurística
    if (hasDot) {
      const lastDot = s.lastIndexOf('.');
      const decimals = s.length - lastDot - 1;

      let normalized: string;
      if (decimals === 0) {
        // Nenhuma casa após o ponto: considerar ponto como milhar
        normalized = s.replace(/\./g, '');
      } else if (decimals <= 4) {
        // 1-4 casas decimais após o ponto: considerar ponto decimal (ex: 20.0000 -> 20)
        normalized = s;
      } else {
        // Muitos dígitos após o último ponto: manter último como decimal e remover pontos anteriores
        const parts = s.split('.');
        const last = parts.pop() || '';
        normalized = parts.join('') + '.' + last;
      }
      const n = parseFloat(normalized);
      return isNaN(n) ? 0 : n;
    }

    // Sem separadores: manter apenas dígitos e sinal
    const cleaned = s.replace(/[^0-9-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  const n = Number(val);
  return isNaN(n) ? 0 : n;
}
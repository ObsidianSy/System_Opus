/**
 * Ordenação alfanumérica natural para SKUs
 * Garante que H101, H102, H103 sejam ordenados corretamente
 * ao invés de H1, H10, H11, H2...
 */
export const naturalSort = (a: string, b: string): number => {
  const normalize = (str: string) => str?.toLowerCase() || '';
  
  const aStr = normalize(a);
  const bStr = normalize(b);
  
  // Quebrar em partes alfabéticas e numéricas
  const regex = /(\d+)|(\D+)/g;
  const aParts = aStr.match(regex) || [];
  const bParts = bStr.match(regex) || [];
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // Se ambas as partes são números, comparar numericamente
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      // Comparação alfabética
      if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
  }
  
  return 0;
};

/**
 * Helper para ordenar arrays de objetos por SKU
 * @param items Array de objetos a ser ordenado
 * @param skuField Campo do SKU ou função que retorna o SKU
 * @returns Array ordenado por SKU (natural sort)
 */
export const sortBySKU = <T extends Record<string, any>>(
  items: T[],
  skuField: keyof T | ((item: T) => string)
): T[] => {
  return [...items].sort((a, b) => {
    const skuA = typeof skuField === 'function' 
      ? skuField(a) 
      : String(a[skuField] || '');
    const skuB = typeof skuField === 'function' 
      ? skuField(b) 
      : String(b[skuField] || '');
    
    return naturalSort(skuA, skuB);
  });
};

import { useState, useMemo, useCallback } from 'react';

interface FilterConfig<T> {
  quantityField?: keyof T | ((item: T) => number);
  categoryField?: keyof T | ((item: T) => string | null);
  typeField?: keyof T | ((item: T) => string | null);
  searchFields?: (keyof T)[] | ((item: T, searchTerm: string) => boolean);
}

export const useTableFilters = <T,>(
  data: T[],
  config: FilterConfig<T> = {}
) => {
  const [quantityFilter, setQuantityFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const getValue = useCallback((item: T, field: any): any => {
    if (typeof field === 'function') return field(item);
    return item[field as keyof T];
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Quantity filter
      if (config.quantityField && quantityFilter !== "todos") {
        const quantidade = getValue(item, config.quantityField) || 0;
        const matchesQuantity = 
          quantityFilter === "sem-estoque" ? quantidade === 0 :
          quantityFilter === "estoque-baixo" ? quantidade > 0 && quantidade < 10 :
          quantityFilter === "em-estoque" ? quantidade >= 10 : true;
        
        if (!matchesQuantity) return false;
      }

      // Category filter
      if (config.categoryField && categoryFilter !== "todas") {
        const categoria = getValue(item, config.categoryField);
        if (categoria !== categoryFilter) return false;
      }

      // Type filter
      if (config.typeField && typeFilter !== "todos") {
        const tipo = getValue(item, config.typeField);
        if (tipo !== typeFilter) return false;
      }

      // Search filter
      if (searchTerm && config.searchFields) {
        const normalizedSearch = searchTerm.toLowerCase();
        if (typeof config.searchFields === 'function') {
          return config.searchFields(item, normalizedSearch);
        } else {
          const matchesSearch = config.searchFields.some(field => {
            const value = String(item[field] || '').toLowerCase();
            return value.includes(normalizedSearch);
          });
          if (!matchesSearch) return false;
        }
      }

      return true;
    });
  }, [data, quantityFilter, categoryFilter, typeFilter, searchTerm, config, getValue]);

  const clearFilters = useCallback(() => {
    setQuantityFilter("todos");
    setCategoryFilter("todas");
    setTypeFilter("todos");
    setSearchTerm("");
  }, []);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (quantityFilter !== "todos") count++;
    if (categoryFilter !== "todas") count++;
    if (typeFilter !== "todos") count++;
    if (searchTerm) count++;
    return count;
  }, [quantityFilter, categoryFilter, typeFilter, searchTerm]);

  return {
    filteredData,
    filters: {
      quantity: quantityFilter,
      category: categoryFilter,
      type: typeFilter,
      search: searchTerm
    },
    setQuantityFilter,
    setCategoryFilter,
    setTypeFilter,
    setSearchTerm,
    clearFilters,
    activeFiltersCount
  };
};

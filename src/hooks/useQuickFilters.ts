import { useState, useCallback, useMemo, useEffect } from 'react';
import { debounce } from '@/utils/performance';
import { useDateFilter } from '@/contexts/DateFilterContext';

export interface FilterState {
  searchTerm: string;
  selectedClient: string;
  selectedSKU: string;
  selectedStatus: string;
  [key: string]: any;
}

interface UseQuickFiltersOptions {
  persistKey?: string;
  debounceMs?: number;
  defaultFilters?: Partial<FilterState>;
}

export const useQuickFilters = <T = any>(
  data: T[] = [],
  filterFunction?: (item: T, filters: FilterState) => boolean,
  options: UseQuickFiltersOptions = {}
) => {
  const { persistKey, debounceMs = 300, defaultFilters = {} } = options;
  const { getQueryParams } = useDateFilter();

  // Estado dos filtros
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    selectedClient: '',
    selectedSKU: '',
    selectedStatus: '',
    ...defaultFilters
  });

  // Carregar filtros persistidos
  useEffect(() => {
    if (persistKey) {
      const saved = localStorage.getItem(`obsidian-filters-${persistKey}`);
      if (saved) {
        try {
          const parsedFilters = JSON.parse(saved);
          setFilters(prev => ({ ...prev, ...parsedFilters }));
        } catch (error) {
          console.warn('Erro ao carregar filtros salvos:', error);
        }
      }
    }
  }, [persistKey]);

  // Salvar filtros no localStorage
  const saveFilters = useCallback((newFilters: FilterState) => {
    if (persistKey) {
      localStorage.setItem(`obsidian-filters-${persistKey}`, JSON.stringify(newFilters));
    }
  }, [persistKey]);

  // Debounced filter update
  const debouncedSetFilters = useMemo(
    () => debounce((newFilters: FilterState) => {
      setFilters(newFilters);
      saveFilters(newFilters);
    }, debounceMs),
    [debounceMs, saveFilters]
  );

  // Atualizar filtro específico
  const updateFilter = useCallback((key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    if (key === 'searchTerm') {
      debouncedSetFilters(newFilters);
    } else {
      setFilters(newFilters);
      saveFilters(newFilters);
    }
  }, [filters, debouncedSetFilters, saveFilters]);

  // Limpar todos os filtros
  const clearFilters = useCallback(() => {
    const clearedFilters = {
      searchTerm: '',
      selectedClient: '',
      selectedSKU: '',
      selectedStatus: '',
      ...defaultFilters
    };
    setFilters(clearedFilters);
    saveFilters(clearedFilters);
  }, [defaultFilters, saveFilters]);

  // Filtrar dados
  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    
    return data.filter(item => {
      // Aplicar filtro de data (se aplicável)
      const dateParams = getQueryParams();
      
      // Aplicar filtro customizado se fornecido
      if (filterFunction) {
        return filterFunction(item, filters);
      }

      // Filtro padrão básico
      const itemStr = JSON.stringify(item).toLowerCase();
      const searchMatch = !filters.searchTerm || 
        itemStr.includes(filters.searchTerm.toLowerCase());

      return searchMatch;
    });
  }, [data, filters, filterFunction, getQueryParams]);

  // Contadores para chips
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => 
      value !== '' && value !== null && value !== undefined
    ).length;
  }, [filters]);

  // Opções disponíveis para dropdowns (extraídas dos dados)
  const availableOptions = useMemo(() => {
    if (!Array.isArray(data)) return {};

    const clients = new Set<string>();
    const skus = new Set<string>();
    const statuses = new Set<string>();

    data.forEach((item: any) => {
      // Extrair clientes
      const clientName = item['Nome Cliente'] || item['Cliente'] || item['nome'];
      if (clientName) clients.add(clientName);

      // Extrair SKUs
      const sku = item['SKU'] || item['SKU Produto'] || item['sku'];
      if (sku) skus.add(sku);

      // Extrair status (adaptar conforme necessário)
      const status = item['Status'] || item['status'];
      if (status) statuses.add(status);
    });

    return {
      clients: Array.from(clients).sort(),
      skus: Array.from(skus).sort(),
      statuses: Array.from(statuses).sort()
    };
  }, [data]);

  return {
    filters,
    filteredData,
    updateFilter,
    clearFilters,
    activeFiltersCount,
    availableOptions,
    // Utilitários
    hasActiveFilters: activeFiltersCount > 0,
    isSearchActive: filters.searchTerm.length > 0
  };
};
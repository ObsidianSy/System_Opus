import { useState, useCallback, useMemo, useEffect } from 'react';
import { debounce } from '@/utils/performance';
import { useDateFilter } from '@/contexts/DateFilterContext';

export interface FilterState {
  searchTerm: string;
  selectedClients: string[]; // Mudado para array
  selectedSKUs: string[]; // Mudado para array
  selectedStatuses: string[]; // Mudado para array
  selectedCanais: string[]; // Mudado para array
  // Manter retrocompatibilidade (deprecated)
  selectedClient?: string;
  selectedSKU?: string;
  selectedStatus?: string;
  selectedCanal?: string;
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
  const { getQueryParams, resetToAll, preset } = useDateFilter();

  // Estado dos filtros
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    selectedClients: [],
    selectedSKUs: [],
    selectedStatuses: [],
    selectedCanais: [],
    // Retrocompatibilidade
    selectedClient: '',
    selectedSKU: '',
    selectedStatus: '',
    selectedCanal: '',
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
    // Limpa os filtros de seleção
    const clearedFilters = {
      searchTerm: '',
      selectedClients: [],
      selectedSKUs: [],
      selectedStatuses: [],
      selectedCanais: [],
      selectedClient: '',
      selectedSKU: '',
      selectedStatus: '',
      selectedCanal: '',
      ...defaultFilters
    };
    setFilters(clearedFilters);
    saveFilters(clearedFilters);
    
    // Limpa também o filtro de data para mostrar todos os dados históricos
    resetToAll();
  }, [defaultFilters, saveFilters, resetToAll]);

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
    let count = 0;
    
    // Conta searchTerm se não estiver vazio
    if (filters.searchTerm && filters.searchTerm.trim() !== '') count++;
    
    // Conta arrays se tiverem elementos
    if (filters.selectedClients && filters.selectedClients.length > 0) count++;
    if (filters.selectedSKUs && filters.selectedSKUs.length > 0) count++;
    if (filters.selectedStatuses && filters.selectedStatuses.length > 0) count++;
    if (filters.selectedCanais && filters.selectedCanais.length > 0) count++;
    
    // Conta filtro de data se não for 'allTime' (todos os dados)
    if (preset && preset !== 'allTime') count++;
    
    return count;
  }, [filters, preset]);

  // Opções disponíveis para dropdowns (extraídas dos dados)
  const availableOptions = useMemo(() => {
    if (!Array.isArray(data)) return {};

    const clients = new Set<string>();
    const skus = new Set<string>();
    const statuses = new Set<string>();
    const canais = new Set<string>();

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

      // Extrair canais
      const canal = item['Canal'] || item['canal'];
      if (canal) canais.add(canal);
    });

    return {
      clients: Array.from(clients).sort(),
      skus: Array.from(skus).sort(),
      statuses: Array.from(statuses).sort(),
      canais: Array.from(canais).sort()
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
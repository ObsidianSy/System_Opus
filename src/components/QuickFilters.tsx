import React, { useEffect, useState } from 'react';
import { Search, X, Filter, User, Package, Tag, Store, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FilterState } from '@/hooks/useQuickFilters';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { MultiSelectFilter } from '@/components/MultiSelectFilter';

interface QuickFiltersProps {
  filters: FilterState;
  updateFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  availableOptions?: {
    clients?: string[];
    skus?: string[];
    statuses?: string[];
    canais?: string[];
  };
  activeFiltersCount: number;
  className?: string;
  showDateFilter?: boolean;
  customFilters?: React.ReactNode;
}

export const QuickFilters: React.FC<QuickFiltersProps> = ({
  filters,
  updateFilter,
  clearFilters,
  availableOptions = {},
  activeFiltersCount,
  className,
  showDateFilter = true,
  customFilters
}) => {
  const { clients = [], skus = [], statuses = [], canais = [] } = availableOptions;
  const { formatDisplayRange } = useDateFilter();
  // Estado local para o campo de busca — permite digitação instantânea
  const [localSearch, setLocalSearch] = useState<string>(filters.searchTerm || '');

  // Sincroniza o input local quando filtros externos mudam (ex.: limpar filtros)
  useEffect(() => {
    setLocalSearch(filters.searchTerm || '');
  }, [filters.searchTerm]);

  // Keyboard shortcuts
  // Debounce local para evitar chamadas custosas ao updateFilter em cada tecla
  const debouncedUpdate = useMemo(() => debounce((v: string) => {
    try {
      updateFilter('searchTerm', v);
    } catch (e) {
      // Silenciar erros aqui — updateFilter pode mudar entre renders
    }
  }, 300), [updateFilter]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        searchInput?.focus();
      }

      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        // Trigger upload action (implementar conforme necessário)
        console.log('Upload shortcut triggered');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filterChips = [
    { key: 'selectedClients', label: 'Clientes', values: filters.selectedClients || [], icon: User },
    { key: 'selectedSKUs', label: 'SKUs', values: filters.selectedSKUs || [], icon: Package },
    { key: 'selectedStatuses', label: 'Status', values: filters.selectedStatuses || [], icon: Tag },
    { key: 'selectedCanais', label: 'Canais', values: filters.selectedCanais || [], icon: Store },
  ].filter(chip => chip.values.length > 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Linha principal de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Busca por texto */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            data-search-input
            placeholder="Buscar por cliente, SKU ou pedido... (Ctrl+F)"
            value={localSearch}
            onChange={(e) => {
              const v = e.target.value;
              setLocalSearch(v);
              // updateFilter aplica debounce internamente em useQuickFilters
              updateFilter('searchTerm', v);
            }}
            className="pl-10 glass-card border-primary/20 focus:border-primary/40"
          />
        </div>

        {/* Filtro por Cliente */}
        {clients.length > 0 && (
          <MultiSelectFilter
            label="Cliente"
            icon={User}
            options={clients}
            selectedValues={filters.selectedClients || []}
            onChange={(values) => updateFilter('selectedClients', values)}
            placeholder="Clientes"
            className="w-[200px]"
          />
        )}

        {/* Filtro por SKU */}
        {skus.length > 0 && (
          <MultiSelectFilter
            label="SKU"
            icon={Package}
            options={skus}
            selectedValues={filters.selectedSKUs || []}
            onChange={(values) => updateFilter('selectedSKUs', values)}
            placeholder="SKUs"
            className="w-[180px]"
          />
        )}

        {/* Filtro por Canal */}
        {canais.length > 0 && (
          <MultiSelectFilter
            label="Canal/Loja"
            icon={Store}
            options={canais}
            selectedValues={filters.selectedCanais || []}
            onChange={(values) => updateFilter('selectedCanais', values)}
            placeholder="Canais"
            className="w-[200px]"
          />
        )}

        {/* Filtro por Status */}
        {statuses.length > 0 && (
          <MultiSelectFilter
            label="Status"
            icon={Tag}
            options={statuses}
            selectedValues={filters.selectedStatuses || []}
            onChange={(values) => updateFilter('selectedStatuses', values)}
            placeholder="Status"
            className="w-[180px]"
          />
        )}

        {/* Filtros customizados */}
        {customFilters}

        {/* Botão limpar filtros */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="glass-card border-destructive/20 text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4 mr-1" />
            Limpar ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Chips de filtros ativos */}
      {(filterChips.length > 0 || showDateFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center text-sm text-muted-foreground mr-2">
            <Filter className="w-4 h-4 mr-1" />
            Filtros ativos:
          </div>

          {/* Badge de data sempre visível */}
          {showDateFilter && (
            <Badge
              variant="outline"
              className="glass-card border-primary/30 text-primary"
            >
              <Calendar className="w-3 h-3 mr-1" />
              {formatDisplayRange()}
            </Badge>
          )}

          {filterChips.map(({ key, label, values, icon: Icon }) => (
            <React.Fragment key={key}>
              {values.map((value) => (
                <Badge
                  key={`${key}-${value}`}
                  variant="secondary"
                  className="glass-card border-primary/20 text-primary hover:bg-primary/10 cursor-pointer transition-colors"
                  onClick={() => {
                    const newValues = values.filter(v => v !== value);
                    updateFilter(key, newValues);
                  }}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {label}: {value}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
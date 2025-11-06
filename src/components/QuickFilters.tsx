import React, { useEffect } from 'react';
import { Search, X, Filter, User, Package, Tag, Store, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FilterState } from '@/hooks/useQuickFilters';
import { useDateFilter } from '@/contexts/DateFilterContext';

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

  // Keyboard shortcuts
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
    { key: 'selectedClient', label: 'Cliente', value: filters.selectedClient, icon: User },
    { key: 'selectedSKU', label: 'SKU', value: filters.selectedSKU, icon: Package },
    { key: 'selectedStatus', label: 'Status', value: filters.selectedStatus, icon: Tag },
    { key: 'selectedCanal', label: 'Canal', value: filters.selectedCanal, icon: Store },
  ].filter(chip => chip.value);

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
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10 glass-card border-primary/20 focus:border-primary/40"
          />
        </div>

        {/* Filtro por Cliente */}
        {clients.length > 0 && (
          <Select
            value={filters.selectedClient}
            onValueChange={(value) => updateFilter('selectedClient', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[180px] glass-card border-primary/20">
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent className="glass-card">
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro por SKU */}
        {skus.length > 0 && (
          <Select
            value={filters.selectedSKU}
            onValueChange={(value) => updateFilter('selectedSKU', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[150px] glass-card border-primary/20">
              <Package className="w-4 h-4 mr-2" />
              <SelectValue placeholder="SKU" />
            </SelectTrigger>
            <SelectContent className="glass-card max-h-[200px]">
              <SelectItem value="all">Todos os SKUs</SelectItem>
              {skus.map((sku) => (
                <SelectItem key={sku} value={sku}>
                  {sku}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro por Canal */}
        {canais.length > 0 && (
          <Select
            value={filters.selectedCanal}
            onValueChange={(value) => updateFilter('selectedCanal', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[200px] glass-card border-primary/20">
              <Store className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Canal/Loja" />
            </SelectTrigger>
            <SelectContent className="glass-card max-h-[300px]">
              <SelectItem value="all">Todos os canais</SelectItem>
              {canais.map((canal) => (
                <SelectItem key={canal} value={canal}>
                  {canal}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro por Status */}
        {statuses.length > 0 && (
          <Select
            value={filters.selectedStatus}
            onValueChange={(value) => updateFilter('selectedStatus', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[150px] glass-card border-primary/20">
              <Tag className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="glass-card">
              <SelectItem value="all">Todos os status</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

          {filterChips.map(({ key, label, value, icon: Icon }) => (
            <Badge
              key={key}
              variant="secondary"
              className="glass-card border-primary/20 text-primary hover:bg-primary/10 cursor-pointer transition-colors"
              onClick={() => updateFilter(key, '')}
            >
              <Icon className="w-3 h-3 mr-1" />
              {label}: {value}
              <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
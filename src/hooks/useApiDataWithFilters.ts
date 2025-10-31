import { useMemo, useCallback } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { consultarDados } from '@/services/n8nIntegration';
import { useQuery } from '@tanstack/react-query';

interface UseApiDataWithFiltersOptions {
  showToasts?: boolean;
  retryOnError?: boolean;
  retryDelay?: number;
}

// Hook estendido que inclui filtros de data nos parâmetros de cache e query
export const useApiDataWithFilters = <T = any>(
  sheetName: string,
  options: UseApiDataWithFiltersOptions = {}
) => {
  const { getQueryParams, dateRange, timezone } = useDateFilter();
  const dateParams = getQueryParams();

  // Usar react-query com cache baseado em data
  const queryKey = [sheetName, dateParams.startDate, dateParams.endDate];
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      console.log(`Consultando ${sheetName} com filtros de data:`, { ...dateParams, timezone, range: dateRange });
      const result = await consultarDados(sheetName);
      if (!Array.isArray(result)) return result || [];

      // Limites inclusivos no fuso horário local (00:00:00.000 até 23:59:59.999)
      const startTs = new Date(
        dateRange.startDate.getFullYear(),
        dateRange.startDate.getMonth(),
        dateRange.startDate.getDate(),
        0, 0, 0, 0
      ).getTime();
      const endTs = new Date(
        dateRange.endDate.getFullYear(),
        dateRange.endDate.getMonth(),
        dateRange.endDate.getDate(),
        23, 59, 59, 999
      ).getTime();

      const parseDateLocal = (s: any): Date | null => {
        if (!s) return null;
        if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
        if (typeof s === 'string') {
          const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
          const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
          if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
      };

      const filtered = result.filter((item: any) => {
        const dataItem = item['Data Venda'] || item['Data Pagamento'] || item['Data'];
        const d = parseDateLocal(dataItem);
        if (!d) return true; // incluir itens sem data
        const ts = d.getTime();
        return ts >= startTs && ts <= endTs;
      });

      // Ordenar por data desc (mais recentes no topo) quando houver data reconhecida
      const sorted = [...filtered].sort((a: any, b: any) => {
        const da = parseDateLocal(a['Data Venda'] || a['Data Pagamento'] || a['Data']);
        const db = parseDateLocal(b['Data Venda'] || b['Data Pagamento'] || b['Data']);
        const ta = da ? da.getTime() : -Infinity;
        const tb = db ? db.getTime() : -Infinity;
        return tb - ta;
      });

      return sorted;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
    retry: options.retryOnError !== false ? 2 : 0,
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    data: data || [],
    isLoading,
    error: error?.message || null,
    refresh,
    dateParams
  };
};

// Hook para dados agregados da aplicação com filtros de data
export const useAppDataWithFilters = () => {
  const vendas = useApiDataWithFilters('Vendas');
  const clientes = useApiDataWithFilters('Clientes');
  const produtos = useApiDataWithFilters('Estoque');
  const pagamentos = useApiDataWithFilters('Pagamentos');

  const isAnyLoading = vendas.isLoading || clientes.isLoading || produtos.isLoading || pagamentos.isLoading;

  const refreshAll = useCallback(() => {
    vendas.refresh();
    clientes.refresh();
    produtos.refresh();
    pagamentos.refresh();
  }, [vendas.refresh, clientes.refresh, produtos.refresh, pagamentos.refresh]);

  return {
    vendas,
    clientes,
    produtos,
    pagamentos,
    isAnyLoading,
    refreshAll
  };
};
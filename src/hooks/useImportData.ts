import { useState, useCallback, useMemo } from 'react';
import { importService } from '@/services/importService';
import type { ImportRow, ImportSummary } from '@/types/import.types';
import { useToast } from '@/hooks/use-toast';

export const useImportData = () => {
  const [pendingItems, setPendingItems] = useState<ImportRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary>({
    total: 0,
    relacionados: 0,
    pendentes: 0,
    taxa_match: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadPendingItems = useCallback(async (page: number = 1, pageSize: number = 20, clientId?: string) => {
    setIsLoading(true);
    try {
      const response = await importService.getImportRows({
        clientId: clientId,
        status: 'pendentes',
        page,
        pageSize,
      });
      setPendingItems(response);
      return response;
    } catch (error) {
      console.error('Erro ao carregar itens pendentes:', error);
      toast({
        title: 'Erro ao carregar itens',
        description: 'Não foi possível carregar os itens pendentes.',
        variant: 'destructive',
      });
      setPendingItems([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadSummary = useCallback(async (clientId?: string, importId?: string) => {
    try {
      const summaryData = await importService.getImportSummary({
        clientId,
        importId,
        source: 'ML' // Especificar que é ML
      });
      setSummary(summaryData);
      return summaryData;
    } catch (error) {
      console.error('Error loading summary:', error);
      const defaultSummary = { total: 0, relacionados: 0, pendentes: 0, taxa_match: 0 };
      setSummary(defaultSummary);
      return defaultSummary;
    }
  }, []);

  const loadImportRows = useCallback(async (opts: {
    clientId?: string;
    importId?: string;
    status?: 'Todos' | 'relacionados' | 'pendentes';
    q?: string;
    page?: number;
    pageSize?: number;
  }) => {
    setIsLoading(true);
    try {
      const data = await importService.getImportRows({
        ...opts,
        source: 'ML' // Especificar que é ML
      });
      return data;
    } catch (error) {
      console.error('Error loading import rows:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os dados importados.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const autoRelateAll = useCallback(async (clientId?: string) => {
    setIsLoading(true);
    try {
      const result = await importService.autoRelateAll(clientId);
      toast({
        title: 'Auto-relacionamento concluído',
        description: `Relacionados: ${result.relacionados} / Pendentes: ${result.pendentes}`,
      });
      return result;
    } catch (error) {
      toast({
        title: 'Erro no auto-relacionamento',
        description: 'Não foi possível executar o auto-relacionamento.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const manualMatch = useCallback(async (
    rawId: number,
    sku: string,
    item?: ImportRow,
    source?: 'manual' | 'alias' | 'direct'
  ) => {
    try {
      const result = await importService.relateItem({
        raw_id: rawId,
        sku: sku,
        source: source || 'manual',
        learn_alias: true,
        alias_text: item?.sku_original || undefined,
      });

      // Retornar o resultado sem lançar erro - deixar o componente decidir o que fazer
      return result;
    } catch (error) {
      console.error('Erro no relacionamento manual:', error);
      return { ok: false, error: 'network_error' };
    }
  }, []);

  return {
    pendingItems,
    summary,
    isLoading,
    loadPendingItems,
    loadSummary,
    loadImportRows,
    autoRelateAll,
    manualMatch
  };
};

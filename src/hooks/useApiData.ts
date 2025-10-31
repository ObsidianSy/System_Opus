import { useState, useEffect, useCallback } from 'react';
import { consultarDados } from '@/services/n8nIntegration';
import { notificationManager } from '@/components/NotificationManager';

interface UseApiDataOptions {
  showToasts?: boolean;
  retryOnError?: boolean;
  retryDelay?: number;
}

export const useApiData = <T = any>(
  sheetName: string, 
  options: UseApiDataOptions = {}
) => {
  const { showToasts = false, retryOnError = true, retryDelay = 2000 } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchData = useCallback(async (showLoadingToast = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (showLoadingToast && showToasts) {
        notificationManager.show(`loading-${sheetName}`, `Carregando ${sheetName.toLowerCase()}...`, 'loading');
      }

      const result = await consultarDados(sheetName);
      setData(result);
      setRetryCount(0);

      if (showToasts) {
        notificationManager.dismiss(`loading-${sheetName}`);
        notificationManager.show(`success-${sheetName}`, `${result.length} ${sheetName.toLowerCase()} carregados`, 'success');
      }

    } catch (err) {
      const errorMessage = `Erro ao carregar ${sheetName.toLowerCase()}`;
      setError(errorMessage);

      if (retryOnError && retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchData();
        }, retryDelay);
      } else if (showToasts) {
        notificationManager.dismiss(`loading-${sheetName}`);
        notificationManager.show(`error-${sheetName}`, errorMessage, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sheetName, showToasts, retryOnError, retryDelay, retryCount]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = () => fetchData(true);

  return { 
    data, 
    isLoading, 
    error, 
    refresh,
    retryCount 
  };
};

// Hook específico para dados frequentemente usados
export const useAppData = () => {
  const vendas = useApiData('Vendas');
  const clientes = useApiData('Clientes');
  const produtos = useApiData('Estoque');
  const pagamentos = useApiData('Pagamentos');

  const isAnyLoading = vendas.isLoading || clientes.isLoading || produtos.isLoading || pagamentos.isLoading;

  const refreshAll = () => {
    vendas.refresh();
    clientes.refresh();
    produtos.refresh();
    pagamentos.refresh();
  };

  return {
    vendas,
    clientes,
    produtos,
    pagamentos,
    isAnyLoading,
    refreshAll
  };
};
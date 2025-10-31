import { useState, useEffect, useCallback, useMemo } from 'react';
import { consultarDados } from '@/services/n8nIntegration';
import { toast } from 'sonner';

interface UseProductsOptions {
  autoLoad?: boolean;
  refreshInterval?: number;
}

export const useProducts = (options: UseProductsOptions = {}) => {
  const { autoLoad = true, refreshInterval } = options;
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await consultarDados('Estoque');
      setProducts(data || []);
      return data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao carregar produtos');
      setError(error);
      console.error('Erro ao carregar produtos:', err);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    return loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (autoLoad) {
      loadProducts();
    }
  }, [autoLoad, loadProducts]);

  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(loadProducts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadProducts]);

  // Memoizar produtos não-kit
  const nonKitProducts = useMemo(() => {
    return products.filter(p => {
      const tipo = p["Tipo Produto"] || p.tipo_produto;
      return tipo !== "KIT";
    });
  }, [products]);

  // Memoizar estatísticas
  const stats = useMemo(() => {
    const lowStock = nonKitProducts.filter(p => 
      (p.quantidade || p["Quantidade Atual"] || 0) < 10
    ).length;
    
    const outOfStock = nonKitProducts.filter(p => 
      (p.quantidade || p["Quantidade Atual"] || 0) === 0
    ).length;
    
    const totalValue = nonKitProducts.reduce((acc, p) => {
      const qty = p.quantidade || p["Quantidade Atual"] || 0;
      const price = p.preco_unitario || p["Preço Unitário"] || 0;
      return acc + (qty * price);
    }, 0);

    return {
      total: products.length,
      nonKitTotal: nonKitProducts.length,
      lowStock,
      outOfStock,
      totalValue
    };
  }, [products, nonKitProducts]);

  // Memoizar categorias e tipos únicos
  const categories = useMemo(() => {
    return Array.from(new Set(
      products.map(p => p.categoria || p["Categoria"]).filter(Boolean)
    ));
  }, [products]);

  const types = useMemo(() => {
    return Array.from(new Set(
      products.map(p => p.tipo_produto || p["Tipo Produto"]).filter(Boolean)
    ));
  }, [products]);

  return {
    products,
    nonKitProducts,
    isLoading,
    error,
    stats,
    categories,
    types,
    refresh,
    loadProducts
  };
};

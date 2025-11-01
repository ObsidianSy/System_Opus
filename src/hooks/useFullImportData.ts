import { useState, useCallback } from 'react';
import { importService } from '@/services/importService';
import { useToast } from '@/hooks/use-toast';

// Tipos movidos para aqui já que não usamos mais importFullService
export interface FullEnvioListItem {
  envio_id: number;
  envio_num: string;
  created_at: string;
  tot_itens: number;
  tot_qtd: number;
  registrados_itens: number;
  registrados_qtd: number;
  pendentes_itens: number;
  pendentes_qtd: number;
  status: 'rascunho' | 'registrado';
}

export interface FullEnvioSummary {
  tot_itens: number;
  tot_qtd: number;
  registrados_itens: number;
  registrados_qtd: number;
  pendentes_itens: number;
  pendentes_qtd: number;
}

export interface FullEnvioItem {
  id: number;
  row_num: number;
  codigo_ml?: string;
  sku_texto: string;
  matched_sku: string;
  qtd: number;
  processed_at?: string;
}

export interface FullEnvioPending {
  id: number;
  row_num: number;
  codigo_ml?: string;
  sku_texto: string;
  qtd: number;
}

export interface SkuSearchResult {
  sku: string;
  nome: string;
  preco_unitario: number;
  quantidade_atual: number;
  is_kit: boolean;
  source: 'exact' | 'alias' | 'prefix' | 'fuzzy';
  score: number;
}

export const useFullImportData = () => {
  // ✅ Sempre inicializar com arrays vazios, nunca undefined
  const [envios, setEnvios] = useState<FullEnvioListItem[]>([]);
  const { data: todosProdutos } = useApiData('Estoque');
  const [items, setItems] = useState<FullEnvioItem[]>([]);
  const [pendings, setPendings] = useState<FullEnvioPending[]>([]);
  const [summary, setSummary] = useState<FullEnvioSummary | null>(null);
  const [currentEnvioId, setCurrentEnvioId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();


  const buscarSkuLocal = useCallback((termo: string): SkuSearchResult[] => {
    if (!todosProdutos || todosProdutos.length === 0) return [];

    const termoUpper = termo.toUpperCase().trim();

    if (termoUpper === '' || termoUpper === '*') {
      return todosProdutos.slice(0, 100).map((p: any) => ({
        sku: p.sku,
        nome: p.nome,
        preco_unitario: p.preco_unitario,
        quantidade_atual: p.quantidade_atual,
        is_kit: p.is_kit || p.tipo_produto === 'KIT',
        source: 'all' as const,
        score: 1.0
      }));
    }

    const resultados: SkuSearchResult[] = [];

    todosProdutos.forEach((p: any) => {
      const skuUpper = (p.sku || '').toUpperCase();
      const nomeUpper = (p.nome || '').toUpperCase();

      let score = 0;
      let source: 'exact' | 'prefix' | 'fuzzy' | 'alias' = 'fuzzy';

      if (skuUpper === termoUpper) {
        score = 1.0;
        source = 'exact';
      } else if (skuUpper.startsWith(termoUpper)) {
        score = 0.8;
        source = 'prefix';
      } else if (skuUpper.includes(termoUpper)) {
        score = 0.6;
        source = 'fuzzy';
      } else if (nomeUpper.includes(termoUpper)) {
        score = 0.4;
        source = 'fuzzy';
      }

      if (score > 0) {
        resultados.push({
          sku: p.sku,
          nome: p.nome,
          preco_unitario: p.preco_unitario,
          quantidade_atual: p.quantidade_atual,
          is_kit: p.is_kit || p.tipo_produto === 'KIT',
          source: source,
          score: score
        });
      }
    });

    return resultados
      .sort((a, b) => b.score !== a.score ? b.score - a.score : a.sku.localeCompare(b.sku))
      .slice(0, 100);
  }, [todosProdutos]);

  const loadEnvios = useCallback(async (clienteNome: string, dias = 30) => {
    setIsLoading(true);
    try {
      const response = await importService.listEnviosByCliente(clienteNome, dias);
      // ✅ Sempre garantir array, mesmo se API retornar null/undefined
      setEnvios(Array.isArray(response.envios) ? response.envios : []);
      return Array.isArray(response.envios) ? response.envios : [];
    } catch (error: any) {
      console.error('Erro ao carregar envios:', error);
      toast({
        title: 'Erro ao carregar envios',
        description: error.message || 'Não foi possível carregar a lista de envios.',
        variant: 'destructive',
      });
      setEnvios([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadEnvioDetails = useCallback(async (clienteNome: string, envioNum: string) => {
    setIsLoading(true);
    try {
      const response = await importService.getEnvioDetails(clienteNome, envioNum);

      // ✅ Sempre garantir arrays, mesmo se API retornar null/undefined
      const registrados = Array.isArray(response.registrados) ? response.registrados : [];
      const pendentes = Array.isArray(response.pendentes) ? response.pendentes : [];

      setSummary(response.resumo || null);
      setItems(registrados);
      setPendings(pendentes);
      setCurrentEnvioId(response.envio?.envio_id || null);

      return {
        envioId: response.envio?.envio_id || null,
        envioNum: response.envio?.envio_num || envioNum,
        summary: response.resumo || null,
        items: registrados,
        pendings: pendentes,
      };
    } catch (error: any) {
      console.error('Erro ao carregar detalhes do envio:', error);
      toast({
        title: 'Erro ao carregar detalhes',
        description: error.message || 'Não foi possível carregar os detalhes do envio.',
        variant: 'destructive',
      });
      // ✅ Limpar estado com valores seguros
      setSummary(null);
      setItems([]);
      setPendings([]);
      setCurrentEnvioId(null);
      return { envioId: null, envioNum: null, summary: null, items: [], pendings: [] };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadAllItemsByCliente = useCallback(async (clienteNome: string) => {
    setIsLoading(true);
    try {
      const rawItems = await importService.getAllItemsByCliente(clienteNome);

      console.log('📦 Resposta do backend (getAllItemsByCliente):', rawItems);
      console.log('📦 Tipo:', typeof rawItems, 'É array?', Array.isArray(rawItems));
      console.log('📦 Chaves do objeto:', Object.keys(rawItems));

      // Garantir que rawItems é um array
      const itemsArray = Array.isArray(rawItems) ? rawItems : [];

      console.log('📦 Items array length:', itemsArray.length);

      // Separar itens processados e pendentes
      const processed = itemsArray.filter(item => item.matched_sku);
      const pending = itemsArray.filter(item => !item.matched_sku);

      console.log('📦 Processados:', processed.length, 'Pendentes:', pending.length);

      // Converter para formato esperado pelo componente
      const formattedItems = processed.map(item => ({
        id: item.full_raw_id,
        row_num: item.full_raw_id,
        codigo_ml: item.envio_num,
        sku_texto: item.sku_texto,
        matched_sku: item.matched_sku,
        qtd: 1,
        processed_at: item.is_emitted ? new Date().toISOString() : undefined,
      }));

      const formattedPendings = pending.map(item => ({
        id: item.full_raw_id,
        row_num: item.full_raw_id,
        codigo_ml: item.envio_num,
        sku_texto: item.sku_texto,
        qtd: 1,
      }));

      setItems(formattedItems);
      setPendings(formattedPendings);
      setSummary({
        tot_itens: itemsArray.length,
        tot_qtd: itemsArray.length,
        registrados_itens: processed.length,
        registrados_qtd: processed.length,
        pendentes_itens: pending.length,
        pendentes_qtd: pending.length,
      });
      setCurrentEnvioId(null);

      return { items: formattedItems, pendings: formattedPendings };
    } catch (error: any) {
      console.error('Erro ao carregar itens do cliente:', error);
      toast({
        title: 'Erro ao carregar itens',
        description: error.message || 'Não foi possível carregar os itens do cliente.',
        variant: 'destructive',
      });
      setItems([]);
      setPendings([]);
      setSummary(null);
      return { items: [], pendings: [] };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const matchLine = useCallback(async (params: {
    rawId: number;
    matchedSku: string;
    createAlias?: boolean;
    aliasText?: string;
  }) => {
    try {
      const result = await importService.matchFullLine(params);
      toast({
        title: 'Linha confirmada',
        description: `${result.emitidos} venda(s) emitida(s), ${result.alias_ops} alias criado(s).`,
      });
      setCurrentEnvioId(result.envio_id);
      return { ok: true, envio_id: result.envio_id };
    } catch (error: any) {
      toast({
        title: 'Erro ao confirmar',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive',
      });
      return { ok: false };
    }
  }, [toast]);

  const searchSku = useCallback(async (q: string, clientId: number) => {
    try {
      return await importService.searchSku(q, clientId);
    } catch (error: any) {
      console.error('Erro na busca de SKU:', error);
      return [];
    }
  }, []);

  return {
    envios,
    items,
    pendings,
    summary,
    currentEnvioId,
    isLoading,
    loadEnvios,
    loadEnvioDetails,
    loadAllItemsByCliente,
    matchLine,
    searchSku,
  };
};

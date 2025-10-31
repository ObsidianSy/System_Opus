import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Link, Check, X, AlertCircle, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { importService } from '@/services/importService';
import type { ImportRow } from '@/types/import.types';
import { useApiData } from '@/hooks/useApiData';
import { KitRelationModal } from './KitRelationModal';
import { useImportData } from '@/hooks/useImportData';
import { sortBySKU } from '@/utils/sortUtils';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { useImportClient } from '@/contexts/ImportClientContext';

// Score mínimo para confirmação em lote
const BATCH_MIN_SCORE = 0.8;

interface SuggestionItem {
  sku: string;
  name: string;
  score: number;
}

export const RelateItemsTab = memo(function RelateItemsTab() {
  const { selectedClientId, setSelectedClientId, availableClients, isLoadingClients } = useImportClient();
  
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [manualSku, setManualSku] = useState<Record<number, string>>({});
  const [kitModalOpen, setKitModalOpen] = useState(false);
  const [selectedItemForKit, setSelectedItemForKit] = useState<ImportRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  
  const { toast } = useToast();
  const { data: produtos } = useApiData('Estoque');
  
  // Use custom import data hook
  const { 
    pendingItems, 
    isLoading, 
    loadPendingItems, 
    manualMatch: performManualMatch 
  } = useImportData();

  // Filtrar duplicados - mostrar apenas 1 item por pedido+SKU
  const uniquePendingItems = useMemo(() => {
    const seen = new Map<string, ImportRow>();
    pendingItems.forEach(item => {
      if (item.id_pedido && item.sku_original) {
        const key = `${item.id_pedido}-${item.sku_original}`;
        if (!seen.has(key)) {
          seen.set(key, item);
        }
      }
    });
    return Array.from(seen.values());
  }, [pendingItems]);

  // Memoize suggestions generation com scoring determinístico
  const generateSuggestions = useCallback((skuText: string, stockItems: any[]): SuggestionItem[] => {
    if (!skuText || !stockItems) return [];
    
    const normalizedSku = skuText.toUpperCase().trim();
    const firstToken = normalizedSku.split(/[\s\-_]/)[0];
    
    // Filtrar produtos com SKU válido (não vazio)
    const validProducts = stockItems.filter((item: any) => {
      const sku = item.SKU;
      return sku && String(sku).trim() !== '';
    });
    
    // Calcular score para cada produto
    const scored = validProducts.map((item: any) => {
      const itemSku = String(item.SKU).toUpperCase().trim();
      const itemName = String(item['Nome Produto'] || '').toUpperCase();
      let score = 0.7; // score base
      
      // Score 1.0: Match exato
      if (itemSku === normalizedSku) {
        score = 1.0;
      }
      // Score 0.9: Um contém o outro
      else if (itemSku.includes(normalizedSku) || normalizedSku.includes(itemSku)) {
        score = 0.9;
      }
      // Score 0.8: Primeiro token do SKU original aparece no nome do produto
      else if (itemName.includes(firstToken)) {
        score = 0.8;
      }
      
      return {
        sku: item.SKU,
        name: item['Nome Produto'],
        score,
      };
    });
    
    // Ordenar por score desc e pegar top 3
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, []);

  // Memoize suggestions (usando uniquePendingItems)
  const suggestions = useMemo(() => {
    const newSuggestions: Record<number, SuggestionItem[]> = {};
    uniquePendingItems.forEach((item) => {
      if (item.id_raw && item.sku_original) {
        newSuggestions[item.id_raw] = generateSuggestions(item.sku_original, produtos || []);
      }
    });
    return newSuggestions;
  }, [uniquePendingItems, produtos, generateSuggestions]);

  useEffect(() => {
    const fetchData = async () => {
      const items = await loadPendingItems(currentPage, pageSize, selectedClientId || undefined);
      // Carregar total real via API de summary
      try {
        const summaryData = await importService.getImportSummary({
          clientId: selectedClientId || undefined
        });
        setTotalItems(summaryData.pendentes);
      } catch (error) {
        // Fallback: usar tamanho dos itens retornados
        setTotalItems(items.length);
      }
    };
    fetchData();
  }, [currentPage, pageSize, selectedClientId, loadPendingItems]);

  const handleManualMatch = useCallback(async (
    rawId: number, 
    sku: string, 
    source: 'manual' | 'alias' | 'direct' = 'manual'
  ) => {
    // Validação básica
    if (!sku || sku.trim() === '') {
      toast({
        title: 'SKU Inválido',
        description: 'Por favor, selecione um SKU válido.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const item = pendingItems.find(p => p.id_raw === rawId);
      const result = await performManualMatch(rawId, sku, item, source);
      
      if (result.ok) {
        toast({
          title: 'Relacionamento confirmado',
          description: source === 'alias' 
            ? 'Sugestão aprovada e padrão aprendido!' 
            : 'Item relacionado e padrão aprendido.',
        });
        await loadPendingItems(currentPage, pageSize, selectedClientId || undefined);
      } else {
        // Mensagens específicas
        const errorMessages: Record<string, string> = {
          raw_not_found: 'Item não encontrado no banco',
          already_related: 'Este item já foi relacionado',
          invalid_payload: 'Dados inválidos',
          sku_empty: 'SKU vazio',
          raw_id_invalid: 'ID do item inválido',
          source_invalid: 'Tipo de relacionamento inválido',
          timeout: 'Tempo limite excedido (30s)',
          network_error: 'Erro de conexão com o servidor',
        };
        
        toast({
          title: 'Erro no relacionamento',
          description: errorMessages[result.error || ''] || result.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erro no relacionamento manual:', error);
      toast({
        title: 'Erro no relacionamento',
        description: 'Não foi possível relacionar o item.',
        variant: 'destructive',
      });
    }
  }, [pendingItems, performManualMatch, loadPendingItems, toast]);

  const handleBatchConfirm = async () => {
    const itemsToConfirm = Array.from(selectedItems);
    let successCount = 0;
    let errorCount = 0;
    let ignoredCount = 0;
    
    toast({
      title: 'Processando',
      description: `Confirmando ${itemsToConfirm.length} sugestões...`,
    });
    
    for (const rawId of itemsToConfirm) {
      const item = pendingItems.find(p => p.id_raw === rawId);
      const itemSuggestions = suggestions[rawId] || [];
      
      // Filtrar sugestões válidas (SKU não vazio) e score >= BATCH_MIN_SCORE
      const validSuggestions = itemSuggestions.filter(
        s => s.sku && String(s.sku).trim() !== '' && s.score >= BATCH_MIN_SCORE
      );
      
      if (validSuggestions.length === 0) {
        ignoredCount++;
        console.warn(`[batch] Item ${rawId} ignorado: sem sugestão válida >= ${BATCH_MIN_SCORE}`);
        continue;
      }
      
      // Escolher a melhor sugestão
      const bestSuggestion = validSuggestions[0];
      
      console.info('[batch] Enviando', { 
        raw_id: rawId, 
        sku: bestSuggestion.sku,
        score: bestSuggestion.score,
        source: 'alias'
      });
      
      const result = await performManualMatch(rawId, bestSuggestion.sku, item, 'alias');
      
      if (result.ok) {
        successCount++;
      } else {
        errorCount++;
        console.error(`[batch] Erro ao confirmar item ${rawId}:`, result.error);
      }
    }
    
    setSelectedItems(new Set());
    
    // Recarregar lista após processar todos
    await loadPendingItems(currentPage, pageSize, selectedClientId || undefined);
    
    // Feedback final detalhado
    const total = itemsToConfirm.length;
    const parts = [`✓ ${successCount} confirmados`];
    if (errorCount > 0) parts.push(`✗ ${errorCount} erros`);
    if (ignoredCount > 0) parts.push(`⊘ ${ignoredCount} ignorados (score < ${BATCH_MIN_SCORE * 100}%)`);
    
    toast({
      title: errorCount > successCount ? 'Processamento com erros' : 'Concluído',
      description: parts.join(' | '),
      variant: errorCount > successCount ? 'destructive' : 'default',
    });
  };

  const toggleItemSelection = (rawId: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(rawId)) {
      newSelection.delete(rawId);
    } else {
      newSelection.add(rawId);
    }
    setSelectedItems(newSelection);
  };

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  const handleOpenKitModal = (item: ImportRow) => {
    setSelectedItemForKit(item);
    setKitModalOpen(true);
  };

  const handleKitRelated = async (kitSku: string) => {
    if (!selectedItemForKit?.id_raw) return;
    
    setKitModalOpen(false);
    setSelectedItemForKit(null);
    
    // Recarregar dados após relacionar o kit
    try {
      // Rodar auto-relacionar para pegar itens iguais
      await importService.autoRelateAll();
      
      // Recarregar lista de pendentes
      await loadPendingItems(currentPage, pageSize, selectedClientId || undefined);
      
      toast({
        title: 'Sucesso',
        description: `Item relacionado ao kit ${kitSku}`,
      });
    } catch (error) {
      console.error('Error refreshing after kit relation:', error);
      // Mesmo com erro no refresh, tentar recarregar
      await loadPendingItems(currentPage, pageSize, selectedClientId || undefined);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg">Relacionar Itens</CardTitle>
              <CardDescription>
                Vincule os itens pendentes com SKUs do estoque
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={selectedClientId || 'Todos'}
                onValueChange={(value) => {
                  const newClientId = value === 'Todos' ? null : value;
                  setSelectedClientId(newClientId);
                  setCurrentPage(1);
                }}
                disabled={isLoadingClients}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={isLoadingClients ? "Carregando..." : "Todos os clientes"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os clientes</SelectItem>
                  {availableClients.map(client => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => loadPendingItems(currentPage, pageSize, selectedClientId || undefined)} 
                variant="outline" 
                size="sm"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
              
              <Badge variant={totalItems > 0 ? "destructive" : "secondary"}>
                {totalItems} pendentes {selectedClientId ? `(${selectedClientId})` : '(todos)'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Estatísticas */}
          {uniquePendingItems.length > 0 && (
            <Alert className="border-warning/50 bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription>
                <strong>{uniquePendingItems.length}</strong> {uniquePendingItems.length === 1 ? 'item aguarda' : 'itens aguardam'} relacionamento.
                O sistema aprende com suas escolhas para melhorar futuras importações.
              </AlertDescription>
            </Alert>
          )}

          {/* Ações em Lote */}
          {selectedItems.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedItems.size} item(ns) selecionado(s)
              </span>
              <Button onClick={handleBatchConfirm} size="sm">
                Confirmar Sugestões (Score &gt; 0.8)
              </Button>
            </div>
          )}

          {/* Tabela de Itens Pendentes */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems(new Set(uniquePendingItems.map(p => p.id_raw).filter((id): id is number => id !== null)));
                        } else {
                          setSelectedItems(new Set());
                        }
                      }}
                      checked={selectedItems.size === uniquePendingItems.length && uniquePendingItems.length > 0}
                    />
                  </TableHead>
                  <TableHead>SKU Original / Pedido</TableHead>
                  <TableHead>Cliente / Canal</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Sugestões</TableHead>
                  <TableHead>Relacionar Manual</TableHead>
                  <TableHead>KIT</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : uniquePendingItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Nenhum item pendente de relacionamento
                    </TableCell>
                  </TableRow>
                ) : (
                  uniquePendingItems.map((item) => {
                    if (!item.id_raw) return null;
                    return (
                      <TableRow key={item.id_raw}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id_raw)}
                            onChange={() => toggleItemSelection(item.id_raw!)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.sku_original || '—'}</p>
                              {item.sku_relacionado && (() => {
                                const produto = produtos?.find((p: any) => 
                                  (p.SKU || p.sku) === item.sku_relacionado
                                );
                                const isKit = produto && (produto["Tipo Produto"] || produto.tipo_produto) === "KIT";
                                return isKit ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <Package className="w-3 h-3 mr-1" />
                                    KIT
                                  </Badge>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Pedido: {item.id_pedido || '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{item.cliente || '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.canal || '—'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.qtd ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {item.valor_unit != null ? formatCurrency(item.valor_unit) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {suggestions[item.id_raw]?.map((sugg, idx) => {
                              const produtoSugg = produtos?.find((p: any) => (p.SKU || p.sku) === sugg.sku);
                              const isKit = produtoSugg && (produtoSugg["Tipo Produto"] || produtoSugg.tipo_produto) === "KIT";
                              
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <Badge 
                                    variant={sugg.score > 0.8 ? 'default' : 'outline'}
                                    className="text-xs"
                                  >
                                    {(sugg.score * 100).toFixed(0)}%
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs truncate max-w-[100px]" title={sugg.name}>
                                      {sugg.sku}
                                    </span>
                                    {isKit && (
                                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                        <Package className="w-2 h-2 mr-0.5" />
                                        KIT
                                      </Badge>
                                    )}
                                  </div>
                                   <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2"
                                    onClick={() => handleManualMatch(item.id_raw!, sugg.sku, 'alias')}
                                    title="Aprovar esta sugestão"
                                  >
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  {isKit && produtoSugg?.Componentes && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 px-1">
                                          <Package className="h-3 w-3" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-72">
                                        <div className="space-y-2">
                                          <h4 className="font-medium text-sm">Componentes do Kit</h4>
                                          <div className="space-y-1 text-xs">
                                            {produtoSugg.Componentes.map((comp: any, idx: number) => (
                                              <div key={idx} className="flex justify-between">
                                                <span>{comp["SKU Componente"]}</span>
                                                <span className="text-muted-foreground">
                                                  Qtd: {comp["Quantidade por Kit"]}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              );
                            }) || <span className="text-xs text-muted-foreground">Sem sugestões</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Select
                              value={manualSku[item.id_raw] || ''}
                              onValueChange={(value) => setManualSku(prev => ({ ...prev, [item.id_raw!]: value }))}
                            >
                              <SelectTrigger className="w-[150px] h-8">
                                <SelectValue placeholder="Selecione SKU" />
                              </SelectTrigger>
                              <SelectContent>
                                {sortBySKU(
                                  (produtos || []).filter((p: any) => p && p.SKU && String(p.SKU).trim() !== ''),
                                  "SKU"
                                ).map((produto: any) => (
                                  <SelectItem key={String(produto.SKU)} value={String(produto.SKU)}>
                                    {String(produto.SKU)} — {produto['Nome Produto'] || ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {manualSku[item.id_raw] && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => handleManualMatch(item.id_raw!, manualSku[item.id_raw])}
                              >
                                <Link className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleOpenKitModal(item)}
                          >
                            <Package className="h-3 w-3 mr-1" />
                            KIT
                          </Button>
                        </TableCell>
                        <TableCell>
                           <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={async () => {
                              await loadPendingItems(currentPage, pageSize);
                              toast({
                                title: 'Item ignorado',
                                description: 'O item foi removido da lista de pendências.',
                              });
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Paginação */}
          {totalItems > 0 && (
            <DataTablePagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalItems / pageSize)}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={(page) => {
                setCurrentPage(page);
                setSelectedItems(new Set()); // Limpar seleção ao mudar de página
              }}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1); // Voltar para primeira página
                setSelectedItems(new Set()); // Limpar seleção
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal de relacionamento como KIT */}
      {selectedItemForKit && (
        <KitRelationModal
          isOpen={kitModalOpen}
          onClose={() => {
            setKitModalOpen(false);
            setSelectedItemForKit(null);
          }}
          onKitRelated={handleKitRelated}
          rawId={selectedItemForKit.id_raw!}
          skuOriginal={selectedItemForKit.sku_original || ''}
          availableProducts={produtos || []}
        />
      )}
    </div>
  );
});
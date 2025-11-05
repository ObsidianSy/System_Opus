import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { Link, Check, AlertCircle, Package, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useImportClient } from '@/contexts/ImportClientContext';
import { useFullImportData } from '@/hooks/useFullImportData';
import type { FullEnvioPending, SkuSearchResult } from '@/hooks/useFullImportData';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { FullKitRelationModal } from '../full/FullKitRelationModal';

const SOURCE_LABELS = {
  exact: { label: 'Exato', variant: 'default' as const },
  alias: { label: 'Alias', variant: 'secondary' as const },
  prefix: { label: 'Prefixo', variant: 'outline' as const },
  fuzzy: { label: 'Aproximado', variant: 'outline' as const },
};

interface FullRelateItemsTabProps {
  initialEnvioNum?: string;
  initialClienteNome?: string;
}

export const FullRelateItemsTab = memo(function FullRelateItemsTab({
  initialEnvioNum,
  initialClienteNome
}: FullRelateItemsTabProps) {
  const { selectedClientId, setSelectedClientId, availableClients, isLoadingClients } = useImportClient();
  const [searchEnvioNum, setSearchEnvioNum] = useState('');
  const [showEnviosList, setShowEnviosList] = useState(false);
  const [currentEnvio, setCurrentEnvio] = useState<{
    cliente: string;
    envioNum: string;
    envioId: number;
    clientId: number;
  } | null>(null);
  const [searchResults, setSearchResults] = useState<Record<number, SkuSearchResult[]>>({});
  const [selectedSkus, setSelectedSkus] = useState<Record<number, SkuSearchResult | null>>({});
  const [createAlias, setCreateAlias] = useState<Record<number, boolean>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [isAutoRelating, setIsAutoRelating] = useState(false);
  const [isEmitting, setIsEmitting] = useState(false);
  const [kitModalOpen, setKitModalOpen] = useState(false);
  const [selectedItemForKit, setSelectedItemForKit] = useState<any>(null);

  const { toast } = useToast();
  const {
    envios: enviosRaw,
    pendings: pendingsRaw,
    summary,
    currentEnvioId,
    isLoading,
    loadEnvios,
    loadEnvioDetails,
    matchLine,
    searchSku,
  } = useFullImportData();

  // Carregar TODOS os produtos diretamente da API
  const [todosProdutos, setTodosProdutos] = useState<any[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);

  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        setLoadingProdutos(true);
        const response = await fetch('/api/estoque');
        const data = await response.json();
        setTodosProdutos(data || []);
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        setTodosProdutos([]);
      } finally {
        setLoadingProdutos(false);
      }
    };
    carregarProdutos();
  }, []);

  // ✅ Garantir arrays seguros no componente (defesa em profundidade)
  const envios = Array.isArray(enviosRaw) ? enviosRaw : [];
  const pendings = Array.isArray(pendingsRaw) ? pendingsRaw : [];  // Get client ID from selectedClientId
  const selectedClient = useMemo(() => {
    return availableClients.find(c => c === selectedClientId);
  }, [availableClients, selectedClientId]);

  // Mapeamento de cliente → client_id
  const clientIdMap: Record<string, number> = {
    'New Seven': 1,
    'Realistt': 2,
    'Obsidian Ecom': 3,
    'zack': 4,
  };

  // Define cliente e envio inicial
  useEffect(() => {
    if (initialClienteNome && !selectedClientId) {
      setSelectedClientId(initialClienteNome);
    }
  }, [initialClienteNome, selectedClientId, setSelectedClientId]);

  // Carrega automaticamente o envio e busca
  useEffect(() => {
    if (initialEnvioNum && initialClienteNome && !currentEnvio) {
      const clientId = clientIdMap[initialClienteNome];
      if (clientId) {
        setSearchEnvioNum(initialEnvioNum);
        // Simula a busca automática
        setTimeout(async () => {
          try {
            const data = await loadEnvioDetails(initialClienteNome, initialEnvioNum);
            if (data) {
              setCurrentEnvio({
                cliente: initialClienteNome,
                envioNum: initialEnvioNum,
                envioId: data.envioId,
                clientId: clientId,
              });
              setShowEnviosList(false);
            }
          } catch (error) {
            console.error('Erro ao carregar envio automaticamente:', error);
          }
        }, 100);
      }
    }
  }, [initialEnvioNum, initialClienteNome, currentEnvio, loadEnvioDetails]);


  // Busca SKU localmente (igual o ML faz)
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
        source: 'fuzzy' as const,
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

  const handleSearch = async () => {
    if (!selectedClientId) {
      toast({
        title: 'Cliente não selecionado',
        description: 'Por favor, selecione um cliente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      // Mapeamento temporário de cliente → client_id
      const clientIdMap: Record<string, number> = {
        'New Seven': 1,
        'Realistt': 2,
        'Obsidian Ecom': 3,
        'zack': 4,
      };

      // Se tem número do envio, busca os detalhes
      if (searchEnvioNum.trim()) {
        const result = await loadEnvioDetails(selectedClientId, searchEnvioNum.trim());

        if (result && result.envioId) {
          setShowEnviosList(false);
          setCurrentEnvio({
            cliente: selectedClientId,
            envioNum: searchEnvioNum.trim(),
            envioId: result.envioId,
            clientId: clientIdMap[selectedClientId] || 1,
          });
          toast({
            title: 'Envio carregado',
            description: `${result.pendings.length} ${result.pendings.length === 1 ? 'pendência encontrada' : 'pendências encontradas'}.`,
          });
        } else {
          toast({
            title: 'Envio não encontrado',
            description: 'Não foi possível encontrar o envio especificado.',
            variant: 'destructive',
          });
        }
      } else {
        // Se não tem número, busca o envio mais recente do cliente
        const result = await loadEnvioDetails(selectedClientId, ''); // Sem envio_num = pega o mais recente

        if (result && result.envioId) {
          setShowEnviosList(false);
          setCurrentEnvio({
            cliente: selectedClientId,
            envioNum: result.envioNum || '',
            envioId: result.envioId,
            clientId: clientIdMap[selectedClientId] || 1,
          });
          toast({
            title: 'Envio mais recente carregado',
            description: `Envio ${result.envioNum} com ${result.pendings.length} ${result.pendings.length === 1 ? 'pendência' : 'pendências'}.`,
          });
        } else {
          // Se não tem envio recente, lista todos
          await loadEnvios(selectedClientId);
          setShowEnviosList(true);
          setCurrentEnvio(null);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectEnvio = async (envioNum: string) => {
    if (!selectedClientId) return;
    setSearchEnvioNum(envioNum);
    setShowEnviosList(false);

    const clientIdMap: Record<string, number> = {
      'New Seven': 1,
      'Realistt': 2,
      'Obsidian Ecom': 3,
      'zack': 4,
    };

    const result = await loadEnvioDetails(selectedClientId, envioNum);

    if (result && result.envioId) {
      setCurrentEnvio({
        cliente: selectedClientId,
        envioNum: envioNum,
        envioId: result.envioId,
        clientId: clientIdMap[selectedClientId] || 1,
      });
    }
  };

  const handleMatchLine = async (rawId: number) => {
    if (!currentEnvio) return;
    // Encontrar a linha pendente comparando por raw_id (quando existir) ou id
    const pending = pendings.find(p => {
      const rid = (p as any).raw_id ?? p.id;
      const ridNum = typeof rid === 'string' ? parseInt(rid) : rid;
      return ridNum === rawId;
    });
    const selectedSku = selectedSkus[rawId];

    if (!pending || !selectedSku) {
      console.error('❌ Pending ou SKU não selecionado:', { rawId, pending, selectedSku });
      return;
    }

    // Usar raw_id do pending se existir, senão usar id
    const actualRawId = (pending as any).raw_id || pending.id;

    console.log("📤 Enviando para matchLine:", { rawId: parseInt(actualRawId), matchedSku: selectedSku.sku, createAlias: createAlias[rawId] ?? true, aliasText: pending.sku_texto });

    const matchResult = await matchLine({
      rawId: parseInt(actualRawId),
      matchedSku: selectedSku.sku,
      createAlias: createAlias[rawId] ?? true,
      aliasText: pending.sku_texto,
    });

    if (matchResult.ok) {
      // Recarregar detalhes do envio após resolver pendência
      await loadEnvioDetails(currentEnvio.cliente, currentEnvio.envioNum);
      // Limpar busca e seleção deste item
      setSearchResults(prev => ({ ...prev, [rawId]: [] }));
      setSelectedSkus(prev => ({ ...prev, [rawId]: null }));
    }
  };

  const handleAutoRelate = async () => {
    if (!currentEnvio) return;

    setIsAutoRelating(true);
    try {
      const response = await fetch('/api/envios/auto-relate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envio_id: currentEnvio.envioId,
          source: 'FULL',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao auto-relacionar' }));
        throw new Error(error.message);
      }

      const result = await response.json();

      toast({
        title: 'Auto-relacionamento concluído',
        description: `${result.matched} itens relacionados automaticamente`,
      });

      // Recarregar detalhes do envio
      await loadEnvioDetails(currentEnvio.cliente, currentEnvio.envioNum);
    } catch (error: any) {
      console.error('Erro no auto-relacionamento:', error);
      toast({
        title: 'Erro ao auto-relacionar',
        description: error.message || 'Não foi possível auto-relacionar os itens',
        variant: 'destructive',
      });
    } finally {
      setIsAutoRelating(false);
    }
  };

  const handleEmitirVendas = async () => {
    if (!currentEnvio) return;

    setIsEmitting(true);
    try {
      const response = await fetch('/api/envios/emitir-vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envio_id: currentEnvio.envioId,
          source: 'FULL',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao emitir vendas' }));
        throw new Error(error.message || error.error);
      }

      const result = await response.json();

      toast({
        title: 'Vendas emitidas com sucesso! 🎉',
        description: `${result.items_count} SKUs processados. Estoque atualizado.`,
      });

      // Recarregar detalhes do envio
      await loadEnvioDetails(currentEnvio.cliente, currentEnvio.envioNum);
    } catch (error: any) {
      console.error('Erro ao emitir vendas:', error);
      toast({
        title: 'Erro ao emitir vendas',
        description: error.message || 'Não foi possível emitir as vendas',
        variant: 'destructive',
      });
    } finally {
      setIsEmitting(false);
    }
  }; const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Relacionar Itens FULL</CardTitle>
          <CardDescription>
            Busque um envio e vincule os itens pendentes com SKUs do estoque
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              value={selectedClientId || 'none'}
              onValueChange={(value) => {
                if (value === 'none') return;
                setSelectedClientId(value);
              }}
              disabled={isLoadingClients}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={isLoadingClients ? "Carregando..." : "Selecione o cliente"} />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-background">
                {availableClients.map(client => (
                  <SelectItem key={client} value={client}>{client}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Nº envio (opcional - deixe vazio para listar todos)"
              value={searchEnvioNum}
              onChange={(e) => setSearchEnvioNum(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />

            <Button
              onClick={handleSearch}
              disabled={isSearching || !selectedClientId}
            >
              <Search className={`h-4 w-4 mr-2 ${isSearching ? 'animate-spin' : ''}`} />
              {searchEnvioNum.trim() ? 'Buscar Envio' : 'Listar Todos'}
            </Button>
          </div>

          {/* Lista de Envios */}
          {showEnviosList && envios.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Envio</TableHead>
                    <TableHead className="text-right">Total Itens</TableHead>
                    <TableHead className="text-right">Registrados</TableHead>
                    <TableHead className="text-right">Pendentes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envios.map((envio) => (
                    <TableRow key={`${envio.envio_id}-${envio.envio_num}`}>
                      <TableCell className="font-mono font-medium">
                        {envio.envio_num}
                      </TableCell>
                      <TableCell className="text-right">
                        {envio.tot_itens} ({envio.tot_qtd} un)
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {envio.registrados_itens}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {envio.pendentes_itens}
                      </TableCell>
                      <TableCell>
                        <Badge variant={envio.status === 'registrado' ? 'default' : 'secondary'}>
                          {envio.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectEnvio(envio.envio_num)}
                          disabled={envio.pendentes_itens === 0}
                        >
                          {envio.pendentes_itens > 0 ? 'Relacionar' : 'Completo'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {showEnviosList && envios.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum envio encontrado para este cliente
            </div>
          )}

          {/* Summary */}
          {!showEnviosList && currentEnvio && summary && (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertDescription>
                <div className="flex flex-wrap gap-4">
                  <span><strong>Envio:</strong> {currentEnvio.envioNum}</span>
                  <span><strong>Itens:</strong> {summary.tot_itens}</span>
                  <span><strong>Qtd Total:</strong> {summary.tot_qtd}</span>
                  <span><strong>Registrados:</strong> {summary.registrados_itens} itens ({summary.registrados_qtd} un)</span>
                  <span><strong>Pendentes:</strong> {summary.pendentes_itens} itens ({summary.pendentes_qtd} un)</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Status */}
          {!showEnviosList && currentEnvio && (
            <div className="flex items-center gap-2">
              <Badge variant={pendings.length > 0 ? "destructive" : "secondary"}>
                {pendings.length} pendentes
              </Badge>
              {pendings.length > 0 && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAutoRelate}
                  disabled={isAutoRelating || isLoading}
                  className="gap-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Zap className="h-4 w-4" />
                  {isAutoRelating ? 'Auto-relacionando...' : 'Auto-Relacionar'}
                </Button>
              )}
              <Button
                size="sm"
                variant="default"
                onClick={handleEmitirVendas}
                disabled={isEmitting || isLoading}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Package className="h-4 w-4" />
                {isEmitting ? 'Emitindo...' : 'Emitir Vendas'}
              </Button>
              {pendings.length === 0 && (
                <Badge variant="default" className="bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Pronto!
                </Badge>
              )}
            </div>
          )}

          {/* Pendências */}
          {pendings.length > 0 && (
            <>
              <Alert className="border-warning/50 bg-warning/10">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  <strong>{pendings.length}</strong> {pendings.length === 1 ? 'item aguarda' : 'itens aguardam'} relacionamento.
                  Busque e selecione o SKU correspondente. O sistema aprenderá com suas escolhas.
                </AlertDescription>
              </Alert>

              {/* Tabela de Pendências */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código ML</TableHead>
                      <TableHead>SKU Texto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="w-[350px]">Buscar SKU</TableHead>
                      <TableHead className="text-center">Criar Alias</TableHead>
                      <TableHead className="text-center">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow key="loading">
                        <TableCell colSpan={6} className="text-center py-8">
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : pendings.length === 0 ? (
                      <TableRow key="empty">
                        <TableCell colSpan={6} className="text-center py-8">
                          Nenhum item pendente
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendings.map((item) => {
                        // Use uma chave única e estável por linha: prefira raw_id quando presente
                        const rawOrId = (item as any).raw_id ?? item.id;
                        const itemKey = typeof rawOrId === 'string' ? parseInt(rawOrId) : rawOrId;
                        const results = searchResults[itemKey] || [];
                        const selectedSku = selectedSkus[itemKey];

                        return (
                          <TableRow key={`${item.id}-${item.row_num}`}>
                            <TableCell>
                              <p className="font-medium">{item.codigo_ml || '—'}</p>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{item.sku_texto}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{item.qtd}</Badge>
                            </TableCell>
                            <TableCell>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start" onClick={() => {
                                    // Carrega lista inicial ao abrir
                                    if (!searchResults[itemKey] || searchResults[itemKey].length === 0) {
                                      const resultados = buscarSkuLocal('*');
                                      setSearchResults(prev => ({ ...prev, [itemKey]: resultados }));
                                    }
                                  }}>
                                    <Search className="h-4 w-4 mr-2" />
                                    {selectedSku ? `${selectedSku.sku} - ${selectedSku.nome}` : 'Buscar SKU...'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0 z-[90] bg-background" align="start">
                                  <Command>
                                    <CommandInput
                                      placeholder="Pesquisar SKU..."
                                      onValueChange={(value) => {
                                        // Busca local ao digitar
                                        const resultados = buscarSkuLocal(value);
                                        setSearchResults(prev => ({ ...prev, [itemKey]: resultados }));
                                      }}
                                    />
                                    <CommandList className="max-h-[300px]">
                                      {results.length === 0 ? (
                                        <CommandEmpty>Carregando SKUs...</CommandEmpty>
                                      ) : (
                                        <CommandGroup>
                                          {results.map((result, idx) => {
                                            const sourceLabel = SOURCE_LABELS[result.source as keyof typeof SOURCE_LABELS] || { label: 'Busca', variant: 'outline' as const };
                                            return (
                                              <CommandItem
                                                key={`${itemKey}-${result.sku}-${result.source}-${idx}`}
                                                value={`${result.sku} ${result.nome}`}
                                                onSelect={() => {
                                                  setSelectedSkus(prev => ({ ...prev, [itemKey]: result }));
                                                }}
                                                className="flex items-start gap-2 p-3 cursor-pointer"
                                              >
                                                <div className="flex-1 space-y-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{result.sku}</span>
                                                    <Badge
                                                      variant={sourceLabel.variant}
                                                      className="text-[10px]"
                                                    >
                                                      {sourceLabel.label}
                                                    </Badge>
                                                    {result.is_kit && (
                                                      <Badge variant="outline" className="text-[10px]">
                                                        KIT
                                                      </Badge>
                                                    )}
                                                    <Badge variant="secondary" className="text-[10px]">
                                                      {Math.round((result.score || 0) * 100)}%
                                                    </Badge>
                                                  </div>
                                                  <p className="text-sm text-muted-foreground">{result.nome}</p>
                                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>Estoque: {result.quantidade_atual || 0}</span>
                                                    <span>•</span>
                                                    <span>{formatCurrency(result.preco_unitario || 0)}</span>
                                                  </div>
                                                </div>
                                                <Zap className="h-4 w-4 text-primary opacity-50" />
                                              </CommandItem>
                                            );
                                          })}
                                        </CommandGroup>
                                      )}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={createAlias[itemKey] ?? true}
                                onCheckedChange={(checked) => {
                                  setCreateAlias(prev => ({ ...prev, [itemKey]: !!checked }));
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedItemForKit({
                                      raw_id: itemKey,
                                      sku_texto: item.sku_texto
                                    });
                                    setKitModalOpen(true);
                                  }}
                                  className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
                                >
                                  <Package className="h-4 w-4" />
                                  Kit
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleMatchLine(itemKey)}
                                  disabled={!selectedSku}
                                  className="gap-2"
                                >
                                  <Link className="h-4 w-4" />
                                  Relacionar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Mensagem de sucesso */}
          {currentEnvio && pendings.length === 0 && !isLoading && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-600">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span>
                    Todas as pendências foram resolvidas! As vendas foram emitidas automaticamente.
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Modal de Kit */}
      {selectedItemForKit && (
        <FullKitRelationModal
          open={kitModalOpen}
          onOpenChange={setKitModalOpen}
          rawId={selectedItemForKit.raw_id}
          skuOriginal={selectedItemForKit.sku_texto}
          onKitRelated={(sku) => {
            console.log('Kit relacionado:', sku);
            setKitModalOpen(false);
            // Recarregar detalhes do envio
            if (currentEnvio) {
              loadEnvioDetails(currentEnvio.cliente, currentEnvio.envioNum);
            }
          }}
        />
      )}
    </div>
  );
});

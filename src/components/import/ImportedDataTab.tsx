import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Search, RefreshCw, CheckCircle, XCircle, Send } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { importService } from '@/services/importService';
import { ImportFilters } from '@/types/import.types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useImportData } from '@/hooks/useImportData';
import { useImportClient } from '@/contexts/ImportClientContext';

interface ImportedOrder {
  id_raw: number;
  id_pedido: string;
  data: string;
  sku_original: string;
  sku_relacionado: string | null;
  qtd: number;
  valor_unit: number;
  cliente: string | null;
  canal: string;
  status: 'matched' | 'pending';
}

interface ImportSummary {
  total: number;
  relacionados: number;
  pendentes: number;
  taxa_match: number;
}

export const ImportedDataTab = memo(function ImportedDataTab() {
  const { selectedClientId, setSelectedClientId, availableClients, isLoadingClients } = useImportClient();

  const [data, setData] = useState<ImportedOrder[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  const [filters, setFilters] = useState<ImportFilters>({
    client_id: selectedClientId || undefined,
    page: 1,
    page_size: 50,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [isEmitting, setIsEmitting] = useState(false);
  const { toast } = useToast();

  // Sincronizar selectedClientId com filters
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      client_id: selectedClientId || undefined
    }));
  }, [selectedClientId]);

  // Use custom import data hook
  const {
    summary,
    isLoading,
    loadSummary,
    loadImportRows,
    autoRelateAll: performAutoRelate
  } = useImportData();

  const loadData = useCallback(async () => {
    try {
      const [gridData] = await Promise.all([
        loadImportRows({
          clientId: filters.client_id,
          importId: filters.import_id,
          status: filters.status as any,
          q: debouncedSearch || undefined,
          page: currentPage,
          pageSize: pageSize,
        }),
        loadSummary(filters.client_id, filters.import_id)
      ]);

      setData(gridData as any);
    } catch (error) {
      console.error('Error loading data:', error);
      setData([]);
    }
  }, [filters, debouncedSearch, currentPage, pageSize, loadImportRows, loadSummary]);

  useEffect(() => {
    let mounted = true;
    if (mounted) loadData();
    return () => { mounted = false; };
  }, [currentPage, filters, debouncedSearch]);

  const handleAutoMatch = useCallback(async () => {
    if (isLoading) return;

    try {
      await performAutoRelate(filters.client_id);
      await loadData();
    } catch (error) {
      // Error already handled by hook
    }
  }, [isLoading, performAutoRelate, filters.client_id, loadData]);

  const getStatusBadge = useCallback((status: 'matched' | 'pending') => {
    if (status === 'matched') {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Relacionado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  }, []);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }, []);

  const totalPages = useMemo(() => Math.ceil(summary.total / pageSize), [summary.total, pageSize]);

  const handleEmitirPorCliente = useCallback(async () => {
    if (!filters.client_id) {
      toast({
        title: 'Erro',
        description: 'Informe import ou cliente.',
        variant: 'destructive',
      });
      return;
    }

    setIsEmitting(true);
    try {
      const result = await importService.emitirVendas({
        client_id: filters.client_id,
        source: 'ML'
      });

      if (result.candidatos === 0 && result.full_skipped > 0) {
        toast({
          title: 'Todos eram FULL',
          description: 'Todos os pedidos eram Mercado Fulfillment (sem baixa/financeiro).',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Vendas emitidas com sucesso',
          description: `Emitidos: ${result.inseridos} | Já existiam: ${result.ja_existiam} | FULL: ${result.full_skipped}`,
        });
      }

      await loadData();
    } catch (error: any) {
      toast({
        title: 'Erro ao emitir vendas',
        description: error.message?.slice(0, 180) || 'Verifique o log',
        variant: 'destructive',
      });
    } finally {
      setIsEmitting(false);
    }
  }, [filters.client_id, toast, loadData]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Dados Importados</CardTitle>
              <CardDescription>
                Visualize e gerencie os dados importados
              </CardDescription>
            </div>
            <Button onClick={handleAutoMatch} size="sm" className="hidden sm:flex" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Auto-Relacionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros e Busca */}
          <div className="flex gap-2 flex-wrap">
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

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar SKU, pedido, cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Select
              value={filters.status || 'Todos'}
              onValueChange={(value) => setFilters({ ...filters, status: value === 'Todos' ? undefined : value as any })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="relacionados">Relacionados</SelectItem>
                <SelectItem value="pendentes">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>

            <Button onClick={handleAutoMatch} variant="default" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Auto-Relacionar
            </Button>

            <Button
              onClick={handleEmitirPorCliente}
              variant="default"
              disabled={isEmitting || !filters.client_id}
              className="bg-primary"
            >
              {isEmitting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Processando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Emitir pendentes deste cliente
                </>
              )}
            </Button>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="bg-success/10 rounded-lg p-3 border border-success/20">
              <div className="text-2xl font-bold text-success">
                {summary.relacionados}
              </div>
              <p className="text-xs text-muted-foreground">Relacionados</p>
            </div>
            <div className="bg-warning/10 rounded-lg p-3 border border-warning/20">
              <div className="text-2xl font-bold text-warning">
                {summary.pendentes}
              </div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
              <div className="text-2xl font-bold text-primary">
                {Number(summary.taxa_match ?? 0).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Taxa Match</p>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>SKU Original</TableHead>
                  <TableHead>SKU Relacionado</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor Unit.</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Nenhum dado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((order) => (
                    <TableRow key={order.id_raw}>
                      <TableCell className="font-medium">{order.id_pedido}</TableCell>
                      <TableCell>
                        {order.data ? format(new Date(order.data), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={order.sku_original}>
                        {order.sku_original}
                      </TableCell>
                      <TableCell>
                        {order.sku_relacionado ? (
                          <Badge variant="outline">{order.sku_relacionado}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{order.qtd || '-'}</TableCell>
                      <TableCell className="text-right">
                        {order.valor_unit ? formatCurrency(order.valor_unit) : '-'}
                      </TableCell>
                      <TableCell>{order.cliente || '-'}</TableCell>
                      <TableCell>{order.canal || '-'}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, summary.total)} de {summary.total} registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1 || isLoading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || isLoading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});
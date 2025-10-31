import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Package, AlertCircle } from 'lucide-react';
import { useImportClient } from '@/contexts/ImportClientContext';
import { useFullImportData } from '@/hooks/useFullImportData';
import { formatCurrency } from '@/utils/formatters';

interface FullImportedDataTabProps {
  initialEnvioNum?: string;
  initialClienteNome?: string;
}

export const FullImportedDataTab = memo(function FullImportedDataTab({
  initialEnvioNum,
  initialClienteNome
}: FullImportedDataTabProps) {
  const { selectedClientId, setSelectedClientId, availableClients, isLoadingClients } = useImportClient();
  const { envios, items, pendings, summary, isLoading, loadEnvios, loadEnvioDetails, loadAllItemsByCliente } = useFullImportData();
  const [searchEnvio, setSearchEnvio] = useState('');
  const [currentEnvio, setCurrentEnvio] = useState<string>('');
  const [showEnviosList, setShowEnviosList] = useState(false);

  // Define cliente inicial
  useEffect(() => {
    if (initialClienteNome && !selectedClientId) {
      setSelectedClientId(initialClienteNome);
    }
  }, [initialClienteNome, selectedClientId, setSelectedClientId]);

  // Carrega automaticamente o envio se foi passado como prop
  useEffect(() => {
    if (initialEnvioNum && initialClienteNome) {
      setSearchEnvio(initialEnvioNum);
      setCurrentEnvio(initialEnvioNum);
      setShowEnviosList(false);
      // Pequeno delay para garantir que o cliente foi selecionado
      setTimeout(() => {
        loadEnvioDetails(initialClienteNome, initialEnvioNum);
      }, 100);
    }
  }, [initialEnvioNum, initialClienteNome, loadEnvioDetails]);

  const handleSearch = async () => {
    if (!selectedClientId) return;

    // Se tem número do envio, busca os detalhes
    if (searchEnvio.trim()) {
      setShowEnviosList(false);
      setCurrentEnvio(searchEnvio);
      await loadEnvioDetails(selectedClientId, searchEnvio.trim());
    } else {
      // Se não tem número, carrega TODOS os itens do cliente (não lista de envios)
      setShowEnviosList(false);
      setCurrentEnvio('');
      await loadAllItemsByCliente(selectedClientId);
    }
  };

  const handleSelectEnvio = async (envioNum: string) => {
    if (!selectedClientId) return;
    setSearchEnvio(envioNum);
    setShowEnviosList(false);
    setCurrentEnvio(envioNum);
    await loadEnvioDetails(selectedClientId, envioNum);
  };

  const totalItems = items.length;
  const totalQtd = items.reduce((sum, item) => sum + item.qtd, 0);
  const pendingCount = pendings.length;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consultar Envio</CardTitle>
          <CardDescription>Busque envios por cliente e número</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              <Select
                value={selectedClientId ?? ''}
                onValueChange={setSelectedClientId}
                disabled={isLoadingClients}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={isLoadingClients ? 'Carregando...' : 'Selecione um cliente'} />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-background">
                  {availableClients.map((nome) => (
                    <SelectItem key={nome} value={nome}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nº Envio <span className="text-xs text-muted-foreground">(opcional)</span>
              </label>
              <Input
                placeholder="Ex: 53293771 ou deixe vazio para listar todos"
                value={searchEnvio}
                onChange={(e) => setSearchEnvio(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                disabled={!selectedClientId || isLoading}
                className="w-full"
              >
                <Search className="h-4 w-4 mr-2" />
                {searchEnvio.trim() ? 'Buscar Envio' : 'Listar Todos'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Envios */}
      {showEnviosList && envios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Envios do Cliente</CardTitle>
            <CardDescription>
              {envios.length} envio(s) encontrado(s) nos últimos 30 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    <TableRow key={envio.envio_id}>
                      <TableCell className="font-mono font-medium">
                        {envio.envio_num}
                      </TableCell>
                      <TableCell className="text-right">
                        {envio.tot_itens} ({envio.tot_qtd} un)
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {envio.registrados_itens} ({envio.registrados_qtd} un)
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {envio.pendentes_itens} ({envio.pendentes_qtd} un)
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
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showEnviosList && envios.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhum envio encontrado para este cliente
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      {!showEnviosList && summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Itens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.tot_itens}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Quantidade</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.tot_qtd}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summary.registrados_itens} ({summary.registrados_qtd} un)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendências</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {summary.pendentes_itens} ({summary.pendentes_qtd} un)
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Itens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Itens Registrados ({items.length})
              </CardTitle>
              <CardDescription>
                SKUs reconhecidos e vendas emitidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum item registrado encontrado
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Código ML</TableHead>
                        <TableHead>SKU Texto</TableHead>
                        <TableHead>SKU Relacionado</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm text-muted-foreground">{item.row_num}</TableCell>
                          <TableCell className="font-mono text-sm">{item.codigo_ml || '—'}</TableCell>
                          <TableCell className="text-sm">{item.sku_texto}</TableCell>
                          <TableCell className="font-medium">{item.matched_sku}</TableCell>
                          <TableCell className="text-right">{item.qtd}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pendências */}
          {pendings.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Pendências de SKU ({pendings.length})
                </CardTitle>
                <CardDescription>
                  SKUs não reconhecidos que precisam ser relacionados na aba "Relacionar Itens"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Linha</TableHead>
                        <TableHead>Código ML</TableHead>
                        <TableHead>SKU Texto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendings.map((pending) => (
                        <TableRow key={pending.id}>
                          <TableCell className="text-sm text-muted-foreground">{pending.row_num}</TableCell>
                          <TableCell className="font-mono text-sm">{pending.codigo_ml || '—'}</TableCell>
                          <TableCell className="font-medium">{pending.sku_texto}</TableCell>
                          <TableCell className="text-right">{pending.qtd}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
});


import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/Layout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ProductList } from "@/components/ProductList";
import { ArrowLeft, User, CreditCard, ShoppingCart, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ErrorMessages } from "@/utils/errorMessages";
import { consultarClientes } from "@/services/n8nIntegration";
import { useApiDataWithFilters } from "@/hooks/useApiDataWithFilters";
import DashboardCard from "@/components/DashboardCard";
import { formatCurrency, formatNumber, toNumber } from "@/utils/formatters";
import { PagamentoQuickDialog } from "@/components/PagamentoQuickDialog";

const parseDateLocal = (s?: string) => {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};


interface Cliente {
  "ID Cliente": string;
  "Nome": string;
  "Documento": string;
  "Telefone": string;
  "Email": string;
  "Observações": string;
  "Total Comprado": number;
  "Total Pago": number;
  "Total atual": number;
}

const ClienteDetalhe = () => {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar dados relacionados ao cliente
  const { data: vendas, isLoading: vendasLoading } = useApiDataWithFilters('Vendas');
  const { data: pagamentos, isLoading: pagamentosLoading, refresh: refetchPagamentos } = useApiDataWithFilters('Pagamentos');

  useEffect(() => {
    carregarCliente();
  }, [clienteId]);

  const carregarCliente = async () => {
    if (!clienteId) return;
    
    setIsLoading(true);
    try {
      const dadosClientes = await consultarClientes();
      
      console.log('ClienteId da URL:', clienteId);
      console.log('Clientes disponíveis:', dadosClientes?.map(c => ({ id: c["ID Cliente"] || c.id, nome: c.Nome })));
      
      if (dadosClientes && dadosClientes.length > 0) {
        const clienteEncontrado = dadosClientes.find((item: any) => {
          const id = item["ID Cliente"] || item.id || item["Nome"] || item["Cliente"] || item.nome;
          return String(id) === String(clienteId);
        });
        
        if (clienteEncontrado) {
          const clienteFormatado = {
            "ID Cliente": clienteEncontrado["ID Cliente"] || clienteEncontrado.id || '',
            "Nome": clienteEncontrado["Nome"] || clienteEncontrado["Cliente"] || clienteEncontrado.nome || '',
            "Documento": clienteEncontrado["Documento"] || clienteEncontrado.documento || '',
            "Telefone": clienteEncontrado["Telefone"] || clienteEncontrado["Telefone / WhatsApp"] || clienteEncontrado.telefone || '',
            "Email": clienteEncontrado["Email"] || clienteEncontrado["E-mail"] || clienteEncontrado.email || '',
            "Observações": clienteEncontrado["Observações"] || clienteEncontrado.observacoes || '',
            "Total Comprado": toNumber(clienteEncontrado["Total Comprado"]),
            "Total Pago": toNumber(clienteEncontrado["Total Pago"]),
            "Total atual": toNumber(clienteEncontrado["Total atual"])
          };
          
          console.log('🔍 Debug Cliente:', {
            raw: {
              totalComprado: clienteEncontrado["Total Comprado"],
              totalPago: clienteEncontrado["Total Pago"],
              totalAtual: clienteEncontrado["Total atual"]
            },
            converted: {
              totalComprado: clienteFormatado["Total Comprado"],
              totalPago: clienteFormatado["Total Pago"],
              totalAtual: clienteFormatado["Total atual"]
            }
          });
          
          setCliente(clienteFormatado);
        } else {
          toast.error(ErrorMessages.clientes.notFound);
          navigate('/clientes');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cliente:', error);
      toast.error(ErrorMessages.clientes.loadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar vendas do cliente
  const vendasCliente = useMemo(() => {
    if (!vendas || !cliente) return [];
    return vendas.filter((venda: any) => 
      venda['Nome Cliente'] === cliente['Nome']
    );
  }, [vendas, cliente]);

  // Filtrar pagamentos do cliente
  const pagamentosCliente = useMemo(() => {
    if (!pagamentos || !cliente) return [];
    const clientePagamentos = pagamentos.filter((pagamento: any) => 
      pagamento['Nome Cliente'] === cliente['Nome'] || 
      pagamento['Cliente'] === cliente['Nome']
    );
    
    // Ordenar por data mais recente primeiro
    return clientePagamentos.sort((a: any, b: any) => {
      const da = parseDateLocal(a['Data Pagamento'] || a['Data']);
      const db = parseDateLocal(b['Data Pagamento'] || b['Data']);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      return tb - ta; // Ordem decrescente (mais recentes primeiro)
    });
  }, [pagamentos, cliente]);

  // Estatísticas do cliente
  const stats = useMemo(() => {
    const totalVendas = vendasCliente.reduce((acc: number, venda: any) =>
      acc + toNumber(venda["Valor Total"]), 0
    );
    
    const totalPagamentos = pagamentosCliente.reduce((acc: number, pagamento: any) =>
      acc + toNumber(pagamento["Valor"] ?? pagamento["Valor Pago"]), 0
    );

    const totalItens = vendasCliente.reduce((acc: number, venda: any) =>
      acc + toNumber(venda["Quantidade Vendida"]), 0
    );

    console.log('📊 Debug Stats:', {
      totalVendas,
      totalPagamentos,
      totalItens,
      numeroVendas: vendasCliente.length,
      amostraVenda: vendasCliente[0] ? {
        valorTotal: vendasCliente[0]["Valor Total"],
        convertido: toNumber(vendasCliente[0]["Valor Total"])
      } : null
    });

    return {
      totalVendas,
      totalPagamentos,
      totalItens,
      numeroVendas: vendasCliente.length,
      numeroPagamentos: pagamentosCliente.length
    };
  }, [vendasCliente, pagamentosCliente]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" text="Carregando dados do cliente..." />
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Cliente não encontrado</p>
          <Button onClick={() => navigate('/clientes')} className="mt-4">
            Voltar para Clientes
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/clientes')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                {cliente['Nome']}
              </h2>
              <p className="text-muted-foreground mt-2">
                Detalhes e histórico do cliente
              </p>
            </div>
          </div>
          <PagamentoQuickDialog
            clienteNome={cliente['Nome']}
            clienteId={cliente['ID Cliente']}
            onSuccess={() => {
              refetchPagamentos();
              carregarCliente();
            }}
          />
        </div>

        {/* Informações básicas do cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID Cliente</p>
                <p className="font-mono">{cliente['ID Cliente']}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Documento</p>
                <p>{cliente['Documento'] || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                <p>{cliente['Telefone'] || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{cliente['Email'] || 'Não informado'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Observações</p>
                <p>{cliente['Observações'] || 'Nenhuma observação'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="Saldo Atual"
            subtitle="Valor em aberto"
            value={formatCurrency(stats.totalVendas - stats.totalPagamentos)}
            icon={CreditCard}
            gradient={(stats.totalVendas - stats.totalPagamentos) > 0 ? "from-red-500 to-red-600" : "from-green-500 to-green-600"}
            textColor={(stats.totalVendas - stats.totalPagamentos) > 0 ? "text-red-600" : "text-green-600"}
          />
          <DashboardCard
            title="Total Comprado"
            subtitle="Valor total das compras"
            value={formatCurrency(stats.totalVendas)}
            icon={ShoppingCart}
            gradient="from-blue-500 to-blue-600"
            textColor="text-blue-600"
          />
          <DashboardCard
            title="Total Pago"
            subtitle="Valor total dos pagamentos"
            value={formatCurrency(stats.totalPagamentos)}
            icon={TrendingUp}
            gradient="from-green-500 to-green-600"
            textColor="text-green-600"
          />
          <DashboardCard
            title="Itens Comprados"
            subtitle="Quantidade total de itens"
            value={formatNumber(stats.totalItens, 0)}
            icon={ShoppingCart}
            gradient="from-purple-500 to-purple-600"
            textColor="text-purple-600"
          />
        </div>

        {/* Abas com histórico */}
        <Tabs defaultValue="vendas" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vendas">
              Histórico de Compras ({stats.numeroVendas})
            </TabsTrigger>
            <TabsTrigger value="pagamentos">
              Histórico de Pagamentos ({stats.numeroPagamentos})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="vendas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compras Realizadas</CardTitle>
              </CardHeader>
              <CardContent>
                {vendasLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner text="Carregando vendas..." />
                  </div>
                ) : vendasCliente.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhuma compra encontrada para este cliente
                  </p>
                ) : (
                  <ProductList
                    items={vendasCliente.map((venda: any) => ({
                      sku: venda['SKU Produto'],
                      nome: venda['Nome Produto'] || 'Produto não identificado',
                      quantidade: venda['Quantidade Vendida'],
                      preco: venda['Preço Unitário'],
                      dataVenda: venda['Data Venda'],
                      valorTotal: venda['Valor Total']
                    }))}
                    showThumbnails={true}
                    showQuantity={true}
                    showPrice={true}
                    showDate={true}
                    showCustomer={false}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pagamentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Pagamentos Realizados</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Mais recentes primeiro
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pagamentosLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner text="Carregando pagamentos..." />
                  </div>
                ) : pagamentosCliente.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum pagamento encontrado para este cliente
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pagamentosCliente.map((pagamento: any, index: number) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-4 rounded-lg glass-card"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {pagamento['Descrição'] || pagamento['Forma Pagamento'] || 'Pagamento'}
                            </p>
                            <Badge variant="secondary">
                              {parseDateLocal(pagamento['Data Pagamento'] || pagamento['Data'])?.toLocaleDateString('pt-BR') ?? '-'}
                            </Badge>
                          </div>
                          {pagamento['Observações'] && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {pagamento['Observações']}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {formatCurrency(toNumber(pagamento['Valor'] ?? pagamento['Valor Pago']))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ClienteDetalhe;

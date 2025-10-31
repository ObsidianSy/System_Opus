import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, RefreshCw, DollarSign } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import PagamentoForm from "@/components/forms/PagamentoForm";
import { consultarPagamentos, consultarVendas, consultarClientes } from "@/services/n8nIntegration";
import { formatCurrencyAbbreviated } from "@/utils/formatters";
import { PagamentoStats } from "@/components/dashboard/PagamentoStats";
import { ClientesDevedores } from "@/components/dashboard/ClientesDevedores";
import { ModernDataTable } from "@/components/tables/ModernDataTable";
interface Pagamento {
  "Data Pagamento": string;
  "Nome Cliente": string;
  "Valor Pago": number;
  "Forma de Pagamento": string;
  "Observações": string;
}
interface Venda {
  "Data Venda": string;
  "Nome Cliente": string;
  "SKU Produto": string;
  "Nome Produto": string;
  "Quantidade Vendida": number;
  "Preço Unitário": number;
  "Valor Total": number;
}
interface Cliente {
  "ID Cliente": string;
  "Nome": string;
  "Documento": string;
  "Telefone": string;
  "Email": string;
}
const Pagamentos = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  useEffect(() => {
    carregarDados();
  }, []);
  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const [dadosPagamentos, dadosVendas, dadosClientes] = await Promise.all([consultarPagamentos(), consultarVendas(), consultarClientes()]);

      // Formatar pagamentos
      const pagamentosFormatados = (dadosPagamentos || []).map((item: any) => ({
        "Data Pagamento": item["Data Pagamento"] || "",
        "Nome Cliente": item["Nome Cliente"] || "",
        "Valor Pago": item["Valor Pago"] || 0,
        "Forma de Pagamento": item["Forma de Pagamento"] || "",
        "Observações": item["Observações"] || ""
      }));

      // Formatar vendas
      const vendasFormatadas = (dadosVendas || []).map((item: any) => ({
        "Data Venda": item["Data Venda"] || "",
        "Nome Cliente": item["Nome Cliente"] || "",
        "SKU Produto": item["SKU Produto"] || "",
        "Nome Produto": item["Nome Produto"] || "",
        "Quantidade Vendida": item["Quantidade Vendida"] || 0,
        "Preço Unitário": item["Preço Unitário"] || 0,
        "Valor Total": item["Valor Total"] || 0
      }));

      // Formatar clientes
      const clientesFormatados = (dadosClientes || []).map((item: any) => ({
        "ID Cliente": item["ID Cliente"] || "",
        "Nome": item["Nome"] || "",
        "Documento": item["Documento"] || "",
        "Telefone": item["Telefone"] || "",
        "Email": item["Email"] || ""
      }));
      setPagamentos(pagamentosFormatados);
      setVendas(vendasFormatadas);
      setClientes(clientesFormatados);
      toast.success("Dados carregados", {
        description: `${pagamentosFormatados.length} pagamentos, ${vendasFormatadas.length} vendas`
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error("Erro ao carregar dados", {
        description: "Não foi possível carregar os dados do sistema"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Ordenar pagamentos por data (mais recentes primeiro)
  const parseDateLocal = (s: string) => {
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const pagamentosOrdenados = useMemo(() => {
    return [...pagamentos].sort((a, b) => {
      const da = parseDateLocal(a["Data Pagamento"]);
      const db = parseDateLocal(b["Data Pagamento"]);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      return tb - ta; // Ordem decrescente (mais recentes primeiro)
    });
  }, [pagamentos]);
  const pagamentosFiltrados = pagamentosOrdenados.filter(pagamento => pagamento["Nome Cliente"].toLowerCase().includes(busca.toLowerCase()) || pagamento["Forma de Pagamento"].toLowerCase().includes(busca.toLowerCase()));
  const totalPagamentos = pagamentosFiltrados.reduce((acc, pagamento) => acc + pagamento["Valor Pago"], 0);
  const handleSuccess = () => {
    setIsDialogOpen(false);
    carregarDados();
  };
  const formatarData = (dataString: string) => {
    const d = parseDateLocal(dataString);
    return d ? d.toLocaleDateString('pt-BR') : "-";
  };
  return <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Gestão de Pagamentos
            </h2>
            <p className="text-muted-foreground mt-2">Registre e acompanhe os pagamentos recebidos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={carregarDados} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Pagamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Registrar Pagamento</DialogTitle>
                </DialogHeader>
                <PagamentoForm onSuccess={handleSuccess} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Estatísticas principais */}
        <PagamentoStats pagamentos={pagamentos} vendas={vendas} clientes={clientes} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Clientes Devedores */}
          <div className="lg:col-span-1">
            <ClientesDevedores pagamentos={pagamentos} vendas={vendas} clientes={clientes} />
          </div>

          {/* Lista de Pagamentos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar por cliente ou forma de pagamento..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-sm" />
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Histórico de Pagamentos ({pagamentosFiltrados.length})</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    Mais recentes primeiro
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Carregando pagamentos...</p>
                  </div> : pagamentosFiltrados.length === 0 ? <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      {busca ? "Nenhum pagamento encontrado com os critérios de busca" : "Nenhum pagamento registrado"}
                    </p>
                  </div> : <ModernDataTable data={pagamentosFiltrados} columns={[{
                key: "Data Pagamento",
                label: "Data",
                render: value => formatarData(value as string)
              }, {
                key: "Nome Cliente",
                label: "Cliente",
                render: value => <span className="font-medium">{value as string}</span>
              }, {
                key: "Valor Pago",
                label: "Valor Pago",
                render: value => <span className="font-mono text-success font-bold">
                            {formatCurrencyAbbreviated(value as number)}
                          </span>
              }, {
                key: "Forma de Pagamento",
                label: "Forma de Pagamento"
              }, {
                key: "Observações",
                label: "Observações"
              }]} pageSize={10} emptyMessage="Nenhum pagamento encontrado" />}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>;
};
export default Pagamentos;
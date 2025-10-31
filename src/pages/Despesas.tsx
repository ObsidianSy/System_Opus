
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, FileText, PlusCircle, ArrowDownToLine, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import { formatCurrencyAbbreviated } from "@/utils/formatters";


const parseDateLocal = (s?: string) => {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const Despesas = () => {
  const [activeTab, setActiveTab] = useState("pagas");

  // Dados de exemplo
  const despesasPagas = [
    { id: 1, descricao: "Aluguel", categoria: "Fixas", valor: 1200.00, dataPagamento: "2025-05-01", formaPagamento: "Transferência" },
    { id: 2, descricao: "Compra de Camisetas", categoria: "Estoque", valor: 850.50, dataPagamento: "2025-05-03", formaPagamento: "Cartão" },
    { id: 3, descricao: "Internet", categoria: "Fixas", valor: 120.00, dataPagamento: "2025-05-05", formaPagamento: "Débito Automático" },
    { id: 4, descricao: "Tintas e Materiais", categoria: "Estoque", valor: 430.00, dataPagamento: "2025-05-08", formaPagamento: "Dinheiro" }
  ];

  const despesasPendentes = [
    { id: 1, descricao: "Energia Elétrica", categoria: "Fixas", valor: 350.00, vencimento: "2025-05-15" },
    { id: 2, descricao: "Fornecedor DTF", categoria: "Estoque", valor: 620.00, vencimento: "2025-05-20" },
    { id: 3, descricao: "Manutenção de Equipamentos", categoria: "Operacional", valor: 200.00, vencimento: "2025-05-25" }
  ];

  const resumoDespesas = {
    totalPagas: despesasPagas.reduce((acc, item) => acc + item.valor, 0),
    totalPendentes: despesasPendentes.reduce((acc, item) => acc + item.valor, 0)
  };

  const categorias = [
    { nome: "Fixas", valor: 1320.00 },
    { nome: "Estoque", valor: 1280.50 },
    { nome: "Operacional", valor: 0 }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">Despesas</h2>
          <div className="space-x-2">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Registrar Despesa
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Despesas Pagas</CardTitle>
              <FileText className="h-4 w-4 text-red-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyAbbreviated(resumoDespesas.totalPagas)}</div>
              <p className="text-xs text-muted-foreground">no mês atual</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyAbbreviated(resumoDespesas.totalPendentes)}</div>
              <p className="text-xs text-muted-foreground">pendente de pagamento</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
              <ArrowDownToLine className="h-4 w-4 text-purple-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrencyAbbreviated(resumoDespesas.totalPagas + resumoDespesas.totalPendentes)}</div>
              <p className="text-xs text-muted-foreground">total no período</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="pagas">Pagas</TabsTrigger>
            <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
            <TabsTrigger value="categorias">Por Categoria</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pagas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Despesas Pagas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data Pagamento</TableHead>
                      <TableHead>Forma Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesasPagas.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.descricao}</TableCell>
                        <TableCell>{item.categoria}</TableCell>
                        <TableCell>{parseDateLocal(item.dataPagamento)?.toLocaleDateString('pt-BR') ?? '-'}</TableCell>
                        <TableCell>{item.formaPagamento}</TableCell>
                        <TableCell className="text-right">{formatCurrencyAbbreviated(item.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pendentes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Despesas Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesasPendentes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.descricao}</TableCell>
                        <TableCell>{item.categoria}</TableCell>
                        <TableCell>{parseDateLocal(item.vencimento)?.toLocaleDateString('pt-BR') ?? '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrencyAbbreviated(item.valor)}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Calendar className="h-4 w-4 mr-1" /> Pagar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="categorias" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">% do Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categorias.map((item, index) => {
                      const totalDespesas = resumoDespesas.totalPagas + resumoDespesas.totalPendentes;
                      const percentual = totalDespesas > 0 ? (item.valor / totalDespesas) * 100 : 0;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.nome}</TableCell>
                          <TableCell className="text-right">{formatCurrencyAbbreviated(item.valor)}</TableCell>
                          <TableCell className="text-right">{percentual.toFixed(2)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Despesas;

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Package, ShoppingCart, Users, TrendingUp, TrendingDown, DollarSign, Calendar, Filter, BarChart3, PieChart, Activity } from "lucide-react";
import { formatCurrencyAbbreviated, formatAbbreviated, toNumber } from "@/utils/formatters";
import Layout from "@/components/Layout";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Importando componentes de gráficos refatorados
import VendasPorMesChart from "@/components/charts/VendasPorMesChart";
import ProdutosMaisVendidosChart from "@/components/charts/ProdutosMaisVendidosChart";
import VendasPorCategoriaChart from "@/components/charts/VendasPorCategoriaChart";
import { useAppDataWithFilters } from "@/hooks/useApiDataWithFilters";
import { useDateFilter } from "@/contexts/DateFilterContext";

const Relatorios = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [quantityFilter, setQuantityFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [clienteFilter, setClienteFilter] = useState<string>("todos");
  const navigate = useNavigate();
  const { vendas, produtos, clientes, pagamentos } = useAppDataWithFilters();
  const { dateRange } = useDateFilter();

  // Processar dados reais de vendas por mês com filtro de data
  const vendasPorMes = useMemo(() => {
    return (vendas.data || []).reduce((acc, venda) => {
      const dataVenda = venda["Data Venda"];
      if (!dataVenda) return acc;
      
      const mes = new Date(dataVenda).toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
      const existing = acc.find(item => item.name === mes);
      const valorTotal = toNumber(venda["Valor Total"]);
      
      if (existing) {
        existing.valor += valorTotal;
      } else {
        acc.push({ name: mes, valor: valorTotal });
      }
      return acc;
    }, [] as any[]).sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [vendas.data]);

  // Relatório de vendas por SKU (totalizado por data)
  const vendasPorSKU = useMemo(() => {
    const vendidosPorSKU = new Map();
    
    (vendas.data || []).forEach(venda => {
      const sku = venda["SKU Produto"];
      const nome = venda["Nome Produto"];
      const quantidade = toNumber(venda["Quantidade Vendida"]);
      const precoUnit = toNumber(venda["Preço Unitário"]);
      const valorTotal = toNumber(venda["Valor Total"]);
      
      if (!sku) return;
      
      if (vendidosPorSKU.has(sku)) {
        const existing = vendidosPorSKU.get(sku);
        existing.quantidade += quantidade;
        existing.valorTotal += valorTotal;
      } else {
        vendidosPorSKU.set(sku, {
          sku,
          nome,
          quantidade,
          precoUnitario: precoUnit,
          valorTotal
        });
      }
    });
    
    return Array.from(vendidosPorSKU.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [vendas.data]);

  // Processar dados auxiliares para gráficos
  const dadosGraficos = useMemo(() => {
    const vendidosPorProduto = new Map();
    const vendidosPorCategoria = new Map();
    
    (vendas.data || []).forEach(venda => {
      const nome = venda["Nome Produto"];
      const sku = venda["SKU Produto"];
      const quantidade = toNumber(venda["Quantidade Vendida"]);
      
      if (nome) {
        vendidosPorProduto.set(nome, (vendidosPorProduto.get(nome) || 0) + quantidade);
      }
      
      const produto = (produtos.data || []).find(p => p["SKU"] === sku);
      const categoria = produto?.["Categoria"] || "Outros";
      vendidosPorCategoria.set(categoria, (vendidosPorCategoria.get(categoria) || 0) + quantidade);
    });
    
    const produtosMaisVendidos = Array.from(vendidosPorProduto.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
      
    const vendasPorCategoria = Array.from(vendidosPorCategoria.entries())
      .map(([name, value]) => ({ name, value }));
    
    return { produtosMaisVendidos, vendasPorCategoria };
  }, [vendas.data, produtos.data]);

  // Estatísticas principais
  const estatisticas = useMemo(() => {
    const totalVendas = (vendas.data || []).length;
    const totalClientes = (clientes.data || []).length;
    const totalProdutos = (produtos.data || []).length;
    
    const faturamentoTotal = (vendas.data || []).reduce((acc, venda) => {
      return acc + toNumber(venda["Valor Total"]);
    }, 0);
    
    const ticketMedio = totalVendas > 0 ? faturamentoTotal / totalVendas : 0;
    
    const valorEstoque = (produtos.data || []).reduce((acc, produto) => {
      const quantidade = toNumber(produto["Quantidade Atual"]);
      const preco = toNumber(produto["Preço Unitário"]);
      return acc + (quantidade * preco);
    }, 0);
    
    // Calcular clientes devedores usando vendas e pagamentos
    const vendasPorCliente = new Map();
    const pagamentosPorCliente = new Map();
    
    (vendas.data || []).forEach(venda => {
      const cliente = venda["Nome Cliente"];
      const valor = toNumber(venda["Valor Total"]);
      vendasPorCliente.set(cliente, (vendasPorCliente.get(cliente) || 0) + valor);
    });
    
    (pagamentos.data || []).forEach(pag => {
      const cliente = pag["Nome Cliente"];
      const valor = toNumber(pag["Valor Pago"]);
      pagamentosPorCliente.set(cliente, (pagamentosPorCliente.get(cliente) || 0) + valor);
    });
    
    let clientesDevedores = 0;
    vendasPorCliente.forEach((totalComprado, cliente) => {
      const totalPago = pagamentosPorCliente.get(cliente) || 0;
      if (totalComprado > totalPago) {
        clientesDevedores++;
      }
    });
    
    const produtosSemEstoque = (produtos.data || []).filter(produto => 
      toNumber(produto["Quantidade Atual"]) === 0
    ).length;
    
    return {
      totalVendas,
      totalClientes,
      totalProdutos,
      faturamentoTotal,
      ticketMedio,
      valorEstoque,
      clientesDevedores,
      produtosSemEstoque
    };
  }, [vendas.data, clientes.data, produtos.data, pagamentos.data]);

  // Obter listas únicas para filtros
  const categorias = Array.from(new Set(
    (produtos.data || []).map(p => p["Categoria"]).filter(Boolean)
  ));
  
  const clientesUnicos = Array.from(new Set(
    (vendas.data || []).map(v => v["Nome Cliente"]).filter(Boolean)
  ));

  // Filtrar dados por múltiplos critérios
  const dadosFiltrados = useMemo(() => {
    // Filtrar produtos
    const produtosFiltrados = (produtos.data || []).filter(item => {
      const quantidade = toNumber(item["Quantidade Atual"]);
      const categoria = item["Categoria"];
      
      const matchesQuantity = quantityFilter === "todos" ? true :
        quantityFilter === "sem-estoque" ? quantidade === 0 :
        quantityFilter === "estoque-baixo" ? quantidade > 0 && quantidade < 10 :
        quantityFilter === "em-estoque" ? quantidade >= 10 : true;
      
      const matchesCategory = categoryFilter === "todas" ? true : categoria === categoryFilter;
      
      return matchesQuantity && matchesCategory;
    });

    // Filtrar vendas por cliente
    const vendasFiltradas = (vendas.data || []).filter(venda => {
      const cliente = venda["Nome Cliente"];
      return clienteFilter === "todos" ? true : cliente === clienteFilter;
    });

    return { produtosFiltrados, vendasFiltradas };
  }, [produtos.data, vendas.data, quantityFilter, categoryFilter, clienteFilter]);

  // Função para exportar relatório de vendas por SKU em CSV
  const exportarVendasPorSKUCSV = () => {
    const dados = vendasPorSKU.map(item => ({
      "SKU": item.sku,
      "Nome Produto": item.nome,
      "Quantidade Total Vendida": item.quantidade,
      "Preço Unitário Médio": `R$ ${item.precoUnitario.toFixed(2)}`,
      "Valor Total": `R$ ${item.valorTotal.toFixed(2)}`
    }));
    
    const nomeArquivo = `relatorio-vendas-sku-${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}.csv`;
    
    if (dados.length > 0) {
      const headers = Object.keys(dados[0]);
      const csvContent = [
        headers.join(','),
        ...dados.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nomeArquivo;
      link.click();
    }
  };

  // Função para exportar relatório de vendas por SKU em PDF
  const exportarVendasPorSKUPDF = () => {
    const doc = new jsPDF();
    const hoje = new Date().toLocaleDateString('pt-BR');
    const periodo = `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}`;
    
    doc.setFontSize(18);
    doc.text('Relatório de Vendas por SKU', 14, 22);
    doc.setFontSize(11);
    doc.text(`Período: ${periodo} | Gerado em: ${hoje}`, 14, 30);
    
    const tableData = vendasPorSKU.map(item => [
      item.sku,
      item.nome,
      item.quantidade.toString(),
      `R$ ${item.precoUnitario.toFixed(2)}`,
      `R$ ${item.valorTotal.toFixed(2)}`
    ]);
    
    autoTable(doc, {
      head: [['SKU', 'Nome Produto', 'Qtd Vendida', 'Preço Unit.', 'Valor Total']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`relatorio-vendas-sku-${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}.pdf`);
  };

  // Função para exportar relatório em CSV
  const exportarRelatorioCSV = (tipo: string) => {
    let dados: any[] = [];
    let nomeArquivo = "";
    
    if (tipo === "produtos") {
      dados = dadosFiltrados.produtosFiltrados.map(item => ({
        "SKU": item["SKU"],
        "Nome": item["Nome Produto"],
        "Categoria": item["Categoria"],
        "Quantidade": item["Quantidade Atual"],
        "Preço Unitário": `R$ ${Number(item["Preço Unitário"]).toFixed(2)}`,
        "Valor Total": `R$ ${(Number(item["Quantidade Atual"]) * Number(item["Preço Unitário"])).toFixed(2)}`
      }));
      nomeArquivo = `relatorio-produtos-${quantityFilter}-${new Date().toISOString().split('T')[0]}.csv`;
    } else if (tipo === "vendas") {
      dados = dadosFiltrados.vendasFiltradas.map(venda => ({
        "ID Venda": venda["ID Venda"],
        "Data": venda["Data Venda"],
        "Cliente": venda["Nome Cliente"],
        "Produto": venda["Nome Produto"],
        "Quantidade": toNumber(venda["Quantidade Vendida"]),
        "Valor Total": `R$ ${toNumber(venda["Valor Total"]).toFixed(2)}`
      }));
      nomeArquivo = `relatorio-vendas-${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}.csv`;
    }
    
    // Converter para CSV
    if (dados.length > 0) {
      const headers = Object.keys(dados[0]);
      const csvContent = [
        headers.join(','),
        ...dados.map(row => headers.map(header => `"${row[header]}"`).join(','))
      ].join('\n');
      
      // Download do arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = nomeArquivo;
      link.click();
    }
  };

  // Função para exportar relatório em PDF
  const exportarRelatorioPDF = (tipo: string) => {
    const doc = new jsPDF();
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    if (tipo === "produtos") {
      doc.setFontSize(18);
      doc.text('Relatório de Produtos', 14, 22);
      doc.setFontSize(11);
      doc.text(`Filtro: ${quantityFilter} | Data: ${hoje}`, 14, 30);
      
      const tableData = dadosFiltrados.produtosFiltrados.map(item => {
        const quantidade = Number(item["Quantidade Atual"]) || 0;
        const preco = Number(item["Preço Unitário"]) || 0;
        
        return [
          item["SKU"],
          item["Nome Produto"],
          item["Categoria"],
          quantidade.toString(),
          `R$ ${preco.toFixed(2)}`,
          `R$ ${(quantidade * preco).toFixed(2)}`
        ];
      });
      
      autoTable(doc, {
        head: [['SKU', 'Nome', 'Categoria', 'Qtd', 'Preço Unit.', 'Valor Total']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
        didParseCell: function(data) {
          if (data.column.index === 3 && data.section === 'body') {
            const quantidade = Number(data.cell.text[0]);
            if (quantidade === 0) {
              data.cell.styles.fillColor = [231, 76, 60]; // Vermelho
              data.cell.styles.textColor = [255, 255, 255];
            } else if (quantidade < 10) {
              data.cell.styles.fillColor = [230, 126, 34]; // Laranja
              data.cell.styles.textColor = [255, 255, 255];
            } else {
              data.cell.styles.fillColor = [39, 174, 96]; // Verde
              data.cell.styles.textColor = [255, 255, 255];
            }
          }
        }
      });
      
      doc.save(`relatorio-produtos-${quantityFilter}-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } else if (tipo === "vendas") {
      doc.setFontSize(18);
      doc.text('Relatório de Vendas', 14, 22);
      doc.setFontSize(11);
      doc.text(`Período: ${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')} | Data: ${hoje}`, 14, 30);
      
      const tableData = dadosFiltrados.vendasFiltradas.map(venda => [
        venda["ID Venda"],
        venda["Data Venda"],
        venda["Nome Cliente"],
        venda["Nome Produto"],
        toNumber(venda["Quantidade Vendida"]).toString(),
        `R$ ${toNumber(venda["Valor Total"]).toFixed(2)}`
      ]);
      
      autoTable(doc, {
        head: [['ID Venda', 'Data', 'Cliente', 'Produto', 'Qtd', 'Valor Total']],
        body: tableData,
        startY: 35,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] }
      });
      
      doc.save(`relatorio-vendas-${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}.pdf`);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Relatórios & Analytics</h1>
            <p className="text-muted-foreground">
              Período: {dateRange.startDate.toLocaleDateString('pt-BR')} até {dateRange.endDate.toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportarRelatorioCSV("vendas")}>
              <Download className="mr-2 h-4 w-4" /> CSV Vendas
            </Button>
            <Button variant="outline" onClick={() => exportarVendasPorSKUCSV()}>
              <Download className="mr-2 h-4 w-4" /> CSV por SKU
            </Button>
            <Button variant="outline" onClick={() => exportarRelatorioPDF("vendas")}>
              <FileText className="mr-2 h-4 w-4" /> PDF Vendas
            </Button>
            <Button variant="outline" onClick={() => exportarVendasPorSKUPDF()}>
              <FileText className="mr-2 h-4 w-4" /> PDF por SKU
            </Button>
            <Button onClick={() => navigate("/vendas")}>
              <ShoppingCart className="mr-2 h-4 w-4" /> Nova Venda
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="vendas" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
          </TabsList>
          
          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Estatísticas principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Faturamento Total</p>
                      <p className="text-2xl font-bold text-green-600">R$ {estatisticas.faturamentoTotal.toFixed(2)}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de Vendas</p>
                      <p className="text-2xl font-bold text-blue-600">{estatisticas.totalVendas}</p>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                      <p className="text-2xl font-bold text-purple-600">R$ {estatisticas.ticketMedio.toFixed(2)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Valor do Estoque</p>
                      <p className="text-2xl font-bold text-orange-600">R$ {estatisticas.valorEstoque.toFixed(2)}</p>
                    </div>
                    <Package className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Estatísticas secundárias */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Clientes</p>
                      <p className="text-xl font-semibold">{estatisticas.totalClientes}</p>
                    </div>
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Produtos</p>
                      <p className="text-xl font-semibold">{estatisticas.totalProdutos}</p>
                    </div>
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Clientes Devedores</p>
                      <p className="text-xl font-semibold text-red-600">{estatisticas.clientesDevedores}</p>
                    </div>
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Sem Estoque</p>
                      <p className="text-xl font-semibold text-yellow-600">{estatisticas.produtosSemEstoque}</p>
                    </div>
                    <Activity className="h-6 w-6 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos principais */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Vendas por Mês
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <VendasPorMesChart data={vendasPorMes} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Vendas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <VendasPorCategoriaChart data={dadosGraficos.vendasPorCategoria} />
                </CardContent>
              </Card>
            </div>

            {/* Top produtos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProdutosMaisVendidosChart data={dadosGraficos.produtosMaisVendidos} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendas" className="space-y-6">
            {/* Filtros avançados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros Avançados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Cliente</label>
                    <Select value={clienteFilter} onValueChange={setClienteFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os clientes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os clientes</SelectItem>
                        {clientesUnicos.map(cliente => (
                          <SelectItem key={cliente} value={cliente}>{cliente}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Categoria</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas categorias</SelectItem>
                        {categorias.map(categoria => (
                          <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setClienteFilter("todos");
                        setCategoryFilter("todas");
                      }}
                      className="w-full"
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vendas por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <VendasPorMesChart data={vendasPorMes} />
              </CardContent>
            </Card>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Produtos Mais Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProdutosMaisVendidosChart data={dadosGraficos.produtosMaisVendidos} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Vendas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <VendasPorCategoriaChart data={dadosGraficos.vendasPorCategoria} />
                </CardContent>
              </Card>
            </div>

            {/* Resumo das vendas filtradas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{dadosFiltrados.vendasFiltradas.length}</p>
                    <p className="text-sm text-muted-foreground">Vendas Filtradas</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      R$ {dadosFiltrados.vendasFiltradas.reduce((acc, venda) => 
                        acc + toNumber(venda["Valor Total"]), 0
                      ).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Faturamento</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {dadosFiltrados.vendasFiltradas.reduce((acc, venda) => 
                        acc + toNumber(venda["Quantidade Vendida"]), 0
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">Itens Vendidos</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      R$ {dadosFiltrados.vendasFiltradas.length > 0 ? 
                        (dadosFiltrados.vendasFiltradas.reduce((acc, venda) => 
                          acc + toNumber(venda["Valor Total"]), 0
                        ) / dadosFiltrados.vendasFiltradas.length).toFixed(2) : '0.00'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de vendas por SKU */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Vendas por SKU (Período e Filtros Selecionados)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="px-3 py-1">
                      {vendasPorSKU.length} produtos vendidos
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Nome Produto</TableHead>
                        <TableHead className="text-right">Qtd Vendida</TableHead>
                        <TableHead className="text-right">Preço Unit. Médio</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendasPorSKU.map((item, index) => {
                        const percentual = estatisticas.faturamentoTotal > 0 
                          ? (item.valorTotal / estatisticas.faturamentoTotal * 100)
                          : 0;
                        
                        return (
                          <TableRow key={item.sku}>
                            <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                            <TableCell className="font-medium">{item.nome}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{item.quantidade}</Badge>
                            </TableCell>
                            <TableCell className="text-right">R$ {item.precoUnitario.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              R$ {item.valorTotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={percentual > 10 ? "default" : "outline"}>
                                {percentual.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {vendasPorSKU.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhuma venda encontrada no período selecionado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="produtos" className="space-y-6">
            {/* Filtros de produtos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros de Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Quantidade</label>
                    <Select value={quantityFilter} onValueChange={setQuantityFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filtrar por quantidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os itens</SelectItem>
                        <SelectItem value="sem-estoque">Sem estoque (0)</SelectItem>
                        <SelectItem value="estoque-baixo">Estoque baixo (&lt; 10)</SelectItem>
                        <SelectItem value="em-estoque">Em estoque (≥ 10)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Categoria</label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas categorias" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas categorias</SelectItem>
                        {categorias.map(categoria => (
                          <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportarRelatorioCSV("produtos")}>
                      <Download className="mr-1 h-4 w-4" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportarRelatorioPDF("produtos")}>
                      <FileText className="mr-1 h-4 w-4" /> PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumo dos produtos filtrados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{dadosFiltrados.produtosFiltrados.length}</p>
                    <p className="text-sm text-muted-foreground">Produtos Filtrados</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      R$ {dadosFiltrados.produtosFiltrados.reduce((acc, produto) => {
                        const quantidade = toNumber(produto["Quantidade Atual"]);
                        const preco = toNumber(produto["Preço Unitário"]);
                        return acc + (quantidade * preco);
                      }, 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {dadosFiltrados.produtosFiltrados.filter(p => 
                        toNumber(p["Quantidade Atual"]) < 10
                      ).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {dadosFiltrados.produtosFiltrados.filter(p => 
                        toNumber(p["Quantidade Atual"]) === 0
                      ).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Sem Estoque</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Estoque Atual ({dadosFiltrados.produtosFiltrados.length} produtos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dadosFiltrados.produtosFiltrados.map((item, index) => {
                      const quantidade = toNumber(item["Quantidade Atual"]);
                      const preco = toNumber(item["Preço Unitário"]);
                      const valorTotal = quantidade * preco;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{item["SKU"]}</TableCell>
                          <TableCell className="font-medium">{item["Nome Produto"]}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item["Categoria"]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`text-xs ${
                              quantidade === 0 
                                ? 'bg-destructive text-destructive-foreground' 
                                : quantidade < 10
                                ? 'bg-yellow-500 text-white'
                                : 'bg-green-500 text-white'
                            }`}>
                              {quantidade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">R$ {preco.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {valorTotal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {dadosFiltrados.produtosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum produto encontrado com os filtros selecionados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="clientes" className="space-y-6">
            {/* Estatísticas de clientes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{estatisticas.totalClientes}</p>
                    <p className="text-sm text-muted-foreground">Total de Clientes</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{estatisticas.clientesDevedores}</p>
                    <p className="text-sm text-muted-foreground">Clientes Devedores</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      R$ {(pagamentos.data || []).reduce((acc, pag) => 
                        acc + toNumber(pag["Valor Pago"]), 0
                      ).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Recebido</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      R$ {(() => {
                        const totalVendas = (vendas.data || []).reduce((acc, venda) => 
                          acc + toNumber(venda["Valor Total"]), 0
                        );
                        const totalPago = (pagamentos.data || []).reduce((acc, pag) => 
                          acc + toNumber(pag["Valor Pago"]), 0
                        );
                        return Math.max(0, totalVendas - totalPago).toFixed(2);
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground">Total em Aberto</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de clientes devedores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Clientes com Pagamentos Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Total Comprado</TableHead>
                      <TableHead className="text-right">Total Pago</TableHead>
                      <TableHead className="text-right">Valor em Aberto</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Calcular saldo por cliente usando vendas e pagamentos
                      const saldoPorCliente = new Map();
                      
                      (vendas.data || []).forEach(venda => {
                        const cliente = venda["Nome Cliente"];
                        const valor = toNumber(venda["Valor Total"]);
                        const atual = saldoPorCliente.get(cliente) || { comprado: 0, pago: 0, nome: cliente };
                        atual.comprado += valor;
                        saldoPorCliente.set(cliente, atual);
                      });
                      
                      (pagamentos.data || []).forEach(pag => {
                        const cliente = pag["Nome Cliente"];
                        const valor = toNumber(pag["Valor Pago"]);
                        const atual = saldoPorCliente.get(cliente) || { comprado: 0, pago: 0, nome: cliente };
                        atual.pago += valor;
                        saldoPorCliente.set(cliente, atual);
                      });
                      
                      const clientesDevedores = Array.from(saldoPorCliente.values())
                        .filter(c => c.comprado > c.pago)
                        .sort((a, b) => (b.comprado - b.pago) - (a.comprado - a.pago));
                        
                      return clientesDevedores.map((clienteData, index) => {
                        const totalComprado = clienteData.comprado;
                        const totalPago = clienteData.pago;
                        const saldo = totalComprado - totalPago;
                        const percentualPago = totalComprado > 0 ? (totalPago / totalComprado) * 100 : 0;
                        
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{clienteData.nome}</TableCell>
                            <TableCell className="text-right">R$ {totalComprado.toFixed(2)}</TableCell>
                            <TableCell className="text-right">R$ {totalPago.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold text-red-600">
                              R$ {saldo.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={percentualPago > 80 ? "default" : percentualPago > 50 ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                {percentualPago.toFixed(0)}% pago
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="link" 
                                size="sm" 
                                onClick={() => {
                                  const cliente = (clientes.data || []).find(c => c["Nome"] === clienteData.nome);
                                  if (cliente) navigate(`/clientes/${cliente["ID Cliente"]}`);
                                }}
                              >
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                    {(() => {
                      const saldoPorCliente = new Map();
                      
                      (vendas.data || []).forEach(venda => {
                        const cliente = venda["Nome Cliente"];
                        const valor = toNumber(venda["Valor Total"]);
                        const atual = saldoPorCliente.get(cliente) || { comprado: 0, pago: 0 };
                        atual.comprado += valor;
                        saldoPorCliente.set(cliente, atual);
                      });
                      
                      (pagamentos.data || []).forEach(pag => {
                        const cliente = pag["Nome Cliente"];
                        const valor = toNumber(pag["Valor Pago"]);
                        const atual = saldoPorCliente.get(cliente) || { comprado: 0, pago: 0 };
                        atual.pago += valor;
                        saldoPorCliente.set(cliente, atual);
                      });
                      
                      const hasDevedores = Array.from(saldoPorCliente.values()).some(c => c.comprado > c.pago);
                      
                      return !hasDevedores && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground" />
                            <p>Nenhum cliente com pagamentos pendentes</p>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Todos os clientes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Todos os Clientes ({(clientes.data || []).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-right">Total Comprado</TableHead>
                      <TableHead className="text-right">Total Pago</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Calcular totais por cliente
                      const totaisPorCliente = new Map();
                      
                      (vendas.data || []).forEach(venda => {
                        const cliente = venda["Nome Cliente"];
                        const valor = toNumber(venda["Valor Total"]);
                        const atual = totaisPorCliente.get(cliente) || { comprado: 0, pago: 0, nome: cliente };
                        atual.comprado += valor;
                        totaisPorCliente.set(cliente, atual);
                      });
                      
                      (pagamentos.data || []).forEach(pag => {
                        const cliente = pag["Nome Cliente"];
                        const valor = toNumber(pag["Valor Pago"]);
                        const atual = totaisPorCliente.get(cliente) || { comprado: 0, pago: 0, nome: cliente };
                        atual.pago += valor;
                        totaisPorCliente.set(cliente, atual);
                      });
                      
                      return Array.from(totaisPorCliente.values())
                        .sort((a, b) => b.comprado - a.comprado)
                        .map((clienteData, index) => {
                          const totalComprado = clienteData.comprado;
                          const totalPago = clienteData.pago;
                          const saldo = totalComprado - totalPago;
                          
                          // Buscar informações adicionais do cliente
                          const clienteInfo = (clientes.data || []).find(c => c["Nome"] === clienteData.nome);
                        
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{clienteData.nome}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {clienteInfo?.["Telefone"] || clienteInfo?.["Email"] || "-"}
                              </TableCell>
                              <TableCell className="text-right">R$ {totalComprado.toFixed(2)}</TableCell>
                              <TableCell className="text-right">R$ {totalPago.toFixed(2)}</TableCell>
                              <TableCell className="text-center">
                                {saldo > 0 ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Devedor
                                  </Badge>
                                ) : (
                                  <Badge variant="default" className="text-xs">
                                    Em dia
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  onClick={() => {
                                    if (clienteInfo) navigate(`/clientes/${clienteInfo["ID Cliente"]}`);
                                  }}
                                >
                                  Ver Detalhes
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                    })()}
                    {Array.from(new Set((vendas.data || []).map(v => v["Nome Cliente"]))).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground" />
                            <p>Nenhum cliente cadastrado</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
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

export default Relatorios;
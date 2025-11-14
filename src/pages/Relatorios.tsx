import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, Package, ShoppingCart, Users, TrendingUp, TrendingDown, DollarSign, Calendar, Filter, BarChart3, PieChart, Activity, Tag, Store } from "lucide-react";
import { formatCurrencyAbbreviated, formatAbbreviated, toNumber } from "@/utils/formatters";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
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
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [skuFilter, setSkuFilter] = useState<string[]>([]);
  const [periodoGrafico, setPeriodoGrafico] = useState<'mensal' | 'diario'>('mensal');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const navigate = useNavigate();
  const { vendas, produtos, clientes, pagamentos } = useAppDataWithFilters();
  const { dateRange } = useDateFilter();

  // Filtrar dados por múltiplos critérios (colocado antes para ser usado nos gráficos)
  const dadosFiltrados = useMemo(() => {
    // Filtrar produtos
    const produtosFiltrados = (produtos.data || []).filter(item => {
      const quantidade = toNumber(item["Quantidade Atual"]);
      const categoria = item["Categoria"];
      const tipoProduto = (item as any)["Tipo Produto"] || (item as any).tipo_produto;
      const sku = item["SKU"];

      const matchesQuantity = quantityFilter === "todos" ? true :
        quantityFilter === "sem-estoque" ? quantidade === 0 :
          quantityFilter === "estoque-baixo" ? quantidade > 0 && quantidade < 10 :
            quantityFilter === "em-estoque" ? quantidade >= 10 : true;

      const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(categoria);
      const matchesTipo = tipoFilter.length === 0 || tipoFilter.includes(tipoProduto);
      const matchesSKU = skuFilter.length === 0 || skuFilter.includes(sku);

      return matchesQuantity && matchesCategory && matchesTipo && matchesSKU;
    });

    // Filtrar vendas por cliente, tipo de produto, categoria e SKU
    const vendasFiltradas = (vendas.data || []).filter(venda => {
      const cliente = venda["Nome Cliente"];
      const sku = venda["SKU Produto"];

      const matchesCliente = clienteFilter.length === 0 || clienteFilter.includes(cliente);
      const matchesSKU = skuFilter.length === 0 || skuFilter.includes(sku);

      // Buscar o produto para obter tipo e categoria
      const produto = (produtos.data || []).find(p => p["SKU"] === sku);
      const tipoProduto = (produto as any)?.["Tipo Produto"] || (produto as any)?.tipo_produto;
      const categoriaProduto = produto?.["Categoria"];
      
      const matchesTipo = tipoFilter.length === 0 || tipoFilter.includes(tipoProduto);
      const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(categoriaProduto);

      return matchesCliente && matchesTipo && matchesCategory && matchesSKU;
    });

    return { produtosFiltrados, vendasFiltradas };
  }, [produtos.data, vendas.data, quantityFilter, categoryFilter, clienteFilter, tipoFilter, skuFilter]);

  // Processar dados reais de vendas por mês com filtros aplicados
  const vendasPorMes = useMemo(() => {
    // Se não houver filtro de data, usar últimos 12 meses
    if (!dateRange) {
      const now = new Date();
      const mapa = new Map<string, { key: string; name: string; valor: number; qtd: number }>();
      
      // Últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        mapa.set(key, { key, name: label, valor: 0, qtd: 0 });
      }

      // Agregar vendas filtradas por mês
      dadosFiltrados.vendasFiltradas.forEach(venda => {
        const dataVenda = venda["Data Venda"];
        if (!dataVenda) return;

        const d = new Date(dataVenda);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const atual = mapa.get(key);
        if (atual) {
          atual.valor += toNumber(venda["Valor Total"]);
          atual.qtd += toNumber(venda["Quantidade Vendida"]);
        }
      });

      return Array.from(mapa.values()).sort((a, b) => a.key.localeCompare(b.key));
    }

    // Mapa base preenchendo todos os meses do período selecionado
    const mapa = new Map<string, { key: string; name: string; valor: number; qtd: number }>();

    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    start.setDate(1);
    end.setDate(1);

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const label = cursor.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      mapa.set(key, { key, name: label, valor: 0, qtd: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Agregar vendas filtradas por mês
    dadosFiltrados.vendasFiltradas.forEach(venda => {
      const dataVenda = venda["Data Venda"];
      if (!dataVenda) return;

      const d = new Date(dataVenda);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const atual = mapa.get(key);
      if (atual) {
        atual.valor += toNumber(venda["Valor Total"]);
        atual.qtd += toNumber(venda["Quantidade Vendida"]);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [dadosFiltrados.vendasFiltradas, dateRange]);

  // Processar dados de vendas por dia
  const vendasPorDia = useMemo(() => {
    if (!dateRange) return []; // Sem gráfico diário se não houver range específico
    
    const mapa = new Map<string, { key: string; name: string; valor: number; qtd: number }>();

    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);

    // Preencher todos os dias do período
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0];
      const label = cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      mapa.set(key, { key, name: label, valor: 0, qtd: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Agregar vendas filtradas por dia
    dadosFiltrados.vendasFiltradas.forEach(venda => {
      const dataVenda = venda["Data Venda"];
      if (!dataVenda) return;

      const key = new Date(dataVenda).toISOString().split('T')[0];
      const atual = mapa.get(key);
      if (atual) {
        atual.valor += toNumber(venda["Valor Total"]);
        atual.qtd += toNumber(venda["Quantidade Vendida"]);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [dadosFiltrados.vendasFiltradas, dateRange]);

  // Selecionar dados baseado no período escolhido
  const dadosGraficoVendas = periodoGrafico === 'mensal' ? vendasPorMes : vendasPorDia;

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

  // Processar dados auxiliares para gráficos com dados filtrados
  const dadosGraficos = useMemo(() => {
    const vendidosPorProduto = new Map();
    const vendidosPorCategoria = new Map();

    dadosFiltrados.vendasFiltradas.forEach(venda => {
      const nome = venda["Nome Produto"];
      const sku = venda["SKU Produto"];
      const quantidade = toNumber(venda["Quantidade Vendida"]);

      if (nome) {
        vendidosPorProduto.set(nome, (vendidosPorProduto.get(nome) || 0) + quantidade);
      }

      const produto = (produtos.data || []).find(p => p["SKU"] === sku);
      const categoria = (produto as any)?.["Categoria"] || "Sem Categoria";
      vendidosPorCategoria.set(categoria, (vendidosPorCategoria.get(categoria) || 0) + quantidade);
    });

    const produtosMaisVendidos = Array.from(vendidosPorProduto.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    // Ordenar categorias por valor e agrupar as menores em "Outros"
    const categoriasOrdenadas = Array.from(vendidosPorCategoria.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const totalVendido = categoriasOrdenadas.reduce((acc, cat) => acc + cat.value, 0);
    const TOP_CATEGORIAS = 8; // Mostrar apenas top 8 categorias

    let vendasPorCategoria: Array<{ name: string; value: number }> = [];
    let outros = 0;

    categoriasOrdenadas.forEach((cat, index) => {
      // Calcular percentual
      const percentual = totalVendido > 0 ? (cat.value / totalVendido) * 100 : 0;

      // Se está no top 8 E tem mais de 2% do total, mostra separado
      if (index < TOP_CATEGORIAS && percentual >= 2) {
        vendasPorCategoria.push(cat);
      } else {
        // Agrupa em "Outros"
        outros += cat.value;
      }
    });

    // Adiciona "Outros" se houver
    if (outros > 0) {
      vendasPorCategoria.push({ name: 'Outros', value: outros });
    }

    return { produtosMaisVendidos, vendasPorCategoria };
  }, [dadosFiltrados.vendasFiltradas, produtos.data]);

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

  const tiposProduto = Array.from(new Set(
    (produtos.data || []).map(p => (p as any)["Tipo Produto"] || (p as any).tipo_produto).filter(Boolean)
  ));

  const clientesUnicos = Array.from(new Set(
    (vendas.data || []).map(v => v["Nome Cliente"]).filter(Boolean)
  ));

  const skusUnicos = Array.from(new Set(
    (produtos.data || []).map(p => p["SKU"]).filter(Boolean)
  ));

  // Reset página quando filtros mudam
  useMemo(() => {
    setCurrentPage(1);
  }, [quantityFilter, categoryFilter, clienteFilter, tipoFilter, skuFilter]);



  // Função para exportar relatório de vendas por SKU em CSV
  const exportarVendasPorSKUCSV = () => {
    const dados = vendasPorSKU.map(item => ({
      "SKU": item.sku,
      "Nome Produto": item.nome,
      "Quantidade Total Vendida": item.quantidade,
      "Preço Unitário Médio": `R$ ${item.precoUnitario.toFixed(2)}`,
      "Valor Total": `R$ ${item.valorTotal.toFixed(2)}`
    }));

    const hoje = new Date().toISOString().split('T')[0];
    const periodoTexto = dateRange 
      ? `${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}`
      : 'todos-os-dados';
    const nomeArquivo = `relatorio-vendas-sku-${periodoTexto}.csv`;

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
    const periodo = dateRange
      ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}`
      : 'Todos os dados';

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

    const periodoTexto = dateRange
      ? `${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}`
      : 'todos-os-dados';
    doc.save(`relatorio-vendas-sku-${periodoTexto}.pdf`);
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
      const periodoTexto = dateRange
        ? `${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}`
        : 'todos-os-dados';
      nomeArquivo = `relatorio-vendas-${periodoTexto}.csv`;
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
        didParseCell: function (data) {
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
      const periodo = dateRange
        ? `${dateRange.startDate.toLocaleDateString('pt-BR')} a ${dateRange.endDate.toLocaleDateString('pt-BR')}`
        : 'Todos os dados';
      doc.text(`Período: ${periodo} | Data: ${hoje}`, 14, 30);

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

      const periodoTexto = dateRange
        ? `${dateRange.startDate.toISOString().split('T')[0]}-a-${dateRange.endDate.toISOString().split('T')[0]}`
        : 'todos-os-dados';
      doc.save(`relatorio-vendas-${periodoTexto}.pdf`);
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
              Período: {dateRange 
                ? `${dateRange.startDate.toLocaleDateString('pt-BR')} até ${dateRange.endDate.toLocaleDateString('pt-BR')}`
                : 'Todos os dados históricos'
              }
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
            {/* Estatísticas principais - CARDS GRANDES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Faturamento Total</p>
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrencyAbbreviated(estatisticas.faturamentoTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">Período selecionado</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Total de Vendas</p>
                      <ShoppingCart className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatAbbreviated(estatisticas.totalVendas)}
                    </p>
                    <p className="text-xs text-muted-foreground">{estatisticas.totalVendas} transações</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-purple-600">
                      {formatCurrencyAbbreviated(estatisticas.ticketMedio)}
                    </p>
                    <p className="text-xs text-muted-foreground">Por transação</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Valor do Estoque</p>
                      <Package className="h-5 w-5 text-orange-600" />
                    </div>
                    <p className="text-3xl font-bold text-orange-600">
                      {formatCurrencyAbbreviated(estatisticas.valorEstoque)}
                    </p>
                    <p className="text-xs text-muted-foreground">{estatisticas.totalProdutos} produtos</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Estatísticas secundárias - LINHA COMPACTA */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{estatisticas.totalClientes}</p>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{estatisticas.totalProdutos}</p>
                      <p className="text-xs text-muted-foreground">Produtos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{estatisticas.clientesDevedores}</p>
                      <p className="text-xs text-muted-foreground">Devedores</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Activity className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">{estatisticas.produtosSemEstoque}</p>
                      <p className="text-xs text-muted-foreground">Sem Estoque</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos principais */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Vendas {periodoGrafico === 'mensal' ? 'por Mês' : 'por Dia'}
                    </CardTitle>
                    <Select value={periodoGrafico} onValueChange={(value: 'mensal' | 'diario') => setPeriodoGrafico(value)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Por Mês</SelectItem>
                        <SelectItem value="diario">Por Dia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <VendasPorMesChart data={dadosGraficoVendas} />
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
                  Top 5 Produtos Mais Vendidos
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Cliente</label>
                    <MultiSelectFilter
                      label="Cliente"
                      icon={Users}
                      options={clientesUnicos}
                      selectedValues={clienteFilter}
                      onChange={setClienteFilter}
                      placeholder="Todos os clientes"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">SKU</label>
                    <MultiSelectFilter
                      label="SKU"
                      icon={Package}
                      options={skusUnicos}
                      selectedValues={skuFilter}
                      onChange={setSkuFilter}
                      placeholder="Todos os SKUs"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de Produto</label>
                    <MultiSelectFilter
                      label="Tipo"
                      icon={Package}
                      options={tiposProduto}
                      selectedValues={tipoFilter}
                      onChange={setTipoFilter}
                      placeholder="Todos os tipos"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Categoria</label>
                    <MultiSelectFilter
                      label="Categoria"
                      icon={Tag}
                      options={categorias}
                      selectedValues={categoryFilter}
                      onChange={setCategoryFilter}
                      placeholder="Todas categorias"
                    />
                  </div>

                  <div className="flex items-end col-span-full">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setClienteFilter([]);
                        setSkuFilter([]);
                        setCategoryFilter([]);
                        setTipoFilter([]);
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
                <div className="flex items-center justify-between">
                  <CardTitle>Vendas {periodoGrafico === 'mensal' ? 'por Mês' : 'por Dia'}</CardTitle>
                  <Select value={periodoGrafico} onValueChange={(value: 'mensal' | 'diario') => setPeriodoGrafico(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Por Mês</SelectItem>
                      <SelectItem value="diario">Por Dia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <VendasPorMesChart data={dadosGraficoVendas} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Vendas Filtradas</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatAbbreviated(dadosFiltrados.vendasFiltradas.length)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Faturamento</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrencyAbbreviated(
                        dadosFiltrados.vendasFiltradas.reduce((acc, venda) =>
                          acc + toNumber(venda["Valor Total"]), 0
                        )
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Itens Vendidos</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatAbbreviated(
                        dadosFiltrados.vendasFiltradas.reduce((acc, venda) =>
                          acc + toNumber(venda["Quantidade Vendida"]), 0
                        )
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {formatCurrencyAbbreviated(
                        dadosFiltrados.vendasFiltradas.length > 0 ?
                          dadosFiltrados.vendasFiltradas.reduce((acc, venda) =>
                            acc + toNumber(venda["Valor Total"]), 0
                          ) / dadosFiltrados.vendasFiltradas.length : 0
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de vendas por SKU */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Vendas por SKU
                  </CardTitle>
                  <Badge variant="outline" className="px-3 py-1">
                    {vendasPorSKU.length} produtos vendidos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Tabela */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">SKU</TableHead>
                          <TableHead className="font-semibold">Nome Produto</TableHead>
                          <TableHead className="text-right font-semibold">Qtd Vendida</TableHead>
                          <TableHead className="text-right font-semibold">Preço Unit.</TableHead>
                          <TableHead className="text-right font-semibold">Valor Total</TableHead>
                          <TableHead className="text-center font-semibold">% Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendasPorSKU
                          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                          .map((item, index) => {
                            const percentual = estatisticas.faturamentoTotal > 0
                              ? (item.valorTotal / estatisticas.faturamentoTotal * 100)
                              : 0;

                            return (
                              <TableRow key={item.sku} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-mono text-sm font-medium">{item.sku}</TableCell>
                                <TableCell>{item.nome}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary" className="font-semibold">
                                    {item.quantidade}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrencyAbbreviated(item.precoUnitario)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                  {formatCurrencyAbbreviated(item.valorTotal)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={percentual > 10 ? "default" : "outline"}>
                                    {percentual.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {vendasPorSKU.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                              <div className="flex flex-col items-center gap-2">
                                <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
                                <p className="text-lg font-medium">Nenhuma venda encontrada</p>
                                <p className="text-sm">Não há vendas no período selecionado</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginação */}
                  {vendasPorSKU.length > pageSize && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {Math.min((currentPage - 1) * pageSize + 1, vendasPorSKU.length)} - {Math.min(currentPage * pageSize, vendasPorSKU.length)} de {vendasPorSKU.length} produtos
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Anterior
                        </Button>
                        <span className="text-sm font-medium px-3">
                          Página {currentPage} de {Math.ceil(vendasPorSKU.length / pageSize)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(vendasPorSKU.length / pageSize), p + 1))}
                          disabled={currentPage >= Math.ceil(vendasPorSKU.length / pageSize)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <label className="text-sm font-medium mb-2 block">SKU</label>
                    <MultiSelectFilter
                      label="SKU"
                      icon={Package}
                      options={skusUnicos}
                      selectedValues={skuFilter}
                      onChange={setSkuFilter}
                      placeholder="Todos os SKUs"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Tipo de Produto</label>
                    <MultiSelectFilter
                      label="Tipo"
                      icon={Package}
                      options={tiposProduto}
                      selectedValues={tipoFilter}
                      onChange={setTipoFilter}
                      placeholder="Todos os tipos"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Categoria</label>
                    <MultiSelectFilter
                      label="Categoria"
                      icon={Tag}
                      options={categorias}
                      selectedValues={categoryFilter}
                      onChange={setCategoryFilter}
                      placeholder="Todas categorias"
                    />
                  </div>

                  <div className="flex items-end gap-2 col-span-full">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuantityFilter("todos");
                        setSkuFilter([]);
                        setCategoryFilter([]);
                        setTipoFilter([]);
                      }}
                      className="flex-1"
                    >
                      Limpar Filtros
                    </Button>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Produtos Filtrados</p>
                    <p className="text-3xl font-bold text-primary">
                      {formatAbbreviated(dadosFiltrados.produtosFiltrados.length)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrencyAbbreviated(
                        dadosFiltrados.produtosFiltrados.reduce((acc, produto) => {
                          const quantidade = toNumber(produto["Quantidade Atual"]);
                          const preco = toNumber(produto["Preço Unitário"]);
                          return acc + (quantidade * preco);
                        }, 0)
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Estoque Baixo</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {dadosFiltrados.produtosFiltrados.filter(p =>
                        toNumber(p["Quantidade Atual"]) < 10 && toNumber(p["Quantidade Atual"]) > 0
                      ).length}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">Sem Estoque</p>
                    <p className="text-3xl font-bold text-red-600">
                      {dadosFiltrados.produtosFiltrados.filter(p =>
                        toNumber(p["Quantidade Atual"]) === 0
                      ).length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Estoque Atual
                  </CardTitle>
                  <Badge variant="outline" className="px-3 py-1">
                    {dadosFiltrados.produtosFiltrados.length} produtos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">SKU</TableHead>
                          <TableHead className="font-semibold">Nome</TableHead>
                          <TableHead className="font-semibold">Categoria</TableHead>
                          <TableHead className="text-center font-semibold">Status</TableHead>
                          <TableHead className="text-right font-semibold">Quantidade</TableHead>
                          <TableHead className="text-right font-semibold">Valor Unit.</TableHead>
                          <TableHead className="text-right font-semibold">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dadosFiltrados.produtosFiltrados
                          .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                          .map((item, index) => {
                            const quantidade = toNumber(item["Quantidade Atual"]);
                            const preco = toNumber(item["Preço Unitário"]);
                            const valorTotal = quantidade * preco;

                            return (
                              <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-mono text-sm font-medium">{item["SKU"]}</TableCell>
                                <TableCell className="font-medium">{item["Nome Produto"]}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {item["Categoria"]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  {quantidade === 0 ? (
                                    <Badge variant="destructive" className="text-xs">
                                      Sem Estoque
                                    </Badge>
                                  ) : quantidade < 10 ? (
                                    <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                                      Estoque Baixo
                                    </Badge>
                                  ) : (
                                    <Badge variant="default" className="text-xs bg-green-500/10 text-green-700 border-green-500/20">
                                      Em Estoque
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`font-semibold ${quantidade === 0
                                    ? 'text-red-600'
                                    : quantidade < 10
                                      ? 'text-yellow-600'
                                      : 'text-green-600'
                                    }`}>
                                    {quantidade}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {formatCurrencyAbbreviated(preco)}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                  {formatCurrencyAbbreviated(valorTotal)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        {dadosFiltrados.produtosFiltrados.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                              <div className="flex flex-col items-center gap-2">
                                <Package className="h-12 w-12 text-muted-foreground/50" />
                                <p className="text-lg font-medium">Nenhum produto encontrado</p>
                                <p className="text-sm">Ajuste os filtros para ver mais resultados</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginação */}
                  {dadosFiltrados.produtosFiltrados.length > pageSize && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        Mostrando {Math.min((currentPage - 1) * pageSize + 1, dadosFiltrados.produtosFiltrados.length)} - {Math.min(currentPage * pageSize, dadosFiltrados.produtosFiltrados.length)} de {dadosFiltrados.produtosFiltrados.length} produtos
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Anterior
                        </Button>
                        <span className="text-sm font-medium px-3">
                          Página {currentPage} de {Math.ceil(dadosFiltrados.produtosFiltrados.length / pageSize)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(dadosFiltrados.produtosFiltrados.length / pageSize), p + 1))}
                          disabled={currentPage >= Math.ceil(dadosFiltrados.produtosFiltrados.length / pageSize)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="space-y-6">
            {/* Filtros de clientes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Cliente</label>
                    <MultiSelectFilter
                      label="Cliente"
                      icon={Users}
                      options={clientesUnicos}
                      selectedValues={clienteFilter}
                      onChange={setClienteFilter}
                      placeholder="Todos os clientes"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">SKU</label>
                    <MultiSelectFilter
                      label="SKU"
                      icon={Package}
                      options={skusUnicos}
                      selectedValues={skuFilter}
                      onChange={setSkuFilter}
                      placeholder="Todos os SKUs"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setClienteFilter([]);
                        setSkuFilter([]);
                      }}
                      className="w-full"
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas de clientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-primary">
                      {estatisticas.totalClientes}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Clientes Devedores</p>
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-3xl font-bold text-red-600">
                      {estatisticas.clientesDevedores}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Total Recebido</p>
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-green-600">
                      {formatCurrencyAbbreviated(
                        (pagamentos.data || []).reduce((acc, pag) =>
                          acc + toNumber(pag["Valor Pago"]), 0
                        )
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Total em Aberto</p>
                      <Activity className="h-5 w-5 text-yellow-600" />
                    </div>
                    <p className="text-3xl font-bold text-yellow-600">
                      {formatCurrencyAbbreviated((() => {
                        const totalVendas = (vendas.data || []).reduce((acc, venda) =>
                          acc + toNumber(venda["Valor Total"]), 0
                        );
                        const totalPago = (pagamentos.data || []).reduce((acc, pag) =>
                          acc + toNumber(pag["Valor Pago"]), 0
                        );
                        return Math.max(0, totalVendas - totalPago);
                      })())}
                    </p>
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
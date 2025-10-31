
import { useMemo } from "react";
import Layout from "@/components/Layout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAppDataWithFilters } from "@/hooks/useApiDataWithFilters";
import DashboardStats from "@/components/dashboard/DashboardStats";
import QuickActions from "@/components/dashboard/QuickActions";
import RecentSales from "@/components/dashboard/RecentSales";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import SalesChart from "@/components/dashboard/SalesChart";
import TopProductsCard from "@/components/dashboard/TopProductsCard";
import { useNotificationCleanup } from "@/components/NotificationManager";
import { QuickFilters } from "@/components/QuickFilters";
import { useQuickFilters } from "@/hooks/useQuickFilters";

const Index = () => {
  const { vendas, clientes, produtos, isAnyLoading } = useAppDataWithFilters();
  useNotificationCleanup();

  // Filtros rápidos para produtos em baixo estoque
  const {
    filteredData: filteredProdutos,
    updateFilter,
    clearFilters,
    activeFiltersCount,
    availableOptions,
    filters
  } = useQuickFilters(
    produtos.data,
    (produto, filters) => {
      const searchTerm = filters.searchTerm.toLowerCase();
      const sku = produto.SKU || '';
      const nome = produto['Nome Produto'] || '';
      const categoria = produto.Categoria || '';
      
      const matchesSearch = !searchTerm || 
        sku.toLowerCase().includes(searchTerm) ||
        nome.toLowerCase().includes(searchTerm) ||
        categoria.toLowerCase().includes(searchTerm);

      return matchesSearch;
    },
    { persistKey: 'dashboard-produtos' }
  );

  const { stats, recentSales, itensBaixoEstoque, topProdutos } = useMemo(() => {
    const vendasData = vendas?.data || [];
    const produtosData = filteredProdutos || [];
    const clientesData = clientes?.data || [];

    const parseDateLocal = (s: string) => {
      if (!s) return null as Date | null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    // Estatísticas (EXCLUIR KITs para evitar dupla contagem)
    const produtosNaoKit = produtosData.filter((p: any) => 
      (p["Tipo Produto"] || p.tipo_produto) !== "KIT"
    );

    const totalReceita = vendasData.reduce((acc: number, v: any) => {
      const valor = Number(v["Valor Total"] ?? v["Valor Venda"] ?? 0);
      return acc + (isNaN(valor) ? 0 : valor);
    }, 0);

    const stats = {
      totalVendas: vendasData.length,
      totalReceita,
      totalProdutos: produtosNaoKit.length,
      totalClientes: clientesData.length
    };

    // Últimas vendas (ordenadas por data desc, mais recentes primeiro)
    const recentSales = vendasData
      .slice()
      .sort((a: any, b: any) => {
        const da = parseDateLocal(a["Data Venda"]);
        const db = parseDateLocal(b["Data Venda"]);
        const at = da ? da.getTime() : 0;
        const bt = db ? db.getTime() : 0;
        return bt - at;
      })
      .slice(0, 5)
      .map((venda: any) => ({
        cliente: venda["Nome Cliente"] || "Cliente não identificado",
        valor: Number(venda["Valor Total"] ?? venda["Valor Venda"] ?? 0) || 0,
        data: venda["Data Venda"] || new Date().toISOString()
      }));

    // Produtos com baixo estoque (excluir KITs - seu estoque é derivado)
    const produtosBaixoEstoque = produtosData
      .filter((produto: any) => {
        const tipo = produto["Tipo Produto"] || produto.tipo_produto;
        return tipo !== "KIT" && produto["Quantidade Atual"] && Number(produto["Quantidade Atual"]) <= 10;
      })
      .map((produto: any) => ({
        sku: produto.SKU || produto["SKU Produto"] || "N/A",
        nome: produto["Nome Produto"] || "N/A",
        quantidade: Number(produto["Quantidade Atual"]) || 0,
        tipo: "Produto"
      }))
      .slice(0, 3);

    // Matérias-primas com baixo estoque
    const materiasPrimasBaixoEstoque = produtosData
      .filter((mp: any) => mp["SKU Matéria-Prima"] && mp["Quantidade Atual"] && Number(mp["Quantidade Atual"]) <= 50)
      .map((mp: any) => ({
        sku: mp["SKU Matéria-Prima"] || "N/A",
        nome: mp["Nome Matéria-Prima"] || "N/A",
        quantidade: Number(mp["Quantidade Atual"]) || 0,
        tipo: "Matéria-Prima"
      }))
      .slice(0, 3);

    const itensBaixoEstoque = [...produtosBaixoEstoque, ...materiasPrimasBaixoEstoque].slice(0, 5);

    // Top produtos mais vendidos (com miniaturas)
    const produtoVendas = vendasData.reduce((acc: any, venda: any) => {
      const sku = venda['SKU Produto'] || venda.SKU;
      if (sku) {
        acc[sku] = (acc[sku] || 0) + (Number(venda['Quantidade Vendida']) || 0);
      }
      return acc;
    }, {});

    const topProdutos = Object.entries(produtoVendas)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([sku, quantidade]) => {
        const produto = produtosData.find((p: any) => p.SKU === sku);
        return {
          sku,
          nome: produto?.['Nome Produto'] || 'Produto não encontrado',
          quantidadeVendida: quantidade as number,
          categoria: produto?.Categoria || 'N/A'
        };
      });

    return { stats, recentSales, itensBaixoEstoque, topProdutos };
  }, [vendas?.data, filteredProdutos, clientes?.data]);

  if (isAnyLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" text="Carregando dashboard..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral completa do seu negócio</p>
          </div>
        </div>
        
        {/* Filtros rápidos */}
        <QuickFilters
          filters={filters}
          updateFilter={updateFilter}
          clearFilters={clearFilters}
          activeFiltersCount={activeFiltersCount}
          availableOptions={availableOptions}
        />
        
        {/* Cards de resumo */}
        <DashboardStats {...stats} />
        
        {/* Ações rápidas */}
        <QuickActions />
        
        {/* Gráfico de vendas */}
        <SalesChart sales={vendas?.data || []} />
        
        {/* Grid de conteúdo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Últimas vendas */}
          <RecentSales sales={recentSales} />
          
          {/* Top produtos mais vendidos */}
          <TopProductsCard products={topProdutos} />
        </div>
        
        {/* Alertas de estoque */}
        <LowStockAlert items={itensBaixoEstoque} />
      </div>
    </Layout>
  );
};

export default Index;

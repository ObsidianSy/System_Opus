import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useApiDataWithFilters } from "@/hooks/useApiDataWithFilters";
import { QuickFilters } from "@/components/QuickFilters";
import { useQuickFilters } from "@/hooks/useQuickFilters";
import { ProductList } from "@/components/ProductList";
import { notificationManager } from "@/components/NotificationManager";
import DashboardCard from "@/components/DashboardCard";
import { ShoppingCart, Plus, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VendaForm from "@/components/forms/VendaForm";
import { formatCurrency, formatQuantity, formatNumber, toNumber } from "@/utils/formatters";


const parseDateLocal = (s?: string) => {
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

interface Venda {
  "Data Venda": string;
  "Nome Cliente": string;
  "SKU Produto": string;
  "Nome Produto": string;
  "Quantidade Vendida": number;
  "Preço Unitário": number;
  "Valor Total": number;
  "Canal": string;
  "Pedido UID": string;
}

const Vendas = () => {
  const { data: vendas, isLoading, refresh } = useApiDataWithFilters<Venda>('Vendas');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Estado de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filtros rápidos
  const {
    filteredData,
    updateFilter,
    clearFilters,
    activeFiltersCount,
    availableOptions,
    filters
  } = useQuickFilters(
    vendas,
    (venda, filters) => {
      const searchTerm = filters.searchTerm.toLowerCase();
      const cliente = venda['Nome Cliente']?.toLowerCase() || '';
      const sku = venda['SKU Produto']?.toLowerCase() || '';

      const matchesSearch = !searchTerm ||
        cliente.includes(searchTerm) ||
        sku.includes(searchTerm);

      const matchesClient = !filters.selectedClient ||
        venda['Nome Cliente'] === filters.selectedClient;

      const matchesSKU = !filters.selectedSKU ||
        venda['SKU Produto'] === filters.selectedSKU;

      const matchesCanal = !filters.selectedCanal ||
        venda['Canal'] === filters.selectedCanal;

      return matchesSearch && matchesClient && matchesSKU && matchesCanal;
    },
    {
      persistKey: 'vendas',
      defaultFilters: { selectedStatus: '' }
    }
  );

  // Ordenar vendas por data (mais recentes primeiro)
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const dateA = new Date(a['Data Venda']).getTime();
      const dateB = new Date(b['Data Venda']).getTime();
      return dateB - dateA; // Ordem decrescente (mais recentes primeiro)
    });
  }, [filteredData]);

  // Paginação
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize]);

  // Reset para primeira página quando filtros mudarem
  useMemo(() => {
    setCurrentPage(1);
  }, [filteredData.length]);

  const stats = useMemo(() => {
    const totalVendas = filteredData.reduce((acc, venda) => {
      const valor = toNumber(venda["Valor Total"]);
      return acc + valor;
    }, 0);

    const totalQuantidade = filteredData.reduce((acc, venda) => {
      const qtd = toNumber(venda["Quantidade Vendida"]);
      return acc + qtd;
    }, 0);

    console.log('📊 Estatísticas de Vendas:', {
      totalRegistros: filteredData.length,
      totalVendas,
      totalQuantidade,
      amostra: filteredData.slice(0, 3).map(v => ({
        valorTotal: v["Valor Total"],
        valorTotalNormalizado: toNumber(v["Valor Total"]),
        quantidade: v["Quantidade Vendida"],
        quantidadeNormalizada: toNumber(v["Quantidade Vendida"])
      }))
    });

    return {
      totalVendas,
      numeroVendas: filteredData.length,
      totalQuantidade
    };
  }, [filteredData]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" text="Carregando vendas..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Vendas
            </h2>
            <p className="text-muted-foreground mt-2">
              Gestão e histórico de vendas
            </p>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-primary hover:bg-primary-glow text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Venda
          </Button>
        </div>

        {/* Filtros rápidos */}
        <QuickFilters
          filters={filters}
          updateFilter={updateFilter}
          clearFilters={clearFilters}
          activeFiltersCount={activeFiltersCount}
          availableOptions={availableOptions}
        />

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DashboardCard
            title="Total de Vendas"
            subtitle="Valor total das vendas filtradas"
            value={formatCurrency(stats.totalVendas)}
            icon={ShoppingCart}
            gradient="from-success to-success/80"
            textColor="text-success"
          />
          <DashboardCard
            title="Número de Vendas"
            subtitle="Quantidade de vendas registradas"
            value={formatNumber(stats.numeroVendas)}
            icon={Plus}
            gradient="from-primary to-primary-glow"
            textColor="text-primary"
          />
          <DashboardCard
            title="Itens Vendidos"
            subtitle="Total de itens comercializados"
            value={formatQuantity(stats.totalQuantidade)}
            icon={TrendingUp}
            gradient="from-warning to-warning/80"
            textColor="text-warning"
          />
        </div>

        {/* Lista de vendas com miniaturas */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Histórico de Vendas ({sortedData.length}) • Mais recentes primeiro
            </h3>
          </div>

          {/* Controles de paginação */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-border/50">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Mostrando {Math.min((currentPage - 1) * pageSize + 1, sortedData.length)} - {Math.min(currentPage * pageSize, sortedData.length)} de {sortedData.length} resultados
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 text-sm bg-background border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
                <option value={200}>200 por página</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-foreground font-medium px-3">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ProductList
            items={paginatedData.map(venda => ({
              sku: venda['SKU Produto'],
              nome: venda['Nome Produto'] || 'Produto não identificado',
              quantidade: venda['Quantidade Vendida'],
              preco: venda['Preço Unitário'],
              cliente: venda['Nome Cliente'],
              dataVenda: venda['Data Venda'],
              valorTotal: venda['Valor Total'],
              canal: venda['Canal'],
              pedidoUid: venda['Pedido UID'],
            }))}
            showThumbnails={true}
            showQuantity={true}
            showPrice={true}
            showCategory={false}
            showStatus={false}
            showCustomer={true}
            showDate={true}
            showChannel={true}
            showOrderId={true}
          />
        </div>
      </div>

      {/* Modal de Nova Venda */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nova Venda</DialogTitle>
          </DialogHeader>
          <VendaForm
            onSuccess={() => {
              setIsFormOpen(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Vendas;
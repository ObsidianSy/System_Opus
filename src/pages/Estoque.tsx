import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import Layout from "@/components/Layout";
import { ProductsDataTable } from "@/components/tables/ProductsDataTable";
import { RawMaterialsDataTable } from "@/components/tables/RawMaterialsDataTable";
import { Plus, Package, RefreshCw, Settings, ArrowUp, MoreHorizontal, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";
import ProdutoForm from "@/components/forms/ProdutoForm";
import MateriaPrimaForm from "@/components/forms/MateriaPrimaForm";
import EntradaProdutoForm from "@/components/forms/EntradaProdutoForm";
import EntradaMateriaPrimaForm from "@/components/forms/EntradaMateriaPrimaForm";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProductDetailsModal } from "@/components/ProductDetailsModal";
import { formatCurrency, formatQuantity, formatNumber } from "@/utils/formatters";
import { useProducts } from "@/hooks/useProducts";
import { useTableFilters } from "@/hooks/useTableFilters";

interface ProdutoAcabado {
  sku?: string;
  nome?: string;
  categoria?: string;
  tipo_produto?: string;
  quantidade?: number;
  unidade_medida?: string;
  preco_unitario?: number;
  // Campos da API
  SKU?: string;
  "Nome Produto"?: string;
  "Categoria"?: string;
  "Tipo Produto"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Preço Unitário"?: number;
}

interface MateriaPrima {
  sku_materia_prima?: string;
  nome_materia_prima?: string;
  categoria_mp?: string;
  quantidade_mp?: number;
  unidade_mp?: string;
  custo_unitario_mp?: number;
  // Campos da API
  "SKU Matéria-Prima"?: string;
  "Nome Matéria-Prima"?: string;
  "Categoria MP"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Custo Unitário"?: number;
}

const Estoque = () => {
  const [activeTab, setActiveTab] = useState("estoque");
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [editingProduct, setEditingProduct] = useState<ProdutoAcabado | null>(null);
  const [editingMateriaPrima, setEditingMateriaPrima] = useState<MateriaPrima | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProdutoAcabado | null>(null);
  const navigate = useNavigate();

  // Use custom hook for products - sem auto-refresh para melhor performance
  const { 
    products: produtosAcabados, 
    stats, 
    categories: categorias, 
    types: tipos,
    isLoading,
    refresh: refreshProducts 
  } = useProducts({ 
    autoLoad: true
  });

  // Use custom hook for filters
  const {
    filteredData: filteredProdutosAcabados,
    filters,
    setQuantityFilter,
    setCategoryFilter,
    setTypeFilter
  } = useTableFilters(produtosAcabados, {
    quantityField: (p: any) => p.quantidade || p["Quantidade Atual"] || 0,
    categoryField: (p: any) => p.categoria || p["Categoria"],
    typeField: (p: any) => p.tipo_produto || p["Tipo Produto"]
  });

  // Memoize matérias-primas loading
  const carregarMateriaPrima = useCallback(async () => {
    try {
      const dadosMateriaPrima = await consultarDados('Estoque_MateriaPrima');
      console.log('Dados de matéria-prima recebidos:', dadosMateriaPrima);
      
      if (dadosMateriaPrima && dadosMateriaPrima.length > 0) {
        setMateriasPrimas(dadosMateriaPrima);
        toast.success("Matéria-prima carregada", {
          description: `${dadosMateriaPrima.length} itens encontrados`
        });
      } else {
        setMateriasPrimas([]);
        toast.info("Nenhuma matéria-prima encontrada");
      }
    } catch (error) {
      console.error('Erro ao carregar matéria-prima:', error);
      toast.error("Erro ao carregar matéria-prima");
    }
  }, []);

  // Load matérias-primas on mount
  useEffect(() => {
    carregarMateriaPrima();
  }, [carregarMateriaPrima]);

  // Memoize filtered matérias-primas
  const filteredMateriasPrimas = useMemo(() => {
    return materiasPrimas.filter(item => {
      const quantidade = item.quantidade_mp || item["Quantidade Atual"] || 0;
      
      const matchesQuantity = filters.quantity === "todos" ? true :
        filters.quantity === "sem-estoque" ? quantidade === 0 :
        filters.quantity === "estoque-baixo" ? quantidade > 0 && quantidade < 10 :
        filters.quantity === "em-estoque" ? quantidade >= 10 : true;
      
      return matchesQuantity;
    });
  }, [materiasPrimas, filters.quantity]);

  const carregarDados = useCallback(() => {
    refreshProducts();
    carregarMateriaPrima();
  }, [refreshProducts, carregarMateriaPrima]);

  const handleNovoProduto = () => {
    navigate("/estoque/novo");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Estoque</h1>
            <p className="text-sm text-muted-foreground">
              {produtosAcabados.length} produtos • {materiasPrimas.length} matérias-prima
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <ProdutoForm onSuccess={refreshProducts} />
              </DialogContent>
            </Dialog>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Matéria-Prima
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <MateriaPrimaForm onSuccess={() => carregarMateriaPrima()} />
                  </DialogContent>
                </Dialog>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Entrada Produto
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <EntradaProdutoForm onSuccess={refreshProducts} />
                  </DialogContent>
                </Dialog>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <ArrowUp className="w-4 h-4 mr-2" />
                      Entrada MP
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <EntradaMateriaPrimaForm onSuccess={() => carregarMateriaPrima()} />
                  </DialogContent>
                </Dialog>
                
                <DropdownMenuItem onClick={() => navigate('/receita-produto')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Receitas
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={carregarDados} disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats aprimorados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{produtosAcabados.length}</p>
                <p className="text-xs text-muted-foreground">Produtos</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{formatCurrency(stats.totalValue)}</p>
              <p className="text-xs text-muted-foreground">Valor Total (sem kits)</p>
            </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-yellow-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.lowStock}</p>
                <p className="text-xs text-muted-foreground">Estoque Baixo</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.outOfStock}</p>
                <p className="text-xs text-muted-foreground">Sem Estoque</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Filtros:
            </Badge>
            <Select value={filters.quantity} onValueChange={setQuantityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por quantidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                <SelectItem value="sem-estoque">Sem estoque (0)</SelectItem>
                <SelectItem value="estoque-baixo">Estoque baixo (&lt;10)</SelectItem>
                <SelectItem value="em-estoque">Em estoque (≥10)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Select value={filters.category} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map(categoria => (
                <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filters.type} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipos.map(tipo => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="estoque" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Produtos Acabados ({produtosAcabados.length})
            </TabsTrigger>
            <TabsTrigger value="materia-prima" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Matéria-Prima ({materiasPrimas.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estoque" className="mt-6">
            <ProductsDataTable
              produtos={filteredProdutosAcabados}
              onEdit={setEditingProduct}
              onRefresh={refreshProducts}
              onViewDetails={setSelectedProduct}
            />
          </TabsContent>

          <TabsContent value="materia-prima" className="mt-6">
            <RawMaterialsDataTable
              materiasPrimas={filteredMateriasPrimas}
              onEdit={setEditingMateriaPrima}
              onRefresh={carregarMateriaPrima}
            />
          </TabsContent>
        </Tabs>

        {/* Dialog para editar produto */}
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-4xl">
            {editingProduct && (
              <ProdutoForm 
                produto={{
                  SKU: editingProduct.SKU || editingProduct.sku,
                  "Nome Produto": editingProduct["Nome Produto"] || editingProduct.nome,
                  "Categoria": editingProduct["Categoria"] || editingProduct.categoria,
                  "Tipo Produto": editingProduct["Tipo Produto"] || editingProduct.tipo_produto,
                  "Quantidade Atual": editingProduct["Quantidade Atual"] || editingProduct.quantidade,
                  "Unidade de Medida": editingProduct["Unidade de Medida"] || editingProduct.unidade_medida,
                  "Preço Unitário": editingProduct["Preço Unitário"] || editingProduct.preco_unitario
                }}
                onSuccess={() => {
                  setEditingProduct(null);
                  refreshProducts();
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para editar matéria-prima */}
        <Dialog open={!!editingMateriaPrima} onOpenChange={() => setEditingMateriaPrima(null)}>
          <DialogContent className="max-w-4xl">
            {editingMateriaPrima && (
              <MateriaPrimaForm 
                materiaPrima={{
                  sku: editingMateriaPrima["SKU Matéria-Prima"] || editingMateriaPrima.sku_materia_prima,
                  nome: editingMateriaPrima["Nome Matéria-Prima"] || editingMateriaPrima.nome_materia_prima,
                  categoria: editingMateriaPrima["Categoria MP"] || editingMateriaPrima.categoria_mp,
                  quantidade: editingMateriaPrima["Quantidade Atual"] || editingMateriaPrima.quantidade_mp,
                  unidade_medida: editingMateriaPrima["Unidade de Medida"] || editingMateriaPrima.unidade_mp,
                  custo_unitario: editingMateriaPrima["Custo Unitário"] || editingMateriaPrima.custo_unitario_mp
                }}
                onSuccess={() => {
                  setEditingMateriaPrima(null);
                  carregarMateriaPrima();
                }} 
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de detalhes do produto */}
        <ProductDetailsModal
          produto={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={(produto) => {
            setSelectedProduct(null);
            setEditingProduct(produto);
          }}
        />
      </div>
    </Layout>
  );
};

export default Estoque;
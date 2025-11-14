import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import Layout from "@/components/Layout";
import { ProductsDataTable } from "@/components/tables/ProductsDataTable";
import { RawMaterialsDataTable } from "@/components/tables/RawMaterialsDataTable";
import { Plus, Package, RefreshCw, Settings, ArrowUp, MoreHorizontal, TrendingUp, TrendingDown, AlertTriangle, Download, Upload, Camera, Tag } from "lucide-react";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";
import ProdutoForm from "@/components/forms/ProdutoForm";
import * as XLSX from 'xlsx';
import { Input } from "@/components/ui/input";
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
  const [isImporting, setIsImporting] = useState(false);
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

  const exportarParaExcel = useCallback(() => {
    try {
      const dadosParaExportar = activeTab === "estoque"
        ? filteredProdutosAcabados.map(p => ({
          'SKU': p.SKU || p.sku || '',
          'Nome do Produto': p["Nome Produto"] || p.nome || '',
          'Categoria': p["Categoria"] || p.categoria || '',
          'Tipo': p["Tipo Produto"] || p.tipo_produto || '',
          'Quantidade': p["Quantidade Atual"] || p.quantidade || 0,
          'Unidade': p["Unidade de Medida"] || p.unidade_medida || '',
          'Preço Unitário': p["Preço Unitário"] || p.preco_unitario || 0,
          'Valor Total': (p["Quantidade Atual"] || p.quantidade || 0) * (p["Preço Unitário"] || p.preco_unitario || 0)
        }))
        : filteredMateriasPrimas.map(mp => ({
          'SKU': mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '',
          'Nome da Matéria-Prima': mp["Nome Matéria-Prima"] || mp.nome_materia_prima || '',
          'Categoria': mp["Categoria MP"] || mp.categoria_mp || '',
          'Quantidade': mp["Quantidade Atual"] || mp.quantidade_mp || 0,
          'Unidade': mp["Unidade de Medida"] || mp.unidade_mp || '',
          'Custo Unitário': mp["Custo Unitário"] || mp.custo_unitario_mp || 0,
          'Valor Total': (mp["Quantidade Atual"] || mp.quantidade_mp || 0) * (mp["Custo Unitário"] || mp.custo_unitario_mp || 0)
        }));

      if (dadosParaExportar.length === 0) {
        toast.warning("Nenhum dado para exportar");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTab === "estoque" ? "Produtos" : "Matéria-Prima");

      const fileName = activeTab === "estoque"
        ? `estoque_produtos_${new Date().toISOString().split('T')[0]}.xlsx`
        : `estoque_materiaprima_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast.success("Exportação concluída", {
        description: `${dadosParaExportar.length} itens exportados para ${fileName}`
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error("Erro ao exportar planilha");
    }
  }, [activeTab, filteredProdutosAcabados, filteredMateriasPrimas]);

  const importarDeExcel = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('📊 Dados importados:', jsonData);

      if (jsonData.length === 0) {
        toast.warning("Planilha vazia", {
          description: "Não há dados para importar"
        });
        setIsImporting(false);
        return;
      }

      // Determinar se é produtos ou matéria-prima baseado nas colunas
      const firstRow: any = jsonData[0];
      const isProduto = 'Nome do Produto' in firstRow || 'Nome Produto' in firstRow;
      const isMateriaPrima = 'Nome da Matéria-Prima' in firstRow || 'Nome Matéria-Prima' in firstRow;

      let sucessos = 0;
      let erros = 0;
      const errosDetalhados: string[] = [];

      if (isProduto) {
        // Importar produtos
        for (const row of jsonData as any[]) {
          try {
            const sku = row.SKU || row.sku;

            const payload = {
              sku: sku,  // Adicionar SKU no payload
              nome_produto: row['Nome do Produto'] || row['Nome Produto'] || row.nome,
              categoria: row.Categoria || row.categoria,
              tipo_produto: row.Tipo || row['Tipo Produto'] || row.tipo_produto,
              quantidade_atual: Number(row.Quantidade || row['Quantidade Atual'] || row.quantidade || 0),
              unidade_medida: row.Unidade || row['Unidade de Medida'] || row.unidade_medida,
              preco_unitario: Number(row['Preço Unitário'] || row.preco_unitario || 0),
              componentes: [] // Array vazio para produtos simples
            };

            // Validação básica
            if (!sku) {
              errosDetalhados.push(`Linha sem SKU: ${JSON.stringify(row)}`);
              erros++;
              continue;
            }

            // Tentar PUT primeiro (atualizar), se falhar, usar POST (criar)
            let response = await fetch(`/api/estoque/${sku}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            // Se retornou 404, produto não existe, então criar
            if (response.status === 404) {
              console.log(`ℹ️ ${sku}: Não existe, criando novo produto...`);
              response = await fetch('/api/estoque', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            }

            if (response.ok) {
              sucessos++;
              const result = await response.json();
              console.log(`✅ ${sku}: Sucesso`, result);
            } else {
              const contentType = response.headers.get('content-type');
              let errorMsg = `Status ${response.status}`;

              try {
                if (contentType?.includes('application/json')) {
                  const errorData = await response.json();
                  errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
                  console.error(`❌ ${sku}: JSON Error`, errorData);
                } else {
                  const textError = await response.text();
                  errorMsg = textError.substring(0, 200);
                  console.error(`❌ ${sku}: Text Error`, textError);
                }
              } catch (e) {
                errorMsg = `Erro ao processar resposta: ${response.statusText}`;
                console.error(`❌ ${sku}: Parse Error`, e);
              }

              errosDetalhados.push(`${sku}: ${errorMsg}`);
              erros++;
            }
          } catch (error: any) {
            errosDetalhados.push(`${row.SKU || 'SKU desconhecido'}: ${error.message}`);
            erros++;
          }
        }
      } else if (isMateriaPrima) {
        // Importar matéria-prima
        for (const row of jsonData as any[]) {
          try {
            const sku = row.SKU || row.sku;

            const payload = {
              id_materia_prima: sku, // Usar SKU como ID se não tiver ID específico
              sku_materia_prima: sku, // Adicionar SKU também
              nome_materia_prima: row['Nome da Matéria-Prima'] || row['Nome Matéria-Prima'] || row.nome,
              categoria: row.Categoria || row.categoria,
              quantidade_atual: Number(row.Quantidade || row['Quantidade Atual'] || row.quantidade || 0),
              unidade_medida: row.Unidade || row['Unidade de Medida'] || row.unidade_medida,
              preco_unitario: Number(row['Custo Unitário'] || row.preco_unitario || 0)
            };

            // Validação básica
            if (!sku) {
              errosDetalhados.push(`Linha sem SKU: ${JSON.stringify(row)}`);
              erros++;
              continue;
            }

            // Tentar PUT primeiro (atualizar), se falhar, usar POST (criar)
            let response = await fetch(`/api/materia-prima/${sku}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            // Se retornou 404, matéria-prima não existe, então criar
            if (response.status === 404) {
              console.log(`ℹ️ MP ${sku}: Não existe, criando nova matéria-prima...`);
              response = await fetch('/api/materia-prima', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            }

            if (response.ok) {
              sucessos++;
              const result = await response.json();
              console.log(`✅ MP ${sku}: Sucesso`, result);
            } else {
              const contentType = response.headers.get('content-type');
              let errorMsg = `Status ${response.status}`;

              try {
                if (contentType?.includes('application/json')) {
                  const errorData = await response.json();
                  errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
                  console.error(`❌ MP ${sku}: JSON Error`, errorData);
                } else {
                  const textError = await response.text();
                  errorMsg = textError.substring(0, 200);
                  console.error(`❌ MP ${sku}: Text Error`, textError);
                }
              } catch (e) {
                errorMsg = `Erro ao processar resposta: ${response.statusText}`;
                console.error(`❌ MP ${sku}: Parse Error`, e);
              }

              errosDetalhados.push(`${sku}: ${errorMsg}`);
              erros++;
            }
          } catch (error: any) {
            errosDetalhados.push(`${row.SKU || 'SKU desconhecido'}: ${error.message}`);
            erros++;
          }
        }
      } else {
        toast.error("Formato não reconhecido", {
          description: "A planilha deve ter as colunas corretas para Produtos ou Matéria-Prima"
        });
        setIsImporting(false);
        return;
      }

      // Exibir resultado
      if (errosDetalhados.length > 0) {
        console.error('❌ Erros na importação:', errosDetalhados);
      }

      if (sucessos > 0) {
        toast.success("Importação concluída", {
          description: `${sucessos} itens atualizados${erros > 0 ? `, ${erros} com erro` : ''}`
        });

        // Recarregar dados
        if (isProduto) {
          refreshProducts();
        } else {
          carregarMateriaPrima();
        }
      } else {
        toast.error("Falha na importação", {
          description: `${erros} erros encontrados. Verifique o console para detalhes.`
        });
      }

    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error("Erro ao processar planilha", {
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsImporting(false);
      // Limpar o input para permitir reimportar o mesmo arquivo
      event.target.value = '';
    }
  }, [refreshProducts, carregarMateriaPrima]);

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
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/fotos-produtos')}
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              Gerenciar Fotos
            </Button>
            <div className="relative">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={importarDeExcel}
                disabled={isImporting}
                className="hidden"
                id="import-excel"
              />
              <label htmlFor="import-excel">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isImporting}
                  className="gap-2 cursor-pointer"
                  asChild
                >
                  <span>
                    <Upload className={`w-4 h-4 ${isImporting ? 'animate-bounce' : ''}`} />
                    {isImporting ? 'Importando...' : 'Importar Excel'}
                  </span>
                </Button>
              </label>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={exportarParaExcel}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>

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
          <Badge variant="outline" className="flex-shrink-0">
            Filtros:
          </Badge>

          {/* Filtro de Quantidade (mantém select único pois são estados, não valores) */}
          <Select value={filters.quantity} onValueChange={setQuantityFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por quantidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              <SelectItem value="sem-estoque">Sem estoque (0)</SelectItem>
              <SelectItem value="estoque-baixo">Estoque baixo (&lt;10)</SelectItem>
              <SelectItem value="em-estoque">Em estoque (≥10)</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro múltiplo de Categorias */}
          <MultiSelectFilter
            label="Categoria"
            icon={Tag}
            options={categorias}
            selectedValues={filters.category === 'todas' ? [] : filters.category.split(',').filter(Boolean)}
            onChange={(values) => setCategoryFilter(values.length === 0 ? 'todas' : values.join(','))}
            placeholder="Categorias"
            className="w-[200px]"
          />

          {/* Filtro múltiplo de Tipos */}
          <MultiSelectFilter
            label="Tipo"
            icon={Package}
            options={tipos}
            selectedValues={filters.type === 'todos' ? [] : filters.type.split(',').filter(Boolean)}
            onChange={(values) => setTypeFilter(values.length === 0 ? 'todos' : values.join(','))}
            placeholder="Tipos"
            className="w-[200px]"
          />
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
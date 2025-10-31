import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModernDataTable, Column } from "@/components/tables/ModernDataTable";
import { Package, TrendingUp, TrendingDown, Calendar, Edit } from "lucide-react";
import { consultarDados } from "@/services/n8nIntegration";
import { toast } from "sonner";
import { toNumber, formatCurrency } from "@/utils/formatters";

interface ProdutoAcabado {
  sku?: string;
  nome?: string;
  categoria?: string;
  tipo_produto?: string;
  quantidade?: number;
  unidade_medida?: string;
  preco_unitario?: number;
  SKU?: string;
  "Nome Produto"?: string;
  "Categoria"?: string;
  "Tipo Produto"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Preço Unitário"?: number;
}

interface MovimentacaoEstoque {
  id?: string;
  sku?: string;
  tipo?: string;
  quantidade?: number;
  data?: string;
  motivo?: string;
  usuario?: string;
  [key: string]: any;
}

interface ProductDetailsModalProps {
  produto: ProdutoAcabado | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (produto: ProdutoAcabado) => void;
}

const parseDateLocal = (s: any): Date | null => {
  if (!s) return null;
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const str = String(s);
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  produto,
  isOpen,
  onClose,
  onEdit
}) => {
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sku = produto?.SKU || produto?.sku;
  const nome = produto?.["Nome Produto"] || produto?.nome;
  const categoria = produto?.["Categoria"] || produto?.categoria;
  const tipo = produto?.["Tipo Produto"] || produto?.tipo_produto;
  const quantidade = toNumber(produto?.["Quantidade Atual"] ?? produto?.quantidade);
  const unidade = produto?.["Unidade de Medida"] || produto?.unidade_medida;
  const preco = toNumber(produto?.["Preço Unitário"] ?? produto?.preco_unitario);

  useEffect(() => {
    if (isOpen && sku) {
      carregarDadosProduto();
    }
  }, [isOpen, sku]);

  const carregarDadosProduto = async () => {
    if (!sku) return;
    
    setIsLoading(true);
    try {
      // Carregar movimentações de estoque
      const dadosMovimentacoes = await consultarDados('Movimentacoes_Estoque');
      const movimentacoesProduto = (dadosMovimentacoes || []).filter(
        (mov: any) => mov.SKU === sku || mov.sku === sku
      );
      setMovimentacoes(movimentacoesProduto);

      // Carregar vendas do produto
      const dadosVendas = await consultarDados('Vendas');
      const vendasProduto = (dadosVendas || []).filter((venda: any) => 
        venda.items?.some((item: any) => item["SKU Produto"] === sku)
      ).map((venda: any) => ({
        ...venda,
        item_produto: venda.items?.find((item: any) => item["SKU Produto"] === sku)
      }));
      setVendas(vendasProduto);

    } catch (error) {
      console.error('Erro ao carregar dados do produto:', error);
      toast.error("Erro ao carregar histórico do produto");
    } finally {
      setIsLoading(false);
    }
  };

  const movimentacoesColumns: Column<MovimentacaoEstoque>[] = [
    {
      key: 'data',
      label: 'Data',
      sortable: true,
      render: (value) => parseDateLocal(value)?.toLocaleDateString('pt-BR') || '-'
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value) => (
        <Badge variant={value === 'Entrada' ? 'default' : 'destructive'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'quantidade',
      label: 'Quantidade',
      sortable: true,
      render: (value) => Number(value || 0).toString()
    },
    {
      key: 'motivo',
      label: 'Motivo',
      render: (value) => value || '-'
    },
    {
      key: 'usuario',
      label: 'Usuário',
      render: (value) => value || '-'
    }
  ];

  const vendasColumns: Column<any>[] = [
    {
      key: 'Data Venda',
      label: 'Data',
      sortable: true,
      render: (value) => parseDateLocal(value)?.toLocaleDateString('pt-BR') || '-'
    },
    {
      key: 'Nome Cliente',
      label: 'Cliente',
      render: (value) => value || '-'
    },
    {
      key: 'item_produto',
      label: 'Quantidade',
      render: (value) => value?.["Quantidade Vendida"] || '-'
    },
    {
      key: 'item_produto',
      label: 'Valor Unit.',
      render: (value) => formatCurrency(toNumber(value?.["Preço Unitário"]))
    },
    {
      key: 'item_produto',
      label: 'Total',
      render: (value) => {
        const qty = toNumber(value?.["Quantidade Vendida"]);
        const price = toNumber(value?.["Preço Unitário"]);
        return formatCurrency(qty * price);
      }
    }
  ];

  const totalEntradas = movimentacoes
    .filter(m => m.tipo === 'Entrada')
    .reduce((acc, m) => acc + (Number(m.quantidade) || 0), 0);

  const totalSaidas = movimentacoes
    .filter(m => m.tipo === 'Saída')
    .reduce((acc, m) => acc + (Number(m.quantidade) || 0), 0);

  const totalVendido = vendas.reduce((acc, venda) => 
    acc + (Number(venda.item_produto?.["Quantidade Vendida"]) || 0), 0);

  if (!produto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Produto: {nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">SKU</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{sku}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg">{categoria || '-'}</p>
                <p className="text-sm text-muted-foreground">{tipo || '-'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Estoque Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{quantidade}</p>
                <p className="text-sm text-muted-foreground">{unidade || 'un'}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Preço Unitário</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(preco)}</p>
                <p className="text-sm text-muted-foreground">
                  Total: {formatCurrency(quantidade * preco)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Estatísticas de movimentação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Total Entradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-green-600">{totalEntradas}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Total Saídas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-red-600">{totalSaidas}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  Total Vendido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-blue-600">{totalVendido}</p>
              </CardContent>
            </Card>
          </div>

          {/* Histórico em abas */}
          <Tabs defaultValue="movimentacoes" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="movimentacoes">
                Movimentações ({movimentacoes.length})
              </TabsTrigger>
              <TabsTrigger value="vendas">
                Vendas ({vendas.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="movimentacoes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Movimentações</CardTitle>
                </CardHeader>
                <CardContent>
                  <ModernDataTable
                    data={movimentacoes}
                    columns={movimentacoesColumns}
                    loading={isLoading}
                    emptyMessage="Nenhuma movimentação encontrada"
                    pageSize={10}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendas" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Vendas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ModernDataTable
                    data={vendas}
                    columns={vendasColumns}
                    loading={isLoading}
                    emptyMessage="Nenhuma venda encontrada"
                    pageSize={10}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Ações */}
          <div className="flex justify-end gap-2">
            {onEdit && (
              <Button onClick={() => onEdit(produto)} variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Editar Produto
              </Button>
            )}
            <Button onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
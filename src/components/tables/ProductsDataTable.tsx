import { useState, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { API_BASE_URL } from "@/config/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Edit, Trash2, MoreHorizontal, Package, Search } from "lucide-react";
import { excluirProduto } from "@/services/n8nIntegration";
import { toast } from "sonner";
import { formatCurrencyAbbreviated, formatQuantity } from "@/utils/formatters";
import { sortBySKU } from "@/utils/sortUtils";

interface ProdutoAcabado {
  sku?: string;
  nome?: string;
  categoria?: string;
  tipo_produto?: string;
  quantidade?: number;
  unidade_medida?: string;
  preco_unitario?: number;
  foto_url?: string;
  SKU?: string;
  "Nome Produto"?: string;
  "Categoria"?: string;
  "Tipo Produto"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Preço Unitário"?: number;
}

interface ProductsDataTableProps {
  produtos: ProdutoAcabado[];
  onEdit: (produto: ProdutoAcabado) => void;
  onRefresh: () => void;
  onViewDetails?: (produto: ProdutoAcabado) => void;
}

const ProductsDataTableComponent = ({
  produtos,
  onEdit,
  onRefresh,
  onViewDetails,
}: ProductsDataTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteProduct, setDeleteProduct] = useState<ProdutoAcabado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredProducts = useMemo(() => {
    const filtered = produtos.filter((produto) => {
      const sku = produto.sku || produto.SKU || "";
      const nome = produto.nome || produto["Nome Produto"] || "";
      const categoria = produto.categoria || produto["Categoria"] || "";
      const search = debouncedSearch.toLowerCase();

      return (
        sku.toLowerCase().includes(search) ||
        nome.toLowerCase().includes(search) ||
        categoria.toLowerCase().includes(search)
      );
    });

    // Ordenar por SKU usando natural sort
    return sortBySKU(filtered, (p) => p.sku || p.SKU || "");
  }, [produtos, debouncedSearch]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  const handleDelete = async (produto: ProdutoAcabado) => {
    setIsDeleting(true);
    try {
      const sku = produto.sku || produto.SKU || "";
      const success = await excluirProduto(sku);

      if (success) {
        toast.success("Produto excluído com sucesso!");
        onRefresh();
      } else {
        toast.error("Erro ao excluir produto");
      }
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      toast.error("Erro inesperado ao excluir produto");
    } finally {
      setIsDeleting(false);
      setDeleteProduct(null);
    }
  };

  const getQuantityBadgeVariant = (quantidade: number) => {
    if (quantidade < 5) return "destructive";
    if (quantidade < 10) return "secondary";
    return "default";
  };

  const calculateTotalValue = (quantidade: number | string, preco: number | string) => {
    const qty = Number(quantidade) || 0;
    const price = Number(preco) || 0;
    return qty * price;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="px-3 py-1">
            {filteredProducts.length} produtos
          </Badge>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Foto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Nome Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? "Nenhum produto encontrado para a busca"
                          : "Nenhum produto cadastrado"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((produto, index) => {
                  const sku = produto.sku || produto.SKU || "";
                  const nome = produto.nome || produto["Nome Produto"] || "";
                  const categoria = produto.categoria || produto["Categoria"] || "";
                  const tipo = produto.tipo_produto || produto["Tipo Produto"] || "";
                  const quantidade = Number(produto.quantidade || produto["Quantidade Atual"]) || 0;
                  const unidade = produto.unidade_medida || produto["Unidade de Medida"] || "";
                  const preco = Number(produto.preco_unitario || produto["Preço Unitário"]) || 0;
                  const valorTotal = calculateTotalValue(quantidade, preco);
                  const foto_url = produto.foto_url;

                  return (
                    <TableRow key={sku || index} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewDetails?.(produto)}>
                      {/* Coluna de Foto */}
                      <TableCell>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                          {foto_url ? (
                            <img
                              src={`${API_BASE_URL}${foto_url}`}
                              alt={sku}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                              {sku.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{sku}</TableCell>
                      <TableCell className="font-medium">{nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{tipo}</span>
                          {tipo === "KIT" && (
                            <Badge variant="secondary" className="text-xs">
                              <Package className="w-3 h-3 mr-1" />
                              KIT
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {tipo === "KIT" ? (
                          <Badge variant="outline" className="text-xs font-medium">
                            Calculado
                          </Badge>
                        ) : (
                          <Badge
                            variant={getQuantityBadgeVariant(quantidade)}
                            className="text-xs font-medium"
                          >
                            {quantidade}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {unidade}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyAbbreviated(preco)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrencyAbbreviated(valorTotal)}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onViewDetails && (
                              <DropdownMenuItem onClick={() => onViewDetails(produto)}>
                                <Package className="mr-2 h-4 w-4" />
                                Ver Detalhes
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onEdit(produto)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteProduct(produto)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <AlertDialog
        open={!!deleteProduct}
        onOpenChange={() => setDeleteProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto{" "}
              <strong>
                {deleteProduct?.nome || deleteProduct?.["Nome Produto"]}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && handleDelete(deleteProduct)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const ProductsDataTable = memo(ProductsDataTableComponent);
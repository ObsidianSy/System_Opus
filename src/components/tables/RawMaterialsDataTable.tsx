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
import { excluirMateriaPrima } from "@/services/n8nIntegration";
import { toast } from "sonner";
import { sortBySKU } from "@/utils/sortUtils";

interface MateriaPrima {
  sku_materia_prima?: string;
  nome_materia_prima?: string;
  categoria_mp?: string;
  quantidade_mp?: number;
  unidade_mp?: string;
  custo_unitario_mp?: number;
  "SKU Matéria-Prima"?: string;
  "Nome Matéria-Prima"?: string;
  "Categoria MP"?: string;
  "Quantidade Atual"?: number;
  "Unidade de Medida"?: string;
  "Custo Unitário"?: number;
}

interface RawMaterialsDataTableProps {
  materiasPrimas: MateriaPrima[];
  onEdit: (materiaPrima: MateriaPrima) => void;
  onRefresh: () => void;
}

const RawMaterialsDataTableComponent = ({
  materiasPrimas,
  onEdit,
  onRefresh,
}: RawMaterialsDataTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteItem, setDeleteItem] = useState<MateriaPrima | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const debouncedSearch = useDebounce(searchTerm, 300);

  const filteredItems = useMemo(() => {
    const filtered = materiasPrimas.filter((item) => {
      const sku = item.sku_materia_prima || item["SKU Matéria-Prima"] || "";
      const nome = item.nome_materia_prima || item["Nome Matéria-Prima"] || "";
      const categoria = item.categoria_mp || item["Categoria MP"] || "";
      const search = debouncedSearch.toLowerCase();

      return (
        sku.toLowerCase().includes(search) ||
        nome.toLowerCase().includes(search) ||
        categoria.toLowerCase().includes(search)
      );
    });
    
    // Ordenar por SKU usando natural sort
    return sortBySKU(filtered, (item) => 
      item.sku_materia_prima || item["SKU Matéria-Prima"] || ""
    );
  }, [materiasPrimas, debouncedSearch]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handleDelete = async (item: MateriaPrima) => {
    setIsDeleting(true);
    try {
      const sku = item.sku_materia_prima || item["SKU Matéria-Prima"] || "";
      const success = await excluirMateriaPrima(sku);
      
      if (success) {
        toast.success("Matéria-prima excluída com sucesso!");
        onRefresh();
      } else {
        toast.error("Erro ao excluir matéria-prima");
      }
    } catch (error) {
      console.error("Erro ao excluir matéria-prima:", error);
      toast.error("Erro inesperado ao excluir matéria-prima");
    } finally {
      setIsDeleting(false);
      setDeleteItem(null);
    }
  };

  const getQuantityBadgeVariant = (quantidade: number) => {
    if (quantidade < 5) return "destructive";
    if (quantidade < 10) return "secondary";
    return "default";
  };

  const calculateTotalValue = (quantidade: number | string, custo: number | string) => {
    const qty = Number(quantidade) || 0;
    const cost = Number(custo) || 0;
    return qty * cost;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar matéria-prima..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="px-3 py-1">
            {filteredItems.length} itens
          </Badge>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Nome Matéria-Prima</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {searchTerm
                          ? "Nenhuma matéria-prima encontrada para a busca"
                          : "Nenhuma matéria-prima cadastrada"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, index) => {
                  const sku = item.sku_materia_prima || item["SKU Matéria-Prima"] || "";
                  const nome = item.nome_materia_prima || item["Nome Matéria-Prima"] || "";
                  const categoria = item.categoria_mp || item["Categoria MP"] || "";
                  const quantidade = item.quantidade_mp || item["Quantidade Atual"] || 0;
                  const unidade = item.unidade_mp || item["Unidade de Medida"] || "";
                  const custo = item.custo_unitario_mp || item["Custo Unitário"] || 0;
                  const valorTotal = calculateTotalValue(quantidade, custo);

                  return (
                    <TableRow key={sku || index}>
                      <TableCell className="font-mono text-sm">{sku}</TableCell>
                      <TableCell className="font-medium">{nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={getQuantityBadgeVariant(quantidade)}
                          className="text-xs font-medium"
                        >
                          {quantidade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {unidade}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {Number(custo || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        R$ {Number(valorTotal || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(item)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteItem(item)}
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
        open={!!deleteItem}
        onOpenChange={() => setDeleteItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a matéria-prima{" "}
              <strong>
                {deleteItem?.nome_materia_prima || deleteItem?.["Nome Matéria-Prima"]}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && handleDelete(deleteItem)}
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

export const RawMaterialsDataTable = memo(RawMaterialsDataTableComponent);
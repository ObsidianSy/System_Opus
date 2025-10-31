import { useFullData } from "@/hooks/useFullData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const RelacionadosTab = () => {
  const { relacionados, isLoadingRelacionados, emitir, isEmitindo } =
    useFullData();

  const handleEmitir = (envioId: number) => {
    emitir(envioId);
  };

  if (isLoadingRelacionados) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!relacionados || relacionados.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          Nenhum item relacionado encontrado
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Envio</TableHead>
              <TableHead>SKU Texto</TableHead>
              <TableHead>SKU Matched</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {relacionados.map((item) => (
              <TableRow key={item.full_raw_id}>
                <TableCell className="font-medium">{item.envio_num}</TableCell>
                <TableCell>{item.sku_texto}</TableCell>
                <TableCell className="font-mono text-sm">
                  {item.matched_sku}
                </TableCell>
                <TableCell>{item.envio_status}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEmitir(item.envio_id)}
                    disabled={isEmitindo}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Emitir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

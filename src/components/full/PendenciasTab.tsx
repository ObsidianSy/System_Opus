import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Link } from "lucide-react";
import { RelacionarSkuDialog } from "./RelacionarSkuDialog";
import { Skeleton } from "@/components/ui/skeleton";

export const PendenciasTab = () => {
  const { pendencias, isLoadingPendencias } = useFullData();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRelacionar = (item: any) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  if (isLoadingPendencias) {
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

  if (!pendencias || pendencias.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">
          Nenhuma pendência de SKU encontrada
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Envio</TableHead>
                <TableHead>SKU Texto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendencias.map((item) => (
                <TableRow key={item.full_raw_id}>
                  <TableCell className="font-medium">
                    {item.envio_num}
                  </TableCell>
                  <TableCell>{item.sku_texto}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{item.status_match}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRelacionar(item)}
                    >
                      <Link className="mr-2 h-4 w-4" />
                      Relacionar SKU
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {selectedItem && (
        <RelacionarSkuDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          item={selectedItem}
        />
      )}
    </>
  );
};

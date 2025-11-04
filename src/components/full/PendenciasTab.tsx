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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, AlertCircle, Package } from "lucide-react";
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
        <Package className="h-12 w-12 mx-auto text-green-500 mb-4" />
        <p className="text-lg font-semibold">Tudo OK!</p>
        <p className="text-muted-foreground mt-2">
          Nenhuma pendência de SKU encontrada
        </p>
      </Card>
    );
  }

  // Agrupar por envio
  const groupedByEnvio = pendencias.reduce((acc: any, item) => {
    if (!acc[item.envio_num]) {
      acc[item.envio_num] = {
        envio_num: item.envio_num,
        envio_id: item.envio_id,
        items: []
      };
    }
    acc[item.envio_num].items.push(item);
    return acc;
  }, {});

  const envios = Object.values(groupedByEnvio);

  return (
    <>
      <div className="space-y-4">
        {/* Alerta */}
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-900">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-100">
                  Atenção: {pendencias.length} {pendencias.length === 1 ? 'SKU pendente' : 'SKUs pendentes'}
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Relacione os SKUs abaixo para poder emitir os envios
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards por envio */}
        {envios.map((envio: any) => {
          const totalPendentes = envio.items.length;

          return (
            <Card key={envio.envio_num} className="border-orange-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      Envio #{envio.envio_num}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {totalPendentes} {totalPendentes === 1 ? 'item' : 'itens'} aguardando relacionamento
                    </p>
                  </div>

                  <Badge variant="destructive" className="text-base px-4 py-2">
                    {totalPendentes} Pendente{totalPendentes !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Código ML</TableHead>
                      <TableHead>SKU Texto</TableHead>
                      <TableHead className="text-center w-[80px]">Qtd</TableHead>
                      <TableHead className="text-center w-[100px]">Status</TableHead>
                      <TableHead className="text-right w-[180px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {envio.items.map((item: any) => (
                      <TableRow key={item.full_raw_id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {item.codigo_ml || '-'}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{item.sku_texto}</span>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {item.qtd || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="w-full justify-center">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Pendente
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleRelacionar(item)}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Link className="mr-2 h-4 w-4" />
                            Relacionar SKU
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

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

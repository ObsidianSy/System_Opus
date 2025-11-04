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
import { Send, Package, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Nenhum item relacionado encontrado
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Relacione os SKUs pendentes primeiro
        </p>
      </Card>
    );
  }

  // Agrupar por envio
  const groupedByEnvio = relacionados.reduce((acc: any, item) => {
    if (!acc[item.envio_num]) {
      acc[item.envio_num] = {
        envio_num: item.envio_num,
        envio_id: item.envio_id,
        envio_status: item.envio_status,
        items: []
      };
    }
    acc[item.envio_num].items.push(item);
    return acc;
  }, {});

  const envios = Object.values(groupedByEnvio);

  return (
    <div className="space-y-4">
      {envios.map((envio: any) => {
        const totalItems = envio.items.length;

        return (
          <Card key={envio.envio_num}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Envio #{envio.envio_num}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalItems} {totalItems === 1 ? 'item relacionado' : 'itens relacionados'} • Pronto para emitir
                  </p>
                </div>

                <Button
                  onClick={() => handleEmitir(envio.envio_id)}
                  disabled={isEmitindo}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Emitir Envio
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Código ML</TableHead>
                    <TableHead>SKU Texto</TableHead>
                    <TableHead>SKU Estoque</TableHead>
                    <TableHead className="text-center w-[80px]">Qtd</TableHead>
                    <TableHead className="text-center w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envio.items.map((item: any) => (
                    <TableRow key={item.full_raw_id}>
                      <TableCell className="font-mono text-sm font-medium">
                        {item.codigo_ml || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.sku_texto}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm font-semibold bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                          {item.matched_sku}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {item.qtd || 0}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="w-full justify-center bg-green-600">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          OK
                        </Badge>
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
  );
};

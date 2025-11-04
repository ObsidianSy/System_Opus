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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Search, RefreshCw, Package, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const TodosTab = () => {
  const [envioNum, setEnvioNum] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [matchFilter, setMatchFilter] = useState("all");
  const { todos, isLoadingTodos, refreshTodos } = useFullData(envioNum);

  const handleSearch = () => {
    refreshTodos();
  };

  const handleClear = () => {
    setEnvioNum("");
    setStatusFilter("all");
    setMatchFilter("all");
    setTimeout(refreshTodos, 100);
  };

  // Filtrar dados
  const filteredTodos = todos?.filter((item) => {
    if (statusFilter !== "all" && item.envio_status !== statusFilter) return false;
    if (matchFilter !== "all" && item.status_match !== matchFilter) return false;
    return true;
  }) || [];

  // Agrupar por envio
  const groupedByEnvio = filteredTodos.reduce((acc: any, item) => {
    if (!acc[item.envio_num]) {
      acc[item.envio_num] = {
        envio_num: item.envio_num,
        envio_id: item.envio_id,
        envio_status: item.envio_status,
        is_emitted: item.is_emitted,
        items: []
      };
    }
    acc[item.envio_num].items.push(item);
    return acc;
  }, {});

  const envios = Object.values(groupedByEnvio);

  if (isLoadingTodos) {
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

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Input
              placeholder="Código do envio"
              value={envioNum}
              onChange={(e) => setEnvioNum(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status do Envio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="registrado">Registrado</SelectItem>
                <SelectItem value="em_processamento">Em Processamento</SelectItem>
              </SelectContent>
            </Select>

            <Select value={matchFilter} onValueChange={setMatchFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status Match" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="matched">Relacionado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button onClick={handleSearch} className="flex-1">
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
              <Button onClick={handleClear} variant="outline">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {!filteredTodos || filteredTodos.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum item encontrado</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Cards por envio */}
          {envios.map((envio: any) => {
            const totalItems = envio.items.length;
            const pendentes = envio.items.filter((i: any) => i.status_match === 'pending').length;
            const relacionados = totalItems - pendentes;

            return (
              <Card key={envio.envio_num}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <CardTitle className="text-xl">Envio #{envio.envio_num}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {totalItems} {totalItems === 1 ? 'item' : 'itens'} total
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Badge variant={envio.is_emitted ? "default" : "secondary"}>
                          {envio.is_emitted ? (
                            <><CheckCircle className="mr-1 h-3 w-3" /> Emitido</>
                          ) : (
                            <><XCircle className="mr-1 h-3 w-3" /> Não Emitido</>
                          )}
                        </Badge>

                        <Badge variant="outline">
                          {envio.envio_status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{relacionados}</div>
                        <div className="text-muted-foreground">Relacionados</div>
                      </div>
                      {pendentes > 0 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{pendentes}</div>
                          <div className="text-muted-foreground">Pendentes</div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Código ML</TableHead>
                        <TableHead>SKU Texto</TableHead>
                        <TableHead>SKU Relacionado</TableHead>
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
                          <TableCell>{item.sku_texto}</TableCell>
                          <TableCell>
                            {item.matched_sku ? (
                              <span className="font-mono text-sm bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                                {item.matched_sku}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {item.qtd || 0}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.status_match === "pending" ? (
                              <Badge variant="destructive" className="w-full justify-center">
                                <AlertCircle className="mr-1 h-3 w-3" />
                                Pendente
                              </Badge>
                            ) : (
                              <Badge variant="default" className="w-full justify-center bg-green-600">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                OK
                              </Badge>
                            )}
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
      )}
    </div>
  );
};

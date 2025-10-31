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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Search, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const TodosTab = () => {
  const [envioNum, setEnvioNum] = useState("");
  const { todos, isLoadingTodos, refreshTodos } = useFullData(envioNum);

  const handleSearch = () => {
    refreshTodos();
  };

  const handleClear = () => {
    setEnvioNum("");
    setTimeout(refreshTodos, 100);
  };

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
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Código do envio (opcional)"
            value={envioNum}
            onChange={(e) => setEnvioNum(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} size="icon">
            <Search className="h-4 w-4" />
          </Button>
          <Button onClick={handleClear} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {!todos || todos.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhum item encontrado</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Envio</TableHead>
                  <TableHead>SKU Texto</TableHead>
                  <TableHead>SKU Matched</TableHead>
                  <TableHead>Status Match</TableHead>
                  <TableHead>Emitido</TableHead>
                  <TableHead>Status Envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todos.map((item) => (
                  <TableRow key={item.full_raw_id}>
                    <TableCell className="font-medium">{item.envio_num}</TableCell>
                    <TableCell>{item.sku_texto}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.matched_sku || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status_match === "pending"
                            ? "destructive"
                            : "default"
                        }
                      >
                        {item.status_match}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.is_emitted ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell>{item.envio_status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};

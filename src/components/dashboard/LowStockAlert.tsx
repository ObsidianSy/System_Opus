import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Package } from "lucide-react";

interface StockItem {
  sku: string;
  nome: string;
  quantidade: number;
  tipo: string;
}

interface LowStockAlertProps {
  items: StockItem[];
}

const LowStockAlert = ({ items }: LowStockAlertProps) => {
  const navigate = useNavigate();
  
  return (
    <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Alertas de Estoque
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Itens com baixa quantidade</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/estoque')}
          className="hover:bg-warning hover:text-white transition-colors"
        >
          Ver estoque
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <Package className="h-8 w-8 text-success" />
            </div>
            <p className="text-sm font-medium text-success">Estoque adequado</p>
            <p className="text-xs text-muted-foreground mt-1">Todos os itens com quantidade suficiente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20 hover:bg-warning/10 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-warning/30 to-warning/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Package className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                        {item.tipo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">SKU: {item.sku}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-lg font-bold text-warning">{item.quantidade}</p>
                  <p className="text-xs text-muted-foreground">unidades</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LowStockAlert;
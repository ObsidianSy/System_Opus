import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatCurrencyAbbreviated } from "@/utils/formatters";
import { ShoppingCart } from "lucide-react";

interface Sale {
  cliente: string;
  valor: number;
  data: string;
}

interface RecentSalesProps {
  sales: Sale[];
}

const RecentSales = ({ sales }: RecentSalesProps) => {
  const navigate = useNavigate();

  const parseDateLocal = (s: string) => {
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return null;
  };

  return (
    <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">Últimas Vendas</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Transações mais recentes</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/vendas')}
          className="hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          Ver todas
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma venda registrada</p>
            </div>
          ) : (
            sales.map((sale, index) => {
              const date = parseDateLocal(sale.data);
              const dateStr = date 
                ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                : 'Data inválida';
              
              return (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/10 transition-colors group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <ShoppingCart className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {sale.cliente}
                      </p>
                      <p className="text-xs text-muted-foreground">{dateStr}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-success">
                      {formatCurrencyAbbreviated(sale.valor)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentSales;
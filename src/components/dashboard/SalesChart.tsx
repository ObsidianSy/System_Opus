import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/utils/formatters";
import { TrendingUp } from "lucide-react";

interface Sale {
  "Data Venda": string;
  "Valor Total"?: number;
  "Valor Venda"?: number;
}

interface SalesChartProps {
  sales: Sale[];
}

const SalesChart = ({ sales }: SalesChartProps) => {
  const chartData = useMemo(() => {
    const parseDateLocal = (s: string) => {
      if (!s) return null;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
      return null;
    };

    const salesByDate = sales.reduce((acc: any, sale) => {
      const date = parseDateLocal(sale["Data Venda"]);
      if (!date) return acc;
      
      const dateKey = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const value = Number(sale["Valor Total"] ?? sale["Valor Venda"] ?? 0);
      
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, total: 0, count: 0 };
      }
      acc[dateKey].total += value;
      acc[dateKey].count += 1;
      
      return acc;
    }, {});

    return Object.values(salesByDate)
      .sort((a: any, b: any) => {
        const [dayA, monthA] = a.date.split('/');
        const [dayB, monthB] = b.date.split('/');
        return new Date(2025, Number(monthA) - 1, Number(dayA)).getTime() - 
               new Date(2025, Number(monthB) - 1, Number(dayB)).getTime();
      })
      .slice(-14); // últimos 14 dias
  }, [sales]);

  const totalSales = useMemo(() => 
    chartData.reduce((acc: number, day: any) => acc + day.total, 0), 
    [chartData]
  );

  return (
    <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Evolução de Vendas
          </CardTitle>
          <div className="flex items-center gap-2 text-success">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">{formatCurrency(Number(totalSales))}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0.3 }}/>
                <stop offset="95%" style={{ stopColor: "hsl(var(--primary))", stopOpacity: 0 }}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickLine={false}
              tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-card border border-border rounded-lg shadow-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">{payload[0].payload.date}</p>
                      <p className="text-sm font-semibold text-primary">
                        {formatCurrency(payload[0].value as number)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payload[0].payload.count} {payload[0].payload.count === 1 ? 'venda' : 'vendas'}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area 
              type="monotone" 
              dataKey="total" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              fill="url(#salesGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SalesChart;

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from "recharts";

interface VendasPorMesProps {
  data: {
    name: string;
    valor: number;
    qtd?: number;
  }[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const VendasPorMesChart = ({ data }: VendasPorMesProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Nenhum dado disponível</p>
          <p className="text-sm">Não há vendas no período selecionado</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 10, right: 24, left: 12, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" />
        <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
        <YAxis
          yAxisId="left"
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => formatCurrency(value as number)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#9ca3af"
          allowDecimals={false}
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          labelStyle={{ fontWeight: 600 }}
          formatter={(value: number, name: string) => {
            if (name === 'Faturamento') return [formatCurrency(value), name];
            if (name === 'Itens vendidos') return [value, name];
            return [value, name];
          }}
          contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', border: '1px solid #374151', color: '#e5e7eb' }}
        />
        <Legend wrapperStyle={{ paddingTop: 8 }} />
        <Bar
          yAxisId="left"
          dataKey="valor"
          name="Faturamento"
          fill="#6366F1"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        {data.some(d => typeof d.qtd === 'number') && (
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="qtd"
            name="Itens vendidos"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        )}
        <Brush height={14} travellerWidth={8} stroke="#6b7280" />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default VendasPorMesChart;

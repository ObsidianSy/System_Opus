
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface VendasPorMesProps {
  data: {
    name: string;
    valor: number;
  }[];
}

const VendasPorMesChart = ({ data }: VendasPorMesProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value) => `R$ ${value}`} />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="valor" 
          name="Valor Total" 
          stroke="#8884d8" 
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default VendasPorMesChart;


import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface ProdutosMaisVendidosProps {
  data: {
    name: string;
    valor: number;
  }[];
}

const ProdutosMaisVendidosChart = ({ data }: ProdutosMaisVendidosProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar 
          dataKey="valor" 
          name="Quantidade" 
          fill="#8884d8" 
          barSize={20} 
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default ProdutosMaisVendidosChart;

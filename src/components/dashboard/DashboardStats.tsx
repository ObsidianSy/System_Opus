import { BarChart2, ShoppingCart, Package, Users } from "lucide-react";
import DashboardCard from "@/components/DashboardCard";

interface DashboardStatsProps {
  totalVendas: number;
  totalReceita: number;
  totalProdutos: number;
  totalClientes: number;
}

const DashboardStats = ({ totalVendas, totalReceita, totalProdutos, totalClientes }: DashboardStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <DashboardCard
        title="Vendas"
        value={totalVendas}
        subtitle="total registradas"
        icon={ShoppingCart}
        gradient="bg-gradient-to-br from-success/20 to-success/10"
        textColor="text-success"
      />
      
      <DashboardCard
        title="Faturamento"
        value={totalReceita}
        subtitle="total vendido"
        icon={BarChart2}
        gradient="bg-gradient-to-br from-primary/20 to-primary-glow/10"
        textColor="text-primary"
      />
      
      <DashboardCard
        title="Produtos"
        value={totalProdutos}
        subtitle="em estoque"
        icon={Package}
        gradient="bg-gradient-to-br from-warning/20 to-warning/10"
        textColor="text-warning"
      />
      
      <DashboardCard
        title="Clientes"
        value={totalClientes}
        subtitle="cadastrados"
        icon={Users}
        gradient="bg-gradient-to-br from-accent/30 to-accent/10"
        textColor="text-foreground"
      />
    </div>
  );
};

export default DashboardStats;
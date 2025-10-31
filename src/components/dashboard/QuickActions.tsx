import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BarChart2, ShoppingCart, Package, Users, CreditCard, Settings } from "lucide-react";

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Nova Venda",
      icon: ShoppingCart,
      path: "/vendas",
      gradient: "from-success to-success/80"
    },
    {
      label: "Estoque", 
      icon: Package,
      path: "/estoque",
      gradient: "from-primary to-primary-glow"
    },
    {
      label: "Clientes",
      icon: Users,
      path: "/clientes", 
      gradient: "from-accent to-accent/80",
      textColor: "text-foreground"
    },
    {
      label: "Receitas",
      icon: Settings,
      path: "/receita-produto",
      gradient: "from-secondary to-secondary/80"
    },
    {
      label: "Relatórios",
      icon: BarChart2,
      path: "/relatorios",
      gradient: "from-purple-500 to-purple-600"
    }
  ];

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4 text-foreground">Ações Rápidas</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((action) => (
          <Button 
            key={action.path}
            onClick={() => navigate(action.path)} 
            className={`h-16 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br ${action.gradient} hover:scale-105 hover:shadow-lg transition-all duration-300 border-0 text-white shadow-md ${action.textColor || ''}`}
          >
            <action.icon className="h-4 w-4" />
            <span className="text-xs font-medium leading-tight">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
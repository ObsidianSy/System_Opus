
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { formatCurrencyAbbreviated, formatAbbreviated } from "@/utils/formatters";

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  gradient: string;
  textColor: string;
}

const DashboardCard = ({ title, value, subtitle, icon: Icon, gradient, textColor }: DashboardCardProps) => {
  const formatValue = () => {
    if (typeof value === 'string') {
      return value;
    }
    
    if (title.toLowerCase().includes('faturamento') || title.toLowerCase().includes('total') || title.toLowerCase().includes('receita') || title.toLowerCase().includes('recebido') || title.toLowerCase().includes('aberto') || title.toLowerCase().includes('valor')) {
      return formatCurrencyAbbreviated(value);
    }
    
    return formatAbbreviated(value);
  };

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group">
      <div className={`absolute inset-0 ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
      <CardHeader className="relative flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all shadow-lg`}>
          <Icon className="h-5 w-5 text-white drop-shadow-sm"/>
        </div>
      </CardHeader>
      <CardContent className="relative pt-1">
        <div className={`text-3xl font-bold ${textColor} mb-1`}>
          {formatValue()}
        </div>
        <p className="text-xs text-muted-foreground/80">{subtitle}</p>
      </CardContent>
    </Card>
  );
};

export default DashboardCard;
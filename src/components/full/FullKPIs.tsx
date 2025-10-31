import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, CheckCircle, Send } from "lucide-react";
import { useFullData } from "@/hooks/useFullData";
import { Skeleton } from "@/components/ui/skeleton";

export const FullKPIs = () => {
  const { kpis, isLoadingKPIs } = useFullData();

  if (isLoadingKPIs) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: "Total Importado",
      value: kpis?.total || 0,
      icon: Package,
      color: "text-blue-500",
    },
    {
      title: "Pendentes de SKU",
      value: kpis?.pendentes || 0,
      icon: AlertCircle,
      color: "text-orange-500",
    },
    {
      title: "Relacionados (a emitir)",
      value: kpis?.relacionados || 0,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      title: "Emitidos",
      value: kpis?.emitidos || 0,
      icon: Send,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

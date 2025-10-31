import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingUp } from "lucide-react";

interface TopProduct {
  sku: string;
  nome: string;
  quantidadeVendida: number;
  categoria: string;
}

interface TopProductsCardProps {
  products: TopProduct[];
}

const TopProductsCard = ({ products }: TopProductsCardProps) => {
  const maxQuantity = Math.max(...products.map(p => p.quantidadeVendida), 1);

  return (
    <Card className="border-0 bg-gradient-to-br from-card to-card/50 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Top Produtos Vendidos
        </CardTitle>
        <p className="text-xs text-muted-foreground">Campeões de vendas do período</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma venda registrada</p>
          </div>
        ) : (
          products.map((product, index) => (
            <div key={product.sku} className="group hover:bg-accent/5 rounded-lg p-3 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg' : 
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-md' : 
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md' : 
                      'bg-muted text-muted-foreground'}
                  `}>
                    {index + 1}º
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {product.nome}
                      </h4>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {product.categoria}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-500"
                        style={{ width: `${(product.quantidadeVendida / maxQuantity) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-primary shrink-0">
                      {product.quantidadeVendida}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default TopProductsCard;

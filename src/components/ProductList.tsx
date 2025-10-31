import React from 'react';
import { ProductThumbnail } from '@/components/ProductThumbnail';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrency, formatQuantity } from '@/utils/formatters';

interface ProductListItem {
  sku?: string;
  nome?: string;
  quantidade?: number;
  preco?: number;
  valorTotal?: number;
  categoria?: string;
  imageUrl?: string;
  status?: string;
  cliente?: string;
  dataVenda?: string;
  [key: string]: any;
}

interface ProductListProps {
  items: ProductListItem[];
  className?: string;
  showThumbnails?: boolean;
  showQuantity?: boolean;
  showPrice?: boolean;
  showCategory?: boolean;
  showStatus?: boolean;
  showCustomer?: boolean;
  showDate?: boolean;
  onItemClick?: (item: ProductListItem) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  items,
  className,
  showThumbnails = true,
  showQuantity = true,
  showPrice = true,
  showCategory = false,
  showStatus = false,
  showCustomer = false,
  showDate = false,
  onItemClick
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum produto encontrado
      </div>
    );
  }

  const parseDateLocal = (s?: string) => {
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        const sku = item.sku || item.SKU || item['SKU Produto'];
        const nome = item.nome || item['Nome Produto'] || item.nome;
        const quantidade = item.quantidade || item['Quantidade Atual'] || item['Quantidade Vendida'];
        const preco = item.preco || item['Preço Unitário'] || item.preco_unitario;
        const valorTotal = item.valorTotal || item['Valor Total'];
        const categoria = item.categoria || item.Categoria;
        const status = item.status || (quantidade && quantidade <= 10 ? 'Baixo Estoque' : 'Normal');

        return (
          <div
            key={`${sku}-${index}`}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg glass-card hover:bg-muted/50 transition-colors",
              onItemClick && "cursor-pointer hover:scale-[1.01]"
            )}
            onClick={() => onItemClick?.(item)}
          >
            {/* Miniatura do produto */}
            {showThumbnails && (
              <ProductThumbnail
                sku={sku}
                nome={nome}
                imageUrl={item.imageUrl}
                size="md"
              />
            )}

            {/* Informações do produto */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-foreground truncate">
                    {nome || 'Nome não disponível'}
                  </h4>
                  {sku && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {sku}
                    </p>
                  )}
                </div>

                {/* Price / Total Value */}
                {showPrice && (preco || valorTotal) && (
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatCurrency(valorTotal || preco)}
                    </p>
                    {valorTotal && quantidade && Number(quantidade) > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {formatQuantity(quantidade)} × {formatCurrency(preco)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Linha inferior com badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {showQuantity && quantidade !== undefined && (
                  <Badge
                    variant={quantidade <= 10 ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    Qtd: {formatQuantity(quantidade)}
                  </Badge>
                )}

                 {showCategory && categoria && (
                   <Badge variant="outline" className="text-xs">
                     {categoria}
                   </Badge>
                 )}

                 {showStatus && status && (
                   <Badge
                     variant={status === 'Baixo Estoque' ? "destructive" : "secondary"}
                     className="text-xs"
                   >
                     {status}
                   </Badge>
                 )}

                 {showCustomer && item.cliente && (
                   <Badge variant="outline" className="text-xs">
                     Cliente: {item.cliente}
                   </Badge>
                 )}

                 {showDate && item.dataVenda && (
                   <Badge variant="secondary" className="text-xs">
                     {parseDateLocal(item.dataVenda)?.toLocaleDateString('pt-BR') ?? '-'}
                   </Badge>
                 )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
import React, { useState, useMemo } from 'react';
import { Package } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ProductThumbnailProps {
  sku?: string;
  nome?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTooltip?: boolean;
  onHover?: () => void;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10', 
  lg: 'w-12 h-12'
};

const tooltipSizeMap = {
  sm: 'w-24 h-24',
  md: 'w-32 h-32',
  lg: 'w-40 h-40'
};

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({
  sku = '',
  nome = '',
  imageUrl,
  size = 'sm',
  className,
  showTooltip = true,
  onHover
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Gerar inicial do produto para fallback
  const fallbackInitial = useMemo(() => {
    if (nome) return nome.charAt(0).toUpperCase();
    if (sku) return sku.charAt(0).toUpperCase();
    return 'P';
  }, [nome, sku]);

  const shouldShowImage = imageUrl && !imageError;
  const displayName = nome || sku || 'Produto';

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.();
  };

  const thumbnailContent = (
    <div
      className={cn(
        "relative rounded-md overflow-hidden flex items-center justify-center transition-all duration-200",
        sizeMap[size],
        shouldShowImage ? "bg-muted/30" : "bg-gradient-to-br from-primary/10 to-primary-glow/10",
        "hover:scale-105 hover:shadow-lg border border-border/50",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      {shouldShowImage ? (
        <img
          src={imageUrl}
          alt={displayName}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-200",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          {nome || sku ? (
            <span className={cn(
              "font-semibold text-primary",
              size === 'sm' && "text-xs",
              size === 'md' && "text-sm", 
              size === 'lg' && "text-base"
            )}>
              {fallbackInitial}
            </span>
          ) : (
            <Package className={cn(
              "text-primary/60",
              size === 'sm' && "w-4 h-4",
              size === 'md' && "w-5 h-5",
              size === 'lg' && "w-6 h-6"
            )} />
          )}
        </div>
      )}

      {/* Loading state */}
      {shouldShowImage && !imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-muted/50 animate-pulse flex items-center justify-center">
          <Package className="w-4 h-4 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );

  if (!showTooltip) {
    return thumbnailContent;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {thumbnailContent}
      </TooltipTrigger>
      <TooltipContent side="right" className="glass-card">
        <div className="flex flex-col items-center gap-2 p-2">
          {/* Imagem ampliada no tooltip */}
          <div className={cn(
            "relative rounded-md overflow-hidden flex items-center justify-center",
            tooltipSizeMap[size],
            shouldShowImage ? "bg-muted/30" : "bg-gradient-to-br from-primary/10 to-primary-glow/10",
            "border border-border/50"
          )}>
            {shouldShowImage ? (
              <img
                src={imageUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                {nome || sku ? (
                  <span className="text-2xl font-bold text-primary">
                    {fallbackInitial}
                  </span>
                ) : (
                  <Package className="w-8 h-8 text-primary/60" />
                )}
              </div>
            )}
          </div>
          
          {/* Info do produto */}
          <div className="text-center space-y-1">
            {nome && (
              <p className="text-sm font-medium text-foreground">{nome}</p>
            )}
            {sku && (
              <p className="text-xs text-muted-foreground font-mono">{sku}</p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
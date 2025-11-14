import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MultiSelectFilterProps {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  icon: Icon,
  options,
  selectedValues,
  onChange,
  placeholder = 'Selecione...',
  className,
  maxHeight = '300px'
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOption = (option: string) => {
    const newValues = selectedValues.includes(option)
      ? selectedValues.filter(v => v !== option)
      : [...selectedValues, option];
    onChange(newValues);
  };

  const toggleAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between glass-card border-primary/20 hover:border-primary/40",
            selectedValues.length > 0 && "border-primary/40",
            className
          )}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
            <span className="truncate">
              {selectedValues.length === 0
                ? placeholder
                : selectedValues.length === 1
                ? selectedValues[0]
                : `${selectedValues.length} selecionados`}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {selectedValues.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {selectedValues.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 glass-card" align="start">
        <div className="flex flex-col">
          {/* Cabeçalho com busca */}
          <div className="p-3 border-b border-border/50">
            <Input
              placeholder={`Buscar ${label.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center justify-between p-2 border-b border-border/50 bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              className="h-7 text-xs"
            >
              {selectedValues.length === options.length ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Desmarcar todos
                </>
              ) : (
                'Selecionar todos'
              )}
            </Button>
            {selectedValues.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-7 text-xs text-destructive hover:text-destructive"
              >
                Limpar
              </Button>
            )}
          </div>

          {/* Lista de opções */}
          <ScrollArea className="max-h-[300px]">
            <div className="p-2">
              {filteredOptions.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  Nenhum resultado encontrado
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredOptions.map((option) => (
                    <div
                      key={option}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                        "hover:bg-muted/50",
                        selectedValues.includes(option) && "bg-primary/10"
                      )}
                      onClick={() => toggleOption(option)}
                    >
                      <Checkbox
                        checked={selectedValues.includes(option)}
                        onCheckedChange={() => toggleOption(option)}
                        className="flex-shrink-0"
                      />
                      <span className="text-sm flex-1 truncate">{option}</span>
                      {selectedValues.includes(option) && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer com contador */}
          {selectedValues.length > 0 && (
            <div className="p-2 border-t border-border/50 bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                {selectedValues.length} de {options.length} selecionados
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

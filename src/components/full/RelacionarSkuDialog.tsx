import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFullData, Produto } from "@/hooks/useFullData";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelacionarSkuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    full_raw_id: number;
    sku_texto: string;
    envio_num: string;
  };
}

export const RelacionarSkuDialog = ({
  open,
  onOpenChange,
  item,
}: RelacionarSkuDialogProps) => {
  const { relacionarSku, isRelacionando, searchProdutos } = useFullData();
  const [selectedSku, setSelectedSku] = useState("");
  const [alias, setAlias] = useState(item.sku_texto);
  const [skuOpen, setSkuOpen] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setAlias(item.sku_texto);
  }, [item.sku_texto]);

  useEffect(() => {
    const loadProdutos = async () => {
      if (searchQuery.length >= 2) {
        const results = await searchProdutos(searchQuery);
        setProdutos(results);
      } else {
        setProdutos([]);
      }
    };

    const debounce = setTimeout(loadProdutos, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSubmit = () => {
    if (!selectedSku) return;

    relacionarSku(
      {
        rawId: item.full_raw_id,
        sku: selectedSku,
        alias,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedSku("");
          setAlias("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Relacionar SKU</DialogTitle>
          <DialogDescription>
            Envio: <span className="font-semibold">{item.envio_num}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sku">SKU do Catálogo</Label>
            <Popover open={skuOpen} onOpenChange={setSkuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={skuOpen}
                  className="w-full justify-between"
                >
                  {selectedSku
                    ? produtos.find((p) => p.sku === selectedSku)?.sku +
                      " - " +
                      produtos.find((p) => p.sku === selectedSku)?.nome
                    : "Selecione um SKU..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar SKU ou nome..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {searchQuery.length < 2
                        ? "Digite pelo menos 2 caracteres"
                        : "Nenhum produto encontrado"}
                    </CommandEmpty>
                    <CommandGroup>
                      {produtos.map((produto) => (
                        <CommandItem
                          key={produto.sku}
                          value={produto.sku}
                          onSelect={(currentValue) => {
                            setSelectedSku(currentValue);
                            setSkuOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSku === produto.sku
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {produto.sku} - {produto.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alias">Alias Visto</Label>
            <Input
              id="alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Alias do SKU"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRelacionando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedSku || isRelacionando}
          >
            {isRelacionando ? "Relacionando..." : "Relacionar e Emitir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

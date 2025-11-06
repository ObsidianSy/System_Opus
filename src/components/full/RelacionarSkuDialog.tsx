import { useState, useEffect, useMemo } from "react";
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
import { Check, ChevronsUpDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { FullKitRelationModal } from "./FullKitRelationModal";
import { API_BASE_URL } from "@/config/api";

interface RelacionarSkuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    full_raw_id: number;
    sku_texto: string;
    envio_num: string;
    envio_id?: number; // ✅ Adicionar envio_id opcional
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
  const [kitModalOpen, setKitModalOpen] = useState(false);
  const [fotoMap, setFotoMap] = useState<Record<string, string>>({});

  // Heurística simples para extrair produto_base do SKU
  const extrairBase = (sku: string) => {
    if (!sku) return sku;
    const parts = sku.toUpperCase().trim().split("-");
    if (parts.length <= 1) return sku.toUpperCase().trim();
    const last = parts[parts.length - 1];
    const isSize = /^(P|PP|M|G|GG|XG|XGG|U|UNICO|UNI|36|37|38|39|40|41|42|43|44|45|[0-9]{1,3})$/.test(last);
    if (isSize) parts.pop();
    return parts.join("-");
  };

  const getFotoUrlForSku = (sku: string) => {
    const base = extrairBase(sku);
    return fotoMap[base];
  };

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

  // Carregar uma vez o estoque para montar um mapa base->foto_url
  useEffect(() => {
    const carregarFotos = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/estoque`);
        const data = await res.json();
        const map: Record<string, string> = {};
        (Array.isArray(data) ? data : []).forEach((p: any) => {
          if (p?.foto_url) {
            const base = extrairBase(p.sku);
            if (base && !map[base]) map[base] = p.foto_url;
          }
        });
        setFotoMap(map);
      } catch (e) {
        // silencioso
      }
    };
    if (open) carregarFotos();
  }, [open]);

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
                  <span className="flex items-center gap-2 truncate">
                    {selectedSku && getFotoUrlForSku(selectedSku) ? (
                      <img
                        src={`${API_BASE_URL}${getFotoUrlForSku(selectedSku)!}`}
                        alt={selectedSku}
                        className="h-6 w-6 rounded object-cover bg-muted"
                      />
                    ) : null}
                    {selectedSku
                      ? `${produtos.find((p) => p.sku === selectedSku)?.sku || selectedSku} - ${produtos.find((p) => p.sku === selectedSku)?.nome || ''}`
                      : "Selecione um SKU..."}
                  </span>
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
                      {produtos.map((produto) => {
                        const foto = getFotoUrlForSku(produto.sku);
                        return (
                          <CommandItem
                            key={produto.sku}
                            value={produto.sku}
                            onSelect={(currentValue) => {
                              setSelectedSku(currentValue);
                              setSkuOpen(false);
                            }}
                            className="flex items-center gap-2"
                          >
                            {foto ? (
                              <img
                                src={`${API_BASE_URL}${foto}`}
                                alt={produto.sku}
                                className="h-8 w-8 rounded object-cover bg-muted"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-medium">
                                {(produto.sku || '?').slice(0, 2)}
                              </div>
                            )}
                            <Check
                              className={cn(
                                "ml-1 h-4 w-4",
                                selectedSku === produto.sku
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex-1 truncate">
                              <div className="font-medium truncate">{produto.sku}</div>
                              <div className="text-xs text-muted-foreground truncate">{produto.nome}</div>
                            </div>
                          </CommandItem>
                        );
                      })}
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
            onClick={() => {
              setKitModalOpen(true);
              onOpenChange(false);
            }}
          >
            <Package className="mr-2 h-4 w-4" />
            Relacionar como Kit
          </Button>
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

      {/* Modal de Kit */}
      <FullKitRelationModal
        open={kitModalOpen}
        onOpenChange={(open) => {
          setKitModalOpen(open);
          if (!open) onOpenChange(true); // Reabre o dialog principal
        }}
        rawId={item.full_raw_id}
        skuOriginal={item.sku_texto}
        envioId={item.envio_id} // ✅ Passar envio_id
        onKitRelated={(sku) => {
          console.log('Kit relacionado:', sku);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
};

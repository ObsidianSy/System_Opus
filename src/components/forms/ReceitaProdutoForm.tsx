import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { salvarReceitaProduto, consultarDados, gerarIdReceita, type ReceitaProdutoData } from "@/services/n8nIntegration";
import { sortBySKU } from "@/utils/sortUtils";

interface ReceitaProdutoFormProps {
  onSuccess?: () => void;
}

const ReceitaProdutoForm = ({ onSuccess }: ReceitaProdutoFormProps) => {
  const [formData, setFormData] = useState({
    skuProduto: "",
    skuMateriaPrima: "",
    quantidade: "",
    unidadeMedida: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openProduto, setOpenProduto] = useState(false);
  const [openMateriaPrima, setOpenMateriaPrima] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosProdutos, dadosMateriaPrima] = await Promise.all([
        consultarDados('Estoque'),
        consultarDados('Estoque_MateriaPrima')
      ]);

      setProdutos(dadosProdutos || []);
      setMateriasPrimas(dadosMateriaPrima || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar produtos e matérias-primas");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const receitaData: ReceitaProdutoData = {
        "SKU Produto": formData.skuProduto,
        items: [{
          "SKU Matéria-Prima": formData.skuMateriaPrima,
          "Quantidade por Produto": parseFloat(formData.quantidade),
          "Unidade de Medida": formData.unidadeMedida || "UN"
        }]
      };

      const sucesso = await salvarReceitaProduto(receitaData);

      if (sucesso) {
        toast.success("Receita de produto cadastrada com sucesso!");
        // Reset form
        setFormData({
          skuProduto: "",
          skuMateriaPrima: "",
          quantidade: "",
          unidadeMedida: ""
        });
        onSuccess?.();
      } else {
        toast.error("Erro ao cadastrar receita de produto");
      }
    } catch (error) {
      console.error("Erro ao cadastrar receita:", error);
      toast.error("Erro ao cadastrar receita de produto");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Receita de Produto
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center py-8">
          <p>Carregando produtos e matérias-primas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Receita de Produto
        </DialogTitle>
        <p className="text-muted-foreground">
          Configure quais matérias-primas são necessárias para fabricar cada produto
        </p>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="skuProduto">Produto *</Label>
            <Popover open={openProduto} onOpenChange={setOpenProduto} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openProduto}
                  className="w-full justify-between"
                >
                  {formData.skuProduto
                    ? produtos.find((produto) => (produto.SKU || produto.sku) === formData.skuProduto)
                      ? `${formData.skuProduto} - ${produtos.find((produto) => (produto.SKU || produto.sku) === formData.skuProduto)?.["Nome Produto"] || produtos.find((produto) => (produto.SKU || produto.sku) === formData.skuProduto)?.nome || ''}`
                      : "Produto não encontrado"
                    : "Selecione o produto"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar produto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sortBySKU(produtos, (p) => p.SKU || p.sku || '').map((produto) => {
                        const sku = produto.SKU || produto.sku || '';
                        const nome = produto["Nome Produto"] || produto.nome || '';
                        return (
                          <CommandItem
                            key={sku}
                            value={`${sku} ${nome}`}
                            onSelect={() => {
                              handleInputChange("skuProduto", sku);
                              setOpenProduto(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.skuProduto === sku ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {sku} - {nome}
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
            <Label htmlFor="skuMateriaPrima">Matéria-Prima *</Label>
            <Popover open={openMateriaPrima} onOpenChange={setOpenMateriaPrima} modal={false}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openMateriaPrima}
                  className="w-full justify-between"
                >
                  {formData.skuMateriaPrima
                    ? materiasPrimas.find((mp) => (mp["SKU Matéria-Prima"] || mp.sku_materia_prima) === formData.skuMateriaPrima)
                      ? `${formData.skuMateriaPrima} - ${materiasPrimas.find((mp) => (mp["SKU Matéria-Prima"] || mp.sku_materia_prima) === formData.skuMateriaPrima)?.["Nome Matéria-Prima"] || materiasPrimas.find((mp) => (mp["SKU Matéria-Prima"] || mp.sku_materia_prima) === formData.skuMateriaPrima)?.nome_materia_prima || ''}`
                      : "Matéria-prima não encontrada"
                    : "Selecione a matéria-prima"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Pesquisar matéria-prima..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma matéria-prima encontrada.</CommandEmpty>
                    <CommandGroup>
                      {sortBySKU(materiasPrimas, (mp) => mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '').map((mp) => {
                        const codigo = mp["SKU Matéria-Prima"] || mp.sku_materia_prima || '';
                        const nome = mp["Nome Matéria-Prima"] || mp.nome_materia_prima || '';
                        return (
                          <CommandItem
                            key={codigo}
                            value={`${codigo} ${nome}`}
                            onSelect={() => {
                              handleInputChange("skuMateriaPrima", codigo);
                              setOpenMateriaPrima(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.skuMateriaPrima === codigo ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {codigo} - {nome}
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
            <Label htmlFor="quantidade">Quantidade por Produto *</Label>
            <Input
              id="quantidade"
              type="number"
              value={formData.quantidade}
              onChange={(e) => handleInputChange("quantidade", e.target.value)}
              placeholder="Ex: 2"
              min="0.01"
              step="0.01"
              required
            />
            <p className="text-xs text-muted-foreground">
              Quantidade desta matéria-prima necessária para fabricar 1 unidade do produto
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
            <Select onValueChange={(value) => handleInputChange("unidadeMedida", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UN">Unidade (UN)</SelectItem>
                <SelectItem value="KG">Quilograma (KG)</SelectItem>
                <SelectItem value="G">Grama (G)</SelectItem>
                <SelectItem value="MT">Metro (MT)</SelectItem>
                <SelectItem value="CM">Centímetro (CM)</SelectItem>
                <SelectItem value="LT">Litro (LT)</SelectItem>
                <SelectItem value="ML">Mililitro (ML)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting || !formData.skuProduto || !formData.skuMateriaPrima || !formData.quantidade}
            className="btn-gradient"
          >
            {isSubmitting ? "Cadastrando..." : "Cadastrar Receita"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReceitaProdutoForm;
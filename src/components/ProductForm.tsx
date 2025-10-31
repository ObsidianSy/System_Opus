
import { useState, FormEvent, useRef } from "react";
import { Check, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ProductFormProps {
  onCadastrar: (message: string) => void;
  onEditar: () => void;
}

const ProductForm = ({ onCadastrar, onEditar }: ProductFormProps) => {
  const [productType, setProductType] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Create refs for form elements
  const skuRef = useRef<HTMLInputElement>(null);
  const modeloCamisetaRef = useRef<HTMLInputElement>(null);
  const quantidadeCamisetaRef = useRef<HTMLInputElement>(null);
  const valorCamisetaRef = useRef<HTMLInputElement>(null);
  
  const modeloDTFRef = useRef<HTMLInputElement>(null);
  const nomeDTFRef = useRef<HTMLInputElement>(null);
  const quantidadeDTFRef = useRef<HTMLInputElement>(null);
  const valorDTFRef = useRef<HTMLInputElement>(null);

  const handleProductTypeChange = (value: string) => {
    setProductType(value);
  };

  const handleCadastrar = async (e: FormEvent) => {
    e.preventDefault();
    if (!productType) return;

    setIsLoading(true);
    
    try {
      let produto: any = { tipo: productType };

      if (productType === "Camiseta") {
        produto.sku = skuRef.current?.value.trim() || "";
        produto.modelo = modeloCamisetaRef.current?.value.trim() || "";
        produto.quantidade = parseInt(quantidadeCamisetaRef.current?.value || "0");
        produto.valor = parseFloat(valorCamisetaRef.current?.value || "0");
      } else {
        produto.modelo = modeloDTFRef.current?.value.trim() || "";
        produto.nome = nomeDTFRef.current?.value.trim() || "";
        produto.quantidade = parseInt(quantidadeDTFRef.current?.value || "0");
        produto.valor = parseFloat(valorDTFRef.current?.value || "0");
      }

      const response = await fetch("https://script.google.com/macros/s/AKfycbwS_98z-yv2p5K5ZsIDl6-x-CVScyVvm5NsA3HfVAaLTRgbVtnrxMQXq7xPscR4PDJybg/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "cadastrarProduto", produto })
      });

      const result = await response.json();
      const message = result.resultado || "✅ Produto cadastrado!";
      
      toast({
        title: "Sucesso!",
        description: message
      });
      
      onCadastrar(message);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Houve um erro ao cadastrar o produto",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleCadastrar}>
      <div className="space-y-2">
        <Label htmlFor="tipoProduto">Tipo de Produto</Label>
        <Select onValueChange={handleProductTypeChange}>
          <SelectTrigger id="tipoProduto" className="w-full">
            <SelectValue placeholder="Selecione o tipo de produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Camiseta">Camiseta</SelectItem>
            <SelectItem value="DTF">DTF</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {productType === "Camiseta" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skuCamiseta">SKU</Label>
            <Input id="skuCamiseta" placeholder="Digite o SKU" ref={skuRef} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="modeloCamiseta">Nome do Modelo</Label>
            <Input id="modeloCamiseta" placeholder="Digite o nome do modelo" ref={modeloCamisetaRef} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantidadeCamiseta">Quantidade</Label>
            <Input id="quantidadeCamiseta" type="number" placeholder="0" min="0" ref={quantidadeCamisetaRef} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="valorCamiseta">Preço Unitário</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">R$</span>
              <Input id="valorCamiseta" type="number" className="pl-8" placeholder="0.00" min="0" step="0.01" ref={valorCamisetaRef} />
            </div>
          </div>
        </div>
      )}

      {productType === "DTF" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modeloDTF">Código do Modelo</Label>
            <Input id="modeloDTF" placeholder="Digite o código do modelo" ref={modeloDTFRef} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="nomeDTF">Nome do Design</Label>
            <Input id="nomeDTF" placeholder="Digite o nome do design" ref={nomeDTFRef} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantidadeDTF">Quantidade</Label>
            <Input id="quantidadeDTF" type="number" placeholder="0" min="0" ref={quantidadeDTFRef} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="valorDTF">Preço Unitário</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">R$</span>
              <Input id="valorDTF" type="number" className="pl-8" placeholder="0.00" min="0" step="0.01" ref={valorDTFRef} />
            </div>
          </div>
        </div>
      )}

      <div className={cn("flex gap-3 pt-4", productType === "" ? "opacity-50 pointer-events-none" : "")}>
        <Button 
          id="btnCadastrar" 
          type="submit" 
          className="flex-1"
          disabled={productType === "" || isLoading}
        >
          <Check className="mr-2 h-4 w-4" /> Cadastrar Produto
        </Button>
        <Button 
          id="btnEditar" 
          type="button" 
          onClick={onEditar}
          variant="outline"
          className="flex-1"
          disabled={productType === "" || isLoading}
        >
          <Edit className="mr-2 h-4 w-4" /> Editar Produto
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { salvarMateriaPrima, gerarIdMateriaPrima, type MateriaPrimaData } from "@/services/n8nIntegration";

interface MateriaPrimaFormProps {
  onSuccess?: () => void;
  materiaPrima?: {
    sku?: string;
    nome?: string;
    categoria?: string;
    tipo?: string;
    quantidade?: number;
    unidade_medida?: string;
    custo_unitario?: number;
  };
}

const MateriaPrimaForm = ({ onSuccess, materiaPrima }: MateriaPrimaFormProps) => {
  const [formData, setFormData] = useState({
    skuMateriaPrima: materiaPrima?.sku || "",
    nomeMateriaPrima: materiaPrima?.nome || "",
    categoria: materiaPrima?.categoria || "",
    quantidadeAtual: materiaPrima?.quantidade?.toString() || "",
    unidadeMedida: materiaPrima?.unidade_medida || "",
    precoUnitario: materiaPrima?.custo_unitario?.toString() || ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const materiaPrimaData: MateriaPrimaData = {
        "ID MateriaPrima": gerarIdMateriaPrima(),
        "SKU MatériaPrima": formData.skuMateriaPrima,
        "Nome MatériaPrima": formData.nomeMateriaPrima,
        "Categoria": formData.categoria,
        "Quantidade Atual": parseInt(formData.quantidadeAtual),
        "Unidade de Medida": formData.unidadeMedida,
        "Preço Unitário": parseFloat(formData.precoUnitario)
      };

      const sucesso = await salvarMateriaPrima(materiaPrimaData);
      
      if (sucesso) {
        toast.success("Matéria-prima cadastrada com sucesso!");
        // Reset form
        setFormData({
          skuMateriaPrima: "",
          nomeMateriaPrima: "",
          categoria: "",
          quantidadeAtual: "",
          unidadeMedida: "",
          precoUnitario: ""
        });
        onSuccess?.();
      } else {
        toast.error("Erro ao cadastrar matéria-prima");
      }
    } catch (error) {
      console.error("Erro ao cadastrar matéria-prima:", error);
      toast.error("Erro ao cadastrar matéria-prima");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Cadastrar Matéria-Prima
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="skuMateriaPrima">SKU Matéria-Prima *</Label>
            <Input
              id="skuMateriaPrima"
              value={formData.skuMateriaPrima}
              onChange={(e) => handleInputChange("skuMateriaPrima", e.target.value)}
              placeholder="Ex: MP-001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomeMateriaPrima">Nome Matéria-Prima *</Label>
            <Input
              id="nomeMateriaPrima"
              value={formData.nomeMateriaPrima}
              onChange={(e) => handleInputChange("nomeMateriaPrima", e.target.value)}
              placeholder="Ex: Argola 29mm Níquel"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria MP *</Label>
            <Select onValueChange={(value) => handleInputChange("categoria", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Metal">Metal</SelectItem>
                <SelectItem value="Tecido">Tecido</SelectItem>
                <SelectItem value="Plástico">Plástico</SelectItem>
                <SelectItem value="Madeira">Madeira</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-2">
            <Label htmlFor="quantidadeAtual">Quantidade Atual *</Label>
            <Input
              id="quantidadeAtual"
              type="number"
              value={formData.quantidadeAtual}
              onChange={(e) => handleInputChange("quantidadeAtual", e.target.value)}
              placeholder="Ex: 1000"
              min="0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidadeMedida">Unidade de Medida *</Label>
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

          <div className="space-y-2">
            <Label htmlFor="precoUnitario">Custo Unitário (R$) *</Label>
            <Input
              id="precoUnitario"
              type="number"
              step="0.01"
              value={formData.precoUnitario}
              onChange={(e) => handleInputChange("precoUnitario", e.target.value)}
              placeholder="Ex: 0.10"
              min="0"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="btn-gradient"
          >
            {isSubmitting ? "Cadastrando..." : "Cadastrar Matéria-Prima"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MateriaPrimaForm;
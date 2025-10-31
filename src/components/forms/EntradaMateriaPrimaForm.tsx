import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";

interface MateriaPrimaOption {
  "SKU Matéria-Prima": string;
  "Nome Matéria-Prima": string;
}

interface EntradaMateriaPrimaFormProps {
  onSuccess?: () => void;
}

export default function EntradaMateriaPrimaForm({ onSuccess }: EntradaMateriaPrimaFormProps) {
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrimaOption[]>([]);
  const [formData, setFormData] = useState({
    skuMateriaPrima: "",
    nomeMateriaPrima: "",
    quantidadeAdicionar: "",
    observacao: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    carregarMateriasPrimas();
  }, []);

  const carregarMateriasPrimas = async () => {
    try {
      const dados = await consultarDados("Estoque_MateriaPrima");
      console.log("Dados brutos recebidos:", dados);
      
      // Filter and remove duplicates by SKU
      const dadosFiltrados = dados.filter(item => item["SKU Matéria-Prima"] && item["Nome Matéria-Prima"]);
      console.log("Dados filtrados:", dadosFiltrados);
      
      // Remove duplicates by SKU
      const skusUnicos = new Map();
      dadosFiltrados.forEach(item => {
        const sku = item["SKU Matéria-Prima"];
        if (!skusUnicos.has(sku)) {
          skusUnicos.set(sku, item);
        }
      });
      
      const materiasUnicas = Array.from(skusUnicos.values());
      console.log("Matérias-primas únicas:", materiasUnicas);
      
      setMateriasPrimas(materiasUnicas);
    } catch (error) {
      console.error("Erro ao carregar matérias-primas:", error);
      toast.error("Erro ao carregar lista de matérias-primas");
    }
  };

  const handleSKUChange = (sku: string) => {
    const materiaPrima = materiasPrimas.find(mp => mp["SKU Matéria-Prima"] === sku);
    setFormData(prev => ({
      ...prev,
      skuMateriaPrima: sku,
      nomeMateriaPrima: materiaPrima?.["Nome Matéria-Prima"] || ""
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.skuMateriaPrima || !formData.quantidadeAdicionar) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const quantidade = parseInt(formData.quantidadeAdicionar);
    if (isNaN(quantidade) || quantidade <= 0) {
      toast.error("Quantidade deve ser um número maior que zero");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        sheetName: "Estoque_MateriaPrima",
        action: "entrada",
        data: {
          "SKU MatériaPrima": formData.skuMateriaPrima,
          "Quantidade a Adicionar": quantidade,
          Observação: formData.observacao || ""
        }
      };

      const response = await fetch(
        import.meta.env.DEV 
          ? "http://localhost:5678/webhook/write"
          : "https://docker-n8n-webhook.q4xusi.easypanel.host/webhook/w56f5d8c2h4dcd6g1c",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        toast.success("Entrada de matéria-prima registrada com sucesso!");
        setFormData({
          skuMateriaPrima: "",
          nomeMateriaPrima: "",
          quantidadeAdicionar: "",
          observacao: ""
        });
        onSuccess?.();
      } else {
        throw new Error("Erro na resposta do servidor");
      }
    } catch (error) {
      console.error("Erro ao registrar entrada:", error);
      toast.error("Erro ao registrar entrada de matéria-prima");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Entrada de Matéria-Prima no Estoque</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="skuMateriaPrima">SKU da Matéria-Prima *</Label>
          <Select value={formData.skuMateriaPrima} onValueChange={handleSKUChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o SKU da matéria-prima" />
            </SelectTrigger>
            <SelectContent>
              {materiasPrimas.map((materiaPrima) => (
                <SelectItem key={materiaPrima["SKU Matéria-Prima"]} value={materiaPrima["SKU Matéria-Prima"]}>
                  {materiaPrima["SKU Matéria-Prima"]} - {materiaPrima["Nome Matéria-Prima"]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nomeMateriaPrima">Nome da Matéria-Prima</Label>
          <Input
            id="nomeMateriaPrima"
            value={formData.nomeMateriaPrima}
            disabled
            placeholder="Nome será preenchido automaticamente"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantidadeAdicionar">Quantidade a Adicionar *</Label>
          <Input
            id="quantidadeAdicionar"
            type="number"
            min="1"
            value={formData.quantidadeAdicionar}
            onChange={(e) => handleInputChange("quantidadeAdicionar", e.target.value)}
            placeholder="Digite a quantidade a adicionar"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="observacao">Observação</Label>
          <Textarea
            id="observacao"
            value={formData.observacao}
            onChange={(e) => handleInputChange("observacao", e.target.value)}
            placeholder="Observações sobre esta entrada (opcional)"
          />
        </div>

        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Registrando..." : "Registrar Entrada"}
        </Button>
      </form>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { consultarDados } from "@/services/n8nIntegration";
import { sortBySKU } from "@/utils/sortUtils";
import { getApiUrl } from "@/config/api";

interface ProdutoOption {
  SKU: string;
  "Nome Produto": string;
}

interface EntradaProdutoFormProps {
  onSuccess?: () => void;
}

export default function EntradaProdutoForm({ onSuccess }: EntradaProdutoFormProps) {
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [formData, setFormData] = useState({
    sku: "",
    nomeProduto: "",
    quantidadeAdicionar: "",
    origem_tabela: "manual",
    origem_id: "",
    observacao: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    try {
      const response = await fetch(getApiUrl("/api/estoque"));
      const dados = await response.json();

      // Adaptar formato para o select
      const produtosFormatados = dados.map((p: any) => ({
        SKU: p.sku,
        "Nome Produto": p.nome
      }));

      setProdutos(produtosFormatados.filter((item: any) => item.SKU && item["Nome Produto"]));
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar lista de produtos");
    }
  };

  const handleSKUChange = (sku: string) => {
    const produto = produtos.find(p => p.SKU === sku);
    setFormData(prev => ({
      ...prev,
      sku,
      nomeProduto: produto?.["Nome Produto"] || ""
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

    if (!formData.sku || !formData.quantidadeAdicionar) {
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
        sku: formData.sku,
        quantidade: quantidade,
        origem_tabela: formData.origem_tabela,
        origem_id: formData.origem_id || undefined,
        observacao: formData.observacao || undefined
      };

      console.log("📤 Enviando entrada de produto:", payload);

      const token = localStorage.getItem('token');
      const response = await fetch(
        getApiUrl("/api/estoque/entrada"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        }
      );

      const responseData = await response.json();
      console.log("📥 Resposta do servidor:", responseData);

      if (response.ok) {
        toast.success(
          `Entrada registrada! Saldo atual: ${responseData.saldo_atual} unidades`
        );
        setFormData({
          sku: "",
          nomeProduto: "",
          quantidadeAdicionar: "",
          origem_tabela: "manual",
          origem_id: "",
          observacao: ""
        });
        onSuccess?.();
      } else {
        throw new Error(responseData.message || "Erro na resposta do servidor");
      }
    } catch (error) {
      console.error("❌ Erro ao registrar entrada:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao registrar entrada de produto");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Entrada de Produto no Estoque</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU do Produto *</Label>
          <Select value={formData.sku} onValueChange={handleSKUChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o SKU do produto" />
            </SelectTrigger>
            <SelectContent>
              {sortBySKU(produtos, "SKU").map((produto) => (
                <SelectItem key={produto.SKU} value={produto.SKU}>
                  {produto.SKU} - {produto["Nome Produto"]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nomeProduto">Nome do Produto</Label>
          <Input
            id="nomeProduto"
            value={formData.nomeProduto}
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
          <Label htmlFor="origem_tabela">Origem da Entrada</Label>
          <Select
            value={formData.origem_tabela}
            onValueChange={(value) => handleInputChange("origem_tabela", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="compra">Compra</SelectItem>
              <SelectItem value="ajuste">Ajuste</SelectItem>
              <SelectItem value="devolucao">Devolução</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="origem_id">ID da Origem (opcional)</Label>
          <Input
            id="origem_id"
            value={formData.origem_id}
            onChange={(e) => handleInputChange("origem_id", e.target.value)}
            placeholder="Ex: NF-000321, Pedido-123"
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
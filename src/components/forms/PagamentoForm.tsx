import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  criarPagamento, 
  consultarClientes,
  gerarIdPagamento,
  type PagamentoData 
} from "@/services/n8nIntegration";

interface PagamentoFormProps {
  onSuccess?: () => void;
}

interface Cliente {
  "ID Cliente": string;
  "Cliente": string;
}

const PagamentoForm = ({ onSuccess }: PagamentoFormProps) => {
  const [formData, setFormData] = useState({
    "Data Pagamento": new Date().toISOString().split('T')[0],
    "Nome Cliente": "",
    "Valor Pago": 0,
    "Forma de Pagamento": "",
    "Observações": ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      const dados = await consultarClientes();
      const clientesFormatados = dados.map((item: any) => ({
        "ID Cliente": item["ID Cliente"] || "",
        "Cliente": item["Nome"] || ""
      }));
      setClientes(clientesFormatados);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const handleSelectCliente = (clienteNome: string) => {
    setFormData(prev => ({
      ...prev,
      "Nome Cliente": clienteNome
    }));
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validação
      if (!formData["Nome Cliente"] || formData["Valor Pago"] <= 0 || !formData["Forma de Pagamento"]) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }

      const pagamentoData: PagamentoData = {
        "ID Pagamento": gerarIdPagamento(),
        "Data Pagamento": formData["Data Pagamento"],
        "Nome Cliente": formData["Nome Cliente"],
        "Valor Pago": formData["Valor Pago"],
        "Forma de Pagamento": formData["Forma de Pagamento"],
        "Observações": formData["Observações"]
      };

      const success = await criarPagamento(pagamentoData);

      if (success) {
        toast.success("Pagamento registrado com sucesso!");
        
        // Limpar formulário
        setFormData({
          "Data Pagamento": new Date().toISOString().split('T')[0],
          "Nome Cliente": "",
          "Valor Pago": 0,
          "Forma de Pagamento": "",
          "Observações": ""
        });

        onSuccess?.();
      } else {
        toast.error("Erro ao registrar pagamento. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      toast.error("Erro inesperado ao registrar pagamento");
    } finally {
      setIsLoading(false);
    }
  };

  const formasPagamento = [
    "Dinheiro",
    "Pix",
    "Cartão de Crédito",
    "Cartão de Débito",
    "Transferência Bancária",
    "Boleto",
    "Outros"
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-pagamento">Data do Pagamento *</Label>
              <Input
                id="data-pagamento"
                type="date"
                value={formData["Data Pagamento"]}
                onChange={(e) => handleInputChange("Data Pagamento", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente *</Label>
              <Select value={formData["Nome Cliente"]} onValueChange={handleSelectCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes
                    .filter((cliente) => cliente["Cliente"] && cliente["Cliente"].trim() !== "")
                    .map((cliente) => (
                      <SelectItem key={cliente["ID Cliente"]} value={cliente["Cliente"]}>
                        {cliente["Cliente"]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor-pago">Valor Pago *</Label>
              <Input
                id="valor-pago"
                type="number"
                step="0.01"
                min="0"
                value={formData["Valor Pago"]}
                onChange={(e) => handleInputChange("Valor Pago", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma-pagamento">Forma de Pagamento *</Label>
              <Select 
                value={formData["Forma de Pagamento"]} 
                onValueChange={(value) => handleInputChange("Forma de Pagamento", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((forma) => (
                    <SelectItem key={forma} value={forma}>
                      {forma}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData["Observações"]}
              onChange={(e) => handleInputChange("Observações", e.target.value)}
              placeholder="Observações sobre o pagamento (opcional)"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Registrando..." : "Registrar Pagamento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PagamentoForm;
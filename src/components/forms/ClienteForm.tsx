import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { salvarCliente, gerarIdCliente, type ClienteData } from "@/services/n8nIntegration";

interface ClienteFormProps {
  onSuccess?: () => void;
  cliente?: Partial<ClienteData>;
}

const ClienteForm = ({ onSuccess, cliente }: ClienteFormProps) => {
  const [formData, setFormData] = useState<Partial<ClienteData>>({
    "Nome": cliente?.["Nome"] || "",
    "Documento": cliente?.["Documento"] || "",
    "Telefone": cliente?.["Telefone"] || "",
    "Observações": cliente?.["Observações"] || ""
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: keyof ClienteData, value: string) => {
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
      if (!formData["Nome"]) {
        toast.error("Nome é obrigatório");
        return;
      }

      const clienteData: ClienteData = {
        "ID Cliente": "", // Será gerado pelo banco
        "Nome": formData["Nome"]!,
        "Documento": formData["Documento"] || "",
        "Telefone": formData["Telefone"] || "",
        "Observações": formData["Observações"] || ""
      };

      const success = await salvarCliente(clienteData);

      if (success) {
        toast.success(cliente ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!");

        if (!cliente) {
          // Limpar formulário apenas se for novo cliente
          setFormData({
            "Nome": "",
            "Documento": "",
            "Telefone": "",
            "Observações": ""
          });
        }

        onSuccess?.();
      } else {
        toast.error("Erro ao salvar cliente. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast.error("Erro inesperado ao salvar cliente");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cliente ? "Editar Cliente" : "Cadastrar Novo Cliente"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={formData["Nome"]}
              onChange={(e) => handleInputChange("Nome", e.target.value)}
              placeholder="Ex: João da Silva"
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData["Telefone"]}
                onChange={(e) => handleInputChange("Telefone", e.target.value)}
                placeholder="+5511999998888"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">Documento (CPF/CNPJ)</Label>
              <Input
                id="documento"
                value={formData["Documento"]}
                onChange={(e) => handleInputChange("Documento", e.target.value)}
                placeholder="123.456.789-00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Input
              id="observacoes"
              value={formData["Observações"]}
              onChange={(e) => handleInputChange("Observações", e.target.value)}
              placeholder="Observações adicionais sobre o cliente"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? (cliente ? "Atualizando..." : "Cadastrando...")
              : (cliente ? "Atualizar Cliente" : "Cadastrar Cliente")
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ClienteForm;
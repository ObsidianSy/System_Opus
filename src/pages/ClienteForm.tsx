
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Layout from "@/components/Layout";
import { toast } from "sonner";

const ClienteForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    valorDevido: "",
    proximoPagamento: ""
  });

  useEffect(() => {
    if (isEditing) {
      // Simulando busca de cliente por ID
      // Em um ambiente real, aqui faria uma chamada à API
      // Cliente mockado para demonstração
      if (id === "1") {
        setFormData({
          nome: "João Silva",
          telefone: "(11) 99999-1111",
          email: "joao@email.com",
          valorDevido: "550.00",
          proximoPagamento: "2025-05-15"
        });
      }
    }
  }, [id, isEditing]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone) {
      toast.error("Erro", {
        description: "Nome e telefone são campos obrigatórios"
      });
      return;
    }
    
    // Aqui seria a lógica para salvar no backend
    toast.success(isEditing ? "Cliente atualizado" : "Cliente cadastrado", {
      description: `${formData.nome} foi ${isEditing ? "atualizado" : "adicionado"} com sucesso`
    });
    
    navigate("/clientes");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">{isEditing ? "Editar" : "Novo"} Cliente</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input 
                id="nome" 
                value={formData.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input 
                id="telefone" 
                value={formData.telefone}
                onChange={(e) => handleChange("telefone", e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="valorDevido">Valor Devido (R$)</Label>
              <Input 
                id="valorDevido" 
                type="number"
                min="0"
                step="0.01"
                value={formData.valorDevido}
                onChange={(e) => handleChange("valorDevido", e.target.value)}
                disabled={isEditing}
                placeholder="0.00"
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">Use a função de pagamentos para alterar o valor devido</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proximoPagamento">Próximo Pagamento</Label>
              <Input 
                id="proximoPagamento" 
                type="date"
                value={formData.proximoPagamento}
                onChange={(e) => handleChange("proximoPagamento", e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/clientes")}>
              Cancelar
            </Button>
            <Button type="submit">
              {isEditing ? "Atualizar" : "Cadastrar"} Cliente
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default ClienteForm;

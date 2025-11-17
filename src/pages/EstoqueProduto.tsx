
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import { salvarProduto, gerarSkuProduto } from "@/services/n8nIntegration";

const EstoqueProduto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  const [formData, setFormData] = useState({
    sku: "",
    nomeProduto: "",
    categoria: "",
    tipoProduto: "",
    quantidadeAtual: 0,
    unidadeMedida: "",
    precoUnitario: 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Listas predefinidas
  const categorias = ["Roupas", "Acessórios", "DTF", "Personalizados"];
  const tiposProduto = ["Camiseta", "Blusa", "Caneca", "Adesivo", "DTF", "Outro"];
  const unidadesMedida = ["un", "kg", "g", "m", "cm", "l", "ml"];

  useEffect(() => {
    if (isEditing) {
      // Simulando busca de produto por ID
      // Em um ambiente real, aqui faria uma chamada à API
      // Produto mockado para demonstração
      if (id === "1") {
        setFormData({
          sku: "ROUP-001",
          nomeProduto: "Camiseta Básica Branca P",
          categoria: "Roupas",
          tipoProduto: "Camiseta",
          quantidadeAtual: 10,
          unidadeMedida: "un",
          precoUnitario: 29.90
        });
      }
    }
  }, [id, isEditing]);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nomeProduto || !formData.categoria || !formData.tipoProduto || formData.precoUnitario <= 0) {
      toast.error("Dados incompletos", {
        description: "Preencha todos os campos obrigatórios (nome, categoria, tipo e preço)"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const produtoData = {
        "SKU": formData.sku || gerarSkuProduto(formData.categoria),
        "Nome Produto": formData.nomeProduto,
        "Categoria": formData.categoria,
        "Tipo Produto": formData.tipoProduto,
        "Quantidade Atual": formData.quantidadeAtual,
        "Unidade de Medida": formData.unidadeMedida,
        "Preço Unitário": formData.precoUnitario
      };

      const sucesso = await salvarProduto(produtoData);

      if (sucesso) {
        toast.success(isEditing ? "Produto atualizado com sucesso" : "Produto cadastrado com sucesso", {
          description: `${formData.nomeProduto} foi ${isEditing ? "atualizado" : "adicionado"} ao estoque`
        });
        navigate("/estoque");
      } else {
        toast.error(ErrorMessages.produtos.saveFailed(isEditing), {
          description: "Verifique os dados e tente novamente."
        });
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      const errorMsg = (error as any)?.message || '';
      const isDuplicate = errorMsg.toLowerCase().includes('duplicate') || errorMsg.toLowerCase().includes('já existe');
      
      toast.error(isDuplicate ? ErrorMessages.produtos.duplicateSku : ErrorMessages.produtos.saveFailed(isEditing), {
        description: isDuplicate ? "Use um código SKU único" : "Verifique os dados e tente novamente"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {isEditing ? "Editar" : "Novo"} Produto
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input 
                  id="sku" 
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  placeholder="Ex: ROUP-001 (deixe vazio para gerar automaticamente)"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nomeProduto">Nome Produto *</Label>
                <Input 
                  id="nomeProduto" 
                  value={formData.nomeProduto}
                  onChange={(e) => handleChange("nomeProduto", e.target.value)}
                  placeholder="Ex: Camiseta Básica Branca P"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select 
                  value={formData.categoria}
                  onValueChange={(value) => handleChange("categoria", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipoProduto">Tipo Produto *</Label>
                <Select 
                  value={formData.tipoProduto}
                  onValueChange={(value) => handleChange("tipoProduto", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposProduto.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantidadeAtual">Quantidade Atual {!isEditing && "*"}</Label>
                <Input 
                  id="quantidadeAtual" 
                  type="number"
                  min="0"
                  value={formData.quantidadeAtual}
                  onChange={(e) => handleChange("quantidadeAtual", parseInt(e.target.value) || 0)}
                  placeholder="Ex: 10"
                  disabled={isEditing}
                  required={!isEditing}
                />
                {isEditing && (
                  <p className="text-xs text-muted-foreground">Use a função de entrada de estoque para alterar a quantidade</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="unidadeMedida">Unidade de Medida</Label>
                <Select 
                  value={formData.unidadeMedida}
                  onValueChange={(value) => handleChange("unidadeMedida", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesMedida.map((unidade) => (
                      <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="precoUnitario">Preço Unitário (R$) *</Label>
                <Input 
                  id="precoUnitario" 
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.precoUnitario}
                  onChange={(e) => handleChange("precoUnitario", parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 29.90"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate("/estoque")}>
                Cancelar
              </Button>
              <Button type="submit" className="btn-gradient" disabled={isLoading}>
                {isLoading ? "Salvando..." : (isEditing ? "Atualizar" : "Cadastrar")} Produto
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default EstoqueProduto;

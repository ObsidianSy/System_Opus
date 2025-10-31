import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { salvarProduto, gerarSkuProduto, consultarEstoque, type ProdutoData, type ComponenteKit } from "@/services/n8nIntegration";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";

interface ProdutoFormProps {
  onSuccess?: () => void;
  produto?: Partial<ProdutoData>;
}

const ProdutoForm = ({ onSuccess, produto }: ProdutoFormProps) => {
  const [formData, setFormData] = useState<Partial<ProdutoData>>({
    SKU: produto?.SKU || "",
    "Nome Produto": produto?.["Nome Produto"] || "",
    "Categoria": produto?.["Categoria"] || "",
    "Tipo Produto": produto?.["Tipo Produto"] || "",
    "Quantidade Atual": produto?.["Quantidade Atual"] || 0,
    "Unidade de Medida": produto?.["Unidade de Medida"] || "UN",
    "Preço Unitário": produto?.["Preço Unitário"] || 0,
    "Componentes": produto?.["Componentes"] || []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [componenteSelecionado, setComponenteSelecionado] = useState("");
  const [quantidadeComponente, setQuantidadeComponente] = useState(1);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<any[]>([]);
  const [estoqueDerivado, setEstoqueDerivado] = useState(0);

  // Carregar produtos disponíveis
  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        const produtos = await consultarEstoque();
        setProdutosDisponiveis(produtos);
      } catch (error) {
        console.error("Erro ao carregar produtos:", error);
      }
    };
    carregarProdutos();
  }, []);

  // Recalcular preço e estoque quando componentes mudarem
  useEffect(() => {
    if (formData["Tipo Produto"] === "KIT" && formData["Componentes"]?.length) {
      // Calcular preço total do kit
      const precoTotal = formData["Componentes"].reduce((acc, comp) => {
        return acc + (comp["Preço Unitário"] * comp["Quantidade por Kit"]);
      }, 0);
      
      // Calcular estoque derivado (menor estoque disponível / qtd por kit)
      const estoques = formData["Componentes"].map(comp => {
        const produto = produtosDisponiveis.find(p => 
          (p.SKU || p.sku) === comp["SKU Componente"]
        );
        const qtdAtual = produto?.["Quantidade Atual"] || produto?.quantidade || 0;
        return Math.floor(qtdAtual / comp["Quantidade por Kit"]);
      });
      
      const menorEstoque = estoques.length > 0 ? Math.min(...estoques) : 0;
      setEstoqueDerivado(menorEstoque);
      
      // Auto-preencher preço (mas deixar editável)
      if (!produto || formData["Preço Unitário"] === 0) {
        setFormData(prev => ({ ...prev, "Preço Unitário": precoTotal }));
      }
    }
  }, [formData["Componentes"], formData["Tipo Produto"], produtosDisponiveis]);

  const categorias = [
    "Anéis", "Colares", "Brincos", "Pulseiras", "Correntes", 
    "Pingentes", "Acessórios", "Outros"
  ];

  const tiposProduto = ["Fabricado", "Importado", "Revenda", "KIT"];

  const handleInputChange = (field: keyof ProdutoData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-gerar SKU quando categoria for selecionada
    if (field === "Categoria" && typeof value === "string" && !formData.SKU) {
      setFormData(prev => ({
        ...prev,
        SKU: gerarSkuProduto(value)
      }));
    }
  };

  const handleAdicionarComponente = () => {
    if (!componenteSelecionado || quantidadeComponente <= 0) {
      toast.error("Selecione um componente e uma quantidade válida");
      return;
    }

    const produto = produtosDisponiveis.find(p => 
      (p.SKU || p.sku) === componenteSelecionado
    );

    if (!produto) {
      toast.error("Produto não encontrado");
      return;
    }

    // Verificar se é KIT
    if ((produto["Tipo Produto"] || produto.tipo_produto) === "KIT") {
      toast.error("No momento, kits não podem conter outros kits.");
      return;
    }

    const precoUnitario = produto["Preço Unitário"] || produto.preco_unitario || 0;

    const novoComponente: ComponenteKit = {
      "SKU Componente": componenteSelecionado,
      "Quantidade por Kit": quantidadeComponente,
      "Preço Unitário": precoUnitario
    };

    // Verificar se já existe esse componente
    const componentesAtuais = formData["Componentes"] || [];
    const indexExistente = componentesAtuais.findIndex(
      c => c["SKU Componente"] === componenteSelecionado
    );

    if (indexExistente >= 0) {
      // Somar quantidades
      const novosComponentes = [...componentesAtuais];
      novosComponentes[indexExistente]["Quantidade por Kit"] += quantidadeComponente;
      setFormData(prev => ({ ...prev, "Componentes": novosComponentes }));
    } else {
      // Adicionar novo
      setFormData(prev => ({
        ...prev,
        "Componentes": [...componentesAtuais, novoComponente]
      }));
    }

    // Limpar seleção
    setComponenteSelecionado("");
    setQuantidadeComponente(1);
  };

  const handleRemoverComponente = (index: number) => {
    const novosComponentes = [...(formData["Componentes"] || [])];
    novosComponentes.splice(index, 1);
    setFormData(prev => ({ ...prev, "Componentes": novosComponentes }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validação
      if (!formData["Nome Produto"] || !formData["Categoria"] || !formData["Tipo Produto"]) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }

      // Validação específica para KIT
      if (formData["Tipo Produto"] === "KIT") {
        if (!formData["Componentes"] || formData["Componentes"].length === 0) {
          toast.error("Adicione pelo menos um componente para salvar este kit.");
          return;
        }

        for (const comp of formData["Componentes"]) {
          if (comp["Quantidade por Kit"] <= 0) {
            toast.error("A quantidade por kit deve ser maior que zero");
            return;
          }
        }
      }

      const produtoData: ProdutoData = {
        SKU: formData.SKU || gerarSkuProduto(formData["Categoria"]!),
        "Nome Produto": formData["Nome Produto"]!,
        "Categoria": formData["Categoria"]!,
        "Tipo Produto": formData["Tipo Produto"]!,
        "Quantidade Atual": formData["Tipo Produto"] === "KIT" ? estoqueDerivado : (formData["Quantidade Atual"] || 0),
        "Unidade de Medida": formData["Unidade de Medida"] || "UN",
        "Preço Unitário": formData["Preço Unitário"] || 0,
        ...(formData["Tipo Produto"] === "KIT" && { "Componentes": formData["Componentes"] })
      };

      const success = await salvarProduto(produtoData);

      if (success) {
        toast.success(produto ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
        
        if (!produto) {
          // Limpar formulário apenas se for novo produto
          setFormData({
            SKU: "",
            "Nome Produto": "",
            "Categoria": "",
            "Tipo Produto": "",
            "Quantidade Atual": 0,
            "Unidade de Medida": "UN",
            "Preço Unitário": 0
          });
        }

        onSuccess?.();
      } else {
        toast.error("Erro ao salvar produto. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast.error("Erro inesperado ao salvar produto");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{produto ? "Editar Produto" : "Cadastrar Novo Produto"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU do Produto</Label>
              <Input
                id="sku"
                value={formData.SKU}
                onChange={(e) => handleInputChange("SKU", e.target.value)}
                placeholder="Ex: ANEL-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Produto *</Label>
              <Input
                id="nome"
                value={formData["Nome Produto"]}
                onChange={(e) => handleInputChange("Nome Produto", e.target.value)}
                placeholder="Ex: Anel Gótico Níquel"
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select 
                value={formData["Categoria"]} 
                onValueChange={(value) => handleInputChange("Categoria", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Produto *</Label>
              <Select 
                value={formData["Tipo Produto"]} 
                onValueChange={(value) => handleInputChange("Tipo Produto", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposProduto.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade Atual</Label>
              {formData["Tipo Produto"] === "KIT" ? (
                <div className="relative">
                  <Input
                    id="quantidade"
                    type="text"
                    value={`${estoqueDerivado} (Calculada automaticamente)`}
                    disabled
                    className="bg-muted"
                  />
                  <Badge variant="secondary" className="absolute right-2 top-2">
                    Derivada
                  </Badge>
                </div>
              ) : (
                <Input
                  id="quantidade"
                  type="number"
                  min="0"
                  value={formData["Quantidade Atual"]}
                  onChange={(e) => handleInputChange("Quantidade Atual", parseInt(e.target.value) || 0)}
                />
              )}
              {formData["Tipo Produto"] === "KIT" && (
                <p className="text-xs text-muted-foreground">
                  Este produto é um kit. O estoque é calculado automaticamente a partir dos componentes.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade de Medida</Label>
              <Select 
                value={formData["Unidade de Medida"]} 
                onValueChange={(value) => handleInputChange("Unidade de Medida", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UN">Unidade (UN)</SelectItem>
                  <SelectItem value="KG">Quilograma (KG)</SelectItem>
                  <SelectItem value="G">Grama (G)</SelectItem>
                  <SelectItem value="M">Metro (M)</SelectItem>
                  <SelectItem value="CM">Centímetro (CM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preco">Preço Unitário (R$)</Label>
              <Input
                id="preco"
                type="number"
                min="0"
                step="0.01"
                value={formData["Preço Unitário"]}
                onChange={(e) => handleInputChange("Preço Unitário", parseFloat(e.target.value) || 0)}
              />
              {formData["Tipo Produto"] === "KIT" && formData["Componentes"]?.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Preço sugerido pelos componentes: {formatCurrency(
                    formData["Componentes"].reduce((acc, c) => acc + (c["Preço Unitário"] * c["Quantidade por Kit"]), 0)
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Seção de Componentes do Kit */}
          {formData["Tipo Produto"] === "KIT" && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Componentes do Kit</CardTitle>
                <CardDescription>
                  Adicione os produtos que compõem este kit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="componente">SKU do Componente</Label>
                    <Select value={componenteSelecionado} onValueChange={setComponenteSelecionado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtosDisponiveis
                          .filter(p => (p["Tipo Produto"] || p.tipo_produto) !== "KIT")
                          .map(p => (
                            <SelectItem key={p.SKU || p.sku} value={p.SKU || p.sku}>
                              {p.SKU || p.sku} — {p["Nome Produto"] || p.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qtd-componente">Quantidade por Kit</Label>
                    <div className="flex gap-2">
                      <Input
                        id="qtd-componente"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantidadeComponente}
                        onChange={(e) => setQuantidadeComponente(parseFloat(e.target.value) || 0)}
                      />
                      <Button
                        type="button"
                        onClick={handleAdicionarComponente}
                        size="icon"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {formData["Componentes"] && formData["Componentes"].length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU do Componente</TableHead>
                        <TableHead className="text-right">Quantidade por Kit</TableHead>
                        <TableHead className="text-right">Preço Unitário</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData["Componentes"].map((comp, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{comp["SKU Componente"]}</TableCell>
                          <TableCell className="text-right">{comp["Quantidade por Kit"]}</TableCell>
                          <TableCell className="text-right">{formatCurrency(comp["Preço Unitário"])}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(comp["Preço Unitário"] * comp["Quantidade por Kit"])}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoverComponente(index)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading 
              ? (produto ? "Atualizando..." : "Cadastrando...") 
              : (produto ? "Atualizar Produto" : "Cadastrar Produto")
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProdutoForm;
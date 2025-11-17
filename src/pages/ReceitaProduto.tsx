import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { ErrorMessages } from "@/utils/errorMessages";
import { consultarDados, salvarReceitaProduto, gerarIdReceita, type ReceitaProdutoData } from "@/services/n8nIntegration";

interface Produto {
  SKU: string;
  "Nome Produto": string;
  Categoria: string;
}

interface MateriaPrima {
  "SKU Matéria-Prima": string;
  "Nome Matéria-Prima": string;
  "Categoria MP": string;
  "Unidade de Medida": string;
}

interface ReceitaItem {
  "SKU Produto": string;
  "SKU Matéria-Prima": string;
  "Quantidade por Produto": number;
  "Unidade de Medida"?: string;
}

interface ReceitaFormData {
  skuProduto: string;
  materiasPrimas: {
    skuMateriaPrima: string;
    quantidade: string;
    unidadeMedida: string;
  }[];
}

const ReceitaProduto = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [receitas, setReceitas] = useState<ReceitaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState<ReceitaFormData>({
    skuProduto: "",
    materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState<ReceitaFormData>({
    skuProduto: "",
    materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
  });

  // Funções helper definidas antes do useEffect
  const getProdutoNome = (sku: string) => {
    const produto = produtos.find(p => p.SKU === sku);
    return produto ? produto["Nome Produto"] : sku;
  };

  const getMateriaPrimaNome = (sku: string) => {
    const mp = materiasPrimas.find(m => m["SKU Matéria-Prima"] === sku);
    return mp ? mp["Nome Matéria-Prima"] : sku;
  };

  const getReceitasPorProduto = (skuProduto: string) => {
    return receitas.filter(receita => receita["SKU Produto"] === skuProduto);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosProdutos, dadosMateriaPrima, dadosReceitas] = await Promise.all([
        consultarDados('Estoque'),
        consultarDados('Estoque_MateriaPrima'),
        consultarDados('Receita_Produto')
      ]);

      setProdutos(Array.isArray(dadosProdutos) ? dadosProdutos : []);
      setMateriasPrimas(Array.isArray(dadosMateriaPrima) ? dadosMateriaPrima : []);
      setReceitas(Array.isArray(dadosReceitas) ? dadosReceitas : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error(ErrorMessages.receitas.loadFailed);
      // Inicializar com arrays vazios em caso de erro
      setProdutos([]);
      setMateriasPrimas([]);
      setReceitas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMateriaPrima = () => {
    setFormData(prev => ({
      ...prev,
      materiasPrimas: [...prev.materiasPrimas, { skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
    }));
  };

  const handleRemoveMateriaPrima = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.filter((_, i) => i !== index)
    }));
  };

  const handleMateriaPrimaChange = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.map((mp, i) =>
        i === index ? { ...mp, [field]: value } : mp
      )
    }));
  };

  const handleSubmit = async () => {
    try {
      const validMateriasPrimas = formData.materiasPrimas
        .filter(mp => mp.skuMateriaPrima && mp.quantidade && parseFloat(mp.quantidade) > 0);

      if (validMateriasPrimas.length === 0) {
        toast.error("Adicione pelo menos uma matéria-prima com quantidade válida");
        return;
      }

      const receitaData: ReceitaProdutoData = {
        "SKU Produto": formData.skuProduto,
        items: validMateriasPrimas.map(mp => ({
          "SKU Matéria-Prima": mp.skuMateriaPrima,
          "Quantidade por Produto": parseFloat(mp.quantidade),
          "Unidade de Medida": mp.unidadeMedida
        }))
      };

      await salvarReceitaProduto(receitaData);
      toast.success(ErrorMessages.receitas.saveSuccess(false));
      setShowAddDialog(false);
      setFormData({
        skuProduto: "",
        materiasPrimas: [{ skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
      });
      carregarDados();
    } catch (error) {
      console.error("Erro ao salvar receita:", error);
      toast.error(ErrorMessages.receitas.saveFailed((error as any)?.message));
    }
  };

  const handleOpenEdit = (skuProduto: string) => {
    const receitasDoProduto = getReceitasPorProduto(skuProduto);
    if (!receitasDoProduto || receitasDoProduto.length === 0) {
      toast.error(ErrorMessages.receitas.notFound);
      return;
    }
    setEditFormData({
      skuProduto,
      materiasPrimas: receitasDoProduto.map(r => ({
        skuMateriaPrima: r["SKU Matéria-Prima"],
        quantidade: String(r["Quantidade por Produto"] ?? ""),
        unidadeMedida: r["Unidade de Medida"] ?? ""
      }))
    });
    setShowEditDialog(true);
  };

  const handleEditAddMateriaPrima = () => {
    setEditFormData(prev => ({
      ...prev,
      materiasPrimas: [...prev.materiasPrimas, { skuMateriaPrima: "", quantidade: "", unidadeMedida: "" }]
    }));
  };

  const handleEditRemoveMateriaPrima = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.filter((_, i) => i !== index)
    }));
  };

  const handleEditMateriaPrimaChange = (index: number, field: string, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      materiasPrimas: prev.materiasPrimas.map((mp, i) =>
        i === index ? { ...mp, [field]: value } : mp
      )
    }));
  };

  const handleUpdate = async () => {
    try {
      const validMateriasPrimas = editFormData.materiasPrimas
        .filter(mp => mp.skuMateriaPrima && mp.quantidade && parseFloat(mp.quantidade) > 0);

      if (validMateriasPrimas.length === 0) {
        toast.error("Adicione pelo menos uma matéria-prima com quantidade válida");
        return;
      }

      const receitaData: ReceitaProdutoData = {
        "SKU Produto": editFormData.skuProduto,
        items: validMateriasPrimas.map(mp => ({
          "SKU Matéria-Prima": mp.skuMateriaPrima,
          "Quantidade por Produto": parseFloat(mp.quantidade),
          "Unidade de Medida": mp.unidadeMedida
        }))
      };

      await salvarReceitaProduto(receitaData);
      toast.success(ErrorMessages.receitas.saveSuccess(true));
      setShowEditDialog(false);
      carregarDados();
    } catch (error) {
      console.error("Erro ao atualizar receita:", error);
      toast.error(ErrorMessages.receitas.saveFailed((error as any)?.message));
    }
  };

  const filteredReceitas = receitas.filter(receita =>
    receita["SKU Produto"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receita["SKU Matéria-Prima"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getMateriaPrimaNome(receita["SKU Matéria-Prima"])?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Carregando dados...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Receita de Produtos
            </h1>
            <p className="text-muted-foreground">
              Gerencie as receitas e consulte matérias-primas por produto
            </p>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="h-4 w-4 mr-2" />
                Nova Receita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Cadastrar Receita de Produto</h2>
                  <p className="text-muted-foreground">
                    Adicione múltiplas matérias-primas para um produto
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Produto *</Label>
                    <Select onValueChange={(value) => setFormData(prev => ({ ...prev, skuProduto: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.filter(produto => produto.SKU && produto.SKU.trim() !== "").map((produto) => (
                          <SelectItem key={produto.SKU} value={produto.SKU}>
                            {produto.SKU} - {produto["Nome Produto"] || ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Matérias-Primas *</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddMateriaPrima}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Matéria-Prima
                      </Button>
                    </div>

                    {formData.materiasPrimas.map((mp, index) => (
                      <Card key={index} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Matéria-Prima</Label>
                            <Select onValueChange={(value) => handleMateriaPrimaChange(index, "skuMateriaPrima", value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {materiasPrimas.filter(mp => mp["SKU Matéria-Prima"] && mp["SKU Matéria-Prima"].trim() !== "").map((materiaPrima) => (
                                  <SelectItem key={materiaPrima["SKU Matéria-Prima"]} value={materiaPrima["SKU Matéria-Prima"]}>
                                    {materiaPrima["SKU Matéria-Prima"]} - {materiaPrima["Nome Matéria-Prima"] || ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={mp.quantidade}
                              onChange={(e) => handleMateriaPrimaChange(index, "quantidade", e.target.value)}
                              placeholder="Ex: 2"
                            />
                          </div>

                          <div>
                            <Label>Unidade</Label>
                            <Select onValueChange={(value) => handleMateriaPrimaChange(index, "unidadeMedida", value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Unidade" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="UN">Unidade</SelectItem>
                                <SelectItem value="KG">Quilograma</SelectItem>
                                <SelectItem value="G">Grama</SelectItem>
                                <SelectItem value="MT">Metro</SelectItem>
                                <SelectItem value="CM">Centímetro</SelectItem>
                                <SelectItem value="LT">Litro</SelectItem>
                                <SelectItem value="ML">Mililitro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMateriaPrima(index)}
                              disabled={formData.materiasPrimas.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!formData.skuProduto}>
                      Salvar Receita
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="cadastro" className="space-y-6">
          <TabsList>
            <TabsTrigger value="cadastro">Cadastro de Receitas</TabsTrigger>
            <TabsTrigger value="consulta">Consulta por Produto</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Receitas Cadastradas</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar por produto ou matéria-prima..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Produto</TableHead>
                      <TableHead>Nome Produto</TableHead>
                      <TableHead>SKU Matéria-Prima</TableHead>
                      <TableHead>Nome Matéria-Prima</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceitas.map((receita, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{receita["SKU Produto"]}</TableCell>
                        <TableCell>{getProdutoNome(receita["SKU Produto"])}</TableCell>
                        <TableCell>{receita["SKU Matéria-Prima"]}</TableCell>
                        <TableCell>{getMateriaPrimaNome(receita["SKU Matéria-Prima"])}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {receita["Quantidade por Produto"]} {receita["Unidade de Medida"] || "UN"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(receita["SKU Produto"])}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consulta" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Consulta de Receita por Produto</CardTitle>
                <div>
                  <Label>Selecione um produto para ver sua receita</Label>
                  <Select onValueChange={setSelectedProduct}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.filter(produto => produto.SKU && produto.SKU.trim() !== "").map((produto) => (
                        <SelectItem key={produto.SKU} value={produto.SKU}>
                          {produto.SKU} - {produto["Nome Produto"] || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              {selectedProduct && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <h3 className="text-lg font-semibold">
                        {selectedProduct} - {getProdutoNome(selectedProduct)}
                      </h3>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU Matéria-Prima</TableHead>
                          <TableHead>Nome Matéria-Prima</TableHead>
                          <TableHead>Quantidade por Produto</TableHead>
                          <TableHead>Unidade de Medida</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getReceitasPorProduto(selectedProduct).map((receita, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{receita["SKU Matéria-Prima"]}</TableCell>
                            <TableCell>{getMateriaPrimaNome(receita["SKU Matéria-Prima"])}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {receita["Quantidade por Produto"]}
                              </Badge>
                            </TableCell>
                            <TableCell>{receita["Unidade de Medida"] || "UN"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {getReceitasPorProduto(selectedProduct).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma receita cadastrada para este produto</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Editar Receita do Produto</h2>
                <p className="text-muted-foreground">
                  Atualize as matérias-primas deste produto
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Produto</Label>
                  <Select value={editFormData.skuProduto} disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.filter(produto => produto.SKU && produto.SKU.trim() !== "").map((produto) => (
                        <SelectItem key={produto.SKU} value={produto.SKU}>
                          {produto.SKU} - {produto["Nome Produto"] || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Matérias-Primas</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleEditAddMateriaPrima}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Matéria-Prima
                    </Button>
                  </div>

                  {editFormData.materiasPrimas.map((mp, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label>Matéria-Prima</Label>
                          <Select
                            value={mp.skuMateriaPrima}
                            onValueChange={(value) => handleEditMateriaPrimaChange(index, "skuMateriaPrima", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {materiasPrimas.filter(mp => mp["SKU Matéria-Prima"] && mp["SKU Matéria-Prima"].trim() !== "").map((materiaPrima) => (
                                <SelectItem key={materiaPrima["SKU Matéria-Prima"]} value={materiaPrima["SKU Matéria-Prima"]}>
                                  {materiaPrima["SKU Matéria-Prima"]} - {materiaPrima["Nome Matéria-Prima"] || ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={mp.quantidade}
                            onChange={(e) => handleEditMateriaPrimaChange(index, "quantidade", e.target.value)}
                            placeholder="Ex: 2"
                          />
                        </div>

                        <div>
                          <Label>Unidade</Label>
                          <Select
                            value={mp.unidadeMedida}
                            onValueChange={(value) => handleEditMateriaPrimaChange(index, "unidadeMedida", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Unidade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UN">Unidade</SelectItem>
                              <SelectItem value="KG">Quilograma</SelectItem>
                              <SelectItem value="G">Grama</SelectItem>
                              <SelectItem value="MT">Metro</SelectItem>
                              <SelectItem value="CM">Centímetro</SelectItem>
                              <SelectItem value="LT">Litro</SelectItem>
                              <SelectItem value="ML">Mililitro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRemoveMateriaPrima(index)}
                            disabled={editFormData.materiasPrimas.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdate} disabled={!editFormData.skuProduto}>
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
};

export default ReceitaProduto;
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Scan, Minus, Plus as PlusIcon, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { 
  criarVenda, 
  consultarClientes, 
  consultarEstoque,
  gerarIdVenda,
  type VendaData,
  type VendaItem
} from "@/services/n8nIntegration";
import { sortBySKU } from "@/utils/sortUtils";

interface VendaFormProps {
  onSuccess?: () => void;
}

interface Cliente {
  "ID Cliente": string;
  "Cliente": string;
}

interface Produto {
  "SKU": string;
  "Nome Produto": string;
  "Preço Unitário": string;
  "Quantidade Atual": number;
}

const VendaForm = ({ onSuccess }: VendaFormProps) => {
  const [formData, setFormData] = useState({
    "Data Venda": (new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
    "Nome Cliente": ""
  });
  
  const [items, setItems] = useState<VendaItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    "SKU Produto": "",
    "Nome Produto": "",
    "Quantidade Vendida": 1,
    "Preço Unitário": 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [openProduto, setOpenProduto] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    carregarClientes();
    carregarProdutos();
  }, []);

  const carregarClientes = async () => {
    try {
      const dados = await consultarClientes();
      const clientesFormatados = dados.map((item: any) => ({
        "ID Cliente": item["ID Cliente"] || "",
        "Cliente": item["Nome"] || item["Cliente"] || ""
      }));
      setClientes(clientesFormatados.filter(c => c["Cliente"].trim() !== ""));
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar lista de clientes');
    }
  };

  const carregarProdutos = async () => {
    try {
      const dados = await consultarEstoque();
      const produtosFormatados = dados.map((item: any) => ({
        "SKU": item["SKU"] || "",
        "Nome Produto": item["Nome Produto"] || "",
        "Preço Unitário": item["Preço Unitário"] || 0,
        "Quantidade Atual": item["Quantidade Atual"] || 0
      }));
      
      const produtosFiltrados = produtosFormatados.filter(p => p["SKU"].trim() !== "");
      const produtosOrdenados = sortBySKU(produtosFiltrados, "SKU");
      
      setProdutos(produtosOrdenados);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const handleSelectCliente = (clienteNome: string) => {
    setFormData(prev => ({
      ...prev,
      "Nome Cliente": clienteNome
    }));
  };

  const handleSelectProduto = (sku: string) => {
    const produto = produtos.find(p => p["SKU"] === sku);
    if (produto) {
      setCurrentItem(prev => ({
        ...prev,
        "SKU Produto": sku,
        "Nome Produto": produto["Nome Produto"],
        "Preço Unitário": parseFloat(produto["Preço Unitário"]) || 0
      }));
    }
  };

  const handleAddItem = () => {
    if (!currentItem["SKU Produto"] || currentItem["Quantidade Vendida"] <= 0) {
      toast.error("Selecione um produto e quantidade válida");
      return;
    }

    // Verificar estoque disponível
    const produto = produtos.find(p => p["SKU"] === currentItem["SKU Produto"]);
    if (produto && produto["Quantidade Atual"] < currentItem["Quantidade Vendida"]) {
      toast.error("Estoque insuficiente", {
        description: `Disponível: ${produto["Quantidade Atual"]} unidades`
      });
      return;
    }

    // Verificar se produto já foi adicionado - se sim, somar quantidade
    const itemExistentIndex = items.findIndex(item => item["SKU Produto"] === currentItem["SKU Produto"]);
    if (itemExistentIndex !== -1) {
      const novaQuantidade = items[itemExistentIndex]["Quantidade Vendida"] + currentItem["Quantidade Vendida"];
      const produto = produtos.find(p => p["SKU"] === currentItem["SKU Produto"]);
      
      if (produto && produto["Quantidade Atual"] < novaQuantidade) {
        toast.error("Estoque insuficiente", {
          description: `Disponível: ${produto["Quantidade Atual"]} unidades`
        });
        return;
      }
      
      setItems(prev => prev.map((item, i) => 
        i === itemExistentIndex ? { ...item, "Quantidade Vendida": novaQuantidade } : item
      ));
      toast.success(`Quantidade atualizada para ${novaQuantidade}`);
    } else {
      setItems(prev => [...prev, { ...currentItem }]);
      toast.success("Item adicionado à venda");
    }
    
    // Limpar item atual
    setCurrentItem({
      "SKU Produto": "",
      "Nome Produto": "",
      "Quantidade Vendida": 1,
      "Preço Unitário": 0
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    toast.success("Item removido da venda");
  };

  const handleEditQuantity = (index: number, novaQuantidade: number) => {
    if (novaQuantidade <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }

    const item = items[index];
    const produto = produtos.find(p => p["SKU"] === item["SKU Produto"]);
    
    if (produto && produto["Quantidade Atual"] < novaQuantidade) {
      toast.error("Estoque insuficiente", {
        description: `Disponível: ${produto["Quantidade Atual"]} unidades`
      });
      return;
    }

    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, "Quantidade Vendida": novaQuantidade } : item
    ));
    setEditingItemIndex(null);
    toast.success("Quantidade atualizada");
  };

  const buscarPorCodigo = () => {
    if (!codigoBarras.trim()) {
      toast.error("Digite um código para buscar");
      return;
    }

    const produto = produtos.find(p => 
      p["SKU"].toLowerCase() === codigoBarras.toLowerCase() ||
      p["Nome Produto"].toLowerCase().includes(codigoBarras.toLowerCase())
    );

    if (produto) {
      handleSelectProduto(produto["SKU"]);
      setCodigoBarras("");
      
      // Auto-adicionar se tiver estoque
      if (produto["Quantidade Atual"] > 0) {
        const itemExistenteIndex = items.findIndex(item => item["SKU Produto"] === produto["SKU"]);
        if (itemExistenteIndex !== -1) {
          const novaQuantidade = items[itemExistenteIndex]["Quantidade Vendida"] + 1;
          if (produto["Quantidade Atual"] >= novaQuantidade) {
            setItems(prev => prev.map((item, i) => 
              i === itemExistenteIndex ? { ...item, "Quantidade Vendida": novaQuantidade } : item
            ));
            toast.success(`Quantidade atualizada para ${novaQuantidade}`);
          } else {
            toast.error("Estoque insuficiente");
          }
        } else {
          const newItem = {
            "SKU Produto": produto["SKU"],
            "Nome Produto": produto["Nome Produto"],
            "Quantidade Vendida": 1,
            "Preço Unitário": parseFloat(produto["Preço Unitário"]) || 0
          };
          setItems(prev => [...prev, newItem]);
          toast.success(`${produto["Nome Produto"]} adicionado à venda`);
        }
      } else {
        toast.warning("Produto sem estoque disponível");
      }
    } else {
      toast.error("Produto não encontrado", {
        description: `Código: ${codigoBarras}`
      });
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    
    // Cleanup previous scanner
    if (scanner) {
      scanner.clear().catch(console.error);
    }
    
    const html5QrcodeScanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        supportedScanTypes: [0, 1] // QR Code and Code 128
      },
      false
    );

    setScanner(html5QrcodeScanner);

    html5QrcodeScanner.render(
      (decodedText) => {
        setCodigoBarras(decodedText);
        stopScanning();
        
        // Buscar automaticamente após scan
        setTimeout(() => {
          const produto = produtos.find(p => 
            p["SKU"].toLowerCase() === decodedText.toLowerCase() ||
            p["Nome Produto"].toLowerCase().includes(decodedText.toLowerCase())
          );

          if (produto) {
            setCodigoBarras(decodedText);
            toast.success(`Produto escaneado: ${produto["Nome Produto"]}`);
            
            if (produto["Quantidade Atual"] > 0) {
              const itemExistenteIndex = items.findIndex(item => item["SKU Produto"] === produto["SKU"]);
              if (itemExistenteIndex !== -1) {
                const novaQuantidade = items[itemExistenteIndex]["Quantidade Vendida"] + 1;
                if (produto["Quantidade Atual"] >= novaQuantidade) {
                  setItems(prev => prev.map((item, i) => 
                    i === itemExistenteIndex ? { ...item, "Quantidade Vendida": novaQuantidade } : item
                  ));
                  toast.success(`Quantidade atualizada para ${novaQuantidade}`);
                } else {
                  toast.error("Estoque insuficiente");
                }
              } else {
                const newItem = {
                  "SKU Produto": produto["SKU"],
                  "Nome Produto": produto["Nome Produto"],
                  "Quantidade Vendida": 1,
                  "Preço Unitário": parseFloat(produto["Preço Unitário"]) || 0
                };
                setItems(prev => [...prev, newItem]);
                toast.success("Item adicionado automaticamente à venda");
              }
            }
          } else {
            toast.error("Produto não encontrado no estoque");
          }
        }, 100);
      },
      (error) => {
        // Silenciar erros comuns do scanner
        if (!error.includes("NotFound") && !error.includes("NotAllowed")) {
          console.log("Scanner error:", error);
        }
      }
    );
  };

  const stopScanning = () => {
    setIsScanning(false);
    if (scanner) {
      scanner.clear().catch(console.error);
      setScanner(null);
    }
  };

  const calcularTotal = () => {
    return items.reduce((total, item) => 
      total + (item["Quantidade Vendida"] * item["Preço Unitário"]), 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validação
      if (!formData["Nome Cliente"]) {
        toast.error("Selecione um cliente");
        return;
      }

      if (items.length === 0) {
        toast.error("Adicione pelo menos um item à venda");
        return;
      }

      const vendaData: VendaData = {
        "ID Venda": gerarIdVenda(),
        "Data Venda": formData["Data Venda"],
        "Nome Cliente": formData["Nome Cliente"],
        "items": items
      };

      const success = await criarVenda(vendaData);

      if (success) {
        toast.success("Venda registrada com sucesso!");
        
        // Limpar formulário
        setFormData({
          "Data Venda": (new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0],
          "Nome Cliente": ""
        });
        setItems([]);
        setCurrentItem({
          "SKU Produto": "",
          "Nome Produto": "",
          "Quantidade Vendida": 1,
          "Preço Unitário": 0
        });

        onSuccess?.();
      } else {
        toast.error("Erro ao registrar venda. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao registrar venda:", error);
      toast.error("Erro inesperado ao registrar venda");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Nova Venda</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados gerais da venda */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data-venda">Data da Venda *</Label>
              <Input
                id="data-venda"
                type="date"
                value={formData["Data Venda"]}
                onChange={(e) => setFormData(prev => ({ ...prev, "Data Venda": e.target.value }))}
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
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente["ID Cliente"]} value={cliente["Cliente"]}>
                      {cliente["Cliente"]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Adicionar itens */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Adicionar Produtos</h3>
            
            {/* Seção Bipagem / Código de Barras */}
            <Card className="p-4">
              <h4 className="font-medium mb-3">Bipagem / Código de Barras</h4>
              
              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <Input
                    placeholder="Digite ou escaneie o código de barras / SKU"
                    value={codigoBarras}
                    onChange={(e) => setCodigoBarras(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        buscarPorCodigo();
                      }
                    }}
                  />
                </div>
                <Button type="button" onClick={buscarPorCodigo}>
                  Buscar
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={isScanning ? stopScanning : startScanning}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  {isScanning ? "Parar" : "Scanner"}
                </Button>
              </div>

              {isScanning && (
                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">Aponte a câmera para o código de barras</p>
                  <div id="qr-reader" className="w-full"></div>
                </div>
              )}
            </Card>
            
            {/* Seleção Manual de Produto */}
            <Card className="p-4">
              <h4 className="font-medium mb-3">Ou Selecione Manualmente</h4>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="produto">SKU *</Label>
                  <Popover open={openProduto} onOpenChange={setOpenProduto} modal={false}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openProduto}
                        className="w-full justify-between"
                      >
                        {currentItem["SKU Produto"] || "Selecione SKU"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 max-h-80 overflow-auto z-50">
                      <Command>
                        <CommandInput placeholder="Pesquisar SKU..." />
                        <CommandList className="max-h-72 overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}>
                          <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                          <CommandGroup>
                            {produtos.map((produto) => (
                              <CommandItem
                                key={produto["SKU"]}
                                value={produto["SKU"]}
                                onSelect={() => {
                                  handleSelectProduto(produto["SKU"]);
                                  setOpenProduto(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    currentItem["SKU Produto"] === produto["SKU"] ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {produto["SKU"]} (Estoque: {produto["Quantidade Atual"]})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    value={currentItem["Quantidade Vendida"]}
                    onChange={(e) => setCurrentItem(prev => ({ 
                      ...prev, 
                      "Quantidade Vendida": parseInt(e.target.value) || 1 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button type="button" onClick={handleAddItem} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Lista de itens */}
          {items.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Itens da Venda</h3>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Preço Unit.</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item["SKU Produto"]}</TableCell>
                      <TableCell>{item["Nome Produto"]}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditQuantity(index, item["Quantidade Vendida"] - 1)}
                            disabled={item["Quantidade Vendida"] <= 1}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          
                          {editingItemIndex === index ? (
                            <Input
                              type="number"
                              min="1"
                              value={item["Quantidade Vendida"]}
                              onChange={(e) => {
                                const novaQuantidade = parseInt(e.target.value) || 1;
                                setItems(prev => prev.map((it, i) => 
                                  i === index ? { ...it, "Quantidade Vendida": novaQuantidade } : it
                                ));
                              }}
                              onBlur={() => setEditingItemIndex(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setEditingItemIndex(null);
                                }
                              }}
                              className="w-16 text-center"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="min-w-[2rem] text-center cursor-pointer hover:bg-muted rounded px-2 py-1"
                              onClick={() => setEditingItemIndex(index)}
                            >
                              {item["Quantidade Vendida"]}
                            </span>
                          )}
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditQuantity(index, item["Quantidade Vendida"] + 1)}
                          >
                            <PlusIcon className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingItemIndex(editingItemIndex === index ? null : index)}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>R$ {item["Preço Unitário"].toFixed(2)}</TableCell>
                      <TableCell>R$ {(item["Quantidade Vendida"] * item["Preço Unitário"]).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={4} className="text-right">Total da Venda:</TableCell>
                    <TableCell>R$ {calcularTotal().toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || items.length === 0}>
            {isLoading ? "Registrando..." : "Registrar Venda"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default VendaForm;
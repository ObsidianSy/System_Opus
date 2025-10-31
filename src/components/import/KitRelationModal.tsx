import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Search, Package, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { importService } from '@/services/importService';
import { sortBySKU } from '@/utils/sortUtils';

interface KitComponent {
  sku: string;
  quantidade: number;
}

interface KitRelationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKitRelated: (kitSku: string) => void;
  rawId: number;
  skuOriginal: string;
  availableProducts: any[];
}

export function KitRelationModal({
  isOpen,
  onClose,
  onKitRelated,
  rawId,
  skuOriginal,
  availableProducts,
}: KitRelationModalProps) {
  const [components, setComponents] = useState<KitComponent[]>([{ sku: '', quantidade: 1 }]);
  const [nomeKit, setNomeKit] = useState('');
  const [categoria, setCategoria] = useState('');
  const [precoUnitario, setPrecoUnitario] = useState<number>(0);
  const [searchResult, setSearchResult] = useState<{ found: boolean; sku?: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRelating, setIsRelating] = useState(false);
  
  const { toast } = useToast();

  // Filtrar apenas produtos físicos (não KITs)
  const physicalProducts = availableProducts.filter(
    (p) => p && (p['Tipo Produto'] || p.tipo_produto) !== 'KIT'
  );

  // Calcular preço automático quando componentes mudam
  useEffect(() => {
    let total = 0;
    components.forEach((comp) => {
      if (comp.sku && comp.quantidade > 0) {
        const produto = physicalProducts.find((p) => (p.SKU || p.sku) === comp.sku);
        if (produto) {
          const preco = parseFloat(produto['Preço Unitário'] || produto.preco_unitario || 0);
          total += preco * comp.quantidade;
        }
      }
    });
    setPrecoUnitario(total);
  }, [components, physicalProducts]);

  const addComponent = () => {
    setComponents([...components, { sku: '', quantidade: 1 }]);
  };

  const removeComponent = (index: number) => {
    if (components.length > 1) {
      setComponents(components.filter((_, i) => i !== index));
    }
  };

  const updateComponent = (index: number, field: 'sku' | 'quantidade', value: string | number) => {
    const newComponents = [...components];
    if (field === 'sku') {
      // Se o SKU já existe, somar quantidades
      const existingIndex = newComponents.findIndex((c, i) => i !== index && c.sku === value);
      if (existingIndex >= 0) {
        newComponents[existingIndex].quantidade += newComponents[index].quantidade;
        newComponents.splice(index, 1);
      } else {
        newComponents[index][field] = value as string;
      }
    } else {
      newComponents[index][field] = value as number;
    }
    setComponents(newComponents);
  };

  const validateComponents = (): boolean => {
    // Pelo menos um componente com SKU válido
    const validComponents = components.filter((c) => c.sku && c.quantidade > 0);
    if (validComponents.length === 0) {
      toast({
        title: 'Validação',
        description: 'Adicione pelo menos um componente ao kit.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleSearchExisting = async () => {
    if (!validateComponents()) return;

    setIsSearching(true);
    setSearchResult(null);

    try {
      const componentsPayload = components
        .filter((c) => c.sku && c.quantidade > 0)
        .map((c) => ({ sku: c.sku.toUpperCase(), q: c.quantidade }));

      console.log('🔍 [Modal] Buscando kit existente:', { components: componentsPayload });

      const result = await importService.findKitByComposition(componentsPayload);
      
      console.log('📦 [Modal] Resultado completo recebido:', result);
      console.log('🎯 [Modal] sku_kit extraído:', result.sku_kit);

      // Validação robusta: verificar se sku_kit é uma string não-vazia
      const isValidSku = result.sku_kit && 
                        typeof result.sku_kit === 'string' && 
                        result.sku_kit.trim().length > 0;

      console.log('✅ [Modal] SKU válido?', isValidSku, '| Valor:', result.sku_kit);
      
      if (isValidSku) {
        const skuTrimmed = result.sku_kit.trim();
        console.log('🎉 [Modal] Kit encontrado:', skuTrimmed);
        
        setSearchResult({ found: true, sku: skuTrimmed });
        toast({
          title: 'Kit encontrado',
          description: `Kit existente: ${skuTrimmed}`,
        });
      } else {
        console.log('❌ [Modal] Nenhum kit encontrado (sku_kit vazio ou null)');
        
        setSearchResult({ found: false });
        toast({
          title: 'Kit não encontrado',
          description: 'Nenhum kit existente encontrado. Você pode criar um novo.',
        });
      }
    } catch (error) {
      console.error('❌ [Modal] Erro ao buscar kit:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível verificar o kit. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateAndRelate = async () => {
    if (!validateComponents()) return;

    try {
      const componentsPayload = components
        .filter((c) => c.sku && c.quantidade > 0)
        .map((c) => ({ sku: c.sku.toUpperCase(), q: c.quantidade }));

      const payload = {
        raw_id: rawId,
        kit: {
          nome: nomeKit || skuOriginal,
          categoria: categoria || 'Sem Categoria',
          preco_unitario: precoUnitario,
        },
        components: componentsPayload,
      };

      console.log('✨ Criando kit e relacionando:', payload);

      const { sku_kit } = await importService.createKitAndRelate(payload);
      
      toast({
        title: 'Kit criado',
        description: `Kit criado e item relacionado com sucesso: ${sku_kit}`,
      });

      onKitRelated(sku_kit);
      onClose();
    } catch (error: any) {
      console.error('Erro ao criar kit:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível criar o kit. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleRelateExisting = async () => {
    if (!searchResult?.sku) return;

    setIsRelating(true);
    
    const payload = {
      raw_id: rawId,
      sku: searchResult.sku,
      source: 'direct' as const,
      learn_alias: true,
      alias_text: skuOriginal,
    };
    
    console.log('🚀 [KitRelationModal] Enviando para relateItem:', payload);

    try {
      const result = await importService.relateItem(payload);

      if (result.ok) {
        toast({
          title: 'Kit relacionado',
          description: `Item relacionado ao kit ${searchResult.sku}`,
        });
        onKitRelated(searchResult.sku);
        onClose();
      } else {
        // Mensagens de erro específicas
        const errorMessages: Record<string, string> = {
          raw_not_found: 'Item não encontrado (raw_id inválido)',
          already_related: 'Este item já está relacionado',
          invalid_payload: 'Dados inválidos enviados ao servidor',
          sku_empty: 'SKU está vazio',
          source_invalid: 'Tipo de relacionamento inválido',
          timeout: 'Tempo limite excedido (30s)',
          network_error: 'Erro de rede - verifique sua conexão',
        };
        
        toast({
          title: 'Erro ao relacionar',
          description: errorMessages[result.error || ''] || result.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('❌ [KitRelationModal] Exceção:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao relacionar o kit. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsRelating(false);
    }
  };

  const getComponentPrice = (sku: string): number => {
    const produto = physicalProducts.find((p) => (p.SKU || p.sku) === sku);
    return parseFloat(produto?.['Preço Unitário'] || produto?.preco_unitario || 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Relacionar como KIT
          </DialogTitle>
          <DialogDescription>
            Monte os componentes que formam este kit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info do item original */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              SKU Original: <strong>{skuOriginal}</strong>
            </AlertDescription>
          </Alert>

          {/* Resultado da busca */}
          {searchResult && (
            <Alert className={searchResult.found ? 'border-success bg-success/10' : 'border-warning bg-warning/10'}>
              {searchResult.found ? (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertDescription>
                    ✅ Kit existente encontrado: <strong>{searchResult.sku}</strong>
                  </AlertDescription>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <AlertDescription>
                    ⚠️ Nenhum kit encontrado com essa composição. Você pode criar um novo kit.
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}

          {/* Tabela de componentes */}
          <div className="space-y-2">
            <Label>Componentes do KIT *</Label>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU do Componente</TableHead>
                    <TableHead className="w-[150px]">Quantidade</TableHead>
                    <TableHead className="w-[120px]">Preço Unit.</TableHead>
                    <TableHead className="w-[120px]">Subtotal</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((comp, index) => {
                    const price = comp.sku ? getComponentPrice(comp.sku) : 0;
                    const subtotal = price * comp.quantidade;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={comp.sku}
                            onValueChange={(value) => updateComponent(index, 'sku', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione SKU" />
                            </SelectTrigger>
                            <SelectContent>
                              {sortBySKU(physicalProducts, (p) => String(p.SKU || p.sku)).map((produto) => (
                                <SelectItem key={String(produto.SKU || produto.sku)} value={String(produto.SKU || produto.sku)}>
                                  {String(produto.SKU || produto.sku)} — {produto['Nome Produto'] || produto.nome_produto}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={comp.quantidade}
                            onChange={(e) => updateComponent(index, 'quantidade', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeComponent(index)}
                            disabled={components.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm" onClick={addComponent} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Componente
            </Button>
          </div>

          {/* Campos opcionais do kit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nomeKit">Nome do Kit (opcional)</Label>
              <Input
                id="nomeKit"
                value={nomeKit}
                onChange={(e) => setNomeKit(e.target.value)}
                placeholder={skuOriginal}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria (opcional)</Label>
              <Input
                id="categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Acessórios"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preco">Preço Unitário (opcional)</Label>
            <Input
              id="preco"
              type="number"
              min="0"
              step="0.01"
              value={precoUnitario}
              onChange={(e) => setPrecoUnitario(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Calculado automaticamente a partir dos componentes (pode editar)
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {searchResult?.found ? (
              <Button 
                onClick={handleRelateExisting} 
                disabled={isRelating}
                className="w-full sm:w-auto"
              >
                {isRelating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Relacionando...
                  </>
                ) : (
                  'Relacionar com este kit'
                )}
              </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleSearchExisting}
                disabled={isSearching}
                className="w-full sm:w-auto"
              >
                <Search className={`h-4 w-4 mr-2 ${isSearching ? 'animate-spin' : ''}`} />
                {isSearching ? 'Verificando...' : 'Buscar kit existente'}
              </Button>
              <Button onClick={handleCreateAndRelate} className="w-full sm:w-auto">
                <Package className="h-4 w-4 mr-2" />
                Criar kit e relacionar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

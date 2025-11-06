import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Package } from 'lucide-react';

interface Component {
    sku: string;
    quantidade: number;
}

interface FullKitRelationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rawId: number;
    skuOriginal: string;
    onKitRelated: (sku: string) => void;
    envioId?: number; // ✅ Adicionar envioId para buscar client_id dinamicamente
}

export function FullKitRelationModal({
    open,
    onOpenChange,
    rawId,
    skuOriginal,
    onKitRelated,
    envioId, // ✅ Receber envioId
}: FullKitRelationModalProps) {
    const { toast } = useToast();

    // Estados para busca
    const [components, setComponents] = useState<Component[]>([{ sku: '', quantidade: 1 }]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<{ found: boolean; sku?: string } | null>(null);

    // Estados para criação
    const [nomeKit, setNomeKit] = useState('');
    const [categoria, setCategoria] = useState('KIT');
    const [precoUnitario, setPrecoUnitario] = useState(0);
    const [isCreating, setIsCreating] = useState(false);

    // Estado para relacionamento
    const [isRelating, setIsRelating] = useState(false);

    // ✅ Estado para armazenar o client_id do envio
    const [clientId, setClientId] = useState<number | null>(null);

    // ✅ Buscar client_id do envio quando o modal abrir
    useEffect(() => {
        const fetchClientId = async () => {
            if (open && envioId) {
                try {
                    const response = await fetch(`/api/envios/full/${envioId}`);
                    if (response.ok) {
                        const data = await response.json();
                        setClientId(data.client_id);
                    } else {
                        console.warn('Não foi possível buscar client_id, usando padrão 1');
                        setClientId(1); // Fallback
                    }
                } catch (error) {
                    console.error('Erro ao buscar client_id:', error);
                    setClientId(1); // Fallback
                }
            }
        };

        fetchClientId();
    }, [open, envioId]);

    const addComponent = () => {
        setComponents([...components, { sku: '', quantidade: 1 }]);
    };

    const removeComponent = (index: number) => {
        if (components.length > 1) {
            setComponents(components.filter((_, i) => i !== index));
        }
    };

    const updateComponent = (index: number, field: 'sku' | 'quantidade', value: string | number) => {
        const updated = [...components];
        if (field === 'sku') {
            updated[index].sku = (value as string).toUpperCase();
        } else {
            updated[index].quantidade = Number(value);
        }
        setComponents(updated);
    };

    const validateComponents = () => {
        const validComponents = components.filter(c => c.sku && c.quantidade > 0);
        if (validComponents.length === 0) {
            toast({
                title: 'Erro',
                description: 'Adicione pelo menos um componente válido',
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

            console.log('🔍 [FULL Modal] Buscando kit existente:', { components: componentsPayload });

            const response = await fetch('/api/envios/full/kits/find-by-composition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ components: componentsPayload }),
            });

            if (!response.ok) {
                throw new Error(`Busca falhou: ${response.status}`);
            }

            const result = await response.json();

            console.log('📦 [FULL Modal] Resultado:', result);

            const isValidSku = result.sku_kit &&
                typeof result.sku_kit === 'string' &&
                result.sku_kit.trim().length > 0;

            if (isValidSku) {
                const skuTrimmed = result.sku_kit.trim();
                console.log('🎉 [FULL Modal] Kit encontrado:', skuTrimmed);

                setSearchResult({ found: true, sku: skuTrimmed });
                toast({
                    title: 'Kit encontrado',
                    description: `Kit existente: ${skuTrimmed}`,
                });
            } else {
                console.log('❌ [FULL Modal] Nenhum kit encontrado');

                setSearchResult({ found: false });
                toast({
                    title: 'Kit não encontrado',
                    description: 'Nenhum kit existente encontrado. Você pode criar um novo.',
                });
            }
        } catch (error: any) {
            console.error('❌ [FULL Modal] Erro ao buscar kit:', error);
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao buscar kit',
                variant: 'destructive',
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleCreateAndRelate = async () => {
        if (!validateComponents()) return;

        setIsCreating(true);

        try {
            const componentsPayload = components
                .filter((c) => c.sku && c.quantidade > 0)
                .map((c) => ({ sku: c.sku.toUpperCase(), q: c.quantidade }));

            const payload = {
                raw_id: rawId,
                kit: {
                    nome: nomeKit || skuOriginal,
                    categoria: categoria || 'KIT',
                    preco_unitario: precoUnitario,
                },
                components: componentsPayload,
            };

            console.log('✨ [FULL Modal] Criando kit:', payload);

            const response = await fetch('/api/envios/full/kits/create-and-relate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Criação falhou: ${response.status}`);
            }

            const { sku_kit } = await response.json();

            toast({
                title: 'Kit criado',
                description: `Kit criado e relacionado: ${sku_kit}`,
            });

            onKitRelated(sku_kit);
            onOpenChange(false);
        } catch (error: any) {
            console.error('❌ [FULL Modal] Erro ao criar kit:', error);
            toast({
                title: 'Erro',
                description: error.message || 'Não foi possível criar o kit',
                variant: 'destructive',
            });
        } finally {
            setIsCreating(false);
        }
    };

    const handleRelateExisting = async () => {
        if (!searchResult?.sku) return;

        setIsRelating(true);

        try {
            const response = await fetch('/api/envios/full/relacionar-manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raw_id: rawId,
                    stock_sku: searchResult.sku,
                    client_id: clientId || 1, // ✅ Usar client_id do envio ou fallback
                    learn: true,
                }),
            });

            if (!response.ok) {
                throw new Error('Erro ao relacionar kit');
            }

            toast({
                title: 'Kit relacionado',
                description: `Item relacionado com sucesso ao kit: ${searchResult.sku}`,
            });

            onKitRelated(searchResult.sku);
            onOpenChange(false);
        } catch (error: any) {
            console.error('❌ [FULL Modal] Erro ao relacionar:', error);
            toast({
                title: 'Erro',
                description: error.message || 'Erro ao relacionar kit',
                variant: 'destructive',
            });
        } finally {
            setIsRelating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Relacionar como Kit (FULL)
                    </DialogTitle>
                    <DialogDescription>
                        Item: <span className="font-semibold">{skuOriginal}</span>
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="search" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="search">Buscar Kit Existente</TabsTrigger>
                        <TabsTrigger value="create">Criar Novo Kit</TabsTrigger>
                    </TabsList>

                    {/* TAB: Buscar Kit Existente */}
                    <TabsContent value="search" className="space-y-4">
                        <div className="space-y-3">
                            <Label>Componentes do Kit</Label>
                            {components.map((comp, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        placeholder="SKU"
                                        value={comp.sku}
                                        onChange={(e) => updateComponent(index, 'sku', e.target.value)}
                                        className="flex-1"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Qtd"
                                        min="1"
                                        value={comp.quantidade}
                                        onChange={(e) => updateComponent(index, 'quantidade', e.target.value)}
                                        className="w-20"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeComponent(index)}
                                        disabled={components.length === 1}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addComponent}
                                className="w-full"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar Componente
                            </Button>
                        </div>

                        <Button
                            onClick={handleSearchExisting}
                            disabled={isSearching}
                            className="w-full"
                        >
                            {isSearching ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Buscando...
                                </>
                            ) : (
                                'Buscar Kit'
                            )}
                        </Button>

                        {searchResult && (
                            <div className="p-4 rounded-lg border">
                                {searchResult.found ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="default">Kit Encontrado</Badge>
                                            <span className="font-mono font-semibold">{searchResult.sku}</span>
                                        </div>
                                        <Button
                                            onClick={handleRelateExisting}
                                            disabled={isRelating}
                                            className="w-full"
                                        >
                                            {isRelating ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Relacionando...
                                                </>
                                            ) : (
                                                'Relacionar Este Kit'
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-2">
                                        <Badge variant="secondary">Nenhum Kit Encontrado</Badge>
                                        <p className="text-sm text-muted-foreground">
                                            Vá para a aba "Criar Novo Kit" para cadastrar este kit
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* TAB: Criar Novo Kit */}
                    <TabsContent value="create" className="space-y-4">
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="nomeKit">Nome do Kit</Label>
                                <Input
                                    id="nomeKit"
                                    value={nomeKit}
                                    onChange={(e) => setNomeKit(e.target.value)}
                                    placeholder="Ex: Kit Combo Verão"
                                />
                            </div>

                            <div>
                                <Label htmlFor="categoria">Categoria</Label>
                                <Input
                                    id="categoria"
                                    value={categoria}
                                    onChange={(e) => setCategoria(e.target.value)}
                                    placeholder="Ex: KIT"
                                />
                            </div>

                            <div>
                                <Label htmlFor="precoUnitario">Preço Unitário</Label>
                                <Input
                                    id="precoUnitario"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={precoUnitario}
                                    onChange={(e) => setPrecoUnitario(parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Componentes do Kit</Label>
                                {components.map((comp, index) => (
                                    <div key={index} className="flex gap-2">
                                        <Input
                                            placeholder="SKU"
                                            value={comp.sku}
                                            onChange={(e) => updateComponent(index, 'sku', e.target.value)}
                                            className="flex-1"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Qtd"
                                            min="1"
                                            value={comp.quantidade}
                                            onChange={(e) => updateComponent(index, 'quantidade', e.target.value)}
                                            className="w-20"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeComponent(index)}
                                            disabled={components.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addComponent}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Adicionar Componente
                                </Button>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isCreating}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCreateAndRelate}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    'Criar e Relacionar Kit'
                                )}
                            </Button>
                        </DialogFooter>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { notificationManager } from "@/components/NotificationManager";
import { ErrorMessages } from "@/utils/errorMessages";
import DashboardCard from "@/components/DashboardCard";
import { PackageX, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/utils/formatters";
import { API_BASE_URL } from "@/config/api";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DevolucaoPendente {
    venda_id: number;
    data_venda: string;
    pedido_uid: string;
    nome_cliente: string;
    sku_produto: string;
    nome_produto: string;
    quantidade_vendida: number;
    canal: string;
    valor_total: number;
    devolucao_id: number | null;
    quantidade_esperada: number | null;
    quantidade_recebida: number | null;
    tipo_problema: string | null;
    produto_real_recebido: string | null;
    conferido_em: string | null;
    conferido_por: string | null;
    observacoes: string | null;
    codigo_rastreio: string | null;
    foto_url: string | null;
}

interface ConferenciaForm {
    quantidade_recebida: number;
    tipo_problema: 'correto_bom' | 'correto_defeito' | 'errado_bom';
    produto_real_recebido: string;
    observacoes: string;
}

interface Produto {
    sku: string;
    nome: string;
    quantidade_atual: number;
}

const Devolucoes = () => {
    const [devolucoesAgrupadas, setDevolucoesAgrupadas] = useState<Map<string, DevolucaoPendente[]>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedVenda, setSelectedVenda] = useState<DevolucaoPendente | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [expandedPedidos, setExpandedPedidos] = useState<Set<string>>(new Set());
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [isLoadingProdutos, setIsLoadingProdutos] = useState(false);
    const [openSkuSelect, setOpenSkuSelect] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [form, setForm] = useState<ConferenciaForm>({
        quantidade_recebida: 0,
        tipo_problema: 'correto_bom',
        produto_real_recebido: '',
        observacoes: ''
    });

    const carregarDevolucoes = async () => {
        try {
            setIsLoading(true);

            // Adicionar parâmetro de busca se existir
            const url = searchTerm.trim()
                ? `${API_BASE_URL}/api/devolucoes/pendentes?search=${encodeURIComponent(searchTerm.trim())}`
                : `${API_BASE_URL}/api/devolucoes/pendentes`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Erro ao carregar devoluções');
            }

            const data = await response.json();

            // Agrupar por pedido_uid
            const agrupadas = new Map<string, DevolucaoPendente[]>();

            data.devoluções.forEach((dev: DevolucaoPendente) => {
                const pedido = dev.pedido_uid || `Venda ${dev.venda_id}`;
                if (!agrupadas.has(pedido)) {
                    agrupadas.set(pedido, []);
                }
                agrupadas.get(pedido)!.push(dev);
            });

            setDevolucoesAgrupadas(agrupadas);
        } catch (error) {
            console.error('Erro ao carregar devoluções:', error);
            notificationManager.show('erro-devol', ErrorMessages.devolucoes.loadFailed, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const carregarProdutos = async () => {
        try {
            setIsLoadingProdutos(true);
            const response = await fetch(`${API_BASE_URL}/api/estoque`);

            if (!response.ok) {
                throw new Error('Erro ao carregar produtos');
            }

            const data = await response.json();
            console.log('📦 Produtos carregados:', data.length, 'itens');
            // A API retorna array direto, não tem wrapper .produtos
            setProdutos(data || []);
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            notificationManager.show('erro-produtos', ErrorMessages.produtos.loadFailed, 'error');
        } finally {
            setIsLoadingProdutos(false);
        }
    };

    useEffect(() => {
        carregarDevolucoes();
        carregarProdutos();
    }, []);

    const handleConferir = (venda: DevolucaoPendente) => {
        setSelectedVenda(venda);
        setForm({
            quantidade_recebida: venda.quantidade_vendida,
            tipo_problema: 'correto_bom',
            produto_real_recebido: '',
            observacoes: ''
        });
        setIsDialogOpen(true);
    };

    const handleSubmitConferencia = async () => {
        if (!selectedVenda) return;

        if (form.quantidade_recebida < 0 || form.quantidade_recebida > selectedVenda.quantidade_vendida) {
            notificationManager.show('qtd-invalida', ErrorMessages.devolucoes.invalidQuantity, 'error');
            return;
        }

        // Validar se produto errado precisa informar qual veio
        if (form.tipo_problema === 'errado_bom' && !form.produto_real_recebido) {
            notificationManager.show('sku-obrigatorio', ErrorMessages.devolucoes.missingProduct, 'error');
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                venda_id: selectedVenda.venda_id,
                pedido_uid: selectedVenda.pedido_uid,
                sku_produto: selectedVenda.sku_produto,
                quantidade_esperada: selectedVenda.quantidade_vendida,
                quantidade_recebida: form.quantidade_recebida,
                tipo_problema: form.tipo_problema,
                produto_real_recebido: form.tipo_problema === 'errado_bom' ? form.produto_real_recebido : null,
                conferido_por: 'usuário', // TODO: pegar do contexto de autenticação
                observacoes: form.observacoes
            };

            console.log('📤 Payload de conferência:', payload);

            const response = await fetch(`${API_BASE_URL}/api/devolucoes/conferir`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao conferir devolução');
            }

            const result = await response.json();

            const mensagemSucesso =
                form.tipo_problema === 'correto_bom' ? `${result.quantidade_retornada_estoque} unidade(s) devolvida(s) ao estoque` :
                    form.tipo_problema === 'correto_defeito' ? 'Produto marcado como defeituoso - não retornou ao estoque' :
                        `Produto errado recebido (${form.produto_real_recebido}) - ${result.quantidade_retornada_estoque} unidade(s) adicionada(s) ao estoque`;

            notificationManager.show(
                'devol-sucesso',
                `Devolução conferida! ${mensagemSucesso}`,
                'success'
            );

            setIsDialogOpen(false);
            setSelectedVenda(null);
            carregarDevolucoes();
        } catch (error: any) {
            console.error('Erro ao conferir devolução:', error);
            notificationManager.show('erro-conf', ErrorMessages.devolucoes.conferFailed, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePedido = (pedidoUid: string) => {
        setExpandedPedidos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(pedidoUid)) {
                newSet.delete(pedidoUid);
            } else {
                newSet.add(pedidoUid);
            }
            return newSet;
        });
    };

    // Calcular totalizadores
    const totalPedidos = devolucoesAgrupadas.size;
    const totalItens = Array.from(devolucoesAgrupadas.values()).reduce((acc, itens) => acc + itens.length, 0);
    const valorTotal = Array.from(devolucoesAgrupadas.values())
        .flat()
        .reduce((acc, item) => acc + Number(item.valor_total || 0), 0);

    if (isLoading) {
        return (
            <Layout>
                <div className="flex items-center justify-center min-h-screen">
                    <LoadingSpinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Cabeçalho */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Conferência de Devoluções</h1>
                    <p className="text-muted-foreground mt-2">
                        Gerencie produtos cancelados que retornaram fisicamente ao estoque
                    </p>
                </div>

                {/* Cards de resumo */}
                <div className="grid gap-4 md:grid-cols-3">
                    <DashboardCard
                        title="Pedidos Pendentes"
                        value={totalPedidos}
                        subtitle="Aguardando conferência"
                        icon={Clock}
                        gradient="bg-gradient-to-br from-blue-500 to-blue-600"
                        textColor="text-blue-600"
                    />
                    <DashboardCard
                        title="Itens Aguardando"
                        value={totalItens}
                        subtitle="Total de produtos"
                        icon={PackageX}
                        gradient="bg-gradient-to-br from-orange-500 to-orange-600"
                        textColor="text-orange-600"
                    />
                    <DashboardCard
                        title="Valor Total"
                        value={valorTotal}
                        subtitle="Valor das devoluções"
                        icon={PackageX}
                        gradient="bg-gradient-to-br from-red-500 to-red-600"
                        textColor="text-red-600"
                    />
                </div>

                {/* Campo de Busca */}
                <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por número do pedido, código de rastreio ou SKU..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        carregarDevolucoes();
                                    }
                                }}
                                className="pl-9"
                            />
                        </div>
                        <Button onClick={carregarDevolucoes} variant="default">
                            <Search className="h-4 w-4 mr-2" />
                            Buscar
                        </Button>
                        {searchTerm && (
                            <Button onClick={() => { setSearchTerm(''); setTimeout(carregarDevolucoes, 100); }} variant="outline">
                                Limpar
                            </Button>
                        )}
                    </div>
                </div>

                {/* Lista de devoluções */}
                <div className="rounded-lg border bg-card">
                    <div className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Vendas Canceladas Pendentes</h2>

                        {totalPedidos === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <PackageX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Nenhuma devolução pendente</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Array.from(devolucoesAgrupadas.entries()).map(([pedidoUid, itens]) => {
                                    const isExpanded = expandedPedidos.has(pedidoUid);
                                    const primeiroItem = itens[0];
                                    const valorPedido = itens.reduce((acc, item) => acc + Number(item.valor_total || 0), 0);

                                    return (
                                        <div key={pedidoUid} className="border rounded-lg overflow-hidden">
                                            {/* Cabeçalho do pedido */}
                                            <div
                                                className="bg-muted/50 p-4 cursor-pointer hover:bg-muted/70 transition-colors"
                                                onClick={() => togglePedido(pedidoUid)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        {isExpanded ? (
                                                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                                        ) : (
                                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                        )}
                                                        <div>
                                                            <div className="font-semibold">{pedidoUid}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {primeiroItem.nome_cliente} • {primeiroItem.canal}
                                                                {primeiroItem.codigo_rastreio && (
                                                                    <> • Rastreio: <span className="font-mono">{primeiroItem.codigo_rastreio}</span></>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        {primeiroItem.codigo_rastreio && (
                                                            <div className="text-xs text-muted-foreground font-mono mb-1 truncate max-w-[260px]">
                                                                Rastreio: {primeiroItem.codigo_rastreio}
                                                            </div>
                                                        )}
                                                        <div className="font-semibold">{formatCurrency(valorPedido)}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Itens do pedido */}
                                            {isExpanded && (
                                                <div className="divide-y">
                                                    {itens.map((item) => (
                                                        <div key={item.venda_id} className="p-4 hover:bg-muted/20 transition-colors">
                                                            <div className="flex items-start justify-between gap-4">
                                                                {/* Foto do Produto */}
                                                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                                                    {item.foto_url ? (
                                                                        <img
                                                                            src={`${API_BASE_URL}${item.foto_url}`}
                                                                            alt={item.sku_produto}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                                                                            {item.sku_produto.charAt(0).toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex-1 space-y-2">
                                                                    <div>
                                                                        <div className="font-medium">{item.nome_produto}</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            SKU: {item.sku_produto} • Venda ID: {item.venda_id}
                                                                            {item.codigo_rastreio && (
                                                                                <> • Rastreio: <span className="font-mono">{item.codigo_rastreio}</span></>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-4 text-sm">
                                                                        <span>
                                                                            <span className="text-muted-foreground">Quantidade:</span>{' '}
                                                                            <span className="font-medium">{item.quantidade_vendida}</span>
                                                                        </span>
                                                                        <span>
                                                                            <span className="text-muted-foreground">Data:</span>{' '}
                                                                            <span className="font-medium">
                                                                                {new Date(item.data_venda).toLocaleDateString('pt-BR')}
                                                                            </span>
                                                                        </span>
                                                                        <span>
                                                                            <span className="text-muted-foreground">Valor:</span>{' '}
                                                                            <span className="font-medium">{formatCurrency(item.valor_total)}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    onClick={() => handleConferir(item)}
                                                                    size="sm"
                                                                    className="shrink-0"
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-2" />
                                                                    Conferir
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Dialog de conferência */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Conferir Devolução</DialogTitle>
                        <DialogDescription>
                            Registre a quantidade recebida e a condição do produto
                        </DialogDescription>
                    </DialogHeader>

                    {selectedVenda && (
                        <div className="space-y-4">
                            {/* Informações da venda */}
                            <div className="rounded-lg bg-muted p-4 space-y-2">
                                <div className="font-semibold">{selectedVenda.nome_produto}</div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                    <div>SKU: {selectedVenda.sku_produto}</div>
                                    <div>Cliente: {selectedVenda.nome_cliente}</div>
                                    <div>Pedido: {selectedVenda.pedido_uid}</div>
                                    <div>Quantidade esperada: {selectedVenda.quantidade_vendida}</div>
                                </div>
                            </div>

                            {/* Formulário */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="quantidade">Quantidade Recebida</Label>
                                    <Input
                                        id="quantidade"
                                        type="number"
                                        min={0}
                                        max={selectedVenda.quantidade_vendida}
                                        value={form.quantidade_recebida}
                                        onChange={(e) => setForm({ ...form, quantidade_recebida: parseInt(e.target.value) || 0 })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Máximo: {selectedVenda.quantidade_vendida}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Situação do Produto Recebido</Label>
                                    <RadioGroup
                                        value={form.tipo_problema}
                                        onValueChange={(value) => setForm({ ...form, tipo_problema: value as 'correto_bom' | 'correto_defeito' | 'errado_bom', produto_real_recebido: value !== 'errado_bom' ? '' : form.produto_real_recebido })}
                                    >
                                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                                            <RadioGroupItem value="correto_bom" id="correto_bom" />
                                            <Label htmlFor="correto_bom" className="flex-1 cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                    <div>
                                                        <div className="font-medium">Produto Correto - Bom Estado</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Produto certo e em perfeitas condições → Volta ao estoque
                                                        </div>
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                                            <RadioGroupItem value="correto_defeito" id="correto_defeito" />
                                            <Label htmlFor="correto_defeito" className="flex-1 cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <XCircle className="h-4 w-4 text-red-600" />
                                                    <div>
                                                        <div className="font-medium">Produto Correto - Defeituoso</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Produto certo mas com defeito → NÃO volta ao estoque
                                                        </div>
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                                            <RadioGroupItem value="errado_bom" id="errado_bom" />
                                            <Label htmlFor="errado_bom" className="flex-1 cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <PackageX className="h-4 w-4 text-orange-600" />
                                                    <div>
                                                        <div className="font-medium">Produto Errado - Bom Estado</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Enviamos produto errado, mas está em bom estado → Informar qual produto veio
                                                        </div>
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {/* Campo condicional para produto errado */}
                                {form.tipo_problema === 'errado_bom' && (
                                    <div className="space-y-2 border-l-4 border-orange-500 pl-4 bg-orange-50 p-4 rounded-lg">
                                        <Label htmlFor="produto_real" className="text-orange-900 font-semibold">
                                            Qual produto foi realmente recebido? *
                                        </Label>

                                        <Popover open={openSkuSelect} onOpenChange={setOpenSkuSelect} modal={false}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openSkuSelect}
                                                    className="w-full justify-between bg-white hover:bg-gray-50 border-2 border-orange-300 text-left font-medium"
                                                >
                                                    <span className={form.produto_real_recebido ? "text-gray-900" : "text-gray-500"}>
                                                        {form.produto_real_recebido || "🔍 Clique para buscar ou digite o SKU..."}
                                                    </span>
                                                    <Search className="ml-2 h-4 w-4 shrink-0 text-orange-500" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[400px] p-0">
                                                <Command>
                                                    <CommandInput
                                                        placeholder="🔍 Digite SKU ou nome do produto..."
                                                        value={form.produto_real_recebido}
                                                        onValueChange={(value) => setForm({ ...form, produto_real_recebido: value.toUpperCase() })}
                                                        className="border-b"
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            {isLoadingProdutos ? (
                                                                <div className="py-6 text-center text-sm text-gray-500">
                                                                    Carregando produtos...
                                                                </div>
                                                            ) : (
                                                                <div className="py-6 text-center text-sm">
                                                                    <div className="text-gray-700 font-medium">Nenhum produto encontrado</div>
                                                                    {form.produto_real_recebido && (
                                                                        <div className="mt-3">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                                                                                onClick={() => {
                                                                                    setOpenSkuSelect(false);
                                                                                }}
                                                                            >
                                                                                ✓ Usar "{form.produto_real_recebido}"
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {produtos
                                                                .filter(p => {
                                                                    const searchTerm = form.produto_real_recebido.toLowerCase();
                                                                    if (!searchTerm) return true;
                                                                    return (
                                                                        p.sku?.toLowerCase().includes(searchTerm) ||
                                                                        p.nome?.toLowerCase().includes(searchTerm)
                                                                    );
                                                                })
                                                                .slice(0, 50)
                                                                .map((produto) => (
                                                                    <CommandItem
                                                                        key={produto.sku}
                                                                        value={produto.sku}
                                                                        onSelect={(currentValue) => {
                                                                            setForm({ ...form, produto_real_recebido: currentValue.toUpperCase() });
                                                                            setOpenSkuSelect(false);
                                                                        }}
                                                                        className="cursor-pointer hover:bg-orange-50"
                                                                    >
                                                                        <div className="flex flex-col w-full py-1">
                                                                            <div className="font-semibold text-gray-900">{produto.sku}</div>
                                                                            <div className="text-sm text-gray-600 truncate">
                                                                                {produto.nome}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 mt-1">
                                                                                📦 Estoque: {produto.quantidade_atual || 0} un.
                                                                            </div>
                                                                        </div>
                                                                    </CommandItem>
                                                                ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>

                                        <p className="text-sm text-orange-800 font-medium">
                                            💡 Este produto será adicionado ao estoque no lugar do esperado
                                        </p>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="observacoes">Observações (opcional)</Label>
                                    <Textarea
                                        id="observacoes"
                                        rows={3}
                                        placeholder="Descreva detalhes sobre a devolução..."
                                        value={form.observacoes}
                                        onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Ações */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setIsDialogOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleSubmitConferencia}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Conferindo...' : 'Confirmar Conferência'}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Layout>
    );
};

export default Devolucoes;

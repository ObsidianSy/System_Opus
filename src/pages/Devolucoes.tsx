import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import LoadingSpinner from "@/components/LoadingSpinner";
import { notificationManager } from "@/components/NotificationManager";
import DashboardCard from "@/components/DashboardCard";
import { PackageX, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/utils/formatters";
import { API_BASE_URL } from "@/config/api";

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
    condicao: string | null;
    conferido_em: string | null;
    conferido_por: string | null;
    observacoes: string | null;
}

interface ConferenciaForm {
    quantidade_recebida: number;
    condicao: 'bom' | 'defeito';
    observacoes: string;
}

const Devolucoes = () => {
    const [devolucoesAgrupadas, setDevolucoesAgrupadas] = useState<Map<string, DevolucaoPendente[]>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedVenda, setSelectedVenda] = useState<DevolucaoPendente | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [expandedPedidos, setExpandedPedidos] = useState<Set<string>>(new Set());

    const [form, setForm] = useState<ConferenciaForm>({
        quantidade_recebida: 0,
        condicao: 'bom',
        observacoes: ''
    });

    const carregarDevolucoes = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/devolucoes/pendentes`);

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
            notificationManager.show('erro-devol', 'Erro ao carregar devoluções pendentes', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        carregarDevolucoes();
    }, []);

    const handleConferir = (venda: DevolucaoPendente) => {
        setSelectedVenda(venda);
        setForm({
            quantidade_recebida: venda.quantidade_vendida,
            condicao: 'bom',
            observacoes: ''
        });
        setIsDialogOpen(true);
    };

    const handleSubmitConferencia = async () => {
        if (!selectedVenda) return;

        if (form.quantidade_recebida < 0 || form.quantidade_recebida > selectedVenda.quantidade_vendida) {
            notificationManager.show('qtd-invalida', 'Quantidade recebida inválida', 'error');
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                venda_id: selectedVenda.venda_id,
                sku_produto: selectedVenda.sku_produto,
                quantidade_esperada: selectedVenda.quantidade_vendida,
                quantidade_recebida: form.quantidade_recebida,
                condicao: form.condicao,
                conferido_por: 'usuário', // TODO: pegar do contexto de autenticação
                observacoes: form.observacoes
            };

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

            notificationManager.show(
                'devol-sucesso',
                `Devolução conferida! ${result.estoque_atualizado ? `${result.quantidade_retornada_estoque} unidade(s) retornada(s) ao estoque.` : 'Item marcado como defeituoso.'}`,
                'success'
            );

            setIsDialogOpen(false);
            setSelectedVenda(null);
            carregarDevolucoes();
        } catch (error: any) {
            console.error('Erro ao conferir devolução:', error);
            notificationManager.show('erro-conf', error.message || 'Erro ao conferir devolução', 'error');
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
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
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
                                                                <div className="flex-1 space-y-2">
                                                                    <div>
                                                                        <div className="font-medium">{item.nome_produto}</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            SKU: {item.sku_produto} • Venda ID: {item.venda_id}
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
                                    <Label>Condição do Produto</Label>
                                    <RadioGroup
                                        value={form.condicao}
                                        onValueChange={(value) => setForm({ ...form, condicao: value as 'bom' | 'defeito' })}
                                    >
                                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                                            <RadioGroupItem value="bom" id="bom" />
                                            <Label htmlFor="bom" className="flex-1 cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                    <div>
                                                        <div className="font-medium">Bom Estado</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Produto retorna ao estoque
                                                        </div>
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                                            <RadioGroupItem value="defeito" id="defeito" />
                                            <Label htmlFor="defeito" className="flex-1 cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <XCircle className="h-4 w-4 text-red-600" />
                                                    <div>
                                                        <div className="font-medium">Defeituoso</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Produto não retorna ao estoque
                                                        </div>
                                                    </div>
                                                </div>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

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

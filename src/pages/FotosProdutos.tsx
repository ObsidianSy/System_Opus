import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/config/api';
import { Upload, X, Search, Image as ImageIcon, Check, AlertCircle, ChevronDown, ArrowLeft, FileText } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import jsPDF from 'jspdf';

interface ProdutoBase {
    produto_base: string;
    quantidade_variantes: number;
    skus_variantes: string;
    nome_exemplo: string;
}

interface ProdutoComFoto extends ProdutoBase {
    foto_url: string | null;
    foto_filename: string | null;
}

export default function FotosProdutos() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [produtosDisponiveis, setProdutosDisponiveis] = useState<ProdutoBase[]>([]);
    const [produtosComFoto, setProdutosComFoto] = useState<ProdutoComFoto[]>([]);
    const [produtoSelecionado, setProdutoSelecionado] = useState<string>('');
    const [fotoPreview, setFotoPreview] = useState<string>('');
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');
    const [openCombobox, setOpenCombobox] = useState(false);
    // Filtro da grade
    const [openSkuFilter, setOpenSkuFilter] = useState(false);
    const [skuFiltro, setSkuFiltro] = useState<string>('');
    // Mapa de estoque total por produto_base
    const [estoquePorBase, setEstoquePorBase] = useState<Record<string, number>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);  // Buscar produtos base disponíveis
    const buscarProdutos = async (search?: string) => {
        try {
            setLoading(true);
            setErro('');
            const searchParam = search !== undefined ? search : searchTerm;
            const data = await apiRequest<ProdutoBase[]>(`/produto-fotos/buscar-bases?search=${searchParam}`);
            setProdutosDisponiveis(data);
        } catch (err: any) {
            setErro('Erro ao buscar produtos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };    // Carregar produtos com fotos cadastradas
    const carregarProdutosComFoto = async () => {
        try {
            const data = await apiRequest<ProdutoComFoto[]>('/produto-fotos');
            setProdutosComFoto(data);
        } catch (err: any) {
            console.error('Erro ao carregar produtos com foto:', err);
        }
    };

    // Carregar estoque e agregar por produto_base usando prefixo do SKU
    const carregarEstoqueAgrupado = async (bases?: string[]) => {
        try {
            const produtosEstoque = await apiRequest<any[]>('/estoque');
            const map: Record<string, number> = {};
            const baseList = bases && bases.length > 0 ? bases : Array.from(new Set(produtosComFoto.map(p => p.produto_base.toUpperCase())));

            for (const base of baseList) {
                const total = produtosEstoque
                    .filter((p) => {
                        const sku: string = (p.sku || '').toUpperCase();
                        const b = base.toUpperCase();
                        // Considera SKU exatamente igual ao base ou que começa com `${base}-`
                        return sku === b || sku.startsWith(b + '-');
                    })
                    .reduce((acc, p) => acc + (Number(p.quantidade_atual) || 0), 0);
                map[base] = total;
            }

            setEstoquePorBase(map);
        } catch (err) {
            console.error('Erro ao carregar estoque para agregação:', err);
        }
    };

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
            setErro('Tipo de arquivo inválido. Use apenas JPG, PNG ou WEBP.');
            return;
        }

        // Validar tamanho (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setErro('Arquivo muito grande. Máximo 5MB.');
            return;
        }

        setArquivo(file);
        setErro('');
        setSucesso('');

        // Criar preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setFotoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Upload foto
    const handleUpload = async () => {
        if (!produtoSelecionado) {
            setErro('Selecione um produto base');
            return;
        }

        if (!arquivo) {
            setErro('Selecione uma foto');
            return;
        }

        try {
            setLoading(true);
            setErro('');
            setSucesso('');

            const formData = new FormData();
            formData.append('foto', arquivo);
            formData.append('produto_base', produtoSelecionado);

            await fetch(`${import.meta.env.VITE_API_URL}/api/produto-fotos`, {
                method: 'POST',
                body: formData,
            });

            setSucesso('Foto enviada com sucesso!');
            setArquivo(null);
            setFotoPreview('');
            setProdutoSelecionado('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Recarregar lista
            await carregarProdutosComFoto();
        } catch (err: any) {
            setErro('Erro ao fazer upload: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Remover foto
    const handleRemoverFoto = async (produtoBase: string) => {
        if (!confirm(`Deseja remover a foto de ${produtoBase}?`)) return;

        try {
            setLoading(true);
            await apiRequest(`/produto-fotos/${produtoBase}`, {
                method: 'DELETE',
            });

            setSucesso('Foto removida com sucesso!');
            await carregarProdutosComFoto();
        } catch (err: any) {
            setErro('Erro ao remover foto: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Carregar produtos com foto ao montar
    useEffect(() => {
        carregarProdutosComFoto();
        // Carregar todos os produtos ao montar
        buscarProdutos('');
    }, []);

    // Quando produtos com foto carregarem, carregar estoque agregado
    useEffect(() => {
        if (produtosComFoto.length > 0) {
            const bases = produtosComFoto.map(p => p.produto_base.toUpperCase());
            carregarEstoqueAgrupado(bases);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [produtosComFoto.length]);

    const produtosFiltrados = useMemo(() => {
        const termo = skuFiltro.trim().toUpperCase();
        if (!termo) return produtosComFoto;
        return produtosComFoto.filter(p =>
            p.produto_base.toUpperCase().includes(termo) ||
            (p.skus_variantes || '').toUpperCase().includes(termo)
        );
    }, [skuFiltro, produtosComFoto]);

    // Gerar PDF para impressão com cards dos produtos
    const gerarPDF = async () => {
        try {
            setLoading(true);
            setSucesso('');
            setErro('');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const cardWidth = 45;
            const cardHeight = 60;
            const cols = 4;
            const rows = 4;
            const gapX = (pageWidth - 2 * margin - cols * cardWidth) / (cols - 1);
            const gapY = (pageHeight - 2 * margin - rows * cardHeight) / (rows - 1);

            let currentPage = 0;
            let cardIndex = 0;

            for (const produto of produtosFiltrados) {
                if (!produto.foto_url) continue;

                const row = Math.floor((cardIndex % (cols * rows)) / cols);
                const col = (cardIndex % (cols * rows)) % cols;

                // Nova página se necessário
                if (cardIndex > 0 && cardIndex % (cols * rows) === 0) {
                    pdf.addPage();
                    currentPage++;
                }

                const x = margin + col * (cardWidth + gapX);
                const y = margin + row * (cardHeight + gapY);

                // Carregar imagem
                try {
                    const imgUrl = `${import.meta.env.VITE_API_URL}${produto.foto_url}`;
                    const response = await fetch(imgUrl);
                    const blob = await response.blob();
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });

                    // Border do card
                    pdf.setDrawColor(200);
                    pdf.setLineWidth(0.3);
                    pdf.rect(x, y, cardWidth, cardHeight);

                    // Imagem (ocupa boa parte do card)
                    const imgHeight = cardHeight - 18;
                    pdf.addImage(base64, 'JPEG', x + 2, y + 2, cardWidth - 4, imgHeight);

                    // Texto: Produto Base
                    pdf.setFontSize(9);
                    pdf.setFont('helvetica', 'bold');
                    pdf.text(produto.produto_base, x + cardWidth / 2, y + imgHeight + 7, { align: 'center', maxWidth: cardWidth - 4 });

                    // Texto: SKU exemplo
                    const firstSku = (produto.skus_variantes || '').split(',')[0]?.trim();
                    if (firstSku) {
                        pdf.setFontSize(7);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(firstSku, x + cardWidth / 2, y + imgHeight + 11, { align: 'center', maxWidth: cardWidth - 4 });
                    }

                    // Texto: Qtd variantes
                    pdf.setFontSize(6);
                    pdf.setTextColor(100);
                    pdf.text(`${produto.quantidade_variantes} variantes`, x + cardWidth / 2, y + imgHeight + 14, { align: 'center' });
                    pdf.setTextColor(0);
                } catch (err) {
                    console.error('Erro ao carregar imagem do produto:', produto.produto_base, err);
                }

                cardIndex++;
            }

            pdf.save('catalogo-produtos.pdf');
            setSucesso('PDF gerado com sucesso!');
        } catch (err: any) {
            setErro('Erro ao gerar PDF: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate('/estoque')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Gerenciar Fotos de Produtos</h1>
                        <p className="text-muted-foreground mt-2">
                            Adicione fotos para produtos base. Uma foto será aplicada a todas as variações de tamanho.
                        </p>
                    </div>
                </div>
            </div>

            {/* Alertas */}
            {erro && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{erro}</AlertDescription>
                </Alert>
            )}

            {sucesso && (
                <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{sucesso}</AlertDescription>
                </Alert>
            )}

            {/* Card de Upload */}
            <Card>
                <CardHeader>
                    <CardTitle>Adicionar Nova Foto</CardTitle>
                    <CardDescription>Selecione o produto e faça upload da foto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Busca de Produto com Combobox */}
                    <div className="space-y-2">
                        <Label>Selecionar Produto Base</Label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                >
                                    {produtoSelecionado || "Clique para selecionar um produto..."}
                                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                    <CommandInput
                                        placeholder="Digite para buscar..."
                                        value={searchTerm}
                                        onValueChange={(value) => {
                                            setSearchTerm(value);
                                            buscarProdutos(value);
                                        }}
                                    />
                                    <CommandList>
                                        <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {produtosDisponiveis.map((produto) => (
                                                <CommandItem
                                                    key={produto.produto_base}
                                                    value={produto.produto_base}
                                                    onSelect={() => {
                                                        setProdutoSelecionado(produto.produto_base);
                                                        setOpenCombobox(false);
                                                    }}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{produto.produto_base}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {produto.quantidade_variantes} variante(s): {produto.skus_variantes}
                                                        </span>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {produtoSelecionado && (
                            <div className="flex items-center justify-between p-2 border rounded bg-muted/50">
                                <span className="text-sm font-medium">{produtoSelecionado}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setProdutoSelecionado('')}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Upload de Arquivo */}
                    <div className="space-y-2">
                        <Label>Foto do Produto</Label>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleFileChange}
                            disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                            Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 5MB
                        </p>
                    </div>

                    {/* Preview */}
                    {fotoPreview && (
                        <div className="space-y-2">
                            <Label>Preview</Label>
                            <div className="relative w-48 h-48 border rounded-lg overflow-hidden">
                                <img
                                    src={fotoPreview}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                                <Button
                                    size="icon"
                                    variant="destructive"
                                    className="absolute top-2 right-2"
                                    onClick={() => {
                                        setFotoPreview('');
                                        setArquivo(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Botão Upload */}
                    <Button
                        onClick={handleUpload}
                        disabled={loading || !produtoSelecionado || !arquivo}
                        className="w-full"
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {loading ? 'Enviando...' : 'Fazer Upload'}
                    </Button>
                </CardContent>
            </Card>

            {/* Lista de Produtos com Foto */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Produtos com Fotos Cadastradas</CardTitle>
                            <CardDescription>
                                {produtosFiltrados.length} produto(s) com foto cadastrada
                            </CardDescription>
                        </div>
                        <Button
                            onClick={gerarPDF}
                            disabled={loading || produtosFiltrados.length === 0}
                            className="gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            Exportar PDF
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Barra de filtros da grade */}
                    <div className="mb-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                        <div className="flex-1">
                            <Popover open={openSkuFilter} onOpenChange={setOpenSkuFilter}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {skuFiltro ? `Filtrado por: ${skuFiltro}` : 'Filtrar por SKU (base ou variante)'}
                                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Digite parte do SKU..." value={skuFiltro} onValueChange={setSkuFiltro} />
                                        <CommandList>
                                            <CommandEmpty>Nenhum SKU encontrado.</CommandEmpty>
                                            <CommandGroup heading="Bases com foto">
                                                {produtosComFoto.map(p => (
                                                    <CommandItem key={p.produto_base} value={p.produto_base} onSelect={(v) => { setSkuFiltro(v); setOpenSkuFilter(false); }}>
                                                        {p.produto_base}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {skuFiltro && (
                                <div className="flex items-center justify-between p-2 border rounded bg-muted/50 mt-2">
                                    <span className="text-xs font-medium">{skuFiltro}</span>
                                    <Button size="sm" variant="ghost" onClick={() => setSkuFiltro('')}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {produtosFiltrados.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma foto cadastrada ainda</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                            {produtosFiltrados.map((produto) => {
                                const firstSku = (produto.skus_variantes || '').split(',')[0]?.trim();
                                const totalQty = estoquePorBase[produto.produto_base?.toUpperCase()] ?? undefined;
                                const emEstoque = typeof totalQty === 'number' ? totalQty > 0 : undefined;

                                return (
                                    <Card key={produto.produto_base} className="overflow-hidden">
                                        <div className="aspect-square bg-muted relative">
                                            {produto.foto_url ? (
                                                <img
                                                    src={`${import.meta.env.VITE_API_URL}${produto.foto_url}`}
                                                    alt={produto.produto_base}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ImageIcon className="h-12 w-12 opacity-30" />
                                                </div>
                                            )}
                                            <Button
                                                size="icon"
                                                variant="destructive"
                                                className="absolute top-2 right-2 h-6 w-6"
                                                onClick={() => handleRemoverFoto(produto.produto_base)}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            <div className="font-semibold text-sm truncate" title={produto.produto_base}>{produto.produto_base}</div>
                                            {firstSku && (
                                                <div className="text-[10px] font-mono text-muted-foreground truncate">SKU exemplo: {firstSku}</div>
                                            )}
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-muted-foreground">Variantes</span>
                                                <span className="font-medium">{produto.quantidade_variantes}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-muted-foreground">Quantidade</span>
                                                <span className="font-semibold">{totalQty ?? '-'}</span>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

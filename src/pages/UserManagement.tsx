import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Plus, Edit, Trash2, Check, AlertCircle, Shield, User } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';

interface Usuario {
    id: string;
    nome: string;
    email: string;
    cargo: 'adm' | 'operador';
    ativo: boolean;
    created_at: string;
}

interface UsuarioForm {
    nome: string;
    email: string;
    senha: string;
    cargo: 'adm' | 'operador';
}

export default function UserManagement() {
    const { usuario: usuarioLogado, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Usuario | null>(null);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');
    const [form, setForm] = useState<UsuarioForm>({
        nome: '',
        email: '',
        senha: '',
        cargo: 'operador'
    });

    // Verificar se é admin
    useEffect(() => {
        if (!isAdmin()) {
            navigate('/');
        }
    }, [isAdmin, navigate]);

    const carregarUsuarios = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/usuarios`, {
                headers: {
                    'x-user-cargo': usuarioLogado?.cargo || 'operador'
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar usuários');
            }

            const data = await response.json();
            setUsuarios(data);
        } catch (error: any) {
            setErro('Erro ao carregar usuários: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        carregarUsuarios();
    }, []);

    const handleOpenDialog = (usuario?: Usuario) => {
        if (usuario) {
            setEditingUser(usuario);
            setForm({
                nome: usuario.nome,
                email: usuario.email,
                senha: '',
                cargo: usuario.cargo
            });
        } else {
            setEditingUser(null);
            setForm({
                nome: '',
                email: '',
                senha: '',
                cargo: 'operador'
            });
        }
        setIsDialogOpen(true);
        setErro('');
        setSucesso('');
    };

    const handleSubmit = async () => {
        setErro('');
        setSucesso('');

        // Validações
        if (!form.nome || !form.email) {
            setErro('Nome e email são obrigatórios');
            return;
        }

        if (!editingUser && !form.senha) {
            setErro('Senha é obrigatória para novo usuário');
            return;
        }

        if (form.senha && form.senha.length < 6) {
            setErro('Senha deve ter no mínimo 6 caracteres');
            return;
        }

        try {
            const url = editingUser
                ? `${API_BASE_URL}/api/usuarios/${editingUser.id}`
                : `${API_BASE_URL}/api/usuarios`;

            const method = editingUser ? 'PUT' : 'POST';

            const payload: any = {
                nome: form.nome,
                email: form.email,
                cargo: form.cargo
            };

            if (form.senha) {
                payload.senha = form.senha;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-cargo': usuarioLogado?.cargo || 'operador'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao salvar usuário');
            }

            setSucesso(editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
            setIsDialogOpen(false);
            carregarUsuarios();
        } catch (error: any) {
            setErro(error.message);
        }
    };

    const handleInativar = async (id: string) => {
        if (!confirm('Deseja realmente inativar este usuário?')) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/usuarios/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-user-cargo': usuarioLogado?.cargo || 'operador'
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao inativar usuário');
            }

            setSucesso('Usuário inativado com sucesso!');
            carregarUsuarios();
        } catch (error: any) {
            setErro(error.message);
        }
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Usuários</h1>
                        <p className="text-muted-foreground mt-2">
                            Cadastre e gerencie usuários do sistema
                        </p>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Usuário
                    </Button>
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

                {/* Card de resumo */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{usuarios.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {usuarios.filter(u => u.cargo === 'adm').length}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Operadores</CardTitle>
                            <User className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {usuarios.filter(u => u.cargo === 'operador').length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabela de usuários */}
                <Card>
                    <CardHeader>
                        <CardTitle>Usuários Cadastrados</CardTitle>
                        <CardDescription>Lista de todos os usuários do sistema</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                        ) : usuarios.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum usuário cadastrado
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Cadastrado em</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {usuarios.map((usuario) => (
                                        <TableRow key={usuario.id}>
                                            <TableCell className="font-medium">{usuario.nome}</TableCell>
                                            <TableCell>{usuario.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={usuario.cargo === 'adm' ? 'default' : 'secondary'}>
                                                    {usuario.cargo === 'adm' ? (
                                                        <><Shield className="h-3 w-3 mr-1" /> Administrador</>
                                                    ) : (
                                                        <><User className="h-3 w-3 mr-1" /> Operador</>
                                                    )}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={usuario.ativo ? 'outline' : 'destructive'}>
                                                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenDialog(usuario)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    {usuario.ativo && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleInativar(usuario.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dialog de Cadastro/Edição */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingUser
                                ? 'Atualize as informações do usuário'
                                : 'Preencha os dados para cadastrar um novo usuário'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="nome">Nome Completo *</Label>
                            <Input
                                id="nome"
                                placeholder="Nome do usuário"
                                value={form.nome}
                                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="email@exemplo.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="senha">
                                Senha {editingUser ? '(deixe em branco para manter a atual)' : '*'}
                            </Label>
                            <Input
                                id="senha"
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                value={form.senha}
                                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cargo">Cargo *</Label>
                            <Select
                                value={form.cargo}
                                onValueChange={(value: 'adm' | 'operador') => setForm({ ...form, cargo: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="operador">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Operador
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="adm">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4" />
                                            Administrador
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {form.cargo === 'adm'
                                    ? 'Administradores podem gerenciar usuários e acessar todas as funcionalidades'
                                    : 'Operadores têm acesso limitado às funcionalidades do sistema'
                                }
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit}>
                            {editingUser ? 'Atualizar' : 'Cadastrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}

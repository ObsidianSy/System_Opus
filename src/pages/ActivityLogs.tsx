import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from "@tanstack/react-query"
import Layout from "@/components/Layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Activity, User, Calendar, FileText, TrendingUp } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface ActivityLog {
    id: number
    user_email: string
    user_name: string | null
    action: string
    entity_type: string | null
    entity_id: string | null
    details: Record<string, any> | null
    ip_address: string | null
    user_agent: string | null
    created_at: string
}

interface ActivityStats {
    total_logs: string
    unique_users: string
    today_logs: string
    this_week_logs: string
}

interface User {
    user_email: string
    user_name: string | null
}

const fetchActivityLogs = async (filters: {
    action?: string
    user_email?: string
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
}): Promise<ActivityLog[]> => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "" && value !== "all") {
            params.append(key, value.toString())
        }
    })

    const response = await fetch(`/api/activity/logs?${params}`)
    if (!response.ok) throw new Error("Erro ao buscar logs")
    return response.json()
}

const fetchActivityStats = async (): Promise<ActivityStats> => {
    const response = await fetch("/api/activity/stats")
    if (!response.ok) throw new Error("Erro ao buscar estatísticas")
    return response.json()
}

const fetchUsers = async (): Promise<User[]> => {
    const response = await fetch("/api/activity/users")
    if (!response.ok) throw new Error("Erro ao buscar usuários")
    return response.json()
}

const actionLabels: Record<string, string> = {
    upload_full: "Upload FULL",
    upload_ml: "Upload ML",
    emit_sales: "Emitir Vendas (FULL)",
    emit_sales_ml: "Emitir Vendas (ML)",
    relate_item: "Relacionar Item",
    relate_manual: "Relacionamento Manual",
    auto_relate: "Relacionamento Automático",
}

const actionColors: Record<string, string> = {
    upload_full: "bg-blue-500",
    upload_ml: "bg-green-500",
    emit_sales: "bg-purple-500",
    emit_sales_ml: "bg-purple-600",
    relate_item: "bg-orange-500",
    relate_manual: "bg-orange-600",
    auto_relate: "bg-cyan-500",
}

// Função para formatar detalhes de forma legível
const formatDetails = (details: Record<string, any>) => {
    const items: { label: string; value: string | number }[] = []

    // Informações gerais
    if (details.cliente) items.push({ label: "Cliente", value: details.cliente })
    if (details.client_name) items.push({ label: "Cliente", value: details.client_name })
    if (details.envio_num) items.push({ label: "Nº Envio", value: details.envio_num })
    if (details.filename) items.push({ label: "Arquivo", value: details.filename })

    // Upload/Import
    if (details.total_linhas) items.push({ label: "Total de Linhas", value: details.total_linhas })
    if (details.inseridas !== undefined) items.push({ label: "Linhas Inseridas", value: details.inseridas })
    if (details.auto_relacionadas !== undefined) items.push({ label: "Auto Relacionadas", value: details.auto_relacionadas })
    if (details.pendentes !== undefined) items.push({ label: "Pendentes", value: details.pendentes })

    // Emissão de vendas
    if (details.import_id) items.push({ label: "Import ID", value: details.import_id })
    if (details.source) items.push({ label: "Origem", value: details.source })
    if (details.candidatos !== undefined) items.push({ label: "Candidatos", value: details.candidatos })
    if (details.inseridos !== undefined) items.push({ label: "Inseridos", value: details.inseridos })
    if (details.ja_existiam !== undefined) items.push({ label: "Já Existiam", value: details.ja_existiam })
    if (details.full_skipped !== undefined) items.push({ label: "FULL Ignorados", value: details.full_skipped })
    if (details.cancelados_skipped !== undefined) items.push({ label: "Cancelados Ignorados", value: details.cancelados_skipped })
    if (details.cancelados_removidos !== undefined) items.push({ label: "Cancelados Removidos", value: details.cancelados_removidos })
    if (details.erros !== undefined) items.push({ label: "Erros", value: details.erros })

    // Relacionamento
    if (details.sku_original) items.push({ label: "SKU Original", value: details.sku_original })
    if (details.stock_sku) items.push({ label: "SKU Estoque", value: details.stock_sku })
    if (details.codigo_ml) items.push({ label: "Código ML", value: details.codigo_ml })
    if (details.learn !== undefined) items.push({ label: "Aprendizado", value: details.learn ? "Sim" : "Não" })

    // Outras informações
    if (details.total_vendas) items.push({ label: "Total de Vendas", value: details.total_vendas })
    if (details.import_date) items.push({ label: "Data Importação", value: new Date(details.import_date).toLocaleDateString('pt-BR') })
    if (details.relacionadas) items.push({ label: "Relacionadas", value: details.relacionadas })
    if (details.success !== undefined) items.push({ label: "Status", value: details.success ? "✅ Sucesso" : "❌ Falha" })

    return items
}

export default function ActivityLogs() {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        if (!isAdmin()) {
            navigate('/');
        }
    }, [isAdmin, navigate]);

    const [filters, setFilters] = useState({
        action: "all",
        user_email: "",
        start_date: "",
        end_date: "",
        limit: 50,
        offset: 0,
    })

    const { data: logs = [], isLoading, refetch } = useQuery({
        queryKey: ["activity-logs", filters],
        queryFn: () => fetchActivityLogs(filters),
    })

    const { data: stats } = useQuery({
        queryKey: ["activity-stats"],
        queryFn: fetchActivityStats,
    })

    const { data: users = [] } = useQuery({
        queryKey: ["activity-users"],
        queryFn: fetchUsers,
    })

    const handleFilterChange = (key: string, value: string | number) => {
        setFilters((prev) => ({ ...prev, [key]: value, offset: 0 }))
    }

    const resetFilters = () => {
        setFilters({
            action: "all",
            user_email: "",
            start_date: "",
            end_date: "",
            limit: 50,
            offset: 0,
        })
    }

    return (
        <Layout>
            <div className="space-y-6 p-6">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Logs de Atividade</h1>
                        <p className="text-muted-foreground">
                            Acompanhe todas as ações realizadas no sistema
                        </p>
                    </div>
                </div>

                {/* Estatísticas */}
                {stats && (
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.total_logs}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                                <User className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.unique_users}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Hoje</CardTitle>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.today_logs}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.this_week_logs}</div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Filtros */}
                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-5">
                            <Select
                                value={filters.action}
                                onValueChange={(value) => handleFilterChange("action", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas as ações" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as ações</SelectItem>
                                    {Object.entries(actionLabels).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={filters.user_email || "all_users"}
                                onValueChange={(value) => handleFilterChange("user_email", value === "all_users" ? "" : value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Todos os usuários" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all_users">Todos os usuários</SelectItem>
                                    {users.map((user) => (
                                        <SelectItem key={user.user_email} value={user.user_email}>
                                            {user.user_name || user.user_email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Input
                                type="date"
                                placeholder="Data inicial"
                                value={filters.start_date}
                                onChange={(e) => handleFilterChange("start_date", e.target.value)}
                            />

                            <Input
                                type="date"
                                placeholder="Data final"
                                value={filters.end_date}
                                onChange={(e) => handleFilterChange("end_date", e.target.value)}
                            />

                            <Button variant="outline" onClick={resetFilters}>
                                Limpar Filtros
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabela de Logs */}
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Atividades</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-muted-foreground">Carregando...</p>
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <p className="text-muted-foreground">Nenhum log encontrado</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data/Hora</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Ação</TableHead>
                                            <TableHead>Entidade</TableHead>
                                            <TableHead>Detalhes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", {
                                                        locale: ptBR,
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{log.user_name || "N/A"}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {log.user_email}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={`${actionColors[log.action] || "bg-gray-500"
                                                            } text-white`}
                                                    >
                                                        {actionLabels[log.action] || log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {log.entity_type && (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm">{log.entity_type}</span>
                                                            {log.entity_id && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    ID: {log.entity_id}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {log.details && (
                                                        <details className="cursor-pointer">
                                                            <summary className="text-sm text-blue-600 hover:underline">
                                                                Ver detalhes
                                                            </summary>
                                                            <div className="mt-2 space-y-1 rounded border bg-muted/50 p-3 text-sm">
                                                                {formatDetails(log.details).map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between gap-4">
                                                                        <span className="font-medium text-muted-foreground">
                                                                            {item.label}:
                                                                        </span>
                                                                        <span className="font-semibold">
                                                                            {item.value}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Paginação */}
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Mostrando {logs.length} registros
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={filters.offset === 0}
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            offset: Math.max(0, prev.offset - prev.limit),
                                        }))
                                    }
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={logs.length < filters.limit}
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            offset: prev.offset + prev.limit,
                                        }))
                                    }
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    )
}

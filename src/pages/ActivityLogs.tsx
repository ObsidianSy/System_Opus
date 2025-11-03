import { useState, useEffect } from "react"
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
    emit_sales: "Emitir Vendas",
    relate_item: "Relacionar Item",
    auto_relate: "Relacionamento Automático",
}

const actionColors: Record<string, string> = {
    upload_full: "bg-blue-500",
    upload_ml: "bg-green-500",
    emit_sales: "bg-purple-500",
    relate_item: "bg-orange-500",
    auto_relate: "bg-cyan-500",
}

export default function ActivityLogs() {
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
                                                            <pre className="mt-2 max-w-md overflow-auto rounded bg-muted p-2 text-xs">
                                                                {JSON.stringify(log.details, null, 2)}
                                                            </pre>
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

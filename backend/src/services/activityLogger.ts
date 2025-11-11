import { pool } from '../database/db';

export interface ActivityLogData {
    user_email: string;
    user_name?: string;
    action: string;
    entity_type?: string;
    entity_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
}

/**
 * Registra uma ação do usuário no sistema
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO obsidian.activity_logs 
             (user_email, user_name, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() AT TIME ZONE 'America/Sao_Paulo')`,
            [
                data.user_email,
                data.user_name || null,
                data.action,
                data.entity_type || null,
                data.entity_id || null,
                data.details ? JSON.stringify(data.details) : null,
                data.ip_address || null,
                data.user_agent || null
            ]
        );
    } catch (error) {
        console.error('Erro ao registrar log:', error);
        // Não lançar erro para não quebrar a operação principal
    }
}

/**
 * Buscar logs com filtros
 */
export async function getActivityLogs(filters: {
    user_email?: string;
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
}) {
    let query = `SELECT 
        id,
        user_email,
        user_name,
        action,
        entity_type,
        entity_id,
        details,
        ip_address,
        user_agent,
        created_at AT TIME ZONE 'America/Sao_Paulo' as created_at
    FROM obsidian.activity_logs WHERE 1=1`;
    const params: any[] = [];

    if (filters.user_email) {
        params.push(filters.user_email);
        query += ` AND user_email = $${params.length}`;
    }

    if (filters.action) {
        params.push(filters.action);
        query += ` AND action = $${params.length}`;
    }

    if (filters.entity_type) {
        params.push(filters.entity_type);
        query += ` AND entity_type = $${params.length}`;
    }

    if (filters.start_date) {
        params.push(filters.start_date);
        query += ` AND created_at >= $${params.length}`;
    }

    if (filters.end_date) {
        params.push(filters.end_date);
        query += ` AND created_at <= $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
        params.push(filters.limit);
        query += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
        params.push(filters.offset);
        query += ` OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);
    return result.rows;
}

/**
 * Obter resumo de atividades por usuário
 */
export async function getActivitySummary() {
    const result = await pool.query('SELECT * FROM obsidian.activity_summary');
    return result.rows;
}

/**
 * Obter estatísticas gerais
 */
export async function getActivityStats(days: number = 7) {
    const result = await pool.query(
        `SELECT 
            COUNT(*) as total_logs,
            COUNT(DISTINCT user_email) as unique_users,
            COUNT(*) FILTER (WHERE created_at AT TIME ZONE 'America/Sao_Paulo' >= CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') as today_logs,
            COUNT(*) FILTER (WHERE created_at AT TIME ZONE 'America/Sao_Paulo' >= (CURRENT_DATE - INTERVAL '7 days') AT TIME ZONE 'America/Sao_Paulo') as this_week_logs
         FROM obsidian.activity_logs`
    );

    return result.rows[0];
}

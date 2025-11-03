import { pool } from '../database/db';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Remove logs antigos da tabela obsidian.activity_logs.
 * Retention days configurável via env RETENTION_DAYS (padrão 30).
 */
export async function cleanupOldLogs(retentionDays = 30) {
    try {
        const res = await pool.query(
            `DELETE FROM obsidian.activity_logs
             WHERE created_at < NOW() - ($1 || ' days')::interval
             RETURNING id`
            , [String(retentionDays)]
        );

        const removed = res.rowCount || 0;
        console.log(`🧹 cleanupOldLogs: removidos ${removed} registros com mais de ${retentionDays} dias`);
        return removed;
    } catch (error) {
        console.error('❌ Erro em cleanupOldLogs:', error);
        return 0;
    }
}

/**
 * Inicia a task agendada que executa a limpeza diariamente.
 * RetentionDays pode ser passado ou lido de process.env.RETENTION_DAYS
 */
export function startCleanupTask() {
    const retentionDays = parseInt(process.env.RETENTION_DAYS || '30', 10);

    // Executa imediatamente na inicialização
    cleanupOldLogs(retentionDays).catch(() => { });

    // Agenda execução diária
    setInterval(() => {
        cleanupOldLogs(retentionDays).catch(() => { });
    }, MS_PER_DAY);

    console.log(`⏰ Task cleanupOldLogs agendada para executar a cada 24h (retenção: ${retentionDays} dias)`);
}

export default startCleanupTask;

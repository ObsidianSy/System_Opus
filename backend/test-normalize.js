require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function normalizeClientId(clientIdInput) {
    if (!clientIdInput) return null;

    // Se já é número, retornar
    if (!isNaN(Number(clientIdInput))) {
        return Number(clientIdInput);
    }

    // Se é string (nome do cliente), buscar ID
    try {
        const result = await pool.query(
            `SELECT id FROM obsidian.clientes WHERE UPPER(nome) ILIKE UPPER($1) LIMIT 1`,
            [clientIdInput]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ Cliente "${clientIdInput}" não encontrado no banco`);
            return null;
        }

        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Erro ao normalizar client_id:', error);
        return null;
    }
}

async function testNormalize() {
    try {
        const client_id = '1'; // Como vem do frontend

        console.log('📥 Input client_id:', client_id, typeof client_id);

        const resolvedClientId = await normalizeClientId(client_id);
        console.log('✅ Normalized client_id:', resolvedClientId, typeof resolvedClientId);

        // Buscar import_id mais recente
        const latestImportResult = await pool.query(
            `SELECT import_id 
             FROM raw_export_orders 
             WHERE client_id = $1 
             ORDER BY created_at DESC 
             LIMIT 1`,
            [resolvedClientId]
        );

        console.log('\n📦 Import ID encontrado:', latestImportResult.rows[0]?.import_id);

        // Testar query completa
        let whereClause = `WHERE status = 'matched' AND matched_sku IS NOT NULL`;
        const params = [];

        if (client_id) {
            const clientIdNum = await normalizeClientId(client_id);
            if (clientIdNum) {
                params.push(clientIdNum);
                whereClause += ` AND client_id = $${params.length}`;
            }
        }

        const finalImportId = latestImportResult.rows[0]?.import_id;
        if (finalImportId) {
            params.push(finalImportId);
            whereClause += ` AND import_id = $${params.length}`;
        }

        console.log('\n🔍 Query:', `SELECT COUNT(*) FROM raw_export_orders ${whereClause}`);
        console.log('📝 Params:', params);
        console.log('📝 Types:', params.map(p => typeof p));

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM raw_export_orders ${whereClause}`,
            params
        );

        console.log('\n✅ Total encontrado:', countResult.rows[0].count);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await pool.end();
        process.exit(1);
    }
}

testNormalize();

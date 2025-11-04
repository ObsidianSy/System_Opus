import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
});

async function limparDadosOutubro() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Buscar import_id dos uploads de outubro/novembro (últimos uploads)
        const importsResult = await client.query(`
            SELECT DISTINCT import_id 
            FROM raw_export_orders 
            WHERE created_at >= '2024-11-01'
            ORDER BY import_id
        `);

        console.log(`📋 Encontrados ${importsResult.rows.length} imports para limpar`);

        for (const row of importsResult.rows) {
            const importId = row.import_id;
            console.log(`\n🗑️  Limpando import: ${importId}`);

            // Contar registros antes
            const countVendas = await client.query(
                `SELECT COUNT(*) as total FROM obsidian.vendas WHERE import_id = $1`,
                [importId]
            );
            const countRaw = await client.query(
                `SELECT COUNT(*) as total FROM raw_export_orders WHERE import_id = $1`,
                [importId]
            );

            console.log(`   - Vendas: ${countVendas.rows[0].total}`);
            console.log(`   - Raw orders: ${countRaw.rows[0].total}`);

            // Deletar vendas relacionadas a este import
            await client.query(
                `DELETE FROM obsidian.vendas WHERE import_id = $1`,
                [importId]
            );

            // Deletar raw_export_orders deste import
            await client.query(
                `DELETE FROM raw_export_orders WHERE import_id = $1`,
                [importId]
            );

            console.log(`   ✅ Limpeza concluída`);
        }

        await client.query('COMMIT');
        console.log(`\n✅ Limpeza total concluída! Você pode reimportar a planilha agora.`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao limpar dados:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

limparDadosOutubro().catch(console.error);

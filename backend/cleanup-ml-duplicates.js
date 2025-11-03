const { pool } = require('./dist/database/db.js');

async function cleanup() {
    try {
        console.log('🧹 Buscando uploads duplicados do cliente "New Seven"...\n');

        // Buscar client_id
        const clientResult = await pool.query(
            `SELECT id FROM obsidian.clientes WHERE nome = 'New Seven'`
        );

        if (clientResult.rows.length === 0) {
            console.log('❌ Cliente "New Seven" não encontrado');
            await pool.end();
            return;
        }

        const clientId = clientResult.rows[0].id;
        console.log(`✅ Cliente ID: ${clientId}\n`);

        // Ver batches existentes
        const batches = await pool.query(
            `SELECT import_id, filename, total_rows, processed_rows, status, started_at 
             FROM obsidian.import_batches 
             WHERE client_id = $1 AND source = 'ML'
             ORDER BY started_at DESC`,
            [clientId]
        );

        console.log(`📦 Batches encontrados: ${batches.rows.length}\n`);
        batches.rows.forEach((batch, idx) => {
            console.log(`${idx + 1}. ID: ${batch.import_id}`);
            console.log(`   Arquivo: ${batch.filename}`);
            console.log(`   Total: ${batch.total_rows} | Processados: ${batch.processed_rows}`);
            console.log(`   Status: ${batch.status}`);
            console.log(`   Data: ${batch.started_at}`);
            console.log('');
        });

        // Contar registros em raw_export_orders
        const countResult = await pool.query(
            `SELECT COUNT(*) as count FROM raw_export_orders WHERE client_id = $1`,
            [clientId]
        );

        console.log(`📊 Total de registros em raw_export_orders: ${countResult.rows[0].count}\n`);

        // Perguntar se quer deletar
        console.log('⚠️  ATENÇÃO: Execute este script com "cleanup=true" para deletar:');
        console.log('   node cleanup-ml-duplicates.js cleanup=true\n');

        if (process.argv[2] === 'cleanup=true') {
            console.log('🗑️  DELETANDO dados...\n');

            // Deletar registros raw
            const deleteRaw = await pool.query(
                `DELETE FROM raw_export_orders WHERE client_id = $1`,
                [clientId]
            );
            console.log(`✅ ${deleteRaw.rowCount} registros deletados de raw_export_orders`);

            // Deletar batches
            const deleteBatches = await pool.query(
                `DELETE FROM obsidian.import_batches WHERE client_id = $1 AND source = 'ML'`,
                [clientId]
            );
            console.log(`✅ ${deleteBatches.rowCount} batches deletados`);

            console.log('\n✅ LIMPEZA CONCLUÍDA! Agora pode fazer novo upload.');
        }

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

cleanup();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkRecentMLImport() {
    try {
        console.log('🔍 VERIFICANDO ÚLTIMO IMPORT ML:\n');

        // Buscar o import mais recente
        const latestBatch = await pool.query(`
            SELECT 
                import_id,
                filename,
                client_id,
                status,
                total_rows,
                processed_rows,
                started_at,
                finished_at
            FROM obsidian.import_batches
            WHERE source = 'ML'
            ORDER BY started_at DESC
            LIMIT 1
        `);

        if (latestBatch.rows.length === 0) {
            console.log('❌ Nenhum import ML encontrado\n');
            process.exit(0);
        }

        const batch = latestBatch.rows[0];
        console.log('📦 ÚLTIMO IMPORT:');
        console.log(`   ID: ${batch.import_id}`);
        console.log(`   Arquivo: ${batch.filename}`);
        console.log(`   Cliente: ${batch.client_id}`);
        console.log(`   Status: ${batch.status}`);
        console.log(`   Total linhas: ${batch.total_rows}`);
        console.log(`   Processadas: ${batch.processed_rows || 0}`);
        console.log(`   Iniciado: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
        console.log(`   Finalizado: ${batch.finished_at ? new Date(batch.finished_at).toLocaleString('pt-BR') : 'Em andamento'}`);
        console.log('');

        // Verificar se tem dados em raw_export_orders com este import_id
        const rawCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM raw_export_orders
            WHERE import_id = $1
        `, [batch.import_id]);

        console.log(`📊 DADOS EM raw_export_orders:`);
        console.log(`   Registros com import_id ${batch.import_id}: ${rawCount.rows[0].count}`);
        console.log('');

        if (parseInt(rawCount.rows[0].count) === 0) {
            console.log('❌ PROBLEMA IDENTIFICADO:');
            console.log('   O batch foi criado mas NENHUM dado foi inserido em raw_export_orders!');
            console.log('   Isso confirma que o código de upload ML não está salvando os dados.\n');

            console.log('🔧 CAUSA:');
            console.log('   O endpoint de upload quando source=ML apenas cria o batch,');
            console.log('   mas não faz INSERT dos dados do Excel na tabela raw_export_orders.\n');
        } else {
            console.log('✅ Dados foram salvos corretamente!');
            console.log('');

            // Mostrar amostra
            const sample = await pool.query(`
                SELECT 
                    id,
                    order_id,
                    sku_text,
                    matched_sku,
                    status,
                    qty
                FROM raw_export_orders
                WHERE import_id = $1
                ORDER BY id
                LIMIT 10
            `, [batch.import_id]);

            console.log('Amostra dos dados (primeiros 10):');
            sample.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. Order: ${row.order_id}, SKU: ${row.sku_text}, Qtd: ${row.qty}, Status: ${row.status}`);
            });
            console.log('');

            // Contar por status
            const statusCount = await pool.query(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM raw_export_orders
                WHERE import_id = $1
                GROUP BY status
                ORDER BY count DESC
            `, [batch.import_id]);

            console.log('Distribuição por status:');
            statusCount.rows.forEach(row => {
                console.log(`  - ${row.status || 'NULL'}: ${row.count} registros`);
            });
        }

        // Verificar imports ainda mais recentes (últimos 30 min)
        console.log('\n\n🕐 VERIFICANDO IMPORTS DOS ÚLTIMOS 30 MINUTOS:\n');

        const recentBatches = await pool.query(`
            SELECT 
                import_id,
                filename,
                source,
                status,
                total_rows,
                started_at
            FROM obsidian.import_batches
            WHERE started_at > NOW() - INTERVAL '30 minutes'
            ORDER BY started_at DESC
        `);

        if (recentBatches.rows.length === 0) {
            console.log('ℹ️  Nenhum import nos últimos 30 minutos\n');
        } else {
            console.log(`Encontrados ${recentBatches.rows.length} import(s):\n`);

            for (const batch of recentBatches.rows) {
                const dataCount = await pool.query(`
                    SELECT COUNT(*) as count
                    FROM raw_export_orders
                    WHERE import_id = $1
                `, [batch.import_id]);

                const icon = parseInt(dataCount.rows[0].count) > 0 ? '✅' : '❌';
                console.log(`${icon} ${batch.filename} (${batch.source})`);
                console.log(`   ID: ${batch.import_id}`);
                console.log(`   Total no batch: ${batch.total_rows}`);
                console.log(`   Salvos em raw_export_orders: ${dataCount.rows[0].count}`);
                console.log(`   Hora: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
                console.log('');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkRecentMLImport();

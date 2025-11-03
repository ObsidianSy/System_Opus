const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function analyzeOrphanImports() {
    try {
        console.log('🔍 ANALISANDO IMPORTS ÓRFÃOS:\n');
        console.log('='.repeat(80) + '\n');

        // 1. Listar imports órfãos
        const orphans = await pool.query(`
            SELECT 
                b.import_id,
                b.filename,
                b.total_rows,
                b.started_at,
                b.client_id
            FROM obsidian.import_batches b
            WHERE b.source = 'ML'
              AND NOT EXISTS (
                  SELECT 1 FROM raw_export_orders r
                  WHERE r.import_id = b.import_id
              )
            ORDER BY b.started_at DESC
        `);

        console.log(`📦 IMPORTS ÓRFÃOS ENCONTRADOS: ${orphans.rows.length}\n`);

        orphans.rows.forEach((batch, idx) => {
            console.log(`${idx + 1}. ${batch.filename}`);
            console.log(`   ID: ${batch.import_id}`);
            console.log(`   Linhas esperadas: ${batch.total_rows}`);
            console.log(`   Data: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
            console.log(`   Cliente: ${batch.client_id}`);
            console.log('');
        });

        // 2. Verificar registros sem import_id ou com import_id NULL
        console.log('2️⃣ REGISTROS SEM IMPORT_ID:\n');

        const noImportId = await pool.query(`
            SELECT COUNT(*) as count
            FROM raw_export_orders
            WHERE import_id IS NULL
        `);

        console.log(`Total de registros sem import_id: ${noImportId.rows[0].count}\n`);

        // 3. Verificar import_ids existentes nos dados
        console.log('3️⃣ IMPORT_IDs EXISTENTES NOS DADOS:\n');

        const existingIds = await pool.query(`
            SELECT 
                import_id,
                COUNT(*) as count,
                MIN(created_at) as first_record,
                MAX(created_at) as last_record
            FROM raw_export_orders
            WHERE import_id IS NOT NULL
            GROUP BY import_id
            ORDER BY MAX(created_at) DESC
            LIMIT 10
        `);

        console.log('Últimos 10 import_ids com dados:\n');
        existingIds.rows.forEach((row, idx) => {
            console.log(`${idx + 1}. ${row.import_id}`);
            console.log(`   Registros: ${row.count}`);
            console.log(`   Período: ${new Date(row.first_record).toLocaleString('pt-BR')} até ${new Date(row.last_record).toLocaleString('pt-BR')}`);
            console.log('');
        });

        // 4. Verificar se há registros criados nas mesmas datas dos órfãos
        console.log('4️⃣ TENTANDO CORRELACIONAR ÓRFÃOS COM DADOS:\n');

        for (const orphan of orphans.rows) {
            const orphanDate = new Date(orphan.started_at);

            // Buscar registros criados em um intervalo de ±30 minutos
            const nearby = await pool.query(`
                SELECT 
                    COUNT(*) as count,
                    import_id,
                    MIN(created_at) as first_created
                FROM raw_export_orders
                WHERE created_at BETWEEN $1::timestamp - INTERVAL '30 minutes' 
                                     AND $1::timestamp + INTERVAL '30 minutes'
                GROUP BY import_id
            `, [orphan.started_at]);

            if (nearby.rows.length > 0) {
                console.log(`📅 Órfão: ${orphan.filename} (${orphan.total_rows} linhas)`);
                console.log(`   Data do batch: ${orphanDate.toLocaleString('pt-BR')}`);
                console.log(`   Registros próximos encontrados:`);

                nearby.rows.forEach(row => {
                    const diff = Math.abs(row.count - orphan.total_rows);
                    const match = diff === 0 ? '✅ MATCH EXATO!' : diff < 10 ? '⚠️ Próximo' : '';
                    console.log(`     - ${row.count} registros (import_id: ${row.import_id || 'NULL'}) ${match}`);
                });
                console.log('');
            } else {
                console.log(`❌ Órfão: ${orphan.filename} - SEM dados próximos encontrados\n`);
            }
        }

        // 5. Decisão sobre o que fazer
        console.log('='.repeat(80));
        console.log('💡 OPÇÕES:\n');

        const totalOrphanRows = orphans.rows.reduce((sum, o) => sum + parseInt(o.total_rows), 0);

        console.log(`Total de linhas perdidas: ${totalOrphanRows}\n`);

        console.log('OPÇÃO A) DESCARTAR IMPORTS ÓRFÃOS');
        console.log('   - Deletar os 4 batches órfãos do import_batches');
        console.log('   - Os dados estão perdidos (planilhas não foram salvas)');
        console.log('   - Sistema continuará funcionando normalmente para novos imports\n');

        console.log('OPÇÃO B) MARCAR COMO ERRO');
        console.log('   - Atualizar status dos batches órfãos para "error"');
        console.log('   - Adicionar mensagem explicando que dados não foram salvos');
        console.log('   - Manter histórico para referência\n');

        console.log('OPÇÃO C) AGUARDAR RE-IMPORT');
        console.log('   - Manter batches órfãos como estão');
        console.log('   - Quando/se conseguir os arquivos Excel, pode fazer upload novamente');
        console.log('   - Novo upload criará novos batches com dados\n');

        console.log('RECOMENDAÇÃO: Opção B (marcar como erro) + aguardar re-import se necessário');
        console.log('='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

analyzeOrphanImports();

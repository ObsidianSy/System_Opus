const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function verifyMLFix() {
    try {
        console.log('🔍 VERIFICAÇÃO FINAL DO SISTEMA ML:\n');
        console.log('='.repeat(80) + '\n');

        // 1. Verificar imports ML
        console.log('1️⃣ IMPORTS ML REGISTRADOS:\n');

        const batches = await pool.query(`
            SELECT 
                import_id,
                filename,
                status,
                total_rows,
                processed_rows,
                started_at
            FROM obsidian.import_batches
            WHERE source = 'ML'
            ORDER BY started_at DESC
            LIMIT 5
        `);

        console.log(`Total de imports: ${batches.rows.length}\n`);

        for (const batch of batches.rows) {
            // Contar dados em raw_export_orders
            const dataCount = await pool.query(`
                SELECT COUNT(*) as count
                FROM raw_export_orders
                WHERE import_id = $1
            `, [batch.import_id]);

            const hasData = parseInt(dataCount.rows[0].count) > 0;
            const icon = hasData ? '✅' : '❌';

            console.log(`${icon} ${batch.filename}`);
            console.log(`   ID: ${batch.import_id}`);
            console.log(`   Total no batch: ${batch.total_rows}`);
            console.log(`   Salvos em raw_export_orders: ${dataCount.rows[0].count}`);
            console.log(`   Data: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
            console.log('');
        }

        // 2. Estatísticas gerais
        console.log('2️⃣ ESTATÍSTICAS GERAIS:\n');

        const totalRows = await pool.query(`
            SELECT COUNT(*) as total
            FROM raw_export_orders
        `);

        const byStatus = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM raw_export_orders
            GROUP BY status
            ORDER BY count DESC
        `);

        console.log(`Total de registros em raw_export_orders: ${totalRows.rows[0].total}\n`);
        console.log('Distribuição por status:');
        byStatus.rows.forEach(row => {
            console.log(`  - ${row.status || 'NULL'}: ${row.count}`);
        });

        // 3. Verificar se há imports órfãos (batch sem dados)
        console.log('\n\n3️⃣ VERIFICANDO IMPORTS ÓRFÃOS:\n');

        const orphanBatches = await pool.query(`
            SELECT 
                b.import_id,
                b.filename,
                b.total_rows,
                b.started_at
            FROM obsidian.import_batches b
            WHERE b.source = 'ML'
              AND NOT EXISTS (
                  SELECT 1 FROM raw_export_orders r
                  WHERE r.import_id = b.import_id
              )
            ORDER BY b.started_at DESC
        `);

        if (orphanBatches.rows.length === 0) {
            console.log('✅ Nenhum import órfão encontrado!\n');
        } else {
            console.log(`⚠️  ${orphanBatches.rows.length} import(s) órfão(s) encontrado(s):\n`);
            orphanBatches.rows.forEach(batch => {
                console.log(`  - ${batch.filename} (${batch.total_rows} linhas)`);
                console.log(`    ID: ${batch.import_id}`);
                console.log(`    Data: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
                console.log('');
            });
        }

        // 4. Resumo final
        console.log('='.repeat(80));
        console.log('📋 RESUMO:\n');

        const issues = [];
        const successes = [];

        if (parseInt(totalRows.rows[0].total) > 0) {
            successes.push(`✅ Total de ${totalRows.rows[0].total} registros em raw_export_orders`);
        }

        const pendingCount = byStatus.rows.find(r => r.status === 'pending');
        const matchedCount = byStatus.rows.find(r => r.status === 'matched');

        if (pendingCount) {
            successes.push(`✅ ${pendingCount.count} itens aguardando relacionamento`);
        }

        if (matchedCount) {
            successes.push(`✅ ${matchedCount.count} itens já relacionados`);
        }

        if (orphanBatches.rows.length > 0) {
            issues.push(`⚠️  ${orphanBatches.rows.length} import(s) órfão(s) sem dados`);
        }

        console.log('SUCESSOS:');
        successes.forEach(s => console.log(`  ${s}`));

        if (issues.length > 0) {
            console.log('\nISSUES:');
            issues.forEach(i => console.log(`  ${i}`));
            console.log('\n💡 RECOMENDAÇÃO: Faça um novo upload de teste para verificar se a correção está funcionando.\n');
        } else {
            console.log('\n🎉 SISTEMA ML FUNCIONANDO CORRETAMENTE!\n');
        }

        console.log('='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

verifyMLFix();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function markOrphansAsError() {
    try {
        console.log('🔧 MARCANDO IMPORTS ÓRFÃOS COMO ERRO:\n');
        console.log('='.repeat(80) + '\n');

        // Buscar imports órfãos
        const orphans = await pool.query(`
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

        console.log(`📦 Encontrados ${orphans.rows.length} imports órfãos\n`);

        if (orphans.rows.length === 0) {
            console.log('✅ Nenhum import órfão encontrado!\n');
            process.exit(0);
        }

        let updated = 0;

        for (const batch of orphans.rows) {
            console.log(`Processando: ${batch.filename}`);
            console.log(`  ID: ${batch.import_id}`);
            console.log(`  Data: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);

            // Atualizar status para error e adicionar mensagem
            await pool.query(`
                UPDATE obsidian.import_batches
                SET status = 'error',
                    processed_rows = 0,
                    finished_at = NOW()
                WHERE import_id = $1
            `, [batch.import_id]);

            updated++;
            console.log(`  ✅ Marcado como erro\n`);
        }

        console.log('='.repeat(80));
        console.log(`✅ ${updated} import(s) marcado(s) como erro\n`);
        console.log('📋 EXPLICAÇÃO DO ERRO:');
        console.log('   Estes imports foram feitos ANTES da correção do sistema.');
        console.log('   O código não estava salvando os dados em raw_export_orders.');
        console.log('   Os dados destes imports foram perdidos.\n');
        console.log('💡 SOLUÇÃO:');
        console.log('   Se necessário, faça novo upload dos mesmos arquivos.');
        console.log('   O sistema agora está corrigido e salvará os dados corretamente.\n');
        console.log('='.repeat(80));

        // Verificar situação final
        const remaining = await pool.query(`
            SELECT COUNT(*) as count
            FROM obsidian.import_batches b
            WHERE b.source = 'ML'
              AND b.status != 'error'
              AND NOT EXISTS (
                  SELECT 1 FROM raw_export_orders r
                  WHERE r.import_id = b.import_id
              )
        `);

        if (parseInt(remaining.rows[0].count) === 0) {
            console.log('✅ Todos os imports órfãos foram marcados como erro!\n');
        } else {
            console.log(`⚠️  Ainda há ${remaining.rows[0].count} import(s) órfão(s)\n`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

markOrphansAsError();

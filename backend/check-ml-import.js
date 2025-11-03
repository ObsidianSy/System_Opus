const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkMLImport() {
    try {
        console.log('🔍 VERIFICANDO SISTEMA DE IMPORT ML:\n');
        console.log('='.repeat(80) + '\n');

        // 1. Verificar estrutura da tabela raw_export_orders
        console.log('1️⃣ ESTRUTURA DA TABELA raw_export_orders:\n');

        const columns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'raw_export_orders'
            ORDER BY ordinal_position
        `);

        if (columns.rows.length === 0) {
            console.log('❌ TABELA raw_export_orders NÃO EXISTE!\n');
            console.log('Tentando encontrar em outro schema...\n');

            const searchTable = await pool.query(`
                SELECT table_schema, table_name
                FROM information_schema.tables
                WHERE table_name LIKE '%raw%order%' OR table_name LIKE '%ml%'
                ORDER BY table_schema, table_name
            `);

            console.log('Tabelas encontradas:');
            searchTable.rows.forEach(row => {
                console.log(`  - ${row.table_schema}.${row.table_name}`);
            });
        } else {
            console.log('Colunas em raw_export_orders:');
            columns.rows.forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });
        }

        console.log('\n');

        // 2. Verificar import_batches recentes
        console.log('2️⃣ IMPORT_BATCHES RECENTES (ML):\n');

        const batches = await pool.query(`
            SELECT 
                import_id,
                filename,
                source,
                client_id,
                status,
                total_rows,
                processed_rows,
                started_at,
                finished_at
            FROM obsidian.import_batches
            WHERE source = 'ML'
            ORDER BY started_at DESC
            LIMIT 5
        `);

        if (batches.rows.length === 0) {
            console.log('⚠️  Nenhum import ML encontrado em import_batches\n');
        } else {
            console.log(`Total de imports ML: ${batches.rows.length}\n`);
            batches.rows.forEach(batch => {
                console.log(`📦 Import #${batch.import_id}:`);
                console.log(`   Arquivo: ${batch.filename}`);
                console.log(`   Cliente: ${batch.client_id}`);
                console.log(`   Status: ${batch.status}`);
                console.log(`   Linhas: ${batch.total_rows} (processadas: ${batch.processed_rows || 0})`);
                console.log(`   Data: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
                console.log('');
            });
        }

        // 3. Verificar se há dados em raw_export_orders
        if (columns.rows.length > 0) {
            console.log('3️⃣ DADOS EM raw_export_orders:\n');

            const countRaw = await pool.query(`
                SELECT COUNT(*) as total
                FROM raw_export_orders
            `);

            console.log(`Total de registros: ${countRaw.rows[0].total}\n`);

            if (parseInt(countRaw.rows[0].total) > 0) {
                const recentRaw = await pool.query(`
                    SELECT 
                        id,
                        order_id,
                        sku_text,
                        matched_sku,
                        status,
                        client_id,
                        created_at
                    FROM raw_export_orders
                    ORDER BY created_at DESC
                    LIMIT 5
                `);

                console.log('Últimos 5 registros:');
                recentRaw.rows.forEach(row => {
                    console.log(`  - ID: ${row.id}, Order: ${row.order_id}, SKU: ${row.sku_text}, Status: ${row.status}`);
                });
            } else {
                console.log('⚠️  Tabela vazia - nenhum dado foi importado!\n');
            }
        }

        // 4. Diagnosticar o problema
        console.log('\n' + '='.repeat(80));
        console.log('📋 DIAGNÓSTICO:\n');

        if (columns.rows.length === 0) {
            console.log('❌ PROBLEMA: Tabela raw_export_orders não existe');
            console.log('   SOLUÇÃO: Criar a tabela ou identificar nome correto\n');
        } else if (batches.rows.length > 0 && parseInt((await pool.query(`SELECT COUNT(*) as total FROM raw_export_orders`)).rows[0].total) === 0) {
            console.log('❌ PROBLEMA: Imports ML registrados em import_batches, mas dados não foram salvos em raw_export_orders');
            console.log('   CAUSA: Código de upload ML não está inserindo dados na tabela');
            console.log('   SOLUÇÃO: Adicionar INSERT INTO raw_export_orders no endpoint de upload quando source=ML\n');
        } else if (batches.rows.length === 0) {
            console.log('ℹ️  Nenhum import ML foi feito ainda');
            console.log('   Faça um teste de upload para verificar se funciona\n');
        } else {
            console.log('✅ Sistema aparenta estar funcionando normalmente\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkMLImport();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkRecentUpload() {
    try {
        console.log('🔍 VERIFICANDO UPLOAD MAIS RECENTE:\n');
        console.log('='.repeat(80) + '\n');

        // 1. Buscar o import mais recente
        const latestBatch = await pool.query(`
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
            ORDER BY started_at DESC
            LIMIT 1
        `);

        if (latestBatch.rows.length === 0) {
            console.log('❌ Nenhum import encontrado\n');
            process.exit(0);
        }

        const batch = latestBatch.rows[0];
        console.log('📦 ÚLTIMO IMPORT:');
        console.log(`   ID: ${batch.import_id}`);
        console.log(`   Arquivo: ${batch.filename}`);
        console.log(`   Source: ${batch.source}`);
        console.log(`   Cliente: ${batch.client_id}`);
        console.log(`   Status: ${batch.status}`);
        console.log(`   Total linhas: ${batch.total_rows}`);
        console.log(`   Processadas: ${batch.processed_rows || 0}`);
        console.log(`   Data: ${new Date(batch.started_at).toLocaleString('pt-BR')}`);
        console.log('');

        // 2. Se for ML, verificar em raw_export_orders
        if (batch.source === 'ML') {
            console.log('2️⃣ VERIFICANDO raw_export_orders:\n');

            const rawCount = await pool.query(`
                SELECT COUNT(*) as count
                FROM raw_export_orders
                WHERE import_id = $1
            `, [batch.import_id]);

            console.log(`   Registros com import_id: ${rawCount.rows[0].count}`);

            if (parseInt(rawCount.rows[0].count) > 0) {
                // Mostrar amostra
                const sample = await pool.query(`
                    SELECT 
                        id,
                        sku_text,
                        matched_sku,
                        status,
                        qty,
                        created_at
                    FROM raw_export_orders
                    WHERE import_id = $1
                    ORDER BY id
                    LIMIT 10
                `, [batch.import_id]);

                console.log('\n   Amostra (primeiros 10):');
                sample.rows.forEach((row, idx) => {
                    console.log(`   ${idx + 1}. SKU: ${row.sku_text}, Status: ${row.status}, Qtd: ${row.qty}`);
                });

                // Contar por status
                const byStatus = await pool.query(`
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM raw_export_orders
                    WHERE import_id = $1
                    GROUP BY status
                    ORDER BY count DESC
                `, [batch.import_id]);

                console.log('\n   Distribuição por status:');
                byStatus.rows.forEach(row => {
                    console.log(`     - ${row.status}: ${row.count}`);
                });
            } else {
                console.log('   ❌ NENHUM registro encontrado!');
                console.log('   Isso significa que o upload não salvou os dados.');
            }
        }

        // 3. Se for FULL, verificar em full_envio_raw
        if (batch.source === 'FULL') {
            console.log('2️⃣ VERIFICANDO full_envio_raw:\n');

            // Buscar envio_id relacionado
            const envio = await pool.query(`
                SELECT id, envio_num
                FROM logistica.full_envio
                WHERE arquivo_nome = $1
                ORDER BY created_at DESC
                LIMIT 1
            `, [batch.filename]);

            if (envio.rows.length > 0) {
                const envioId = envio.rows[0].id;

                const rawCount = await pool.query(`
                    SELECT COUNT(*) as count
                    FROM logistica.full_envio_raw
                    WHERE envio_id = $1
                `, [envioId]);

                console.log(`   Registros em full_envio_raw: ${rawCount.rows[0].count}`);

                if (parseInt(rawCount.rows[0].count) > 0) {
                    const sample = await pool.query(`
                        SELECT 
                            id,
                            sku_texto,
                            matched_sku,
                            status,
                            qtd
                        FROM logistica.full_envio_raw
                        WHERE envio_id = $1
                        ORDER BY id
                        LIMIT 10
                    `, [envioId]);

                    console.log('\n   Amostra (primeiros 10):');
                    sample.rows.forEach((row, idx) => {
                        console.log(`   ${idx + 1}. SKU: ${row.sku_texto}, Status: ${row.status}, Qtd: ${row.qtd}`);
                    });
                }
            }
        }

        console.log('\n' + '='.repeat(80));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkRecentUpload();

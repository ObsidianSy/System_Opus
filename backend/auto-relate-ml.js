const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function autoRelateExistingML() {
    try {
        console.log('🔄 AUTO-RELACIONAMENTO DOS DADOS ML EXISTENTES:\n');
        console.log('='.repeat(80) + '\n');

        // 1. Verificar quantos pendentes existem
        const pendingCount = await pool.query(`
            SELECT COUNT(*) as count
            FROM raw_export_orders
            WHERE status = 'pending'
        `);

        const totalPending = parseInt(pendingCount.rows[0].count);
        console.log(`📊 Total de itens pending: ${totalPending}\n`);

        if (totalPending === 0) {
            console.log('✅ Não há itens pending para relacionar!\n');
            process.exit(0);
        }

        // 2. Buscar client_id mais comum nos pendentes
        const clientInfo = await pool.query(`
            SELECT client_id, COUNT(*) as count
            FROM raw_export_orders
            WHERE status = 'pending'
            GROUP BY client_id
            ORDER BY count DESC
            LIMIT 1
        `);

        const clientId = clientInfo.rows[0].client_id;
        console.log(`👤 Cliente principal: ${clientId} (${clientInfo.rows[0].count} itens pending)\n`);

        // 3. Auto-relacionar itens pending
        console.log('🔄 Iniciando auto-relacionamento...\n');

        const pendingRows = await pool.query(`
            SELECT id, sku_text, order_id, client_id
            FROM raw_export_orders
            WHERE status = 'pending'
            ORDER BY id
        `);

        let matched = 0;
        let notFound = 0;

        for (const row of pendingRows.rows) {
            let matchedSku = null;
            let matchSource = '';

            // 1️⃣ Buscar SKU exato (produtos não tem client_id, só SKU único)
            const produtoResult = await pool.query(
                `SELECT sku 
                 FROM obsidian.produtos 
                 WHERE UPPER(sku) = UPPER(TRIM($1))
                 LIMIT 1`,
                [row.sku_text]
            );

            if (produtoResult.rows.length > 0) {
                matchedSku = produtoResult.rows[0].sku;
                matchSource = 'produto_exato';
            } else {
                // 2️⃣ Buscar em aliases (aliases tem client_id)
                const aliasResult = await pool.query(
                    `SELECT stock_sku, id 
                     FROM obsidian.sku_aliases 
                     WHERE client_id = $1 
                       AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                           UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                     ORDER BY confidence_default DESC, times_used DESC 
                     LIMIT 1`,
                    [row.client_id, row.sku_text]
                );

                if (aliasResult.rows.length > 0) {
                    matchedSku = aliasResult.rows[0].stock_sku;
                    matchSource = 'alias';

                    // Atualizar uso
                    await pool.query(
                        `UPDATE obsidian.sku_aliases 
                         SET times_used = times_used + 1, 
                             last_used_at = NOW() 
                         WHERE id = $1`,
                        [aliasResult.rows[0].id]
                    );
                }
            }

            if (matchedSku) {
                await pool.query(
                    `UPDATE raw_export_orders 
                     SET matched_sku = $1, 
                         status = 'matched', 
                         match_source = $2,
                         processed_at = NOW() 
                     WHERE id = $3`,
                    [matchedSku, matchSource, row.id]
                );
                matched++;
                
                if (matched % 50 === 0) {
                    console.log(`  ✅ ${matched} itens relacionados...`);
                }
            } else {
                notFound++;
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📊 RESULTADO DO AUTO-RELACIONAMENTO:\n');
        console.log(`  Total processado: ${pendingRows.rows.length}`);
        console.log(`  ✅ Matched: ${matched}`);
        console.log(`  ⚠️  Não encontrados: ${notFound}`);
        console.log('');

        // 4. Mostrar alguns exemplos de não encontrados
        if (notFound > 0) {
            const stillPending = await pool.query(`
                SELECT sku_text, COUNT(*) as count
                FROM raw_export_orders
                WHERE status = 'pending'
                GROUP BY sku_text
                ORDER BY count DESC
                LIMIT 10
            `);

            console.log('Top 10 SKUs ainda pending (para criar aliases):');
            stillPending.rows.forEach((row, idx) => {
                console.log(`  ${idx + 1}. ${row.sku_text} (${row.count} pedidos)`);
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log(`✅ Auto-relacionamento concluído! ${matched} itens matched.\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

autoRelateExistingML();

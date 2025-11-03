const { pool } = require('./dist/database/db.js');

async function analyzeMatching() {
    try {
        console.log('🔍 Analisando auto-relacionamento...\n');

        // 1. Pegar alguns SKUs pendentes (exceto CMS)
        const pending = await pool.query(`
            SELECT DISTINCT sku_text 
            FROM raw_export_orders 
            WHERE client_id = 1 
              AND status = 'pending'
              AND sku_text NOT LIKE 'CMS%'
            LIMIT 20
        `);

        console.log(`📦 ${pending.rows.length} SKUs pendentes (sem CMS):\n`);
        
        for (const row of pending.rows) {
            const sku = row.sku_text;
            console.log(`\n🔹 SKU: ${sku}`);

            // Buscar em produtos (match exato)
            const produto = await pool.query(`
                SELECT sku FROM obsidian.produtos 
                WHERE UPPER(sku) = UPPER(TRIM($1))
                LIMIT 1
            `, [sku]);

            if (produto.rows.length > 0) {
                console.log(`   ✅ Match DIRETO em produtos: ${produto.rows[0].sku}`);
            } else {
                console.log(`   ❌ NÃO encontrado em produtos`);

                // Buscar similar em produtos (sem hífens/espaços)
                const similar = await pool.query(`
                    SELECT sku FROM obsidian.produtos 
                    WHERE UPPER(REGEXP_REPLACE(sku, '[^A-Z0-9]', '', 'g')) = 
                          UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))
                    LIMIT 5
                `, [sku]);

                if (similar.rows.length > 0) {
                    console.log(`   💡 SIMILAR em produtos (normalizado):`);
                    similar.rows.forEach(s => console.log(`      - ${s.sku}`));
                } else {
                    console.log(`   ⚠️  Não existe em produtos (nem similar)`);
                }
            }

            // Buscar em aliases
            const alias = await pool.query(`
                SELECT alias_text, stock_sku 
                FROM obsidian.sku_aliases 
                WHERE client_id = 1
                  AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                      UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))
                LIMIT 1
            `, [sku]);

            if (alias.rows.length > 0) {
                console.log(`   ✅ Match em ALIAS: "${alias.rows[0].alias_text}" → ${alias.rows[0].stock_sku}`);
            } else {
                console.log(`   ❌ NÃO encontrado em aliases`);
            }
        }

        // 2. Ver estatísticas gerais
        console.log('\n\n📊 ESTATÍSTICAS GERAIS:\n');

        const stats = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count
            FROM raw_export_orders
            WHERE client_id = 1
            GROUP BY status
        `);

        stats.rows.forEach(s => {
            console.log(`${s.status}: ${s.count}`);
        });

        // 3. Ver quantos produtos existem para o cliente
        const produtosCount = await pool.query(`
            SELECT COUNT(*) as count FROM obsidian.produtos
        `);
        console.log(`\n📦 Total de produtos cadastrados: ${produtosCount.rows[0].count}`);

        // 4. Ver quantos aliases existem para o cliente
        const aliasesCount = await pool.query(`
            SELECT COUNT(*) as count FROM obsidian.sku_aliases WHERE client_id = 1
        `);
        console.log(`🔗 Total de aliases do cliente: ${aliasesCount.rows[0].count}`);

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

analyzeMatching();

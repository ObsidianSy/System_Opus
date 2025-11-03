const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function fixOrphanMatched() {
    try {
        console.log('🔧 CORRIGINDO ITENS MATCHED ÓRFÃOS:\n');

        // Buscar todos os itens matched sem correspondência em full_envio_item
        const orphans = await pool.query(`
            SELECT 
                r.id,
                r.envio_id,
                r.codigo_ml,
                r.matched_sku,
                r.qtd
            FROM logistica.full_envio_raw r
            WHERE r.status = 'matched'
              AND r.matched_sku IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM logistica.full_envio_item i
                  WHERE i.envio_id = r.envio_id
                    AND i.sku = r.matched_sku
                    AND i.codigo_ml = r.codigo_ml
              )
            ORDER BY r.envio_id, r.id
        `);

        console.log(`Total de itens matched órfãos encontrados: ${orphans.rows.length}\n`);

        if (orphans.rows.length === 0) {
            console.log('✅ Nenhum item órfão encontrado! Sistema está 100% consistente.\n');
            process.exit(0);
        }

        let fixed = 0;
        let errors = 0;

        for (const row of orphans.rows) {
            try {
                // Buscar dados do produto
                const produtoInfo = await pool.query(
                    `SELECT sku, preco_unitario, COALESCE(is_kit, FALSE) as is_kit
                     FROM obsidian.produtos 
                     WHERE sku = $1`,
                    [row.matched_sku]
                );

                if (produtoInfo.rows.length > 0) {
                    const prod = produtoInfo.rows[0];
                    const valorTotal = prod.preco_unitario * parseFloat(row.qtd);

                    // Inserir em full_envio_item
                    await pool.query(
                        `INSERT INTO logistica.full_envio_item 
                         (envio_id, codigo_ml, sku, qtd, is_kit, preco_unit_interno, valor_total)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (envio_id, sku, codigo_ml) 
                         DO UPDATE SET qtd = logistica.full_envio_item.qtd + EXCLUDED.qtd`,
                        [row.envio_id, row.codigo_ml, row.matched_sku, row.qtd, prod.is_kit, prod.preco_unitario, valorTotal]
                    );

                    // Limpar error_msg em full_envio_raw
                    await pool.query(
                        `UPDATE logistica.full_envio_raw 
                         SET error_msg = NULL 
                         WHERE id = $1`,
                        [row.id]
                    );

                    fixed++;
                    console.log(`✅ Corrigido: Envio ${row.envio_id}, SKU ${row.matched_sku}, Código ${row.codigo_ml}`);
                } else {
                    console.log(`⚠️  SKU ${row.matched_sku} não encontrado em produtos (Envio ${row.envio_id})`);
                    errors++;
                }
            } catch (err) {
                console.error(`❌ Erro ao corrigir item ${row.id}:`, err.message);
                errors++;
            }
        }

        console.log(`\n\n📊 RESULTADO:`);
        console.log(`  ✅ Corrigidos: ${fixed}`);
        if (errors > 0) {
            console.log(`  ❌ Erros: ${errors}`);
        }

        // Atualizar totais dos envios afetados
        console.log(`\n🔄 Atualizando totais dos envios...\n`);

        const uniqueEnvios = [...new Set(orphans.rows.map(r => r.envio_id))];

        for (const envioId of uniqueEnvios) {
            await pool.query(`
                UPDATE logistica.full_envio fe
                SET tot_itens = sub.cnt,
                    tot_qtd = sub.sum_qtd,
                    tot_valor_previsto = sub.sum_val,
                    status = CASE WHEN EXISTS (
                        SELECT 1 FROM logistica.full_envio_raw
                        WHERE envio_id=$1 AND status='pending'
                    ) THEN 'draft' ELSE 'ready' END
                FROM (
                    SELECT envio_id, COUNT(*) cnt, SUM(qtd) sum_qtd, SUM(valor_total) sum_val
                    FROM logistica.full_envio_item 
                    WHERE envio_id=$1 
                    GROUP BY envio_id
                ) sub
                WHERE fe.id=sub.envio_id
            `, [envioId]);

            console.log(`  ✅ Envio ${envioId} atualizado`);
        }

        console.log(`\n✅ CORREÇÃO CONCLUÍDA! Todos os itens matched agora têm correspondência em full_envio_item.\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

fixOrphanMatched();

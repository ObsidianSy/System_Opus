const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkConsistency() {
    try {
        console.log('🔍 VERIFICAÇÃO DE CONSISTÊNCIA DO IMPORT FULL\n');

        // 1. Verificar se full_envio_raw e full_envio_item estão sincronizados
        console.log('1️⃣ Verificando sincronização RAW vs ITEM:');

        const syncCheck = await pool.query(`
            SELECT 
                e.envio_num,
                e.status as envio_status,
                COUNT(DISTINCT r.id) as raw_count,
                COUNT(DISTINCT CASE WHEN r.status = 'matched' THEN r.id END) as raw_matched,
                COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as raw_pending,
                COUNT(DISTINCT i.id) as item_count
            FROM logistica.full_envio e
            LEFT JOIN logistica.full_envio_raw r ON r.envio_id = e.id
            LEFT JOIN logistica.full_envio_item i ON i.envio_id = e.id
            GROUP BY e.id, e.envio_num, e.status
            ORDER BY e.id DESC
            LIMIT 10
        `);

        console.log('┌─────────────┬───────────┬──────────┬─────────────┬─────────────┬────────────┐');
        console.log('│ Envio Num   │ Status    │ RAW Total│ RAW Matched │ RAW Pending │ ITEM Count │');
        console.log('├─────────────┼───────────┼──────────┼─────────────┼─────────────┼────────────┤');
        syncCheck.rows.forEach(row => {
            console.log(`│ ${row.envio_num.padEnd(11)} │ ${row.envio_status.padEnd(9)} │ ${String(row.raw_count).padEnd(8)} │ ${String(row.raw_matched).padEnd(11)} │ ${String(row.raw_pending).padEnd(11)} │ ${String(row.item_count).padEnd(10)} │`);
        });
        console.log('└─────────────┴───────────┴──────────┴─────────────┴─────────────┴────────────┘\n');

        // 2. Verificar itens em full_envio_item que não vieram de full_envio_raw
        console.log('2️⃣ Verificando origem dos dados em full_envio_item:');

        const itemSource = await pool.query(`
            SELECT 
                i.envio_id,
                e.envio_num,
                COUNT(i.id) as total_items,
                COUNT(DISTINCT i.codigo_ml) as unique_codes,
                COUNT(DISTINCT CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM logistica.full_envio_raw r 
                        WHERE r.envio_id = i.envio_id 
                          AND r.codigo_ml = i.codigo_ml
                    ) THEN i.id 
                END) as items_from_raw,
                COUNT(DISTINCT CASE 
                    WHEN NOT EXISTS (
                        SELECT 1 FROM logistica.full_envio_raw r 
                        WHERE r.envio_id = i.envio_id 
                          AND r.codigo_ml = i.codigo_ml
                    ) THEN i.id 
                END) as items_orphan
            FROM logistica.full_envio_item i
            JOIN logistica.full_envio e ON e.id = i.envio_id
            GROUP BY i.envio_id, e.envio_num
            ORDER BY i.envio_id DESC
            LIMIT 10
        `);

        console.log('┌─────────────┬────────────┬──────────────┬───────────────┬──────────────┐');
        console.log('│ Envio Num   │ Total Items│ From RAW     │ Orphan        │ Status       │');
        console.log('├─────────────┼────────────┼──────────────┼───────────────┼──────────────┤');
        itemSource.rows.forEach(row => {
            const status = row.items_orphan > 0 ? '⚠️  ORPHAN' : '✅ OK';
            console.log(`│ ${row.envio_num.padEnd(11)} │ ${String(row.total_items).padEnd(10)} │ ${String(row.items_from_raw).padEnd(12)} │ ${String(row.items_orphan).padEnd(13)} │ ${status.padEnd(12)} │`);
        });
        console.log('└─────────────┴────────────┴──────────────┴───────────────┴──────────────┘\n');

        // 3. Verificar vendas emitidas
        console.log('3️⃣ Verificando vendas emitidas:');

        const salesCheck = await pool.query(`
            SELECT 
                e.envio_num,
                e.status as envio_status,
                e.emitted_at,
                COUNT(DISTINCT v.pedido_uid) as vendas_count,
                SUM(v.quantidade_vendida) as total_qtd_vendas
            FROM logistica.full_envio e
            LEFT JOIN obsidian.vendas v ON v.pedido_uid LIKE 'FULL-' || e.envio_num || '-%'
            WHERE e.status = 'emitted'
            GROUP BY e.id, e.envio_num, e.status, e.emitted_at
            ORDER BY e.id DESC
            LIMIT 10
        `);

        if (salesCheck.rows.length === 0) {
            console.log('⚠️  Nenhum envio com status "emitted" encontrado\n');
        } else {
            console.log('┌─────────────┬─────────────┬──────────────┐');
            console.log('│ Envio Num   │ Vendas Count│ Qtd Total    │');
            console.log('├─────────────┼─────────────┼──────────────┤');
            salesCheck.rows.forEach(row => {
                console.log(`│ ${row.envio_num.padEnd(11)} │ ${String(row.vendas_count).padEnd(12)} │ ${String(row.total_qtd_vendas || 0).padEnd(12)} │`);
            });
            console.log('└─────────────┴─────────────┴──────────────┘\n');
        }

        // 4. Verificar aliases funcionando
        console.log('4️⃣ Verificando uso de aliases no auto-relacionamento:');

        const aliasUsage = await pool.query(`
            SELECT 
                a.alias_text,
                a.stock_sku,
                a.times_used,
                a.confidence_default,
                a.last_used_at,
                c.nome as cliente_nome
            FROM obsidian.sku_aliases a
            JOIN obsidian.clientes c ON c.id = a.client_id
            WHERE a.times_used > 0
            ORDER BY a.last_used_at DESC NULLS LAST, a.times_used DESC
            LIMIT 10
        `);

        if (aliasUsage.rows.length === 0) {
            console.log('⚠️  Nenhum alias sendo utilizado\n');
        } else {
            console.log('┌────────────────────┬────────────────────┬───────────┬───────────┬─────────────┐');
            console.log('│ Alias Text         │ Stock SKU          │ Times Used│ Cliente   │ Last Used   │');
            console.log('├────────────────────┼────────────────────┼───────────┼───────────┼─────────────┤');
            aliasUsage.rows.forEach(row => {
                const lastUsed = row.last_used_at ? new Date(row.last_used_at).toLocaleDateString('pt-BR') : 'Nunca';
                console.log(`│ ${row.alias_text.substring(0, 18).padEnd(18)} │ ${row.stock_sku.substring(0, 18).padEnd(18)} │ ${String(row.times_used).padEnd(9)} │ ${row.cliente_nome.substring(0, 9).padEnd(9)} │ ${lastUsed.padEnd(11)} │`);
            });
            console.log('└────────────────────┴────────────────────┴───────────┴───────────┴─────────────┘\n');
        }

        // 5. Verificar problemas potenciais
        console.log('5️⃣ DIAGNÓSTICO DE PROBLEMAS:\n');

        // Problema 1: full_envio_item populado mas RAW não sincronizado
        const problem1 = await pool.query(`
            SELECT COUNT(*) as count
            FROM logistica.full_envio_item i
            WHERE NOT EXISTS (
                SELECT 1 FROM logistica.full_envio_raw r
                WHERE r.envio_id = i.envio_id
                  AND r.codigo_ml = i.codigo_ml
                  AND r.matched_sku = i.sku
            )
        `);

        if (parseInt(problem1.rows[0].count) > 0) {
            console.log(`⚠️  PROBLEMA 1: ${problem1.rows[0].count} registros em full_envio_item sem correspondência em full_envio_raw`);
            console.log('   Causa provável: Sistema antigo populava full_envio_item diretamente');
            console.log('   Solução: Sistema agora usa apenas full_envio_raw\n');
        } else {
            console.log('✅ Problema 1: OK - Todos os items têm correspondência no RAW\n');
        }

        // Problema 2: RAW matched mas sem venda criada
        const problem2 = await pool.query(`
            SELECT 
                e.envio_num,
                COUNT(r.id) as raw_matched_count,
                COUNT(DISTINCT v.pedido_uid) as vendas_count
            FROM logistica.full_envio e
            JOIN logistica.full_envio_raw r ON r.envio_id = e.id AND r.status = 'matched'
            LEFT JOIN obsidian.vendas v ON v.pedido_uid = 'FULL-' || e.envio_num || '-' || e.id
            WHERE e.status = 'emitted'
            GROUP BY e.id, e.envio_num
            HAVING COUNT(DISTINCT v.pedido_uid) = 0
        `);

        if (problem2.rows.length > 0) {
            console.log(`⚠️  PROBLEMA 2: ${problem2.rows.length} envios emitidos com itens faltando em vendas:`);
            problem2.rows.forEach(row => {
                console.log(`   - Envio ${row.envio_num}: ${row.raw_matched_count} itens matched, mas ${row.vendas_count} vendas criadas`);
            });
            console.log('   Causa provável: Erro na emissão de vendas');
            console.log('   Solução: Re-emitir vendas para esses envios\n');
        } else {
            console.log('✅ Problema 2: OK - Todos os envios emitidos têm vendas correspondentes\n');
        }

        console.log('✅ Verificação completa!\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkConsistency();

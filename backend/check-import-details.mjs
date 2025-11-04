import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkImportDetails() {
    try {
        console.log('\n🔍 VERIFICANDO DETALHES DA IMPORTAÇÃO ML\n');

        // 1. Última importação ML
        const lastImport = await pool.query(`
            SELECT 
                import_id,
                filename,
                client_id,
                c.nome as client_name,
                source,
                total_rows,
                processed_rows,
                status,
                started_at as created_at
            FROM obsidian.import_batches ib
            LEFT JOIN obsidian.clientes c ON c.id = ib.client_id
            WHERE source = 'ML'
            ORDER BY started_at DESC
            LIMIT 1
        `);

        if (lastImport.rows.length === 0) {
            console.log('❌ Nenhuma importação ML encontrada');
            return;
        }

        const importInfo = lastImport.rows[0];
        console.log('📦 ÚLTIMA IMPORTAÇÃO:');
        console.log(`   ID: ${importInfo.import_id}`);
        console.log(`   Arquivo: ${importInfo.filename}`);
        console.log(`   Cliente ID: ${importInfo.client_id}`);
        console.log(`   Cliente Nome: ${importInfo.client_name}`);
        console.log(`   Total de linhas: ${importInfo.total_rows}`);
        console.log(`   Linhas processadas: ${importInfo.processed_rows}`);
        console.log(`   Status: ${importInfo.status}`);
        console.log(`   Data: ${importInfo.created_at}`);

        // 2. Dados importados na raw_export_orders
        const rawCount = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT order_id) as unique_orders,
                status,
                COUNT(*) FILTER (WHERE matched_sku IS NOT NULL) as matched,
                COUNT(*) FILTER (WHERE matched_sku IS NULL) as pending
            FROM raw_export_orders
            WHERE import_id = $1
            GROUP BY status
        `, [importInfo.import_id]);

        console.log('\n📊 DADOS EM raw_export_orders:');
        if (rawCount.rows.length > 0) {
            rawCount.rows.forEach(row => {
                console.log(`   Status ${row.status}:`);
                console.log(`   - Total de itens: ${row.total}`);
                console.log(`   - Pedidos únicos: ${row.unique_orders}`);
                console.log(`   - Itens matched: ${row.matched}`);
                console.log(`   - Itens pendentes: ${row.pending}`);
            });
        } else {
            console.log('   ⚠️ Nenhum dado encontrado');
        }

        // 3. Vendas emitidas
        const salesCount = await pool.query(`
            SELECT 
                COUNT(*) as total_vendas,
                COUNT(DISTINCT codigo_ml) as unique_orders,
                SUM(qtd) as total_qty,
                c.nome as client_name
            FROM obsidian.vendas v
            LEFT JOIN obsidian.clientes c ON c.id = v.cliente_id
            WHERE v.import_id = $1::uuid
            GROUP BY c.nome
        `, [importInfo.import_id]);

        console.log('\n💰 VENDAS EMITIDAS:');
        if (salesCount.rows.length > 0) {
            salesCount.rows.forEach(row => {
                console.log(`   Cliente: ${row.client_name || 'N/A'}`);
                console.log(`   - Total de vendas: ${row.total_vendas}`);
                console.log(`   - Pedidos únicos: ${row.unique_orders}`);
                console.log(`   - Quantidade total: ${row.total_qty}`);
            });
        } else {
            console.log('   ⚠️ Nenhuma venda emitida ainda para este import_id');

            // Verificar se há vendas sem import_id
            const vendasSemImport = await pool.query(`
                SELECT COUNT(*) as total
                FROM obsidian.vendas
                WHERE cliente_id = $1
                  AND canal = 'ML'
            `, [importInfo.client_id]);

            if (vendasSemImport.rows[0].total > 0) {
                console.log(`   ℹ️ Mas existem ${vendasSemImport.rows[0].total} vendas ML do cliente ${importInfo.client_name} (podem ser de importações antigas)`);
            }
        }

        // 4. Verificar pedidos cancelados
        const canceledOrders = await pool.query(`
            SELECT 
                COUNT(*) as total,
                "Estado do Pedido" as status
            FROM raw_export_orders
            WHERE import_id = $1
            AND ("Estado do Pedido" ILIKE '%cancel%' OR "3PL Status" ILIKE '%cancel%')
            GROUP BY "Estado do Pedido"
        `, [importInfo.import_id]);

        if (canceledOrders.rows.length > 0) {
            console.log('\n❌ PEDIDOS CANCELADOS:');
            canceledOrders.rows.forEach(row => {
                console.log(`   ${row.status}: ${row.total}`);
            });
        }

        // 5. Sample de dados raw
        const sampleRaw = await pool.query(`
            SELECT 
                order_id,
                "Estado do Pedido",
                sku_text,
                qty,
                customer,
                matched_sku,
                status
            FROM raw_export_orders
            WHERE import_id = $1
            ORDER BY row_num
            LIMIT 5
        `, [importInfo.import_id]);

        console.log('\n📋 SAMPLE DOS DADOS RAW (5 primeiros):');
        sampleRaw.rows.forEach((row, idx) => {
            console.log(`   ${idx + 1}. Pedido: ${row.order_id} | Status: ${row["Estado do Pedido"]} | SKU: ${row.sku_text} | Qty: ${row.qty} | Cliente: ${row.customer?.slice(0, 30)} | Matched: ${row.matched_sku || 'N/A'} | Status: ${row.status}`);
        });

        console.log('\n✅ Verificação concluída!\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkImportDetails();

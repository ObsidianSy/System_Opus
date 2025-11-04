const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

(async () => {
    console.log('🔍 Testando lógica de estorno de cancelamento...\n');

    // Simular cenário: encontrar uma venda que poderia ser cancelada
    const vendasRecentes = await pool.query(`
        SELECT 
            v.pedido_uid,
            v.sku_produto,
            v.quantidade_vendida,
            v.nome_cliente,
            v.criado_em,
            p.quantidade_atual as estoque_atual
        FROM obsidian.vendas v
        JOIN obsidian.produtos p ON UPPER(p.sku) = UPPER(v.sku_produto)
        WHERE v.criado_em > NOW() - INTERVAL '7 days'
        ORDER BY v.criado_em DESC
        LIMIT 5
    `);

    console.log('📊 Últimas 5 vendas (exemplo de estorno):\n');

    if (vendasRecentes.rows.length === 0) {
        console.log('❌ Nenhuma venda encontrada nos últimos 7 dias');
        await pool.end();
        return;
    }

    vendasRecentes.rows.forEach((v, idx) => {
        console.log(`${idx + 1}. Pedido: ${v.pedido_uid}`);
        console.log(`   Cliente: ${v.nome_cliente}`);
        console.log(`   SKU: ${v.sku_produto}`);
        console.log(`   Qtd Vendida: ${v.quantidade_vendida}`);
        console.log(`   Estoque Atual: ${v.estoque_atual}`);
        console.log(`   ➡️ Após estorno seria: ${parseFloat(v.estoque_atual) + parseFloat(v.quantidade_vendida)}`);
        console.log('');
    });

    // Verificar pedidos que existem como venda mas estão cancelados na planilha
    console.log('🔍 Procurando vendas que deveriam ser estornadas...\n');

    const vendasParaEstornar = await pool.query(`
        SELECT 
            v.pedido_uid,
            v.sku_produto,
            v.quantidade_vendida,
            v.nome_cliente,
            r."Pós-venda/Cancelado/Devolvido",
            r."Estado do Pedido",
            r."Razão do Cancelamento",
            p.quantidade_atual as estoque_atual
        FROM obsidian.vendas v
        JOIN raw_export_orders r ON v.pedido_uid = CONCAT('ML-', r.order_id)
        JOIN obsidian.produtos p ON UPPER(p.sku) = UPPER(v.sku_produto)
        WHERE v.criado_em > NOW() - INTERVAL '7 days'
          AND (
              r."Pós-venda/Cancelado/Devolvido" ILIKE '%cancelado%'
              OR r."Estado do Pedido" ILIKE '%cancel%'
              OR (r."Razão do Cancelamento" IS NOT NULL AND r."Razão do Cancelamento" != '')
          )
        ORDER BY v.criado_em DESC
        LIMIT 10
    `);

    if (vendasParaEstornar.rows.length > 0) {
        console.log('⚠️ ATENÇÃO! Encontradas vendas que estão canceladas mas ainda no sistema:\n');

        vendasParaEstornar.rows.forEach((v, idx) => {
            console.log(`${idx + 1}. Pedido: ${v.pedido_uid}`);
            console.log(`   Cliente: ${v.nome_cliente}`);
            console.log(`   SKU: ${v.sku_produto} (qtd: ${v.quantidade_vendida})`);
            console.log(`   Status Planilha: ${v['Pós-venda/Cancelado/Devolvido'] || v['Estado do Pedido']}`);
            console.log(`   Razão: ${v['Razão do Cancelamento'] || 'N/A'}`);
            console.log(`   Estoque Atual: ${v.estoque_atual}`);
            console.log(`   ➡️ Após estorno: ${parseFloat(v.estoque_atual) + parseFloat(v.quantidade_vendida)}`);
            console.log('');
        });

        console.log(`\n📈 Total: ${vendasParaEstornar.rows.length} vendas precisam ser estornadas`);
        console.log('💡 Execute "Emitir Vendas" novamente para processar os cancelamentos');
    } else {
        console.log('✅ Nenhuma venda cancelada encontrada (tudo correto!)');
    }

    await pool.end();
})();

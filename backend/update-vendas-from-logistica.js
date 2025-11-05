const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d',
    connectionTimeoutMillis: 30000,
    ssl: false
});

// Mapeamento de lojas para clientes
const LOJA_TO_CLIENT = {
    // Lojas da New Seven (client_id = 1)
    'ML New Seven': 1,
    'Shopee New Seven': 1,
    'Shein New Seven': 1,
    'Mercado Libre New Seven': 1,

    // Lojas da Obsidian Ecom (client_id = 2)
    'ML Obsidian': 2,
    'Shopee Obsidian': 2,
    'Shein Obsidian': 2,
    'Mercado Libre Obsidian': 2,

    // Lojas da StepSync (client_id = 3)
    'Shopee StepSync': 3,
    'ML StepSync': 3,
    'Shein StepSync': 3,

    // Fallback genérico
    'SHOPEE': null,
    'SHEIN': null,
    'MERCADO LIBRE': null,
    'ML': null,
    'FULL-INBOUND': null
};

async function updateVendasFromLogistica() {
    try {
        console.log('🔄 Iniciando atualização das vendas com dados do UpSeller...\n');

        // Buscar vendas que precisam ser atualizadas (canal genérico)
        const vendasGeneric = await pool.query(`
      SELECT DISTINCT pedido_uid, canal
      FROM obsidian.vendas
      WHERE canal IN ('SHOPEE', 'SHEIN', 'MERCADO LIBRE', 'ML', 'FULL-INBOUND', 'Shopee')
    `);

        console.log(`📊 Encontradas ${vendasGeneric.rows.length} vendas com canal genérico\n`);

        let atualizadas = 0;
        let naoEncontradas = 0;
        let erros = 0;

        // PROCESSAR CADA VENDA INDIVIDUALMENTE (sem transação global)
        for (const venda of vendasGeneric.rows) {
            try {
                // Remover prefixo "ML-" do pedido_uid para buscar no raw_export_orders
                // No banco vendas: "ML-251007F9HEAC8R"
                // No raw_export_orders: "251007F9HEAC8R"
                const pedidoSemPrefixo = venda.pedido_uid.replace(/^ML-/, '');

                // Buscar dados originais no raw_export_orders (tabela UpSeller completa)
                const rawData = await pool.query(`
          SELECT 
            "Nº de Pedido da Plataforma",
            "Nome da Loja no UpSeller",
            "Plataformas"
          FROM raw_export_orders
          WHERE "Nº de Pedido da Plataforma" = $1
          LIMIT 1
        `, [pedidoSemPrefixo]);

                if (rawData.rows.length === 0) {
                    naoEncontradas++;
                    console.log(`⚠️  Pedido ${venda.pedido_uid} não encontrado no raw_export_orders`);
                    continue;
                }

                const raw = rawData.rows[0];
                const nomeLoja = raw['Nome da Loja no UpSeller'];
                const plataforma = raw['Plataformas'];

                // Definir canal (priorizar Nome da Loja)
                const novoCanal = nomeLoja || plataforma || venda.canal;

                // Definir client_id baseado na loja
                const clientId = LOJA_TO_CLIENT[novoCanal] || null;

                // Atualizar venda (cada UPDATE é uma transação isolada)
                await pool.query(`
          UPDATE obsidian.vendas
          SET 
            canal = $1,
            client_id = $2
          WHERE pedido_uid = $3
        `, [novoCanal, clientId, venda.pedido_uid]);

                atualizadas++;
                console.log(`✅ ${venda.pedido_uid}: "${venda.canal}" → "${novoCanal}" (client_id: ${clientId || 'NULL'})`);

            } catch (error) {
                erros++;
                console.error(`❌ Erro ao atualizar ${venda.pedido_uid}:`, error.message);
                // Continua para o próximo
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO DA ATUALIZAÇÃO:');
        console.log('='.repeat(60));
        console.log(`✅ Atualizadas: ${atualizadas}`);
        console.log(`⚠️  Não encontradas no raw: ${naoEncontradas}`);
        console.log(`❌ Erros: ${erros}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ ERRO FATAL:', error.message);
    } finally {
        await pool.end();
    }
}

updateVendasFromLogistica();

/**
 * Script para deletar vendas com pedidos duplicados (múltiplos números)
 * Ex: "2000010058319625 2000138627127236" deve ser removido
 * pois o pedido base "2000010058319625" já deve existir
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function cleanupDuplicatedPedidos() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Buscando vendas com pedidos duplicados...\n');

        // 1. LISTAR vendas com pedido_uid com mais de 20 caracteres (múltiplos números)
        // Ex: ML-2000013884171064 tem 20 caracteres (normal)
        // Ex: ML-2000010058319625 2000138 tem mais de 20 (duplicado)
        const findQuery = `
            SELECT 
                venda_id,
                pedido_uid,
                sku_produto,
                quantidade_vendida,
                data_venda,
                nome_cliente,
                LENGTH(pedido_uid) as tamanho_pedido
            FROM obsidian.vendas
            WHERE LENGTH(pedido_uid) > 20
            ORDER BY pedido_uid, data_venda DESC
        `;

        const result = await client.query(findQuery);
        
        if (result.rows.length === 0) {
            console.log('✅ Nenhuma venda com pedido duplicado encontrada!');
            return;
        }

        console.log(`⚠️  Encontradas ${result.rows.length} vendas com pedidos > 20 caracteres (duplicados):\n`);
        
        // Mostrar detalhes
        result.rows.forEach((venda, idx) => {
            console.log(`${idx + 1}. Venda ID: ${venda.venda_id}`);
            console.log(`   Pedido: ${venda.pedido_uid} (${venda.tamanho_pedido} caracteres)`);
            console.log(`   SKU: ${venda.sku_produto} | Qtd: ${venda.quantidade_vendida}`);
            console.log(`   Cliente: ${venda.nome_cliente}`);
            console.log(`   Data: ${venda.data_venda}`);
            console.log('');
        });

        // 2. CONFIRMAR ANTES DE DELETAR
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚨 ATENÇÃO: Este script vai DELETAR as vendas acima!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Para executar automaticamente, descomente a linha abaixo:
        // const confirmacao = 'SIM';
        
        // Para pedir confirmação manual:
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Digite "SIM" para confirmar a exclusão: ', async (resposta) => {
            if (resposta.trim().toUpperCase() === 'SIM') {
                console.log('\n🗑️  Deletando vendas...\n');

                await client.query('BEGIN');

                try {
                    // 3. DEVOLVER ESTOQUE antes de deletar
                    for (const venda of result.rows) {
                        await client.query(
                            `UPDATE obsidian.produtos 
                             SET quantidade_atual = quantidade_atual + $1 
                             WHERE UPPER(sku) = UPPER($2)`,
                            [venda.quantidade_vendida, venda.sku_produto]
                        );
                        console.log(`📦 Estoque devolvido: ${venda.quantidade_vendida}x ${venda.sku_produto}`);
                    }

                    // 4. DELETAR vendas com pedido_uid > 20 caracteres
                    const deleteQuery = `
                        DELETE FROM obsidian.vendas
                        WHERE LENGTH(pedido_uid) > 20
                    `;
                    
                    const deleteResult = await client.query(deleteQuery);
                    
                    await client.query('COMMIT');
                    
                    console.log(`\n✅ ${deleteResult.rowCount} vendas deletadas com sucesso!`);
                    console.log('✅ Estoque devolvido para os produtos afetados!');
                    
                } catch (error) {
                    await client.query('ROLLBACK');
                    console.error('❌ Erro ao deletar:', error.message);
                    throw error;
                }
            } else {
                console.log('\n❌ Operação cancelada pelo usuário.');
            }
            
            readline.close();
            client.release();
            await pool.end();
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
        client.release();
        await pool.end();
        process.exit(1);
    }
}

// Executar
cleanupDuplicatedPedidos().catch(console.error);

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

(async () => {
    try {
        console.log('\n=== VERIFICANDO COMPLIANCE COM REGRAS DE NEGÓCIO - FULL ===\n');

        // 1. Verificar função full_envio_emitir
        console.log('1️⃣ FUNÇÃO full_envio_emitir (emissão de vendas):');
        const funcEmitir = await pool.query(`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc
            WHERE pronamespace = 'logistica'::regnamespace
              AND proname = 'full_envio_emitir'
        `);

        if (funcEmitir.rows.length > 0) {
            console.log('✅ Função existe\n');
            console.log(funcEmitir.rows[0].definition);
        } else {
            console.log('❌ Função NÃO existe!\n');
        }

        // 2. Verificar se vendas FULL usam custo do produto (não preço da planilha)
        console.log('\n2️⃣ VERIFICANDO: Vendas FULL usam custo do estoque?');
        const vendasFull = await pool.query(`
            SELECT 
                v.pedido_uid,
                v.sku_produto,
                v.preco_unitario as preco_venda,
                p.preco_unitario as custo_estoque,
                CASE 
                    WHEN v.preco_unitario = p.preco_unitario THEN '✅ CORRETO'
                    ELSE '❌ ERRADO - usando preço diferente do estoque'
                END as validacao
            FROM obsidian.vendas v
            JOIN obsidian.produtos p ON UPPER(v.sku_produto) = UPPER(p.sku)
            WHERE v.canal = 'FULL-INBOUND'
            LIMIT 10
        `);

        if (vendasFull.rows.length > 0) {
            console.table(vendasFull.rows);
            const erros = vendasFull.rows.filter(r => r.validacao.includes('ERRADO'));
            if (erros.length > 0) {
                console.log(`\n⚠️  ${erros.length} vendas com preço INCORRETO!`);
            } else {
                console.log('\n✅ Todas as vendas usam custo do estoque');
            }
        } else {
            console.log('ℹ️  Nenhuma venda FULL encontrada');
        }

        // 3. Verificar se movimentos de estoque foram criados
        console.log('\n3️⃣ VERIFICANDO: Movimentos de estoque FULL');
        const movimentos = await pool.query(`
            SELECT 
                tipo,
                COUNT(*) as total,
                SUM(quantidade) as total_quantidade
            FROM obsidian.estoque_movimentos
            WHERE tipo IN ('saida_full', 'entrada_full')
            GROUP BY tipo
        `);

        console.table(movimentos.rows);

        // 4. Verificar se cliente_nome é do banco (não da planilha)
        console.log('\n4️⃣ VERIFICANDO: Cliente vem do banco interno?');
        const clientesVendas = await pool.query(`
            SELECT DISTINCT
                v.nome_cliente,
                c.nome as cliente_interno,
                CASE 
                    WHEN v.nome_cliente = c.nome THEN '✅ CORRETO'
                    ELSE '❌ ERRADO - cliente não bate'
                END as validacao
            FROM obsidian.vendas v
            JOIN logistica.full_envio e ON v.nome_cliente = e.cliente_nome
            JOIN obsidian.clientes c ON e.client_id = c.id
            WHERE v.canal = 'FULL-INBOUND'
            LIMIT 10
        `);

        if (clientesVendas.rows.length > 0) {
            console.table(clientesVendas.rows);
        } else {
            console.log('ℹ️  Nenhuma venda para validar');
        }

        // 5. Verificar se kits foram explodidos
        console.log('\n5️⃣ VERIFICANDO: Kits são explodidos em componentes?');
        const kitsVendidos = await pool.query(`
            SELECT 
                v.pedido_uid,
                v.sku_produto,
                p.is_kit,
                p.kit_bom,
                COUNT(m.id) as movimentos_count
            FROM obsidian.vendas v
            JOIN obsidian.produtos p ON UPPER(v.sku_produto) = UPPER(p.sku)
            LEFT JOIN obsidian.estoque_movimentos m ON m.pedido_uid = v.pedido_uid
            WHERE v.canal = 'FULL-INBOUND'
              AND p.is_kit = true
            GROUP BY v.pedido_uid, v.sku_produto, p.is_kit, p.kit_bom
            LIMIT 5
        `);

        if (kitsVendidos.rows.length > 0) {
            console.table(kitsVendidos.rows);
            console.log('\n📋 Analisando componentes dos kits...');

            for (const kit of kitsVendidos.rows) {
                const componentes = await pool.query(`
                    SELECT 
                        sku_produto,
                        quantidade,
                        tipo_movimento
                    FROM obsidian.estoque_movimentos
                    WHERE pedido_uid = $1
                    ORDER BY sku_produto
                `, [kit.pedido_uid]);

                console.log(`\nKit ${kit.sku_produto} (pedido ${kit.pedido_uid}):`);
                console.table(componentes.rows);
            }
        } else {
            console.log('ℹ️  Nenhum kit vendido encontrado');
        }

        // 6. Verificar idempotência (não duplicar vendas)
        console.log('\n6️⃣ VERIFICANDO: Idempotência (sem duplicatas)?');
        const duplicatas = await pool.query(`
            SELECT 
                pedido_uid,
                sku_produto,
                COUNT(*) as ocorrencias
            FROM obsidian.vendas
            WHERE canal = 'FULL-INBOUND'
            GROUP BY pedido_uid, sku_produto
            HAVING COUNT(*) > 1
        `);

        if (duplicatas.rows.length > 0) {
            console.log('❌ DUPLICATAS ENCONTRADAS:');
            console.table(duplicatas.rows);
        } else {
            console.log('✅ Nenhuma duplicata encontrada');
        }

        // 7. Verificar se quantidade_atual foi atualizada
        console.log('\n7️⃣ VERIFICANDO: Estoque foi baixado corretamente?');
        const estoqueNegativo = await pool.query(`
            SELECT 
                sku,
                nome,
                quantidade_atual,
                CASE 
                    WHEN quantidade_atual < 0 THEN '⚠️  NEGATIVO (permitido)'
                    ELSE '✅ POSITIVO'
                END as status
            FROM obsidian.produtos
            WHERE sku IN (
                SELECT DISTINCT sku_produto 
                FROM obsidian.vendas 
                WHERE canal = 'FULL-INBOUND'
            )
            ORDER BY quantidade_atual
            LIMIT 10
        `);

        console.table(estoqueNegativo.rows);

        console.log('\n=== RESUMO DA ANÁLISE ===\n');
        console.log('✅ = Regra implementada corretamente');
        console.log('❌ = Regra NÃO implementada ou incorreta');
        console.log('⚠️  = Atenção necessária');
        console.log('\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
})();

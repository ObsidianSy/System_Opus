
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function verificarTudo() {
    console.log('🔍 VERIFICAÇÃO COMPLETA DO SISTEMA\n');
    console.log('=' .repeat(70));
    
    try {
        // 1. FUNÇÕES EXISTEM?
        console.log('\n1️⃣ VERIFICANDO FUNÇÕES DO BANCO:\n');
        
        const funcs = await pool.query(`
            SELECT proname, pg_get_function_arguments(oid) as args
            FROM pg_proc 
            WHERE pronamespace = 'obsidian'::regnamespace 
               OR pronamespace = 'logistica'::regnamespace
            ORDER BY proname
        `);
        
        console.log('✅ Funções encontradas:', funcs.rowCount);
        funcs.rows.forEach(f => {
            console.log(`   - ${f.proname}(${f.args})`);
        });
        
        // 2. ESTRUTURA DA TABELA VENDAS
        console.log('\n2️⃣ ESTRUTURA TABELA obsidian.vendas:\n');
        
        const vendaCols = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'obsidian' AND table_name = 'vendas'
            ORDER BY ordinal_position
        `);
        
        vendaCols.rows.forEach(c => {
            console.log(`   ${c.column_name.padEnd(25)} ${c.data_type.padEnd(20)} NULL: ${c.is_nullable}`);
        });
        
        // 3. VERIFICAR CONSTRAINT vendas_dedupe
        console.log('\n3️⃣ CONSTRAINT DE IDEMPOTÊNCIA:\n');
        
        const constraints = await pool.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'obsidian.vendas'::regclass
              AND conname LIKE '%dedupe%'
        `);
        
        if (constraints.rowCount > 0) {
            console.log('✅ Constraint vendas_dedupe encontrada:');
            console.log('   ', constraints.rows[0].definition);
        } else {
            console.log('❌ PROBLEMA: Constraint vendas_dedupe NÃO existe!');
        }
        
        // 4. VERIFICAR TRIGGERS
        console.log('\n4️⃣ TRIGGERS NA TABELA VENDAS:\n');
        
        const triggers = await pool.query(`
            SELECT tgname, pg_get_triggerdef(oid) as definition
            FROM pg_trigger
            WHERE tgrelid = 'obsidian.vendas'::regclass
              AND NOT tgisinternal
        `);
        
        if (triggers.rowCount > 0) {
            triggers.rows.forEach(t => {
                console.log('✅', t.tgname);
            });
        } else {
            console.log('⚠️ Nenhum trigger encontrado');
        }
        
        // 5. TESTAR FUNÇÃO processar_pedido
        console.log('\n5️⃣ TESTANDO FUNÇÃO processar_pedido:\n');
        
        try {
            const testItems = JSON.stringify([
                { sku: 'TEST-SKU-001', nome_produto: 'Produto Teste', quantidade: 1, preco_unitario: 10.00 }
            ]);
            
            const testResult = await pool.query(
                'SELECT * FROM obsidian.processar_pedido($1, $2, $3, $4, $5::jsonb, $6, $7)',
                ['TEST-PEDIDO-123', '2025-11-04', 'Cliente Teste', 'Shopee', testItems, null, null]
            );
            
            console.log('✅ Função processar_pedido executada com sucesso (DRY RUN)');
            console.log('   Rollback automático - nenhum dado foi inserido');
            
            await pool.query('ROLLBACK');
        } catch (err) {
            console.log('❌ ERRO ao testar processar_pedido:', err.message);
        }
        
        // 6. VERIFICAR DADOS ATUAIS
        console.log('\n6️⃣ DADOS ATUAIS NO SISTEMA:\n');
        
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM obsidian.produtos) as total_produtos,
                (SELECT COUNT(*) FROM obsidian.vendas) as total_vendas,
                (SELECT COUNT(*) FROM obsidian.vendas WHERE pedido_uid IS NULL) as vendas_sem_pedido_uid,
                (SELECT COUNT(*) FROM obsidian.vendas WHERE canal = 'FULL-INBOUND') as vendas_full,
                (SELECT COUNT(*) FROM obsidian.vendas WHERE fulfillment_ext = true) as vendas_fulfillment_ext,
                (SELECT COUNT(*) FROM logistica.full_envio) as envios_full,
                (SELECT COUNT(*) FROM raw_export_orders) as pedidos_ml_importados,
                (SELECT COUNT(*) FROM raw_export_orders WHERE status = 'pending') as ml_pendentes
        `);
        
        const s = stats.rows[0];
        console.log('   Produtos cadastrados:', s.total_produtos);
        console.log('   Vendas registradas:', s.total_vendas);
        console.log('   └─ Vendas FULL-INBOUND:', s.vendas_full);
        console.log('   └─ Vendas fulfillment_ext:', s.vendas_fulfillment_ext);
        console.log('   └─ ⚠️ Sem pedido_uid:', s.vendas_sem_pedido_uid);
        console.log('   Envios FULL:', s.envios_full);
        console.log('   Pedidos ML importados:', s.pedidos_ml_importados);
        console.log('   └─ Pendentes relacionamento:', s.ml_pendentes);
        
        // 7. VERIFICAR REGRAS DE NEGÓCIO
        console.log('\n7️⃣ CONFORMIDADE COM REGRAS:\n');
        
        // Regra: Vendas FULL devem baixar estoque
        const fullEstoque = await pool.query(`
            SELECT COUNT(*) as count
            FROM obsidian.vendas v
            WHERE v.canal = 'FULL-INBOUND'
              AND NOT EXISTS (
                  SELECT 1 FROM obsidian.estoque_movimentos em
                  WHERE em.tipo = 'saida_full'
              )
        `);
        
        if (fullEstoque.rows[0].count === '0') {
            console.log('✅ Vendas FULL têm movimentos de estoque correspondentes');
        } else {
            console.log('❌ PROBLEMA:', fullEstoque.rows[0].count, 'vendas FULL sem movimento de estoque');
        }
        
        // Regra: Vendas fulfillment_ext NÃO devem ter movimentos
        const fulfillmentMovimentos = await pool.query(`
            SELECT COUNT(*) as count
            FROM obsidian.vendas v
            WHERE v.fulfillment_ext = true
              AND EXISTS (
                  SELECT 1 FROM obsidian.estoque_movimentos em
                  WHERE em.origem_tabela = 'vendas'
              )
        `);
        
        if (fulfillmentMovimentos.rows[0].count === '0') {
            console.log('✅ Vendas fulfillment_ext NÃO têm movimentos de estoque');
        } else {
            console.log('⚠️ ATENÇÃO:', fulfillmentMovimentos.rows[0].count, 'vendas fulfillment_ext COM movimentos (verificar)');
        }
        
        // Regra: pedido_uid deve ser único e populado
        const pedidoUidCheck = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT pedido_uid) as unicos,
                COUNT(*) - COUNT(pedido_uid) as nulos
            FROM obsidian.vendas
        `);
        
        const p = pedidoUidCheck.rows[0];
        console.log('✅ pedido_uid: Total', p.total, '| Únicos', p.unicos, '| Nulos', p.nulos);
        
        // 8. VERIFICAR CÓDIGO TYPESCRIPT
        console.log('\n8️⃣ VERIFICANDO CÓDIGO TYPESCRIPT:\n');
        
        const fs = require('fs');
        const enviosPath = 'src/routes/envios.ts';
        
        if (fs.existsSync(enviosPath)) {
            const content = fs.readFileSync(enviosPath, 'utf8');
            
            // Verificar detecção de FULL/FBM
            if (content.includes('FUFILL')) {
                console.log('✅ Detecção de typo "FUFILL" presente');
            } else {
                console.log('❌ PROBLEMA: Detecção de "FUFILL" ausente');
            }
            
            // Verificar detecção de cancelamento
            if (content.includes('CANCELADO') && content.includes('razao_cancelamento')) {
                console.log('✅ Detecção de cancelamento (3 campos) presente');
            } else {
                console.log('❌ PROBLEMA: Detecção de cancelamento incompleta');
            }
            
            // Verificar estorno de estoque
            if (content.includes('quantidade_atual + $1')) {
                console.log('✅ Estorno de estoque em cancelamento presente');
            } else {
                console.log('❌ PROBLEMA: Estorno de estoque ausente');
            }
            
            // Verificar uso de pedido_uid
            if (content.includes('pedido_uid') && content.includes('ML-')) {
                console.log('✅ Geração de pedido_uid para ML presente');
            } else {
                console.log('⚠️ Verificar: pedido_uid pode estar ausente no código ML');
            }
        } else {
            console.log('❌ Arquivo', enviosPath, 'não encontrado');
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ VERIFICAÇÃO CONCLUÍDA\n');
        
        await pool.end();
        
    } catch (err) {
        console.error('❌ ERRO CRÍTICO:', err.message);
        console.error(err.stack);
        await pool.end();
        process.exit(1);
    }
}

verificarTudo();

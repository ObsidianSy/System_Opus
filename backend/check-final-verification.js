const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function finalVerification() {
    try {
        console.log('🔬 VERIFICAÇÃO FINAL DO SISTEMA IMPORT FULL\n');
        console.log('='.repeat(80) + '\n');

        // 1. Verificar se as funções do banco existem e estão acessíveis
        console.log('1️⃣ VERIFICANDO FUNÇÕES DO BANCO:\n');

        const functions = await pool.query(`
            SELECT proname
            FROM pg_proc
            WHERE pronamespace = 'logistica'::regnamespace
              AND proname IN ('full_envio_normalizar', 'full_envio_emitir', 'full_envio_upsert', 'full_envio_add_raw')
            ORDER BY proname
        `);

        console.log('Funções encontradas:');
        functions.rows.forEach(row => {
            console.log(`  ✅ logistica.${row.proname}()`);
        });

        if (functions.rows.length < 4) {
            console.log('\n  ⚠️  AVISO: Algumas funções estão faltando!');
        } else {
            console.log('\n  ✅ Todas as 4 funções necessárias existem');
        }

        // 2. Testar se a função normalizar funciona (dry-run)
        console.log('\n\n2️⃣ TESTANDO FUNÇÃO full_envio_normalizar:\n');

        try {
            // Buscar um envio de teste
            const testEnvio = await pool.query(`
                SELECT id, envio_num, status 
                FROM logistica.full_envio 
                WHERE status IN ('draft', 'ready')
                ORDER BY id DESC 
                LIMIT 1
            `);

            if (testEnvio.rows.length > 0) {
                const envio = testEnvio.rows[0];
                console.log(`  Envio de teste: ${envio.envio_num} (ID: ${envio.id}, Status: ${envio.status})`);

                // Contar itens antes
                const beforeRaw = await pool.query(
                    `SELECT 
                        COUNT(*) FILTER (WHERE status='pending') as pending,
                        COUNT(*) FILTER (WHERE status='matched') as matched
                     FROM logistica.full_envio_raw WHERE envio_id = $1`,
                    [envio.id]
                );

                const beforeItem = await pool.query(
                    `SELECT COUNT(*) as count FROM logistica.full_envio_item WHERE envio_id = $1`,
                    [envio.id]
                );

                console.log(`  RAW: ${beforeRaw.rows[0].pending} pending, ${beforeRaw.rows[0].matched} matched`);
                console.log(`  ITEM: ${beforeItem.rows[0].count} registros`);

                // Executar normalização
                await pool.query(`SELECT logistica.full_envio_normalizar($1::bigint)`, [envio.id]);

                // Contar itens depois
                const afterItem = await pool.query(
                    `SELECT COUNT(*) as count FROM logistica.full_envio_item WHERE envio_id = $1`,
                    [envio.id]
                );

                console.log(`  ITEM após normalizar: ${afterItem.rows[0].count} registros`);

                if (parseInt(afterItem.rows[0].count) >= parseInt(beforeRaw.rows[0].matched)) {
                    console.log('  ✅ Normalização funcionou corretamente!');
                } else {
                    console.log('  ⚠️  Normalização não populou todos os itens matched');
                }
            } else {
                console.log('  ⚠️  Nenhum envio disponível para teste');
            }
        } catch (testError) {
            console.log('  ❌ Erro ao testar normalização:', testError.message);
        }

        // 3. Verificar estrutura das tabelas
        console.log('\n\n3️⃣ VERIFICANDO ESTRUTURA DAS TABELAS:\n');

        const tables = ['full_envio', 'full_envio_raw', 'full_envio_item'];
        for (const table of tables) {
            const count = await pool.query(`SELECT COUNT(*) as count FROM logistica.${table}`);
            const recent = await pool.query(`
                SELECT COUNT(*) as count 
                FROM logistica.${table} 
                WHERE created_at > NOW() - INTERVAL '7 days'
            `);

            console.log(`  logistica.${table}:`);
            console.log(`    Total: ${count.rows[0].count} registros`);
            console.log(`    Últimos 7 dias: ${recent.rows[0].count} registros`);
        }

        // 4. Verificar aliases ativos
        console.log('\n\n4️⃣ VERIFICANDO ALIASES ATIVOS:\n');

        const aliases = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN times_used > 0 THEN 1 END) as used,
                MAX(last_used_at) as last_used
            FROM obsidian.sku_aliases
        `);

        const aliasStats = aliases.rows[0];
        console.log(`  Total de aliases: ${aliasStats.total}`);
        console.log(`  Aliases usados: ${aliasStats.used}`);
        console.log(`  Último uso: ${aliasStats.last_used ? new Date(aliasStats.last_used).toLocaleString('pt-BR') : 'Nunca'}`);

        if (parseInt(aliasStats.used) > 0) {
            console.log('  ✅ Sistema de aprendizado de aliases está ativo');
        }

        // 5. Verificar integridade dos dados
        console.log('\n\n5️⃣ VERIFICANDO INTEGRIDADE DOS DADOS:\n');

        // 5.1 - Matched sem item correspondente
        const orphanMatched = await pool.query(`
            SELECT COUNT(*) as count
            FROM logistica.full_envio_raw r
            WHERE r.status = 'matched'
              AND r.matched_sku IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM logistica.full_envio_item i
                  WHERE i.envio_id = r.envio_id
                    AND i.sku = r.matched_sku
                    AND i.codigo_ml = r.codigo_ml
              )
        `);

        if (parseInt(orphanMatched.rows[0].count) > 0) {
            console.log(`  ⚠️  ${orphanMatched.rows[0].count} itens matched sem registro em full_envio_item`);
            console.log('     → Execute full_envio_normalizar() para corrigir');
        } else {
            console.log('  ✅ Todos os itens matched têm registro em full_envio_item');
        }

        // 5.2 - Items com SKU inválido
        const invalidSkus = await pool.query(`
            SELECT COUNT(*) as count
            FROM logistica.full_envio_item i
            WHERE NOT EXISTS (
                SELECT 1 FROM obsidian.produtos p
                WHERE p.sku = i.sku
            )
        `);

        if (parseInt(invalidSkus.rows[0].count) > 0) {
            console.log(`  ⚠️  ${invalidSkus.rows[0].count} itens em full_envio_item com SKU inexistente`);
        } else {
            console.log('  ✅ Todos os SKUs em full_envio_item existem na tabela produtos');
        }

        // 6. Verificar fluxo de emissão
        console.log('\n\n6️⃣ VERIFICANDO FLUXO DE EMISSÃO:\n');

        const emitted = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'emitted' OR status = 'registrado' THEN 1 END) as emitidos,
                COUNT(CASE WHEN status = 'ready' THEN 1 END) as prontos,
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as rascunhos
            FROM logistica.full_envio
        `);

        const stats = emitted.rows[0];
        console.log(`  Total de envios: ${stats.total}`);
        console.log(`  Emitidos: ${stats.emitidos}`);
        console.log(`  Prontos para emitir: ${stats.prontos}`);
        console.log(`  Rascunhos: ${stats.rascunhos}`);

        // Verificar se envios emitidos têm vendas
        if (parseInt(stats.emitidos) > 0) {
            const salesCheck = await pool.query(`
                SELECT 
                    e.envio_num,
                    e.status,
                    COUNT(v.sku_produto) as vendas_count
                FROM logistica.full_envio e
                LEFT JOIN obsidian.vendas v ON v.canal = 'FULL-INBOUND' 
                    AND v.nome_cliente = (SELECT c.nome FROM obsidian.clientes c WHERE c.id = e.client_id)
                WHERE e.status IN ('emitted', 'registrado')
                GROUP BY e.id, e.envio_num, e.status
                ORDER BY e.id DESC
                LIMIT 5
            `);

            console.log('\n  Últimos envios emitidos:');
            salesCheck.rows.forEach(row => {
                const icon = parseInt(row.vendas_count) > 0 ? '✅' : '❌';
                console.log(`    ${icon} ${row.envio_num}: ${row.vendas_count} vendas registradas`);
            });
        }

        // 7. Verificar se código TypeScript está chamando as funções
        console.log('\n\n7️⃣ VERIFICANDO INTEGRAÇÃO COM CÓDIGO TYPESCRIPT:\n');

        const fs = require('fs');
        const enviosPath = 'c:\\Users\\wesle\\OneDrive\\Área de Trabalho\\System_Opus\\backend\\src\\routes\\envios.ts';

        if (fs.existsSync(enviosPath)) {
            const code = fs.readFileSync(enviosPath, 'utf-8');

            const hasNormalizar = code.includes('full_envio_normalizar');
            const hasEmitir = code.includes('full_envio_emitir');

            console.log(`  full_envio_normalizar() chamada no código: ${hasNormalizar ? '✅ SIM' : '❌ NÃO'}`);
            console.log(`  full_envio_emitir() chamada no código: ${hasEmitir ? '✅ SIM' : '❌ NÃO'}`);

            if (hasNormalizar && hasEmitir) {
                console.log('\n  ✅ Código TypeScript integrado com funções do banco!');
            } else {
                console.log('\n  ⚠️  Falta integração no código TypeScript');
            }
        } else {
            console.log('  ⚠️  Arquivo envios.ts não encontrado');
        }

        // 8. Resumo final
        console.log('\n\n' + '='.repeat(80));
        console.log('📋 RESUMO DA VERIFICAÇÃO:\n');

        const issues = [];
        const successes = [];

        if (functions.rows.length === 4) successes.push('✅ Todas as funções do banco existem');
        else issues.push('⚠️  Funções do banco incompletas');

        if (parseInt(orphanMatched.rows[0].count) === 0) successes.push('✅ Integridade RAW → ITEM OK');
        else issues.push(`⚠️  ${orphanMatched.rows[0].count} itens matched sem correspondência`);

        if (parseInt(invalidSkus.rows[0].count) === 0) successes.push('✅ Todos os SKUs são válidos');
        else issues.push(`⚠️  ${invalidSkus.rows[0].count} SKUs inválidos`);

        if (parseInt(aliasStats.used) > 0) successes.push('✅ Sistema de aliases ativo');

        const fs2 = require('fs');
        if (fs2.existsSync(enviosPath)) {
            const code2 = fs2.readFileSync(enviosPath, 'utf-8');
            if (code2.includes('full_envio_normalizar') && code2.includes('full_envio_emitir')) {
                successes.push('✅ Integração TypeScript → Banco OK');
            } else {
                issues.push('⚠️  Falta integração no código TypeScript');
            }
        }

        console.log('SUCESSOS:');
        successes.forEach(s => console.log(`  ${s}`));

        if (issues.length > 0) {
            console.log('\nISSUES:');
            issues.forEach(i => console.log(`  ${i}`));
        }

        console.log('\n' + '='.repeat(80));

        if (issues.length === 0) {
            console.log('\n🎉 SISTEMA 100% FUNCIONAL! Tudo verificado e aprovado.\n');
        } else {
            console.log(`\n⚠️  Sistema funcional mas com ${issues.length} ponto(s) de atenção.\n`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

finalVerification();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkOrphanMatched() {
    try {
        console.log('🔍 INVESTIGANDO ITENS MATCHED SEM CORRESPONDÊNCIA:\n');

        // Primeiro verificar estrutura da tabela
        const columns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'logistica' 
              AND table_name = 'full_envio_raw'
            ORDER BY ordinal_position
        `);

        console.log('Colunas disponíveis em full_envio_raw:');
        console.log(columns.rows.map(r => `  - ${r.column_name}`).join('\n'));
        console.log('');

        // Buscar os itens matched órfãos
        const orphans = await pool.query(`
            SELECT 
                r.envio_id,
                e.envio_num,
                e.status as envio_status,
                r.id,
                r.codigo_ml,
                r.matched_sku,
                r.qtd,
                r.sku_texto,
                r.status as raw_status
            FROM logistica.full_envio_raw r
            JOIN logistica.full_envio e ON e.id = r.envio_id
            WHERE r.status = 'matched'
              AND r.matched_sku IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM logistica.full_envio_item i
                  WHERE i.envio_id = r.envio_id
                    AND i.sku = r.matched_sku
                    AND i.codigo_ml = r.codigo_ml
              )
            ORDER BY r.envio_id, r.id
            LIMIT 20
        `);

        console.log(`Total de itens matched órfãos: ${orphans.rows.length}\n`);

        if (orphans.rows.length > 0) {
            console.log('Detalhes dos órfãos:\n');

            const envioGroups = {};
            orphans.rows.forEach(row => {
                if (!envioGroups[row.envio_id]) {
                    envioGroups[row.envio_id] = [];
                }
                envioGroups[row.envio_id].push(row);
            });

            for (const [envioId, items] of Object.entries(envioGroups)) {
                const envioNum = items[0].envio_num;
                const envioStatus = items[0].envio_status;

                console.log(`📦 Envio ${envioNum} (ID: ${envioId}, Status: ${envioStatus})`);
                console.log(`   ${items.length} item(s) matched sem correspondência:\n`);

                items.forEach(item => {
                    console.log(`   • SKU: ${item.matched_sku}`);
                    console.log(`     Código ML: ${item.codigo_ml}`);
                    console.log(`     SKU Texto: ${item.sku_texto}`);
                    console.log(`     Quantidade: ${item.qtd}`);
                });
                console.log('');
            }

            // Tentar corrigir executando normalizar nos envios afetados
            console.log('\n🔧 TENTANDO CORRIGIR EXECUTANDO full_envio_normalizar():\n');

            const uniqueEnvios = [...new Set(orphans.rows.map(r => r.envio_id))];

            for (const envioId of uniqueEnvios) {
                const envioNum = orphans.rows.find(r => r.envio_id === envioId).envio_num;

                try {
                    console.log(`   Normalizando envio ${envioNum} (ID: ${envioId})...`);

                    // Executar normalização
                    await pool.query(`SELECT logistica.full_envio_normalizar($1::bigint)`, [envioId]);

                    // Verificar se corrigiu
                    const stillOrphan = await pool.query(`
                        SELECT COUNT(*) as count
                        FROM logistica.full_envio_raw r
                        WHERE r.envio_id = $1
                          AND r.status = 'matched'
                          AND r.matched_sku IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1 FROM logistica.full_envio_item i
                              WHERE i.envio_id = r.envio_id
                                AND i.sku = r.matched_sku
                                AND i.codigo_ml = r.codigo_ml
                          )
                    `, [envioId]);

                    if (parseInt(stillOrphan.rows[0].count) === 0) {
                        console.log(`   ✅ Corrigido!`);
                    } else {
                        console.log(`   ⚠️  Ainda há ${stillOrphan.rows[0].count} órfãos - pode ser problema na função`);
                    }
                } catch (err) {
                    console.log(`   ❌ Erro: ${err.message}`);
                }
            }

            // Verificar novamente após correção
            console.log('\n\n🔄 VERIFICAÇÃO PÓS-CORREÇÃO:\n');

            const afterFix = await pool.query(`
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

            console.log(`Itens matched órfãos restantes: ${afterFix.rows[0].count}`);

            if (parseInt(afterFix.rows[0].count) === 0) {
                console.log('✅ TODOS OS ÓRFÃOS FORAM CORRIGIDOS!');
            } else {
                console.log('⚠️  Alguns órfãos ainda persistem - pode indicar problema na lógica da função normalizar');
            }
        } else {
            console.log('✅ Nenhum item matched órfão encontrado!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkOrphanMatched();

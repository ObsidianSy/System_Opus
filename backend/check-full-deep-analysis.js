const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function deepAnalysis() {
    try {
        console.log('🔬 ANÁLISE PROFUNDA DO SISTEMA IMPORT FULL\n');
        console.log('='.repeat(80) + '\n');

        // 1. Verificar constraints e índices
        console.log('1️⃣ CONSTRAINTS E ÍNDICES:\n');

        const constraints = await pool.query(`
            SELECT 
                conname as constraint_name,
                contype as constraint_type,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE connamespace = 'logistica'::regnamespace
              AND conrelid IN (
                  'logistica.full_envio'::regclass,
                  'logistica.full_envio_raw'::regclass,
                  'logistica.full_envio_item'::regclass
              )
            ORDER BY conrelid, contype
        `);

        console.log('Constraints encontradas:', constraints.rows.length);
        constraints.rows.forEach(row => {
            const type = row.constraint_type === 'p' ? 'PRIMARY KEY' :
                row.constraint_type === 'f' ? 'FOREIGN KEY' :
                    row.constraint_type === 'u' ? 'UNIQUE' :
                        row.constraint_type === 'c' ? 'CHECK' : 'OTHER';
            console.log(`  - ${row.constraint_name} (${type})`);
            console.log(`    ${row.definition.substring(0, 100)}${row.definition.length > 100 ? '...' : ''}`);
        });

        // 2. Verificar se existe função full_envio_normalizar
        console.log('\n\n2️⃣ FUNÇÕES DO BANCO:\n');

        const functions = await pool.query(`
            SELECT 
                proname as function_name,
                pg_get_functiondef(oid) as definition
            FROM pg_proc
            WHERE pronamespace = 'logistica'::regnamespace
              AND proname LIKE '%full%'
        `);

        if (functions.rows.length === 0) {
            console.log('⚠️  Nenhuma função FULL encontrada no schema logistica');
            console.log('   Nota: O código antigo chamava full_envio_normalizar() que não existe\n');
        } else {
            console.log('Funções encontradas:', functions.rows.length);
            functions.rows.forEach(row => {
                console.log(`  - ${row.function_name}`);
            });
        }

        // 3. Verificar views relacionadas
        console.log('\n\n3️⃣ VIEWS RELACIONADAS:\n');

        const views = await pool.query(`
            SELECT 
                table_name,
                view_definition
            FROM information_schema.views
            WHERE table_schema = 'obsidian'
              AND (table_name LIKE '%full%' OR table_name LIKE '%envio%')
        `);

        console.log('Views encontradas:', views.rows.length);
        views.rows.forEach(row => {
            console.log(`  - obsidian.${row.table_name}`);
        });

        // 4. Verificar se há triggers
        console.log('\n\n4️⃣ TRIGGERS:\n');

        const triggers = await pool.query(`
            SELECT 
                trigger_name,
                event_manipulation,
                event_object_table,
                action_statement
            FROM information_schema.triggers
            WHERE event_object_schema = 'logistica'
              AND event_object_table IN ('full_envio', 'full_envio_raw', 'full_envio_item')
        `);

        if (triggers.rows.length === 0) {
            console.log('✅ Nenhum trigger encontrado (bom, menos complexidade)\n');
        } else {
            console.log('Triggers encontrados:', triggers.rows.length);
            triggers.rows.forEach(row => {
                console.log(`  - ${row.trigger_name} on ${row.event_object_table}`);
                console.log(`    ${row.event_manipulation}: ${row.action_statement.substring(0, 80)}...`);
            });
        }

        // 5. Verificar dados inconsistentes
        console.log('\n\n5️⃣ INCONSISTÊNCIAS NOS DADOS:\n');

        // 5.1 - Envios com RAW mas sem correspondência
        const orphanRaw = await pool.query(`
            SELECT COUNT(*) as count
            FROM logistica.full_envio_raw r
            WHERE NOT EXISTS (
                SELECT 1 FROM logistica.full_envio e WHERE e.id = r.envio_id
            )
        `);

        if (parseInt(orphanRaw.rows[0].count) > 0) {
            console.log(`❌ ${orphanRaw.rows[0].count} registros em full_envio_raw sem envio pai`);
        } else {
            console.log('✅ Todos os RAW têm envio pai válido');
        }

        // 5.2 - Matched sem SKU válido
        const invalidSku = await pool.query(`
            SELECT 
                r.id,
                r.envio_id,
                r.matched_sku,
                r.status
            FROM logistica.full_envio_raw r
            WHERE r.status = 'matched'
              AND r.matched_sku IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM obsidian.produtos p 
                  WHERE p.sku = r.matched_sku
              )
            LIMIT 10
        `);

        if (invalidSku.rows.length > 0) {
            console.log(`❌ ${invalidSku.rows.length} itens matched com SKU inexistente:`);
            invalidSku.rows.forEach(row => {
                console.log(`   - ID ${row.id}: matched_sku="${row.matched_sku}" (não existe em produtos)`);
            });
        } else {
            console.log('✅ Todos os matched_sku existem na tabela produtos');
        }

        // 5.3 - Envios ready com pendentes
        const readyWithPending = await pool.query(`
            SELECT 
                e.envio_num,
                e.status,
                COUNT(r.id) as pending_count
            FROM logistica.full_envio e
            JOIN logistica.full_envio_raw r ON r.envio_id = e.id AND r.status = 'pending'
            WHERE e.status IN ('ready', 'emitted')
            GROUP BY e.id, e.envio_num, e.status
        `);

        if (readyWithPending.rows.length > 0) {
            console.log(`⚠️  ${readyWithPending.rows.length} envios com status ready/emitted mas têm pendentes:`);
            readyWithPending.rows.forEach(row => {
                console.log(`   - ${row.envio_num} (${row.status}): ${row.pending_count} itens pending`);
            });
        } else {
            console.log('✅ Nenhum envio ready/emitted tem itens pendentes');
        }

        // 6. Verificar performance (índices faltando)
        console.log('\n\n6️⃣ OTIMIZAÇÃO E PERFORMANCE:\n');

        const indexes = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'logistica'
              AND tablename IN ('full_envio', 'full_envio_raw', 'full_envio_item')
            ORDER BY tablename, indexname
        `);

        console.log('Índices encontrados:', indexes.rows.length);
        const tableIndexes = {};
        indexes.rows.forEach(row => {
            if (!tableIndexes[row.tablename]) tableIndexes[row.tablename] = [];
            tableIndexes[row.tablename].push(row.indexname);
        });

        Object.keys(tableIndexes).forEach(table => {
            console.log(`  ${table}: ${tableIndexes[table].length} índices`);
            tableIndexes[table].forEach(idx => console.log(`    - ${idx}`));
        });

        // Verificar índices recomendados
        console.log('\n  Recomendações:');
        const checkIndex = async (table, column, indexName) => {
            const exists = indexes.rows.some(row =>
                row.tablename === table && row.indexdef.includes(`(${column})`)
            );
            if (!exists) {
                console.log(`  ⚠️  Falta índice em ${table}(${column}) - sugestão: CREATE INDEX ${indexName} ON logistica.${table}(${column});`);
                return false;
            }
            return true;
        };

        const idx1 = await checkIndex('full_envio_raw', 'envio_id', 'idx_full_envio_raw_envio_id');
        const idx2 = await checkIndex('full_envio_raw', 'status', 'idx_full_envio_raw_status');
        const idx3 = await checkIndex('full_envio_raw', 'matched_sku', 'idx_full_envio_raw_matched_sku');
        const idx4 = await checkIndex('full_envio', 'client_id', 'idx_full_envio_client_id');

        if (idx1 && idx2 && idx3 && idx4) {
            console.log('  ✅ Todos os índices recomendados existem');
        }

        // 7. Verificar aliases duplicados
        console.log('\n\n7️⃣ ALIASES:\n');

        const duplicateAliases = await pool.query(`
            SELECT 
                client_id,
                UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) as normalized,
                COUNT(*) as count,
                STRING_AGG(alias_text, ', ') as variants
            FROM obsidian.sku_aliases
            GROUP BY client_id, UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g'))
            HAVING COUNT(*) > 1
        `);

        if (duplicateAliases.rows.length > 0) {
            console.log(`⚠️  ${duplicateAliases.rows.length} aliases duplicados (normalização):`);
            duplicateAliases.rows.forEach(row => {
                console.log(`   - "${row.normalized}" (${row.count}x): ${row.variants}`);
            });
        } else {
            console.log('✅ Nenhum alias duplicado');
        }

        // 8. Verificar tabela full_envio_item (se ainda é usada)
        console.log('\n\n8️⃣ STATUS DA TABELA full_envio_item:\n');

        const itemUsage = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN i.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
                COUNT(CASE WHEN i.created_at > NOW() - INTERVAL '1 day' THEN 1 END) as last_24h,
                MAX(i.created_at) as last_insert
            FROM logistica.full_envio_item i
        `);

        const usage = itemUsage.rows[0];
        console.log(`Total de registros: ${usage.total}`);
        console.log(`Últimos 7 dias: ${usage.last_7_days}`);
        console.log(`Últimas 24h: ${usage.last_24h}`);
        console.log(`Último insert: ${usage.last_insert ? new Date(usage.last_insert).toLocaleString('pt-BR') : 'Nunca'}`);

        if (parseInt(usage.last_24h) > 0) {
            console.log('\n⚠️  ATENÇÃO: full_envio_item ainda está sendo populada!');
            console.log('   Isso indica que pode haver outro processo inserindo dados.');
            console.log('   Verificar se há triggers, funções ou código antigo ativo.\n');
        } else {
            console.log('\n✅ full_envio_item não recebe dados novos (tabela legacy)');
        }

        // 9. Resumo final
        console.log('\n\n' + '='.repeat(80));
        console.log('📋 RESUMO EXECUTIVO:\n');

        const summary = [];

        if (parseInt(orphanRaw.rows[0].count) === 0) summary.push('✅ Integridade referencial OK');
        if (invalidSku.rows.length === 0) summary.push('✅ Todos matched_sku são válidos');
        if (readyWithPending.rows.length === 0) summary.push('✅ Status dos envios consistente');
        if (duplicateAliases.rows.length === 0) summary.push('✅ Aliases sem duplicação');
        if (functions.rows.length === 0) summary.push('⚠️  Função full_envio_normalizar não existe (esperado)');
        if (parseInt(usage.last_24h) === 0) summary.push('✅ full_envio_item não é mais usada');

        summary.forEach(item => console.log(item));

        console.log('\n' + '='.repeat(80) + '\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

deepAnalysis();

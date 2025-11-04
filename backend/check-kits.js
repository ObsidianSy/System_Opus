const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkKits() {
    try {
        // Ver estrutura da tabela produtos
        console.log('📋 Estrutura da tabela produtos:\n');
        const columns = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'obsidian' AND table_name = 'produtos'
            ORDER BY ordinal_position
        `);
        
        for (const col of columns.rows) {
            console.log(`  ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}`);
        }
        
        // Ver kits existentes
        console.log('\n\n🎁 Kits no banco:\n');
        const kits = await pool.query(`
            SELECT p.sku, p.nome, p.is_kit, COUNT(k.component_sku) as num_componentes
            FROM obsidian.produtos p
            LEFT JOIN obsidian.kit_components k ON k.kit_sku = p.sku
            WHERE p.is_kit = true OR EXISTS (
                SELECT 1 FROM obsidian.kit_components WHERE kit_sku = p.sku
            )
            GROUP BY p.sku, p.nome, p.is_kit
        `);
        
        if (kits.rows.length === 0) {
            console.log('  Nenhum kit encontrado');
        } else {
            for (const kit of kits.rows) {
                console.log(`  ${kit.sku} - ${kit.nome}`);
                console.log(`    is_kit: ${kit.is_kit}`);
                console.log(`    Componentes: ${kit.num_componentes}\n`);
            }
        }
        
        // Ver componentes
        console.log('\n📦 Componentes de kits:\n');
        const componentes = await pool.query(`
            SELECT kit_sku, component_sku, qty
            FROM obsidian.kit_components
            ORDER BY kit_sku, component_sku
        `);
        
        if (componentes.rows.length === 0) {
            console.log('  Nenhum componente encontrado');
        } else {
            for (const comp of componentes.rows) {
                console.log(`  ${comp.kit_sku} → ${comp.component_sku} (qty: ${comp.qty})`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkKits();

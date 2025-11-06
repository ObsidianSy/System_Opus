const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkKitCreation() {
    const client = await pool.connect();

    try {
        console.log('🔍 Verificando criação de kit KIT-K101-PTO-MRR-44...\n');

        // 1. Buscar o kit com o SKU exato que aparece nos logs
        const kitCheck = await client.query(`
      SELECT sku, nome, categoria, preco_unitario, kit_bom, is_kit, tipo_produto
      FROM obsidian.produtos
      WHERE sku = 'KIT-K101-MRR-44-K101-PTO-44'
         OR sku = 'KIT-K101-PTO-MRR-44';
    `);

        if (kitCheck.rows.length === 0) {
            console.log('❌ Kit NÃO encontrado com esses SKUs\n');

            // Buscar kits similares
            console.log('🔎 Buscando kits similares com K101-PTO e K101-MRR:\n');
            const similarKits = await client.query(`
        SELECT sku, nome, categoria, preco_unitario, tipo_produto
        FROM obsidian.produtos
        WHERE sku LIKE '%K101-PTO%' AND sku LIKE '%K101-MRR%'
        ORDER BY criado_em DESC
        LIMIT 10;
      `);

            if (similarKits.rows.length > 0) {
                console.log('✅ Encontrados kits similares:\n');
                similarKits.rows.forEach(k => {
                    console.log(`   - ${k.sku}`);
                    console.log(`     Nome: ${k.nome}`);
                    console.log(`     Categoria: ${k.categoria}`);
                    console.log(`     Tipo: ${k.tipo_produto}`);
                    console.log(`     Preço: ${k.preco_unitario}\n`);
                });
            }
        } else {
            console.log('✅ Kit encontrado!\n');
            kitCheck.rows.forEach(k => {
                console.log(`   SKU: ${k.sku}`);
                console.log(`   Nome: ${k.nome}`);
                console.log(`   Categoria: ${k.categoria}`);
                console.log(`   Tipo: ${k.tipo_produto}`);
                console.log(`   Is Kit: ${k.is_kit}`);
                console.log(`   Preço: ${k.preco_unitario}`);
                console.log(`   Kit BOM: ${JSON.stringify(k.kit_bom)}\n`);
            });
        }

        // 2. Verificar componentes (se usar tabela kit_components)
        console.log('🔧 Verificando componentes do kit:\n');
        const componentsCheck = await client.query(`
      SELECT * FROM obsidian.kit_components
      WHERE kit_sku = 'KIT-K101-MRR-44-K101-PTO-44'
         OR kit_sku = 'KIT-K101-PTO-MRR-44'
      ORDER BY component_sku;
    `);

        if (componentsCheck.rows.length === 0) {
            console.log('   ❌ Nenhum componente encontrado na tabela kit_components\n');
        } else {
            console.log(`   ✅ Encontrados ${componentsCheck.rows.length} componentes:\n`);
            componentsCheck.rows.forEach(c => {
                console.log(`   - ${c.component_sku}: qty = ${c.qty}`);
            });
            console.log('');
        }

        // 3. Verificar aliases criados
        console.log('🏷️ Verificando aliases:\n');
        const aliasCheck = await client.query(`
      SELECT alias_text, stock_sku, client_id, confidence_default
      FROM obsidian.sku_aliases
      WHERE alias_text LIKE '%K101-PTO-MRR%'
         OR stock_sku LIKE '%K101-PTO%MRR%'
         OR stock_sku LIKE '%K101-MRR%PTO%'
      ORDER BY created_at DESC;
    `);

        if (aliasCheck.rows.length === 0) {
            console.log('   ❌ Nenhum alias encontrado\n');
        } else {
            console.log(`   ✅ Encontrados ${aliasCheck.rows.length} aliases:\n`);
            aliasCheck.rows.forEach(a => {
                console.log(`   - "${a.alias_text}" → ${a.stock_sku}`);
                console.log(`     Client ID: ${a.client_id}, Confidence: ${a.confidence_default}\n`);
            });
        }

        // 4. Verificar se componentes individuais existem
        console.log('📦 Verificando se componentes K101-PTO-44 e K101-MRR-44 existem:\n');
        const componentsExist = await client.query(`
      SELECT sku, nome, quantidade_atual
      FROM obsidian.produtos
      WHERE sku IN ('K101-PTO-44', 'K101-MRR-44')
      ORDER BY sku;
    `);

        if (componentsExist.rows.length === 0) {
            console.log('   ❌ PROBLEMA: Componentes não existem!\n');
        } else {
            console.log('   ✅ Componentes encontrados:\n');
            componentsExist.rows.forEach(p => {
                console.log(`   - ${p.sku}: ${p.nome} (Qtd: ${p.quantidade_atual})`);
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkKitCreation();

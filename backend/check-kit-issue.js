const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkStructure() {
    const client = await pool.connect();

    try {
        console.log('🔍 Verificando estrutura das tabelas...\n');

        // 1. Estrutura da tabela sku_aliases
        console.log('1️⃣ Tabela sku_aliases:');
        const aliases = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'obsidian'
        AND table_name = 'sku_aliases'
      ORDER BY ordinal_position;
    `);

        if (aliases.rows.length === 0) {
            console.log('   ❌ Tabela não existe!\n');
        } else {
            aliases.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
            });
        }

        // 2. Estrutura da tabela produtos
        console.log('\n2️⃣ Tabela produtos:');
        const produtos = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'obsidian'
        AND table_name = 'produtos'
      ORDER BY ordinal_position;
    `);

        if (produtos.rows.length === 0) {
            console.log('   ❌ Tabela não existe!\n');
        } else {
            produtos.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
            });
        }

        // 3. Verificar se kit foi criado
        console.log('\n3️⃣ Verificando se kit KIT-K101-MRR-44-K101-PTO-44 existe:');
        const kitCheck = await client.query(`
      SELECT sku, nome, categoria, kit_bom
      FROM obsidian.produtos
      WHERE sku LIKE '%K101%'
      ORDER BY sku;
    `);

        if (kitCheck.rows.length === 0) {
            console.log('   ❌ Kit não encontrado\n');
        } else {
            console.log(`   ✅ Encontrados ${kitCheck.rows.length} produtos com K101:\n`);
            kitCheck.rows.forEach(p => {
                console.log(`   - SKU: ${p.sku}`);
                console.log(`     Nome: ${p.nome}`);
                console.log(`     Categoria: ${p.categoria}`);
                console.log(`     Kit BOM: ${p.kit_bom || 'null'}\n`);
            });
        }

        // 4. Verificar aliases
        console.log('4️⃣ Verificando aliases com KIT-K101:');
        const aliasCheck = await client.query(`
      SELECT *
      FROM obsidian.sku_aliases
      WHERE alias LIKE '%K101%' OR sku LIKE '%K101%'
      ORDER BY alias;
    `);

        if (aliasCheck.rows.length === 0) {
            console.log('   ❌ Nenhum alias encontrado\n');
        } else {
            console.log(`   ✅ Encontrados ${aliasCheck.rows.length} aliases:\n`);
            aliasCheck.rows.forEach(a => {
                console.log(`   ${JSON.stringify(a)}`);
            });
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkStructure();

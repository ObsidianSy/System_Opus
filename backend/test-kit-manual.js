const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testKitCreation() {
    const client = await pool.connect();

    try {
        console.log('🧪 Testando criação manual de kit...\n');

        await client.query('BEGIN');

        const sku = 'KIT-TEST-K101-MRR-44-K101-PTO-44';
        const nome = 'KIT-K101-PTO-MRR-44';
        const preco = 80;

        console.log('1️⃣ Inserindo kit:', { sku, nome, preco });

        const kitResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, ativo, kit_bom)
       VALUES ($1, $2, 'KIT', 0, 'UN', $3, true, '[]'::jsonb)
       ON CONFLICT (sku) DO UPDATE SET
         nome = EXCLUDED.nome,
         preco_unitario = EXCLUDED.preco_unitario,
         atualizado_em = NOW()
       RETURNING *`,
            [sku, nome, preco]
        );

        console.log('✅ Kit inserido:', kitResult.rows[0].sku);

        // Atualizar kit_bom
        const kitBom = JSON.stringify([
            { sku: 'K101-PTO-44', qty: 1 },
            { sku: 'K101-MRR-44', qty: 1 }
        ]);

        console.log('\n2️⃣ Atualizando kit_bom:', kitBom);

        await client.query(
            `UPDATE obsidian.produtos
       SET kit_bom = $1::jsonb
       WHERE sku = $2`,
            [kitBom, sku]
        );

        console.log('✅ kit_bom atualizado');

        console.log('\n3️⃣ Executando COMMIT...');
        await client.query('COMMIT');
        console.log('✅ COMMIT executado!');

        // Verificar se foi salvo
        console.log('\n4️⃣ Verificando se foi salvo...');
        const check = await client.query(
            `SELECT sku, nome, tipo_produto, kit_bom
       FROM obsidian.produtos
       WHERE sku = $1`,
            [sku]
        );

        if (check.rows.length > 0) {
            console.log('✅ Kit encontrado no banco:');
            console.log('   SKU:', check.rows[0].sku);
            console.log('   Nome:', check.rows[0].nome);
            console.log('   Tipo:', check.rows[0].tipo_produto);
            console.log('   Kit BOM:', JSON.stringify(check.rows[0].kit_bom));
        } else {
            console.log('❌ Kit NÃO encontrado no banco!');
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

testKitCreation();

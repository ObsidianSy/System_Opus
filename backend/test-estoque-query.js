import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function testEstoqueQuery() {
    try {
        console.log('Testando query de estoque...\n');

        const result = await pool.query(`
      SELECT 
        e.id,
        e.sku,
        e.nome,
        e.categoria,
        e.tipo_produto,
        e.quantidade_atual,
        e.unidade_medida,
        e.preco_unitario,
        e.ativo,
        e.criado_em,
        e.atualizado_em,
        e.kit_bom,
        e.is_kit,
        e.kit_bom_hash,
        COALESCE(
          json_agg(
            json_build_object(
              'sku_componente', ck.component_sku,
              'quantidade_por_kit', ck.qty
            )
          ) FILTER (WHERE ck.component_sku IS NOT NULL), '[]'
        ) as componentes
      FROM obsidian.produtos e
      LEFT JOIN obsidian.kit_components ck ON e.sku = ck.kit_sku
      GROUP BY e.id, e.sku, e.nome, e.categoria, e.tipo_produto, e.quantidade_atual, e.unidade_medida, e.preco_unitario, e.ativo, e.criado_em, e.atualizado_em, e.kit_bom, e.is_kit, e.kit_bom_hash
      ORDER BY e.criado_em DESC
      LIMIT 2
    `);

        console.log('✅ Query executada com sucesso!');
        console.log(`Total de produtos: ${result.rows.length}`);
        console.log('\nPrimeiro produto:');
        console.log(JSON.stringify(result.rows[0], null, 2));

    } catch (error) {
        console.error('❌ Erro ao executar query:', error.message);
    } finally {
        await pool.end();
    }
}

testEstoqueQuery();

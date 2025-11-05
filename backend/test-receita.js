const { pool } = require('./dist/database/db.js');

async function testarQuery() {
    try {
        console.log('🔍 Testando query de receitas...\n');

        // Primeiro, verificar estrutura de materia_prima
        console.log('1️⃣ Verificando colunas de materia_prima:');
        const colunas = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'obsidian' AND table_name = 'materia_prima'
      ORDER BY ordinal_position
    `);
        console.log('Colunas:', colunas.rows.map(r => r.column_name).join(', '));
        console.log('');

        // Verificar se há dados em receita_produto
        console.log('2️⃣ Verificando registros em receita_produto:');
        const receitas = await pool.query('SELECT COUNT(*) FROM obsidian.receita_produto');
        console.log('Total de registros:', receitas.rows[0].count);
        console.log('');

        // Testar a query completa
        console.log('3️⃣ Testando query completa:');
        const result = await pool.query(`
      SELECT 
        e.sku as sku_produto,
        e.nome as nome_produto,
        json_agg(
          json_build_object(
            'sku_mp', rp.sku_mp,
            'quantidade_por_produto', rp.quantidade_por_produto,
            'unidade_medida', rp.unidade_medida,
            'valor_unitario', rp.valor_unitario,
            'nome_materia_prima', COALESCE(mp.nome, mp.nome_materia_prima, mp.id)
          ) ORDER BY rp.id
        ) as items
      FROM obsidian.receita_produto rp
      JOIN obsidian.produtos e ON rp.sku_produto = e.sku
      LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku OR rp.sku_mp = mp.id OR rp.sku_mp = mp.sku_materia_prima
      GROUP BY e.sku, e.nome
      ORDER BY e.nome
    `);

        console.log('✅ Query executada com sucesso!');
        console.log('Registros retornados:', result.rows.length);
        if (result.rows.length > 0) {
            console.log('Exemplo:', JSON.stringify(result.rows[0], null, 2));
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Detalhes:', error);
        process.exit(1);
    }
}

testarQuery();

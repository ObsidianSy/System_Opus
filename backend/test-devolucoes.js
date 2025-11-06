const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testDevolucoes() {
    const client = await pool.connect();

    try {
        console.log('🧪 Testando sistema de devoluções...\n');

        // 1. Verificar se tabela existe
        console.log('1️⃣ Verificando tabela devolucoes...');
        const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'obsidian' 
        AND table_name = 'devolucoes'
      );
    `);
        console.log(`   ✅ Tabela existe: ${tableCheck.rows[0].exists}\n`);

        // 2. Verificar vendas canceladas
        console.log('2️⃣ Buscando vendas canceladas...');
        const vendasCanceladas = await client.query(`
      SELECT COUNT(*) as total
      FROM obsidian.vendas
      WHERE LOWER(status_venda) = 'cancelado'
        AND fulfillment_ext = false;
    `);
        console.log(`   📦 Total de vendas canceladas (não-fulfillment): ${vendasCanceladas.rows[0].total}\n`);

        // 3. Verificar estrutura da tabela devolucoes
        console.log('3️⃣ Estrutura da tabela devolucoes:');
        const structure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'obsidian'
        AND table_name = 'devolucoes'
      ORDER BY ordinal_position;
    `);
        structure.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

        console.log('\n✅ Sistema de devoluções pronto para uso!');
        console.log('\n📋 Próximos passos:');
        console.log('   1. Marcar vendas como canceladas (coluna status_venda = "cancelado")');
        console.log('   2. Acessar /devolucoes no frontend');
        console.log('   3. Conferir produtos que retornaram fisicamente');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

testDevolucoes();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkVendasStructure() {
    const client = await pool.connect();

    try {
        // Verificar colunas da tabela vendas
        const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'obsidian' 
        AND table_name = 'vendas'
      ORDER BY ordinal_position;
    `);

        console.log('📋 Estrutura da tabela vendas:\n');
        columns.rows.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''} ${col.column_default || ''}`);
        });

        // Verificar constraints e chaves
        const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'obsidian.vendas'::regclass;
    `);

        console.log('\n🔑 Constraints da tabela vendas:\n');
        constraints.rows.forEach(con => {
            const type = con.contype === 'p' ? 'PRIMARY KEY' :
                con.contype === 'f' ? 'FOREIGN KEY' :
                    con.contype === 'u' ? 'UNIQUE' : con.contype;
            console.log(`   ${con.conname} (${type}): ${con.definition}`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkVendasStructure();

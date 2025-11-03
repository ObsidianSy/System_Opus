const { pool } = require('./dist/database/db.js');

async function checkColumns() {
    try {
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'obsidian' 
              AND table_name = 'clientes'
            ORDER BY ordinal_position
        `);

        console.log('📋 Colunas da tabela clientes:');
        result.rows.forEach(col => {
            console.log(`  - ${col.column_name}`);
        });

        // Buscar um cliente de exemplo
        const cliente = await pool.query(`
            SELECT * FROM obsidian.clientes LIMIT 1
        `);

        console.log('\n📝 Exemplo de cliente:');
        if (cliente.rows.length > 0) {
            console.log(JSON.stringify(cliente.rows[0], null, 2));
        }

        await pool.end();
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkColumns();

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkFullTables() {
    try {
        console.log('🔌 Conectando ao banco...');
        console.log(`Host: ${process.env.DB_HOST}`);
        console.log(`Database: ${process.env.DB_NAME}`);

        // Testar conexão
        await pool.query('SELECT NOW()');
        console.log('✅ Conexão estabelecida!\n');

        // Listar tabelas FULL
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'logistica' 
              AND table_name LIKE '%full%' 
            ORDER BY table_name
        `);

        console.log('📋 Tabelas FULL encontradas:');
        console.log(JSON.stringify(tables.rows, null, 2));

        // Para cada tabela, mostrar estrutura
        for (const table of tables.rows) {
            const tableName = table.table_name;
            console.log(`\n\n🔍 Estrutura de logistica.${tableName}:`);

            const columns = await pool.query(`
                SELECT 
                    column_name, 
                    data_type, 
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_schema = 'logistica' 
                  AND table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);

            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? 'DEFAULT ' + col.column_default : ''}`);
            });

            // Contar registros
            const count = await pool.query(`SELECT COUNT(*) as total FROM logistica.${tableName}`);
            console.log(`  📊 Total de registros: ${count.rows[0].total}`);

            // Mostrar sample dos últimos 3 registros
            const sample = await pool.query(`SELECT * FROM logistica.${tableName} ORDER BY id DESC LIMIT 3`);
            if (sample.rows.length > 0) {
                console.log(`  📝 Últimos registros (sample):`);
                sample.rows.forEach((row, idx) => {
                    console.log(`    ${idx + 1}.`, JSON.stringify(row, null, 2).substring(0, 200) + '...');
                });
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkFullTables();

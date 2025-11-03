const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
});

async function checkMovimentos() {
    try {
        // Buscar tabelas com 'movimento' no nome
        const tables = await pool.query(`
            SELECT 
                table_schema,
                table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE '%movimento%'
               OR table_name LIKE '%estoque%'
               OR table_name LIKE '%mov%'
            ORDER BY table_schema, table_name
        `);

        console.log('\n📋 Tabelas relacionadas a movimentos/estoque:\n');
        console.log(JSON.stringify(tables.rows, null, 2));

        // Verificar schema obsidian
        console.log('\n\n📦 Todas as tabelas do schema obsidian:\n');
        const obsidianTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'obsidian'
            ORDER BY table_name
        `);

        obsidianTables.rows.forEach(row => {
            console.log(`  - obsidian.${row.table_name}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

checkMovimentos();

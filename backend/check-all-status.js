require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkAllStatus() {
    try {
        console.log('🔌 Conectando ao banco de dados...\n');

        // 1. Ver TODAS as constraints da tabela
        console.log('=== TODAS AS CONSTRAINTS DA TABELA ===\n');
        const constraints = await pool.query(`
            SELECT 
                conname,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint 
            WHERE conrelid = 'raw_export_orders'::regclass;
        `);

        constraints.rows.forEach(row => {
            console.log(`Constraint: ${row.conname}`);
            console.log(`Definição: ${row.definition}\n`);
        });

        // 2. Ver estrutura COMPLETA da coluna status
        console.log('\n=== ESTRUTURA DA COLUNA STATUS ===\n');
        const columns = await pool.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'raw_export_orders' 
            AND column_name LIKE '%status%';
        `);

        console.log(JSON.stringify(columns.rows, null, 2));

        // 3. Ver alguns valores REAIS que existem na tabela
        console.log('\n=== VALORES DE STATUS QUE JÁ EXISTEM ===\n');
        const existing = await pool.query(`
            SELECT DISTINCT status, COUNT(*) as count
            FROM raw_export_orders 
            GROUP BY status
            ORDER BY count DESC
            LIMIT 10;
        `);

        console.log('Valores encontrados:');
        existing.rows.forEach(row => {
            console.log(`  - "${row.status}" (${row.count} registros)`);
        });

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

checkAllStatus();

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🚀 Executando migration: 001_create_devolucoes_table.sql\n');

        const migrationPath = path.join(__dirname, 'migrations', '001_create_devolucoes_table.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');

        console.log('✅ Migration executada com sucesso!\n');

        // Verificar se a tabela foi criada
        const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'obsidian' 
        AND table_name = 'devolucoes'
      ORDER BY ordinal_position;
    `);

        console.log('📋 Estrutura da tabela devolucoes:');
        result.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao executar migration:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);

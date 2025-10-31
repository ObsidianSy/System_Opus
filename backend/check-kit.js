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

async function checkKitComponents() {
    try {
        console.log('Verificando estrutura da tabela kit_components...\n');

        const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'obsidian' 
      AND table_name = 'kit_components' 
      ORDER BY ordinal_position
    `);

        if (result.rows.length === 0) {
            console.log('❌ Tabela kit_components não existe ou está vazia');
        } else {
            console.log('✅ Colunas da tabela kit_components:');
            result.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type}`);
            });
        }

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkKitComponents();

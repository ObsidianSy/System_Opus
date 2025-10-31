import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkTables() {
    try {
        const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'obsidian'
      ORDER BY table_name
    `);

        console.log('📊 Tabelas no banco obsidian:');
        console.log(result.rows.map(r => r.table_name).join('\n'));
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

checkTables();

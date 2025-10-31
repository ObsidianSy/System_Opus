import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkEnvioFull() {
    try {
        console.log('\n📦 Estrutura de logistica.envio_full:');
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'logistica' AND table_name = 'envio_full'
            ORDER BY ordinal_position
        `);
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

checkEnvioFull();

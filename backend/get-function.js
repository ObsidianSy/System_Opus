const { Pool } = require('pg');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function getFunction() {
    try {
        const result = await pool.query(`
            SELECT prosrc 
            FROM pg_proc 
            WHERE proname = 'full_envio_emitir'
        `);

        if (result.rows.length > 0) {
            console.log(result.rows[0].prosrc);
        } else {
            console.log('Função não encontrada');
        }
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
}

getFunction();

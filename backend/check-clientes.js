import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkClientes() {
    try {
        // Buscar tabelas com "client" no nome
        console.log('\n🔍 Tabelas com "client" no nome:');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'obsidian' AND table_name ILIKE '%client%'
        `);
        console.log(tables.rows);

        // Tentar consultar alguns clientes
        console.log('\n👥 Tentando buscar clientes...');
        try {
            const clientes = await pool.query(`SELECT * FROM obsidian.clientes LIMIT 5`);
            console.log('✅ Tabela: obsidian.clientes');
            console.log(clientes.rows);
        } catch (e) {
            console.log('❌ obsidian.clientes não existe');
        }

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

checkClientes();

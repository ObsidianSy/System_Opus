import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function checkImportStructure() {
    try {
        // Estrutura de import_batches
        console.log('\n📦 Estrutura de import_batches:');
        const batches = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'obsidian' AND table_name = 'import_batches'
      ORDER BY ordinal_position
    `);
        console.log(JSON.stringify(batches.rows, null, 2));

        // Estrutura de raw_match
        console.log('\n🔗 Estrutura de raw_match:');
        const raw = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'obsidian' AND table_name = 'raw_match'
      ORDER BY ordinal_position
    `);
        console.log(JSON.stringify(raw.rows, null, 2));

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

checkImportStructure();

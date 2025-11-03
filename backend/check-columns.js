const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkColumns() {
    const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='raw_export_orders' 
          AND column_name IN ('order_id','sku_text','qty','unit_price','total','customer','channel','status','order_date','original_filename','row_num')
        ORDER BY column_name
    `);

    console.log('Colunas que existem:');
    result.rows.forEach(c => console.log(' -', c.column_name));

    process.exit(0);
}

checkColumns().catch(e => { console.error(e); process.exit(1) });

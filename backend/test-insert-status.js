require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function testInsert() {
    try {
        console.log('🧪 Testando INSERT com diferentes valores de status...\n');

        const testValues = [
            'pending',
            'matched',
            ' pending',
            'pending ',
            'Pending',
            'PENDING'
        ];

        for (const status of testValues) {
            try {
                await pool.query(`
                    INSERT INTO raw_export_orders (
                        "Nº de Pedido da Plataforma",
                        "SKU",
                        client_id,
                        sku_text,
                        qty,
                        unit_price,
                        status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (client_id, "Nº de Pedido da Plataforma", sku_text, qty, unit_price) 
                    DO NOTHING
                `, ['TEST-' + Date.now(), 'TEST-SKU', 1, 'TEST-SKU', 1, 10.00, status]);

                console.log(`✅ Status "${status}" (${status.length} chars): ACEITO`);
            } catch (error) {
                console.log(`❌ Status "${status}" (${status.length} chars): REJEITADO - ${error.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await pool.end();
    }
}

testInsert();

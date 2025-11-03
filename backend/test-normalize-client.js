const { pool } = require('./dist/database/db.js');

async function normalizeClientId(clientIdInput) {
    if (!clientIdInput) return null;

    // Se já é número, retornar
    if (!isNaN(Number(clientIdInput))) {
        return Number(clientIdInput);
    }

    // Se é string (nome do cliente), buscar ID
    try {
        const result = await pool.query(
            `SELECT id FROM obsidian.clientes WHERE UPPER(nome) ILIKE UPPER($1) LIMIT 1`,
            [clientIdInput]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ Cliente "${clientIdInput}" não encontrado no banco`);
            return null;
        }

        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Erro ao normalizar client_id:', error);
        return null;
    }
}

async function test() {
    console.log('🧪 Testando normalização de client_id...\n');

    // Teste 1: ID numérico
    const test1 = await normalizeClientId(2);
    console.log(`✅ Teste 1 (ID=2): ${test1}`);

    // Teste 2: ID como string
    const test2 = await normalizeClientId('2');
    console.log(`✅ Teste 2 (ID='2'): ${test2}`);

    // Teste 3: Nome do cliente
    const test3 = await normalizeClientId('Realistt');
    console.log(`✅ Teste 3 (nome='Realistt'): ${test3}`);

    // Teste 4: Nome com case diferente
    const test4 = await normalizeClientId('realistt');
    console.log(`✅ Teste 4 (nome='realistt' lowercase): ${test4}`);

    // Teste 5: Nome com espaços
    const test5 = await normalizeClientId('New Seven');
    console.log(`✅ Teste 5 (nome='New Seven'): ${test5}`);

    // Teste 6: Cliente inexistente
    const test6 = await normalizeClientId('Cliente Fake XYZ');
    console.log(`✅ Teste 6 (cliente fake): ${test6}`);

    await pool.end();
    console.log('\n✅ Todos os testes concluídos!');
}

test();

require('dotenv').config();

async function testEmit() {
    try {
        const response = await fetch('http://localhost:3001/api/envios/emitir-vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: '1', // New Seven
                source: 'ML'
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Erro:', response.status, error);
        } else {
            const result = await response.json();
            console.log('✅ Sucesso:', JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error('❌ Erro de conexão:', error.message);
    }
}

testEmit();

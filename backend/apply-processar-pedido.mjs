import pkg from 'pg';
import fs from 'fs';
const { Client } = pkg;

const client = new Client({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function applyFunction() {
    try {
        await client.connect();
        console.log('✅ Conectado ao banco!\n');

        // Ler o SQL do arquivo
        const sql = fs.readFileSync('./fix-processar-pedido.sql', 'utf8');

        // Extrair só a função CREATE OR REPLACE
        const functionMatch = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]+?\$\$;/);

        if (!functionMatch) {
            throw new Error('Não foi possível encontrar a função no arquivo SQL');
        }

        const functionSQL = functionMatch[0];

        console.log('📋 Aplicando função processar_pedido...\n');

        // Remover função antiga
        await client.query(`DROP FUNCTION IF EXISTS obsidian.processar_pedido(text, date, text, text, jsonb) CASCADE;`);
        console.log('✅ Função antiga removida!\n');

        // Criar nova função
        await client.query(functionSQL);
        console.log('✅ Função processar_pedido atualizada com client_id e import_id!\n');

        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ FUNÇÃO APLICADA COM SUCESSO!');
        console.log('Agora a função salva:');
        console.log('  - client_id (qual cliente é a venda)');
        console.log('  - import_id (de qual importação veio)');
        console.log('  - codigo_ml (número do pedido ML)');
        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await client.end();
    }
}

applyFunction();

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function addColumns() {
    try {
        await client.connect();
        console.log('✅ Conectado ao banco!\n');

        // Adicionar colunas se não existirem
        console.log('📋 Adicionando colunas client_id e codigo_ml...\n');

        await client.query(`
            ALTER TABLE obsidian.vendas 
            ADD COLUMN IF NOT EXISTS client_id INTEGER,
            ADD COLUMN IF NOT EXISTS codigo_ml TEXT;
        `);

        console.log('✅ Colunas adicionadas!\n');

        // Adicionar FK para clientes
        console.log('📋 Adicionando constraint FK para clientes...\n');

        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints
                    WHERE constraint_name = 'fk_vendas_client'
                ) THEN
                    ALTER TABLE obsidian.vendas
                    ADD CONSTRAINT fk_vendas_client
                    FOREIGN KEY (client_id) REFERENCES obsidian.clientes(id);
                END IF;
            END$$;
        `);

        console.log('✅ Constraint FK adicionada!\n');

        // Criar índices para performance
        console.log('📋 Criando índices...\n');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_vendas_client_id ON obsidian.vendas(client_id);
            CREATE INDEX IF NOT EXISTS idx_vendas_codigo_ml ON obsidian.vendas(codigo_ml);
            CREATE INDEX IF NOT EXISTS idx_vendas_import_id ON obsidian.vendas(import_id);
        `);

        console.log('✅ Índices criados!\n');

        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ TABELA VENDAS ATUALIZADA COM SUCESSO!');
        console.log('Novas colunas:');
        console.log('  - client_id (INTEGER, FK para clientes)');
        console.log('  - codigo_ml (TEXT, número do pedido ML)');
        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await client.end();
    }
}

addColumns();

/**
 * Script para verificar e criar a tabela activity_logs se não existir
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function verificarECriarTabela() {
    const client = await pool.connect();

    try {
        console.log('🔍 Verificando tabela activity_logs...\n');

        // Verificar se a tabela existe
        const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'obsidian' 
        AND table_name = 'activity_logs'
      );
    `);

        const tabelaExiste = checkTable.rows[0].exists;

        if (tabelaExiste) {
            console.log('✅ Tabela activity_logs já existe!');

            // Verificar estrutura
            const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'obsidian' 
        AND table_name = 'activity_logs'
        ORDER BY ordinal_position;
      `);

            console.log('\n📋 Estrutura da tabela:');
            columns.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
            });

            // Contar registros
            const count = await client.query('SELECT COUNT(*) FROM obsidian.activity_logs');
            console.log(`\n📊 Total de registros: ${count.rows[0].count}`);

        } else {
            console.log('⚠️  Tabela activity_logs NÃO existe! Criando...\n');

            // Criar a tabela
            await client.query(`
        CREATE TABLE IF NOT EXISTS obsidian.activity_logs (
          id SERIAL PRIMARY KEY,
          user_email TEXT NOT NULL,
          user_name TEXT,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          details JSONB,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

            console.log('✅ Tabela activity_logs criada com sucesso!');

            // Criar índices para melhor performance
            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user_email 
        ON obsidian.activity_logs(user_email);
      `);

            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_activity_logs_action 
        ON obsidian.activity_logs(action);
      `);

            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at 
        ON obsidian.activity_logs(created_at DESC);
      `);

            console.log('✅ Índices criados com sucesso!');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Executar
verificarECriarTabela()
    .then(() => {
        console.log('\n✅ Verificação concluída!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Erro fatal:', error);
        process.exit(1);
    });

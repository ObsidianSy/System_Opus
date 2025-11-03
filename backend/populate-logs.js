/**
 * Script para popular a tabela activity_logs com dados históricos
 * Busca uploads antigos das tabelas logistica.full_envio e obsidian.vendas
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

async function popularLogs() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Iniciando população de logs...\n');

    // 1. Buscar imports FULL da tabela full_envio
    console.log('📦 Buscando imports FULL...');
    const fullEnvios = await client.query(`
      SELECT 
        fe.id,
        fe.envio_num,
        fe.client_id,
        fe.created_at,
        fe.import_date,
        COUNT(fi.id) as total_itens,
        c.nome as client_name
      FROM logistica.full_envio fe
      LEFT JOIN logistica.full_item fi ON fi.envio_id = fe.id
      LEFT JOIN obsidian.clientes c ON c.id = fe.client_id
      GROUP BY fe.id, fe.envio_num, fe.client_id, fe.created_at, fe.import_date, c.nome
      ORDER BY fe.created_at DESC
    `);

    console.log(`   Encontrados ${fullEnvios.rows.length} imports FULL\n`);

    // Inserir logs para cada import FULL
    let fullInseridos = 0;
    for (const envio of fullEnvios.rows) {
      await client.query(`
        INSERT INTO obsidian.activity_logs 
          (user_email, user_name, action, entity_type, entity_id, details, created_at)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        'sistema@opus.com',
        'Sistema (Importação Histórica)',
        'upload_full',
        'envio',
        envio.id.toString(),
        JSON.stringify({
          envio_num: envio.envio_num,
          client_id: envio.client_id,
          client_name: envio.client_name,
          total_linhas: parseInt(envio.total_itens),
          import_date: envio.import_date,
          historico: true
        }),
        envio.created_at
      ]);
      fullInseridos++;
    }

    console.log(`✅ ${fullInseridos} logs FULL inseridos\n`);

    // 2. Buscar vendas emitidas agrupadas por data
    console.log('💰 Buscando emissões de vendas...');
    const vendasEmitidas = await client.query(`
      SELECT 
        DATE(created_at) as data_emissao,
        COUNT(*) as total_vendas,
        MIN(created_at) as primeira_venda,
        STRING_AGG(DISTINCT SPLIT_PART(ext_id, ':', 1), ', ') as fontes
      FROM obsidian.vendas
      WHERE ext_id IS NOT NULL
      GROUP BY DATE(created_at)
      ORDER BY data_emissao DESC
    `);

    console.log(`   Encontrados ${vendasEmitidas.rows.length} lotes de emissão\n`);

    // Inserir logs para cada lote de emissão
    let vendasInseridas = 0;
    for (const lote of vendasEmitidas.rows) {
      await client.query(`
        INSERT INTO obsidian.activity_logs 
          (user_email, user_name, action, entity_type, entity_id, details, created_at)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        'sistema@opus.com',
        'Sistema (Importação Histórica)',
        'emit_sales',
        'vendas',
        lote.data_emissao,
        JSON.stringify({
          total_vendas: parseInt(lote.total_vendas),
          fontes: lote.fontes,
          data_emissao: lote.data_emissao,
          historico: true
        }),
        lote.primeira_venda
      ]);
      vendasInseridas++;
    }

    console.log(`✅ ${vendasInseridas} logs de vendas inseridos\n`);

    // 3. Resumo final
    const totalLogs = await client.query(
      'SELECT COUNT(*) as total FROM obsidian.activity_logs'
    );

    console.log('🎉 População concluída!');
    console.log(`📊 Total de logs na tabela: ${totalLogs.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Erro ao popular logs:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
popularLogs()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

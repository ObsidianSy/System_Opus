import { pool } from './db';

// Script para criar todas as tabelas necessárias no banco PostgreSQL
export const createTables = async () => {
  const client = await pool.connect();

  try {
    console.log('🔧 Criando tabelas no banco de dados...');

    await client.query('BEGIN');

    // Tabela de Clientes
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id_cliente VARCHAR(50) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        documento VARCHAR(50),
        telefone VARCHAR(50),
        email VARCHAR(255),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela clientes criada');

    // Tabela de Estoque (Produtos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS estoque (
        sku VARCHAR(50) PRIMARY KEY,
        nome_produto VARCHAR(255) NOT NULL,
        categoria VARCHAR(100),
        tipo_produto VARCHAR(50),
        quantidade_atual DECIMAL(10, 3) DEFAULT 0,
        unidade_medida VARCHAR(20),
        preco_unitario DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela estoque criada');

    // Tabela de Componentes de Kit (produtos compostos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS componentes_kit (
        id SERIAL PRIMARY KEY,
        sku_produto VARCHAR(50) REFERENCES estoque(sku) ON DELETE CASCADE,
        sku_componente VARCHAR(50) REFERENCES estoque(sku) ON DELETE CASCADE,
        quantidade_por_kit DECIMAL(10, 3) NOT NULL,
        preco_unitario DECIMAL(10, 2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela componentes_kit criada');

    // Tabela de Matéria-Prima
    await client.query(`
      CREATE TABLE IF NOT EXISTS materia_prima (
        id_materia_prima VARCHAR(50) PRIMARY KEY,
        sku_materia_prima VARCHAR(50) UNIQUE NOT NULL,
        nome_materia_prima VARCHAR(255) NOT NULL,
        categoria VARCHAR(100),
        quantidade_atual DECIMAL(10, 3) DEFAULT 0,
        unidade_medida VARCHAR(20),
        preco_unitario DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela materia_prima criada');

    // Tabela de Receita de Produto (composição dos produtos)
    await client.query(`
      CREATE TABLE IF NOT EXISTS receita_produto (
        id SERIAL PRIMARY KEY,
        sku_produto VARCHAR(50) REFERENCES estoque(sku) ON DELETE CASCADE,
        sku_materia_prima VARCHAR(50) REFERENCES materia_prima(sku_materia_prima) ON DELETE CASCADE,
        quantidade_por_produto DECIMAL(10, 3) NOT NULL,
        unidade_medida VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela receita_produto criada');

    // Tabela de Vendas
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendas (
        id_venda VARCHAR(50) PRIMARY KEY,
        data_venda TIMESTAMP NOT NULL,
        id_cliente VARCHAR(50) REFERENCES clientes(id_cliente),
        nome_cliente VARCHAR(255),
        valor_total DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela vendas criada');

    // Tabela de Itens da Venda
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendas_itens (
        id SERIAL PRIMARY KEY,
        id_venda VARCHAR(50) REFERENCES vendas(id_venda) ON DELETE CASCADE,
        sku_produto VARCHAR(50) REFERENCES estoque(sku),
        nome_produto VARCHAR(255),
        quantidade_vendida DECIMAL(10, 3) NOT NULL,
        preco_unitario DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantidade_vendida * preco_unitario) STORED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela vendas_itens criada');

    // Tabela de Pagamentos
    await client.query(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id_pagamento VARCHAR(50) PRIMARY KEY,
        data_pagamento TIMESTAMP NOT NULL,
        id_cliente VARCHAR(50) REFERENCES clientes(id_cliente),
        nome_cliente VARCHAR(255),
        valor_pago DECIMAL(10, 2) NOT NULL,
        forma_pagamento VARCHAR(50),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela pagamentos criada');

    // Criar índices para melhorar performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);
      CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON vendas(id_cliente);
      CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_pagamento);
      CREATE INDEX IF NOT EXISTS idx_pagamentos_cliente ON pagamentos(id_cliente);
      CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda ON vendas_itens(id_venda);
      CREATE INDEX IF NOT EXISTS idx_componentes_kit_produto ON componentes_kit(sku_produto);
      CREATE INDEX IF NOT EXISTS idx_receita_produto_sku ON receita_produto(sku_produto);
    `);
    console.log('✅ Índices criados');

    await client.query('COMMIT');
    console.log('🎉 Todas as tabelas foram criadas com sucesso!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar tabelas:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Executa a criação das tabelas se o script for chamado diretamente
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('✅ Migration concluída');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Erro na migration:', err);
      process.exit(1);
    });
}

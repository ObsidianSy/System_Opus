-- Migration: Create devolucoes table for returns/cancellations management
-- Created: 2025-11-06
-- Purpose: Track physical returns of cancelled products

CREATE TABLE IF NOT EXISTS obsidian.devolucoes (
    id SERIAL PRIMARY KEY,
    venda_id BIGINT NOT NULL,
    sku_produto VARCHAR(100) NOT NULL,
    quantidade_esperada INTEGER NOT NULL CHECK (quantidade_esperada > 0),
    quantidade_recebida INTEGER DEFAULT 0 CHECK (quantidade_recebida >= 0),
    condicao VARCHAR(20) DEFAULT 'pendente' CHECK (condicao IN ('bom', 'defeito', 'pendente')),
    conferido_em TIMESTAMP,
    conferido_por VARCHAR(100),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_venda FOREIGN KEY (venda_id) REFERENCES obsidian.vendas(venda_id) ON DELETE CASCADE
);

-- Index for faster lookups by venda_id
CREATE INDEX IF NOT EXISTS idx_devolucoes_venda_id ON obsidian.devolucoes(venda_id);

-- Index for filtering by condition status
CREATE INDEX IF NOT EXISTS idx_devolucoes_condicao ON obsidian.devolucoes(condicao);

-- Index for filtering pending returns (not yet conferenced)
CREATE INDEX IF NOT EXISTS idx_devolucoes_pendentes ON obsidian.devolucoes(conferido_em) WHERE conferido_em IS NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION obsidian.update_devolucoes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_devolucoes_timestamp
    BEFORE UPDATE ON obsidian.devolucoes
    FOR EACH ROW
    EXECUTE FUNCTION obsidian.update_devolucoes_timestamp();

-- Add comment to table
COMMENT ON TABLE obsidian.devolucoes IS 'Gerenciamento de devoluções físicas de produtos cancelados';
COMMENT ON COLUMN obsidian.devolucoes.venda_id IS 'ID da venda cancelada que gerou a devolução';
COMMENT ON COLUMN obsidian.devolucoes.sku_produto IS 'SKU do produto devolvido';
COMMENT ON COLUMN obsidian.devolucoes.quantidade_esperada IS 'Quantidade que deveria retornar (da venda cancelada)';
COMMENT ON COLUMN obsidian.devolucoes.quantidade_recebida IS 'Quantidade efetivamente recebida no retorno';
COMMENT ON COLUMN obsidian.devolucoes.condicao IS 'Condição do produto: bom (volta ao estoque), defeito (não volta), pendente (ainda não conferido)';
COMMENT ON COLUMN obsidian.devolucoes.conferido_em IS 'Data/hora da conferência física do retorno';
COMMENT ON COLUMN obsidian.devolucoes.conferido_por IS 'Usuário que realizou a conferência';

-- Migration: Remove CASCADE DELETE from devolucoes FK
-- Purpose: Keep devolucoes records even after venda is deleted (cancelled orders)
-- Created: 2025-11-06

-- Drop existing FK constraint
ALTER TABLE obsidian.devolucoes 
DROP CONSTRAINT IF EXISTS fk_venda;

-- Recreate FK without CASCADE (or with SET NULL)
-- Option 1: Keep venda_id but don't delete on venda deletion
ALTER TABLE obsidian.devolucoes 
ADD CONSTRAINT fk_venda 
FOREIGN KEY (venda_id) REFERENCES obsidian.vendas(venda_id) 
ON DELETE SET NULL;

-- Update column to allow NULL (since venda will be deleted)
ALTER TABLE obsidian.devolucoes 
ALTER COLUMN venda_id DROP NOT NULL;

-- Add pedido_uid column if it doesn't exist (for tracking after venda deletion)
ALTER TABLE obsidian.devolucoes 
ADD COLUMN IF NOT EXISTS pedido_uid VARCHAR(100);

-- Add motivo_cancelamento column if it doesn't exist
ALTER TABLE obsidian.devolucoes 
ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- Add tipo_problema column if it doesn't exist (migrated from condicao)
ALTER TABLE obsidian.devolucoes 
ADD COLUMN IF NOT EXISTS tipo_problema VARCHAR(50) DEFAULT 'pendente';

-- Create unique constraint to prevent duplicates
ALTER TABLE obsidian.devolucoes 
ADD CONSTRAINT ux_devolucoes_pedido_sku UNIQUE (pedido_uid, sku_produto);

COMMENT ON COLUMN obsidian.devolucoes.pedido_uid IS 'ID do pedido (ML-xxxxxxx) para rastreamento após venda ser deletada';
COMMENT ON COLUMN obsidian.devolucoes.motivo_cancelamento IS 'Razão do cancelamento informada pelo ML';

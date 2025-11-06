-- Migration: Expand devolucoes table for detailed conferencia options
-- Created: 2025-11-06
-- Purpose: Support different return scenarios (correct/defect, wrong product, etc)

-- Adicionar novos campos para tipos de problema e produto real recebido
ALTER TABLE obsidian.devolucoes 
ADD COLUMN IF NOT EXISTS tipo_problema VARCHAR(50) CHECK (tipo_problema IN ('correto_bom', 'correto_defeito', 'errado_bom', 'pendente')),
ADD COLUMN IF NOT EXISTS produto_real_recebido VARCHAR(100);

-- Atualizar registros existentes para 'pendente' se ainda não conferidos
UPDATE obsidian.devolucoes 
SET tipo_problema = 'pendente' 
WHERE tipo_problema IS NULL AND conferido_em IS NULL;

-- Remover a constraint antiga de 'condicao' pois agora usamos 'tipo_problema'
ALTER TABLE obsidian.devolucoes 
DROP CONSTRAINT IF EXISTS devolucoes_condicao_check;

-- Atualizar comentários
COMMENT ON COLUMN obsidian.devolucoes.tipo_problema IS 'Tipo de problema na devolução: correto_bom (produto certo em bom estado, volta ao estoque), correto_defeito (produto certo com defeito, não volta), errado_bom (produto errado mas em bom estado, precisa especificar qual produto veio), pendente (ainda não conferido)';
COMMENT ON COLUMN obsidian.devolucoes.produto_real_recebido IS 'SKU do produto que realmente foi recebido (usado quando tipo_problema = errado_bom)';

-- Criar índice para buscar devoluções por tipo de problema
CREATE INDEX IF NOT EXISTS idx_devolucoes_tipo_problema ON obsidian.devolucoes(tipo_problema);

-- Atualizar a função de trigger para manter compatibilidade
DROP TRIGGER IF EXISTS trigger_update_devolucoes_timestamp ON obsidian.devolucoes;
CREATE TRIGGER trigger_update_devolucoes_timestamp
    BEFORE UPDATE ON obsidian.devolucoes
    FOR EACH ROW
    EXECUTE FUNCTION obsidian.update_devolucoes_timestamp();

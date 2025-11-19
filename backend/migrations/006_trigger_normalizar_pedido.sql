-- =====================================================
-- TRIGGER: Normalizar pedido_uid automaticamente
-- Remove quebras de linha e múltiplos números ANTES de inserir
-- =====================================================

CREATE OR REPLACE FUNCTION obsidian.normalizar_pedido_uid()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o pedido_uid tem quebra de linha ou múltiplos números, normaliza
    IF NEW.pedido_uid LIKE '%' || CHR(10) || '%' 
       OR NEW.pedido_uid LIKE '%' || CHR(13) || '%' 
       OR LENGTH(NEW.pedido_uid) > 25 THEN
        
        -- Extrair apenas a primeira parte (antes da quebra/espaço)
        NEW.pedido_uid := TRIM(
            SPLIT_PART(
                SPLIT_PART(NEW.pedido_uid, CHR(10), 1), 
                CHR(13), 
                1
            )
        );
        
        -- (Prod) Removido log para não poluir glor logs; se precisar debugar, reative temporariamente
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_normalizar_pedido ON obsidian.vendas;
CREATE TRIGGER trigger_normalizar_pedido
    BEFORE INSERT OR UPDATE ON obsidian.vendas
    FOR EACH ROW
    EXECUTE FUNCTION obsidian.normalizar_pedido_uid();

-- Testar (opcional)
-- INSERT INTO obsidian.vendas (pedido_uid, ...) VALUES ('ML-123456' || CHR(10) || '789', ...);
-- Deve inserir apenas 'ML-123456'

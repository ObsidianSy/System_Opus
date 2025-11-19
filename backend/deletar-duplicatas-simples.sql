-- =====================================================
-- DELETAR AS 105 VENDAS DUPLICADAS (SEM DEVOLVER ESTOQUE)
-- =====================================================

-- Opção 1: Deletar SEM devolver estoque (mais rápido)
DELETE FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20;

-- Verificar resultado
SELECT COUNT(*) as vendas_longas_restantes
FROM obsidian.vendas 
WHERE LENGTH(pedido_uid) > 20;

-- Deve retornar 0!

-- =====================================================
-- Script SQL: Deletar vendas com pedidos duplicados
-- Critério: pedido_uid com MAIS DE 20 caracteres
-- Ex: ML-2000013884171064 = 20 chars (OK)
--     ML-2000010058319625 2000138 = 28 chars (DELETAR)
-- Executar no pgAdmin ou psql quando o banco estiver online
-- =====================================================

-- 1️⃣ PASSO 1: Verificar quantas vendas serão afetadas
SELECT 
    COUNT(*) as total_vendas_duplicadas,
    COUNT(DISTINCT pedido_uid) as pedidos_unicos_duplicados
FROM obsidian.vendas
WHERE LENGTH(pedido_uid) > 20;

-- 2️⃣ PASSO 2: Listar todas as vendas que serão deletadas (para revisar)
SELECT 
    venda_id,
    pedido_uid,
    LENGTH(pedido_uid) as tamanho_pedido,
    sku_produto,
    quantidade_vendida,
    data_venda,
    nome_cliente,
    preco_unitario
FROM obsidian.vendas
WHERE LENGTH(pedido_uid) > 20
ORDER BY pedido_uid, data_venda DESC;

-- 3️⃣ PASSO 3: Devolver estoque + Deletar vendas (TRANSAÇÃO SEGURA)
BEGIN;

-- Devolver estoque para os produtos afetados
UPDATE obsidian.produtos p
SET quantidade_atual = quantidade_atual + v.quantidade_vendida
FROM obsidian.vendas v
WHERE UPPER(p.sku) = UPPER(v.sku_produto)
  AND LENGTH(v.pedido_uid) > 20;

-- Deletar vendas com pedidos > 20 caracteres
DELETE FROM obsidian.vendas
WHERE LENGTH(pedido_uid) > 20;

-- ⚠️ IMPORTANTE: Só execute COMMIT se os números acima estiverem corretos!
-- Se algo estiver errado, execute ROLLBACK;

-- COMMIT;  -- Descomente esta linha para confirmar
-- ROLLBACK;  -- Ou use esta para cancelar

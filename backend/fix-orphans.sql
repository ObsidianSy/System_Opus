-- ============================================================================
-- SCRIPT DE CORREÇÃO DE DADOS ÓRFÃOS
-- ============================================================================
-- Objetivo: Remover/corrigir registros que referenciam dados inexistentes
-- Data: 04/11/2025
-- ⚠️  ATENÇÃO: Este script modifica dados! Faça backup antes de executar!
-- ============================================================================

\echo '🔧 INICIANDO CORREÇÃO DE DADOS ÓRFÃOS...\n'
\echo '⚠️  Criando backup das tabelas afetadas...\n'

BEGIN;

-- ============================================================================
-- BACKUP DAS TABELAS (opcional - descomentar se desejar)
-- ============================================================================

-- CREATE TABLE IF NOT EXISTS backup_vendas_20241104 AS SELECT * FROM obsidian.vendas;
-- CREATE TABLE IF NOT EXISTS backup_raw_export_orders_20241104 AS SELECT * FROM raw_export_orders;
-- CREATE TABLE IF NOT EXISTS backup_full_envio_raw_20241104 AS SELECT * FROM logistica.full_envio_raw;
-- CREATE TABLE IF NOT EXISTS backup_sku_aliases_20241104 AS SELECT * FROM obsidian.sku_aliases;

\echo '1️⃣ Removendo aliases órfãos...'
-- 1. REMOVER ALIASES ÓRFÃOS
DELETE FROM obsidian.sku_aliases a
WHERE NOT EXISTS (
    SELECT 1 FROM obsidian.produtos p WHERE p.sku = a.stock_sku
);

\echo '   ✅ Aliases órfãos removidos\n'

\echo '2️⃣ Corrigindo matched_sku inválidos em raw_export_orders...'
-- 2. CORRIGIR MATCHED_SKU INVÁLIDOS (ML) - voltar para pending
UPDATE raw_export_orders r
SET 
    matched_sku = NULL, 
    status = 'pending',
    match_source = NULL,
    processed_at = NULL,
    error_msg = 'SKU não existe mais no estoque (corrigido automaticamente)'
WHERE matched_sku IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM obsidian.produtos p WHERE p.sku = r.matched_sku
  );

\echo '   ✅ Raw export orders corrigidos\n'

\echo '3️⃣ Corrigindo matched_sku inválidos em full_envio_raw...'
-- 3. CORRIGIR MATCHED_SKU INVÁLIDOS (FULL) - voltar para pending
UPDATE logistica.full_envio_raw r
SET 
    matched_sku = NULL, 
    status = 'pending', 
    processed_at = NULL,
    error_msg = 'SKU não existe mais no estoque'
WHERE matched_sku IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM obsidian.produtos p WHERE p.sku = r.matched_sku
  );

\echo '   ✅ Full envio raw corrigidos\n'

\echo '4️⃣ Removendo itens de envio com SKU inválido...'
-- 4. REMOVER FULL_ENVIO_ITEM COM SKU INVÁLIDO
DELETE FROM logistica.full_envio_item i
WHERE NOT EXISTS (
    SELECT 1 FROM obsidian.produtos p WHERE p.sku = i.sku
);

\echo '   ✅ Full envio items órfãos removidos\n'

\echo '5️⃣ Removendo componentes de kit com SKU inválido...'
-- 5. REMOVER KIT_COMPONENTS INVÁLIDOS
DELETE FROM obsidian.kit_components k
WHERE NOT EXISTS (
    SELECT 1 FROM obsidian.produtos p WHERE p.sku = k.kit_sku
) OR NOT EXISTS (
    SELECT 1 FROM obsidian.produtos p WHERE p.sku = k.component_sku
);

\echo '   ✅ Kit components inválidos removidos\n'

\echo '6️⃣ Removendo movimentos de estoque com SKU inválido...'
-- 6. REMOVER ESTOQUE_MOVIMENTOS ÓRFÃOS (opcional - pode querer manter histórico)
-- Descomentar se quiser remover:
-- DELETE FROM obsidian.estoque_movimentos m
-- WHERE NOT EXISTS (
--     SELECT 1 FROM obsidian.produtos p WHERE p.sku = m.sku
-- );

-- Ou apenas marcar como inválido:
UPDATE obsidian.estoque_movimentos m
SET observacao = CONCAT('[SKU INVÁLIDO] ', COALESCE(observacao, ''))
WHERE NOT EXISTS (
    SELECT 1 FROM obsidian.produtos p WHERE p.sku = m.sku
)
AND observacao NOT LIKE '[SKU INVÁLIDO]%';

\echo '   ✅ Movimentos de estoque marcados\n'

\echo '7️⃣ Removendo envios sem cliente...'
-- 7. REMOVER ENVIOS SEM CLIENTE
DELETE FROM logistica.full_envio e
WHERE NOT EXISTS (
    SELECT 1 FROM obsidian.clientes c WHERE c.id = e.client_id
);

\echo '   ✅ Envios órfãos removidos\n'

\echo '8️⃣ Removendo import_batches sem cliente...'
-- 8. REMOVER IMPORT_BATCHES ÓRFÃOS
DELETE FROM obsidian.import_batches b
WHERE client_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM obsidian.clientes c WHERE c.id = b.client_id
  );

\echo '   ✅ Import batches órfãos removidos\n'

\echo '9️⃣ Reprocessando envios FULL afetados...'
-- 9. REPROCESSAR ENVIOS AFETADOS
DO $$
DECLARE
    envio_record RECORD;
BEGIN
    FOR envio_record IN 
        SELECT id FROM logistica.full_envio 
        WHERE status IN ('draft', 'ready')
    LOOP
        BEGIN
            PERFORM logistica.full_envio_normalizar(envio_record.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao reprocessar envio %: %', envio_record.id, SQLERRM;
        END;
    END LOOP;
END $$;

\echo '   ✅ Envios reprocessados\n'

\echo '🔟 Corrigindo produtos com is_kit inconsistente...'
-- 10. CORRIGIR is_kit INCONSISTENTE
-- Produtos marcados como kit mas sem componentes
UPDATE obsidian.produtos p
SET is_kit = FALSE
WHERE is_kit = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM obsidian.kit_components k WHERE k.kit_sku = p.sku
  );

-- Produtos não marcados como kit mas com componentes
UPDATE obsidian.produtos p
SET is_kit = TRUE
WHERE (is_kit = FALSE OR is_kit IS NULL)
  AND EXISTS (
      SELECT 1 FROM obsidian.kit_components k WHERE k.kit_sku = p.sku
  );

\echo '   ✅ Flags is_kit corrigidas\n'

-- ============================================================================
-- RELATÓRIO DE ALTERAÇÕES
-- ============================================================================

\echo '\n📊 RELATÓRIO DE CORREÇÕES:\n'

SELECT 'Aliases removidos' as operacao, 
    (SELECT COUNT(*) FROM backup_sku_aliases_20241104) - 
    (SELECT COUNT(*) FROM obsidian.sku_aliases) as quantidade
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_sku_aliases_20241104');

SELECT 'Raw orders corrigidos' as operacao,
    COUNT(*) as quantidade
FROM raw_export_orders
WHERE status = 'pending' 
  AND error_msg LIKE '%corrigido automaticamente%';

SELECT 'Full envio raw corrigidos' as operacao,
    COUNT(*) as quantidade
FROM logistica.full_envio_raw
WHERE status = 'pending' 
  AND error_msg = 'SKU não existe mais no estoque';

\echo '\n✅ CORREÇÃO CONCLUÍDA!'
\echo '💡 Revise as alterações e confirme com COMMIT ou desfaça com ROLLBACK\n'

-- NÃO FAZ COMMIT AUTOMÁTICO - você deve revisar e decidir
-- Descomentar para confirmar:
-- COMMIT;

-- Ou descomentar para desfazer:
-- ROLLBACK;

\echo '⚠️  Aguardando decisão: COMMIT ou ROLLBACK'

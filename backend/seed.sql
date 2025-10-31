-- Script de exemplo para popular o banco com dados de teste
-- Execute: psql -U postgres -d fabrica_db -f seed.sql

-- Limpar dados existentes (cuidado em produção!)
TRUNCATE TABLE pagamentos, vendas_itens, vendas, receita_produto, componentes_kit, estoque, materia_prima, clientes CASCADE;

-- Inserir clientes de exemplo
INSERT INTO clientes (id_cliente, nome, documento, telefone, email, observacoes) VALUES
('CLI-001', 'João Silva', '123.456.789-00', '(11) 99999-9999', 'joao@email.com', 'Cliente VIP'),
('CLI-002', 'Maria Santos', '987.654.321-00', '(11) 98888-8888', 'maria@email.com', ''),
('CLI-003', 'Pedro Oliveira', '456.789.123-00', '(11) 97777-7777', 'pedro@email.com', 'Compra sempre no atacado');

-- Inserir produtos no estoque
INSERT INTO estoque (sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario) VALUES
('PROD-001', 'Camiseta Básica', 'Vestuário', 'Simples', 100, 'UN', 39.90),
('PROD-002', 'Calça Jeans', 'Vestuário', 'Simples', 50, 'UN', 129.90),
('PROD-003', 'Jaqueta', 'Vestuário', 'Simples', 30, 'UN', 199.90),
('PROD-004', 'Kit Básico', 'Kits', 'Kit', 20, 'UN', 159.90),
('PROD-005', 'Tênis Esportivo', 'Calçados', 'Simples', 40, 'UN', 249.90);

-- Inserir componentes do kit (Kit Básico = 1 Camiseta + 1 Calça)
INSERT INTO componentes_kit (sku_produto, sku_componente, quantidade_por_kit, preco_unitario) VALUES
('PROD-004', 'PROD-001', 1, 39.90),
('PROD-004', 'PROD-002', 1, 129.90);

-- Inserir matérias-primas
INSERT INTO materia_prima (id_materia_prima, sku_materia_prima, nome_materia_prima, categoria, quantidade_atual, unidade_medida, preco_unitario) VALUES
('MP-001', 'MP-TECIDO-001', 'Tecido Algodão', 'Tecidos', 500, 'M', 25.00),
('MP-002', 'MP-TECIDO-002', 'Tecido Jeans', 'Tecidos', 300, 'M', 45.00),
('MP-003', 'MP-LINHA-001', 'Linha de Costura', 'Aviamentos', 1000, 'M', 0.50),
('MP-004', 'MP-BOTAO-001', 'Botão Plástico', 'Aviamentos', 5000, 'UN', 0.20);

-- Inserir receitas de produtos (composição)
-- Camiseta = 1.5m Tecido Algodão + 50m Linha + 5 Botões
INSERT INTO receita_produto (sku_produto, sku_materia_prima, quantidade_por_produto, unidade_medida) VALUES
('PROD-001', 'MP-TECIDO-001', 1.5, 'M'),
('PROD-001', 'MP-LINHA-001', 50, 'M'),
('PROD-001', 'MP-BOTAO-001', 5, 'UN');

-- Calça Jeans = 2m Tecido Jeans + 80m Linha + 1 Botão
INSERT INTO receita_produto (sku_produto, sku_materia_prima, quantidade_por_produto, unidade_medida) VALUES
('PROD-002', 'MP-TECIDO-002', 2, 'M'),
('PROD-002', 'MP-LINHA-001', 80, 'M'),
('PROD-002', 'MP-BOTAO-001', 1, 'UN');

-- Inserir vendas de exemplo
INSERT INTO vendas (id_venda, data_venda, id_cliente, nome_cliente, valor_total) VALUES
('VEND-20241029-001', '2024-10-25 10:30:00', 'CLI-001', 'João Silva', 169.80),
('VEND-20241029-002', '2024-10-26 14:15:00', 'CLI-002', 'Maria Santos', 329.70),
('VEND-20241029-003', '2024-10-28 09:00:00', 'CLI-003', 'Pedro Oliveira', 599.60);

-- Inserir itens das vendas
INSERT INTO vendas_itens (id_venda, sku_produto, nome_produto, quantidade_vendida, preco_unitario) VALUES
-- Venda 1: 2 Camisetas + 1 Calça
('VEND-20241029-001', 'PROD-001', 'Camiseta Básica', 2, 39.90),
('VEND-20241029-001', 'PROD-002', 'Calça Jeans', 1, 129.90),
-- Venda 2: 1 Kit + 1 Jaqueta
('VEND-20241029-002', 'PROD-004', 'Kit Básico', 1, 159.90),
('VEND-20241029-002', 'PROD-003', 'Jaqueta', 1, 199.90),
-- Venda 3: 2 Tênis + 1 Kit
('VEND-20241029-003', 'PROD-005', 'Tênis Esportivo', 2, 249.90),
('VEND-20241029-003', 'PROD-004', 'Kit Básico', 1, 159.90);

-- Atualizar estoque após vendas
UPDATE estoque SET quantidade_atual = quantidade_atual - 2 WHERE sku = 'PROD-001'; -- 2 vendidas
UPDATE estoque SET quantidade_atual = quantidade_atual - 1 WHERE sku = 'PROD-002'; -- 1 vendida
UPDATE estoque SET quantidade_atual = quantidade_atual - 1 WHERE sku = 'PROD-003'; -- 1 vendida
UPDATE estoque SET quantidade_atual = quantidade_atual - 2 WHERE sku = 'PROD-004'; -- 2 vendidas
UPDATE estoque SET quantidade_atual = quantidade_atual - 2 WHERE sku = 'PROD-005'; -- 2 vendidas

-- Inserir pagamentos
INSERT INTO pagamentos (id_pagamento, data_pagamento, id_cliente, nome_cliente, valor_pago, forma_pagamento, observacoes) VALUES
('PAG-20241029-001', '2024-10-25 11:00:00', 'CLI-001', 'João Silva', 169.80, 'Pix', 'Pagamento à vista'),
('PAG-20241029-002', '2024-10-26 15:00:00', 'CLI-002', 'Maria Santos', 200.00, 'Cartão Crédito', 'Pagamento parcial'),
('PAG-20241029-003', '2024-10-28 10:00:00', 'CLI-003', 'Pedro Oliveira', 300.00, 'Dinheiro', 'Entrada - restante para próxima semana');

-- Verificar dados inseridos
SELECT 'Clientes cadastrados:' as info, COUNT(*) as total FROM clientes
UNION ALL
SELECT 'Produtos no estoque:', COUNT(*) FROM estoque
UNION ALL
SELECT 'Matérias-primas:', COUNT(*) FROM materia_prima
UNION ALL
SELECT 'Vendas realizadas:', COUNT(*) FROM vendas
UNION ALL
SELECT 'Pagamentos recebidos:', COUNT(*) FROM pagamentos;

-- Verificar saldo dos clientes
SELECT 
    c.id_cliente,
    c.nome,
    COALESCE(SUM(vi.subtotal), 0) as total_comprado,
    COALESCE(SUM(p.valor_pago), 0) as total_pago,
    COALESCE(SUM(vi.subtotal), 0) - COALESCE(SUM(p.valor_pago), 0) as saldo_devedor
FROM clientes c
LEFT JOIN vendas v ON c.id_cliente = v.id_cliente
LEFT JOIN vendas_itens vi ON v.id_venda = vi.id_venda
LEFT JOIN pagamentos p ON c.id_cliente = p.id_cliente
GROUP BY c.id_cliente, c.nome
ORDER BY c.id_cliente;

-- Verificar estoque atual
SELECT 
    sku,
    nome_produto,
    categoria,
    quantidade_atual,
    unidade_medida,
    preco_unitario
FROM estoque
ORDER BY categoria, nome_produto;

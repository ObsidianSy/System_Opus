🧠 REGRAS DE NEGÓCIO — OPUS ONE (Versão para Claude Sonnet 4.5)
🔸 1. Contexto Geral

O sistema NÃO é multi-tenant.

Existe apenas um ambiente e um estoque consolidado.

Existem clientes internos (nossas próprias empresas) com controle financeiro independente, mas todos compartilham o mesmo estoque.

Marketplaces (Shopee, Mercado Livre, etc.) são apenas canais de origem da venda, nunca clientes.

Fulfillment externo (como Mercado Fulfillment) é um tipo especial de venda que não interfere no estoque nem no financeiro.

🔹 2. Tipos de Venda
Tipo de Venda	Baixa Estoque	Gera Financeiro	Observação
Venda Normal (não-full)	✅ Sim	✅ Sim	Usa o custo do produto em estoque
Venda Fulfillment (Full)	❌ Não	❌ Não	Já foi contabilizada na expedição; apenas controle informativo
Venda Cancelada	❌ Não	❌ Não	Caso já exista, deve ser removida ao atualizar status para “cancelado”
🔹 3. Importação da UpSeller

Cada cliente interno envia 1 arquivo XLSX diário.

O arquivo é armazenado imutável para auditoria.

Cada linha é registrada com:

Identificador do pedido

SKU

Quantidade

Canal (marketplace)

Status (normal, fulfillment, cancelado)

O sistema deduplica automaticamente:

Reimportar a mesma linha não cria duplicata (idempotência).

Chave de dedupe:
pedido + sku + quantidade + cliente_interno + data.

Linhas com quantidade ≤ 0 são ignoradas.

Pedidos cancelados:

Não geram vendas novas.

Se já existirem vendas registradas, são removidas automaticamente.

Dados da planilha que são ignorados:

Nome do Cliente da planilha → IGNORADO (usamos o cliente interno).

Valor Vendido da planilha → IGNORADO (usamos custo do produto no estoque).

🔹 4. Estoque

Estoque é único e compartilhado.

Pode ficar negativo (sem bloqueio).

Cada produto tem:
sku, nome, categoria, tipo_produto, quantidade_atual, preco_unitario, ativo.

Baixa de estoque:

Só ocorre em vendas normais (não-full).

Fulfillment externo NÃO reduz estoque.

Kits são explodidos em componentes para baixa.

Valor considerado:

Sempre o custo do produto no estoque.

Nunca o preço de venda vindo da UpSeller.

Kits:

is_kit = true

Contém lista componentes [{sku, qty}]

Valor do kit = soma dos custos dos componentes

Baixa individual dos componentes ao vender.

🔹 5. Financeiro

Cada venda normal (não-full) gera saldo devedor para o cliente interno.

O valor da dívida é calculado pelo custo do produto no estoque, não pelo preço de venda.

Vendas fulfillment e canceladas não afetam o financeiro.

Pagamentos:

São registrados apenas quando o cliente interno efetua quitação.

Não são gerados automaticamente ao importar vendas.
(Ou seja: importação gera dívida, não pagamento.)

Chave de idempotência:
md5(data_pagamento | nome_cliente | valor_pago | forma_pagamento)

Evita duplicidade automática.

Caso o cliente pague mais do que devia → gera crédito automático.

Crédito é abatido nas próximas vendas do mesmo cliente interno.

🔹 6. Regras de Aprendizado de SKU

Ao importar, o sistema tenta associar automaticamente cada SKU:

Match direto → SKU idêntico existente.

Match por alias → SKU reconhecido de aprendizado anterior.

Manual → usuário relaciona manualmente (gera novo alias).

Kit-found / kit-autocreate → reconhecido por composição.

Quando o usuário resolve um SKU manualmente, o sistema:

Registra o alias.

Aprenderá automaticamente na próxima importação.

SKUs não reconhecidos entram na fila de pendências até o usuário relacionar.

🔹 7. Auditoria e Idempotência

Todo arquivo importado é guardado como veio (imutável).

Cada linha processada tem:

Data/hora de processamento

Origem (cliente interno, canal, arquivo)

Hash de idempotência.

Reimportar o mesmo arquivo:

Não duplica nada.

Atualiza vendas canceladas.

Todas ações são registradas em activity_logs:

user_email, action, entity_type, entity_id, details, ip_address, user_agent, created_at

🔹 8. Hierarquia de Processamento (ordem correta)

Importar arquivo UpSeller.

Deduplicar (descarta linhas repetidas ou sem quantidade).

Verificar status:

Se cancelado → excluir venda existente.

Se fulfillment → registrar apenas para controle (sem estoque, sem financeiro).

Se normal → registrar venda, gerar saldo devedor, baixar estoque.

Atualizar aliases de SKU se houver manual match.

Gerar logs e relatórios.

🔹 9. Regra de Ouro (⚠️ para IA e dev)

NUNCA contabilizar venda fulfillment como baixa de estoque ou soma no financeiro.
NUNCA usar nome de cliente ou valor de venda da planilha UpSeller.
Sempre usar custo do produto no estoque e cliente interno como base de cálculo.

Se o status mudar para cancelado, a venda deve ser removida integralmente.


E tambem sempre que vc criar algo que use alguma funcionalidade do banco de dados como tabelas principalmente, consulta la pra voce ver como esta o nome pra nao colocar nomes errados nem campos errados colocar exatamente igual ta no BD.

mais uma coisa caso vc tenha alguma duvida nao faca nada, pergunte antes, mas isso somente se vc realmente tiver alguma duvida, se nao pode seguir.
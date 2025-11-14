CREATE TABLE "obsidian"."activity_logs" ( 
  "id" SERIAL,
  "user_email" TEXT NOT NULL,
  "user_name" TEXT NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NULL,
  "entity_id" TEXT NULL,
  "details" JSONB NULL,
  "ip_address" TEXT NULL,
  "user_agent" TEXT NULL,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."clientes" ( 
  "id" SERIAL,
  "nome" TEXT NOT NULL,
  "documento" TEXT NULL,
  "telefone" TEXT NULL,
  "observacoes" TEXT NULL,
  "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  CONSTRAINT "clientes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clientes_nome_key" UNIQUE ("nome")
);
CREATE TABLE "public"."devolucoes" ( 
  "id" SERIAL,
  "pedido_uid" VARCHAR(255) NOT NULL,
  "sku_produto" VARCHAR(255) NOT NULL,
  "quantidade_esperada" INTEGER NOT NULL,
  "quantidade_recebida" INTEGER NULL DEFAULT 0 ,
  "tipo_problema" VARCHAR(100) NULL DEFAULT 'pendente'::character varying ,
  "motivo_cancelamento" TEXT NULL,
  "produto_real_recebido" VARCHAR(255) NULL,
  "conferido_em" TIMESTAMP NULL,
  "conferido_por" VARCHAR(255) NULL,
  "observacoes" TEXT NULL,
  "created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  "updated_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  "codigo_rastreio" VARCHAR(255) NULL,
  CONSTRAINT "devolucoes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "devolucoes_pedido_uid_sku_produto_key" UNIQUE ("pedido_uid", "sku_produto")
);
CREATE TABLE "obsidian"."estoque_movimentos" ( 
  "id" SERIAL,
  "ts" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "sku" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "quantidade" NUMERIC NOT NULL,
  "origem_tabela" TEXT NULL,
  "origem_id" TEXT NULL,
  "observacao" TEXT NULL,
  CONSTRAINT "estoque_movimentos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "logistica"."full_envio" ( 
  "id" SERIAL,
  "client_id" BIGINT NOT NULL,
  "envio_num" TEXT NOT NULL,
  "arquivo_nome" TEXT NULL,
  "status" TEXT NULL DEFAULT 'draft'::text ,
  "tot_itens" INTEGER NULL DEFAULT 0 ,
  "tot_qtd" NUMERIC NULL DEFAULT 0 ,
  "tot_valor_previsto" NUMERIC NULL DEFAULT 0 ,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "emitted_at" TIMESTAMP WITH TIME ZONE NULL,
  "import_date" DATE NULL,
  CONSTRAINT "full_envio_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "full_envio_client_id_envio_num_key" UNIQUE ("client_id", "envio_num")
);
CREATE TABLE "logistica"."full_envio_item" ( 
  "id" SERIAL,
  "envio_id" BIGINT NOT NULL,
  "codigo_ml" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "qtd" NUMERIC NOT NULL,
  "preco_unit_interno" NUMERIC NULL DEFAULT 0 ,
  "valor_total" NUMERIC NULL DEFAULT 0 ,
  "is_kit" BOOLEAN NULL DEFAULT false ,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "full_envio_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "full_envio_item_envio_id_sku_codigo_ml_key" UNIQUE ("envio_id", "sku", "codigo_ml")
);
CREATE TABLE "logistica"."full_envio_raw" ( 
  "id" SERIAL,
  "envio_id" BIGINT NOT NULL,
  "row_num" INTEGER NOT NULL,
  "codigo_ml" TEXT NOT NULL,
  "sku_texto" TEXT NOT NULL,
  "qtd" NUMERIC NOT NULL,
  "matched_sku" TEXT NULL,
  "status" TEXT NULL DEFAULT 'pending'::text ,
  "error_msg" TEXT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "processed_at" TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT "full_envio_raw_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "full_envio_raw_envio_id_row_num_codigo_ml_sku_texto_qtd_key" UNIQUE ("envio_id", "row_num", "codigo_ml", "sku_texto", "qtd")
);
CREATE TABLE "obsidian"."import_batches" ( 
  "import_id" UUID NOT NULL DEFAULT gen_random_uuid() ,
  "client_id" BIGINT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'upseller'::text ,
  "filename" TEXT NULL,
  "total_rows" INTEGER NULL,
  "processed_rows" INTEGER NULL DEFAULT 0 ,
  "status" TEXT NOT NULL DEFAULT 'processing'::text ,
  "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "finished_at" TIMESTAMP WITH TIME ZONE NULL,
  "import_date" DATE NULL,
  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("import_id")
);
CREATE TABLE "obsidian"."kit_components" ( 
  "kit_sku" TEXT NOT NULL,
  "component_sku" TEXT NOT NULL,
  "qty" NUMERIC NOT NULL,
  CONSTRAINT "kit_components_pkey" PRIMARY KEY ("kit_sku", "component_sku")
);
CREATE TABLE "obsidian"."kit_index" ( 
  "sku_kit" TEXT NOT NULL,
  "composition_hash" TEXT NOT NULL,
  CONSTRAINT "kit_index_pkey" PRIMARY KEY ("sku_kit")
);
CREATE TABLE "obsidian"."materia_prima" ( 
  "id" SERIAL,
  "sku_mp" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoria" TEXT NULL,
  "quantidade_atual" NUMERIC NOT NULL DEFAULT 0 ,
  "unidade_medida" TEXT NOT NULL DEFAULT 'UN'::text ,
  "custo_unitario" NUMERIC NOT NULL DEFAULT 0 ,
  "ativo" BOOLEAN NOT NULL DEFAULT true ,
  "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  CONSTRAINT "materia_prima_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "materia_prima_sku_mp_key" UNIQUE ("sku_mp")
);
CREATE TABLE "obsidian"."pagamentos" ( 
  "id" SERIAL,
  "data_pagamento" DATE NOT NULL,
  "cliente_id" BIGINT NULL,
  "nome_cliente" TEXT NULL,
  "valor_pago" NUMERIC NOT NULL,
  "forma_pagamento" TEXT NULL,
  "observacoes" TEXT NULL,
  "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "idempotency_key" TEXT NULL,
  CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."produto_fotos" ( 
  "id" SERIAL,
  "produto_base" VARCHAR(255) NOT NULL,
  "foto_url" TEXT NOT NULL,
  "foto_filename" VARCHAR(255) NULL,
  "foto_size" INTEGER NULL,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  "updated_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "produto_fotos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ux_produto_fotos_base" UNIQUE ("produto_base")
);
CREATE TABLE "obsidian"."produtos" ( 
  "id" SERIAL,
  "sku" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoria" TEXT NULL,
  "tipo_produto" TEXT NOT NULL DEFAULT 'Fabricado'::text ,
  "quantidade_atual" NUMERIC NOT NULL DEFAULT 0 ,
  "unidade_medida" TEXT NOT NULL DEFAULT 'UN'::text ,
  "preco_unitario" NUMERIC NOT NULL DEFAULT 0 ,
  "ativo" BOOLEAN NOT NULL DEFAULT true ,
  "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "kit_bom" JSONB NOT NULL DEFAULT '[]'::jsonb ,
  "is_kit" BOOLEAN NULL,
  "kit_bom_hash" TEXT NULL,
  CONSTRAINT "produtos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "produtos_sku_key" UNIQUE ("sku")
);
CREATE TABLE "public"."raw_export_orders" ( 
  "id" SERIAL,
  "Nº de Pedido da Plataforma" TEXT NULL,
  "Nº de Pedido" TEXT NULL,
  "Plataformas" TEXT NULL,
  "Nome da Loja no UpSeller" TEXT NULL,
  "Estado do Pedido" TEXT NULL,
  "3PL Status" TEXT NULL,
  "Hora do Pedido" TEXT NULL,
  "Hora do Pagamento" TEXT NULL,
  "Horário Programado" TEXT NULL,
  "Impressão da Etiqueta" TEXT NULL,
  "Enviado" TEXT NULL,
  "Horário de Saída" TEXT NULL,
  "Horário da Retirada" TEXT NULL,
  "Hora de Envio" TEXT NULL,
  "Pago" TEXT NULL,
  "Moeda" TEXT NULL,
  "Valor do Pedido" TEXT NULL,
  "Valor Total de Produtos" TEXT NULL,
  "Descontos e Cupons" TEXT NULL,
  "Comissão Total" TEXT NULL,
  "Frete do Comprador" TEXT NULL,
  "Total de Frete" TEXT NULL,
  "Lucro Estimado" TEXT NULL,
  "Notas do Comprador" TEXT NULL,
  "Observações" TEXT NULL,
  "Pós-venda/Cancelado/Devolvido" TEXT NULL,
  "Cancelado por" TEXT NULL,
  "Razão do Cancelamento" TEXT NULL,
  "Nome do Anúncio" TEXT NULL,
  "SKU" TEXT NULL,
  "Variação" TEXT NULL,
  "Link da Imagem" TEXT NULL,
  "Preço de Produto" TEXT NULL,
  "Qtd. do Produto" TEXT NULL,
  "NCM*" TEXT NULL,
  "Origem*" TEXT NULL,
  "Unidade*" TEXT NULL,
  "Imposto*" TEXT NULL,
  "SKU (Armazém)" TEXT NULL,
  "Nome do Produto" TEXT NULL,
  "Custo Médio" TEXT NULL,
  "Custo do Produto" TEXT NULL,
  "Armazém" TEXT NULL,
  "Nome de Comprador" TEXT NULL,
  "ID do Comprador" TEXT NULL,
  "Data de Registração" TEXT NULL,
  "ID da Taxa" TEXT NULL,
  "Nome do Destinatário" TEXT NULL,
  "Celular do Destinatário" TEXT NULL,
  "Telefone do Destinatário" TEXT NULL,
  "Endereço do Destinatário" TEXT NULL,
  "Nome de Empresa" TEXT NULL,
  "IE" TEXT NULL,
  "Endereço 1" TEXT NULL,
  "Endereço 2" TEXT NULL,
  "Número" TEXT NULL,
  "Bairro" TEXT NULL,
  "Cidade" TEXT NULL,
  "Estado" TEXT NULL,
  "CEP" TEXT NULL,
  "País/Região" TEXT NULL,
  "Comprador Designado" TEXT NULL,
  "Método de Envio" TEXT NULL,
  "Nº de Rastreio" TEXT NULL,
  "Método de coletar" TEXT NULL,
  "Etiqueta" TEXT NULL,
  "client_id" BIGINT NOT NULL,
  "import_id" UUID NOT NULL DEFAULT gen_random_uuid() ,
  "original_filename" TEXT NULL,
  "row_num" INTEGER NULL,
  "order_id" TEXT NULL,
  "order_date" TIMESTAMP WITH TIME ZONE NULL,
  "sku_text" TEXT NULL,
  "qty" NUMERIC NULL,
  "unit_price" NUMERIC NULL,
  "total" NUMERIC NULL,
  "customer" TEXT NULL,
  "channel" TEXT NULL,
  "matched_sku" TEXT NULL,
  "match_score" NUMERIC NULL,
  "match_source" TEXT NULL,
  "status" TEXT NULL DEFAULT 'pending'::text ,
  "error_msg" TEXT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() ,
  "processed_at" TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT "raw_export_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "raw_export_orders_dedupe_ui" UNIQUE ("client_id", "Nº de Pedido da Plataforma", "sku_text", "qty", "unit_price")
);
CREATE TABLE "obsidian"."raw_match" ( 
  "raw_id" BIGINT NOT NULL,
  "client_id" INTEGER NOT NULL,
  "stock_sku" TEXT NULL,
  "match_score" NUMERIC NULL,
  "method" TEXT NULL,
  "alias_id" BIGINT NULL,
  "matched_by" TEXT NULL,
  "matched_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "raw_match_pkey" PRIMARY KEY ("raw_id")
);
CREATE TABLE "obsidian"."receita_produto" ( 
  "id" SERIAL,
  "sku_produto" TEXT NOT NULL,
  "sku_mp" TEXT NOT NULL,
  "quantidade_por_produto" NUMERIC NOT NULL,
  "unidade_medida" TEXT NOT NULL DEFAULT 'UN'::text ,
  "valor_unitario" NUMERIC NOT NULL DEFAULT 0 ,
  CONSTRAINT "receita_produto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "uq_receita" UNIQUE ("sku_produto", "sku_mp")
);
CREATE TABLE "obsidian"."roles" ( 
  "id" SERIAL,
  "nome" TEXT NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_nome_key" UNIQUE ("nome")
);
CREATE TABLE "obsidian"."sku_aliases" ( 
  "id" SERIAL,
  "client_id" BIGINT NOT NULL,
  "alias_text" TEXT NOT NULL,
  "stock_sku" TEXT NOT NULL,
  "confidence_default" NUMERIC NULL DEFAULT 0.90 ,
  "times_used" INTEGER NULL DEFAULT 0 ,
  "last_used_at" TIMESTAMP WITH TIME ZONE NULL,
  "created_by" BIGINT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "sku_aliases_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "obsidian"."usuario_roles" ( 
  "usuario_id" UUID NOT NULL,
  "role_id" INTEGER NOT NULL,
  CONSTRAINT "usuario_roles_pkey" PRIMARY KEY ("usuario_id", "role_id")
);
CREATE TABLE "public"."usuarios" ( 
  "id" SERIAL,
  "nome" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "senha_hash" VARCHAR(255) NOT NULL,
  "ativo" BOOLEAN NULL DEFAULT true ,
  "created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  "updated_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id", "id", "id", "id"),
  CONSTRAINT "usuarios_email_key" UNIQUE ("email")
);
CREATE TABLE "obsidian"."usuarios" ( 
  "id" UUID NOT NULL DEFAULT gen_random_uuid() ,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senha_hash" TEXT NOT NULL,
  "ativo" BOOLEAN NULL DEFAULT true ,
  "criado_em" TIMESTAMP NULL DEFAULT now() ,
  "cargo" VARCHAR(20) NULL DEFAULT 'operador'::character varying ,
  "created_at" TIMESTAMP NULL DEFAULT now() ,
  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id", "id"),
  CONSTRAINT "usuarios_email_key" UNIQUE ("email")
);
CREATE TABLE "obsidian"."vendas" ( 
  "data_venda" DATE NOT NULL,
  "nome_cliente" TEXT NOT NULL,
  "sku_produto" TEXT NOT NULL,
  "quantidade_vendida" NUMERIC NOT NULL,
  "preco_unitario" NUMERIC NOT NULL,
  "valor_total" NUMERIC NOT NULL,
  "ext_id" TEXT NULL,
  "nome_produto" TEXT NULL,
  "canal" TEXT NULL,
  "criado_em" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "pedido_uid" TEXT NULL,
  "venda_id" SERIAL,
  "fulfillment_ext" BOOLEAN NULL DEFAULT false ,
  "raw_id" BIGINT NULL,
  "import_id" UUID NULL,
  "status_venda" TEXT NULL,
  "client_id" INTEGER NULL,
  "codigo_ml" TEXT NULL,
  CONSTRAINT "vendas_pkey" PRIMARY KEY ("venda_id"),
  CONSTRAINT "vendas_ext_id_uk" UNIQUE ("ext_id"),
  CONSTRAINT "vendas_ext_id" UNIQUE ("ext_id"),
  CONSTRAINT "vendas_raw_id_uk" UNIQUE ("raw_id"),
  CONSTRAINT "vendas_dedupe" UNIQUE ("pedido_uid", "sku_produto")
);
ALTER TABLE "logistica"."full_envio_item" ADD CONSTRAINT "full_envio_item_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "logistica"."full_envio" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "logistica"."full_envio_raw" ADD CONSTRAINT "full_envio_raw_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "logistica"."full_envio" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."pagamentos" ADD CONSTRAINT "pagamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "obsidian"."clientes" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."raw_match" ADD CONSTRAINT "fk_raw_match_raw" FOREIGN KEY ("raw_id") REFERENCES "public"."raw_export_orders" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."receita_produto" ADD CONSTRAINT "fk_receita_produto__mp" FOREIGN KEY ("sku_mp") REFERENCES "obsidian"."materia_prima" ("sku_mp") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obsidian"."receita_produto" ADD CONSTRAINT "fk_receita_produto_prod" FOREIGN KEY ("sku_produto") REFERENCES "obsidian"."produtos" ("sku") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "obsidian"."usuario_roles" ADD CONSTRAINT "usuario_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "obsidian"."roles" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "obsidian"."vendas" ADD CONSTRAINT "fk_vendas_client" FOREIGN KEY ("client_id") REFERENCES "obsidian"."clientes" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE FUNCTION "obsidian"."ajustar_estoque_update_venda"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

      DECLARE
        v_diferenca NUMERIC;
      BEGIN
        -- Se quantidade mudou, ajustar estoque
        IF OLD.quantidade_vendida <> NEW.quantidade_vendida THEN
          v_diferenca := NEW.quantidade_vendida - OLD.quantidade_vendida;
          
          -- Registrar movimento da diferença (negativo para baixar estoque)
          INSERT INTO obsidian.estoque_movimentos (
            sku, 
            tipo, 
            quantidade, 
            origem_tabela, 
            origem_id, 
            observacao
          )
          VALUES (
            NEW.sku_produto,
            'venda_ajuste',
            0 - v_diferenca,  -- Movimento negativo (baixa)
            'vendas',
            NEW.venda_id::text,
            CONCAT('Ajuste pedido ', COALESCE(NEW.pedido_uid,'-'), ' de ', OLD.quantidade_vendida, ' para ', NEW.quantidade_vendida, ' (+', v_diferenca, ')')
          );
          
          -- Atualizar estoque diretamente
          UPDATE obsidian.produtos p
          SET quantidade_atual = p.quantidade_atual - v_diferenca,
              atualizado_em = now()
          WHERE p.sku = NEW.sku_produto;
        END IF;
        
        RETURN NEW;
      END;
      
$$;
CREATE FUNCTION "public"."armor"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
pg_armor
$$;
CREATE FUNCTION "obsidian"."assert_kit_tipo"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

begin
if not exists (
select 1
from obsidian.produtos p
where p.sku = new.sku_kit
and upper(p.tipo_produto) = 'KIT'
) then
raise exception 'sku_kit % não é Tipo de Produto = KIT', new.sku_kit;
end if;
return new;
end 
$$;
CREATE FUNCTION "obsidian"."baixar_estoque_fn"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
IF EXISTS (
SELECT 1 FROM obsidian.vendas v
WHERE v.venda_id = NEW.venda_id
AND COALESCE(v.fulfillment_ext, false)
) THEN
RETURN NEW;
END IF;

UPDATE obsidian.produtos p
SET quantidade_atual = COALESCE(p.quantidade_atual,0) - COALESCE(NEW.quantidade_vendida,0),
atualizado_em = now()
WHERE p.sku = NEW.sku_produto;

RETURN NEW;
END;

$$;
CREATE FUNCTION "obsidian"."baixar_estoque_kit_aware"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
IF COALESCE(NEW.fulfillment_ext, false) THEN
RETURN NEW;
END IF;

INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
SELECT
e.sku_baixa,
'venda'::text,
0 - e.qtd_baixa,   -- movimento negativo
'vendas',
NEW.venda_id::text,
CONCAT('Pedido ', COALESCE(NEW.pedido_uid,'-'), ' / Canal ', COALESCE(NEW.canal,'-'))
FROM obsidian.v_vendas_expandidas_json e
WHERE e.venda_id = NEW.venda_id;

UPDATE obsidian.produtos p
SET quantidade_atual = p.quantidade_atual + m.soma_qtd,
atualizado_em = now()
FROM (
SELECT sku, SUM(quantidade) AS soma_qtd
FROM obsidian.estoque_movimentos
WHERE origem_tabela = 'vendas'
AND origem_id = NEW.venda_id::text
GROUP BY sku
) m
WHERE p.sku = m.sku;

RETURN NEW;
END;

$$;
CREATE FUNCTION "public"."crypt"() RETURNS TEXT LANGUAGE C
AS
$$
pg_crypt
$$;
CREATE FUNCTION "public"."dearmor"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_dearmor
$$;
CREATE FUNCTION "public"."decrypt"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_decrypt
$$;
CREATE FUNCTION "public"."decrypt_iv"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_decrypt_iv
$$;
CREATE FUNCTION "public"."digest"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pg_digest
$$;
CREATE FUNCTION "obsidian"."emitir_vendas_de_import"(IN p_import_id UUID, OUT vendas_criadas INTEGER, OUT matched_direct INTEGER, OUT matched_alias INTEGER, OUT pendentes INTEGER) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
v_matched_direct integer;
v_matched_alias integer;
v_vendas integer;
v_pendentes integer;
BEGIN
UPDATE public.raw_export_orders r
SET matched_sku = upper(trim(r."SKU")),
match_score = 1.0,
match_source = 'direct',
status = 'matched',
processed_at = now()
WHERE r.import_id = p_import_id
AND COALESCE(r.matched_sku,'') = ''
AND EXISTS (
SELECT 1 FROM obsidian.produtos p
WHERE p.sku = upper(trim(r."SKU"))
);
GET DIAGNOSTICS v_matched_direct = ROW_COUNT;

UPDATE public.raw_export_orders r
SET matched_sku = a.stock_sku,
match_score = COALESCE(a.confidence_default, 0.9),
match_source = 'alias',
status = 'matched',
processed_at = now()
FROM obsidian.sku_aliases a
WHERE r.import_id = p_import_id
AND r.client_id = a.client_id
AND COALESCE(r.matched_sku,'') = ''
AND upper(trim(r."SKU")) = upper(trim(a.alias_text));
GET DIAGNOSTICS v_matched_alias = ROW_COUNT;

INSERT INTO obsidian.vendas (
data_venda, nome_cliente, sku_produto, quantidade_vendida,
preco_unitario, valor_total, nome_produto, canal, pedido_uid, fulfillment_ext
)
SELECT
COALESCE(v."Hora do Pedido__ts", CURRENT_DATE)::date,
r.customer,
r.matched_sku,
COALESCE(r.qty, 1),
COALESCE(r.unit_price, 0),
COALESCE(r.total, 0),
r."Nome do Produto",
r.channel,
r.order_id,
true -- fulfillment externo, não baixa estoque
FROM public.raw_export_orders r
LEFT JOIN public.vw_export_orders_parsed v ON v.id = r.id
WHERE r.import_id = p_import_id
AND r.status = 'matched'
AND r.matched_sku IS NOT NULL
ON CONFLICT (data_venda, nome_cliente, sku_produto, quantidade_vendida, preco_unitario)
DO NOTHING;
GET DIAGNOSTICS v_vendas = ROW_COUNT;

SELECT COUNT(*) INTO v_pendentes
FROM public.raw_export_orders
WHERE import_id = p_import_id
AND COALESCE(matched_sku, '') = '';

RETURN QUERY SELECT v_vendas, v_matched_direct, v_matched_alias, v_pendentes;
END;

$$;
CREATE FUNCTION "public"."encrypt"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_encrypt
$$;
CREATE FUNCTION "public"."encrypt_iv"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_encrypt_iv
$$;
CREATE FUNCTION "obsidian"."extrair_produto_base"(IN sku TEXT) RETURNS TEXT LANGUAGE PLPGSQL
AS
$$

DECLARE
    sku_upper TEXT;
    sku_clean TEXT;
BEGIN
    -- Converter para maiúsculas e remover espaços
    sku_upper := UPPER(TRIM(sku));
    
    -- Remover tamanhos do final:
    -- Números: ATR-AZL-37 → ATR-AZL, CH202-PRETO-40 → CH202-PRETO
    -- Letras: H302-PTO-P → H302-PTO, CH202-PRETO-M → CH202-PRETO
    -- Combinação: ATR-AZL-37P → ATR-AZL
    sku_clean := REGEXP_REPLACE(sku_upper, '-?[0-9]*[PPMGXS]+$', '');
    sku_clean := REGEXP_REPLACE(sku_clean, '-?\d+$', '');
    
    -- Remover traço final se sobrou
    sku_clean := REGEXP_REPLACE(sku_clean, '-$', '');
    
    RETURN sku_clean;
END;

$$;
CREATE FUNCTION "ui"."fn_full_relacionar_e_emitir"(IN p_full_raw_id BIGINT, IN p_stock_sku TEXT, IN p_alias_text TEXT, IN p_user TEXT, OUT ok BOOLEAN, OUT envio_id BIGINT) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

declare
v_envio_id logistica.full_envio.id%type;
v_client   logistica.full_envio.client_id%type;
v_alias    text;
begin
update logistica.full_envio_raw r
set matched_sku  = p_stock_sku,
status       = 'matched',
processed_at = now()
where r.id = p_full_raw_id
returning r.envio_id into v_envio_id;

if v_envio_id is null then
return query select false, null; return;
end if;

select fe.client_id into v_client from logistica.full_envio fe where fe.id = v_envio_id;

select coalesce(nullif(p_alias_text,''), fr.sku_texto)
into v_alias
from logistica.full_envio_raw fr
where fr.id = p_full_raw_id;

perform obsidian.fn_upsert_sku_alias(v_client, v_alias, p_stock_sku);

perform logistica.full_envio_emitir(v_envio_id);

return query select true, v_envio_id;
end
$$;
CREATE FUNCTION "obsidian"."fn_guard_kit_components"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

DECLARE
v_tipo_kit  text;
v_tipo_comp text;
BEGIN
SELECT upper(p.tipo_produto) INTO v_tipo_kit
FROM obsidian.produtos p
WHERE p.sku = NEW.kit_sku;

IF v_tipo_kit IS DISTINCT FROM 'KIT' THEN
RAISE EXCEPTION 'kit_sku % não é Tipo=KIT', NEW.kit_sku;
END IF;

SELECT upper(p.tipo_produto) INTO v_tipo_comp
FROM obsidian.produtos p
WHERE p.sku = NEW.component_sku;

IF v_tipo_comp IS NULL THEN
RAISE EXCEPTION 'Componente % não existe em produtos', NEW.component_sku;
END IF;

IF v_tipo_comp = 'KIT' THEN
RAISE EXCEPTION 'Componente % não pode ser KIT (sem kit dentro de kit no MVP)', NEW.component_sku;
END IF;

RETURN NEW;
END 
$$;
CREATE FUNCTION "obsidian"."fn_refresh_kit_index"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

DECLARE v_sku text;
BEGIN
v_sku := COALESCE(NEW.kit_sku, OLD.kit_sku);
INSERT INTO obsidian.kit_index (sku_kit, composition_hash)
VALUES (v_sku, obsidian.kit_composition_hash(v_sku))
ON CONFLICT (sku_kit) DO UPDATE
SET composition_hash = EXCLUDED.composition_hash;
RETURN NULL;
END 
$$;
CREATE FUNCTION "obsidian"."fn_upsert_sku_alias"(IN p_client_id BIGINT, IN p_alias_text TEXT, IN p_stock_sku TEXT) RETURNS VOID LANGUAGE PLPGSQL
AS
$$

begin
insert into obsidian.sku_aliases (client_id, alias_text, stock_sku, confidence_default, times_used, last_used_at)
values (p_client_id, p_alias_text, p_stock_sku, 0.95, 1, now())
on conflict (client_id, upper(btrim(alias_text)))
do update set
stock_sku          = excluded.stock_sku,
confidence_default = greatest(obsidian.sku_aliases.confidence_default, excluded.confidence_default),
times_used         = coalesce(obsidian.sku_aliases.times_used,0) + 1,
last_used_at       = now();
end
$$;
CREATE FUNCTION "logistica"."full_envio_add_raw"(IN p_envio_id BIGINT, IN p_rows JSONB) RETURNS INTEGER LANGUAGE PLPGSQL
AS
$$

DECLARE v_count INTEGER := 0; v_rec JSONB;
BEGIN
FOR v_rec IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
BEGIN
INSERT INTO logistica.full_envio_raw (envio_id, row_num, codigo_ml, sku_texto, qtd)
VALUES (
p_envio_id,
COALESCE((v_rec->>'row_num')::INT, 0),
TRIM(v_rec->>'codigo_ml'),
UPPER(TRIM(v_rec->>'sku_texto')),
(v_rec->>'qtd')::NUMERIC
)
ON CONFLICT (envio_id, row_num, codigo_ml, sku_texto, qtd) DO NOTHING;
v_count := v_count + 1;
EXCEPTION WHEN OTHERS THEN
INSERT INTO logistica.full_envio_raw (envio_id, row_num, codigo_ml, sku_texto, qtd, status, error_msg)
VALUES (
p_envio_id,
COALESCE((v_rec->>'row_num')::INT, 0),
TRIM(v_rec->>'codigo_ml'),
UPPER(TRIM(v_rec->>'sku_texto')),
(v_rec->>'qtd')::NUMERIC,
'error', SQLERRM
)
ON CONFLICT DO NOTHING;
END;
END LOOP;
RETURN v_count;
END;
$$;
CREATE FUNCTION "logistica"."full_envio_emitir"(IN p_envio_id BIGINT, IN p_data DATE) RETURNS VOID LANGUAGE PLPGSQL
AS
$$

DECLARE
    r RECORD;
    comp RECORD;
    v_valor NUMERIC(18,2);
    v_client BIGINT;
    v_cliente_nome TEXT;
    v_envio_num TEXT;
    v_pedido_uid TEXT;
    v_items_emitted INT := 0;
    v_items_pending INT := 0;
BEGIN
    -- Buscar informações do envio
    SELECT fe.client_id, c.nome, fe.envio_num
    INTO v_client, v_cliente_nome, v_envio_num
    FROM logistica.full_envio fe
    JOIN obsidian.clientes c ON c.id = fe.client_id
    WHERE fe.id = p_envio_id
    FOR UPDATE;

    IF v_client IS NULL THEN
        RAISE EXCEPTION 'Envio % não encontrado ou sem cliente vinculado', p_envio_id;
    END IF;

    -- ✅ REMOVIDO: Validação de pendências
    -- Agora apenas conta os pendentes para informação
    SELECT COUNT(*) INTO v_items_pending
    FROM logistica.full_envio_raw
    WHERE envio_id = p_envio_id AND status = 'pending';

    -- Validar se há pelo menos 1 item relacionado
    SELECT COUNT(*) INTO v_items_emitted
    FROM logistica.full_envio_item
    WHERE envio_id = p_envio_id;

    IF v_items_emitted = 0 THEN
        RAISE EXCEPTION 'Nenhum item relacionado para emitir. Relacione pelo menos um SKU.';
    END IF;

    -- Processar cada item do envio (apenas os relacionados)
    FOR r IN SELECT * FROM logistica.full_envio_item WHERE envio_id = p_envio_id LOOP
        
        -- Gerar pedido_uid único: ENVIO_NUM-CODIGO_ML
        v_pedido_uid := CONCAT(v_envio_num, '-', COALESCE(r.codigo_ml, r.id::text));
        
        -- Criar movimento de estoque
        INSERT INTO obsidian.estoque_movimentos (
            sku, tipo, quantidade, origem_tabela, origem_id, observacao
        )
        VALUES (
            r.sku,
            'saida_full',
            0 - r.qtd,
            'full_envio_item',
            r.id::text,
            CONCAT('Envio FULL ', p_envio_id, ' - ', v_pedido_uid)
        )
        ON CONFLICT DO NOTHING;

        -- Atualizar quantidade em produtos (se movimento foi criado)
        IF NOT EXISTS (
            SELECT 1 FROM obsidian.estoque_movimentos
            WHERE origem_tabela='full_envio_item' AND origem_id=r.id::text
        ) THEN
            UPDATE obsidian.produtos
            SET quantidade_atual = COALESCE(quantidade_atual, 0) - r.qtd,
                atualizado_em = NOW()
            WHERE sku = r.sku;
        END IF;

        -- Se for kit, processar componentes
        IF r.is_kit THEN
            FOR comp IN
                SELECT component_sku, qty FROM obsidian.kit_components WHERE kit_sku = r.sku
            LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM obsidian.estoque_movimentos
                    WHERE origem_tabela='full_envio_item'
                      AND origem_id=r.id::text
                      AND sku=comp.component_sku
                ) THEN
                    INSERT INTO obsidian.estoque_movimentos (
                        sku, tipo, quantidade, origem_tabela, origem_id, observacao
                    )
                    VALUES (
                        comp.component_sku,
                        'saida_full',
                        0 - (r.qtd * comp.qty),
                        'full_envio_item',
                        r.id::text,
                        CONCAT('Kit ', r.sku, ' - ', v_pedido_uid)
                    );

                    UPDATE obsidian.produtos
                    SET quantidade_atual = COALESCE(quantidade_atual, 0) - (r.qtd * comp.qty),
                        atualizado_em = NOW()
                    WHERE sku = comp.component_sku;
                END IF;
            END LOOP;
        END IF;

        -- Criar venda (COM pedido_uid agora!)
        IF NOT EXISTS (
            SELECT 1 FROM obsidian.vendas
            WHERE canal = 'FULL-INBOUND'
              AND nome_cliente = v_cliente_nome
              AND sku_produto = r.sku
              AND data_venda = p_data
              AND pedido_uid = v_pedido_uid
        ) THEN
            INSERT INTO obsidian.vendas (
                pedido_uid,
                data_venda,
                nome_cliente,
                sku_produto,
                quantidade_vendida,
                preco_unitario,
                valor_total,
                nome_produto,
                canal,
                fulfillment_ext
            )
            SELECT
                v_pedido_uid,
                p_data,
                v_cliente_nome,
                r.sku,
                r.qtd,
                COALESCE(r.preco_unit_interno, 0),
                COALESCE(r.preco_unit_interno, 0) * r.qtd,
                p.nome,
                'FULL-INBOUND',
                FALSE
            FROM obsidian.produtos p
            WHERE p.sku = r.sku;
        END IF;

    END LOOP;

    -- Atualizar status do envio
    -- Se ainda há pendentes, marca como 'partial', senão 'registrado'
    UPDATE logistica.full_envio
    SET status = CASE 
            WHEN v_items_pending > 0 THEN 'partial'
            ELSE 'registrado'
        END,
        emitted_at = NOW()
    WHERE id = p_envio_id;

    -- Log informativo
    RAISE NOTICE 'Envio % emitido: % itens processados, % itens ainda pendentes', 
        v_envio_num, v_items_emitted, v_items_pending;

END;

$$;
CREATE FUNCTION "logistica"."full_envio_normalizar"(IN p_envio_id BIGINT) RETURNS VOID LANGUAGE PLPGSQL
AS
$$

DECLARE r RECORD; v_sku TEXT; v_preco NUMERIC(18,2); v_is_kit BOOLEAN;
BEGIN
FOR r IN
SELECT * FROM logistica.full_envio_raw
WHERE envio_id = p_envio_id AND status IN ('pending','error')
LOOP
v_sku := NULL; v_preco := 0; v_is_kit := FALSE;

SELECT p.sku, p.preco_unitario, COALESCE(p.is_kit, FALSE)
INTO v_sku, v_preco, v_is_kit
FROM obsidian.produtos p
WHERE UPPER(p.sku) = UPPER(TRIM(r.sku_texto))
LIMIT 1;

IF v_sku IS NULL THEN
SELECT a.stock_sku, p.preco_unitario, COALESCE(p.is_kit, FALSE)
INTO v_sku, v_preco, v_is_kit
FROM obsidian.sku_aliases a
JOIN obsidian.produtos p ON p.sku = a.stock_sku
WHERE UPPER(a.alias_text) = UPPER(TRIM(r.sku_texto))
LIMIT 1;
END IF;

IF v_sku IS NULL THEN
UPDATE logistica.full_envio_raw
SET status='pending', error_msg='SKU não reconhecido'
WHERE id=r.id;
ELSE
INSERT INTO logistica.full_envio_item (envio_id, codigo_ml, sku, qtd, is_kit, preco_unit_interno, valor_total)
VALUES (r.envio_id, r.codigo_ml, v_sku, r.qtd, v_is_kit, v_preco, v_preco * r.qtd)
ON CONFLICT (envio_id, sku, codigo_ml)
DO UPDATE SET qtd = logistica.full_envio_item.qtd + EXCLUDED.qtd;

UPDATE logistica.full_envio_raw
SET matched_sku = v_sku,
status='matched',
processed_at = now(),
error_msg=NULL
WHERE id=r.id;
END IF;
END LOOP;

UPDATE logistica.full_envio fe
SET tot_itens = sub.cnt,
tot_qtd = sub.sum_qtd,
tot_valor_previsto = sub.sum_val,
status = CASE WHEN EXISTS (
SELECT 1 FROM logistica.full_envio_raw
WHERE envio_id=p_envio_id AND status='pending'
) THEN 'draft' ELSE 'ready' END
FROM (
SELECT envio_id, COUNT(*) cnt, SUM(qtd) sum_qtd, SUM(valor_total) sum_val
FROM logistica.full_envio_item WHERE envio_id=p_envio_id GROUP BY envio_id
) sub
WHERE fe.id=sub.envio_id;
END;
$$;
CREATE FUNCTION "logistica"."full_envio_upsert"(IN p_client_id BIGINT, IN p_envio_num TEXT, IN p_arquivo_nome TEXT) RETURNS BIGINT LANGUAGE PLPGSQL
AS
$$

DECLARE v_id BIGINT;
BEGIN
INSERT INTO logistica.full_envio (client_id, envio_num, arquivo_nome)
VALUES (p_client_id, p_envio_num, p_arquivo_nome)
ON CONFLICT (client_id, envio_num)
DO UPDATE SET arquivo_nome = EXCLUDED.arquivo_nome
RETURNING id INTO v_id;
RETURN v_id;
END;
$$;
CREATE FUNCTION "public"."gen_random_bytes"() RETURNS BYTEA LANGUAGE C
AS
$$
pg_random_bytes
$$;
CREATE FUNCTION "public"."gen_random_uuid"() RETURNS UUID LANGUAGE C
AS
$$
pg_random_uuid
$$;
CREATE FUNCTION "public"."gen_salt"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
pg_gen_salt_rounds
$$;
CREATE FUNCTION "public"."gin_extract_query_trgm"() RETURNS INTERNAL LANGUAGE C
AS
$$
gin_extract_query_trgm
$$;
CREATE FUNCTION "public"."gin_extract_value_trgm"() RETURNS INTERNAL LANGUAGE C
AS
$$
gin_extract_value_trgm
$$;
CREATE FUNCTION "public"."gin_trgm_consistent"() RETURNS BOOLEAN LANGUAGE C
AS
$$
gin_trgm_consistent
$$;
CREATE FUNCTION "public"."gin_trgm_triconsistent"() RETURNS "CHAR" LANGUAGE C
AS
$$
gin_trgm_triconsistent
$$;
CREATE FUNCTION "public"."gtrgm_compress"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_compress
$$;
CREATE FUNCTION "public"."gtrgm_consistent"() RETURNS BOOLEAN LANGUAGE C
AS
$$
gtrgm_consistent
$$;
CREATE FUNCTION "public"."gtrgm_decompress"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_decompress
$$;
CREATE FUNCTION "public"."gtrgm_distance"() RETURNS DOUBLE PRECISION LANGUAGE C
AS
$$
gtrgm_distance
$$;
CREATE FUNCTION "public"."gtrgm_in"() RETURNS USER-DEFINED LANGUAGE C
AS
$$
gtrgm_in
$$;
CREATE FUNCTION "public"."gtrgm_options"() RETURNS VOID LANGUAGE C
AS
$$
gtrgm_options
$$;
CREATE FUNCTION "public"."gtrgm_out"() RETURNS CSTRING LANGUAGE C
AS
$$
gtrgm_out
$$;
CREATE FUNCTION "public"."gtrgm_penalty"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_penalty
$$;
CREATE FUNCTION "public"."gtrgm_picksplit"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_picksplit
$$;
CREATE FUNCTION "public"."gtrgm_same"() RETURNS INTERNAL LANGUAGE C
AS
$$
gtrgm_same
$$;
CREATE FUNCTION "public"."gtrgm_union"() RETURNS USER-DEFINED LANGUAGE C
AS
$$
gtrgm_union
$$;
CREATE FUNCTION "public"."hmac"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pg_hmac
$$;
CREATE FUNCTION "obsidian"."immutable_unaccent"() RETURNS TEXT LANGUAGE SQL
AS
$$
 SELECT unaccent('public.unaccent', $1) 
$$;
CREATE FUNCTION "public"."import_raw_export_orders"(IN _rows JSONB) RETURNS INTEGER LANGUAGE SQL
AS
$$

WITH ins AS (
INSERT INTO public."raw_export_orders" (
"Nº de Pedido da Plataforma",
"Nº de Pedido",
"Plataformas",
"Nome da Loja no UpSeller",
"Estado do Pedido",
"3PL Status",
"Hora do Pedido",
"Hora do Pagamento",
"Horário Programado",
"Impressão da Etiqueta",
"Enviado",
"Horário de Saída",
"Horário da Retirada",
"Hora de Envio",
"Pago",
"Moeda",
"Valor do Pedido",
"Valor Total de Produtos",
"Descontos e Cupons",
"Comissão Total",
"Frete do Comprador",
"Total de Frete",
"Lucro Estimado",
"Notas do Comprador",
"Observações",
"Pós-venda/Cancelado/Devolvido",
"Cancelado por",
"Razão do Cancelamento",
"Nome do Anúncio",
"SKU",
"Variação",
"Link da Imagem",
"Preço de Produto",
"Qtd. do Produto",
"NCM*",
"Origem*",
"Unidade*",
"Imposto*",
"SKU (Armazém)",
"Nome do Produto",
"Custo Médio",
"Custo do Produto",
"Armazém",
"Nome de Comprador",
"ID do Comprador",
"Data de Registração",
"ID da Taxa",
"Nome do Destinatário",
"Celular do Destinatário",
"Telefone do Destinatário",
"Endereço do Destinatário",
"Nome de Empresa",
"IE",
"Endereço 1",
"Endereço 2",
"Número",
"Bairro",
"Cidade",
"Estado",
"CEP",
"País/Região",
"Comprador Designado",
"Método de Envio",
"Nº de Rastreio",
"Método de coletar",
"Etiqueta"
)
SELECT
r."Nº de Pedido da Plataforma",
r."Nº de Pedido",
r."Plataformas",
r."Nome da Loja no UpSeller",
r."Estado do Pedido",
r."3PL Status",
r."Hora do Pedido",
r."Hora do Pagamento",
r."Horário Programado",
r."Impressão da Etiqueta",
r."Enviado",
r."Horário de Saída",
r."Horário da Retirada",
r."Hora de Envio",
r."Pago",
r."Moeda",
r."Valor do Pedido",
r."Valor Total de Produtos",
r."Descontos e Cupons",
r."Comissão Total",
r."Frete do Comprador",
r."Total de Frete",
r."Lucro Estimado",
r."Notas do Comprador",
r."Observações",
r."Pós-venda/Cancelado/Devolvido",
r."Cancelado por",
r."Razão do Cancelamento",
r."Nome do Anúncio",
r."SKU",
r."Variação",
r."Link da Imagem",
r."Preço de Produto",
r."Qtd. do Produto",
r."NCM*",
r."Origem*",
r."Unidade*",
r."Imposto*",
r."SKU (Armazém)",
r."Nome do Produto",
r."Custo Médio",
r."Custo do Produto",
r."Armazém",
r."Nome de Comprador",
r."ID do Comprador",
r."Data de Registração",
r."ID da Taxa",
r."Nome do Destinatário",
r."Celular do Destinatário",
r."Telefone do Destinatário",
r."Endereço do Destinatário",
r."Nome de Empresa",
r."IE",
r."Endereço 1",
r."Endereço 2",
r."Número",
r."Bairro",
r."Cidade",
r."Estado",
r."CEP",
r."País/Região",
r."Comprador Designado",
r."Método de Envio",
r."Nº de Rastreio",
r."Método de coletar",
r."Etiqueta"
FROM jsonb_to_recordset(_rows) AS r(
"Nº de Pedido da Plataforma" text,
"Nº de Pedido" text,
"Plataformas" text,
"Nome da Loja no UpSeller" text,
"Estado do Pedido" text,
"3PL Status" text,
"Hora do Pedido" text,
"Hora do Pagamento" text,
"Horário Programado" text,
"Impressão da Etiqueta" text,
"Enviado" text,
"Horário de Saída" text,
"Horário da Retirada" text,
"Hora de Envio" text,
"Pago" text,
"Moeda" text,
"Valor do Pedido" text,
"Valor Total de Produtos" text,
"Descontos e Cupons" text,
"Comissão Total" text,
"Frete do Comprador" text,
"Total de Frete" text,
"Lucro Estimado" text,
"Notas do Comprador" text,
"Observações" text,
"Pós-venda/Cancelado/Devolvido" text,
"Cancelado por" text,
"Razão do Cancelamento" text,
"Nome do Anúncio" text,
"SKU" text,
"Variação" text,
"Link da Imagem" text,
"Preço de Produto" text,
"Qtd. do Produto" text,
"NCM*" text,
"Origem*" text,
"Unidade*" text,
"Imposto*" text,
"SKU (Armazém)" text,
"Nome do Produto" text,
"Custo Médio" text,
"Custo do Produto" text,
"Armazém" text,
"Nome de Comprador" text,
"ID do Comprador" text,
"Data de Registração" text,
"ID da Taxa" text,
"Nome do Destinatário" text,
"Celular do Destinatário" text,
"Telefone do Destinatário" text,
"Endereço do Destinatário" text,
"Nome de Empresa" text,
"IE" text,
"Endereço 1" text,
"Endereço 2" text,
"Número" text,
"Bairro" text,
"Cidade" text,
"Estado" text,
"CEP" text,
"País/Região" text,
"Comprador Designado" text,
"Método de Envio" text,
"Nº de Rastreio" text,
"Método de coletar" text,
"Etiqueta" text
)
RETURNING 1
)
SELECT count(*) FROM ins;

$$;
CREATE FUNCTION "obsidian"."kit_bom_canonical"(IN b JSONB) RETURNS JSONB LANGUAGE SQL
AS
$$

SELECT COALESCE(
jsonb_agg(jsonb_build_object('sku', x.sku, 'qty', x.qty) ORDER BY x.sku),
'[]'::jsonb
)
FROM (
SELECT upper(trim(c->>'sku')) AS sku,
COALESCE(NULLIF(c->>'qty','')::numeric,0) AS qty
FROM jsonb_array_elements(COALESCE(b,'[]'::jsonb)) c
WHERE upper(trim(c->>'sku')) <> '' AND COALESCE(NULLIF(c->>'qty','')::numeric,0) > 0
) x;

$$;
CREATE FUNCTION "obsidian"."kit_bom_hash"(IN b JSONB) RETURNS TEXT LANGUAGE SQL
AS
$$

SELECT md5( (obsidian.kit_bom_canonical(b))::text );

$$;
CREATE FUNCTION "public"."match_raw_as_kit"(IN p_raw_id BIGINT, IN p_components JSONB, IN p_nome TEXT, IN p_categoria TEXT, IN p_preco NUMERIC, IN p_autocreate BOOLEAN) RETURNS TEXT LANGUAGE PLPGSQL
AS
$$

DECLARE
v_bom_raw   jsonb := p_components;
v_bom       jsonb;
v_sku_base  TEXT;
v_sku_final TEXT;
v_nome_final TEXT;
v_nome_top3 TEXT;
v_key       TEXT;
v_cnt       INT;
v_first     TEXT;
v_hash6     TEXT;
BEGIN
IF v_bom_raw IS NULL OR jsonb_typeof(v_bom_raw) <> 'array' OR jsonb_array_length(v_bom_raw)=0 THEN
RAISE EXCEPTION 'components vazio/inválido: %', v_bom_raw;
END IF;

v_bom := (
WITH comp_in AS (
SELECT
upper(trim(j->>'sku')) AS comp_sku,
COALESCE(NULLIF(j->>'qty','')::numeric, NULLIF(j->>'q','')::numeric, 0) AS comp_qty
FROM jsonb_array_elements(v_bom_raw) AS j
),
comp_ok AS (
SELECT comp_sku, comp_qty FROM comp_in
WHERE comp_sku <> '' AND comp_qty > 0
),
comp_agg AS (
SELECT comp_sku, SUM(comp_qty) AS qty
FROM comp_ok GROUP BY comp_sku
)
SELECT COALESCE(jsonb_agg(jsonb_build_object('sku', comp_sku, 'qty', qty) ORDER BY comp_sku), '[]'::jsonb)
FROM comp_agg
);

SELECT string_agg(upper(trim(x->>'sku')) || 'x' || COALESCE(NULLIF(x->>'qty',''),'1'), '+'
ORDER BY upper(trim(x->>'sku')))
INTO v_key
FROM jsonb_array_elements(v_bom) x;

SELECT string_agg(REGEXP_REPLACE(upper(trim(x->>'sku')), '[^A-Z0-9]+', '-', 'g'),
'-' ORDER BY upper(trim(x->>'sku'))),
jsonb_array_length(v_bom)
INTO v_sku_base, v_cnt
FROM jsonb_array_elements(v_bom) x;

v_first := split_part(v_sku_base, '-', 1);
IF length(v_sku_base) <= 40 THEN
v_sku_final := 'KIT-' || v_sku_base;
ELSE
v_sku_final := 'KIT-' || v_first || '-' || (v_cnt-1)::text || 'ITENS';
END IF;

IF EXISTS (SELECT 1 FROM obsidian.produtos WHERE sku = v_sku_final) THEN
SELECT substr(encode(digest(v_key::text, 'sha256'), 'hex'), 1, 6) INTO v_hash6;
v_sku_final := v_sku_final || '-' || upper(v_hash6);
END IF;

IF p_nome IS NOT NULL AND btrim(p_nome) <> '' THEN
v_nome_final := p_nome;
ELSE
SELECT string_agg(nm, ' + ')
INTO v_nome_top3
FROM (
SELECT COALESCE(left(p.nome, 40),
left(REGEXP_REPLACE(upper(trim(x->>'sku')), '[^A-Z0-9]+', '-', 'g'), 20)) AS nm
FROM jsonb_array_elements(v_bom) x
LEFT JOIN obsidian.produtos p ON p.sku = upper(trim(x->>'sku'))
ORDER BY upper(trim(x->>'sku'))
LIMIT 3
) t;

v_nome_final := COALESCE(
CASE WHEN v_nome_top3 IS NOT NULL AND v_nome_top3 <> '' THEN
'Kit ' || v_nome_top3 || CASE WHEN v_cnt > 3 THEN ' + ' || (v_cnt-3)::text || ' itens' ELSE '' END
END,
'Kit ' || replace(v_sku_final, 'KIT-','')
);
END IF;

INSERT INTO obsidian.produtos AS p
(sku,        nome,        categoria,              tipo_produto,
quantidade_atual, unidade_medida, preco_unitario,
kit_bom,    atualizado_em)
VALUES
(v_sku_final, v_nome_final, NULLIF(p_categoria,''), 'Kit',
0,            'UN',          COALESCE(p_preco,0),
v_bom,        now())
ON CONFLICT (sku) DO UPDATE
SET nome = CASE
WHEN (p.nome = p.sku OR p.nome ILIKE 'KIT-%' OR p.nome ILIKE 'produto%')
AND EXCLUDED.nome IS NOT NULL AND btrim(EXCLUDED.nome) <> ''
THEN EXCLUDED.nome
ELSE p.nome
END,
categoria        = COALESCE(EXCLUDED.categoria, p.categoria),
tipo_produto     = 'Kit',
quantidade_atual = 0,
unidade_medida   = 'UN',
preco_unitario   = CASE WHEN EXCLUDED.preco_unitario > 0
THEN EXCLUDED.preco_unitario ELSE p.preco_unitario END,
kit_bom          = EXCLUDED.kit_bom,
atualizado_em    = now();

IF COALESCE(p_autocreate, TRUE) THEN
UPDATE public.raw_export_orders
SET matched_sku  = v_sku_final,
match_score  = 1.0,
match_source = 'kit',
status       = 'matched',
processed_at = now()
WHERE id = p_raw_id;
END IF;

RETURN v_sku_final;
END;

$$;
CREATE FUNCTION "public"."normalize_kit_sku_from_nome"(IN p_nome TEXT) RETURNS TEXT LANGUAGE SQL
AS
$$

SELECT CASE
WHEN p_nome IS NULL OR btrim(p_nome) = '' THEN NULL
ELSE
'KIT-' ||
regexp_replace(                       -- limpa caracteres fora A-Z0-9 e troca por '-'
regexp_replace(                     -- remove prefixo 'KIT ' ou 'Kit-'
upper(
regexp_replace(btrim(p_nome), '•', '', 'g')  -- remove bullets
),
'^(KIT[\s-]+)', '', 'i'
),
'[^A-Z0-9]+', '-', 'g'
)                                     -- compacta múltiplos '-' e tira das pontas
END

$$;
CREATE FUNCTION "public"."pgp_armor_headers"(OUT key TEXT, OUT value TEXT) RETURNS RECORD LANGUAGE C
AS
$$
pgp_armor_headers
$$;
CREATE FUNCTION "public"."pgp_key_id"() RETURNS TEXT LANGUAGE C
AS
$$
pgp_key_id_w
$$;
CREATE FUNCTION "public"."pgp_pub_decrypt"() RETURNS TEXT|TEXT|TEXT LANGUAGE C
AS
$$
pgp_pub_decrypt_text
$$;
CREATE FUNCTION "public"."pgp_pub_decrypt_bytea"() RETURNS BYTEA|BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_pub_decrypt_bytea
$$;
CREATE FUNCTION "public"."pgp_pub_encrypt"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_pub_encrypt_text
$$;
CREATE FUNCTION "public"."pgp_pub_encrypt_bytea"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_pub_encrypt_bytea
$$;
CREATE FUNCTION "public"."pgp_sym_decrypt"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
pgp_sym_decrypt_text
$$;
CREATE FUNCTION "public"."pgp_sym_decrypt_bytea"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_sym_decrypt_bytea
$$;
CREATE FUNCTION "public"."pgp_sym_encrypt"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_sym_encrypt_text
$$;
CREATE FUNCTION "public"."pgp_sym_encrypt_bytea"() RETURNS BYTEA|BYTEA LANGUAGE C
AS
$$
pgp_sym_encrypt_bytea
$$;
CREATE FUNCTION "obsidian"."processar_pedido"(IN p_pedido_uid TEXT, IN p_data_venda DATE, IN p_nome_cliente TEXT, IN p_canal TEXT, IN p_items JSONB, IN p_client_id BIGINT, IN p_import_id UUID, OUT sku_retorno TEXT, OUT quantidade_baixada NUMERIC, OUT estoque_pos NUMERIC, OUT operacao TEXT) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
    item RECORD;
    v_sku TEXT;
    v_quantidade NUMERIC;
    v_preco_unitario NUMERIC;
    v_nome_produto TEXT;
    v_estoque_atual NUMERIC;
    v_venda_existe BOOLEAN;
BEGIN
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        sku TEXT,
        nome_produto TEXT,
        quantidade NUMERIC,
        preco_unitario NUMERIC
    )
    LOOP
        v_sku := item.sku;
        v_quantidade := item.quantidade;
        v_preco_unitario := item.preco_unitario;
        v_nome_produto := item.nome_produto;

        -- Buscar nome do produto se não informado
        IF v_nome_produto IS NULL OR v_nome_produto = v_sku THEN
            SELECT nome INTO v_nome_produto
            FROM obsidian.produtos
            WHERE sku = v_sku;

            IF v_nome_produto IS NULL THEN
                v_nome_produto := v_sku;
            END IF;
        END IF;

        -- VERIFICAR SE A VENDA JÁ EXISTE
        SELECT EXISTS(
            SELECT 1 FROM obsidian.vendas
            WHERE pedido_uid = p_pedido_uid AND sku_produto = v_sku
        ) INTO v_venda_existe;

        -- INSERIR OU ATUALIZAR VENDA (UPSERT)
        -- O TRIGGER trg_baixa_estoque vai baixar o estoque automaticamente
        INSERT INTO obsidian.vendas (
            pedido_uid,
            data_venda,
            nome_cliente,
            sku_produto,
            quantidade_vendida,
            preco_unitario,
            valor_total,
            nome_produto,
            canal,
            client_id,
            import_id,
            codigo_ml
        ) VALUES (
            p_pedido_uid,
            p_data_venda,
            p_nome_cliente,
            v_sku,
            v_quantidade,
            v_preco_unitario,
            v_quantidade * v_preco_unitario,
            v_nome_produto,
            p_canal,
            p_client_id,
            p_import_id,
            p_pedido_uid  -- codigo_ml = pedido_uid para vendas ML
        )
        ON CONFLICT ON CONSTRAINT vendas_dedupe
        DO UPDATE SET
            quantidade_vendida = EXCLUDED.quantidade_vendida,
            preco_unitario = EXCLUDED.preco_unitario,
            valor_total = EXCLUDED.valor_total,
            data_venda = EXCLUDED.data_venda,
            nome_produto = EXCLUDED.nome_produto,
            canal = EXCLUDED.canal,
            client_id = EXCLUDED.client_id,
            import_id = EXCLUDED.import_id,
            pedido_uid = EXCLUDED.pedido_uid;

        -- Buscar estoque atual
        SELECT quantidade_atual INTO v_estoque_atual
        FROM obsidian.produtos
        WHERE sku = v_sku;

        -- Retornar informação
        sku_retorno := v_sku;
        quantidade_baixada := v_quantidade;
        estoque_pos := v_estoque_atual;
        operacao := CASE WHEN v_venda_existe THEN 'UPDATE' ELSE 'INSERT' END;
        RETURN NEXT;

    END LOOP;

    RETURN;
END;

$$;
CREATE FUNCTION "public"."processar_pedido"(IN p_pedido_uid TEXT, IN p_data_venda DATE, IN p_nome_cliente TEXT, IN p_canal TEXT, IN p_items JSONB, OUT sku_retorno TEXT, OUT quantidade_baixada NUMERIC, OUT estoque_pos NUMERIC, OUT operacao TEXT) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

            DECLARE
                item RECORD;
                v_sku TEXT;
                v_quantidade NUMERIC;
                v_preco_unitario NUMERIC;
                v_nome_produto TEXT;
                v_estoque_atual NUMERIC;
                v_venda_existe BOOLEAN;
            BEGIN
                FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
                    sku TEXT,
                    nome_produto TEXT,
                    quantidade NUMERIC,
                    preco_unitario NUMERIC
                )
                LOOP
                    v_sku := item.sku;
                    v_quantidade := item.quantidade;
                    v_preco_unitario := item.preco_unitario;
                    v_nome_produto := item.nome_produto;

                    IF v_nome_produto IS NULL OR v_nome_produto = v_sku THEN
                        SELECT nome INTO v_nome_produto
                        FROM produtos
                        WHERE sku = v_sku;

                        IF v_nome_produto IS NULL THEN
                            v_nome_produto := v_sku;
                        END IF;
                    END IF;

                    SELECT EXISTS(
                        SELECT 1 FROM vendas
                        WHERE pedido_uid = p_pedido_uid AND sku_produto = v_sku
                    ) INTO v_venda_existe;

                    INSERT INTO vendas (
                        data_venda,
                        nome_cliente,
                        sku_produto,
                        quantidade_vendida,
                        preco_unitario,
                        valor_total,
                        nome_produto,
                        canal,
                        pedido_uid
                    ) VALUES (
                        p_data_venda,
                        p_nome_cliente,
                        v_sku,
                        v_quantidade,
                        v_preco_unitario,
                        v_quantidade * v_preco_unitario,
                        v_nome_produto,
                        p_canal,
                        p_pedido_uid
                    )
                    ON CONFLICT ON CONSTRAINT vendas_dedupe
                    DO UPDATE SET
                        quantidade_vendida = EXCLUDED.quantidade_vendida,
                        preco_unitario = EXCLUDED.preco_unitario,
                        valor_total = EXCLUDED.valor_total,
                        data_venda = EXCLUDED.data_venda,
                        nome_produto = EXCLUDED.nome_produto,
                        canal = EXCLUDED.canal;

                    SELECT quantidade_atual INTO v_estoque_atual
                    FROM produtos
                    WHERE sku = v_sku;

                    sku_retorno := v_sku;
                    quantidade_baixada := v_quantidade;
                    estoque_pos := v_estoque_atual;
                    operacao := CASE WHEN v_venda_existe THEN 'UPDATE' ELSE 'INSERT' END;
                    RETURN NEXT;

                END LOOP;

                RETURN;
            END;
            
$$;
CREATE FUNCTION "obsidian"."processar_pedido_rows"(IN p_pedido_uid TEXT, IN p_data_venda DATE, IN p_nome_cliente TEXT, IN p_canal TEXT, IN p_items JSONB, OUT sku_resultado TEXT, OUT quantidade_baixada NUMERIC, OUT estoque_pos NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE v_rec RECORD; v_uid TEXT;
BEGIN
v_uid := COALESCE(p_pedido_uid, md5(concat_ws('', p_data_venda::text, p_nome_cliente, p_canal)));

IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 THEN
RAISE EXCEPTION 'Items JSON vazio/ inválido: %', p_items;
END IF;

INSERT INTO obsidian.clientes (nome) VALUES (p_nome_cliente) ON CONFLICT (nome) DO NOTHING;

FOR v_rec IN
SELECT upper(trim(x->>'sku')) AS sku,
COALESCE(NULLIF(x->>'nome_produto',''),'Produto') AS nome_produto,
(x->>'quantidade')::numeric AS quantidade,
COALESCE((x->>'preco_unitario')::numeric,0) AS preco_unitario
FROM jsonb_array_elements(p_items) x
LOOP
IF v_rec.sku IS NULL OR v_rec.sku='' THEN RAISE EXCEPTION 'SKU vazio'; END IF;
IF v_rec.quantidade IS NULL OR v_rec.quantidade <= 0 THEN
RAISE EXCEPTION 'Qtd inválida no SKU %: %', v_rec.sku, v_rec.quantidade;
END IF;

INSERT INTO obsidian.produtos (sku, nome, tipo_produto, preco_unitario)
VALUES (v_rec.sku, v_rec.nome_produto, 'Revenda', v_rec.preco_unitario)
ON CONFLICT (sku) DO UPDATE
SET nome = CASE WHEN produtos.nome='Produto' THEN EXCLUDED.nome ELSE produtos.nome END,
preco_unitario = GREATEST(produtos.preco_unitario, EXCLUDED.preco_unitario),
atualizado_em = now();

INSERT INTO obsidian.vendas
("Data Venda","Nome Cliente","SKU Produto","Quantidade Vendida",
"Preço Unitário","Valor Total","ID","Nome Produto","Canal","Pedido UID")
VALUES (
p_data_venda, p_nome_cliente, v_rec.sku, v_rec.quantidade,
v_rec.preco_unitario, v_rec.quantidade*v_rec.preco_unitario,
md5(concat_ws('', p_data_venda::text, p_nome_cliente, v_rec.sku, v_rec.quantidade::text, v_rec.preco_unitario::text)),
v_rec.nome_produto, p_canal, v_uid
)
ON CONFLICT ("Data Venda","Nome Cliente","SKU Produto","Quantidade Vendida","Preço Unitário") DO NOTHING;

UPDATE obsidian.produtos p
SET quantidade_atual = COALESCE(p.quantidade_atual,0) - v_rec.quantidade,
atualizado_em    = now()
WHERE p.sku = v_rec.sku
RETURNING p.sku, v_rec.quantidade, p.quantidade_atual
INTO sku_resultado, quantidade_baixada, estoque_pos;

RETURN NEXT;
END LOOP;
END;

$$;
CREATE FUNCTION "obsidian"."processar_pedido_v2"(IN p_pedido_uid TEXT, IN p_data_venda DATE, IN p_nome_cliente TEXT, IN p_canal TEXT, IN p_items JSONB, OUT sku TEXT, OUT quantidade_baixada NUMERIC, OUT estoque_pos NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

            DECLARE
                v_record RECORD;
                v_produto RECORD;
                v_cliente_id INT;
                v_pedido_uid TEXT;
            BEGIN
                -- Gerar pedido_uid único se não fornecido
                v_pedido_uid := COALESCE(p_pedido_uid, md5(concat_ws('|', p_data_venda::TEXT, p_nome_cliente, p_items::TEXT)));
                
                -- Upsert do cliente
                INSERT INTO obsidian.clientes (nome)
                VALUES (p_nome_cliente)
                ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
                RETURNING id INTO v_cliente_id;
                
                -- Processar cada item
                FOR v_record IN 
                    SELECT 
                        (item->>'sku')::TEXT as item_sku,
                        (item->>'quantidade')::NUMERIC as item_qtd,
                        (item->>'preco_unitario')::NUMERIC as item_preco,
                        (item->>'nome_produto')::TEXT as item_nome
                    FROM jsonb_array_elements(p_items) item
                LOOP
                    -- Upsert do produto
                    INSERT INTO obsidian.produtos (sku, nome, quantidade_atual)
                    VALUES (upper(trim(v_record.item_sku)), COALESCE(v_record.item_nome, upper(trim(v_record.item_sku))), 0)
                    ON CONFLICT ON CONSTRAINT produtos_sku_key 
                    DO UPDATE SET nome = COALESCE(EXCLUDED.nome, produtos.nome);
                    
                    -- Inserir venda com idempotência (usando constraint vendas_dedupe)
                    INSERT INTO obsidian.vendas (
                        data_venda, nome_cliente, sku_produto, quantidade_vendida,
                        preco_unitario, valor_total, ext_id, nome_produto, canal, pedido_uid
                    )
                    VALUES (
                        p_data_venda,
                        p_nome_cliente,
                        upper(trim(v_record.item_sku)),
                        v_record.item_qtd,
                        COALESCE(v_record.item_preco, 0),
                        (v_record.item_qtd * COALESCE(v_record.item_preco, 0)),
                        md5(concat_ws('', p_data_venda::TEXT, p_nome_cliente, upper(trim(v_record.item_sku)), v_record.item_qtd::TEXT, COALESCE(v_record.item_preco, 0)::TEXT)),
                        v_record.item_nome,
                        p_canal,
                        v_pedido_uid
                    )
                    ON CONFLICT ON CONSTRAINT vendas_dedupe DO NOTHING;
                    
                    -- Atualizar estoque
                    UPDATE obsidian.produtos
                    SET quantidade_atual = quantidade_atual - v_record.item_qtd
                    WHERE produtos.sku = upper(trim(v_record.item_sku));
                    
                    -- Retornar resultado
                    SELECT quantidade_atual INTO v_produto FROM obsidian.produtos WHERE produtos.sku = upper(trim(v_record.item_sku));
                    
                    RETURN QUERY SELECT 
                        upper(trim(v_record.item_sku)),
                        v_record.item_qtd,
                        COALESCE(v_produto.quantidade_atual, 0);
                END LOOP;
                
                RETURN;
            END;
            
$$;
CREATE FUNCTION "obsidian"."processar_pedidos_ml"(IN p_import_id UUID, OUT vendas_inseridas INTEGER, OUT pedidos_processados INTEGER, OUT pedidos_cancelados_ignorados INTEGER, OUT vendas_revertidas INTEGER, OUT devolucoes_criadas INTEGER) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
    v_vendas_inseridas INTEGER := 0;
    v_pedidos_processados INTEGER := 0;
    v_pedidos_cancelados INTEGER := 0;
    v_vendas_revertidas INTEGER := 0;
    v_devolucoes_criadas INTEGER := 0;
    v_order RECORD;
    v_pedido_ja_emitido BOOLEAN;
    v_status_anterior TEXT;
    v_client_id INTEGER;
    v_venda_id BIGINT;
    v_item RECORD;
BEGIN
    -- Buscar client_id do import_batch
    SELECT client_id INTO v_client_id
    FROM obsidian.import_batches
    WHERE import_id = p_import_id;

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Import ID % não encontrado', p_import_id;
    END IF;

    FOR v_order IN
        SELECT DISTINCT
            order_id,
            order_date,
            customer,
            "Pós-venda/Cancelado/Devolvido" as status_cancelamento,
            "Razão do Cancelamento" as motivo
        FROM raw_export_orders
        WHERE import_id = p_import_id
          AND status = 'matched'
          AND matched_sku IS NOT NULL
    LOOP
        -- Verificar se pedido já existe e qual era o status anterior
        SELECT 
            EXISTS(SELECT 1 FROM obsidian.vendas WHERE pedido_uid = v_order.order_id),
            (SELECT status_venda FROM obsidian.vendas WHERE pedido_uid = v_order.order_id LIMIT 1)
        INTO v_pedido_ja_emitido, v_status_anterior;

        -- ✅ NOVA LÓGICA: Detectar MUDANÇA de status para cancelado
        IF v_order.status_cancelamento IS NOT NULL 
           AND TRIM(v_order.status_cancelamento) != '' THEN
            
            -- ✅ SÓ CRIA DEVOLUÇÃO se o pedido JÁ EXISTIA e NÃO estava cancelado antes
            IF v_pedido_ja_emitido AND (v_status_anterior IS NULL OR UPPER(v_status_anterior) NOT IN ('CANCELADA', 'CANCELADO', 'DEVOLVIDO')) THEN
                
                -- Reverter estoque da venda anterior
                PERFORM obsidian.reverter_venda_cancelada(
                    v_order.order_id,
                    v_order.motivo
                );
                v_vendas_revertidas := v_vendas_revertidas + 1;
                
                -- ✅ CRIAR REGISTROS DE DEVOLUÇÃO para conferência física
                FOR v_item IN
                    SELECT 
                        v.venda_id,
                        v.sku_produto as sku,
                        v.quantidade_vendida as quantidade,
                        v.nome_produto
                    FROM obsidian.vendas v
                    WHERE v.pedido_uid = v_order.order_id
                LOOP
                    -- Atualizar status da venda para CANCELADA
                    UPDATE obsidian.vendas
                    SET status_venda = 'CANCELADA'
                    WHERE venda_id = v_item.venda_id;

                    -- Criar registro de devolução física (apenas se ainda não existe)
                    INSERT INTO obsidian.devolucoes (
                        venda_id,
                        sku_produto,
                        quantidade_esperada,
                        tipo_problema,
                        observacoes
                    )
                    VALUES (
                        v_item.venda_id,
                        v_item.sku,
                        v_item.quantidade,
                        'pendente',
                        CONCAT('Pedido cancelado após envio. Motivo: ', COALESCE(v_order.motivo, 'Não informado'))
                    )
                    ON CONFLICT DO NOTHING; -- Evitar duplicatas

                    v_devolucoes_criadas := v_devolucoes_criadas + 1;
                END LOOP;
                
            ELSIF NOT v_pedido_ja_emitido THEN
                -- ✅ PRIMEIRA VEZ que vemos este pedido e já está cancelado
                -- NÃO criar devolução, apenas registrar venda cancelada sem baixar estoque
                INSERT INTO obsidian.vendas (
                    pedido_uid,
                    data_venda,
                    nome_cliente,
                    sku_produto,
                    quantidade_vendida,
                    preco_unitario,
                    valor_total,
                    nome_produto,
                    canal,
                    client_id,
                    import_id,
                    status_venda,
                    fulfillment_ext
                )
                SELECT
                    v_order.order_id,
                    COALESCE(v_order.order_date::DATE, CURRENT_DATE),
                    v_order.customer,
                    matched_sku,
                    qty,
                    COALESCE(unit_price, 0),
                    COALESCE(unit_price, 0) * qty,
                    "Nome do Produto",
                    'ML',
                    v_client_id,
                    p_import_id,
                    'CANCELADA',
                    true -- Não baixa estoque
                FROM raw_export_orders
                WHERE import_id = p_import_id
                  AND order_id = v_order.order_id
                  AND status = 'matched'
                  AND matched_sku IS NOT NULL
                ON CONFLICT (pedido_uid, sku_produto) DO NOTHING;
            END IF;
            
            v_pedidos_cancelados := v_pedidos_cancelados + 1;
            CONTINUE;
        END IF;

        -- Processar vendas normais (não canceladas)
        IF NOT v_pedido_ja_emitido THEN
            DECLARE
                v_items JSONB;
            BEGIN
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'sku', matched_sku,
                        'quantidade', qty,
                        'preco_unitario', unit_price,
                        'nome_produto', "Nome do Produto"
                    )
                )
                INTO v_items
                FROM raw_export_orders
                WHERE import_id = p_import_id
                  AND order_id = v_order.order_id
                  AND status = 'matched'
                  AND matched_sku IS NOT NULL;

                IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
                    PERFORM obsidian.processar_pedido(
                        v_order.order_id,
                        COALESCE(v_order.order_date::DATE, CURRENT_DATE),
                        v_order.customer,
                        'ML',
                        v_items,
                        v_client_id,
                        p_import_id
                    );
                    
                    v_vendas_inseridas := v_vendas_inseridas + jsonb_array_length(v_items);
                    v_pedidos_processados := v_pedidos_processados + 1;
                END IF;
            END;
        END IF;
    END LOOP;

    vendas_inseridas := v_vendas_inseridas;
    pedidos_processados := v_pedidos_processados;
    pedidos_cancelados_ignorados := v_pedidos_cancelados;
    vendas_revertidas := v_vendas_revertidas;
    devolucoes_criadas := v_devolucoes_criadas;
END;

$$;
CREATE FUNCTION "obsidian"."produto_soft_delete"(IN p_sku TEXT, IN p_force BOOLEAN) RETURNS VOID LANGUAGE PLPGSQL
AS
$$

DECLARE v_count_kits INT;
BEGIN
SELECT COUNT(*) INTO v_count_kits
FROM obsidian.v_kit_components
WHERE kit_sku <> upper(trim(p_sku)) AND component_sku = upper(trim(p_sku));

IF v_count_kits > 0 AND NOT p_force THEN
RAISE EXCEPTION 'SKU % está presente em % kits; use p_force=true ou remova dos kits antes.', p_sku, v_count_kits;
END IF;

UPDATE obsidian.produtos
SET ativo = FALSE, atualizado_em = now()
WHERE sku = upper(trim(p_sku));
END;

$$;
CREATE FUNCTION "obsidian"."produto_update"(IN p_sku TEXT, IN p_nome TEXT, IN p_categoria TEXT, IN p_preco NUMERIC, IN p_unidade TEXT) RETURNS VOID LANGUAGE PLPGSQL
AS
$$

BEGIN
UPDATE obsidian.produtos
SET nome = COALESCE(p_nome, nome),
categoria = COALESCE(p_categoria, categoria),
preco_unitario = COALESCE(p_preco, preco_unitario),
unidade_medida = COALESCE(UPPER(p_unidade), unidade_medida),
atualizado_em = now()
WHERE sku = upper(trim(p_sku));
END;

$$;
CREATE FUNCTION "public"."raw_export_orders_reject_zero_qty"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
IF COALESCE(NEW.qty, 0) = 0 THEN
RETURN NULL;
END IF;
RETURN NEW;
END

$$;
CREATE FUNCTION "obsidian"."registrar_movimento_estoque"(IN p_sku TEXT, IN p_quantidade NUMERIC, IN p_tipo TEXT, IN p_origem_tabela TEXT, IN p_origem_id TEXT, IN p_observacao TEXT, OUT movimento_id BIGINT, OUT sku_out TEXT, OUT quantidade_out NUMERIC, OUT saldo_atual NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
v_insert_id  BIGINT;
v_saldo      NUMERIC;
BEGIN
IF COALESCE(TRIM(p_sku),'') = '' THEN
RAISE EXCEPTION 'SKU obrigatório';
END IF;

IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
RAISE EXCEPTION 'quantidade deve ser > 0';
END IF;

IF NOT EXISTS (SELECT 1 FROM obsidian.produtos p WHERE p.sku = p_sku) THEN
RAISE EXCEPTION 'SKU % não encontrado em obsidian.produtos', p_sku;
END IF;

p_tipo := LOWER(COALESCE(p_tipo,'entrada'));
IF p_tipo NOT IN ('entrada','ajuste_positivo','devolucao_compra','devolucao_venda') THEN
p_tipo := 'entrada';
END IF;

WITH ins AS (
INSERT INTO obsidian.estoque_movimentos
(sku, tipo, quantidade, origem_tabela, origem_id, observacao)
VALUES (p_sku, p_tipo, p_quantidade, p_origem_tabela, p_origem_id, p_observacao)
ON CONFLICT (sku, tipo, origem_tabela, origem_id) DO NOTHING
RETURNING id
)
SELECT id INTO v_insert_id FROM ins;

IF v_insert_id IS NOT NULL THEN
UPDATE obsidian.produtos p
SET p.quantidade_atual = COALESCE(p.quantidade_atual,0) + p_quantidade
WHERE p.sku = p_sku
RETURNING p.quantidade_atual INTO v_saldo;
ELSE
SELECT p.quantidade_atual INTO v_saldo
FROM obsidian.produtos p
WHERE p.sku = p_sku;

IF p_origem_tabela IS NOT NULL AND p_origem_id IS NOT NULL THEN
SELECT m.id INTO v_insert_id
FROM obsidian.estoque_movimentos m
WHERE m.sku = p_sku
AND m.tipo = p_tipo
AND m.origem_tabela = p_origem_tabela
AND m.origem_id = p_origem_id
ORDER BY m.id DESC
LIMIT 1;
END IF;
END IF;

RETURN QUERY SELECT v_insert_id, p_sku, p_quantidade, v_saldo;
END;

$$;
CREATE FUNCTION "obsidian"."registrar_venda_manual"(IN p_pedido_uid TEXT, IN p_data_venda DATE, IN p_nome_cliente TEXT, IN p_canal TEXT, IN p_itens JSONB, OUT ok BOOLEAN, OUT itens_gravados INTEGER) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
v_count int := 0;
r       jsonb;
v_sku   text;
v_nome  text;
v_qtd   numeric;
v_preco numeric;
BEGIN
IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
RETURN QUERY SELECT false, 0;
RETURN;
END IF;

FOR r IN SELECT * FROM jsonb_array_elements(p_itens)
LOOP
v_sku   := upper(trim(COALESCE(r->>'sku', r->>'sku_produto', '')));
v_nome  := trim(COALESCE(r->>'nome_produto', r->>'nome', 'Produto'));
v_qtd   := COALESCE(NULLIF(r->>'quantidade','')::numeric,
NULLIF(r->>'quantidade_vendida','')::numeric, 0);
v_preco := COALESCE(NULLIF(r->>'preco_unitario','')::numeric, 0);

IF v_sku = '' OR v_qtd <= 0 THEN
CONTINUE;
END IF;

INSERT INTO obsidian.vendas (
pedido_uid, data_venda, nome_cliente, canal,
sku_produto, nome_produto, quantidade_vendida, preco_unitario,
valor_total, fulfillment_ext, criado_em
)
VALUES (
p_pedido_uid, p_data_venda, p_nome_cliente, p_canal,
v_sku, v_nome, v_qtd, v_preco,
v_qtd * v_preco, false, NOW()
)
ON CONFLICT (pedido_uid, sku_produto) DO NOTHING;

IF FOUND THEN v_count := v_count + 1; END IF;
END LOOP;

RETURN QUERY SELECT true, v_count;
END

$$;
CREATE FUNCTION "obsidian"."reverter_venda_cancelada"(IN p_pedido_uid TEXT, IN p_motivo_cancelamento TEXT, OUT sku_revertido TEXT, OUT quantidade_devolvida NUMERIC, OUT estoque_atual NUMERIC, OUT status TEXT) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

            DECLARE
                v_venda RECORD;
            BEGIN
                FOR v_venda IN
                    SELECT 
                        id,
                        sku_produto,
                        quantidade_vendida,
                        nome_cliente,
                        data_venda
                    FROM obsidian.vendas
                    WHERE pedido_uid = p_pedido_uid
                      AND (status_venda IS NULL OR status_venda != 'CANCELADA')
                LOOP
                    -- 1. DEVOLVER ESTOQUE
                    UPDATE obsidian.produtos
                    SET quantidade_atual = COALESCE(quantidade_atual, 0) + v_venda.quantidade_vendida,
                        atualizado_em = NOW()
                    WHERE sku = v_venda.sku_produto;

                    -- 2. REGISTRAR MOVIMENTO DE ESTORNO
                    INSERT INTO obsidian.estoque_movimentos (
                        sku,
                        tipo,
                        quantidade,
                        origem_tabela,
                        origem_id,
                        observacao
                    )
                    VALUES (
                        v_venda.sku_produto,
                        'estorno_cancelamento',
                        v_venda.quantidade_vendida,
                        'vendas',
                        v_venda.id::text,
                        CONCAT('Estorno pedido cancelado: ', p_pedido_uid, 
                               CASE WHEN p_motivo_cancelamento IS NOT NULL 
                                    THEN ' - ' || p_motivo_cancelamento 
                                    ELSE '' END)
                    );

                    -- 3. MARCAR VENDA COMO CANCELADA
                    UPDATE obsidian.vendas
                    SET status_venda = 'CANCELADA',
                        observacoes = CONCAT(
                            COALESCE(observacoes || ' | ', ''),
                            'CANCELADO em ', NOW()::date,
                            CASE WHEN p_motivo_cancelamento IS NOT NULL 
                                 THEN ' - ' || p_motivo_cancelamento 
                                 ELSE '' END
                        )
                    WHERE id = v_venda.id;

                    RETURN QUERY SELECT
                        v_venda.sku_produto,
                        v_venda.quantidade_vendida,
                        (SELECT quantidade_atual FROM obsidian.produtos WHERE sku = v_venda.sku_produto),
                        'REVERTIDO'::TEXT;
                END LOOP;

                IF NOT FOUND THEN
                    RETURN QUERY SELECT
                        NULL::TEXT,
                        0::NUMERIC,
                        0::NUMERIC,
                        'PEDIDO_NAO_ENCONTRADO'::TEXT;
                END IF;

                RETURN;
            END;
            
$$;
CREATE FUNCTION "obsidian"."set_atualizado_em"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
NEW.atualizado_em := now();
RETURN NEW;
END;

$$;
CREATE FUNCTION "public"."set_limit"() RETURNS REAL LANGUAGE C
AS
$$
set_limit
$$;
CREATE FUNCTION "public"."show_limit"() RETURNS REAL LANGUAGE C
AS
$$
show_limit
$$;
CREATE FUNCTION "public"."show_trgm"() RETURNS ARRAY LANGUAGE C
AS
$$
show_trgm
$$;
CREATE FUNCTION "public"."similarity"() RETURNS REAL LANGUAGE C
AS
$$
similarity
$$;
CREATE FUNCTION "public"."similarity_dist"() RETURNS REAL LANGUAGE C
AS
$$
similarity_dist
$$;
CREATE FUNCTION "public"."similarity_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
similarity_op
$$;
CREATE FUNCTION "public"."strict_word_similarity"() RETURNS REAL LANGUAGE C
AS
$$
strict_word_similarity
$$;
CREATE FUNCTION "public"."strict_word_similarity_commutator_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
strict_word_similarity_commutator_op
$$;
CREATE FUNCTION "public"."strict_word_similarity_dist_commutator_op"() RETURNS REAL LANGUAGE C
AS
$$
strict_word_similarity_dist_commutator_op
$$;
CREATE FUNCTION "public"."strict_word_similarity_dist_op"() RETURNS REAL LANGUAGE C
AS
$$
strict_word_similarity_dist_op
$$;
CREATE FUNCTION "public"."strict_word_similarity_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
strict_word_similarity_op
$$;
CREATE FUNCTION "public"."unaccent"() RETURNS TEXT|TEXT LANGUAGE C
AS
$$
unaccent_dict
$$;
CREATE FUNCTION "public"."unaccent_init"() RETURNS INTERNAL LANGUAGE C
AS
$$
unaccent_init
$$;
CREATE FUNCTION "public"."unaccent_lexize"() RETURNS INTERNAL LANGUAGE C
AS
$$
unaccent_lexize
$$;
CREATE FUNCTION "obsidian"."update_devolucoes_timestamp"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;

$$;
CREATE FUNCTION "public"."update_devolucoes_timestamp"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;

$$;
CREATE FUNCTION "obsidian"."upsert_produto_json"(IN p_sku TEXT, IN p_nome TEXT, IN p_categoria TEXT, IN p_unidade TEXT, IN p_tipo TEXT, IN p_qtd NUMERIC, IN p_preco NUMERIC, IN p_bom JSONB, OUT sku TEXT, OUT tipo_produto TEXT, OUT quantidade_atual NUMERIC, OUT preco_unitario NUMERIC, OUT kit_bom JSONB) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
v_sku  text := upper(p_sku);
v_bom  jsonb := COALESCE(p_bom, '[]'::jsonb);
v_is_kit boolean := (lower(COALESCE(p_tipo,''))='kit')
OR (jsonb_typeof(v_bom)='array' AND jsonb_array_length(v_bom)>0);
BEGIN
IF v_is_kit THEN
v_bom := (
WITH items AS (
SELECT upper(trim(value->>'sku')) AS csku,
COALESCE(NULLIF(value->>'qty','')::numeric,0) AS qty
FROM jsonb_array_elements(v_bom) value
),
ok AS (
SELECT csku, qty FROM items WHERE csku<>'' AND qty>0
),
agg AS (
SELECT csku, SUM(qty) AS qty FROM ok GROUP BY csku
)
SELECT COALESCE(jsonb_agg(jsonb_build_object('sku', csku, 'qty', qty)),'[]'::jsonb) FROM agg
);
ELSE
v_bom := '[]'::jsonb;
END IF;

INSERT INTO obsidian.produtos AS p
(sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, kit_bom, atualizado_em)
VALUES (
v_sku,
p_nome,
p_categoria,
CASE WHEN v_is_kit THEN 'Kit' ELSE COALESCE(p_tipo,'Simples') END,
CASE WHEN v_is_kit THEN 0 ELSE COALESCE(p_qtd,0) END,
upper(COALESCE(p_unidade,'UN')),
COALESCE(p_preco,0),
v_bom,
now()
)
ON CONFLICT (sku) DO UPDATE SET
nome             = EXCLUDED.nome,
categoria        = EXCLUDED.categoria,
tipo_produto     = EXCLUDED.tipo_produto,
quantidade_atual = EXCLUDED.quantidade_atual,
unidade_medida   = EXCLUDED.unidade_medida,
preco_unitario   = EXCLUDED.preco_unitario,
kit_bom          = EXCLUDED.kit_bom,
atualizado_em    = now();

RETURN QUERY
SELECT p.sku, p.tipo_produto, p.quantidade_atual, p.preco_unitario, p.kit_bom
FROM obsidian.produtos p
WHERE p.sku = v_sku;
END;

$$;
CREATE FUNCTION "obsidian"."upsert_produto_ou_kit"(IN p_sku TEXT, IN p_nome TEXT, IN p_categoria TEXT, IN p_unidade TEXT, IN p_tipo TEXT, IN p_qtd NUMERIC, IN p_preco NUMERIC, IN p_componentes JSONB, OUT sku TEXT, OUT tipo_produto TEXT, OUT quantidade_atual NUMERIC, OUT preco_unitario NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

BEGIN
IF lower(coalesce(p_tipo,'')) = 'kit' THEN
p_qtd := 0;
END IF;

INSERT INTO obsidian.produtos AS pr
(sku,              nome,     categoria,     tipo_produto,
quantidade_atual, unidade_medida,         preco_unitario,
ativo,  criado_em, atualizado_em)
VALUES
(upper(trim(p_sku)), p_nome, p_categoria,  p_tipo,
coalesce(p_qtd,0),  upper(coalesce(p_unidade,'UN')),
coalesce(p_preco,0),
TRUE, now(), now())
ON CONFLICT (sku) DO UPDATE
SET nome             = EXCLUDED.nome,
categoria        = EXCLUDED.categoria,
tipo_produto     = EXCLUDED.tipo_produto,
quantidade_atual = EXCLUDED.quantidade_atual,
unidade_medida   = EXCLUDED.unidade_medida,
preco_unitario   = EXCLUDED.preco_unitario,
atualizado_em    = now();

IF lower(coalesce(p_tipo,'')) = 'kit' THEN
DELETE FROM obsidian.kit_components
WHERE kit_sku = upper(trim(p_sku));

INSERT INTO obsidian.kit_components (kit_sku, component_sku, qty)
SELECT
upper(trim(p_sku))         AS kit_sku,
upper(trim(c->>'sku'))     AS component_sku,
coalesce((c->>'quantidade')::numeric, 0) AS qty
FROM jsonb_array_elements(p_componentes) c
WHERE nullif(c->>'sku','') IS NOT NULL
AND coalesce((c->>'quantidade')::numeric,0) > 0;

INSERT INTO obsidian.kit_index (sku_kit, composition_hash)
VALUES (upper(trim(p_sku)), obsidian.kit_composition_hash(upper(trim(p_sku))))
ON CONFLICT (sku_kit) DO UPDATE
SET composition_hash = EXCLUDED.composition_hash;
END IF;

RETURN QUERY
SELECT pr.sku, pr.tipo_produto, pr.quantidade_atual, pr.preco_unitario
FROM obsidian.produtos pr
WHERE pr.sku = upper(trim(p_sku));
END;

$$;
CREATE FUNCTION "obsidian"."upsert_produto_ou_kit_v2"(IN p_sku TEXT, IN p_nome TEXT, IN p_categoria TEXT, IN p_unidade TEXT, IN p_tipo TEXT, IN p_qtd NUMERIC, IN p_preco NUMERIC, IN p_componentes JSONB, OUT sku TEXT, OUT tipo_produto TEXT, OUT quantidade_atual NUMERIC, OUT preco_unitario NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

DECLARE
v_sku      text  := upper(p_sku);
v_bom_raw  jsonb := COALESCE(p_componentes,'[]'::jsonb);
v_is_kit   boolean;
v_bom      jsonb;
BEGIN
v_is_kit := (lower(COALESCE(p_tipo,''))='kit')
OR (jsonb_typeof(v_bom_raw)='array' AND jsonb_array_length(v_bom_raw)>0);

IF v_is_kit THEN
v_bom := (
WITH comp_in AS (
SELECT
upper(trim(j->>'sku')) AS comp_sku,
COALESCE(
NULLIF(j->>'quantidade','')::numeric,
NULLIF(j->>'qty','')::numeric,
0
) AS comp_qty
FROM jsonb_array_elements(v_bom_raw) AS j
),
comp_ok AS (
SELECT comp_sku, comp_qty FROM comp_in WHERE comp_sku <> '' AND comp_qty > 0
),
comp_agg AS (
SELECT comp_sku, SUM(comp_qty) AS qty FROM comp_ok GROUP BY comp_sku
)
SELECT COALESCE(jsonb_agg(jsonb_build_object('sku', comp_sku, 'qty', qty)),'[]'::jsonb)
FROM comp_agg
);
ELSE
v_bom := '[]'::jsonb;
END IF;

INSERT INTO obsidian.produtos AS p
(sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, kit_bom, atualizado_em)
VALUES (
v_sku,
p_nome,
p_categoria,
CASE WHEN v_is_kit THEN 'Kit' ELSE COALESCE(p_tipo,'Simples') END,
CASE WHEN v_is_kit THEN 0 ELSE COALESCE(p_qtd,0) END,
upper(COALESCE(p_unidade,'UN')),
COALESCE(p_preco,0),
v_bom,
now()
)
ON CONFLICT ON CONSTRAINT produtos_sku_key DO UPDATE
SET nome             = EXCLUDED.nome,
categoria        = EXCLUDED.categoria,
tipo_produto     = EXCLUDED.tipo_produto,
quantidade_atual = EXCLUDED.quantidade_atual,
unidade_medida   = EXCLUDED.unidade_medida,
preco_unitario   = EXCLUDED.preco_unitario,
kit_bom          = EXCLUDED.kit_bom,
atualizado_em    = now();

RETURN QUERY
SELECT p.sku, p.tipo_produto, p.quantidade_atual, p.preco_unitario
FROM obsidian.produtos p
WHERE p.sku = v_sku;
END;

$$;
CREATE FUNCTION "public"."word_similarity"() RETURNS REAL LANGUAGE C
AS
$$
word_similarity
$$;
CREATE FUNCTION "public"."word_similarity_commutator_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
word_similarity_commutator_op
$$;
CREATE FUNCTION "public"."word_similarity_dist_commutator_op"() RETURNS REAL LANGUAGE C
AS
$$
word_similarity_dist_commutator_op
$$;
CREATE FUNCTION "public"."word_similarity_dist_op"() RETURNS REAL LANGUAGE C
AS
$$
word_similarity_dist_op
$$;
CREATE FUNCTION "public"."word_similarity_op"() RETURNS BOOLEAN LANGUAGE C
AS
$$
word_similarity_op
$$;
CREATE VIEW "obsidian"."activity_summary"
AS
 SELECT user_email,
    user_name,
    action,
    entity_type,
    count(*) AS total_actions,
    max(created_at) AS last_action
   FROM obsidian.activity_logs
  GROUP BY user_email, user_name, action, entity_type
  ORDER BY (max(created_at)) DESC;;
CREATE VIEW "obsidian"."v_clientes"
AS
 SELECT nome AS "Nome",
    documento AS "Documento",
    telefone AS "Telefone",
    observacoes AS "Observações"
   FROM obsidian.clientes;;
CREATE VIEW "obsidian"."v_estoque"
AS
 SELECT sku AS "SKU",
    nome AS "Nome Produto",
    categoria AS "Categoria",
    tipo_produto AS "Tipo Produto",
    quantidade_atual AS "Quantidade Atual",
    unidade_medida AS "Unidade de Medida",
    preco_unitario AS "Preço Unitário"
   FROM obsidian.produtos
  WHERE (ativo = true);;
CREATE VIEW "obsidian"."v_estoque_materia_prima"
AS
 SELECT sku_mp AS "SKU Matéria-Prima",
    nome AS "Nome Matéria-Prima",
    categoria AS "Categoria MP",
    quantidade_atual AS "Quantidade Atual",
    unidade_medida AS "Unidade de Medida",
    custo_unitario AS "Custo Unitário"
   FROM obsidian.materia_prima
  WHERE (ativo = true);;
CREATE VIEW "obsidian"."v_estoque_movimentos"
AS
 SELECT ts AS "Quando",
    sku AS "SKU",
    tipo AS "Tipo",
    quantidade AS "Qtd",
    origem_tabela AS "Origem",
    origem_id AS "Origem ID",
    observacao AS "Obs"
   FROM obsidian.estoque_movimentos
  ORDER BY ts DESC;;
CREATE VIEW "obsidian"."v_financeiro_clientes"
AS
 WITH base AS (
         SELECT c_1.id,
            c_1.nome
           FROM obsidian.clientes c_1
        ), compras AS (
         SELECT v.nome_cliente,
            sum(v.valor_total) AS total_comprado
           FROM obsidian.vendas v
          WHERE (NOT COALESCE(v.fulfillment_ext, false))
          GROUP BY v.nome_cliente
        ), pagos AS (
         SELECT COALESCE(c_1.nome, p_1.nome_cliente) AS nome_cliente,
            sum(p_1.valor_pago) AS total_pago
           FROM (obsidian.pagamentos p_1
             LEFT JOIN obsidian.clientes c_1 ON ((c_1.id = p_1.cliente_id)))
          GROUP BY COALESCE(c_1.nome, p_1.nome_cliente)
        )
 SELECT b.nome AS "Nome Cliente",
    (COALESCE(c.total_comprado, (0)::numeric))::numeric(14,2) AS "Total Comprado",
    (COALESCE(p.total_pago, (0)::numeric))::numeric(14,2) AS "Total Pago",
    ((COALESCE(c.total_comprado, (0)::numeric) - COALESCE(p.total_pago, (0)::numeric)))::numeric(14,2) AS "Saldo"
   FROM ((base b
     LEFT JOIN compras c ON ((c.nome_cliente = b.nome)))
     LEFT JOIN pagos p ON ((p.nome_cliente = b.nome)))
  ORDER BY b.nome;;
CREATE VIEW "obsidian"."v_import_pendentes"
AS
 SELECT id,
    "Nº de Pedido da Plataforma",
    "Nº de Pedido",
    "Plataformas",
    "Nome da Loja no UpSeller",
    "Estado do Pedido",
    "3PL Status",
    "Hora do Pedido",
    "Hora do Pagamento",
    "Horário Programado",
    "Impressão da Etiqueta",
    "Enviado",
    "Horário de Saída",
    "Horário da Retirada",
    "Hora de Envio",
    "Pago",
    "Moeda",
    "Valor do Pedido",
    "Valor Total de Produtos",
    "Descontos e Cupons",
    "Comissão Total",
    "Frete do Comprador",
    "Total de Frete",
    "Lucro Estimado",
    "Notas do Comprador",
    "Observações",
    "Pós-venda/Cancelado/Devolvido",
    "Cancelado por",
    "Razão do Cancelamento",
    "Nome do Anúncio",
    "SKU",
    "Variação",
    "Link da Imagem",
    "Preço de Produto",
    "Qtd. do Produto",
    "NCM*",
    "Origem*",
    "Unidade*",
    "Imposto*",
    "SKU (Armazém)",
    "Nome do Produto",
    "Custo Médio",
    "Custo do Produto",
    "Armazém",
    "Nome de Comprador",
    "ID do Comprador",
    "Data de Registração",
    "ID da Taxa",
    "Nome do Destinatário",
    "Celular do Destinatário",
    "Telefone do Destinatário",
    "Endereço do Destinatário",
    "Nome de Empresa",
    "IE",
    "Endereço 1",
    "Endereço 2",
    "Número",
    "Bairro",
    "Cidade",
    "Estado",
    "CEP",
    "País/Região",
    "Comprador Designado",
    "Método de Envio",
    "Nº de Rastreio",
    "Método de coletar",
    "Etiqueta",
    client_id,
    import_id,
    original_filename,
    row_num,
    order_id,
    order_date,
    sku_text,
    qty,
    unit_price,
    total,
    customer,
    channel,
    matched_sku,
    match_score,
    match_source,
    status,
    error_msg,
    created_at,
    processed_at
   FROM raw_export_orders r
  WHERE ((status <> 'matched'::text) OR (matched_sku IS NULL));;
CREATE VIEW "obsidian"."v_kit_components"
AS
 SELECT p.sku AS kit_sku,
    upper(btrim((c.value ->> 'sku'::text))) AS component_sku,
    COALESCE(((c.value ->> 'q'::text))::numeric, (0)::numeric) AS qty
   FROM (obsidian.produtos p
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.kit_bom, '[]'::jsonb)) c(value))
  WHERE ((COALESCE(p.is_kit, false) = true) OR (lower(COALESCE(p.tipo_produto, ''::text)) = 'kit'::text));;
CREATE VIEW "obsidian"."v_kit_components_json"
AS
 SELECT t.sku AS kit_sku,
    (c.value ->> 'sku'::text) AS component_sku,
    ((c.value ->> 'qty'::text))::numeric AS qty
   FROM (obsidian.produtos t
     CROSS JOIN LATERAL jsonb_array_elements(t.kit_bom) c(value))
  WHERE t.is_kit;;
CREATE VIEW "obsidian"."v_pagamentos"
AS
 SELECT p.data_pagamento AS "Data Pagamento",
    COALESCE(c.nome, p.nome_cliente) AS "Nome Cliente",
    p.valor_pago AS "Valor Pago",
    p.forma_pagamento AS "Forma de Pagamento",
    p.observacoes AS "Observações"
   FROM (obsidian.pagamentos p
     LEFT JOIN obsidian.clientes c ON ((c.id = p.cliente_id)));;
CREATE VIEW "obsidian"."v_produtos_com_foto"
AS
 SELECT p.id,
    p.sku,
    p.nome,
    p.quantidade_atual,
    p.preco_unitario,
    p.tipo_produto,
    obsidian.extrair_produto_base(p.sku) AS produto_base,
    f.foto_url,
    f.foto_filename,
    f.id AS foto_id
   FROM (obsidian.produtos p
     LEFT JOIN obsidian.produto_fotos f ON ((obsidian.extrair_produto_base(p.sku) = (f.produto_base)::text)))
  ORDER BY p.sku;;
CREATE VIEW "obsidian"."v_receita_produto"
AS
 SELECT sku_produto AS "SKU Produto",
    sku_mp AS "SKU Matéria-Prima",
    quantidade_por_produto AS "Quantidade por Produto",
    unidade_medida AS "Unidade de Medida",
    valor_unitario AS "Valor Unitario",
    ((quantidade_por_produto * valor_unitario))::numeric(14,6) AS "Valor"
   FROM obsidian.receita_produto r;;
CREATE VIEW "obsidian"."v_vendas_expandidas_json"
AS
 SELECT v.venda_id,
    v.data_venda,
    v.nome_cliente,
    COALESCE(vc.component_sku, v.sku_produto) AS sku_baixa,
        CASE
            WHEN p.is_kit THEN (v.quantidade_vendida * vc.qty)
            ELSE v.quantidade_vendida
        END AS qtd_baixa,
    v.canal,
    v.fulfillment_ext
   FROM ((obsidian.vendas v
     JOIN obsidian.produtos p ON ((p.sku = v.sku_produto)))
     LEFT JOIN obsidian.v_kit_components_json vc ON (((vc.kit_sku = v.sku_produto) AND p.is_kit)));;
CREATE VIEW "obsidian"."v_vendas_flat"
AS
 SELECT data_venda AS "Data Venda",
    nome_cliente AS "Nome Cliente",
    sku_produto AS "SKU Produto",
    nome_produto AS "Nome Produto",
    quantidade_vendida AS "Quantidade Vendida",
    preco_unitario AS "Preço Unitário",
    valor_total AS "Valor Total",
    ext_id AS "ID",
    canal AS "Canal",
    criado_em AS "Criado Em"
   FROM obsidian.vendas v;;
CREATE VIEW "obsidian"."v_vendas_legacy"
AS
 SELECT data_venda AS "Data Venda",
    nome_cliente AS "Nome Cliente",
    sku_produto AS "SKU Produto",
    nome_produto AS "Nome Produto",
    quantidade_vendida AS "Quantidade Vendida",
    preco_unitario AS "Preço Unitário",
    valor_total AS "Valor Total",
    ext_id AS "ID",
    canal AS "Canal",
    criado_em AS "Criado Em",
    pedido_uid AS "Pedido UID"
   FROM obsidian.vendas;;
CREATE VIEW "public"."vw_export_orders_parsed"
AS
 SELECT id,
    "Nº de Pedido da Plataforma",
    "Nº de Pedido",
    "Plataformas",
    "Nome da Loja no UpSeller",
    "Estado do Pedido",
    "3PL Status",
    "Hora do Pedido",
    "Hora do Pagamento",
    "Horário Programado",
    "Impressão da Etiqueta",
    "Enviado",
    "Horário de Saída",
    "Horário da Retirada",
    "Hora de Envio",
    "Pago",
    "Moeda",
    "Valor do Pedido",
    "Valor Total de Produtos",
    "Descontos e Cupons",
    "Comissão Total",
    "Frete do Comprador",
    "Total de Frete",
    "Lucro Estimado",
    "Notas do Comprador",
    "Observações",
    "Pós-venda/Cancelado/Devolvido",
    "Cancelado por",
    "Razão do Cancelamento",
    "Nome do Anúncio",
    "SKU",
    "Variação",
    "Link da Imagem",
    "Preço de Produto",
    "Qtd. do Produto",
    "NCM*",
    "Origem*",
    "Unidade*",
    "Imposto*",
    "SKU (Armazém)",
    "Nome do Produto",
    "Custo Médio",
    "Custo do Produto",
    "Armazém",
    "Nome de Comprador",
    "ID do Comprador",
    "Data de Registração",
    "ID da Taxa",
    "Nome do Destinatário",
    "Celular do Destinatário",
    "Telefone do Destinatário",
    "Endereço do Destinatário",
    "Nome de Empresa",
    "IE",
    "Endereço 1",
    "Endereço 2",
    "Número",
    "Bairro",
    "Cidade",
    "Estado",
    "CEP",
    "País/Região",
    "Comprador Designado",
    "Método de Envio",
    "Nº de Rastreio",
    "Método de coletar",
    "Etiqueta",
    (NULLIF(replace("Valor do Pedido", ','::text, '.'::text), ''::text))::numeric AS "Valor do Pedido__num",
    (NULLIF(replace("Valor Total de Produtos", ','::text, '.'::text), ''::text))::numeric AS "Valor Total de Produtos__num",
    (NULLIF(replace("Comissão Total", ','::text, '.'::text), ''::text))::numeric AS "Comissão Total__num",
    (NULLIF(replace("Frete do Comprador", ','::text, '.'::text), ''::text))::numeric AS "Frete do Comprador__num",
    (NULLIF(replace("Total de Frete", ','::text, '.'::text), ''::text))::numeric AS "Total de Frete__num",
    (NULLIF(replace("Lucro Estimado", ','::text, '.'::text), ''::text))::numeric AS "Lucro Estimado__num",
    (NULLIF(replace("Preço de Produto", ','::text, '.'::text), ''::text))::numeric AS "Preço de Produto__num",
        CASE
            WHEN ("Hora do Pedido" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Hora do Pedido", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Hora do Pedido" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Hora do Pedido", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Hora do Pedido__ts",
        CASE
            WHEN ("Hora do Pagamento" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Hora do Pagamento", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Hora do Pagamento" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Hora do Pagamento", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Hora do Pagamento__ts",
        CASE
            WHEN ("Horário Programado" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Horário Programado", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Horário Programado" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Horário Programado", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Horário Programado__ts",
        CASE
            WHEN ("Horário de Saída" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Horário de Saída", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Horário de Saída" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Horário de Saída", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Horário de Saída__ts",
        CASE
            WHEN ("Horário da Retirada" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Horário da Retirada", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Horário da Retirada" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Horário da Retirada", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Horário da Retirada__ts",
        CASE
            WHEN ("Hora de Envio" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Hora de Envio", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Hora de Envio" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Hora de Envio", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Hora de Envio__ts",
        CASE
            WHEN ("Data de Registração" ~ '^\d{4}-\d{2}-\d{2}'::text) THEN to_timestamp("Data de Registração", 'YYYY-MM-DD HH24:MI:SS'::text)
            WHEN ("Data de Registração" ~ '^\d{2}/\d{2}/\d{4}'::text) THEN to_timestamp("Data de Registração", 'DD/MM/YYYY HH24:MI'::text)
            ELSE NULL::timestamp with time zone
        END AS "Data de Registração__ts"
   FROM raw_export_orders;;
CREATE VIEW "ui"."vw_full_itens"
AS
 SELECT fr.id AS full_raw_id,
    fr.envio_id,
    fe.envio_num,
    fe.client_id,
    c.nome AS cliente_interno,
    fr.sku_texto,
    fr.matched_sku,
    p.nome AS matched_produto_nome,
    fe.status AS envio_status,
        CASE
            WHEN (fr.matched_sku IS NULL) THEN 'PENDENTE'::text
            ELSE 'RELACIONADO'::text
        END AS status_match,
    (EXISTS ( SELECT 1
           FROM obsidian.vendas v
          WHERE ((v.pedido_uid = ('FULL:'::text || fe.envio_num)) AND (fr.matched_sku IS NOT NULL) AND (upper(v.sku_produto) = upper(fr.matched_sku))))) AS is_emitted
   FROM (((logistica.full_envio_raw fr
     JOIN logistica.full_envio fe ON ((fe.id = fr.envio_id)))
     LEFT JOIN obsidian.clientes c ON ((c.id = fe.client_id)))
     LEFT JOIN obsidian.produtos p ON ((p.sku = fr.matched_sku)));;
CREATE VIEW "ui"."vw_full_pendencias_sku"
AS
 SELECT full_raw_id,
    envio_id,
    envio_num,
    client_id,
    cliente_interno,
    sku_texto,
    matched_sku,
    matched_produto_nome,
    envio_status,
    status_match,
    is_emitted
   FROM ui.vw_full_itens
  WHERE (matched_sku IS NULL);;
CREATE VIEW "ui"."vw_full_relacionados"
AS
 SELECT full_raw_id,
    envio_id,
    envio_num,
    client_id,
    cliente_interno,
    sku_texto,
    matched_sku,
    matched_produto_nome,
    envio_status,
    status_match,
    is_emitted
   FROM ui.vw_full_itens
  WHERE (matched_sku IS NOT NULL);;

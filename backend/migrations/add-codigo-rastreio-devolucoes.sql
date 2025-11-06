-- Adicionar coluna codigo_rastreio na tabela devolucoes
-- Data: 06/11/2025

ALTER TABLE public.devolucoes 
ADD COLUMN IF NOT EXISTS codigo_rastreio VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_devolucoes_codigo_rastreio 
ON public.devolucoes (codigo_rastreio) 
WHERE codigo_rastreio IS NOT NULL;

COMMENT ON COLUMN public.devolucoes.codigo_rastreio IS 'Código de rastreio dos Correios/transportadora para devolução física';

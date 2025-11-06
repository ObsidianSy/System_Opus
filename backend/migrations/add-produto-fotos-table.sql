-- Criar tabela para armazenar fotos de produtos
-- Data: 06/11/2025

CREATE TABLE IF NOT EXISTS obsidian.produto_fotos (
  id SERIAL PRIMARY KEY,
  produto_base VARCHAR(255) NOT NULL, -- Nome base sem tamanho (ex: ATR-AZL, CH202-PRETO)
  foto_url TEXT NOT NULL, -- URL da foto (pode ser base64 ou caminho no servidor)
  foto_filename VARCHAR(255), -- Nome original do arquivo
  foto_size INTEGER, -- Tamanho em bytes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT ux_produto_fotos_base UNIQUE(produto_base)
);

-- Index para busca rápida
CREATE INDEX IF NOT EXISTS idx_produto_fotos_base ON obsidian.produto_fotos(produto_base);

-- Comentários
COMMENT ON TABLE obsidian.produto_fotos IS 'Fotos de produtos agrupadas por nome base (sem tamanho)';
COMMENT ON COLUMN obsidian.produto_fotos.produto_base IS 'Nome base do produto sem tamanho (ex: CH202-PRETO, ATR-AZL)';
COMMENT ON COLUMN obsidian.produto_fotos.foto_url IS 'URL da imagem ou data URI (base64)';

-- Função para extrair nome base (remove tamanho do final)
CREATE OR REPLACE FUNCTION obsidian.extrair_produto_base(sku TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    sku_upper TEXT;
    sku_clean TEXT;
BEGIN
    -- Converter para maiúsculas e remover espaços
    sku_upper := UPPER(TRIM(sku));
    
    -- Remover números do final (tamanho)
    -- Ex: ATR-AZL-37 → ATR-AZL
    -- Ex: CH202-PRETO-40 → CH202-PRETO
    sku_clean := REGEXP_REPLACE(sku_upper, '-?\d+$', '');
    
    -- Remover traço final se sobrou
    sku_clean := REGEXP_REPLACE(sku_clean, '-$', '');
    
    RETURN sku_clean;
END;
$$;

COMMENT ON FUNCTION obsidian.extrair_produto_base(TEXT) IS 
'Extrai o nome base do produto removendo o tamanho do final. Ex: ATR-AZL-37 → ATR-AZL';

-- View para produtos com suas fotos
CREATE OR REPLACE VIEW obsidian.v_produtos_com_foto AS
SELECT 
    p.id,
    p.sku,
    p.nome,
    p.quantidade_atual,
    p.preco_unitario,
    p.tipo_produto,
    obsidian.extrair_produto_base(p.sku) as produto_base,
    f.foto_url,
    f.foto_filename,
    f.id as foto_id
FROM obsidian.produtos p
LEFT JOIN obsidian.produto_fotos f ON obsidian.extrair_produto_base(p.sku) = f.produto_base
ORDER BY p.sku;

COMMENT ON VIEW obsidian.v_produtos_com_foto IS 
'View que relaciona produtos com suas fotos baseado no nome base (sem tamanho)';

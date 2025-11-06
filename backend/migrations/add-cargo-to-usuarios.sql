-- Adicionar coluna cargo à tabela usuarios
-- Cargos: 'adm' (administrador) ou 'operador' (padrão)

ALTER TABLE obsidian.usuarios
ADD COLUMN IF NOT EXISTS cargo VARCHAR(20) DEFAULT 'operador';

-- Criar campo created_at se não existir
ALTER TABLE obsidian.usuarios
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Atualizar primeiro usuário para ser admin
UPDATE obsidian.usuarios 
SET cargo = 'adm' 
WHERE id = (SELECT id FROM obsidian.usuarios LIMIT 1);

-- Comentário na coluna
COMMENT ON COLUMN obsidian.usuarios.cargo IS 'Cargo do usuário: adm (administrador) ou operador';

-- Index para busca por cargo
CREATE INDEX IF NOT EXISTS idx_usuarios_cargo ON obsidian.usuarios(cargo);

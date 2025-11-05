import { Router, Request, Response } from 'express';
import { pool } from '../database/db';

export const estoqueRouter = Router();

// GET - Listar todos os produtos
estoqueRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT 
        e.id,
        e.sku,
        e.nome,
        e.categoria,
        e.tipo_produto,
        e.quantidade_atual,
        e.unidade_medida,
        e.preco_unitario,
        e.ativo,
        e.criado_em,
        e.atualizado_em,
        e.kit_bom,
        e.is_kit,
        e.kit_bom_hash,
        COALESCE(
          json_agg(
            json_build_object(
              'sku_componente', ck.component_sku,
              'quantidade_por_kit', ck.qty
            )
          ) FILTER (WHERE ck.component_sku IS NOT NULL), '[]'
        ) as componentes
      FROM obsidian.produtos e
      LEFT JOIN obsidian.kit_components ck ON e.sku = ck.kit_sku
      GROUP BY e.id, e.sku, e.nome, e.categoria, e.tipo_produto, e.quantidade_atual, e.unidade_medida, e.preco_unitario, e.ativo, e.criado_em, e.atualizado_em, e.kit_bom, e.is_kit, e.kit_bom_hash
      ORDER BY e.criado_em DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar estoque:', error);
        res.status(500).json({ error: 'Erro ao buscar estoque' });
    }
});

// GET - Buscar produto por SKU
estoqueRouter.get('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const produtoResult = await pool.query(
            'SELECT * FROM obsidian.produtos WHERE sku = $1',
            [sku]
        );

        if (produtoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const componentesResult = await pool.query(
            `SELECT 
                component_sku as sku_componente,
                qty as quantidade_por_kit
             FROM obsidian.kit_components 
             WHERE kit_sku = $1`,
            [sku]
        );

        const produto = {
            ...produtoResult.rows[0],
            componentes: componentesResult.rows
        };

        res.json(produto);
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro ao buscar produto' });
    }
});

// POST - Criar novo produto
estoqueRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, componentes } = req.body;

        if (!sku || !nome_produto) {
            return res.status(400).json({ error: 'SKU e Nome são obrigatórios' });
        }

        await client.query('BEGIN');

        // Determinar se é kit baseado em componentes OU tipo_produto
        const isKit = (componentes && componentes.length > 0) || tipo_produto === 'KIT';

        // Insere produto (com is_kit)
        const produtoResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [sku, nome_produto, categoria, tipo_produto, quantidade_atual || 0, unidade_medida, preco_unitario || 0, isKit]
        );

        // Insere componentes se for kit
        if (componentes && componentes.length > 0) {
            for (const comp of componentes) {
                // Verificar se componente existe
                const componenteExists = await client.query(
                    'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                    [comp.sku_componente]
                );

                if (componenteExists.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        error: `Componente ${comp.sku_componente} não existe no estoque. Cadastre-o primeiro.`
                    });
                }

                await client.query(
                    `INSERT INTO obsidian.kit_components (kit_sku, component_sku, qty)
           VALUES ($1, $2, $3)`,
                    [sku, comp.sku_componente, comp.quantidade_por_kit]
                );
            }

            console.log(`✅ Kit ${sku} criado com ${componentes.length} componentes`);
        }

        await client.query('COMMIT');

        res.status(201).json(produtoResult.rows[0]);
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar produto:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Produto já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar produto', details: error.message });
    } finally {
        client.release();
    }
});

// PUT - Atualizar produto (upsert)
estoqueRouter.put('/:sku', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku } = req.params;
        const { nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, componentes } = req.body;

        await client.query('BEGIN');

        // Determinar se é kit baseado em componentes OU tipo_produto
        const isKit = (componentes && componentes.length > 0) || tipo_produto === 'KIT';

        // Upsert produto (com is_kit)
        const produtoResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (sku) 
       DO UPDATE SET 
         nome = EXCLUDED.nome,
         categoria = EXCLUDED.categoria,
         tipo_produto = EXCLUDED.tipo_produto,
         quantidade_atual = EXCLUDED.quantidade_atual,
         unidade_medida = EXCLUDED.unidade_medida,
         preco_unitario = EXCLUDED.preco_unitario,
         atualizado_em = NOW()
       RETURNING *`,
            [sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario]
        );

        // Atualiza componentes
        if (componentes !== undefined) {
            // Remove componentes antigos
            await client.query('DELETE FROM obsidian.kit_components WHERE kit_sku = $1', [sku]);

            // Insere novos componentes
            if (componentes.length > 0) {
                for (const comp of componentes) {
                    // Verificar se componente existe
                    const componenteExists = await client.query(
                        'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                        [comp.sku_componente]
                    );

                    if (componenteExists.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            error: `Componente ${comp.sku_componente} não existe no estoque. Cadastre-o primeiro.`
                        });
                    }

                    await client.query(
                        `INSERT INTO obsidian.kit_components (kit_sku, component_sku, qty)
           VALUES ($1, $2, $3)`,
                        [sku, comp.sku_componente, comp.quantidade_por_kit]
                    );
                }

                console.log(`✅ Kit ${sku} atualizado com ${componentes.length} componentes`);
            }
        }

        await client.query('COMMIT');

        res.json(produtoResult.rows[0]);
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao atualizar produto:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto', details: error.message });
    } finally {
        client.release();
    }
});

// DELETE - Excluir produto
estoqueRouter.delete('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.produtos WHERE sku = $1 RETURNING *',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.status(500).json({ error: 'Erro ao excluir produto' });
    }
});

// POST - Registrar entrada de produto no estoque
estoqueRouter.post('/entrada', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku, quantidade, origem_tabela, origem_id, observacao } = req.body;

        if (!sku || !quantidade) {
            return res.status(400).json({ error: 'SKU e quantidade são obrigatórios' });
        }

        if (quantidade <= 0) {
            return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
        }

        await client.query('BEGIN');

        // Verificar se produto existe
        const produtoCheck = await client.query(
            'SELECT sku, nome, quantidade_atual FROM obsidian.produtos WHERE sku = $1',
            [sku]
        );

        if (produtoCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const produto = produtoCheck.rows[0];

        // Registrar movimento de estoque
        await client.query(
            `INSERT INTO obsidian.estoque_movimentos (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [sku, origem_tabela || 'manual', quantidade, origem_tabela || 'manual', origem_id, observacao]
        );

        // Atualizar quantidade atual do produto
        const updateResult = await client.query(
            `UPDATE obsidian.produtos 
             SET quantidade_atual = quantidade_atual + $1,
                 atualizado_em = NOW()
             WHERE sku = $2
             RETURNING quantidade_atual`,
            [quantidade, sku]
        );

        await client.query('COMMIT');

        const saldoAtual = updateResult.rows[0].quantidade_atual;

        res.json({
            success: true,
            message: 'Entrada registrada com sucesso',
            sku,
            nome_produto: produto.nome,
            quantidade_adicionada: quantidade,
            saldo_anterior: parseFloat(produto.quantidade_atual),
            saldo_atual: parseFloat(saldoAtual)
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao registrar entrada:', error);
        res.status(500).json({ error: 'Erro ao registrar entrada de produto' });
    } finally {
        client.release();
    }
});

// PATCH - Atualizar quantidade do produto (entrada/saída manual)
estoqueRouter.patch('/:sku/quantidade', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const { quantidade } = req.body;

        if (quantidade === undefined) {
            return res.status(400).json({ error: 'Quantidade é obrigatória' });
        }

        const result = await pool.query(
            `UPDATE obsidian.produtos 
       SET quantidade_atual = $1
       WHERE sku = $2
       RETURNING *`,
            [quantidade, sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar quantidade:', error);
        res.status(500).json({ error: 'Erro ao atualizar quantidade' });
    }
});

// POST - Buscar kit por composição (substitui webhook N8N)
estoqueRouter.post('/kits/find-by-composition', async (req: Request, res: Response) => {
    try {
        // Aceita tanto 'componentes' quanto 'components' (compatibilidade)
        const componentes = req.body.componentes || req.body.components;

        console.log('🔍 [find-by-composition] Payload recebido:', req.body);
        console.log('📦 [find-by-composition] Componentes extraídos:', componentes);

        if (!componentes || !Array.isArray(componentes) || componentes.length === 0) {
            console.log('❌ [find-by-composition] Componentes inválidos');
            return res.status(400).json({ error: 'Componentes são obrigatórios' });
        }

        // Buscar kits que contenham EXATAMENTE esses componentes
        // Converte array de componentes em formato para query
        const componentSkus = componentes.map((c: any) => c.sku || c.sku_componente).filter(Boolean);

        console.log('🎯 [find-by-composition] SKUs a buscar:', componentSkus);

        if (componentSkus.length === 0) {
            return res.status(400).json({ error: 'SKUs de componentes inválidos' });
        }

        // Query para encontrar kits que contenham os componentes
        // Buscar no kit_bom (JSONB) ao invés de kit_components (que não existe)
        const result = await pool.query(
            `SELECT 
                p.sku as kit_sku,
                p.nome as kit_nome,
                p.preco_unitario as kit_preco,
                p.kit_bom as componentes_do_kit
            FROM obsidian.produtos p
            WHERE p.kit_bom IS NOT NULL
              AND jsonb_array_length(p.kit_bom) = $1
            ORDER BY p.sku
            LIMIT 50`,
            [componentSkus.length]
        );

        // Filtrar manualmente os kits que têm EXATAMENTE os componentes solicitados
        const kitsMatch = result.rows.filter(kit => {
            const kitComponents = kit.componentes_do_kit as any[];

            // Verificar se tem a mesma quantidade de componentes
            if (kitComponents.length !== componentSkus.length) return false;

            // Verificar se todos os SKUs solicitados estão no kit
            const kitSkus = kitComponents.map((c: any) => c.sku?.toUpperCase()).sort();
            const requestedSkus = componentSkus.map((s: string) => s.toUpperCase()).sort();

            return JSON.stringify(kitSkus) === JSON.stringify(requestedSkus);
        });

        if (kitsMatch.length === 0) {
            return res.json({
                sku_kit: null,
                found: false,
                message: 'Nenhum kit encontrado com essa composição exata',
                kits: []
            });
        }

        // Retorna o primeiro kit encontrado no formato esperado pelo frontend
        const firstKit = kitsMatch[0];

        res.json({
            sku_kit: firstKit.kit_sku,
            found: true,
            kits: kitsMatch.map(row => ({
                sku: row.kit_sku,
                nome: row.kit_nome,
                preco_unitario: parseFloat(row.kit_preco),
                componentes: row.componentes_do_kit
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar kit por composição:', error);
        res.status(500).json({ error: 'Erro ao buscar kit por composição' });
    }
});

// POST - Criar kit e relacionar (substitui webhook N8N)
estoqueRouter.post('/kits/create-and-relate', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        // Aceita 2 formatos:
        // 1) { sku, nome, componentes, preco_unitario } (direto)
        // 2) { raw_id, kit: { nome, categoria, preco_unitario }, components: [...] } (do frontend)

        let sku = req.body.sku;
        let nome = req.body.nome;
        let componentes = req.body.componentes || req.body.components;
        let preco_unitario = req.body.preco_unitario;
        let raw_id = req.body.raw_id;

        console.log('🎁 [create-and-relate] Payload recebido:', req.body);

        // Se formato frontend (com kit e components)
        if (req.body.kit) {
            nome = req.body.kit.nome;
            preco_unitario = req.body.kit.preco_unitario;
        }

        // Se não tem SKU, gera automaticamente baseado nos componentes
        if (!sku && componentes && componentes.length > 0) {
            const componentSkus = componentes
                .map((c: any) => c.sku || c.sku_componente)
                .filter(Boolean)
                .sort()
                .join('-');

            sku = `KIT-${componentSkus.substring(0, 50)}`;
            console.log('🔧 [create-and-relate] SKU gerado:', sku);
        }

        if (!nome || !componentes || !Array.isArray(componentes) || componentes.length === 0) {
            console.log('❌ [create-and-relate] Dados inválidos:', { nome, componentes });
            return res.status(400).json({ error: 'Nome e componentes são obrigatórios' });
        }

        await client.query('BEGIN');

        // Criar o kit
        // Temporariamente criar com kit_bom vazio (será preenchido depois)
        const kitResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, ativo, kit_bom)
     VALUES ($1, $2, 'KIT', 0, 'UN', $3, true, '[]'::jsonb)
     ON CONFLICT (sku) DO UPDATE SET
       nome = EXCLUDED.nome,
       preco_unitario = EXCLUDED.preco_unitario,
       atualizado_em = NOW()
     RETURNING *`,
            [sku, nome, preco_unitario || 0]
        );

        // Remover componentes antigos (caso seja update)
        // Montar o array de componentes no formato { sku, qty }
        const kitBomArray = [];
        for (const comp of componentes) {
            const compSku = comp.sku || comp.sku_componente;
            const compQty = comp.q || comp.qty || comp.quantidade_por_kit || 1;

            if (!compSku) continue;

            console.log('📦 [create-and-relate] Processando componente:', { compSku, compQty });

            // Verificar se componente existe
            const componenteExists = await client.query(
                'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                [compSku]
            );

            if (componenteExists.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log('❌ [create-and-relate] Componente não existe:', compSku);
                return res.status(400).json({
                    error: `Componente ${compSku} não existe no estoque. Cadastre-o primeiro.`
                });
            }

            // Adicionar ao array kit_bom
            kitBomArray.push({ sku: compSku, qty: compQty });
        }

        // Atualizar a coluna kit_bom com os componentes
        const kitBomJson = JSON.stringify(kitBomArray);
        await client.query(
            `UPDATE obsidian.produtos
     SET kit_bom = $1::jsonb
     WHERE sku = $2`,
            [kitBomJson, sku]
        );

        console.log('✅ kit_bom atualizado:', kitBomJson);

        // 🔥 AUTO-RELACIONAMENTO EM LOTE: Relacionar TODOS os itens pendentes com o mesmo nome
        console.log('� [create-and-relate] Buscando TODOS os registros pendentes com nome:', nome);

        const bulkUpdateResult = await client.query(
            `UPDATE logistica.full_envio_raw 
             SET matched_sku = $1, 
                 status = 'matched',
                 processed_at = NOW()
             WHERE UPPER(sku_texto) = UPPER($2) 
               AND (status = 'pending' OR matched_sku IS NULL)
             RETURNING id, sku_texto, matched_sku`,
            [sku, nome]
        );

        if (bulkUpdateResult.rows.length > 0) {
            console.log(`✅ [create-and-relate] ${bulkUpdateResult.rows.length} registro(s) relacionado(s) automaticamente!`);
            console.log('📦 IDs relacionados:', bulkUpdateResult.rows.map(r => r.id).join(', '));
        } else {
            console.log('⚠️ [create-and-relate] Nenhum registro pendente encontrado para relacionar');
        }

        // 🏷️ CRIAR ALIAS: Para que próximos pedidos sejam auto-relacionados na importação
        console.log('🏷️ [create-and-relate] Criando alias:', nome, '→', sku);

        try {
            // Verificar se alias já existe
            const aliasExists = await client.query(
                `SELECT id FROM obsidian.sku_aliases 
                 WHERE UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                       UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))`,
                [nome]
            );

            if (aliasExists.rows.length === 0) {
                await client.query(
                    `INSERT INTO obsidian.sku_aliases (alias_text, sku_produto, source)
                     VALUES ($1, $2, 'kit_auto')
                     ON CONFLICT DO NOTHING`,
                    [nome, sku]
                );
                console.log('✅ [create-and-relate] Alias criado! Próximos pedidos serão auto-relacionados.');
            } else {
                console.log('ℹ️ [create-and-relate] Alias já existe, pulando criação.');
            }
        } catch (aliasError: any) {
            console.log('⚠️ [create-and-relate] Erro ao criar alias (não crítico):', aliasError.message);
        }

        await client.query('COMMIT');

        console.log(`✅ Kit ${sku} criado/atualizado com ${componentes.length} componentes`);

        res.json({
            success: true,
            sku_kit: sku,
            matched: !!raw_id,
            kit: kitResult.rows[0],
            componentes_count: componentes.length
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar kit:', error);
        res.status(500).json({ error: 'Erro ao criar kit', details: error.message });
    } finally {
        client.release();
    }
});


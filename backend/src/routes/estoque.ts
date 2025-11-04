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
            `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, is_kit)
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
            `INSERT INTO obsidian.produtos (sku, nome, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, is_kit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (sku) 
       DO UPDATE SET 
         nome = EXCLUDED.nome,
         categoria = EXCLUDED.categoria,
         tipo_produto = EXCLUDED.tipo_produto,
         quantidade_atual = EXCLUDED.quantidade_atual,
         unidade_medida = EXCLUDED.unidade_medida,
         preco_unitario = EXCLUDED.preco_unitario,
         is_kit = EXCLUDED.is_kit,
         atualizado_em = NOW()
       RETURNING *`,
            [sku, nome_produto, categoria, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, isKit]
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

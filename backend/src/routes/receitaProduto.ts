import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { optionalAuth } from '../middleware/authMiddleware';

export const receitaProdutoRouter = Router();

// Aplicar middleware de autenticação opcional em todas as rotas
receitaProdutoRouter.use(optionalAuth);

// GET - Listar todas as receitas
receitaProdutoRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT 
        e.sku as sku_produto,
        e.nome as nome_produto,
        json_agg(
          json_build_object(
            'sku_mp', rp.sku_mp,
            'quantidade_por_produto', rp.quantidade_por_produto,
            'unidade_medida', rp.unidade_medida,
            'valor_unitario', rp.valor_unitario,
            'nome_materia_prima', COALESCE(mp.nome, mp.nome_materia_prima, mp.id)
          ) ORDER BY rp.id
        ) as items
      FROM obsidian.receita_produto rp
      JOIN obsidian.produtos e ON rp.sku_produto = e.sku
      LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku OR rp.sku_mp = mp.id OR rp.sku_mp = mp.sku_materia_prima
      GROUP BY e.sku, e.nome
      ORDER BY e.nome
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar receitas:', error);
        res.status(500).json({ error: 'Erro ao buscar receitas' });
    }
});

// GET - Buscar receita por SKU do produto
receitaProdutoRouter.get('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(`
      SELECT 
        rp.*,
        COALESCE(mp.nome, mp.nome_materia_prima, mp.id) as nome_materia_prima
      FROM obsidian.receita_produto rp
      LEFT JOIN obsidian.materia_prima mp ON rp.sku_mp = mp.sku OR rp.sku_mp = mp.id OR rp.sku_mp = mp.sku_materia_prima
      WHERE rp.sku_produto = $1
      ORDER BY rp.id
    `, [sku]);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar receita:', error);
        res.status(500).json({ error: 'Erro ao buscar receita' });
    }
});

// POST - Criar/atualizar receita de produto
receitaProdutoRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { sku_produto, items } = req.body;

        if (!sku_produto || !items || items.length === 0) {
            return res.status(400).json({ error: 'SKU do produto e itens são obrigatórios' });
        }

        await client.query('BEGIN');

        // Remove receita anterior
        await client.query('DELETE FROM obsidian.receita_produto WHERE sku_produto = $1', [sku_produto]);

        // Insere nova receita
        for (const item of items) {
            await client.query(
                `INSERT INTO obsidian.receita_produto (sku_produto, sku_mp, quantidade_por_produto, unidade_medida, valor_unitario)
         VALUES ($1, $2, $3, $4, $5)`,
                [sku_produto, item.sku_mp, item.quantidade_por_produto, item.unidade_medida, item.valor_unitario || 0]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({ message: 'Receita salva com sucesso', sku_produto });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao salvar receita:', error);
        res.status(500).json({ error: 'Erro ao salvar receita' });
    } finally {
        client.release();
    }
});

// DELETE - Excluir receita de produto
receitaProdutoRouter.delete('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.receita_produto WHERE sku_produto = $1 RETURNING *',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Receita não encontrada' });
        }

        res.json({ message: 'Receita excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir receita:', error);
        res.status(500).json({ error: 'Erro ao excluir receita' });
    }
});

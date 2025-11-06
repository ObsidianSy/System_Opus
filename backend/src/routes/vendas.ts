import { Router, Request, Response } from 'express';
import { pool } from '../database/db';

export const vendasRouter = Router();

// GET - Listar todas as vendas (com filtro opcional por SKU)
vendasRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { sku_produto } = req.query;

        let query = 'SELECT * FROM obsidian.vendas';
        let params: any[] = [];

        if (sku_produto) {
            query += ' WHERE sku_produto = $1';
            params.push(sku_produto);
        }

        query += ' ORDER BY data_venda DESC';

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar vendas:', error);
        res.status(500).json({ error: 'Erro ao buscar vendas' });
    }
});

// GET - Buscar venda por ID
vendasRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM obsidian.vendas WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar venda:', error);
        res.status(500).json({ error: 'Erro ao buscar venda' });
    }
});

// POST - Criar nova venda (inserir itens de venda)
vendasRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { data_venda, nome_cliente, items, canal, pedido_uid } = req.body;

        if (!data_venda || !nome_cliente || !items || items.length === 0) {
            return res.status(400).json({ error: 'Dados obrigatórios ausentes (data_venda, nome_cliente, items)' });
        }

        await client.query('BEGIN');

        const insertedItems = [];

        for (const item of items) {
            const result = await client.query(
                `INSERT INTO obsidian.vendas (
                    data_venda, 
                    nome_cliente, 
                    sku_produto, 
                    quantidade_vendida, 
                    preco_unitario, 
                    valor_total,
                    nome_produto,
                    canal,
                    pedido_uid
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *`,
                [
                    data_venda,
                    nome_cliente,
                    item.sku_produto,
                    item.quantidade_vendida,
                    item.preco_unitario,
                    parseFloat(item.quantidade_vendida) * parseFloat(item.preco_unitario),
                    item.nome_produto || null,
                    canal || null,
                    pedido_uid || null
                ]
            );

            insertedItems.push(result.rows[0]);
        }

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Venda criada com sucesso',
            items: insertedItems
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar venda:', error);
        res.status(500).json({ error: 'Erro ao criar venda', details: error.message });
    } finally {
        client.release();
    }
});

// DELETE - Excluir venda
vendasRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.vendas WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }

        res.json({ message: 'Venda excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir venda:', error);
        res.status(500).json({ error: 'Erro ao excluir venda' });
    }
});

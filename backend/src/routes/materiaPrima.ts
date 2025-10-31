import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';

export const materiaPrimaRouter = Router();

// GET - Listar todas as matérias-primas
materiaPrimaRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT * FROM obsidian.materia_prima
      ORDER BY criado_em DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar matérias-primas:', error);
        res.status(500).json({ error: 'Erro ao buscar matérias-primas' });
    }
});

// GET - Buscar matéria-prima por SKU
materiaPrimaRouter.get('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const result = await pool.query(
            'SELECT * FROM obsidian.materia_prima WHERE sku = $1',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao buscar matéria-prima' });
    }
});

// POST - Criar nova matéria-prima
materiaPrimaRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { id_materia_prima, sku_materia_prima, nome_materia_prima, categoria, quantidade_atual, unidade_medida, preco_unitario } = req.body;

        if (!id_materia_prima || !sku_materia_prima || !nome_materia_prima) {
            return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
        }

        const result = await pool.query(
            `INSERT INTO obsidian.materia_prima (id, sku, nome, categoria, quantidade_atual, unidade_medida, preco_unitario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [id_materia_prima, sku_materia_prima, nome_materia_prima, categoria, quantidade_atual || 0, unidade_medida, preco_unitario || 0]
        );

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Erro ao criar matéria-prima:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Matéria-prima já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar matéria-prima' });
    }
});

// PUT - Atualizar matéria-prima (upsert)
materiaPrimaRouter.put('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;
        const { id_materia_prima, nome_materia_prima, categoria, quantidade_atual, unidade_medida, preco_unitario } = req.body;

        const result = await pool.query(
            `INSERT INTO obsidian.materia_prima (id, sku, nome, categoria, quantidade_atual, unidade_medida, preco_unitario)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (sku) 
       DO UPDATE SET 
         nome = EXCLUDED.nome,
         categoria = EXCLUDED.categoria,
         quantidade_atual = EXCLUDED.quantidade_atual,
         unidade_medida = EXCLUDED.unidade_medida,
         preco_unitario = EXCLUDED.preco_unitario
       RETURNING *`,
            [id_materia_prima, sku, nome_materia_prima, categoria, quantidade_atual, unidade_medida, preco_unitario]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao atualizar matéria-prima' });
    }
});

// DELETE - Excluir matéria-prima
materiaPrimaRouter.delete('/:sku', async (req: Request, res: Response) => {
    try {
        const { sku } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.materia_prima WHERE sku = $1 RETURNING *',
            [sku]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Matéria-prima não encontrada' });
        }

        res.json({ message: 'Matéria-prima excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir matéria-prima:', error);
        res.status(500).json({ error: 'Erro ao excluir matéria-prima' });
    }
});

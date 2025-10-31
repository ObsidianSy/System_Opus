import { Router, Request, Response } from 'express';
import { pool } from '../database/db.js';
import { buildIdempotencyKey } from '../utils/normalizers.js';

export const pagamentosRouter = Router();

// GET - Listar todos os pagamentos
pagamentosRouter.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT * FROM obsidian.pagamentos
      ORDER BY data_pagamento DESC
    `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar pagamentos:', error);
        res.status(500).json({ error: 'Erro ao buscar pagamentos' });
    }
});

// GET - Buscar pagamento por ID
pagamentosRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM obsidian.pagamentos WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pagamento não encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar pagamento:', error);
        res.status(500).json({ error: 'Erro ao buscar pagamento' });
    }
});

// POST - Criar novo pagamento (com idempotency_key)
pagamentosRouter.post('/', async (req: Request, res: Response) => {
    try {
        const { id_pagamento, data_pagamento, id_cliente, nome_cliente, valor_pago, forma_pagamento, observacoes } = req.body;

        if (!data_pagamento || !valor_pago || !nome_cliente) {
            return res.status(400).json({ error: 'data_pagamento, valor_pago e nome_cliente são obrigatórios' });
        }

        // Gerar idempotency_key usando helper
        const idempotency_key = buildIdempotencyKey(data_pagamento, nome_cliente, valor_pago, forma_pagamento);

        const result = await pool.query(
            `INSERT INTO obsidian.pagamentos (id, data_pagamento, id_cliente, nome_cliente, valor_pago, forma_pagamento, observacoes, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
            [id_pagamento, data_pagamento, id_cliente, nome_cliente, valor_pago, forma_pagamento, observacoes, idempotency_key]
        );

        if (result.rows.length === 0) {
            // Pagamento duplicado (idempotency)
            return res.status(200).json({
                message: 'Pagamento já registrado anteriormente (idempotency)',
                idempotency_key
            });
        }

        res.status(201).json(result.rows[0]);
    } catch (error: any) {
        console.error('Erro ao criar pagamento:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Pagamento já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar pagamento' });
    }
});

// DELETE - Excluir pagamento
pagamentosRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM obsidian.pagamentos WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pagamento não encontrado' });
        }

        res.json({ message: 'Pagamento excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir pagamento:', error);
        res.status(500).json({ error: 'Erro ao excluir pagamento' });
    }
});

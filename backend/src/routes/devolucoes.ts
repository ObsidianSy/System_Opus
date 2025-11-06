import { Router, Request, Response } from 'express';
import { pool } from '../database/db';

export const devolucoesRouter = Router();

// GET - Listar vendas canceladas pendentes de devolução física
devolucoesRouter.get('/pendentes', async (req: Request, res: Response) => {
    try {
        // Buscar vendas com status_venda = 'cancelado' que ainda não têm registro de devolução
        // ou têm devolução mas ainda não foram conferidas
        const query = `
            SELECT 
                v.venda_id,
                v.data_venda,
                v.pedido_uid,
                v.nome_cliente,
                v.sku_produto,
                v.nome_produto,
                v.quantidade_vendida,
                v.canal,
                v.valor_total,
                v.fulfillment_ext,
                d.id as devolucao_id,
                d.quantidade_esperada,
                d.quantidade_recebida,
                d.condicao,
                d.conferido_em,
                d.conferido_por,
                d.observacoes
            FROM obsidian.vendas v
            LEFT JOIN obsidian.devolucoes d ON v.venda_id = d.venda_id
            WHERE 
                LOWER(v.status_venda) = 'cancelado'
                AND v.fulfillment_ext = false  -- Excluir vendas de fulfillment
                AND (d.id IS NULL OR d.conferido_em IS NULL)  -- Sem devolução ou não conferida
            ORDER BY v.data_venda DESC, v.venda_id DESC
        `;

        const result = await pool.query(query);

        res.json({
            total: result.rows.length,
            devoluções: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar devoluções pendentes:', error);
        res.status(500).json({ error: 'Erro ao buscar devoluções pendentes' });
    }
});

// GET - Histórico de devoluções já conferidas
devolucoesRouter.get('/historico', async (req: Request, res: Response) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const query = `
            SELECT 
                d.id,
                d.venda_id,
                d.sku_produto,
                d.quantidade_esperada,
                d.quantidade_recebida,
                d.condicao,
                d.conferido_em,
                d.conferido_por,
                d.observacoes,
                v.data_venda,
                v.pedido_uid,
                v.nome_cliente,
                v.nome_produto,
                v.canal,
                v.valor_total
            FROM obsidian.devolucoes d
            INNER JOIN obsidian.vendas v ON d.venda_id = v.venda_id
            WHERE d.conferido_em IS NOT NULL
            ORDER BY d.conferido_em DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, [limit, offset]);

        res.json({
            total: result.rows.length,
            histórico: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar histórico de devoluções:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// POST - Registrar ou atualizar conferência de devolução
devolucoesRouter.post('/conferir', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const {
            venda_id,
            sku_produto,
            quantidade_esperada,
            quantidade_recebida,
            condicao,
            conferido_por,
            observacoes
        } = req.body;

        // Validações
        if (!venda_id || !sku_produto || quantidade_esperada === undefined || quantidade_recebida === undefined) {
            return res.status(400).json({
                error: 'Campos obrigatórios: venda_id, sku_produto, quantidade_esperada, quantidade_recebida'
            });
        }

        if (!['bom', 'defeito'].includes(condicao)) {
            return res.status(400).json({
                error: 'Condição deve ser "bom" ou "defeito"'
            });
        }

        if (quantidade_recebida < 0 || quantidade_recebida > quantidade_esperada) {
            return res.status(400).json({
                error: 'Quantidade recebida inválida'
            });
        }

        await client.query('BEGIN');

        // Verificar se já existe registro de devolução para esta venda
        const checkExisting = await client.query(
            'SELECT id FROM obsidian.devolucoes WHERE venda_id = $1 AND sku_produto = $2',
            [venda_id, sku_produto]
        );

        let devolverId: number;

        if (checkExisting.rows.length > 0) {
            // Atualizar registro existente
            const updateResult = await client.query(
                `UPDATE obsidian.devolucoes 
                SET quantidade_esperada = $1,
                    quantidade_recebida = $2,
                    condicao = $3,
                    conferido_em = CURRENT_TIMESTAMP,
                    conferido_por = $4,
                    observacoes = $5
                WHERE venda_id = $6 AND sku_produto = $7
                RETURNING id`,
                [quantidade_esperada, quantidade_recebida, condicao, conferido_por, observacoes, venda_id, sku_produto]
            );
            devolverId = updateResult.rows[0].id;
        } else {
            // Criar novo registro
            const insertResult = await client.query(
                `INSERT INTO obsidian.devolucoes 
                (venda_id, sku_produto, quantidade_esperada, quantidade_recebida, condicao, conferido_em, conferido_por, observacoes)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)
                RETURNING id`,
                [venda_id, sku_produto, quantidade_esperada, quantidade_recebida, condicao, conferido_por, observacoes]
            );
            devolverId = insertResult.rows[0].id;
        }

        // Se condição for "bom", adicionar ao estoque
        if (condicao === 'bom' && quantidade_recebida > 0) {
            await client.query(
                `INSERT INTO obsidian.estoque_movimentos 
                (sku_produto, quantidade, tipo_movimento, observacao, usuario)
                VALUES ($1, $2, 'entrada', $3, $4)`,
                [
                    sku_produto,
                    quantidade_recebida,
                    `Devolução de venda cancelada (ID: ${venda_id})`,
                    conferido_por || 'sistema'
                ]
            );
        }

        // Registrar reversão financeira (crédito ao cliente)
        const vendaData = await client.query(
            'SELECT valor_total, nome_cliente, client_id FROM obsidian.vendas WHERE venda_id = $1',
            [venda_id]
        );

        if (vendaData.rows.length > 0) {
            const valorProporcional = (vendaData.rows[0].valor_total / quantidade_esperada) * quantidade_recebida;

            await client.query(
                `INSERT INTO obsidian.pagamentos 
                (client_id, tipo, valor, status, observacao, data_pagamento, metodo)
                VALUES ($1, 'credito', $2, 'confirmado', $3, CURRENT_DATE, 'devolucao')`,
                [
                    vendaData.rows[0].client_id,
                    valorProporcional,
                    `Crédito por devolução - Pedido ${venda_id} - ${sku_produto}`,
                ]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Devolução conferida com sucesso',
            devolucao_id: devolverId,
            estoque_atualizado: condicao === 'bom',
            quantidade_retornada_estoque: condicao === 'bom' ? quantidade_recebida : 0
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao conferir devolução:', error);
        res.status(500).json({ error: 'Erro ao conferir devolução' });
    } finally {
        client.release();
    }
});

// GET - Detalhes de uma devolução específica
devolucoesRouter.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                d.*,
                v.data_venda,
                v.pedido_uid,
                v.nome_cliente,
                v.nome_produto,
                v.canal,
                v.valor_total,
                v.quantidade_vendida
            FROM obsidian.devolucoes d
            INNER JOIN obsidian.vendas v ON d.venda_id = v.venda_id
            WHERE d.id = $1
        `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Devolução não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar devolução:', error);
        res.status(500).json({ error: 'Erro ao buscar devolução' });
    }
});

// DELETE - Cancelar registro de devolução (somente se não foi conferida)
devolucoesRouter.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Verificar se já foi conferida
        const check = await pool.query(
            'SELECT conferido_em FROM obsidian.devolucoes WHERE id = $1',
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Devolução não encontrada' });
        }

        if (check.rows[0].conferido_em) {
            return res.status(400).json({
                error: 'Não é possível excluir devolução já conferida'
            });
        }

        await pool.query('DELETE FROM obsidian.devolucoes WHERE id = $1', [id]);

        res.json({ success: true, message: 'Devolução cancelada' });
    } catch (error) {
        console.error('Erro ao cancelar devolução:', error);
        res.status(500).json({ error: 'Erro ao cancelar devolução' });
    }
});

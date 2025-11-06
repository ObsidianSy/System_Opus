import { Router, Request, Response } from 'express';
import { pool } from '../database/db';

export const devolucoesRouter = Router();

// GET - Listar devoluções pendentes de conferência
devolucoesRouter.get('/pendentes', async (req: Request, res: Response) => {
    try {
        const { search } = req.query;

        let query = `
            SELECT 
                d.id as devolucao_id,
                d.pedido_uid,
                d.sku_produto,
                d.quantidade_esperada,
                d.quantidade_recebida,
                d.tipo_problema,
                d.motivo_cancelamento,
                d.produto_real_recebido,
                d.conferido_em,
                d.conferido_por,
                d.observacoes,
                d.codigo_rastreio,
                d.created_at,
                pf.foto_url,
                v.venda_id as venda_id,
                v.data_venda,
                v.nome_cliente,
                v.nome_produto,
                v.quantidade_vendida as quantidade_vendida,
                v.canal,
                v.valor_total
            FROM public.devolucoes d
            LEFT JOIN obsidian.produto_fotos pf ON obsidian.extrair_produto_base(d.sku_produto) = pf.produto_base
            LEFT JOIN obsidian.vendas v ON v.pedido_uid = d.pedido_uid AND v.sku_produto = d.sku_produto
            WHERE d.conferido_em IS NULL  -- Ainda não conferida
        `;

        const params: any[] = [];

        // Adicionar filtro de busca se fornecido
        if (search && search.toString().trim() !== '') {
            const searchTerm = `%${search.toString().trim().toUpperCase()}%`;
            query += ` AND (
                UPPER(d.pedido_uid) LIKE $1 
                OR UPPER(d.codigo_rastreio) LIKE $1
                OR UPPER(d.sku_produto) LIKE $1
            )`;
            params.push(searchTerm);
        }

        query += ` ORDER BY d.created_at DESC`;

        const result = await pool.query(query, params);

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
                d.pedido_uid,
                d.sku_produto,
                d.quantidade_esperada,
                d.quantidade_recebida,
                d.tipo_problema,
                d.motivo_cancelamento,
                d.produto_real_recebido,
                d.conferido_em,
                d.conferido_por,
                d.observacoes,
                d.created_at
            FROM public.devolucoes d
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
            pedido_uid,
            sku_produto,
            quantidade_esperada,
            quantidade_recebida,
            tipo_problema,
            produto_real_recebido,
            conferido_por,
            observacoes
        } = req.body;

        // Validações
        if (!pedido_uid || !sku_produto || quantidade_esperada === undefined || quantidade_recebida === undefined) {
            return res.status(400).json({
                error: 'Campos obrigatórios: pedido_uid, sku_produto, quantidade_esperada, quantidade_recebida'
            });
        }

        if (!['correto_bom', 'correto_defeito', 'errado_bom', 'conferido'].includes(tipo_problema)) {
            return res.status(400).json({
                error: 'tipo_problema deve ser: correto_bom, correto_defeito, errado_bom ou conferido'
            });
        }

        // Se produto errado, precisa informar qual produto realmente veio
        if (tipo_problema === 'errado_bom' && !produto_real_recebido) {
            return res.status(400).json({
                error: 'Para tipo_problema=errado_bom, é obrigatório informar produto_real_recebido'
            });
        }

        if (quantidade_recebida < 0 || quantidade_recebida > quantidade_esperada) {
            return res.status(400).json({
                error: 'Quantidade recebida inválida'
            });
        }

        await client.query('BEGIN');

        // Atualizar registro existente de devolução
        const updateResult = await client.query(
            `UPDATE public.devolucoes 
            SET quantidade_recebida = $1,
                tipo_problema = $2,
                produto_real_recebido = $3,
                conferido_em = CURRENT_TIMESTAMP,
                conferido_por = $4,
                observacoes = $5
            WHERE pedido_uid = $6 AND sku_produto = $7
            RETURNING id`,
            [quantidade_recebida, tipo_problema, produto_real_recebido, conferido_por, observacoes, pedido_uid, sku_produto]
        );

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Devolução não encontrada para este pedido e SKU' });
        }

        const devolverId = updateResult.rows[0].id;

        // ✅ NOVA LÓGICA: Determinar qual SKU volta pro estoque
        let sku_para_estoque: string | null = null;

        if (tipo_problema === 'correto_bom' && quantidade_recebida > 0) {
            // Produto correto em bom estado → volta o SKU esperado
            sku_para_estoque = sku_produto;
        } else if (tipo_problema === 'errado_bom' && quantidade_recebida > 0 && produto_real_recebido) {
            // Produto errado mas em bom estado → volta o SKU que realmente veio
            sku_para_estoque = produto_real_recebido;
        } else if (tipo_problema === 'conferido' && quantidade_recebida > 0) {
            // Conferido genérico → volta o SKU esperado
            sku_para_estoque = sku_produto;
        }
        // tipo_problema === 'correto_defeito' → não volta nada pro estoque

        if (sku_para_estoque) {
            // Registrar movimento de estoque
            await client.query(
                `INSERT INTO obsidian.estoque_movimentos 
                (sku, tipo, quantidade, origem_tabela, origem_id, observacao)
                VALUES ($1, 'devolucao', $2, 'devolucoes', $3, $4)`,
                [
                    sku_para_estoque,
                    quantidade_recebida,
                    devolverId.toString(),
                    `Devolução conferida - ${tipo_problema} - Pedido ${pedido_uid}`
                ]
            );

            // Atualizar quantidade no produtos
            await client.query(
                `UPDATE obsidian.produtos 
                SET quantidade_atual = COALESCE(quantidade_atual, 0) + $1,
                    atualizado_em = NOW()
                WHERE UPPER(sku) = UPPER($2)`,
                [quantidade_recebida, sku_para_estoque]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Devolução conferida com sucesso',
            devolucao_id: devolverId,
            tipo_problema,
            sku_retornado_estoque: sku_para_estoque,
            quantidade_retornada_estoque: sku_para_estoque ? quantidade_recebida : 0
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
                d.*
            FROM public.devolucoes d
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
            'SELECT conferido_em FROM public.devolucoes WHERE id = $1',
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

        await pool.query('DELETE FROM public.devolucoes WHERE id = $1', [id]);

        res.json({ success: true, message: 'Devolução cancelada' });
    } catch (error) {
        console.error('Erro ao cancelar devolução:', error);
        res.status(500).json({ error: 'Erro ao cancelar devolução' });
    }
});

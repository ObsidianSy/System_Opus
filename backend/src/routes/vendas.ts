import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import { optionalAuth } from '../middleware/authMiddleware';

export const vendasRouter = Router();

// Aplicar middleware de autenticação opcional em todas as rotas
vendasRouter.use(optionalAuth);

// GET - Listar todas as vendas (com filtro opcional por SKU)
vendasRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { sku_produto } = req.query;

        let query = `
            SELECT 
                v.*,
                pf.foto_url
            FROM obsidian.vendas v
            LEFT JOIN obsidian.produto_fotos pf ON obsidian.extrair_produto_base(v.sku_produto) = pf.produto_base
        `;
        let params: any[] = [];

        if (sku_produto) {
            query += ' WHERE v.sku_produto = $1';
            params.push(sku_produto);
        }

        query += ' ORDER BY v.data_venda DESC';

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
            'SELECT * FROM obsidian.vendas WHERE venda_id = $1', // ✅ Corrigido: usar venda_id
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
// Usa obsidian.processar_pedido para seguir regras de negócio
vendasRouter.post('/', async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { data_venda, nome_cliente, items, canal, pedido_uid, client_id, import_id } = req.body;

        if (!data_venda || !nome_cliente || !items || items.length === 0) {
            return res.status(400).json({
                error: 'Dados obrigatórios ausentes (data_venda, nome_cliente, items)'
            });
        }

        if (!client_id) {
            return res.status(400).json({
                error: 'client_id é obrigatório (ID do cliente interno)'
            });
        }

        // Validar e filtrar items com quantidade > 0
        const validItems = items.filter((item: any) => {
            const qty = parseFloat(item.quantidade_vendida || item.quantidade || 0);
            return qty > 0;
        });

        if (validItems.length === 0) {
            return res.status(400).json({
                error: 'Nenhum item válido (quantidade deve ser > 0)'
            });
        }

        await client.query('BEGIN');

        // Montar JSON de items para processar_pedido
        const itemsJson = validItems.map((item: any) => ({
            sku: item.sku_produto || item.sku,
            quantidade: parseFloat(item.quantidade_vendida || item.quantidade),
            preco_unitario: parseFloat(item.preco_unitario || 0),
            nome_produto: item.nome_produto || 'Produto'
        }));

        // Chamar função processar_pedido que segue as regras de negócio
        const result = await client.query(
            `SELECT * FROM obsidian.processar_pedido(
                $1::text,  -- pedido_uid
                $2::date,  -- data_venda
                $3::text,  -- nome_cliente
                $4::text,  -- canal
                $5::jsonb, -- items
                $6::bigint, -- client_id
                $7::uuid   -- import_id
            )`,
            [
                pedido_uid || `MANUAL-${Date.now()}`,
                data_venda,
                nome_cliente,
                canal || 'MANUAL',
                JSON.stringify(itemsJson),
                client_id,
                import_id || null
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Venda criada com sucesso via processar_pedido',
            processamento: result.rows
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
            'DELETE FROM obsidian.vendas WHERE venda_id = $1 RETURNING *', // ✅ Corrigido: usar venda_id
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

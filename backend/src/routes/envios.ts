import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import { logActivity } from '../services/activityLogger';

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const upload = multer({ dest: 'uploads/' });

export const enviosRouter = Router();

// GET - Buscar detalhes de um envio específico com suas linhas
// Parâmetros: envio_id
enviosRouter.get('/:envio_id/detalhes', async (req: Request, res: Response) => {
    try {
        const { envio_id } = req.params;

        // Buscar dados do envio
        const envioResult = await pool.query(
            `SELECT e.*, c.nome as cliente_nome 
             FROM logistica.full_envio e
             JOIN obsidian.clientes c ON e.client_id = c.id
             WHERE e.id = $1`,
            [envio_id]
        );

        if (envioResult.rows.length === 0) {
            return res.status(404).json({ error: 'Envio não encontrado' });
        }

        const envio = envioResult.rows[0];

        // Buscar linhas matched
        const matchedResult = await pool.query(
            `SELECT id, row_num, codigo_ml, sku_texto, qtd, matched_sku, processed_at
             FROM logistica.full_envio_raw 
             WHERE envio_id = $1 AND status = 'matched'
             ORDER BY row_num`,
            [envio_id]
        );

        // Buscar linhas pending
        const pendingResult = await pool.query(
            `SELECT id, row_num, codigo_ml, sku_texto, qtd
             FROM logistica.full_envio_raw 
             WHERE envio_id = $1 AND status = 'pending'
             ORDER BY row_num`,
            [envio_id]
        );

        // Calcular resumo
        const resumo = {
            tot_itens: envio.tot_itens || 0,
            tot_qtd: parseFloat(envio.tot_qtd || 0),
            matched_itens: matchedResult.rows.length,
            matched_qtd: matchedResult.rows.reduce((sum, r) => sum + parseFloat(r.qtd), 0),
            pending_itens: pendingResult.rows.length,
            pending_qtd: pendingResult.rows.reduce((sum, r) => sum + parseFloat(r.qtd), 0)
        };

        res.json({
            envio: {
                envio_id: envio.id,
                envio_num: envio.envio_num,
                arquivo_nome: envio.arquivo_nome,
                cliente_nome: envio.cliente_nome,
                status: envio.status,
                created_at: envio.created_at,
                emitted_at: envio.emitted_at
            },
            resumo,
            registrados: matchedResult.rows,
            pendentes: pendingResult.rows
        });
    } catch (error: any) {
        console.error('Erro ao buscar detalhes do envio:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do envio', details: error.message });
    }
});

// GET - Lista todos os dados importados (ML ou FULL)
// Parâmetros: source=ML ou source=FULL, status, client_id, import_id, envio_num, etc.
// Se não passar envio_num mas passar client_id, retorna o envio mais recente do cliente
enviosRouter.get('/', async (req: Request, res: Response) => {
    try {
        const { source, status, client_id, import_id, envio_num, list_all_items } = req.query;

        // Se list_all_items=true, retorna TODOS os itens raw do cliente (não só o último envio)
        if (source === 'FULL' && client_id && !envio_num && list_all_items === 'true') {
            // Buscar ID do cliente (client_id pode vir como nome)
            let clientIdNum: number;
            if (isNaN(parseInt(client_id as string))) {
                const clientResult = await pool.query(
                    `SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($1)`,
                    [client_id]
                );
                if (clientResult.rows.length === 0) {
                    return res.json([]);
                }
                clientIdNum = parseInt(clientResult.rows[0].id);
            } else {
                clientIdNum = parseInt(client_id as string);
            }


            // Buscar todos os itens raw do cliente
            const clientItemsResult = await pool.query(
                `SELECT 
                    r.id as full_raw_id,
                    e.id as envio_id,
                    e.envio_num,
                    e.client_id,
                    r.sku_texto,
                    r.matched_sku,
                    e.status as envio_status,
                    r.status as status_match,
                    CASE 
                        WHEN r.processed_at IS NOT NULL THEN true
                        ELSE false
                    END as is_emitted
                 FROM logistica.full_envio_raw r
                 JOIN logistica.full_envio e ON r.envio_id = e.id
                 WHERE e.client_id = $1
                 ORDER BY e.id DESC, r.row_num
                 LIMIT 1000`,
                [clientIdNum]
            );

            return res.json(clientItemsResult.rows);
        }

        // Se tiver client_id mas não tiver envio_num, buscar o mais recente
        if (client_id && !envio_num && source === 'FULL') {
            // Buscar ID do cliente se for nome
            let clientIdNum: number;
            if (isNaN(parseInt(client_id as string))) {
                const clientResult = await pool.query(
                    `SELECT id FROM obsidian.clientes WHERE nome = $1`,
                    [client_id]
                );
                if (clientResult.rows.length === 0) {
                    return res.status(404).json({ error: `Cliente "${client_id}" não encontrado` });
                }
                clientIdNum = parseInt(clientResult.rows[0].id);
            } else {
                clientIdNum = parseInt(client_id as string);
            }

            // Buscar o envio mais recente do cliente
            const envioResult = await pool.query(
                `SELECT e.*, c.nome as cliente_nome 
                 FROM logistica.full_envio e
                 JOIN obsidian.clientes c ON e.client_id = c.id
                 WHERE e.client_id = $1
                 ORDER BY e.id DESC
                 LIMIT 1`,
                [clientIdNum]
            );

            if (envioResult.rows.length === 0) {
                return res.json({
                    envio: { envio_id: 0, envio_num: null },
                    resumo: { tot_itens: 0, tot_qtd: 0, registrados_itens: 0, registrados_qtd: 0, pendentes_itens: 0, pendentes_qtd: 0 },
                    registrados: [],
                    pendentes: []
                });
            }

            const envio = envioResult.rows[0];
            const envioId = envio.id;

            // Buscar linhas matched
            const matchedResult = await pool.query(
                `SELECT id as full_raw_id, row_num, codigo_ml, sku_texto as sku_texto, qtd, matched_sku, processed_at
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'matched'
                 ORDER BY row_num`,
                [envioId]
            );

            // Buscar linhas pending
            const pendingResult = await pool.query(
                `SELECT id as full_raw_id, id as raw_id, row_num, codigo_ml, sku_texto, qtd
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'
                 ORDER BY row_num`,
                [envioId]
            );

            // Calcular resumo
            const resumo = {
                tot_itens: envio.tot_itens || 0,
                tot_qtd: parseFloat(envio.tot_qtd || 0),
                registrados_itens: matchedResult.rows.length,
                registrados_qtd: matchedResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.qtd), 0),
                pendentes_itens: pendingResult.rows.length,
                pendentes_qtd: pendingResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.qtd), 0)
            };

            return res.json({
                envio: {
                    envio_id: envioId,
                    envio_num: envio.envio_num,
                    arquivo_nome: envio.arquivo_nome,
                    cliente_nome: envio.cliente_nome,
                    status: envio.status,
                    created_at: envio.created_at,
                    emitted_at: envio.emitted_at
                },
                resumo,
                registrados: matchedResult.rows,
                pendentes: pendingResult.rows
            });
        }

        // Se tiver envio_num, retorna detalhes específicos
        if (envio_num && client_id) {
            // Buscar ID do cliente se for nome
            let clientIdNum: number;
            if (isNaN(parseInt(client_id as string))) {
                const clientResult = await pool.query(
                    `SELECT id FROM obsidian.clientes WHERE nome = $1`,
                    [client_id]
                );
                if (clientResult.rows.length === 0) {
                    return res.status(404).json({ error: `Cliente "${client_id}" não encontrado` });
                }
                clientIdNum = parseInt(clientResult.rows[0].id);
            } else {
                clientIdNum = parseInt(client_id as string);
            }

            if (source === 'FULL') {
                // Buscar no logistica.full_envio
                const envioResult = await pool.query(
                    `SELECT e.*, c.nome as cliente_nome 
                     FROM logistica.full_envio e
                     JOIN obsidian.clientes c ON e.client_id = c.id
                     WHERE e.client_id = $1 AND e.envio_num = $2`,
                    [clientIdNum, envio_num]
                );

                if (envioResult.rows.length === 0) {
                    return res.json({
                        envio: { envio_id: 0, envio_num },
                        resumo: { tot_itens: 0, tot_qtd: 0, registrados_itens: 0, registrados_qtd: 0, pendentes_itens: 0, pendentes_qtd: 0 },
                        registrados: [],
                        pendentes: []
                    });
                }

                const envio = envioResult.rows[0];
                const envioId = envio.id;

                // Buscar linhas matched
                const matchedResult = await pool.query(
                    `SELECT id as full_raw_id, row_num, codigo_ml, sku_texto as sku_texto, qtd, matched_sku, processed_at
                     FROM logistica.full_envio_raw 
                     WHERE envio_id = $1 AND status = 'matched'
                     ORDER BY row_num`,
                    [envioId]
                );

                // Buscar linhas pending
                const pendingResult = await pool.query(
                    `SELECT id as full_raw_id, id as raw_id, row_num, codigo_ml, sku_texto, qtd
                     FROM logistica.full_envio_raw 
                     WHERE envio_id = $1 AND status = 'pending'
                     ORDER BY row_num`,
                    [envioId]
                );

                // Calcular resumo
                const resumo = {
                    tot_itens: envio.tot_itens || 0,
                    tot_qtd: parseFloat(envio.tot_qtd || 0),
                    registrados_itens: matchedResult.rows.length,
                    registrados_qtd: matchedResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.qtd), 0),
                    pendentes_itens: pendingResult.rows.length,
                    pendentes_qtd: pendingResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.qtd), 0)
                };

                return res.json({
                    envio: {
                        envio_id: envioId,
                        envio_num: envio.envio_num,
                        arquivo_nome: envio.arquivo_nome,
                        cliente_nome: envio.cliente_nome,
                        status: envio.status,
                        created_at: envio.created_at,
                        emitted_at: envio.emitted_at
                    },
                    resumo,
                    registrados: matchedResult.rows,
                    pendentes: pendingResult.rows
                });
            } else {
                // ML: buscar no import_batches
                const batchResult = await pool.query(
                    `SELECT * FROM obsidian.import_batches 
                     WHERE client_id = $1 AND source = $2 
                     AND (filename LIKE $3 OR import_id::text = $4)
                     ORDER BY started_at DESC LIMIT 1`,
                    [clientIdNum, source || 'ML', `%${envio_num}%`, envio_num]
                );

                if (batchResult.rows.length === 0) {
                    return res.json({
                        envio: { envio_id: 0, envio_num },
                        resumo: { tot_itens: 0, tot_qtd: 0, registrados_itens: 0, registrados_qtd: 0, pendentes_itens: 0, pendentes_qtd: 0 },
                        registrados: [],
                        pendentes: []
                    });
                }

                return res.json({
                    envio: {
                        envio_id: batchResult.rows[0].import_id,
                        envio_num: envio_num
                    },
                    resumo: {
                        tot_itens: batchResult.rows[0].total_rows || 0,
                        tot_qtd: batchResult.rows[0].total_rows || 0,
                        registrados_itens: batchResult.rows[0].processed_rows || 0,
                        registrados_qtd: batchResult.rows[0].processed_rows || 0,
                        pendentes_itens: (batchResult.rows[0].total_rows || 0) - (batchResult.rows[0].processed_rows || 0),
                        pendentes_qtd: (batchResult.rows[0].total_rows || 0) - (batchResult.rows[0].processed_rows || 0)
                    },
                    registrados: [],
                    pendentes: []
                });
            }
        }

        // Se source=FULL e não tem filtros específicos, retornar TODOS os itens
        if (source === 'FULL' && !envio_num && !client_id) {
            const allItemsResult = await pool.query(
                `SELECT 
                    r.id as full_raw_id,
                    e.id as envio_id,
                    e.envio_num,
                    e.client_id,
                    r.sku_texto,
                    r.matched_sku,
                    e.status as envio_status,
                    r.status as status_match,
                    CASE 
                        WHEN r.processed_at IS NOT NULL THEN true
                        ELSE false
                    END as is_emitted
                 FROM logistica.full_envio_raw r
                 JOIN logistica.full_envio e ON r.envio_id = e.id
                 ORDER BY e.id DESC, r.row_num
                 LIMIT 1000`
            );

            return res.json(allItemsResult.rows);
        }

        // Lista geral de batches
        let query = 'SELECT * FROM obsidian.import_batches WHERE 1=1';
        const params: any[] = [];

        if (source) {
            params.push(source);
            query += ` AND source = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }

        if (client_id && !isNaN(parseInt(client_id as string))) {
            params.push(parseInt(client_id as string));
            query += ` AND client_id = $${params.length}`;
        }

        if (import_id) {
            params.push(import_id);
            query += ` AND import_id = $${params.length}`;
        }

        query += ' ORDER BY started_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Erro ao buscar importações:', error);
        res.status(500).json({ error: 'Erro ao buscar importações', details: error.message });
    }
});

// POST - Upload de planilha (ML ou FULL)
// Body: file (multipart), client_id, source (ML ou FULL)
enviosRouter.post('/', upload.single('file'), async (req: MulterRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const { client_id, source = 'ML', envio_num, import_date } = req.body;
        const filename = req.file.originalname || req.file.filename;


        // Validar client_id obrigatório
        if (!client_id) {
            return res.status(400).json({ error: 'client_id é obrigatório' });
        }

        // Buscar ID do cliente se vier string (nome)
        let clientIdNum: number;
        if (isNaN(parseInt(client_id))) {
            // É um nome, buscar o ID
            const clientResult = await pool.query(
                `SELECT id FROM obsidian.clientes WHERE nome = $1`,
                [client_id]
            );

            if (clientResult.rows.length === 0) {
                return res.status(400).json({ error: `Cliente "${client_id}" não encontrado` });
            }

            clientIdNum = parseInt(clientResult.rows[0].id);
        } else {
            clientIdNum = parseInt(client_id);
        }

        // Processar Excel
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);


        // Log das colunas do Excel para debug
        if (jsonData.length > 0) {
        }

        if (source === 'FULL') {
            // 1. CRIAR LOTE (import_batches) - ID único do upload
            const batchResult = await pool.query(
                `INSERT INTO obsidian.import_batches 
                 (filename, source, client_id, status, total_rows, started_at, import_date) 
                 VALUES ($1, $2, $3, $4, $5, NOW(), $6) 
                 RETURNING *`,
                [filename, source, clientIdNum, 'processing', jsonData.length, import_date || null]
            );

            const importId = batchResult.rows[0].import_id;

            // Calcular totais
            const totalQtd = jsonData.reduce((sum: number, row: any) => {
                const qtd = parseFloat(
                    row['Unidades aptas para venda'] ||
                    row['Unidades processadas'] ||
                    row.Quantity ||
                    row.quantity ||
                    row.Quantidade ||
                    row.qtd ||
                    0
                );
                return sum + qtd;
            }, 0);

            // 2. CRIAR CABEÇALHO DO ENVIO (logistica.full_envio)
            const envioNumValue = envio_num || filename.split('.')[0].replace(/[^0-9]/g, '') || importId.toString();

            const envioResult = await pool.query(
                `INSERT INTO logistica.full_envio 
                 (client_id, envio_num, arquivo_nome, status, tot_itens, tot_qtd, import_date) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7) 
                 ON CONFLICT (client_id, envio_num) 
                 DO UPDATE SET 
                    arquivo_nome = EXCLUDED.arquivo_nome,
                    tot_itens = EXCLUDED.tot_itens,
                    tot_qtd = EXCLUDED.tot_qtd,
                    status = 'draft',
                    created_at = NOW(),
                    import_date = EXCLUDED.import_date
                 RETURNING id`,
                [clientIdNum, envioNumValue, filename, 'draft', jsonData.length, totalQtd, import_date || null]
            );

            const envioId = envioResult.rows[0].id;

            // LIMPAR LINHAS ANTIGAS SE FOR RE-UPLOAD (evitar duplicação)
            await pool.query(
                `DELETE FROM logistica.full_envio_raw WHERE envio_id = $1`,
                [envioId]
            );

            // 3. INSERIR LINHAS BRUTAS (logistica.full_envio_raw)
            // Cada linha carrega envio_id E import_id para rastreabilidade
            let insertedRows = 0;
            const errors: string[] = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];

                // Detectar colunas do Excel (formato Mercado Livre Full)
                // Colunas reais do Excel: 'CÃ³digo ML' (código ML), 'SKU' (SKU do produto), 'Unidades aptas para venda' (quantidade)
                const codigoMl = row['CÃ³digo ML'] || row['Código ML'] || row['codigo_ml'] || '';
                const skuTexto = row['SKU'] || row['sku'] || codigoMl; // Usar coluna SKU, fallback para código ML
                const qtd = parseFloat(
                    row['Unidades aptas para venda'] ||
                    row['Unidades processadas'] ||
                    row['Quantity'] ||
                    row['quantity'] ||
                    row['Quantidade'] ||
                    row['qtd'] ||
                    0
                );

                if (skuTexto && qtd > 0) {
                    try {
                        await pool.query(
                            `INSERT INTO logistica.full_envio_raw 
                             (envio_id, row_num, codigo_ml, sku_texto, qtd, status) 
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [envioId, i + 1, codigoMl, skuTexto, qtd, 'pending']
                        );
                        insertedRows++;
                    } catch (rowError: any) {
                        console.error(`Erro na linha ${i + 1}:`, rowError.message);
                        errors.push(`Linha ${i + 1}: ${rowError.message}`);
                    }
                } else {
                }
            }


            // 4. AUTO-RELACIONAR com aliases aprendidos
            let autoMatched = 0;

            if (insertedRows > 0) {
                // Buscar todas as linhas recém-inseridas
                const pendingRows = await pool.query(
                    `SELECT id, codigo_ml, sku_texto, qtd 
                     FROM logistica.full_envio_raw 
                     WHERE envio_id = $1 AND status = 'pending'`,
                    [envioId]
                );

                for (const row of pendingRows.rows) {
                    let matchedSku: string | null = null;
                    let matchSource: string = '';

                    // 1️⃣ PRIMEIRO: Buscar SKU exato na tabela produtos (igual n8n)
                    const produtoResult = await pool.query(
                        `SELECT sku 
                         FROM obsidian.produtos 
                         WHERE client_id = $1 
                           AND UPPER(sku) = UPPER(TRIM($2))
                         LIMIT 1`,
                        [clientIdNum, row.sku_texto]
                    );

                    if (produtoResult.rows.length > 0) {
                        matchedSku = produtoResult.rows[0].sku;
                        matchSource = 'produto_exato';
                    } else {
                        // 2️⃣ SEGUNDO: Buscar em aliases (codigo_ml ou sku_texto) com normalização
                        const aliasResult = await pool.query(
                            `SELECT stock_sku, confidence_default, id 
                             FROM obsidian.sku_aliases 
                             WHERE client_id = $1 
                               AND (
                                   UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                                   OR 
                                   UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($3, '[^A-Z0-9]', '', 'g'))
                               )
                             ORDER BY confidence_default DESC, times_used DESC 
                             LIMIT 1`,
                            [clientIdNum, row.codigo_ml, row.sku_texto]
                        );

                        if (aliasResult.rows.length > 0) {
                            matchedSku = aliasResult.rows[0].stock_sku;
                            matchSource = 'alias';

                            // Atualizar contador de uso do alias
                            await pool.query(
                                `UPDATE obsidian.sku_aliases 
                                 SET times_used = times_used + 1, 
                                     last_used_at = NOW() 
                                 WHERE id = $1`,
                                [aliasResult.rows[0].id]
                            );
                        }
                    }

                    // Se encontrou match (por produto ou alias), relacionar
                    if (matchedSku) {
                        await pool.query(
                            `UPDATE logistica.full_envio_raw 
                             SET matched_sku = $1, 
                                 status = 'matched', 
                                 processed_at = NOW() 
                             WHERE id = $2`,
                            [matchedSku, row.id]
                        );

                        autoMatched++;
                    }
                }

            }

            // Contar pendentes restantes
            const pendingCount = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'`,
                [envioId]
            );
            const remainingPending = parseInt(pendingCount.rows[0].count);

            console.log(`✅ Auto-relacionamento concluído: ${autoMatched} itens relacionados, ${remainingPending} pendentes`);

            // 5. NORMALIZAR E POPULAR full_envio_item (usando função do banco)
            // Esta função lê de full_envio_raw e popula full_envio_item com SKUs validados
            try {
                await pool.query(
                    `SELECT logistica.full_envio_normalizar($1::bigint)`,
                    [envioId]
                );
                console.log(`📦 Normalização concluída - full_envio_item populada`);
            } catch (normError: any) {
                console.error('⚠️ Erro ao normalizar:', normError.message);
                // Continua mesmo com erro na normalização
            }

            // 6. ATUALIZAR STATUS DO LOTE
            const finalStatus = insertedRows > 0 ? 'ready' : 'error';
            await pool.query(
                `UPDATE obsidian.import_batches 
                 SET processed_rows = $1, 
                     status = $2, 
                     finished_at = NOW()
                 WHERE import_id = $3`,
                [insertedRows, finalStatus, importId]
            );

            // 7. ATUALIZAR STATUS DO ENVIO
            // Nota: A função normalizar já atualiza o status (draft se tem pendentes, ready se tudo ok)
            // Mas vamos garantir que erros sejam marcados
            if (insertedRows === 0) {
                await pool.query(
                    `UPDATE logistica.full_envio 
                     SET status = 'error' 
                     WHERE id = $1`,
                    [envioId]
                );
            }

            // Registrar log de atividade
            try {
                await logActivity({
                    user_email: req.body.user_email || 'sistema',
                    user_name: req.body.user_name || 'Sistema',
                    action: 'upload_full',
                    entity_type: 'envio',
                    entity_id: envioId.toString(),
                    details: {
                        envio_num: envioNumValue,
                        filename,
                        total_linhas: jsonData.length,
                        auto_relacionadas: autoMatched,
                        pendentes: remainingPending,
                        client_id: clientIdNum
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent')
                });
            } catch (logError) {
                console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
            }

            res.json({
                success: true,
                import_id: importId,
                envio_id: envioId,
                envio_num: envioNumValue,
                total_linhas: jsonData.length,
                linhas_processadas: insertedRows,
                linhas_ignoradas: jsonData.length - insertedRows,
                auto_relacionadas: autoMatched,
                pendentes: remainingPending,
                errors: errors.length > 0 ? errors : undefined,
                batch: batchResult.rows[0],
                message: remainingPending === 0
                    ? '✅ Todos os itens foram relacionados automaticamente!'
                    : `✅ ${autoMatched} itens relacionados. ${remainingPending} aguardam relacionamento manual.`
            });
        } else {
            // ML: Manter lógica antiga com import_batches
            const result = await pool.query(
                `INSERT INTO obsidian.import_batches (filename, source, client_id, status, total_rows) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [filename, source, clientIdNum, 'processing', jsonData.length]
            );

            const batchId = result.rows[0].import_id;
            const processedRows = jsonData.length;

            await pool.query(
                `UPDATE obsidian.import_batches 
                 SET processed_rows = $1, status = 'ready', finished_at = NOW() 
                 WHERE import_id = $2`,
                [processedRows, batchId]
            );

            // Registrar log de atividade
            try {
                await logActivity({
                    user_email: req.body.user_email || 'sistema',
                    user_name: req.body.user_name || 'Sistema',
                    action: 'upload_ml',
                    entity_type: 'import_batch',
                    entity_id: batchId,
                    details: {
                        filename,
                        total_rows: jsonData.length,
                        client_id: clientIdNum,
                        envio_num: envio_num || batchId
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent')
                });
            } catch (logError) {
                console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
            }

            res.json({
                success: true,
                batch: result.rows[0],
                import_id: batchId,
                envio_num: envio_num || batchId,
                linhas: processedRows
            });
        }

        // Remove arquivo temporário
        fs.unlinkSync(req.file.path);
    } catch (error: any) {
        console.error('Erro ao importar planilha:', error);
        res.status(500).json({ error: 'Erro ao importar planilha', details: error.message });
    }
});

// GET - Buscar SKU para relacionamento
// Query: q (termo de busca), client_id, source
enviosRouter.get('/search-sku', async (req: Request, res: Response) => {
    try {
        const { q, client_id, source } = req.query;

        if (!q || !client_id) {
            return res.status(400).json({ error: 'Parâmetros q e client_id são obrigatórios' });
        }

        const searchTerm = (q as string).trim();
        const clientIdNum = parseInt(client_id as string);

        // Se for "*" ou vazio, retorna todos os SKUs
        if (searchTerm === '*' || searchTerm.length === 0) {
            const allSkusQuery = `
                SELECT 
                    sku,
                    nome,
                    preco_unitario,
                    quantidade_atual,
                    false as is_kit,
                    'all' as source,
                    1.0 as score
                FROM obsidian.produtos
                WHERE quantidade_atual > 0
                ORDER BY sku
                LIMIT 100
            `;
            const result = await pool.query(allSkusQuery);
            return res.json({ results: result.rows });
        }

        if (searchTerm.length < 2) {
            return res.json({ results: [] });
        }

        // Buscar em produtos e aliases
        // 1. Busca exata por SKU
        const exactQuery = `
            SELECT 
                sku,
                nome,
                preco_unitario,
                quantidade_atual,
                false as is_kit,
                'exact' as source,
                1.0 as score
            FROM obsidian.produtos
            WHERE UPPER(sku) = UPPER($1)
            LIMIT 1
        `;

        // 2. Busca por alias
        const aliasQuery = `
            SELECT 
                p.sku,
                p.nome,
                p.preco_unitario,
                p.quantidade_atual,
                false as is_kit,
                'alias' as source,
                0.95 as score
            FROM obsidian.sku_aliases a
            JOIN obsidian.produtos p ON UPPER(p.sku) = UPPER(a.stock_sku)
            WHERE a.client_id = $1
              AND UPPER(a.alias_text) = UPPER($2)
            LIMIT 5
        `;

        // 3. Busca por prefixo no SKU
        const prefixQuery = `
    SELECT 
        sku,
        nome,
        preco_unitario,
        quantidade_atual,
        false as is_kit,
        'prefix' as source,
        0.8 as score
    FROM obsidian.produtos
    WHERE UPPER(sku) LIKE UPPER($1) || '%'
    ORDER BY sku  -- ✅ ADICIONA ORDEM ALFABÉTICA
    LIMIT 10
`;

        // 4. Busca fuzzy (contém o termo)
        const fuzzyQuery = `
    SELECT 
        sku,
        nome,
        preco_unitario,
        quantidade_atual,
        false as is_kit,
        'fuzzy' as source,
        0.6 as score
    FROM obsidian.produtos
    WHERE UPPER(sku) LIKE '%' || UPPER($1) || '%'
       OR UPPER(nome) LIKE '%' || UPPER($1) || '%'
    ORDER BY 
        CASE 
            WHEN UPPER(sku) LIKE UPPER($1) || '%' THEN 0  -- Prefixo primeiro
            ELSE 1
        END,
        sku  -- Depois ordem alfabética
    LIMIT 10
`;

        // Executar buscas em paralelo
        const [exactResult, aliasResult, prefixResult, fuzzyResult] = await Promise.all([
            pool.query(exactQuery, [searchTerm]),
            pool.query(aliasQuery, [clientIdNum, searchTerm]),
            pool.query(prefixQuery, [searchTerm]),
            pool.query(fuzzyQuery, [searchTerm]),
        ]);

        // Combinar e deduplicar resultados
        const allResults = [
            ...exactResult.rows,
            ...aliasResult.rows,
            ...prefixResult.rows,
            ...fuzzyResult.rows,
        ];

        // Deduplicar por SKU (manter o de maior score)
        const uniqueResults = allResults.reduce((acc, current) => {
            const existing = acc.find((item: any) => item.sku === current.sku);
            if (!existing || existing.score < current.score) {
                return [...acc.filter((item: any) => item.sku !== current.sku), current];
            }
            return acc;
        }, [] as any[]);

        // Ordenar por score (maior primeiro)
        uniqueResults.sort((a: any, b: any) => b.score - a.score);

        // Limitar a 10 resultados
        const topResults = uniqueResults.slice(0, 10);

        res.json({ results: topResults });
    } catch (error: any) {
        console.error('Erro ao buscar SKU:', error);
        res.status(500).json({ error: 'Erro ao buscar SKU', details: error.message });
    }
});

// POST - Relacionar SKUs automaticamente (ML ou FULL)
// Body: envio_id (para FULL) ou import_id (para ML), source
enviosRouter.post('/relacionar', async (req: Request, res: Response) => {
    try {
        const { envio_id, import_id, source, client_id, raw_id, sku, learn_alias, alias_text } = req.body;

        // ========================================
        // RELACIONAMENTO MANUAL INDIVIDUAL (ML)
        // ========================================
        if (raw_id && sku) {
            console.log('📦 Relacionamento manual ML - raw_id:', raw_id, 'sku:', sku);

            // Buscar informações do item
            const itemResult = await pool.query(
                `SELECT id, order_id, sku_text, client_id 
                 FROM raw_export_orders 
                 WHERE id = $1`,
                [raw_id]
            );

            if (itemResult.rows.length === 0) {
                return res.status(404).json({ error: 'Item não encontrado' });
            }

            const item = itemResult.rows[0];

            console.log('📝 ML - Atualizando item:', {
                raw_id,
                sku,
                status_anterior: item.status,
                sku_anterior: item.matched_sku
            });

            // Atualizar o item com o SKU relacionado
            const updateResult = await pool.query(
                `UPDATE raw_export_orders 
                 SET matched_sku = $1, 
                     status = 'matched', 
                     processed_at = NOW() 
                 WHERE id = $2
                 RETURNING id, matched_sku, status`,
                [sku, raw_id]
            );

            console.log('✅ ML - Item atualizado:', updateResult.rows[0]);
            console.log('📊 ML - Linhas afetadas:', updateResult.rowCount);

            // Se learn_alias=true, salvar como alias
            if (learn_alias && (alias_text || item.sku_text)) {
                const textToLearn = alias_text || item.sku_text;

                // Usar a mesma normalização que a constraint ux_sku_aliases_flat
                const existingAlias = await pool.query(
                    `SELECT id FROM obsidian.sku_aliases 
                     WHERE client_id = $1 
                       AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                           UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                    [item.client_id, textToLearn]
                );

                if (existingAlias.rows.length === 0) {
                    try {
                        await pool.query(
                            `INSERT INTO obsidian.sku_aliases 
                             (client_id, alias_text, stock_sku, confidence_default, times_used) 
                             VALUES ($1, $2, $3, 0.95, 1)`,
                            [item.client_id, textToLearn, sku]
                        );
                        console.log('✅ Alias criado:', textToLearn, '->', sku);
                    } catch (insertError: any) {
                        if (insertError.code === '23505') {
                            console.log('⚠️ Alias já existe (race condition), atualizando...');
                            const retryAlias = await pool.query(
                                `SELECT id FROM obsidian.sku_aliases 
                                 WHERE client_id = $1 
                                   AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                                       UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                                [item.client_id, textToLearn]
                            );
                            if (retryAlias.rows.length > 0) {
                                await pool.query(
                                    `UPDATE obsidian.sku_aliases 
                                     SET stock_sku = $1, 
                                         times_used = times_used + 1, 
                                         last_used_at = NOW() 
                                     WHERE id = $2`,
                                    [sku, retryAlias.rows[0].id]
                                );
                                console.log('✅ Alias atualizado após retry:', textToLearn, '->', sku);
                            }
                        } else {
                            throw insertError;
                        }
                    }
                } else {
                    await pool.query(
                        `UPDATE obsidian.sku_aliases 
                         SET stock_sku = $1, 
                             times_used = times_used + 1, 
                             last_used_at = NOW() 
                         WHERE id = $2`,
                        [sku, existingAlias.rows[0].id]
                    );
                    console.log('✅ Alias atualizado:', textToLearn, '->', sku);
                }
            }

            console.log('✅ Item relacionado com sucesso');
            return res.json({ ok: true, raw_id, matched_sku: sku, alias_learned: !!learn_alias });
        }

        // ========================================
        // AUTO-RELACIONAMENTO (FULL ou ML)
        // ========================================

        if (source === 'FULL') {
            if (!envio_id) {
                return res.status(400).json({ error: 'envio_id é obrigatório para FULL' });
            }

            // Buscar client_id do envio
            const envioResult = await pool.query(
                `SELECT client_id FROM logistica.full_envio WHERE id = $1`,
                [envio_id]
            );

            if (envioResult.rows.length === 0) {
                return res.status(404).json({ error: 'Envio não encontrado' });
            }

            const clientIdNum = envioResult.rows[0].client_id;

            // Buscar todas as linhas pendentes do envio
            const rawResult = await pool.query(
                `SELECT id, codigo_ml, sku_texto, qtd 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'`,
                [envio_id]
            );


            let matched = 0;
            let notMatched = 0;

            for (const row of rawResult.rows) {
                // Tentar encontrar alias exato
                const aliasResult = await pool.query(
                    `SELECT stock_sku, confidence_default, id 
                     FROM obsidian.sku_aliases 
                     WHERE client_id = $1 
                       AND (LOWER(alias_text) = LOWER($2) OR LOWER(alias_text) = LOWER($3))
                     ORDER BY confidence_default DESC 
                     LIMIT 1`,
                    [clientIdNum, row.codigo_ml, row.sku_texto]
                );

                if (aliasResult.rows.length > 0) {
                    // Encontrou! Atualizar linha
                    const alias = aliasResult.rows[0];

                    await pool.query(
                        `UPDATE logistica.full_envio_raw 
                         SET matched_sku = $1, 
                             status = 'matched', 
                             processed_at = NOW() 
                         WHERE id = $2`,
                        [alias.stock_sku, row.id]
                    );

                    // Atualizar contador de uso do alias
                    await pool.query(
                        `UPDATE obsidian.sku_aliases 
                         SET times_used = times_used + 1, 
                             last_used_at = NOW() 
                         WHERE id = $1`,
                        [alias.id]
                    );

                    matched++;
                } else {
                    notMatched++;
                }
            }

            // Atualizar status do envio
            const newStatus = notMatched === 0 ? 'ready' : 'partial';
            await pool.query(
                `UPDATE logistica.full_envio 
                 SET status = $1 
                 WHERE id = $2`,
                [newStatus, envio_id]
            );


            res.json({
                success: true,
                matched,
                not_matched: notMatched,
                total: rawResult.rows.length,
                status: newStatus
            });
        } else {
            // ML: relacionar automaticamente via aliases
            console.log('📦 Relacionando ML - client_id:', client_id, 'source:', source);

            // Buscar todos os itens pendentes (filtrado por cliente se fornecido)
            let query = `SELECT id, order_id as codigo_ml, sku_text as sku_original, client_id
                         FROM raw_export_orders
                         WHERE (status = 'pending' OR matched_sku IS NULL)`;
            const params: any[] = [];

            if (client_id) {
                params.push(client_id);
                query += ` AND client_id = $${params.length}`;
            }

            const pendingItems = await pool.query(query, params);

            console.log(`📦 Encontrados ${pendingItems.rows.length} itens pendentes para relacionar`);

            let matched = 0;
            let notMatched = 0;

            // Log dos primeiros 5 itens para debug
            console.log('📦 Primeiros 5 itens pendentes:', pendingItems.rows.slice(0, 5).map(i => ({
                id: i.id,
                codigo_ml: i.codigo_ml,
                sku_original: i.sku_original,
                client_id: i.client_id
            })));

            for (const item of pendingItems.rows) {
                // Buscar alias que corresponde ao SKU original (usando o client_id do item)
                const aliasResult = await pool.query(
                    `SELECT stock_sku, confidence_default, id 
                     FROM obsidian.sku_aliases 
                     WHERE client_id = $1 
                       AND (LOWER(alias_text) = LOWER($2) OR LOWER(alias_text) = LOWER($3))
                     ORDER BY confidence_default DESC 
                     LIMIT 1`,
                    [item.client_id, item.codigo_ml, item.sku_original]
                );

                if (aliasResult.rows.length > 0) {
                    const alias = aliasResult.rows[0];

                    // Atualizar o item com o SKU encontrado
                    await pool.query(
                        `UPDATE raw_export_orders 
                         SET matched_sku = $1, 
                             status = 'matched', 
                             processed_at = NOW() 
                         WHERE id = $2`,
                        [alias.stock_sku, item.id]
                    );

                    // Atualizar contador de uso do alias
                    await pool.query(
                        `UPDATE obsidian.sku_aliases 
                         SET times_used = times_used + 1, 
                             last_used_at = NOW() 
                         WHERE id = $1`,
                        [alias.id]
                    );

                    matched++;
                } else {
                    notMatched++;
                }
            }

            console.log(`✅ ML Relacionados: ${matched} | Pendentes: ${notMatched}`);

            // Registrar log de atividade
            try {
                await logActivity({
                    user_email: req.body.user_email || 'sistema',
                    user_name: req.body.user_name || 'Sistema',
                    action: 'auto_relate',
                    entity_type: source === 'FULL' ? 'envio' : 'pedidos',
                    entity_id: source === 'FULL' ? envio_id : (client_id || 'all'),
                    details: {
                        source,
                        total: pendingItems.rows.length,
                        matched,
                        not_matched: notMatched,
                        taxa_match: pendingItems.rows.length > 0 ? (matched / pendingItems.rows.length) * 100 : 0
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent')
                });
            } catch (logError) {
                console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
            }

            res.json({
                success: true,
                message: 'Auto-relacionamento ML concluído',
                total: pendingItems.rows.length,
                relacionados: matched,
                pendentes: notMatched,
                taxa_match: pendingItems.rows.length > 0 ? (matched / pendingItems.rows.length) * 100 : 0
            });
        }
    } catch (error: any) {
        console.error('Erro ao relacionar SKUs:', error);
        res.status(500).json({ error: 'Erro ao relacionar SKUs', details: error.message });
    }
});

// POST - Relacionar manualmente um SKU específico
// Body: raw_id, stock_sku, client_id, learn (boolean)
enviosRouter.post('/relacionar-manual', async (req: Request, res: Response) => {
    try {
        const { raw_id, stock_sku, client_id, learn = true } = req.body;


        // Buscar dados da linha bruta
        const rawResult = await pool.query(
            `SELECT codigo_ml, sku_texto FROM logistica.full_envio_raw WHERE id = $1`,
            [raw_id]
        );

        if (rawResult.rows.length === 0) {
            return res.status(404).json({ error: 'Linha não encontrada' });
        }

        const rawData = rawResult.rows[0];

        // Atualizar linha com o SKU relacionado
        await pool.query(
            `UPDATE logistica.full_envio_raw 
             SET matched_sku = $1, 
                 status = 'matched', 
                 processed_at = NOW() 
             WHERE id = $2`,
            [stock_sku, raw_id]
        );

        // Se learn=true, salvar como alias para próximas importações
        if (learn) {
            // Verificar se já existe esse alias
            const existingAlias = await pool.query(
                `SELECT id FROM obsidian.sku_aliases 
                 WHERE client_id = $1 
                   AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                       UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                [client_id, rawData.sku_texto]
            );

            if (existingAlias.rows.length === 0) {
                // Criar novo alias
                try {
                    await pool.query(
                        `INSERT INTO obsidian.sku_aliases 
                         (client_id, alias_text, stock_sku, confidence_default, times_used) 
                         VALUES ($1, $2, $3, 0.95, 1)`,
                        [client_id, rawData.sku_texto, stock_sku]
                    );
                } catch (insertError: any) {
                    if (insertError.code === '23505') {
                        console.log('⚠️ Alias já existe (race condition), atualizando...');
                        const retryAlias = await pool.query(
                            `SELECT id FROM obsidian.sku_aliases 
                             WHERE client_id = $1 
                               AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                            [client_id, rawData.sku_texto]
                        );
                        if (retryAlias.rows.length > 0) {
                            await pool.query(
                                `UPDATE obsidian.sku_aliases 
                                 SET stock_sku = $1, 
                                     times_used = times_used + 1, 
                                     last_used_at = NOW() 
                                 WHERE id = $2`,
                                [stock_sku, retryAlias.rows[0].id]
                            );
                        }
                    } else {
                        throw insertError;
                    }
                }
            } else {
                // Atualizar alias existente
                await pool.query(
                    `UPDATE obsidian.sku_aliases 
                     SET stock_sku = $1, 
                         times_used = times_used + 1, 
                         last_used_at = NOW() 
                     WHERE id = $2`,
                    [stock_sku, existingAlias.rows[0].id]
                );
            }
        }

        // Buscar envio_id para normalizar
        const envioIdResult = await pool.query(
            `SELECT envio_id FROM logistica.full_envio_raw WHERE id = $1`,
            [raw_id]
        );

        if (envioIdResult.rows.length > 0) {
            const envio_id = envioIdResult.rows[0].envio_id;

            // Chamar função de normalização para atualizar full_envio_item
            try {
                await pool.query(
                    `SELECT logistica.full_envio_normalizar($1::bigint)`,
                    [envio_id]
                );
                console.log(`📦 Normalização executada para envio ${envio_id}`);
            } catch (normError: any) {
                console.error('⚠️ Erro ao normalizar:', normError.message);
            }
        }

        res.json({
            success: true,
            message: learn ? 'Relacionado e aprendido com sucesso' : 'Relacionado com sucesso'
        });
    } catch (error: any) {
        console.error('Erro ao relacionar manualmente:', error);
        res.status(500).json({ error: 'Erro ao relacionar manualmente', details: error.message });
    }
});

// POST - Match line (alias para relacionar-manual, compatibilidade com frontend)
// Body: raw_id, matched_sku, create_alias, alias_text, source
enviosRouter.post('/match-line', async (req: Request, res: Response) => {
    try {
        const { raw_id, matched_sku, create_alias = true, alias_text, source } = req.body;

        console.log('📦 Match-line recebido:', { raw_id, matched_sku, create_alias, alias_text, source });

        // Validação de campos obrigatórios
        if (!raw_id) {
            return res.status(400).json({ error: 'Campo raw_id é obrigatório' });
        }

        if (!matched_sku) {
            return res.status(400).json({ error: 'Campo matched_sku é obrigatório' });
        }

        // Buscar dados da linha e do envio
        const rawResult = await pool.query(
            `SELECT r.*, e.client_id, e.id as envio_id
             FROM logistica.full_envio_raw r
             JOIN logistica.full_envio e ON r.envio_id = e.id
             WHERE r.id = $1`,
            [raw_id]
        );

        if (rawResult.rows.length === 0) {
            return res.status(404).json({ error: 'Linha não encontrada', raw_id });
        }

        const rawData = rawResult.rows[0];
        const clientId = rawData.client_id;
        const envioId = rawData.envio_id;

        console.log('📝 Atualizando linha:', {
            raw_id,
            matched_sku,
            status_anterior: rawData.status,
            sku_anterior: rawData.matched_sku
        });

        // Atualizar linha com o SKU relacionado
        const updateResult = await pool.query(
            `UPDATE logistica.full_envio_raw 
             SET matched_sku = $1, 
                 status = 'matched', 
                 processed_at = NOW() 
             WHERE id = $2
             RETURNING id, matched_sku, status`,
            [matched_sku, raw_id]
        );

        console.log('✅ Linha atualizada:', updateResult.rows[0]);
        console.log('📊 Linhas afetadas:', updateResult.rowCount);

        let aliasOps = 0;

        // Se create_alias=true, salvar como alias
        if (create_alias && alias_text) {
            console.log('🔍 Verificando alias existente:', { clientId, alias_text, matched_sku });

            // Usar a mesma normalização que a constraint ux_sku_aliases_flat
            const existingAlias = await pool.query(
                `SELECT id, stock_sku, client_id FROM obsidian.sku_aliases 
                 WHERE client_id = $1 
                   AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                       UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                [clientId, alias_text]
            );

            console.log('📋 Aliases encontrados:', existingAlias.rows);

            if (existingAlias.rows.length === 0) {
                // Alias não existe, tentar criar novo
                try {
                    await pool.query(
                        `INSERT INTO obsidian.sku_aliases 
                         (client_id, alias_text, stock_sku, confidence_default, times_used) 
                         VALUES ($1, $2, $3, 0.95, 1)`,
                        [clientId, alias_text, matched_sku]
                    );
                    console.log('✅ Alias criado:', alias_text, '->', matched_sku);
                    aliasOps = 1;
                } catch (insertError: any) {
                    // Se falhar por duplicata (race condition), buscar novamente e atualizar
                    if (insertError.code === '23505') {
                        console.log('⚠️ Alias criado em paralelo, buscando novamente...');
                        const retryAlias = await pool.query(
                            `SELECT id FROM obsidian.sku_aliases 
                             WHERE client_id = $1 
                               AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                            [clientId, alias_text]
                        );
                        if (retryAlias.rows.length > 0) {
                            await pool.query(
                                `UPDATE obsidian.sku_aliases 
                                 SET stock_sku = $1, 
                                     times_used = times_used + 1, 
                                     last_used_at = NOW() 
                                 WHERE id = $2`,
                                [matched_sku, retryAlias.rows[0].id]
                            );
                            console.log('✅ Alias atualizado após retry:', alias_text, '->', matched_sku);
                            aliasOps = 1;
                        }
                    } else {
                        // Outro tipo de erro, re-lançar
                        throw insertError;
                    }
                }
            } else {
                // Alias já existe, apenas atualizar o uso
                const existingSku = existingAlias.rows[0].stock_sku;
                console.log('ℹ️ Alias já existe:', alias_text, '->', existingSku, '(atualizando para:', matched_sku, ')');

                await pool.query(
                    `UPDATE obsidian.sku_aliases 
                     SET stock_sku = $1, 
                         times_used = times_used + 1, 
                         last_used_at = NOW() 
                     WHERE id = $2`,
                    [matched_sku, existingAlias.rows[0].id]
                );
                aliasOps = 1;
            }
        }

        // Verificar se todas as linhas foram relacionadas
        const pendingCount = await pool.query(
            `SELECT COUNT(*) as count 
             FROM logistica.full_envio_raw 
             WHERE envio_id = $1 AND status = 'pending'`,
            [envioId]
        );

        const hasPending = parseInt(pendingCount.rows[0].count) > 0;

        // Chamar função de normalização para atualizar full_envio_item
        try {
            await pool.query(
                `SELECT logistica.full_envio_normalizar($1::bigint)`,
                [envioId]
            );
            console.log(`📦 Normalização executada para envio ${envioId}`);
        } catch (normError: any) {
            console.error('⚠️ Erro ao normalizar:', normError.message);
        }

        // Registrar log de atividade
        try {
            await logActivity({
                user_email: req.body.user_email || 'sistema',
                user_name: req.body.user_name || 'Sistema',
                action: 'relate_item',
                entity_type: 'full_raw',
                entity_id: raw_id.toString(),
                details: {
                    matched_sku,
                    alias_created: aliasOps > 0,
                    alias_text,
                    envio_id: envioId,
                    source: 'FULL'
                },
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        } catch (logError) {
            console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
        }

        res.json({
            envio_id: envioId,
            alias_ops: aliasOps,
            emitidos: 0, // TODO: implementar emissão automática
        });
    } catch (error: any) {
        console.error('Erro ao fazer match:', error);
        res.status(500).json({ error: 'Erro ao fazer match', details: error.message });
    }
});

// POST - Auto-relacionar itens pendentes usando função do banco
// Body: envio_id, source
enviosRouter.post('/auto-relate', async (req: Request, res: Response) => {
    try {
        const { envio_id, source } = req.body;


        if (!envio_id) {
            return res.status(400).json({ error: 'Campo envio_id é obrigatório' });
        }

        if (source === 'FULL') {
            // Contar pendentes antes
            const beforeResult = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'`,
                [envio_id]
            );
            const beforeCount = parseInt(beforeResult.rows[0].count);

            // Chamar função do banco que faz o auto-relacionamento
            await pool.query(
                `SELECT logistica.full_envio_normalizar($1::bigint) AS ok`,
                [envio_id]
            );

            // Contar pendentes depois
            const afterResult = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'`,
                [envio_id]
            );
            const afterCount = parseInt(afterResult.rows[0].count);

            const matched = beforeCount - afterCount;


            res.json({
                success: true,
                message: 'Auto-relacionamento concluído',
                matched,
                before: beforeCount,
                after: afterCount
            });
        } else if (source === 'ML') {
            // Auto-relacionar ML: buscar em raw_export_orders e tentar match com produtos/aliases
            const { client_id, import_id } = req.body;


            // Construir filtros
            let whereClause = `WHERE (status = 'pending' OR matched_sku IS NULL)`;
            const params: any[] = [];

            if (client_id) {
                const clientIdNum = parseInt(client_id as string);
                if (!isNaN(clientIdNum)) {
                    params.push(clientIdNum);
                    whereClause += ` AND client_id = $${params.length}`;
                } else {
                    params.push(client_id);
                    whereClause += ` AND client_id = (SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($${params.length}) LIMIT 1)`;
                }
            }

            if (import_id) {
                params.push(import_id);
                whereClause += ` AND import_id = $${params.length}`;
            }

            // Buscar itens pendentes
            const pendingResult = await pool.query(
                `SELECT id, sku_text FROM raw_export_orders ${whereClause}`,
                params
            );


            let matched = 0;

            // Tentar relacionar cada item
            for (const item of pendingResult.rows) {
                if (!item.sku_text) continue;

                const skuNormalized = item.sku_text.toString().trim().toUpperCase();

                // 1. Tentar match direto na tabela produtos
                const produtoResult = await pool.query(
                    `SELECT sku FROM obsidian.produtos WHERE UPPER(sku) = $1 LIMIT 1`,
                    [skuNormalized]
                );

                if (produtoResult.rows.length > 0) {
                    // Match encontrado - atualizar
                    await pool.query(
                        `UPDATE raw_export_orders 
                         SET matched_sku = $1, status = 'matched'
                         WHERE id = $2`,
                        [produtoResult.rows[0].sku, item.id]
                    );
                    matched++;
                    continue;
                }

                // 2. Tentar match via aliases com normalização
                const aliasResult = await pool.query(
                    `SELECT stock_sku, id 
                     FROM obsidian.sku_aliases 
                     WHERE UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                           UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))
                     ORDER BY confidence_default DESC, times_used DESC
                     LIMIT 1`,
                    [item.sku_text]
                );

                if (aliasResult.rows.length > 0) {
                    // Match via alias - atualizar
                    await pool.query(
                        `UPDATE raw_export_orders 
                         SET matched_sku = $1, status = 'matched'
                         WHERE id = $2`,
                        [aliasResult.rows[0].stock_sku, item.id]
                    );

                    // Atualizar contador de uso do alias
                    await pool.query(
                        `UPDATE obsidian.sku_aliases 
                         SET times_used = times_used + 1, 
                             last_used_at = NOW() 
                         WHERE id = $1`,
                        [aliasResult.rows[0].id]
                    );

                    matched++;
                }
            }


            res.json({
                success: true,
                message: 'Auto-relacionamento ML concluído',
                matched,
                total: pendingResult.rows.length
            });
        } else {
            res.status(400).json({ error: 'source deve ser FULL ou ML' });
        }
    } catch (error: any) {
        console.error('Erro no auto-relacionamento:', error);
        res.status(500).json({ error: 'Erro no auto-relacionamento', details: error.message });
    }
});

// POST - Emitir vendas (ML ou FULL)
// Body: envio_id (para FULL) ou import_id (para ML), source
enviosRouter.post('/emitir-vendas', async (req: Request, res: Response) => {
    try {
        const { envio_id, import_id, source } = req.body;


        if (source === 'FULL') {
            if (!envio_id) {
                return res.status(400).json({ error: 'envio_id é obrigatório para FULL' });
            }

            // Buscar dados do envio
            const envioResult = await pool.query(
                `SELECT e.*, c.nome as cliente_nome 
                 FROM logistica.full_envio e
                 JOIN obsidian.clientes c ON e.client_id = c.id
                 WHERE e.id = $1`,
                [envio_id]
            );

            if (envioResult.rows.length === 0) {
                return res.status(404).json({ error: 'Envio não encontrado' });
            }

            const envio = envioResult.rows[0];

            // Verificar se há itens pendentes
            const pendingCheck = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'`,
                [envio_id]
            );

            if (parseInt(pendingCheck.rows[0].count) > 0) {
                return res.status(400).json({
                    error: 'Existem itens pendentes de relacionamento. Relacione todos os SKUs antes de emitir.'
                });
            }

            // Contar itens que serão emitidos
            const itemCount = await pool.query(
                `SELECT COUNT(*) as count FROM logistica.full_envio_item WHERE envio_id = $1`,
                [envio_id]
            );

            if (parseInt(itemCount.rows[0].count) === 0) {
                return res.status(400).json({
                    error: 'Nenhum item encontrado para emitir. Execute a normalização primeiro.'
                });
            }

            // Usar import_date se disponível, senão usar hoje
            const data_emissao = envio.import_date
                ? new Date(envio.import_date).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0];

            // Chamar função do banco que faz TUDO:
            // - Cria movimentos de estoque (inclusive para componentes de kits)
            // - Atualiza quantidade_atual dos produtos
            // - Insere vendas em obsidian.vendas
            // - Atualiza status do envio para 'registrado'
            await pool.query(
                `SELECT logistica.full_envio_emitir($1::bigint, $2::date)`,
                [envio_id, data_emissao]
            );

            console.log(`✅ Vendas emitidas com sucesso para envio ${envio.envio_num}`);

            // Atualizar status do envio
            await pool.query(
                `UPDATE logistica.full_envio 
                 SET status = 'emitted', 
                     emitted_at = NOW() 
                 WHERE id = $1`,
                [envio_id]
            );

            // Contar quantas vendas foram criadas
            const salesCount = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM obsidian.vendas 
                 WHERE canal = 'FULL-INBOUND' 
                   AND nome_cliente = $1`,
                [envio.cliente_nome]
            );

            // Registrar log de atividade
            try {
                await logActivity({
                    user_email: req.body.user_email || 'sistema',
                    user_name: req.body.user_name || 'Sistema',
                    action: 'emit_sales',
                    entity_type: 'envio',
                    entity_id: envio_id.toString(),
                    details: {
                        source: 'FULL',
                        envio_num: envio.envio_num,
                        total_items: parseInt(itemCount.rows[0].count),
                        cliente: envio.cliente_nome,
                        data_emissao
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent')
                });
            } catch (logError) {
                console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
            }

            res.json({
                success: true,
                message: 'Vendas emitidas com sucesso',
                envio_num: envio.envio_num,
                items_count: parseInt(itemCount.rows[0].count),
                data_emissao
            });
        } else if (source === 'ML') {
            // ML: Processar vendas do Mercado Livre
            const { client_id } = req.body;


            // Construir filtros - APENAS itens que ainda não foram emitidos
            let whereClause = `WHERE status = 'matched' AND matched_sku IS NOT NULL`;
            const params: any[] = [];

            // Se não tiver import_id, pegar o mais recente do cliente
            let finalImportId = import_id;
            if (!import_id && client_id) {
                // Resolver client_id (pode ser número ou nome)
                let resolvedClientId = null;
                const clientIdNum = parseInt(client_id as string);

                if (!isNaN(clientIdNum)) {
                    resolvedClientId = clientIdNum;
                } else {
                    // Buscar ID pelo nome
                    const clientResult = await pool.query(
                        `SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($1) LIMIT 1`,
                        [client_id]
                    );
                    if (clientResult.rows.length > 0) {
                        resolvedClientId = clientResult.rows[0].id;
                    }
                }

                // Buscar import_id mais recente desse cliente
                if (resolvedClientId) {
                    const latestImportResult = await pool.query(
                        `SELECT import_id 
                         FROM raw_export_orders 
                         WHERE client_id = $1 
                         ORDER BY created_at DESC 
                         LIMIT 1`,
                        [resolvedClientId]
                    );

                    if (latestImportResult.rows.length > 0) {
                        finalImportId = latestImportResult.rows[0].import_id;
                    }
                }
            }

            if (client_id) {
                const clientIdNum = parseInt(client_id as string);
                if (!isNaN(clientIdNum)) {
                    params.push(clientIdNum);
                    whereClause += ` AND client_id = $${params.length}`;
                } else {
                    params.push(client_id);
                    whereClause += ` AND client_id = (SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($${params.length}) LIMIT 1)`;
                }
            }

            if (finalImportId) {
                params.push(finalImportId);
                whereClause += ` AND import_id = $${params.length}`;
            }

            // Buscar itens relacionados agrupados por pedido
            const ordersResult = await pool.query(
                `SELECT 
                    order_id,
                    order_date,
                    customer,
                    channel,
                    client_id,
                    json_agg(json_build_object(
                        'sku', matched_sku,
                        'quantidade', qty::numeric,
                        'preco_unitario', unit_price::numeric
                    )) as items
                 FROM raw_export_orders
                 ${whereClause}
                 GROUP BY order_id, order_date, customer, channel, client_id
                 ORDER BY order_id`,
                params
            );

            if (ordersResult.rows.length === 0) {
                return res.status(400).json({
                    error: 'Nenhum item relacionado encontrado para emitir. Execute o auto-relacionamento primeiro.'
                });
            }


            let inseridos = 0;
            let ja_existiam = 0;
            let full_skipped = 0;
            const erros: any[] = [];

            // Processar cada pedido
            for (const order of ordersResult.rows) {
                try {
                    // Buscar nome do cliente
                    const clientResult = await pool.query(
                        `SELECT nome FROM obsidian.clientes WHERE id = $1`,
                        [order.client_id]
                    );

                    if (clientResult.rows.length === 0) {
                        continue;
                    }

                    const clienteNome = clientResult.rows[0].nome;

                    // Verificar se o canal é FULL (nesse caso, pular - não faz baixa)
                    const canal = order.channel?.toUpperCase() || 'ML';
                    if (canal.includes('FULL') || canal.includes('FBM')) {
                        full_skipped++;
                        continue;
                    }

                    // Gerar pedido_uid único
                    const pedido_uid = `ML-${order.order_id}`;

                    // Formatar data
                    const data_venda = order.order_date
                        ? new Date(order.order_date).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0];

                    // Preparar itens
                    const items = order.items.map((item: any) => ({
                        sku: item.sku,
                        nome_produto: item.sku,
                        quantidade: parseFloat(item.quantidade || 0),
                        preco_unitario: parseFloat(item.preco_unitario || 0)
                    }));


                    // Chamar função processar_pedido
                    const processResult = await pool.query(
                        `SELECT * FROM obsidian.processar_pedido($1, $2, $3, $4, $5::jsonb)`,
                        [pedido_uid, data_venda, clienteNome, canal, JSON.stringify(items)]
                    );

                    if (processResult.rows.length > 0) {
                        inseridos++;
                        processResult.rows.forEach(row => {
                        });
                    }

                    // Marcar itens como processados
                    await pool.query(
                        `UPDATE raw_export_orders 
                         SET status = 'emitted'
                         WHERE order_id = $1 AND matched_sku IS NOT NULL`,
                        [order.order_id]
                    );

                } catch (error: any) {
                    // Se for erro de constraint (já existe), contar como ja_existiam
                    if (error.message?.includes('vendas_dedupe') || error.message?.includes('duplicate')) {
                        ja_existiam++;
                    } else {
                        erros.push({
                            order_id: order.order_id,
                            error: error.message
                        });
                        console.error(`❌ Erro ao processar pedido ${order.order_id}:`, error.message);
                    }
                }
            }


            // Registrar log de atividade
            try {
                await logActivity({
                    user_email: req.body.user_email || 'sistema',
                    user_name: req.body.user_name || 'Sistema',
                    action: 'emit_sales',
                    entity_type: 'pedidos',
                    entity_id: finalImportId || client_id,
                    details: {
                        source: 'ML',
                        candidatos: ordersResult.rows.length,
                        inseridos,
                        ja_existiam,
                        full_skipped,
                        client_id
                    },
                    ip_address: req.ip,
                    user_agent: req.get('user-agent')
                });
            } catch (logError) {
                console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
            }

            res.json([{
                candidatos: ordersResult.rows.length,
                inseridos,
                ja_existiam,
                full_skipped,
                erros: erros.length > 0 ? erros : undefined
            }]);
        } else {
            res.status(400).json({ error: 'source deve ser FULL ou ML' });
        }
    } catch (error: any) {
        console.error('Erro ao emitir vendas:', error);
        res.status(500).json({ error: 'Erro ao emitir vendas', details: error.message });
    }
});

// GET - Buscar linhas importadas do ML (raw_export_orders)
// Query params: client_id, import_id, status, q (search), page, page_size
enviosRouter.get('/ml-rows', async (req: Request, res: Response) => {
    try {
        const { client_id, import_id, status, q, page = 1, page_size = 50 } = req.query;

        let query = `
            SELECT 
                id as id_raw,
                order_id as id_pedido,
                order_date as data,
                sku_text as sku_original,
                matched_sku as sku_relacionado,
                qty::numeric as qtd,
                unit_price::numeric as valor_unit,
                customer as cliente,
                channel as canal,
                status
            FROM raw_export_orders
            WHERE 1=1
        `;
        const params: any[] = [];

        // Filtro por cliente (aceita ID numérico ou nome)
        if (client_id) {
            const clientIdNum = parseInt(client_id as string);
            if (!isNaN(clientIdNum)) {
                // Se for número, filtra por ID
                params.push(clientIdNum);
                query += ` AND client_id = $${params.length}`;
            } else {
                // Se for string, busca o ID do cliente pelo nome
                params.push(client_id);
                query += ` AND client_id = (SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($${params.length}) LIMIT 1)`;
            }
        }

        // Filtro por import_id
        if (import_id) {
            params.push(import_id);
            query += ` AND import_id = $${params.length}`;
        }

        // Filtro por status
        if (status && status !== 'Todos') {
            if (status === 'relacionados') {
                query += ` AND status = 'matched'`;
            } else if (status === 'pendentes') {
                query += ` AND (status = 'pending' OR matched_sku IS NULL)`;
            }
        }

        // Busca por SKU ou cliente
        if (q && q !== '') {
            params.push(`%${q}%`);
            query += ` AND (
                UPPER(sku_text) LIKE UPPER($${params.length}) OR
                UPPER(matched_sku) LIKE UPPER($${params.length}) OR
                UPPER(customer) LIKE UPPER($${params.length})
            )`;
        }

        // Paginação
        const pageNum = parseInt(page as string) || 1;
        const pageSizeNum = parseInt(page_size as string) || 50;
        const offset = (pageNum - 1) * pageSizeNum;

        query += ` ORDER BY created_at DESC LIMIT ${pageSizeNum} OFFSET ${offset}`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Erro ao buscar linhas ML:', error);
        res.status(500).json({ error: 'Erro ao buscar linhas ML', details: error.message });
    }
});

// GET - Buscar resumo do import ML
// Query params: client_id, import_id
enviosRouter.get('/ml-summary', async (req: Request, res: Response) => {
    try {
        const { client_id, import_id } = req.query;

        let query = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'matched' AND matched_sku IS NOT NULL) as relacionados,
                COUNT(*) FILTER (WHERE status = 'pending' OR matched_sku IS NULL) as pendentes
            FROM raw_export_orders
            WHERE 1=1
        `;
        const params: any[] = [];

        // Filtro por cliente (aceita ID numérico ou nome)
        if (client_id) {
            const clientIdNum = parseInt(client_id as string);
            if (!isNaN(clientIdNum)) {
                // Se for número, filtra por ID
                params.push(clientIdNum);
                query += ` AND client_id = $${params.length}`;
            } else {
                // Se for string, busca o ID do cliente pelo nome
                params.push(client_id);
                query += ` AND client_id = (SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($${params.length}) LIMIT 1)`;
            }
        }

        if (import_id) {
            params.push(import_id);
            query += ` AND import_id = $${params.length}`;
        }

        const result = await pool.query(query, params);
        const row = result.rows[0];

        const total = parseInt(row.total) || 0;
        const relacionados = parseInt(row.relacionados) || 0;
        const pendentes = parseInt(row.pendentes) || 0;
        const taxa_match = total > 0 ? (relacionados / total) * 100 : 0;

        res.json({
            total,
            relacionados,
            pendentes,
            taxa_match: Math.round(taxa_match * 100) / 100
        });
    } catch (error: any) {
        console.error('Erro ao buscar resumo ML:', error);
        res.status(500).json({ error: 'Erro ao buscar resumo ML', details: error.message });
    }
});

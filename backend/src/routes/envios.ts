import { Router, Request, Response } from 'express';
import { pool } from '../database/db';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import { logActivity } from '../services/activityLogger';
import { optionalAuth, AuthRequest } from '../middleware/authMiddleware';

interface MulterRequest extends AuthRequest {
    file?: Express.Multer.File;
}

const upload = multer({ dest: 'uploads/' });

export const enviosRouter = Router();

// Aplicar middleware de autenticação opcional em todas as rotas
enviosRouter.use(optionalAuth);

// � Armazenar progresso de uploads em memória
const uploadProgress = new Map<string, {
    stage: string;
    current: number;
    total: number;
    message: string;
}>();

// �🔧 Helper: Normalizar client_id (aceita nome ou ID numérico)
async function normalizeClientId(clientIdInput: any): Promise<number | null> {
    if (!clientIdInput) return null;

    // Se já é número, retornar
    if (!isNaN(Number(clientIdInput))) {
        return Number(clientIdInput);
    }

    // Se é string (nome do cliente), buscar ID
    try {
        const result = await pool.query(
            `SELECT id FROM obsidian.clientes WHERE UPPER(nome) ILIKE UPPER($1) LIMIT 1`,
            [clientIdInput]
        );

        if (result.rows.length === 0) {
            console.warn(`⚠️ Cliente "${clientIdInput}" não encontrado no banco`);
            return null;
        }

        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Erro ao normalizar client_id:', error);
        return null;
    }
}

// 🔧 Helper: Converter data do Excel para timestamp válido (formato brasileiro DD/MM/YYYY)
function parseExcelDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    try {
        // Se já é Date, retornar
        if (dateValue instanceof Date) {
            return isNaN(dateValue.getTime()) ? null : dateValue;
        }

        // Se é número (serial date do Excel)
        if (typeof dateValue === 'number') {
            // Excel dates são dias desde 1/1/1900 (com bug do 1900)
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
            return isNaN(date.getTime()) ? null : date;
        }

        // Se é string, tentar formato brasileiro DD/MM/YYYY primeiro
        if (typeof dateValue === 'string') {
            // Tentar formato brasileiro DD/MM/YYYY HH:MM ou DD/MM/YYYY
            const brMatch = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (brMatch) {
                const day = parseInt(brMatch[1], 10);
                const month = parseInt(brMatch[2], 10) - 1; // Mês é 0-indexed
                const year = parseInt(brMatch[3], 10);
                const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
                const minute = brMatch[5] ? parseInt(brMatch[5], 10) : 0;

                const date = new Date(year, month, day, hour, minute);
                return isNaN(date.getTime()) ? null : date;
            }

            // Fallback: formato ISO ou outro
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    } catch (error) {
        console.warn(`⚠️ Erro ao parsear data: ${dateValue}`);
        return null;
    }
}

// 📡 SSE - Endpoint para receber progresso em tempo real
enviosRouter.get('/upload-progress/:importId', (req: Request, res: Response) => {
    const { importId } = req.params;

    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders(); // Forçar envio dos headers

    console.log(`📡 Cliente conectou ao SSE para importId: ${importId}`);

    // Enviar progresso inicial imediatamente
    const sendProgress = () => {
        const progress = uploadProgress.get(importId);
        if (progress) {
            const data = JSON.stringify(progress);
            res.write(`data: ${data}\n\n`);
            console.log(`📊 Enviando progresso: ${progress.stage} - ${progress.current}/${progress.total} (${progress.message})`);

            // Se completou, fechar conexão após 2 segundos
            if (progress.stage === 'completed' || progress.stage === 'error') {
                setTimeout(() => {
                    console.log(`✅ Upload ${importId} finalizado, limpando memória`);
                    uploadProgress.delete(importId);
                    res.end();
                }, 2000);
            }
        } else {
            // Se não tem progresso ainda, enviar placeholder
            res.write(`data: ${JSON.stringify({
                stage: 'waiting',
                current: 0,
                total: 100,
                message: 'Aguardando processamento...'
            })}\n\n`);
        }
    };

    // Enviar imediatamente
    sendProgress();

    // Enviar atualizações a cada 300ms (mais rápido)
    const interval = setInterval(sendProgress, 300);

    // Cleanup quando cliente desconectar
    req.on('close', () => {
        console.log(`🔌 Cliente desconectou do SSE: ${importId}`);
        clearInterval(interval);
        res.end();
    });
});

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
            // 🔧 Normalizar client_id (aceita nome ou ID)
            const clientIdNum = await normalizeClientId(client_id);
            if (!clientIdNum) {
                return res.json([]);
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

        // 🔧 Normalizar client_id (aceita nome ou ID)
        const clientIdNum = await normalizeClientId(client_id);
        if (!clientIdNum) {
            return res.status(400).json({ error: `Cliente "${client_id}" não encontrado` });
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

            // ✅ Inicializar progresso - 10%
            uploadProgress.set(importId, {
                stage: 'processing',
                current: 10,
                total: 100,
                message: `Processando ${jsonData.length} linhas...`
            });            // Calcular totais
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

            // ✅ Atualizar progresso - 30%
            uploadProgress.set(importId, {
                stage: 'inserting',
                current: 30,
                total: 100,
                message: `Inserindo ${jsonData.length} linhas...`
            });

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
     VALUES ($1, $2, $3, UPPER($4), $5, $6)`,
                            [envioId, i + 1, codigoMl, skuTexto, qtd, 'pending']
                        );
                        insertedRows++;

                        // Atualizar progresso a cada 10 linhas
                        if (insertedRows % 10 === 0 || i === jsonData.length - 1) {
                            uploadProgress.set(importId, {
                                stage: 'inserting',
                                current: i + 1,
                                total: jsonData.length,
                                message: `Inserindo linhas: ${i + 1}/${jsonData.length}`
                            });
                        }
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
                // ✅ Atualizar progresso - 60%
                uploadProgress.set(importId, {
                    stage: 'matching',
                    current: 60,
                    total: 100,
                    message: `Auto-relacionando ${insertedRows} SKUs...`
                });

                // Buscar todas as linhas recém-inseridas
                const pendingRows = await pool.query(
                    `SELECT id, codigo_ml, sku_texto, qtd 
                     FROM logistica.full_envio_raw 
                     WHERE envio_id = $1 AND status = 'pending'`,
                    [envioId]
                );

                for (let idx = 0; idx < pendingRows.rows.length; idx++) {
                    const row = pendingRows.rows[idx];
                    let matchedSku: string | null = null;
                    let matchSource: string = '';

                    // 1️⃣ PRIMEIRO: Buscar SKU exato na tabela produtos (codigo_ml ou sku_texto)
                    const produtoResult = await pool.query(
                        `SELECT sku 
                         FROM obsidian.produtos 
                         WHERE UPPER(sku) = UPPER(TRIM($1)) OR UPPER(sku) = UPPER(TRIM($2))
                         LIMIT 1`,
                        [row.codigo_ml, row.sku_texto]
                    );

                    if (produtoResult.rows.length > 0) {
                        matchedSku = produtoResult.rows[0].sku;
                        matchSource = 'direct';
                    } else {
                        // 1.5️⃣ BUSCA FUZZY: Remover caracteres especiais e tentar novamente
                        const fuzzyResult = await pool.query(
                            `SELECT sku 
                             FROM obsidian.produtos 
                             WHERE UPPER(REGEXP_REPLACE(sku, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))
                                OR UPPER(REGEXP_REPLACE(sku, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                             LIMIT 1`,
                            [row.codigo_ml, row.sku_texto]
                        );

                        if (fuzzyResult.rows.length > 0) {
                            matchedSku = fuzzyResult.rows[0].sku;
                            matchSource = 'fuzzy';
                        } else {
                            // 1.6️⃣ BUSCA INTELIGENTE: Size variation matching (37/38 → 38)
                            // Separa base (até última letra) e tamanho (últimos números)
                            // Verifica se o tamanho buscado contém o tamanho do DB
                            const smartResult = await pool.query(
                                `WITH normalized AS (
                                    SELECT 
                                        sku,
                                        REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') as sku_norm,
                                        SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '^[A-Z0-9]*[A-Z]') as sku_base,
                                        SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '[0-9]+$') as sku_size
                                    FROM obsidian.produtos
                                ),
                                search_parts AS (
                                    SELECT 
                                        REGEXP_REPLACE(UPPER($1), '[^A-Z0-9]', '', 'g') as search_norm,
                                        SUBSTRING(REGEXP_REPLACE(UPPER($1), '[^A-Z0-9]', '', 'g') FROM '^[A-Z0-9]*[A-Z]') as search_base,
                                        SUBSTRING(REGEXP_REPLACE(UPPER($1), '[^A-Z0-9]', '', 'g') FROM '[0-9]+$') as search_size
                                )
                                SELECT n.sku
                                FROM normalized n, search_parts s
                                WHERE n.sku_base = s.search_base
                                  AND s.search_size LIKE '%' || n.sku_size || '%'
                                ORDER BY LENGTH(n.sku_size) DESC
                                LIMIT 1`,
                                [row.codigo_ml || row.sku_texto]
                            );

                            if (smartResult.rows.length > 0) {
                                matchedSku = smartResult.rows[0].sku;
                                matchSource = 'smart';
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
                        }
                    }

                    // Se encontrou match (por produto ou alias), relacionar
                    if (matchedSku) {
                        // Buscar dados do produto para popular full_envio_item
                        const produtoInfo = await pool.query(
                            `SELECT sku, preco_unitario, COALESCE(is_kit, FALSE) as is_kit
                             FROM obsidian.produtos 
                             WHERE sku = $1`,
                            [matchedSku]
                        );

                        if (produtoInfo.rows.length > 0) {
                            const prod = produtoInfo.rows[0];
                            const valorTotal = prod.preco_unitario * row.qtd;

                            // Inserir em full_envio_item
                            await pool.query(
                                `INSERT INTO logistica.full_envio_item 
                                 (envio_id, codigo_ml, sku, qtd, is_kit, preco_unit_interno, valor_total)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                                 ON CONFLICT (envio_id, sku, codigo_ml) 
                                 DO UPDATE SET qtd = logistica.full_envio_item.qtd + EXCLUDED.qtd`,
                                [envioId, row.codigo_ml, matchedSku, row.qtd, prod.is_kit, prod.preco_unitario, valorTotal]
                            );
                        }

                        // Atualizar status em full_envio_raw
                        await pool.query(
                            `UPDATE logistica.full_envio_raw 
                             SET matched_sku = $1, 
                                 status = 'matched', 
                                 processed_at = NOW(),
                                 error_msg = NULL
                             WHERE id = $2`,
                            [matchedSku, row.id]
                        );

                        autoMatched++;

                        // Atualizar progresso a cada 10 itens - 60% a 85%
                        if (autoMatched % 10 === 0 || idx === pendingRows.rows.length - 1) {
                            const matchProgress = 60 + Math.round((idx / pendingRows.rows.length) * 25);
                            uploadProgress.set(importId, {
                                stage: 'matching',
                                current: matchProgress,
                                total: 100,
                                message: `Auto-relacionando: ${autoMatched} de ${pendingRows.rows.length}`
                            });
                        }
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

            // Atualizar progresso - 90%
            uploadProgress.set(importId, {
                stage: 'normalizing',
                current: 90,
                total: 100,
                message: `Normalizando dados...`
            });

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

            // ✅ Atualizar progresso - 100% COMPLETED
            uploadProgress.set(importId, {
                stage: 'completed',
                current: 100,
                total: 100,
                message: `✅ Concluído! ${insertedRows} linhas | ${autoMatched} relacionados | ${remainingPending} pendentes`
            });

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
                // Buscar nome do cliente para o log
                const clientNameResult = await pool.query(
                    `SELECT nome FROM obsidian.clientes WHERE id = $1`,
                    [clientIdNum]
                );
                const clientName = clientNameResult.rows[0]?.nome || `ID ${clientIdNum}`;

                await logActivity({
                    user_email: (req as AuthRequest).user?.email || 'sistema',
                    user_name: (req as AuthRequest).user?.nome || 'Sistema',
                    action: 'upload_full',
                    entity_type: 'envio',
                    entity_id: envioId.toString(),
                    details: {
                        envio_num: envioNumValue,
                        cliente: clientName,
                        filename,
                        total_linhas: jsonData.length,
                        inseridas: insertedRows,
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
            // ML: Criar batch e inserir dados em raw_export_orders
            const result = await pool.query(
                `INSERT INTO obsidian.import_batches (filename, source, client_id, status, total_rows) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [filename, source, clientIdNum, 'processing', jsonData.length]
            );

            const batchId = result.rows[0].import_id;
            let insertedRows = 0;
            const errors: string[] = [];

            console.log(`📦 Processando ${jsonData.length} linhas do Excel ML...`);

            // ✅ Inicializar progresso - Etapa 1: Processando
            uploadProgress.set(batchId, {
                stage: 'processing',
                current: 10,
                total: 100,
                message: `Processando ${jsonData.length} linhas do Excel...`
            });

            // OTIMIZAÇÃO: Preparar dados em lote para bulk insert
            const valuesToInsert: any[][] = [];
            const skippedRows: number[] = [];

            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];

                try {
                    // Extrair campos principais do Excel UpSeller
                    const orderIdPlatform = row['Nº de Pedido da Plataforma'] || '';
                    const orderIdInternal = row['Nº de Pedido'] || '';
                    const orderDateRaw = row['Hora do Pedido'] || row['Hora do Pagamento'] || null;
                    const orderDate = parseExcelDate(orderDateRaw);
                    const sku = row['SKU'] || '';
                    const qty = parseFloat(row['Qtd. do Produto'] || 0);
                    const unitPrice = parseFloat(row['Preço de Produto'] || 0);
                    const customer = row['Nome de Comprador'] || '';
                    const channel = row['Nome da Loja no UpSeller'] || row['Plataformas'] || 'ML';

                    if (!sku || qty <= 0) {
                        skippedRows.push(i + 1);
                        continue;
                    }

                    valuesToInsert.push([
                        // Campos originais do Excel (1-67)
                        orderIdPlatform,                               // 1. Nº de Pedido da Plataforma
                        orderIdInternal,                               // 2. Nº de Pedido
                        row['Plataformas'],                           // 3. Plataformas
                        row['Nome da Loja no UpSeller'],              // 4. Nome da Loja no UpSeller
                        row['Estado do Pedido'],                      // 5. Estado do Pedido
                        row['3PL Status'],                            // 6. 3PL Status
                        row['Hora do Pedido'],                        // 7. Hora do Pedido
                        row['Hora do Pagamento'],                     // 8. Hora do Pagamento
                        row['Horário Programado'],                    // 9. Horário Programado
                        row['Impressão da Etiqueta'],                 // 10. Impressão da Etiqueta
                        row['Enviado'],                               // 11. Enviado
                        row['Horário de Saída'],                      // 12. Horário de Saída
                        row['Horário da Retirada'],                   // 13. Horário da Retirada
                        row['Hora de Envio'],                         // 14. Hora de Envio
                        row['Pago'],                                  // 15. Pago
                        row['Moeda'],                                 // 16. Moeda
                        row['Valor do Pedido'],                       // 17. Valor do Pedido
                        row['Valor Total de Produtos'],               // 18. Valor Total de Produtos
                        row['Descontos e Cupons'],                    // 19. Descontos e Cupons
                        row['Comissão Total'],                        // 20. Comissão Total
                        row['Frete do Comprador'],                    // 21. Frete do Comprador
                        row['Total de Frete'],                        // 22. Total de Frete
                        row['Lucro Estimado'],                        // 23. Lucro Estimado
                        row['Notas do Comprador'],                    // 24. Notas do Comprador
                        row['Observações'],                           // 25. Observações
                        row['Pós-venda/Cancelado/Devolvido'],        // 26. Pós-venda/Cancelado/Devolvido
                        row['Cancelado por'],                         // 27. Cancelado por
                        row['Razão do Cancelamento'],                 // 28. Razão do Cancelamento
                        row['Nome do Anúncio'],                       // 29. Nome do Anúncio
                        sku,                                          // 30. SKU
                        row['Variação'],                              // 31. Variação
                        row['Link da Imagem'],                        // 32. Link da Imagem
                        unitPrice,                                    // 33. Preço de Produto
                        qty,                                          // 34. Qtd. do Produto
                        row['NCM*'],                                  // 35. NCM*
                        row['Origem*'],                               // 36. Origem*
                        row['Unidade*'],                              // 37. Unidade*
                        row['Imposto*'],                              // 38. Imposto*
                        row['SKU (Armazém)'],                         // 39. SKU (Armazém)
                        row['Nome do Produto'],                       // 40. Nome do Produto
                        row['Custo Médio'],                           // 41. Custo Médio
                        row['Custo do Produto'],                      // 42. Custo do Produto
                        row['Armazém'],                               // 43. Armazém
                        customer,                                     // 44. Nome de Comprador
                        row['ID do Comprador'],                       // 45. ID do Comprador
                        row['Data de Registração'],                   // 46. Data de Registração
                        row['ID da Taxa'],                            // 47. ID da Taxa
                        row['Nome do Destinatário'],                  // 48. Nome do Destinatário
                        row['Celular do Destinatário'],               // 49. Celular do Destinatário
                        row['Telefone do Destinatário'],              // 50. Telefone do Destinatário
                        row['Endereço do Destinatário'],              // 51. Endereço do Destinatário
                        row['Nome de Empresa'],                       // 52. Nome de Empresa
                        row['IE'],                                    // 53. IE
                        row['Endereço 1'],                            // 54. Endereço 1
                        row['Endereço 2'],                            // 55. Endereço 2
                        row['Número'],                                // 56. Número
                        row['Bairro'],                                // 57. Bairro
                        row['Cidade'],                                // 58. Cidade
                        row['Estado'],                                // 59. Estado
                        row['CEP'],                                   // 60. CEP
                        row['País/Região'],                           // 61. País/Região
                        row['Comprador Designado'],                   // 62. Comprador Designado
                        row['Método de Envio'],                       // 63. Método de Envio
                        row['Nº de Rastreio'],                        // 64. Nº de Rastreio
                        row['Método de coletar'],                     // 65. Método de coletar
                        row['Etiqueta'],                              // 66. Etiqueta

                        // Campos do sistema (67-85)
                        clientIdNum,                                  // 67. client_id
                        batchId,                                      // 68. import_id
                        filename,                                     // 69. original_filename
                        i + 1,                                        // 70. row_num
                        orderIdPlatform || orderIdInternal,           // 71. order_id
                        orderDate,                                    // 72. order_date
                        sku.toUpperCase(),                            // 73. sku_text
                        qty,                                          // 74. qty
                        unitPrice,                                    // 75. unit_price
                        unitPrice * qty,                              // 76. total
                        customer,                                     // 77. customer
                        channel,                                      // 78. channel
                        'pending'                                     // 79. status
                        // matched_sku, match_score, match_source, error_msg, created_at, processed_at serão NULL ou DEFAULT
                    ]);
                } catch (rowError: any) {
                    console.error(`Erro ao processar linha ${i + 1}:`, rowError.message);
                    errors.push(`Linha ${i + 1}: ${rowError.message}`);
                }
            }

            // Deduplicar dados antes de inserir (evitar "cannot affect row a second time")
            console.log(`🔍 Deduplicando ${valuesToInsert.length} linhas...`);

            // Atualizar progresso - 20%
            uploadProgress.set(batchId, {
                stage: 'deduplicating',
                current: 20,
                total: 100,
                message: `Deduplicando ${valuesToInsert.length} linhas...`
            });

            const uniqueMap = new Map();
            for (const row of valuesToInsert) {
                // Chave única: client_id + Nº Pedido + sku_text + qty + unit_price
                // Índices: 66=client_id, 0=Nº Pedido Plataforma, 72=sku_text, 73=qty, 74=unit_price
                const key = `${row[66]}_${row[0]}_${row[72]}_${row[73]}_${row[74]}`;
                uniqueMap.set(key, row); // Se duplicado, mantém o último
            }
            const uniqueValues = Array.from(uniqueMap.values());
            console.log(`✅ ${uniqueValues.length} linhas únicas (${valuesToInsert.length - uniqueValues.length} duplicatas removidas)`);

            // BULK INSERT em lotes de 500 linhas
            const BATCH_SIZE = 500;
            const NUM_FIELDS = 79; // Total de campos que estamos inserindo
            console.log(`📦 Inserindo ${uniqueValues.length} linhas em lotes de ${BATCH_SIZE}...`);

            // Atualizar progresso - 30%
            uploadProgress.set(batchId, {
                stage: 'inserting',
                current: 30,
                total: 100,
                message: `Inserindo ${uniqueValues.length} linhas no banco...`
            });

            for (let i = 0; i < uniqueValues.length; i += BATCH_SIZE) {
                const batch = uniqueValues.slice(i, i + BATCH_SIZE);

                // Construir placeholders dinamicamente para 79 campos
                const placeholders = batch.map((_, idx) => {
                    const offset = idx * NUM_FIELDS;
                    const params = Array.from({ length: NUM_FIELDS }, (_, i) => `$${offset + i + 1}`).join(', ');
                    return `(${params}, NOW())`; // +1 para created_at
                }).join(',');

                const flatValues = batch.flat();

                try {
                    await pool.query(
                        `INSERT INTO raw_export_orders (
                            "Nº de Pedido da Plataforma",
                            "Nº de Pedido",
                            "Plataformas",
                            "Nome da Loja no UpSeller",
                            "Estado do Pedido",
                            "3PL Status",
                            "Hora do Pedido",
                            "Hora do Pagamento",
                            "Horário Programado",
                            "Impressão da Etiqueta",
                            "Enviado",
                            "Horário de Saída",
                            "Horário da Retirada",
                            "Hora de Envio",
                            "Pago",
                            "Moeda",
                            "Valor do Pedido",
                            "Valor Total de Produtos",
                            "Descontos e Cupons",
                            "Comissão Total",
                            "Frete do Comprador",
                            "Total de Frete",
                            "Lucro Estimado",
                            "Notas do Comprador",
                            "Observações",
                            "Pós-venda/Cancelado/Devolvido",
                            "Cancelado por",
                            "Razão do Cancelamento",
                            "Nome do Anúncio",
                            "SKU",
                            "Variação",
                            "Link da Imagem",
                            "Preço de Produto",
                            "Qtd. do Produto",
                            "NCM*",
                            "Origem*",
                            "Unidade*",
                            "Imposto*",
                            "SKU (Armazém)",
                            "Nome do Produto",
                            "Custo Médio",
                            "Custo do Produto",
                            "Armazém",
                            "Nome de Comprador",
                            "ID do Comprador",
                            "Data de Registração",
                            "ID da Taxa",
                            "Nome do Destinatário",
                            "Celular do Destinatário",
                            "Telefone do Destinatário",
                            "Endereço do Destinatário",
                            "Nome de Empresa",
                            "IE",
                            "Endereço 1",
                            "Endereço 2",
                            "Número",
                            "Bairro",
                            "Cidade",
                            "Estado",
                            "CEP",
                            "País/Região",
                            "Comprador Designado",
                            "Método de Envio",
                            "Nº de Rastreio",
                            "Método de coletar",
                            "Etiqueta",
                            client_id,
                            import_id,
                            original_filename,
                            row_num,
                            order_id,
                            order_date,
                            sku_text,
                            qty,
                            unit_price,
                            total,
                            customer,
                            channel,
                            status,
                            created_at
                        ) VALUES ${placeholders}
                        ON CONFLICT (client_id, "Nº de Pedido da Plataforma", sku_text, qty, unit_price) 
                        DO UPDATE SET
                            "Nº de Pedido" = EXCLUDED."Nº de Pedido",
                            "Plataformas" = EXCLUDED."Plataformas",
                            "Nome da Loja no UpSeller" = EXCLUDED."Nome da Loja no UpSeller",
                            "Estado do Pedido" = EXCLUDED."Estado do Pedido",
                            "3PL Status" = EXCLUDED."3PL Status",
                            "Hora do Pedido" = EXCLUDED."Hora do Pedido",
                            "Hora do Pagamento" = EXCLUDED."Hora do Pagamento",
                            "Horário Programado" = EXCLUDED."Horário Programado",
                            "Impressão da Etiqueta" = EXCLUDED."Impressão da Etiqueta",
                            "Enviado" = EXCLUDED."Enviado",
                            "Horário de Saída" = EXCLUDED."Horário de Saída",
                            "Horário da Retirada" = EXCLUDED."Horário da Retirada",
                            "Hora de Envio" = EXCLUDED."Hora de Envio",
                            "Pago" = EXCLUDED."Pago",
                            "Moeda" = EXCLUDED."Moeda",
                            "Valor do Pedido" = EXCLUDED."Valor do Pedido",
                            "Valor Total de Produtos" = EXCLUDED."Valor Total de Produtos",
                            "Descontos e Cupons" = EXCLUDED."Descontos e Cupons",
                            "Comissão Total" = EXCLUDED."Comissão Total",
                            "Frete do Comprador" = EXCLUDED."Frete do Comprador",
                            "Total de Frete" = EXCLUDED."Total de Frete",
                            "Lucro Estimado" = EXCLUDED."Lucro Estimado",
                            "Notas do Comprador" = EXCLUDED."Notas do Comprador",
                            "Observações" = EXCLUDED."Observações",
                            "Pós-venda/Cancelado/Devolvido" = EXCLUDED."Pós-venda/Cancelado/Devolvido",
                            "Cancelado por" = EXCLUDED."Cancelado por",
                            "Razão do Cancelamento" = EXCLUDED."Razão do Cancelamento",
                            "Nome do Anúncio" = EXCLUDED."Nome do Anúncio",
                            "SKU" = EXCLUDED."SKU",
                            "Variação" = EXCLUDED."Variação",
                            "Link da Imagem" = EXCLUDED."Link da Imagem",
                            "Preço de Produto" = EXCLUDED."Preço de Produto",
                            "Qtd. do Produto" = EXCLUDED."Qtd. do Produto",
                            "NCM*" = EXCLUDED."NCM*",
                            "Origem*" = EXCLUDED."Origem*",
                            "Unidade*" = EXCLUDED."Unidade*",
                            "Imposto*" = EXCLUDED."Imposto*",
                            "SKU (Armazém)" = EXCLUDED."SKU (Armazém)",
                            "Nome do Produto" = EXCLUDED."Nome do Produto",
                            "Custo Médio" = EXCLUDED."Custo Médio",
                            "Custo do Produto" = EXCLUDED."Custo do Produto",
                            "Armazém" = EXCLUDED."Armazém",
                            "Nome de Comprador" = EXCLUDED."Nome de Comprador",
                            "ID do Comprador" = EXCLUDED."ID do Comprador",
                            "Data de Registração" = EXCLUDED."Data de Registração",
                            "ID da Taxa" = EXCLUDED."ID da Taxa",
                            "Nome do Destinatário" = EXCLUDED."Nome do Destinatário",
                            "Celular do Destinatário" = EXCLUDED."Celular do Destinatário",
                            "Telefone do Destinatário" = EXCLUDED."Telefone do Destinatário",
                            "Endereço do Destinatário" = EXCLUDED."Endereço do Destinatário",
                            "Nome de Empresa" = EXCLUDED."Nome de Empresa",
                            "IE" = EXCLUDED."IE",
                            "Endereço 1" = EXCLUDED."Endereço 1",
                            "Endereço 2" = EXCLUDED."Endereço 2",
                            "Número" = EXCLUDED."Número",
                            "Bairro" = EXCLUDED."Bairro",
                            "Cidade" = EXCLUDED."Cidade",
                            "Estado" = EXCLUDED."Estado",
                            "CEP" = EXCLUDED."CEP",
                            "País/Região" = EXCLUDED."País/Região",
                            "Comprador Designado" = EXCLUDED."Comprador Designado",
                            "Método de Envio" = EXCLUDED."Método de Envio",
                            "Nº de Rastreio" = EXCLUDED."Nº de Rastreio",
                            "Método de coletar" = EXCLUDED."Método de coletar",
                            "Etiqueta" = EXCLUDED."Etiqueta",
                            customer = EXCLUDED.customer,
                            channel = EXCLUDED.channel,
                            order_date = EXCLUDED.order_date,
                            order_id = EXCLUDED.order_id,
                            total = EXCLUDED.total,
                            import_id = EXCLUDED.import_id,
                            original_filename = EXCLUDED.original_filename,
                            row_num = EXCLUDED.row_num,
                            status = 'pending',
                            processed_at = NULL`,
                        flatValues
                    );
                    insertedRows += batch.length;
                    console.log(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} linhas inseridas/atualizadas`);

                    // Atualizar progresso - 30% a 50%
                    const insertProgress = 30 + Math.round((insertedRows / uniqueValues.length) * 20);
                    uploadProgress.set(batchId, {
                        stage: 'inserting',
                        current: insertProgress,
                        total: 100,
                        message: `Inserindo ${insertedRows}/${uniqueValues.length} linhas...`
                    });
                } catch (batchError: any) {
                    console.error(`❌ Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError.message);
                    errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
                }
            }

            console.log(`✅ ${insertedRows} linhas inseridas em raw_export_orders`);
            if (skippedRows.length > 0) {
                console.log(`⚠️  ${skippedRows.length} linhas puladas (sem SKU ou qtd <= 0)`);
            }

            // AUTO-RELACIONAR com aliases aprendidos (igual ao FULL)
            let autoMatched = 0;

            if (insertedRows > 0) {
                console.log(`🔄 Iniciando auto-relacionamento...`);

                // ✅ Progresso: 50% - iniciando relacionamento
                uploadProgress.set(batchId, {
                    stage: 'relating',
                    current: 50,
                    total: 100,
                    message: `Iniciando relacionamento de SKUs...`
                });

                // Buscar todas as linhas recém-inseridas (incluindo SKU Armazém)
                const pendingRows = await pool.query(
                    `SELECT id, sku_text, "SKU (Armazém)" as sku_armazem
                     FROM raw_export_orders 
                     WHERE import_id = $1 AND status = 'pending'`,
                    [batchId]
                );

                console.log(`📦 Processando ${pendingRows.rows.length} linhas para auto-relacionamento em batches...`);

                // Atualizar progresso - 55%
                uploadProgress.set(batchId, {
                    stage: 'relating',
                    current: 55,
                    total: 100,
                    message: `Relacionando 0/${pendingRows.rows.length} SKUs...`
                });

                // Processar em batches de 1000 para acelerar
                const RELATE_BATCH_SIZE = 1000;
                for (let i = 0; i < pendingRows.rows.length; i += RELATE_BATCH_SIZE) {
                    const batch = pendingRows.rows.slice(i, i + RELATE_BATCH_SIZE);
                    const batchNum = Math.floor(i / RELATE_BATCH_SIZE) + 1;
                    const totalBatches = Math.ceil(pendingRows.rows.length / RELATE_BATCH_SIZE);

                    console.log(`🔍 Relacionando batch ${batchNum}/${totalBatches} (${batch.length} linhas)...`);

                    // Atualizar progresso - 55% a 90%
                    const relateProgress = 55 + Math.round((i / pendingRows.rows.length) * 35);
                    uploadProgress.set(batchId, {
                        stage: 'relating',
                        current: relateProgress,
                        total: 100,
                        message: `Batch ${batchNum}/${totalBatches} - ${autoMatched} relacionados`
                    });

                    for (const row of batch) {
                        let matchedSku: string | null = null;
                        let matchSource: string = '';

                        // 1️⃣ PRIMEIRO: Buscar SKU exato na tabela produtos (sku_text ou sku_armazem)
                        const produtoResult = await pool.query(
                            `SELECT sku 
                             FROM obsidian.produtos 
                             WHERE UPPER(sku) = UPPER(TRIM($1)) OR UPPER(sku) = UPPER(TRIM($2))
                             LIMIT 1`,
                            [row.sku_text, row.sku_armazem]
                        );

                        if (produtoResult.rows.length > 0) {
                            matchedSku = produtoResult.rows[0].sku;
                            matchSource = 'direct';
                        } else {
                            // 1.5️⃣ BUSCA FUZZY: Remover caracteres especiais e tentar novamente
                            const fuzzyResult = await pool.query(
                                `SELECT sku 
                                 FROM obsidian.produtos 
                                 WHERE UPPER(REGEXP_REPLACE(sku, '[^A-Z0-9]', '', 'g')) = 
                                       UPPER(REGEXP_REPLACE($1, '[^A-Z0-9]', '', 'g'))
                                    OR UPPER(REGEXP_REPLACE(sku, '[^A-Z0-9]', '', 'g')) = 
                                       UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                                 LIMIT 1`,
                                [row.sku_text, row.sku_armazem]
                            );

                            if (fuzzyResult.rows.length > 0) {
                                matchedSku = fuzzyResult.rows[0].sku;
                                matchSource = 'fuzzy';
                            } else {
                                // 1.6️⃣ BUSCA INTELIGENTE: Size variation matching (37/38 → 38)
                                const smartResult = await pool.query(
                                    `WITH normalized AS (
                                        SELECT 
                                            sku,
                                            REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') as sku_norm,
                                            SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '^[A-Z0-9]*[A-Z]') as sku_base,
                                            SUBSTRING(REGEXP_REPLACE(UPPER(sku), '[^A-Z0-9]', '', 'g') FROM '[0-9]+$') as sku_size
                                        FROM obsidian.produtos
                                    ),
                                    search_parts AS (
                                        SELECT 
                                            REGEXP_REPLACE(UPPER($1), '[^A-Z0-9]', '', 'g') as search_norm,
                                            SUBSTRING(REGEXP_REPLACE(UPPER($1), '[^A-Z0-9]', '', 'g') FROM '^[A-Z0-9]*[A-Z]') as search_base,
                                            SUBSTRING(REGEXP_REPLACE(UPPER($1), '[^A-Z0-9]', '', 'g') FROM '[0-9]+$') as search_size
                                    )
                                    SELECT n.sku
                                    FROM normalized n, search_parts s
                                    WHERE n.sku_base = s.search_base
                                      AND s.search_size LIKE '%' || n.sku_size || '%'
                                    ORDER BY LENGTH(n.sku_size) DESC
                                    LIMIT 1`,
                                    [row.sku_text || row.sku_armazem]
                                );

                                if (smartResult.rows.length > 0) {
                                    matchedSku = smartResult.rows[0].sku;
                                    matchSource = 'smart';
                                } else {
                                    // 2️⃣ BUSCAR EM ALIASES com normalização (sku_text ou sku_armazem)
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
                                        [clientIdNum, row.sku_text, row.sku_armazem]
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
                            }
                        }

                        // Se encontrou match, relacionar
                        if (matchedSku) {
                            await pool.query(
                                `UPDATE raw_export_orders 
                                 SET matched_sku = $1, 
                                     status = 'matched', 
                                     match_source = $2,
                                     processed_at = NOW() 
                                 WHERE id = $3`,
                                [matchedSku, matchSource, row.id]
                            );

                            autoMatched++;
                        }
                    }
                }

                console.log(`✅ Auto-relacionamento concluído: ${autoMatched} itens relacionados`);

                // ✅ Atualizar progresso - 90%
                uploadProgress.set(batchId, {
                    stage: 'finalizing',
                    current: 90,
                    total: 100,
                    message: `Finalizando... ${autoMatched} de ${pendingRows.rows.length} relacionados`
                });
            }

            // Contar pendentes restantes
            const pendingCount = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM raw_export_orders 
                 WHERE import_id = $1 AND status = 'pending'`,
                [batchId]
            );
            const remainingPending = parseInt(pendingCount.rows[0].count);

            console.log(`📊 Resumo: ${autoMatched} matched, ${remainingPending} pendentes`);

            // Atualizar batch com dados processados
            await pool.query(
                `UPDATE obsidian.import_batches 
                 SET processed_rows = $1, status = 'ready', finished_at = NOW() 
                 WHERE import_id = $2`,
                [insertedRows, batchId]
            );

            // ✅ PROGRESSO FINAL - 100% COMPLETED
            uploadProgress.set(batchId, {
                stage: 'completed',
                current: 100,
                total: 100,
                message: `✅ Concluído! ${insertedRows} linhas | ${autoMatched} relacionados | ${remainingPending} pendentes`
            });

            // Registrar log de atividade
            try {
                await logActivity({
                    user_email: (req as AuthRequest).user?.email || 'sistema',
                    user_name: (req as AuthRequest).user?.nome || 'Sistema',
                    action: 'upload_ml',
                    entity_type: 'import_batch',
                    entity_id: batchId,
                    details: {
                        filename,
                        total_rows: jsonData.length,
                        inserted_rows: insertedRows,
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
                linhas: jsonData.length,
                linhas_inseridas: insertedRows,
                linhas_ignoradas: jsonData.length - insertedRows,
                auto_relacionadas: autoMatched,
                pendentes: remainingPending,
                errors: errors.length > 0 ? errors : undefined,
                message: remainingPending === 0
                    ? '✅ Todos os itens foram relacionados automaticamente!'
                    : `✅ ${insertedRows} linhas importadas. ${autoMatched} itens relacionados, ${remainingPending} aguardam relacionamento manual.`
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
                 SET matched_sku = UPPER($1), 
                     status = 'matched', 
                     processed_at = NOW() 
                 WHERE id = $2
                 RETURNING id, matched_sku, status`,
                [sku, raw_id]
            );

            console.log('✅ ML - Item atualizado:', updateResult.rows[0]);
            console.log('📊 ML - Linhas afetadas:', updateResult.rowCount);

            // 🔥 AUTO-RELACIONAMENTO EM LOTE: Buscar outros itens ML com o mesmo sku_text
            let autoRelacionados = 0;
            const skuTextNormalized = item.sku_text?.trim().toUpperCase();

            if (skuTextNormalized) {
                console.log(`🔍 ML - Buscando outros itens pendentes com SKU "${skuTextNormalized}" do mesmo cliente...`);

                // Buscar outros itens pendentes com o mesmo sku_text (exceto o que acabamos de relacionar)
                const outrosPendentesResult = await pool.query(
                    `SELECT id, sku_text 
                     FROM raw_export_orders 
                     WHERE client_id = $1 
                       AND status = 'pending' 
                       AND UPPER(TRIM(sku_text)) = $2
                       AND id != $3`,
                    [item.client_id, skuTextNormalized, raw_id]
                );

                if (outrosPendentesResult.rows.length > 0) {
                    console.log(`📦 ML - Encontrados ${outrosPendentesResult.rows.length} itens pendentes com mesmo SKU. Auto-relacionando...`);

                    // Relacionar todos de uma vez (bulk update)
                    const idsParaRelacionar = outrosPendentesResult.rows.map((r: any) => r.id);

                    await pool.query(
                        `UPDATE raw_export_orders 
                         SET matched_sku = UPPER($1), 
                             status = 'matched', 
                             processed_at = NOW() 
                         WHERE id = ANY($2::bigint[])`,
                        [sku, idsParaRelacionar]
                    );

                    autoRelacionados = outrosPendentesResult.rows.length;
                    console.log(`✅ ML - ${autoRelacionados} itens auto-relacionados com sucesso!`);
                } else {
                    console.log(`ℹ️ ML - Nenhum outro item pendente encontrado com o SKU "${skuTextNormalized}"`);
                }
            }

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
            return res.json({
                ok: true,
                raw_id,
                matched_sku: sku,
                alias_learned: !!learn_alias,
                auto_relacionados: autoRelacionados // 🔥 Novo campo
            });
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

            // 🔧 Normalizar client_id (aceita nome ou ID)
            let clientIdNum: number | null = null;
            if (client_id) {
                clientIdNum = await normalizeClientId(client_id);
                if (!clientIdNum) {
                    return res.status(400).json({ error: `Cliente "${client_id}" não encontrado` });
                }
                console.log(`✅ Cliente normalizado para ID: ${clientIdNum}`);
            }

            // Buscar todos os itens pendentes (filtrado por cliente se fornecido) - INCLUINDO SKU ARMAZÉM
            let query = `SELECT id, sku_text, "SKU (Armazém)" as sku_armazem, client_id
                         FROM raw_export_orders
                         WHERE status = 'pending'`;
            const params: any[] = [];

            if (clientIdNum) {
                params.push(clientIdNum);
                query += ` AND client_id = $${params.length}`;
            }

            const pendingItems = await pool.query(query, params);

            console.log(`📦 Encontrados ${pendingItems.rows.length} itens pendentes para relacionar`);

            let matched = 0;
            let notMatched = 0;

            // Log dos primeiros 5 itens para debug
            console.log('📦 Primeiros 5 itens pendentes:', pendingItems.rows.slice(0, 5).map(i => ({
                id: i.id,
                sku_text: i.sku_text,
                client_id: i.client_id
            })));

            for (const item of pendingItems.rows) {
                let matchedSku = null;

                // 1️⃣ Buscar SKU exato em produtos (sku_text OU sku_armazem)
                const produtoResult = await pool.query(
                    `SELECT sku 
                     FROM obsidian.produtos 
                     WHERE UPPER(sku) = UPPER(TRIM($1)) OR UPPER(sku) = UPPER(TRIM($2))
                     LIMIT 1`,
                    [item.sku_text, item.sku_armazem]
                );

                if (produtoResult.rows.length > 0) {
                    matchedSku = produtoResult.rows[0].sku;
                } else {
                    // 2️⃣ Buscar em aliases (sku_text OU sku_armazem)
                    const aliasResult = await pool.query(
                        `SELECT stock_sku, id 
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
                        [item.client_id, item.sku_text, item.sku_armazem]
                    );

                    if (aliasResult.rows.length > 0) {
                        matchedSku = aliasResult.rows[0].stock_sku;

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

                if (matchedSku) {
                    // Atualizar o item com o SKU encontrado
                    await pool.query(
                        `UPDATE raw_export_orders 
                         SET matched_sku = $1, 
                             status = 'matched', 
                             match_source = 'alias',
                             processed_at = NOW() 
                         WHERE id = $2`,
                        [matchedSku, item.id]
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
                    user_email: (req as AuthRequest).user?.email || 'sistema',
                    user_name: (req as AuthRequest).user?.nome || 'Sistema',
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

        // 🔧 Normalizar client_id (aceita nome ou ID)
        const clientIdNum = await normalizeClientId(client_id);
        if (!clientIdNum) {
            return res.status(400).json({ error: `Cliente "${client_id}" não encontrado` });
        }

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
                [clientIdNum, rawData.sku_texto]
            );

            if (existingAlias.rows.length === 0) {
                // Criar novo alias
                try {
                    await pool.query(
                        `INSERT INTO obsidian.sku_aliases 
                         (client_id, alias_text, stock_sku, confidence_default, times_used) 
                         VALUES ($1, $2, $3, 0.95, 1)`,
                        [clientIdNum, rawData.sku_texto, stock_sku]
                    );
                } catch (insertError: any) {
                    if (insertError.code === '23505') {
                        console.log('⚠️ Alias já existe (race condition), atualizando...');
                        const retryAlias = await pool.query(
                            `SELECT id FROM obsidian.sku_aliases 
                             WHERE client_id = $1 
                               AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                                   UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                            [clientIdNum, rawData.sku_texto]
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

        // Registrar log de atividade
        try {
            await logActivity({
                user_email: (req as AuthRequest).user?.email || 'sistema',
                user_name: (req as AuthRequest).user?.nome || 'Sistema',
                action: 'relate_manual',
                entity_type: 'full_envio_raw',
                entity_id: raw_id.toString(),
                details: {
                    raw_id,
                    sku_original: rawData.sku_texto,
                    stock_sku,
                    client_id: clientIdNum,
                    learn,
                    codigo_ml: rawData.codigo_ml
                },
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        } catch (logError) {
            console.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
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
             SET matched_sku = UPPER($1), 
                 status = 'matched', 
                 processed_at = NOW() 
             WHERE id = $2
             RETURNING id, matched_sku, status`,
            [matched_sku, raw_id]
        );

        console.log('✅ Linha atualizada:', updateResult.rows[0]);
        console.log('📊 Linhas afetadas:', updateResult.rowCount);

        // 🔥 AUTO-RELACIONAMENTO EM LOTE: Buscar outros itens com o mesmo sku_texto
        let autoRelacionados = 0;
        const skuTextoNormalized = rawData.sku_texto?.trim().toUpperCase();

        if (skuTextoNormalized) {
            console.log(`🔍 Buscando outros itens pendentes com SKU "${skuTextoNormalized}" no mesmo envio...`);

            // Buscar outros itens pendentes com o mesmo sku_texto (exceto o que acabamos de relacionar)
            const outrosPendentesResult = await pool.query(
                `SELECT id, sku_texto 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 
                   AND status = 'pending' 
                   AND UPPER(TRIM(sku_texto)) = $2
                   AND id != $3`,
                [envioId, skuTextoNormalized, raw_id]
            );

            if (outrosPendentesResult.rows.length > 0) {
                console.log(`📦 Encontrados ${outrosPendentesResult.rows.length} itens pendentes com mesmo SKU. Auto-relacionando...`);

                // Relacionar todos de uma vez (bulk update)
                const idsParaRelacionar = outrosPendentesResult.rows.map((r: any) => r.id);

                await pool.query(
                    `UPDATE logistica.full_envio_raw 
                     SET matched_sku = UPPER($1), 
                         status = 'matched', 
                         processed_at = NOW() 
                     WHERE id = ANY($2::bigint[])`,
                    [matched_sku, idsParaRelacionar]
                );

                autoRelacionados = outrosPendentesResult.rows.length;
                console.log(`✅ ${autoRelacionados} itens auto-relacionados com sucesso!`);
            } else {
                console.log(`ℹ️ Nenhum outro item pendente encontrado com o SKU "${skuTextoNormalized}"`);
            }
        }

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
                user_email: (req as AuthRequest).user?.email || 'sistema',
                user_name: (req as AuthRequest).user?.nome || 'Sistema',
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
            auto_relacionados: autoRelacionados, // 🔥 Novo campo
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
                const clientIdNum = await normalizeClientId(client_id);
                if (clientIdNum) {
                    params.push(clientIdNum);
                    whereClause += ` AND client_id = $${params.length}`;
                }
            }

            if (import_id) {
                params.push(import_id);
                whereClause += ` AND import_id = $${params.length}`;
            }

            // Buscar itens pendentes
            const pendingResult = await pool.query(
                `SELECT id, sku_text, client_id FROM raw_export_orders ${whereClause}`,
                params
            );

            console.log(`🔍 Encontrados ${pendingResult.rows.length} itens para relacionar`);

            let matched = 0;
            const BATCH_SIZE = 1000;
            const matchedIds: string[] = [];
            const matchedSkus: string[] = [];

            // Buscar todos os produtos e aliases de uma vez
            const allProdutos = await pool.query(`SELECT sku FROM obsidian.produtos`);
            const produtosMap = new Map(allProdutos.rows.map(p => [p.sku.toUpperCase(), p.sku]));

            const allAliases = await pool.query(
                `SELECT alias_text, stock_sku, id, 
                        UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) as normalized
                 FROM obsidian.sku_aliases 
                 ORDER BY confidence_default DESC, times_used DESC`
            );
            const aliasesMap = new Map(allAliases.rows.map(a => [a.normalized, { sku: a.stock_sku, id: a.id }]));

            console.log(`📦 Carregados ${produtosMap.size} produtos e ${aliasesMap.size} aliases em memória`);

            // Processar em lote
            for (let i = 0; i < pendingResult.rows.length; i++) {
                const item = pendingResult.rows[i];
                if (!item.sku_text) continue;

                const skuNormalized = item.sku_text.toString().trim().toUpperCase();

                // 1. Tentar match direto
                if (produtosMap.has(skuNormalized)) {
                    matchedIds.push(item.id);
                    matchedSkus.push(produtosMap.get(skuNormalized)!);
                    matched++;
                    continue;
                }

                // 2. Tentar match via alias
                const normalized = skuNormalized.replace(/[^A-Z0-9]/g, '');
                if (aliasesMap.has(normalized)) {
                    const alias = aliasesMap.get(normalized)!;
                    matchedIds.push(item.id);
                    matchedSkus.push(alias.sku);
                    matched++;
                }

                // Executar batch update quando atingir o tamanho do lote
                if (matchedIds.length >= BATCH_SIZE) {
                    await pool.query(
                        `UPDATE raw_export_orders SET 
                            matched_sku = data.matched_sku,
                            status = 'matched'
                         FROM (SELECT unnest($1::text[]) as id, unnest($2::text[]) as matched_sku) as data
                         WHERE raw_export_orders.id::text = data.id`,
                        [matchedIds, matchedSkus]
                    );
                    console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${matchedIds.length} itens relacionados`);
                    matchedIds.length = 0;
                    matchedSkus.length = 0;
                }
            }

            // Executar último batch
            if (matchedIds.length > 0) {
                await pool.query(
                    `UPDATE raw_export_orders SET 
                        matched_sku = data.matched_sku,
                        status = 'matched'
                     FROM (SELECT unnest($1::text[]) as id, unnest($2::text[]) as matched_sku) as data
                     WHERE raw_export_orders.id::text = data.id`,
                    [matchedIds, matchedSkus]
                );
                console.log(`✅ Último batch: ${matchedIds.length} itens relacionados`);
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

        console.log('📦 Emitir vendas - Body recebido:', { envio_id, import_id, source });

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

            // Contar itens pendentes (apenas para informar, não bloquear)
            const pendingCheck = await pool.query(
                `SELECT COUNT(*) as count 
                 FROM logistica.full_envio_raw 
                 WHERE envio_id = $1 AND status = 'pending'`,
                [envio_id]
            );

            const pendingCount = parseInt(pendingCheck.rows[0].count);

            // Contar itens que serão emitidos (apenas os relacionados)
            const itemCount = await pool.query(
                `SELECT COUNT(*) as count FROM logistica.full_envio_item WHERE envio_id = $1`,
                [envio_id]
            );

            const emittedCount = parseInt(itemCount.rows[0].count);

            if (emittedCount === 0) {
                return res.status(400).json({
                    error: 'Nenhum item relacionado para emitir. Relacione pelo menos um SKU antes de emitir.'
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
                    user_email: (req as AuthRequest).user?.email || 'sistema',
                    user_name: (req as AuthRequest).user?.nome || 'Sistema',
                    action: 'emit_sales',
                    entity_type: 'envio',
                    entity_id: envio_id.toString(),
                    details: {
                        source: 'FULL',
                        envio_num: envio.envio_num,
                        items_emitted: emittedCount,
                        items_pending: pendingCount,
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
                message: pendingCount > 0
                    ? `Vendas emitidas com sucesso. ${emittedCount} itens emitidos, ${pendingCount} itens ainda pendentes de relacionamento.`
                    : 'Vendas emitidas com sucesso',
                envio_num: envio.envio_num,
                items_emitted: emittedCount,
                items_pending: pendingCount,
                data_emissao
            });
        } else if (source === 'ML') {
            // ML: Processar vendas do Mercado Livre

            // ✅ REGRA: import_id é OBRIGATÓRIO para ML (cada import deve ser emitido individualmente)
            // Se não tiver import_id mas tiver client_id, busca o último import daquele cliente
            let finalImportId = import_id;

            if (!finalImportId && req.body.client_id) {
                // client_id pode ser número (ID) ou string (nome do cliente)
                let clientIdNum: number | null = null;

                // Tentar converter para número
                const parsedId = parseInt(req.body.client_id);
                if (!isNaN(parsedId)) {
                    clientIdNum = parsedId;
                } else {
                    // É nome do cliente, buscar ID
                    const clientResult = await pool.query(
                        `SELECT id FROM obsidian.clientes WHERE nome = $1 LIMIT 1`,
                        [req.body.client_id]
                    );
                    if (clientResult.rows.length > 0) {
                        clientIdNum = clientResult.rows[0].id;
                        console.log(`📦 Cliente "${req.body.client_id}" → ID ${clientIdNum}`);
                    }
                }

                if (clientIdNum) {
                    const lastImportResult = await pool.query(
                        `SELECT import_id 
                         FROM raw_export_orders 
                         WHERE client_id = $1 
                           AND status = 'matched'
                         ORDER BY created_at DESC 
                         LIMIT 1`,
                        [clientIdNum]
                    );

                    if (lastImportResult.rows.length > 0) {
                        finalImportId = lastImportResult.rows[0].import_id;
                        console.log(`📦 client_id ${clientIdNum} → import_id ${finalImportId}`);
                    }
                }
            }

            if (!finalImportId) {
                return res.status(400).json({
                    error: 'import_id é obrigatório para emitir vendas do ML'
                });
            }

            // Construir filtros - APENAS itens deste import específico
            let whereClause = `WHERE status = 'matched' AND matched_sku IS NOT NULL AND import_id = $1`;
            const params: any[] = [finalImportId];

            // Buscar itens relacionados agrupados por pedido
            const ordersResult = await pool.query(
                `SELECT 
                    order_id,
                    order_date,
                    customer,
                    channel,
                    "Método de Envio" as metodo_envio,
                    "Estado do Pedido" as estado_pedido,
                    "Pós-venda/Cancelado/Devolvido" as pos_venda,
                    "Razão do Cancelamento" as razao_cancelamento,
                    "Nº de Rastreio" as codigo_rastreio,
                    client_id,
                    json_agg(json_build_object(
                        'sku', matched_sku,
                        'quantidade', qty::numeric,
                        'preco_unitario', unit_price::numeric
                    )) as items
                 FROM raw_export_orders
                 ${whereClause}
                 GROUP BY order_id, order_date, customer, channel, "Método de Envio", "Estado do Pedido", "Pós-venda/Cancelado/Devolvido", "Razão do Cancelamento", "Nº de Rastreio", client_id
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
            let cancelados_skipped = 0;
            let cancelados_removidos = 0;
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

                    // ===== REGRA 1: VERIFICAR CANCELAMENTO =====
                    // Pedidos cancelados NÃO devem gerar vendas
                    // Se já existir venda, deve ser REMOVIDA
                    const estadoPedido = order.estado_pedido?.toUpperCase() || '';
                    const posVenda = order.pos_venda?.toUpperCase() || '';
                    const razaoCancelamento = order.razao_cancelamento || '';

                    const isCancelado = posVenda.includes('CANCELADO') ||
                        estadoPedido.includes('CANCEL') ||
                        (razaoCancelamento && razaoCancelamento.trim() !== '');

                    if (isCancelado) {
                        // Verificar se existe venda para este pedido
                        const pedidoUid = `ML-${order.order_id}`;
                        const vendaExistente = await pool.query(
                            `SELECT venda_id, sku_produto, quantidade_vendida, nome_cliente 
                             FROM obsidian.vendas 
                             WHERE pedido_uid = $1`,
                            [pedidoUid]
                        );

                        if (vendaExistente.rows.length > 0) {
                            // ===== ESTORNAR VENDA CANCELADA =====

                            // 1. CRIAR REGISTRO DE DEVOLUÇÃO FÍSICA PENDENTE **ANTES** DE DELETAR A VENDA
                            // (produto está voltando, precisa conferir quando chegar)
                            for (const venda of vendaExistente.rows) {
                                await pool.query(
                                    `INSERT INTO public.devolucoes (
                                        pedido_uid,
                                        sku_produto,
                                        quantidade_esperada,
                                        tipo_problema,
                                        motivo_cancelamento,
                                        codigo_rastreio
                                    ) VALUES ($1, $2, $3, 'pendente', $4, $5)
                                    ON CONFLICT (pedido_uid, sku_produto) 
                                    DO UPDATE SET 
                                        codigo_rastreio = EXCLUDED.codigo_rastreio,
                                        motivo_cancelamento = EXCLUDED.motivo_cancelamento`,
                                    [
                                        pedidoUid,
                                        venda.sku_produto,
                                        venda.quantidade_vendida,
                                        razaoCancelamento || 'Cancelado no ML',
                                        order.codigo_rastreio || null
                                    ]
                                );
                            }

                            // 2. DEVOLVER ESTOQUE (aumentar quantidade_atual)
                            for (const venda of vendaExistente.rows) {
                                await pool.query(
                                    `UPDATE obsidian.produtos 
                                     SET quantidade_atual = quantidade_atual + $1 
                                     WHERE UPPER(sku) = UPPER($2)`,
                                    [venda.quantidade_vendida, venda.sku_produto]
                                );

                                console.log(`📦 Estoque devolvido: ${venda.quantidade_vendida}x ${venda.sku_produto}`);
                            }

                            // 3. REMOVER venda da tabela (por último, para não perder a FK da devolução)
                            await pool.query(
                                `DELETE FROM obsidian.vendas WHERE pedido_uid = $1`,
                                [pedidoUid]
                            );

                            cancelados_removidos++;
                            console.log(`🗑️ ESTORNO - Pedido ${order.order_id} estava OK no import anterior, agora veio cancelado (${vendaExistente.rows.length} itens) → Devolução criada`);
                        } else {
                            // Apenas pular (não emitir nova venda)
                            cancelados_skipped++;
                            console.log(`⏭️ Pulando pedido ${order.order_id} - JÁ VEIO CANCELADO no primeiro import`);
                        }
                        continue; // Não processar este pedido
                    }

                    // ===== VERIFICAR SE PEDIDO ESTAVA CANCELADO E AGORA VOLTOU NORMAL =====
                    const pedidoUid = `ML-${order.order_id}`;
                    const devolucaoExistente = await pool.query(
                        `SELECT pedido_uid, sku_produto, quantidade_esperada 
                         FROM public.devolucoes 
                         WHERE pedido_uid = $1`,
                        [pedidoUid]
                    );

                    if (devolucaoExistente.rows.length > 0) {
                        // Pedido estava cancelado mas agora voltou normal!
                        console.log(`🔄 REVERSÃO - Pedido ${order.order_id} estava cancelado, agora voltou normal → Removendo devolução`);

                        // Remover devolução (pedido foi reativado pelo ML)
                        await pool.query(
                            `DELETE FROM public.devolucoes WHERE pedido_uid = $1`,
                            [pedidoUid]
                        );

                        // Continuar processamento normal abaixo (vai criar a venda)
                    }

                    // ===== REGRA 2: VERIFICAR FULFILLMENT =====
                    // Verificar se o canal OU método de envio é FULL/FBM (nesse caso, pular - não faz baixa)
                    const canal = order.channel?.toUpperCase() || 'ML';
                    const metodoEnvio = order.metodo_envio?.toUpperCase() || '';

                    // Detectar FULL/FBM no canal ou método de envio
                    // Inclui variações: FULL, FBM, FULFILLMENT, FUFILLMENT (erro de digitação comum)
                    const isFull = canal.includes('FULL') ||
                        canal.includes('FBM') ||
                        metodoEnvio.includes('FULL') ||
                        metodoEnvio.includes('FBM') ||
                        metodoEnvio.includes('FUFILL'); // Detecta "Mercado Fufillment" (erro de digitação)

                    if (isFull) {
                        full_skipped++;
                        console.log(`⏭️ Pulando pedido ${order.order_id} - Canal/Método FULL: ${canal} / ${metodoEnvio}`);
                        continue;
                    }

                    // Gerar pedido_uid único
                    const pedido_uid = `ML-${order.order_id}`;

                    // Formatar data usando parseExcelDate para formato brasileiro
                    const parsedDate = order.order_date ? parseExcelDate(order.order_date) : null;
                    const data_venda = parsedDate
                        ? parsedDate.toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0];

                    // Preparar itens - buscar preço do estoque (NUNCA da planilha!)
                    const items = [];
                    for (const item of order.items) {
                        // Buscar preço unitário do produto no estoque
                        const produtoResult = await pool.query(
                            `SELECT preco_unitario, nome FROM obsidian.produtos WHERE UPPER(sku) = UPPER($1)`,
                            [item.sku]
                        );

                        if (produtoResult.rows.length > 0) {
                            items.push({
                                sku: item.sku,
                                nome_produto: produtoResult.rows[0].nome || item.sku,
                                quantidade: parseFloat(item.quantidade || 0),
                                preco_unitario: parseFloat(produtoResult.rows[0].preco_unitario || 0) // DO ESTOQUE!
                            });
                        } else {
                            console.warn(`⚠️ Produto ${item.sku} não encontrado no estoque. Pulando...`);
                        }
                    }

                    if (items.length === 0) {
                        console.warn(`⚠️ Nenhum item válido encontrado no pedido ${order.order_id}. Pulando...`);
                        continue;
                    }

                    // Chamar função processar_pedido
                    const processResult = await pool.query(
                        `SELECT * FROM obsidian.processar_pedido($1, $2::date, $3, $4, $5::jsonb, $6::bigint, $7::uuid)`,
                        [pedido_uid, data_venda, clienteNome, canal, JSON.stringify(items), order.client_id, import_id]
                    );

                    if (processResult.rows.length > 0) {
                        inseridos++;
                        processResult.rows.forEach(row => {
                        });
                    }

                    // Nota: Não atualizamos status para 'emitted' porque a constraint só permite 'pending' ou 'matched'
                    // A venda já foi registrada em obsidian.vendas pela função processar_pedido

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
                // Buscar client_id do primeiro pedido para log
                const firstOrder = ordersResult.rows[0];
                const clientIdForLog = firstOrder?.client_id;

                let clientName = 'Sistema';
                if (clientIdForLog) {
                    const clientNameResult = await pool.query(
                        `SELECT nome FROM obsidian.clientes WHERE id = $1`,
                        [clientIdForLog]
                    );
                    clientName = clientNameResult.rows[0]?.nome || `ID ${clientIdForLog}`;
                }

                await logActivity({
                    user_email: (req as AuthRequest).user?.email || 'sistema',
                    user_name: (req as AuthRequest).user?.nome || 'Sistema',
                    action: 'emit_sales_ml',
                    entity_type: 'pedidos',
                    entity_id: finalImportId,
                    details: {
                        source: 'ML',
                        cliente: clientName,
                        import_id: finalImportId,
                        candidatos: ordersResult.rows.length,
                        inseridos,
                        ja_existiam,
                        full_skipped,
                        cancelados_skipped,
                        cancelados_removidos,
                        erros: erros.length
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
                cancelados_skipped,
                cancelados_removidos,
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

// ============================================
// 🎁 KITS - FULL (igual ao ML)
// ============================================

// POST - Buscar kit por composição (FULL)
enviosRouter.post('/full/kits/find-by-composition', async (req: Request, res: Response) => {
    try {
        // Aceita tanto 'componentes' quanto 'components' (compatibilidade)
        const componentes = req.body.componentes || req.body.components;

        console.log('🔍 [FULL find-by-composition] Payload recebido:', req.body);
        console.log('📦 [FULL find-by-composition] Componentes extraídos:', componentes);

        if (!componentes || !Array.isArray(componentes) || componentes.length === 0) {
            console.log('❌ [FULL find-by-composition] Componentes inválidos');
            return res.status(400).json({ error: 'Componentes são obrigatórios' });
        }

        // Buscar kits que contenham EXATAMENTE esses componentes
        const componentSkus = componentes.map((c: any) => c.sku || c.sku_componente).filter(Boolean);

        console.log('🎯 [FULL find-by-composition] SKUs a buscar:', componentSkus);

        if (componentSkus.length === 0) {
            return res.status(400).json({ error: 'SKUs de componentes inválidos' });
        }

        // Query para encontrar kits que contenham os componentes
        const result = await pool.query(
            `WITH kit_matches AS (
                SELECT 
                    p.sku as kit_sku,
                    p.nome as kit_nome,
                    p.preco_unitario as kit_preco,
                    COUNT(DISTINCT kc.component_sku) as matched_components,
                    json_agg(
                        json_build_object(
                            'sku_componente', kc.component_sku,
                            'quantidade_por_kit', kc.qty
                        )
                    ) as componentes_do_kit
                FROM obsidian.produtos p
                JOIN obsidian.kit_components kc ON kc.kit_sku = p.sku
                WHERE p.is_kit = true
                  AND kc.component_sku = ANY($1::text[])
                GROUP BY p.sku, p.nome, p.preco_unitario
            )
            SELECT 
                kit_sku,
                kit_nome,
                kit_preco,
                matched_components,
                componentes_do_kit
            FROM kit_matches
            WHERE matched_components = $2
            ORDER BY matched_components DESC, kit_sku
            LIMIT 10`,
            [componentSkus, componentSkus.length]
        );

        if (result.rows.length === 0) {
            return res.json({
                sku_kit: null,
                found: false,
                message: 'Nenhum kit encontrado com essa composição exata',
                kits: []
            });
        }

        // Retorna o primeiro kit encontrado no formato esperado pelo frontend
        const firstKit = result.rows[0];

        res.json({
            sku_kit: firstKit.kit_sku,
            found: true,
            kits: result.rows.map(row => ({
                sku: row.kit_sku,
                nome: row.kit_nome,
                preco_unitario: parseFloat(row.kit_preco),
                componentes: row.componentes_do_kit
            }))
        });

    } catch (error) {
        console.error('Erro ao buscar kit por composição (FULL):', error);
        res.status(500).json({ error: 'Erro ao buscar kit por composição' });
    }
});

// POST - Criar kit e relacionar (FULL)
enviosRouter.post('/full/kits/create-and-relate', async (req: Request, res: Response) => {
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

        console.log('🎁 [FULL create-and-relate] Payload recebido:', req.body);

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
            console.log('🔧 [FULL create-and-relate] SKU gerado:', sku);
        }

        if (!nome || !componentes || !Array.isArray(componentes) || componentes.length === 0) {
            console.log('❌ [FULL create-and-relate] Dados inválidos:', { nome, componentes });
            return res.status(400).json({ error: 'Nome e componentes são obrigatórios' });
        }

        await client.query('BEGIN');

        // Criar o kit
        const kitResult = await client.query(
            `INSERT INTO obsidian.produtos (sku, nome, tipo_produto, quantidade_atual, unidade_medida, preco_unitario, ativo)
             VALUES ($1, $2, 'KIT', 0, 'UN', $3, true)
             ON CONFLICT (sku) DO UPDATE SET
                nome = EXCLUDED.nome,
                preco_unitario = EXCLUDED.preco_unitario,
                atualizado_em = NOW()
             RETURNING *`,
            [sku, nome, preco_unitario || 0]
        );

        // Remover componentes antigos (caso seja update)
        await client.query('DELETE FROM obsidian.kit_components WHERE kit_sku = $1', [sku]);

        // Inserir componentes
        for (const comp of componentes) {
            const compSku = comp.sku || comp.sku_componente;
            const compQty = comp.q || comp.qty || comp.quantidade_por_kit || 1;

            if (!compSku) continue;

            console.log('📦 [FULL create-and-relate] Processando componente:', { compSku, compQty });

            // Verificar se componente existe
            const componenteExists = await client.query(
                'SELECT sku FROM obsidian.produtos WHERE sku = $1',
                [compSku]
            );

            if (componenteExists.rows.length === 0) {
                await client.query('ROLLBACK');
                console.log('❌ [FULL create-and-relate] Componente não existe:', compSku);
                return res.status(400).json({
                    error: `Componente ${compSku} não existe no estoque. Cadastre-o primeiro.`
                });
            }

            await client.query(
                `INSERT INTO obsidian.kit_components (kit_sku, component_sku, qty)
                 VALUES ($1, $2, $3)`,
                [sku, compSku, compQty]
            );
        }

        // Se tem raw_id, relacionar automaticamente na tabela FULL
        if (raw_id) {
            console.log('🔗 [FULL create-and-relate] Relacionando raw_id:', raw_id, 'com kit:', sku);

            await client.query(
                `UPDATE logistica.full_envio_raw 
                 SET matched_sku = $1, status = 'matched', processed_at = NOW()
                 WHERE id = $2`,
                [sku, raw_id]
            );
        }

        await client.query('COMMIT');

        console.log(`✅ [FULL] Kit ${sku} criado/atualizado com ${componentes.length} componentes`);

        res.json({
            success: true,
            sku_kit: sku,
            matched: !!raw_id,
            kit: kitResult.rows[0],
            componentes_count: componentes.length
        });

    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar kit (FULL):', error);
        res.status(500).json({ error: 'Erro ao criar kit', details: error.message });
    } finally {
        client.release();
    }
});


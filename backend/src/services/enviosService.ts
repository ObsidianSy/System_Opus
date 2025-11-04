import { pool } from '../database/db';
import XLSX from 'xlsx';
import { normalizeClientId } from '../utils/clienteHelper';
import { parseExcelDate } from '../utils/excelParser';
import logger from '../config/logger';
import { logActivity } from './activityLogger';

// Mapa de progresso de upload (em memória)
export const uploadProgress = new Map<number, {
    stage: string;
    current: number;
    total: number;
    message: string;
}>();

interface UploadParams {
    file: Express.Multer.File;
    body: {
        client_id: string;
        source?: string;
        envio_num?: string;
        import_date?: string;
        user_email?: string;
        user_name?: string;
    };
    ip?: string;
    userAgent?: string;
}

export async function processarUploadPlanilha({ file, body, ip, userAgent }: UploadParams) {
    const { client_id, source = 'ML', envio_num, import_date } = body;
    const filename = file.originalname || file.filename;

    // Validar client_id obrigatório
    if (!client_id) {
        throw { status: 400, error: 'client_id é obrigatório' };
    }

    // Normalizar client_id (aceita nome ou ID)
    const clientIdNum = await normalizeClientId(client_id);
    if (!clientIdNum) {
        throw { status: 400, error: `Cliente "${client_id}" não encontrado` };
    }

    // Processar Excel
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (source === 'FULL') {
        return await processarUploadFull({
            clientIdNum,
            filename,
            jsonData,
            envio_num,
            import_date,
            user_email: body.user_email,
            user_name: body.user_name,
            ip,
            userAgent
        });
    } else {
        return await processarUploadML({
            clientIdNum,
            filename,
            jsonData,
            envio_num,
            import_date,
            user_email: body.user_email,
            user_name: body.user_name,
            ip,
            userAgent
        });
    }
}

async function processarUploadFull(params: {
    clientIdNum: number;
    filename: string;
    jsonData: any[];
    envio_num?: string;
    import_date?: string;
    user_email?: string;
    user_name?: string;
    ip?: string;
    userAgent?: string;
}) {
    const { clientIdNum, filename, jsonData, envio_num, import_date, user_email, user_name, ip, userAgent } = params;

    // 1. CRIAR LOTE (import_batches)
    const batchResult = await pool.query(
        `INSERT INTO obsidian.import_batches 
         (filename, source, client_id, status, total_rows, started_at, import_date) 
         VALUES ($1, $2, $3, $4, $5, NOW(), $6) 
         RETURNING *`,
        [filename, 'FULL', clientIdNum, 'processing', jsonData.length, import_date || null]
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

    // LIMPAR LINHAS ANTIGAS SE FOR RE-UPLOAD
    await pool.query(
        `DELETE FROM logistica.full_envio_raw WHERE envio_id = $1`,
        [envioId]
    );

    // 3. INSERIR LINHAS BRUTAS (logistica.full_envio_raw)
    let insertedRows = 0;
    const errors: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        const codigoMl = row['CÃ³digo ML'] || row['Código ML'] || row['codigo_ml'] || '';
        const skuTexto = row['SKU'] || row['sku'] || codigoMl;
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
                logger.error('Erro ao processar linha', { linha: i + 1, error: rowError.message });
                errors.push(`Linha ${i + 1}: ${rowError.message}`);
            }
        }
    }

    // 4. AUTO-RELACIONAR com aliases
    let autoMatched = 0;

    if (insertedRows > 0) {
        const pendingRows = await pool.query(
            `SELECT id, codigo_ml, sku_texto, qtd 
             FROM logistica.full_envio_raw 
             WHERE envio_id = $1 AND status = 'pending'`,
            [envioId]
        );

        for (const row of pendingRows.rows) {
            let matchedSku: string | null = null;
            let matchSource: string = '';

            // Buscar SKU exato
            const produtoResult = await pool.query(
                `SELECT sku 
                 FROM obsidian.produtos 
                 WHERE UPPER(sku) = UPPER(TRIM($1))
                 LIMIT 1`,
                [row.sku_texto]
            );

            if (produtoResult.rows.length > 0) {
                matchedSku = produtoResult.rows[0].sku;
                matchSource = 'direct';
            } else {
                // Buscar em aliases
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
                const produtoInfo = await pool.query(
                    `SELECT sku, preco_unitario, COALESCE(is_kit, FALSE) as is_kit
                     FROM obsidian.produtos 
                     WHERE sku = $1`,
                    [matchedSku]
                );

                if (produtoInfo.rows.length > 0) {
                    const prod = produtoInfo.rows[0];
                    const valorTotal = prod.preco_unitario * row.qtd;

                    await pool.query(
                        `INSERT INTO logistica.full_envio_item 
                         (envio_id, codigo_ml, sku, qtd, is_kit, preco_unit_interno, valor_total)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (envio_id, sku, codigo_ml) 
                         DO UPDATE SET qtd = logistica.full_envio_item.qtd + EXCLUDED.qtd`,
                        [envioId, row.codigo_ml, matchedSku, row.qtd, prod.is_kit, prod.preco_unitario, valorTotal]
                    );
                }

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
            }
        }
    }

    // Contar pendentes
    const pendingCount = await pool.query(
        `SELECT COUNT(*) as count 
         FROM logistica.full_envio_raw 
         WHERE envio_id = $1 AND status = 'pending'`,
        [envioId]
    );
    const remainingPending = parseInt(pendingCount.rows[0].count);

    logger.info('Auto-relacionamento concluído', { autoMatched, remainingPending });

    // 5. NORMALIZAR
    try {
        await pool.query(
            `SELECT logistica.full_envio_normalizar($1::bigint)`,
            [envioId]
        );
        logger.info('Normalização concluída');
    } catch (normError: any) {
        logger.error('Erro ao normalizar', { error: normError.message });
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
            user_email: user_email || 'sistema',
            user_name: user_name || 'Sistema',
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
            ip_address: ip,
            user_agent: userAgent
        });
    } catch (logError) {
        logger.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
    }

    return {
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
    };
}

async function processarUploadML(params: {
    clientIdNum: number;
    filename: string;
    jsonData: any[];
    envio_num?: string;
    import_date?: string;
    user_email?: string;
    user_name?: string;
    ip?: string;
    userAgent?: string;
}) {
    const { clientIdNum, filename, jsonData, envio_num, user_email, user_name, ip, userAgent } = params;

    // Criar batch
    const result = await pool.query(
        `INSERT INTO obsidian.import_batches (filename, source, client_id, status, total_rows) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [filename, 'ML', clientIdNum, 'processing', jsonData.length]
    );

    const batchId = result.rows[0].import_id;
    let insertedRows = 0;
    const errors: string[] = [];

    logger.info(`📦 Processando ${jsonData.length} linhas do Excel ML...`);

    // Inicializar progresso
    uploadProgress.set(batchId, {
        stage: 'processing',
        current: 0,
        total: jsonData.length,
        message: 'Processando arquivo Excel...'
    });

    // Preparar dados em lote
    const valuesToInsert: any[][] = [];
    const skippedRows: number[] = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        try {
            const orderIdPlatform = row['Nº de Pedido da Plataforma'] || '';
            const orderIdInternal = row['Nº de Pedido'] || '';
            const orderDateRaw = row['Hora do Pedido'] || row['Hora do Pagamento'] || null;
            const orderDate = parseExcelDate(orderDateRaw);
            const sku = row['SKU'] || '';
            const qty = parseFloat(row['Qtd. do Produto'] || 0);
            const unitPrice = parseFloat(row['Preço de Produto'] || 0);
            const customer = row['Nome de Comprador'] || '';
            const channel = row['Plataformas'] || row['Nome da Loja no UpSeller'] || 'ML';

            if (!sku || qty <= 0) {
                skippedRows.push(i + 1);
                continue;
            }

            valuesToInsert.push([
                orderIdPlatform, orderIdInternal, row['Plataformas'], row['Nome da Loja no UpSeller'],
                row['Estado do Pedido'], row['3PL Status'], row['Hora do Pedido'], row['Hora do Pagamento'],
                row['Horário Programado'], row['Impressão da Etiqueta'], row['Enviado'], row['Horário de Saída'],
                row['Horário da Retirada'], row['Hora de Envio'], row['Pago'], row['Moeda'],
                row['Valor do Pedido'], row['Valor Total de Produtos'], row['Descontos e Cupons'], row['Comissão Total'],
                row['Frete do Comprador'], row['Total de Frete'], row['Lucro Estimado'], row['Notas do Comprador'],
                row['Observações'], row['Pós-venda/Cancelado/Devolvido'], row['Cancelado por'], row['Razão do Cancelamento'],
                row['Nome do Anúncio'], sku, row['Variação'], row['Link da Imagem'], unitPrice, qty,
                row['NCM*'], row['Origem*'], row['Unidade*'], row['Imposto*'], row['SKU (Armazém)'],
                row['Nome do Produto'], row['Custo Médio'], row['Custo do Produto'], row['Armazém'],
                customer, row['ID do Comprador'], row['Data de Registração'], row['ID da Taxa'],
                row['Nome do Destinatário'], row['Celular do Destinatário'], row['Telefone do Destinatário'],
                row['Endereço do Destinatário'], row['Nome de Empresa'], row['IE'], row['Endereço 1'],
                row['Endereço 2'], row['Número'], row['Bairro'], row['Cidade'], row['Estado'],
                row['CEP'], row['País/Região'], row['Comprador Designado'], row['Método de Envio'],
                row['Nº de Rastreio'], row['Método de coletar'], row['Etiqueta'],
                clientIdNum, batchId, filename, i + 1, orderIdPlatform || orderIdInternal,
                orderDate, sku, qty, unitPrice, unitPrice * qty, customer, channel, 'pending'
            ]);

            // DEBUG - verificar se o status está correto
            if (i < 3) {
                logger.info(`[DEBUG] Linha ${i + 1}: status = "${valuesToInsert[valuesToInsert.length - 1][78]}"`);
            }
        } catch (rowError: any) {
            logger.error(`Erro ao processar linha ${i + 1}:`, rowError.message);
            errors.push(`Linha ${i + 1}: ${rowError.message}`);
        }
    }

    // Deduplicar
    logger.info(`🔍 Deduplicando ${valuesToInsert.length} linhas...`);
    const uniqueMap = new Map();
    for (const row of valuesToInsert) {
        const key = `${row[66]}_${row[0]}_${row[72]}_${row[73]}_${row[74]}`;
        uniqueMap.set(key, row);
    }
    const uniqueValues = Array.from(uniqueMap.values());
    logger.info(`✅ ${uniqueValues.length} linhas únicas (${valuesToInsert.length - uniqueValues.length} duplicatas removidas)`);

    // BULK INSERT
    const BATCH_SIZE = 2000; // Aumentado para acelerar importação
    const NUM_FIELDS = 79;
    logger.info(`📦 Inserindo ${uniqueValues.length} linhas em lotes de ${BATCH_SIZE}...`);

    for (let i = 0; i < uniqueValues.length; i += BATCH_SIZE) {
        const batch = uniqueValues.slice(i, i + BATCH_SIZE);

        const placeholders = batch.map((_, idx) => {
            const offset = idx * NUM_FIELDS;
            const params = Array.from({ length: NUM_FIELDS }, (_, i) => `$${offset + i + 1}`).join(', ');
            return `(${params}, NOW())`;
        }).join(',');

        const flatValues = batch.flat();

        try {
            // DEBUG: Log do primeiro registro do lote para verificar valores
            if (i === 0) {
                logger.info(`[DEBUG] Primeiro registro do lote:`);
                logger.info(`  - Posição 78 (channel): "${batch[0][77]}"`);
                logger.info(`  - Posição 79 (status): "${batch[0][78]}"`);
                logger.info(`  - Total de campos: ${batch[0].length}`);
            }

            await pool.query(
                `INSERT INTO raw_export_orders (
                    "Nº de Pedido da Plataforma", "Nº de Pedido", "Plataformas", "Nome da Loja no UpSeller",
                    "Estado do Pedido", "3PL Status", "Hora do Pedido", "Hora do Pagamento",
                    "Horário Programado", "Impressão da Etiqueta", "Enviado", "Horário de Saída",
                    "Horário da Retirada", "Hora de Envio", "Pago", "Moeda",
                    "Valor do Pedido", "Valor Total de Produtos", "Descontos e Cupons", "Comissão Total",
                    "Frete do Comprador", "Total de Frete", "Lucro Estimado", "Notas do Comprador",
                    "Observações", "Pós-venda/Cancelado/Devolvido", "Cancelado por", "Razão do Cancelamento",
                    "Nome do Anúncio", "SKU", "Variação", "Link da Imagem", "Preço de Produto", "Qtd. do Produto",
                    "NCM*", "Origem*", "Unidade*", "Imposto*", "SKU (Armazém)", "Nome do Produto",
                    "Custo Médio", "Custo do Produto", "Armazém", "Nome de Comprador", "ID do Comprador",
                    "Data de Registração", "ID da Taxa", "Nome do Destinatário", "Celular do Destinatário",
                    "Telefone do Destinatário", "Endereço do Destinatário", "Nome de Empresa", "IE",
                    "Endereço 1", "Endereço 2", "Número", "Bairro", "Cidade", "Estado", "CEP",
                    "País/Região", "Comprador Designado", "Método de Envio", "Nº de Rastreio",
                    "Método de coletar", "Etiqueta", client_id, import_id, original_filename, row_num,
                    order_id, order_date, sku_text, qty, unit_price, total, customer, channel, status, created_at
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
                    processed_at = NULL`,
                flatValues
            );
            insertedRows += batch.length;
            logger.info(`  ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} linhas inseridas/atualizadas`);

            uploadProgress.set(batchId, {
                stage: 'inserting',
                current: insertedRows,
                total: uniqueValues.length,
                message: `Inserindo ${insertedRows}/${uniqueValues.length} linhas...`
            });
        } catch (batchError: any) {
            logger.error(`❌ Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, batchError.message);
            errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batchError.message}`);
        }
    }

    logger.info(`✅ ${insertedRows} linhas inseridas em raw_export_orders`);
    if (skippedRows.length > 0) {
        logger.info(`⚠️  ${skippedRows.length} linhas puladas (sem SKU ou qtd <= 0)`);
    }

    // AUTO-RELACIONAR
    let autoMatched = 0;

    if (insertedRows > 0) {
        logger.info(`🔄 Iniciando auto-relacionamento...`);

        uploadProgress.set(batchId, {
            stage: 'relating',
            current: 0,
            total: 0,
            message: 'Iniciando auto-relacionamento...'
        });

        const pendingRows = await pool.query(
            `SELECT id, sku_text 
             FROM raw_export_orders 
             WHERE import_id = $1 AND status = 'pending'`,
            [batchId]
        );

        logger.info(`📦 Processando ${pendingRows.rows.length} linhas para auto-relacionamento em batches...`);

        uploadProgress.set(batchId, {
            stage: 'relating',
            current: 0,
            total: pendingRows.rows.length,
            message: `Relacionando 0/${pendingRows.rows.length} SKUs...`
        });

        const RELATE_BATCH_SIZE = 1000; // Aumentado para acelerar
        for (let i = 0; i < pendingRows.rows.length; i += RELATE_BATCH_SIZE) {
            const batch = pendingRows.rows.slice(i, i + RELATE_BATCH_SIZE);
            const batchNum = Math.floor(i / RELATE_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(pendingRows.rows.length / RELATE_BATCH_SIZE);

            logger.info(`🔍 Relacionando batch ${batchNum}/${totalBatches} (${batch.length} linhas)...`);

            uploadProgress.set(batchId, {
                stage: 'relating',
                current: i,
                total: pendingRows.rows.length,
                message: `Batch ${batchNum}/${totalBatches} - ${autoMatched} relacionados`
            });

            // Coletar matches do batch para fazer UPDATE em massa
            const batchUpdates: Array<{ id: string, sku: string, source: string }> = [];
            const aliasUpdates: string[] = [];

            for (const row of batch) {
                let matchedSku: string | null = null;
                let matchSource: string = '';

                const produtoResult = await pool.query(
                    `SELECT sku 
                     FROM obsidian.produtos 
                     WHERE UPPER(sku) = UPPER(TRIM($1))
                     LIMIT 1`,
                    [row.sku_text]
                );

                if (produtoResult.rows.length > 0) {
                    matchedSku = produtoResult.rows[0].sku;
                    matchSource = 'direct';
                } else {
                    const aliasResult = await pool.query(
                        `SELECT stock_sku, confidence_default, id 
                         FROM obsidian.sku_aliases 
                         WHERE client_id = $1 
                           AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                               UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                         ORDER BY confidence_default DESC, times_used DESC 
                         LIMIT 1`,
                        [clientIdNum, row.sku_text]
                    );

                    if (aliasResult.rows.length > 0) {
                        matchedSku = aliasResult.rows[0].stock_sku;
                        matchSource = 'alias';
                        aliasUpdates.push(aliasResult.rows[0].id);
                    }
                }

                if (matchedSku) {
                    batchUpdates.push({
                        id: row.id,
                        sku: matchedSku,
                        source: matchSource
                    });
                    autoMatched++;
                }
            }

            // Fazer UPDATE em massa usando CASE WHEN
            if (batchUpdates.length > 0) {
                const ids = batchUpdates.map(u => u.id);
                const skuCases = batchUpdates.map(u => `WHEN '${u.id}' THEN '${u.sku}'`).join(' ');
                const sourceCases = batchUpdates.map(u => `WHEN '${u.id}' THEN '${u.source}'`).join(' ');

                await pool.query(`
                    UPDATE raw_export_orders 
                    SET matched_sku = CASE id ${skuCases} END,
                        status = 'matched',
                        match_source = CASE id ${sourceCases} END,
                        processed_at = NOW()
                    WHERE id = ANY($1::text[])
                `, [ids]);
            }

            // Atualizar aliases usados em massa
            if (aliasUpdates.length > 0) {
                await pool.query(`
                    UPDATE obsidian.sku_aliases 
                    SET times_used = times_used + 1, 
                        last_used_at = NOW() 
                    WHERE id = ANY($1::bigint[])
                `, [aliasUpdates]);
            }
        }

        logger.info(`✅ Auto-relacionamento concluído: ${autoMatched} itens relacionados`);

        uploadProgress.set(batchId, {
            stage: 'completed',
            current: pendingRows.rows.length,
            total: pendingRows.rows.length,
            message: `✅ Concluído! ${autoMatched} relacionados`
        });
    }

    // Contar pendentes
    const pendingCount = await pool.query(
        `SELECT COUNT(*) as count 
         FROM raw_export_orders 
         WHERE import_id = $1 AND status = 'pending'`,
        [batchId]
    );
    const remainingPending = parseInt(pendingCount.rows[0].count);

    logger.info(`📊 Resumo: ${autoMatched} matched, ${remainingPending} pendentes`);

    // Atualizar batch
    await pool.query(
        `UPDATE obsidian.import_batches 
         SET processed_rows = $1, status = 'ready', finished_at = NOW() 
         WHERE import_id = $2`,
        [insertedRows, batchId]
    );

    // Registrar log
    try {
        await logActivity({
            user_email: user_email || 'sistema',
            user_name: user_name || 'Sistema',
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
            ip_address: ip,
            user_agent: userAgent
        });
    } catch (logError) {
        logger.error('⚠️ Erro ao salvar log (não afeta operação):', logError);
    }

    return {
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
    };
}

// ========================================
// RELACIONAMENTO DE SKUs
// ========================================

interface RelacionarParams {
    envio_id?: number;
    import_id?: number;
    source?: string;
    client_id?: string;
    raw_id?: number;
    sku?: string;
    learn_alias?: boolean;
    alias_text?: string;
    user_email?: string;
    user_name?: string;
    ip?: string;
    userAgent?: string;
}

export async function relacionarSkus(params: RelacionarParams) {
    const { envio_id, import_id, source, client_id, raw_id, sku, learn_alias, alias_text, user_email, user_name, ip, userAgent } = params;

    // Relacionamento manual individual (ML)
    if (raw_id && sku) {
        return await relacionarManualML({ raw_id, sku, learn_alias, alias_text });
    }

    // Auto-relacionamento (FULL ou ML)
    if (source === 'FULL') {
        if (!envio_id) {
            throw { status: 400, error: 'envio_id é obrigatório para FULL' };
        }
        return await autoRelacionarFull({ envio_id });
    } else {
        return await autoRelacionarML({ client_id, user_email, user_name, ip, userAgent });
    }
}

async function relacionarManualML(params: { raw_id: number; sku: string; learn_alias?: boolean; alias_text?: string }) {
    const { raw_id, sku, learn_alias, alias_text } = params;

    logger.info('📦 Relacionamento manual ML - raw_id:', raw_id, 'sku:', sku);

    const itemResult = await pool.query(
        `SELECT id, order_id, sku_text, client_id 
         FROM raw_export_orders 
         WHERE id = $1`,
        [raw_id]
    );

    if (itemResult.rows.length === 0) {
        throw { status: 404, error: 'Item não encontrado' };
    }

    const item = itemResult.rows[0];

    await pool.query(
        `UPDATE raw_export_orders 
         SET matched_sku = $1, 
             status = 'matched', 
             processed_at = NOW() 
         WHERE id = $2`,
        [sku, raw_id]
    );

    // Aprender alias se solicitado
    if (learn_alias && (alias_text || item.sku_text)) {
        const textToLearn = alias_text || item.sku_text;
        await aprenderAlias(item.client_id, textToLearn, sku);
    }

    return { ok: true, raw_id, matched_sku: sku, alias_learned: !!learn_alias };
}

async function aprenderAlias(clientId: number, aliasText: string, stockSku: string) {
    const existingAlias = await pool.query(
        `SELECT id FROM obsidian.sku_aliases 
         WHERE client_id = $1 
           AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
               UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
        [clientId, aliasText]
    );

    if (existingAlias.rows.length === 0) {
        try {
            await pool.query(
                `INSERT INTO obsidian.sku_aliases 
                 (client_id, alias_text, stock_sku, confidence_default, times_used) 
                 VALUES ($1, $2, $3, 0.95, 1)`,
                [clientId, aliasText, stockSku]
            );
            logger.info('✅ Alias criado:', aliasText, '->', stockSku);
        } catch (insertError: any) {
            if (insertError.code === '23505') {
                const retryAlias = await pool.query(
                    `SELECT id FROM obsidian.sku_aliases 
                     WHERE client_id = $1 
                       AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                           UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))`,
                    [clientId, aliasText]
                );
                if (retryAlias.rows.length > 0) {
                    await pool.query(
                        `UPDATE obsidian.sku_aliases 
                         SET stock_sku = $1, 
                             times_used = times_used + 1, 
                             last_used_at = NOW() 
                         WHERE id = $2`,
                        [stockSku, retryAlias.rows[0].id]
                    );
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
            [stockSku, existingAlias.rows[0].id]
        );
        logger.info('✅ Alias atualizado:', aliasText, '->', stockSku);
    }
}

async function autoRelacionarFull(params: { envio_id: number }) {
    const { envio_id } = params;

    const envioResult = await pool.query(
        `SELECT client_id FROM logistica.full_envio WHERE id = $1`,
        [envio_id]
    );

    if (envioResult.rows.length === 0) {
        throw { status: 404, error: 'Envio não encontrado' };
    }

    const clientIdNum = envioResult.rows[0].client_id;

    const rawResult = await pool.query(
        `SELECT id, codigo_ml, sku_texto, qtd 
         FROM logistica.full_envio_raw 
         WHERE envio_id = $1 AND status = 'pending'`,
        [envio_id]
    );

    let matched = 0;
    let notMatched = 0;

    for (const row of rawResult.rows) {
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
            const alias = aliasResult.rows[0];

            await pool.query(
                `UPDATE logistica.full_envio_raw 
                 SET matched_sku = $1, 
                     status = 'matched', 
                     processed_at = NOW() 
                 WHERE id = $2`,
                [alias.stock_sku, row.id]
            );

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

    const newStatus = notMatched === 0 ? 'ready' : 'partial';
    await pool.query(
        `UPDATE logistica.full_envio 
         SET status = $1 
         WHERE id = $2`,
        [newStatus, envio_id]
    );

    return {
        success: true,
        matched,
        not_matched: notMatched,
        total: rawResult.rows.length,
        status: newStatus
    };
}

async function autoRelacionarML(params: { client_id?: string; user_email?: string; user_name?: string; ip?: string; userAgent?: string }) {
    const { client_id, user_email, user_name, ip, userAgent } = params;

    let clientIdNum: number | null = null;
    if (client_id) {
        clientIdNum = await normalizeClientId(client_id);
        if (!clientIdNum) {
            throw { status: 400, error: `Cliente "${client_id}" não encontrado` };
        }
    }

    let query = `SELECT id, sku_text, client_id
                 FROM raw_export_orders
                 WHERE status = 'pending'`;
    const queryParams: any[] = [];

    if (clientIdNum) {
        queryParams.push(clientIdNum);
        query += ` AND client_id = $${queryParams.length}`;
    }

    const pendingItems = await pool.query(query, queryParams);

    let matched = 0;
    let notMatched = 0;

    for (const item of pendingItems.rows) {
        let matchedSku = null;

        const produtoResult = await pool.query(
            `SELECT sku 
             FROM obsidian.produtos 
             WHERE UPPER(sku) = UPPER(TRIM($1))
             LIMIT 1`,
            [item.sku_text]
        );

        if (produtoResult.rows.length > 0) {
            matchedSku = produtoResult.rows[0].sku;
        } else {
            const aliasResult = await pool.query(
                `SELECT stock_sku, id 
                 FROM obsidian.sku_aliases 
                 WHERE client_id = $1 
                   AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                       UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                 ORDER BY confidence_default DESC, times_used DESC 
                 LIMIT 1`,
                [item.client_id, item.sku_text]
            );

            if (aliasResult.rows.length > 0) {
                matchedSku = aliasResult.rows[0].stock_sku;

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

    try {
        await logActivity({
            user_email: user_email || 'sistema',
            user_name: user_name || 'Sistema',
            action: 'auto_relate',
            entity_type: 'pedidos',
            entity_id: client_id || 'all',
            details: {
                source: 'ML',
                total: pendingItems.rows.length,
                matched,
                not_matched: notMatched,
                taxa_match: pendingItems.rows.length > 0 ? (matched / pendingItems.rows.length) * 100 : 0
            },
            ip_address: ip,
            user_agent: userAgent
        });
    } catch (logError) {
        logger.error('⚠️ Erro ao salvar log:', logError);
    }

    return {
        success: true,
        message: 'Auto-relacionamento ML concluído',
        total: pendingItems.rows.length,
        relacionados: matched,
        pendentes: notMatched,
        taxa_match: pendingItems.rows.length > 0 ? (matched / pendingItems.rows.length) * 100 : 0
    };
}

// ========================================
// EMISSÃO DE VENDAS
// ========================================

interface EmitirVendasParams {
    envio_id?: number;
    import_id?: string;  // UUID
    client_id?: number | string;
    source: string;
    user_email?: string;
    user_name?: string;
    ip?: string;
    userAgent?: string;
}

export async function emitirVendas(params: EmitirVendasParams) {
    const { envio_id, import_id, client_id, source, user_email, user_name, ip, userAgent } = params;

    if (source === 'FULL') {
        if (!envio_id) {
            throw { status: 400, error: 'envio_id é obrigatório para FULL' };
        }
        return await emitirVendasFull({ envio_id, user_email, user_name, ip, userAgent });
    } else {
        // Para ML, aceita import_id OU client_id
        let finalImportId = import_id;

        if (!finalImportId && client_id) {
            // Se client_id for string (nome), buscar o ID numérico
            let clientIdNum = client_id;

            if (typeof client_id === 'string' && isNaN(Number(client_id))) {
                // É um nome de cliente, buscar o ID
                const clientResult = await pool.query(
                    `SELECT id FROM obsidian.clientes WHERE UPPER(nome) = UPPER($1) LIMIT 1`,
                    [client_id]
                );

                if (clientResult.rows.length === 0) {
                    throw { status: 404, error: `Cliente '${client_id}' não encontrado` };
                }

                clientIdNum = clientResult.rows[0].id;
            }

            // Buscar o último import_id deste cliente
            const result = await pool.query(
                `SELECT import_id 
                 FROM raw_export_orders 
                 WHERE client_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [clientIdNum]
            );

            if (result.rows.length > 0) {
                finalImportId = result.rows[0].import_id;
            }
        }

        if (!finalImportId) {
            throw { status: 400, error: 'import_id ou client_id é obrigatório para ML' };
        }

        return await emitirVendasML({ import_id: finalImportId, user_email, user_name, ip, userAgent });
    }
}

async function emitirVendasFull(params: { envio_id: number; user_email?: string; user_name?: string; ip?: string; userAgent?: string }) {
    const { envio_id, user_email, user_name, ip, userAgent } = params;

    const envioResult = await pool.query(
        `SELECT e.*, c.nome as cliente_nome 
         FROM logistica.full_envio e
         JOIN obsidian.clientes c ON e.client_id = c.id
         WHERE e.id = $1`,
        [envio_id]
    );

    if (envioResult.rows.length === 0) {
        throw { status: 404, error: 'Envio não encontrado' };
    }

    const envio = envioResult.rows[0];

    const pendingCheck = await pool.query(
        `SELECT COUNT(*) as count 
         FROM logistica.full_envio_raw 
         WHERE envio_id = $1 AND status = 'pending'`,
        [envio_id]
    );

    if (parseInt(pendingCheck.rows[0].count) > 0) {
        throw {
            status: 400,
            error: 'Existem itens pendentes de relacionamento. Relacione todos os SKUs antes de emitir.'
        };
    }

    const itemCount = await pool.query(
        `SELECT COUNT(*) as count FROM logistica.full_envio_item WHERE envio_id = $1`,
        [envio_id]
    );

    if (parseInt(itemCount.rows[0].count) === 0) {
        throw {
            status: 400,
            error: 'Nenhum item encontrado para emitir. Execute a normalização primeiro.'
        };
    }

    const data_emissao = envio.import_date
        ? new Date(envio.import_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

    await pool.query(
        `SELECT logistica.full_envio_emitir($1::bigint, $2::date)`,
        [envio_id, data_emissao]
    );

    await pool.query(
        `UPDATE logistica.full_envio 
         SET status = 'emitted', 
             emitted_at = NOW() 
         WHERE id = $1`,
        [envio_id]
    );

    const salesCount = await pool.query(
        `SELECT COUNT(*) as count 
         FROM obsidian.vendas 
         WHERE canal = 'FULL-INBOUND' 
           AND nome_cliente = $1`,
        [envio.cliente_nome]
    );

    try {
        await logActivity({
            user_email: user_email || 'sistema',
            user_name: user_name || 'Sistema',
            action: 'emit_sales',
            entity_type: 'envio',
            entity_id: envio_id.toString(),
            details: {
                envio_num: envio.envio_num,
                cliente: envio.cliente_nome,
                total_vendas: parseInt(salesCount.rows[0].count),
                data_emissao
            },
            ip_address: ip,
            user_agent: userAgent
        });
    } catch (logError) {
        logger.error('⚠️ Erro ao salvar log:', logError);
    }

    return {
        success: true,
        message: `✅ ${salesCount.rows[0].count} vendas emitidas com sucesso!`,
        envio_id,
        envio_num: envio.envio_num,
        cliente: envio.cliente_nome,
        total_vendas: parseInt(salesCount.rows[0].count)
    };
}

async function emitirVendasML(params: { import_id: string; user_email?: string; user_name?: string; ip?: string; userAgent?: string }) {
    const { import_id, user_email, user_name, ip, userAgent } = params;

    const matchedOrders = await pool.query(
        `SELECT DISTINCT order_id 
         FROM raw_export_orders 
         WHERE import_id = $1 AND status = 'matched' AND matched_sku IS NOT NULL`,
        [import_id]
    );

    if (matchedOrders.rows.length === 0) {
        throw {
            status: 400,
            error: 'Nenhum pedido com SKUs relacionados encontrado. Execute o relacionamento primeiro.'
        };
    }

    const result = await pool.query(
        `SELECT * FROM obsidian.processar_pedidos_ml($1::uuid)`,
        [import_id]
    );

    // A função agora retorna: vendas_inseridas, pedidos_processados, pedidos_cancelados_ignorados, vendas_revertidas
    const stats = result.rows[0] || {
        vendas_inseridas: 0,
        pedidos_processados: 0,
        pedidos_cancelados_ignorados: 0,
        vendas_revertidas: 0
    };

    const salesCount = await pool.query(
        `SELECT COUNT(*) as count 
         FROM obsidian.vendas 
         WHERE canal = 'ML'`,
        []
    );

    try {
        await logActivity({
            user_email: user_email || 'sistema',
            user_name: user_name || 'Sistema',
            action: 'emit_sales_ml',
            entity_type: 'import_batch',
            entity_id: import_id.toString(),
            details: {
                import_id,
                total_vendas: parseInt(salesCount.rows[0].count)
            },
            ip_address: ip,
            user_agent: userAgent
        });
    } catch (logError) {
        logger.error('⚠️ Erro ao salvar log:', logError);
    }

    return {
        success: true,
        message: `✅ Vendas ML emitidas com sucesso!`,
        stats: {
            vendas_inseridas: stats.vendas_inseridas,
            pedidos_processados: stats.pedidos_processados,
            pedidos_cancelados: stats.pedidos_cancelados_ignorados,
            vendas_revertidas: stats.vendas_revertidas,
            total_vendas_ml: parseInt(salesCount.rows[0].count)
        }
    };
}

// ========================================
// RELACIONAMENTO MANUAL
// ========================================

interface RelacionarManualParams {
    raw_id: number;
    stock_sku: string;
    client_id: string;
    learn?: boolean;
}

export async function relacionarManual(params: RelacionarManualParams) {
    const { raw_id, stock_sku, client_id, learn = true } = params;

    const clientIdNum = await normalizeClientId(client_id);
    if (!clientIdNum) {
        throw { status: 400, error: `Cliente "${client_id}" não encontrado` };
    }

    const rawResult = await pool.query(
        `SELECT codigo_ml, sku_texto FROM logistica.full_envio_raw WHERE id = $1`,
        [raw_id]
    );

    if (rawResult.rows.length === 0) {
        throw { status: 404, error: 'Linha não encontrada' };
    }

    const rawData = rawResult.rows[0];

    await pool.query(
        `UPDATE logistica.full_envio_raw 
         SET matched_sku = $1, 
             status = 'matched', 
             processed_at = NOW() 
         WHERE id = $2`,
        [stock_sku, raw_id]
    );

    if (learn) {
        await aprenderAlias(clientIdNum, rawData.sku_texto, stock_sku);
    }

    const envioIdResult = await pool.query(
        `SELECT envio_id FROM logistica.full_envio_raw WHERE id = $1`,
        [raw_id]
    );

    if (envioIdResult.rows.length > 0) {
        const envio_id = envioIdResult.rows[0].envio_id;

        try {
            await pool.query(
                `SELECT logistica.full_envio_normalizar($1::bigint)`,
                [envio_id]
            );
            logger.info(`📦 Normalização executada para envio ${envio_id}`);
        } catch (normError: any) {
            logger.error('⚠️ Erro ao normalizar:', normError.message);
        }
    }

    return {
        success: true,
        message: learn ? 'Relacionado e aprendido com sucesso' : 'Relacionado com sucesso'
    };
}

// ========================================
// MATCH LINE (compatibilidade frontend)
// ========================================

interface MatchLineParams {
    raw_id: number;
    matched_sku: string;
    create_alias?: boolean;
    alias_text?: string;
    source?: string;
}

export async function matchLine(params: MatchLineParams) {
    const { raw_id, matched_sku, create_alias = true, alias_text, source } = params;

    if (!raw_id) {
        throw { status: 400, error: 'Campo raw_id é obrigatório' };
    }

    if (!matched_sku) {
        throw { status: 400, error: 'Campo matched_sku é obrigatório' };
    }

    const rawResult = await pool.query(
        `SELECT r.*, e.client_id, e.id as envio_id
         FROM logistica.full_envio_raw r
         JOIN logistica.full_envio e ON r.envio_id = e.id
         WHERE r.id = $1`,
        [raw_id]
    );

    if (rawResult.rows.length === 0) {
        throw { status: 404, error: 'Linha não encontrada' };
    }

    const rawData = rawResult.rows[0];

    await pool.query(
        `UPDATE logistica.full_envio_raw 
         SET matched_sku = $1, 
             status = 'matched', 
             processed_at = NOW(),
             error_msg = NULL
         WHERE id = $2`,
        [matched_sku, raw_id]
    );

    if (create_alias) {
        const textToLearn = alias_text || rawData.sku_texto;
        await aprenderAlias(rawData.client_id, textToLearn, matched_sku);
    }

    try {
        await pool.query(
            `SELECT logistica.full_envio_normalizar($1::bigint)`,
            [rawData.envio_id]
        );
    } catch (normError: any) {
        logger.error('⚠️ Erro ao normalizar:', normError.message);
    }

    return {
        success: true,
        message: create_alias ? 'SKU relacionado e alias aprendido' : 'SKU relacionado'
    };
}

// ========================================
// AUTO-RELATE (função do banco)
// ========================================

interface AutoRelateParams {
    envio_id?: number;
    import_id?: number;
    source: string;
    user_email?: string;
    user_name?: string;
    ip?: string;
    userAgent?: string;
}

export async function autoRelate(params: AutoRelateParams) {
    const { envio_id, import_id, source, user_email, user_name, ip, userAgent } = params;

    if (source === 'FULL') {
        if (!envio_id) {
            throw { status: 400, error: 'envio_id é obrigatório para FULL' };
        }

        const result = await pool.query(
            `SELECT logistica.full_envio_auto_relacionar($1::bigint)`,
            [envio_id]
        );

        const stats = result.rows[0].full_envio_auto_relacionar;

        try {
            await logActivity({
                user_email: user_email || 'sistema',
                user_name: user_name || 'Sistema',
                action: 'auto_relate_full',
                entity_type: 'envio',
                entity_id: envio_id.toString(),
                details: stats,
                ip_address: ip,
                user_agent: userAgent
            });
        } catch (logError) {
            logger.error('⚠️ Erro ao salvar log:', logError);
        }

        return {
            success: true,
            message: 'Auto-relacionamento FULL concluído',
            ...stats
        };
    } else {
        if (!import_id) {
            throw { status: 400, error: 'import_id é obrigatório para ML' };
        }

        const pendingItems = await pool.query(
            `SELECT id, sku_text, client_id
             FROM raw_export_orders
             WHERE import_id = $1 AND status = 'pending'`,
            [import_id]
        );

        let matched = 0;

        for (const item of pendingItems.rows) {
            let matchedSku = null;

            const produtoResult = await pool.query(
                `SELECT sku 
                 FROM obsidian.produtos 
                 WHERE UPPER(sku) = UPPER(TRIM($1))
                 LIMIT 1`,
                [item.sku_text]
            );

            if (produtoResult.rows.length > 0) {
                matchedSku = produtoResult.rows[0].sku;
            } else {
                const aliasResult = await pool.query(
                    `SELECT stock_sku, id 
                     FROM obsidian.sku_aliases 
                     WHERE client_id = $1 
                       AND UPPER(REGEXP_REPLACE(alias_text, '[^A-Z0-9]', '', 'g')) = 
                           UPPER(REGEXP_REPLACE($2, '[^A-Z0-9]', '', 'g'))
                     ORDER BY confidence_default DESC, times_used DESC 
                     LIMIT 1`,
                    [item.client_id, item.sku_text]
                );

                if (aliasResult.rows.length > 0) {
                    matchedSku = aliasResult.rows[0].stock_sku;

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
            }
        }

        try {
            await logActivity({
                user_email: user_email || 'sistema',
                user_name: user_name || 'Sistema',
                action: 'auto_relate_ml',
                entity_type: 'import_batch',
                entity_id: import_id.toString(),
                details: {
                    total: pendingItems.rows.length,
                    matched,
                    pendentes: pendingItems.rows.length - matched
                },
                ip_address: ip,
                user_agent: userAgent
            });
        } catch (logError) {
            logger.error('⚠️ Erro ao salvar log:', logError);
        }

        return {
            success: true,
            message: 'Auto-relacionamento ML concluído',
            total: pendingItems.rows.length,
            matched,
            pendentes: pendingItems.rows.length - matched
        };
    }
}

import {
  ImportResponse,
  ImportListResponse,
  AutoMatchRequest,
  AutoMatchResponse,
  ManualMatchRequest,
  LearnAliasRequest,
  ImportFilters,
  ImportRow,
  ImportSummary
} from '@/types/import.types';

const IMPORT_WEBHOOK_URL = '/api/envios';
const READ_WEBHOOK_URL = '/api/envios';
const AUTO_RELATE_URL = '/api/envios/relacionar';
const RELATE_ITEM_URL = '/api/envios/relacionar';
const KITS_FIND_URL = '/api/estoque/kits/find-by-composition';
const KITS_CREATE_URL = '/api/estoque/kits/create-and-relate';
const EMITIR_VENDAS_URL = '/api/envios/emitir-vendas';
const API_BASE_URL = '/api/upseller';

function qs(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== '') sp.append(k, String(v));
  }
  return sp.toString();
}

const toNum = (v: unknown, d = 0) =>
  typeof v === 'number' ? v : (isNaN(Number(v)) ? d : Number(v));

export const importService = {
  // Upload planilha (ML ou FULL)
  async uploadFile(clientId: string, file: File, source: 'ML' | 'FULL' = 'ML', importDate?: Date, userEmail?: string, userName?: string): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('client_id', clientId);
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('source', source);
    if (importDate) {
      formData.append('import_date', importDate.toISOString());
    }
    if (userEmail) {
      formData.append('user_email', userEmail);
    }
    if (userName) {
      formData.append('user_name', userName);
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(IMPORT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Buscar linhas (grid) - suporta ML e FULL
  async getImportRows(opts: {
    clientId?: string;
    importId?: string;
    status?: 'Todos' | 'relacionados' | 'pendentes';
    q?: string;
    page?: number;
    pageSize?: number;
    source?: 'ML' | 'FULL';
  }): Promise<ImportRow[]> {
    const source = opts.source || 'ML';

    // Se for ML, usar novo endpoint
    if (source === 'ML') {
      const url = `/api/envios/ml-rows?${qs({
        client_id: opts.clientId,
        import_id: opts.importId,
        status: opts.status,
        q: opts.q,
        page: opts.page ?? 1,
        page_size: opts.pageSize ?? 50,
      })}`;

      try {
        const response = await fetch(url, { headers: { 'accept': 'application/json' } });

        if (!response.ok) {
          throw new Error(`getImportRows ML ${response.status}`);
        }

        const data = await response.json();
        const rows: any[] = Array.isArray(data) ? data : [];

        return rows.map((r) => ({
          id_raw: toNum(r.id_raw),
          id_pedido: r.id_pedido ?? null,
          data: r.data ?? null,
          sku_original: r.sku_original ?? null,
          sku_relacionado: r.sku_relacionado ?? null,
          qtd: r.qtd != null ? toNum(r.qtd) : null,
          valor_unit: r.valor_unit != null ? toNum(r.valor_unit) : null,
          cliente: r.cliente ?? null,
          canal: r.canal ?? null,
          status: r.status ?? null,
        }));
      } catch (error) {
        console.error('Error fetching ML rows:', error);
        throw error;
      }
    }

    // Se for FULL ou outro, usar endpoint antigo
    const url = `${READ_WEBHOOK_URL}?${qs({
      client_id: opts.clientId,
      import_id: opts.importId,
      status: opts.status,
      q: opts.q,
      page: opts.page ?? 1,
      page_size: opts.pageSize ?? 50,
      source: opts.source || 'ML',
    })}`;

    try {
      const response = await fetch(url, { headers: { 'accept': 'application/json' } });

      if (!response.ok) {
        throw new Error(`getImportRows ${response.status}`);
      }

      const data = await response.json();
      const rows: any[] = Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []);

      return rows.map((r) => ({
        id_raw: toNum(r.id_raw),
        id_pedido: r.id_pedido ?? null,
        data: r.data ?? null,
        sku_original: r.sku_original ?? null,
        sku_relacionado: r.sku_relacionado ?? null,
        qtd: r.qtd != null ? toNum(r.qtd) : null,
        valor_unit: r.valor_unit != null ? toNum(r.valor_unit) : null,
        cliente: r.cliente ?? null,
        canal: r.canal ?? null,
        status: r.status ?? null,
      }));
    } catch (error) {
      console.error('Error fetching imported data:', error);
      throw error;
    }
  },

  // Buscar resumo (cards) - usa endpoint específico para ML ou FULL
  async getImportSummary(opts: {
    clientId?: string;
    importId?: string;
    source?: 'ML' | 'FULL';
  }): Promise<ImportSummary> {
    const source = opts.source || 'ML';

    // Se for ML, usar novo endpoint
    if (source === 'ML') {
      const url = `/api/envios/ml-summary?${qs({
        client_id: opts.clientId,
        import_id: opts.importId,
      })}`;

      try {
        const response = await fetch(url, { headers: { 'accept': 'application/json' } });

        if (!response.ok) {
          throw new Error(`getImportSummary ML ${response.status}`);
        }

        const data = await response.json();

        return {
          total: toNum(data.total),
          relacionados: toNum(data.relacionados),
          pendentes: toNum(data.pendentes),
          taxa_match: toNum(data.taxa_match),
        };
      } catch (error) {
        console.error('Error fetching ML summary:', error);
        return {
          total: 0,
          relacionados: 0,
          pendentes: 0,
          taxa_match: 0
        };
      }
    }

    // Se for FULL ou outro, usar endpoint antigo
    const url = `${READ_WEBHOOK_URL}?${qs({
      sheetName: 'ImportResumo',
      client_id: opts.clientId,
      import_id: opts.importId,
    })}`;

    try {
      const response = await fetch(url, { headers: { 'accept': 'application/json' } });

      if (!response.ok) {
        throw new Error(`getImportSummary ${response.status}`);
      }

      let data = await response.json();

      // Backend às vezes retorna array com 1 item
      if (Array.isArray(data)) data = data[0] ?? {};

      return {
        total: toNum(data.total),
        relacionados: toNum(data.relacionados),
        pendentes: toNum(data.pendentes),
        taxa_match: toNum(data.taxa_match),
      };
    } catch (error) {
      console.error('Error fetching import summary:', error);
      return {
        total: 0,
        relacionados: 0,
        pendentes: 0,
        taxa_match: 0
      };
    }
  },

  // Manter compatibilidade com código legado
  async getImportedData(filters: ImportFilters): Promise<any[]> {
    return this.getImportRows({
      clientId: filters.client_id,
      importId: filters.import_id,
      status: filters.status as any,
      q: filters.q,
      page: filters.page,
      pageSize: filters.page_size,
    });
  },

  // Auto-relacionar todos os pendentes (varredura geral)
  async autoRelateAll(clientId?: string, source: 'ML' | 'FULL' = 'ML'): Promise<ImportSummary> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(AUTO_RELATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ client_id: clientId, source }),
      });

      if (!response.ok) {
        throw new Error(`Auto-relate failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        total: toNum(data.total),
        relacionados: toNum(data.relacionados),
        pendentes: toNum(data.pendentes),
        taxa_match: toNum(data.taxa_match),
      };
    } catch (error) {
      console.error('Error in auto-relate:', error);
      throw error;
    }
  },

  // Auto-relacionar itens (legacy - mantido para compatibilidade)
  async autoMatch(request: AutoMatchRequest): Promise<AutoMatchResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auto-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Auto-match failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in auto-match:', error);
      // Mock response for development
      return {
        total: 0,
        auto_matched: 0,
        pending: 0
      };
    }
  },

  // Relacionar item (novo endpoint do n8n)
  async relateItem(payload: {
    raw_id: number;
    sku: string;
    source: 'manual' | 'alias' | 'direct';
    learn_alias?: boolean;
    alias_text?: string;
    force?: boolean;
  }): Promise<{ ok: boolean; raw_id?: number; matched_sku?: string; alias_learned?: boolean; error?: string }> {

    // 1. VALIDAÇÃO DE PAYLOAD
    if (!payload.raw_id || payload.raw_id <= 0) {
      console.error('❌ [relateItem] raw_id inválido:', payload.raw_id);
      return { ok: false, error: 'raw_id_invalid' };
    }

    if (!payload.sku || payload.sku.trim() === '') {
      console.error('❌ [relateItem] SKU vazio ou inválido:', payload.sku);
      return { ok: false, error: 'sku_empty' };
    }

    if (!['manual', 'alias', 'direct'].includes(payload.source)) {
      console.error('❌ [relateItem] source inválido:', payload.source);
      return { ok: false, error: 'source_invalid' };
    }

    // 2. PREPARAR PAYLOAD LIMPO
    const cleanPayload = {
      raw_id: payload.raw_id,
      sku: payload.sku.trim().toUpperCase(),
      source: payload.source,
      learn_alias: payload.learn_alias ?? true,
      alias_text: payload.alias_text?.trim() || undefined,
      force: payload.force || false,
    };

    // 3. FUNÇÃO DE TENTATIVA COM TIMEOUT
    const attemptFetch = async (attempt: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(RELATE_ITEM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(cleanPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'unknown' }));

          // Erros HTTP específicos
          if (response.status === 404) return { ok: false, error: 'raw_not_found' };
          if (response.status === 409) return { ok: false, error: 'already_related' };
          if (response.status === 422) return { ok: false, error: 'invalid_payload' };

          return {
            ok: false,
            error: errorData.error || `http_${response.status}`
          };
        }

        const result = await response.json();
        return { ok: true, ...result };

      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          return { ok: false, error: 'timeout' };
        }

        return { ok: false, error: 'network_error' };
      }
    };

    // 4. RETRY LOGIC (máximo 2 tentativas)
    let result = await attemptFetch(1);

    if (!result.ok && result.error === 'network_error') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
      result = await attemptFetch(2);
    }

    return result;
  },

  // Relacionamento manual (legacy - mantido para compatibilidade)
  async manualMatch(request: ManualMatchRequest): Promise<{ ok: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/manual-match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Manual match failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in manual match:', error);
      return { ok: false };
    }
  },

  // Aprender alias (legacy - mantido para compatibilidade)
  async learnAlias(request: LearnAliasRequest): Promise<{ ok: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}/learn-alias`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Learn alias failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error learning alias:', error);
      return { ok: false };
    }
  },

  // Buscar kit pela composição
  async findKitByComposition(components: Array<{ sku: string; q: number }>): Promise<{ sku_kit: string | null }> {
    try {
      const response = await fetch(KITS_FIND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ components }),
      });

      if (!response.ok) {
        throw new Error(`Find kit failed: ${response.status}`);
      }

      const rawText = await response.text();

      // Parse do JSON
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error('Resposta inválida do servidor');
      }

      // Se resposta for array, pegar primeiro elemento
      if (Array.isArray(data)) {
        data = data[0] || {};
      }

      // Normalizar campos (tentar diferentes variações de case)
      let skuKit = data.sku_kit || data.sku || data.SKU_KIT || data.SKU || data.skuKit || data.sku_Kit || null;

      // Tratar string vazia como null
      if (skuKit === '' || skuKit === undefined) {
        skuKit = null;
      }

      return { sku_kit: skuKit };
    } catch (error) {
      console.error('❌ [findKitByComposition] Erro:', error);
      throw error;
    }
  },

  // Criar kit e relacionar
  async createKitAndRelate(payload: {
    raw_id: number;
    kit: {
      nome?: string;
      categoria?: string;
      preco_unitario?: number;
    };
    components: Array<{ sku: string; q: number }>;
  }): Promise<{ raw_id: number; sku_kit: string; matched: boolean }> {
    try {
      const response = await fetch(KITS_CREATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Create kit failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating kit:', error);
      throw error;
    }
  },

  // Emitir vendas
  async emitirVendas(params: { import_id?: string; client_id?: string; source?: 'ML' | 'FULL' }): Promise<{
    candidatos: number;
    inseridos: number;
    full_skipped: number;
    ja_existiam: number;
  }> {
    if (!params.import_id && !params.client_id) {
      throw new Error('Informe import ou cliente');
    }

    // Validação UUID v4 simples para import_id
    if (params.import_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(params.import_id)) {
        throw new Error('ID de importação inválido');
      }
    }

    // Validação client_id
    if (params.client_id) {
      const clientIdNum = parseInt(params.client_id);
      if (isNaN(clientIdNum) || clientIdNum <= 0) {
        // Se não for número, assume que é nome do cliente (string)
        if (typeof params.client_id !== 'string' || params.client_id.trim() === '') {
          throw new Error('Cliente inválido');
        }
      }
    }

    console.log('📤 importService.emitirVendas - Enviando:', params);

    const token = localStorage.getItem('token');
    const response = await fetch(EMITIR_VENDAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...params, source: params.source || 'ML' }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Erro ao emitir vendas');
    }

    const data = await response.json();
    return data[0]; // API retorna array com 1 item
  },

  // ===== FUNÇÕES FULL (Mercado Envios Full) =====

  async getFullKPIs(): Promise<{
    total: number;
    pendentes: number;
    relacionados: number;
    emitidos: number;
  }> {
    const response = await fetch('/api/envios?source=FULL');

    if (!response.ok) {
      throw new Error('Erro ao buscar KPIs');
    }

    const batches = await response.json();
    // Calcular KPIs a partir dos batches
    return {
      total: batches.length,
      pendentes: batches.filter((b: any) => b.status === 'pendente').length,
      relacionados: batches.filter((b: any) => b.status === 'relacionado').length,
      emitidos: batches.filter((b: any) => b.status === 'emitido').length,
    };
  },

  async getFullPendencias(): Promise<any[]> {
    const response = await fetch('/api/envios?source=FULL&status=pendente');

    if (!response.ok) {
      throw new Error('Erro ao buscar pendências');
    }

    return response.json();
  },

  async getFullRelacionados(): Promise<any[]> {
    const response = await fetch('/api/envios?source=FULL&status=relacionado');

    if (!response.ok) {
      throw new Error('Erro ao buscar relacionados');
    }

    return response.json();
  },

  async getFullTodos(envioNum?: string): Promise<any[]> {
    const params = new URLSearchParams({ source: 'FULL' });
    if (envioNum) {
      params.append('envio_num', envioNum);
    }

    const response = await fetch(`/api/envios?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Erro ao buscar todos');
    }

    return response.json();
  },

  async relacionarSku(rawId: number, sku: string, alias: string): Promise<void> {
    const response = await fetch('/api/envios/relacionar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_id: rawId,
        sku: sku.toUpperCase().trim(),
        alias: alias.trim(),
        source: 'FULL',
      }),
    });

    if (!response.ok) {
      throw new Error('Erro ao relacionar SKU');
    }
  },

  async emitirEnvio(envioId: number): Promise<void> {
    const response = await fetch('/api/envios/emitir-vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envio_id: envioId, source: 'FULL' }),
    });

    if (!response.ok) {
      throw new Error('Erro ao emitir envio');
    }
  },

  async searchProdutos(query: string): Promise<{ sku: string; nome: string }[]> {
    const response = await fetch(
      `/api/envios/search-produtos?q=${encodeURIComponent(query)}&source=FULL`
    );

    if (!response.ok) {
      throw new Error('Erro ao buscar produtos');
    }

    const data = await response.json();
    return data.results || [];
  },

  // ===== FUNÇÕES PARA IMPORT FULL (com envio_num) =====

  async uploadFileFull(cliente: string, envioNum: string, file: File, importDate?: string, userEmail?: string, userName?: string): Promise<{
    import_id?: string;
    envio_id: number;
    envio_num: string;
    linhas?: number;
    total_linhas?: number;
    linhas_processadas?: number;
    status: string;
    auto_relacionadas?: number;
    pendentes?: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_id', cliente);
    formData.append('envio_num', envioNum);
    formData.append('source', 'FULL');
    if (importDate) {
      formData.append('import_date', importDate);
    }
    if (userEmail) {
      formData.append('user_email', userEmail);
    }
    if (userName) {
      formData.append('user_name', userName);
    }

    const token = localStorage.getItem('token');
    const response = await fetch('/api/envios', {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro no upload' }));
      throw new Error(error.message || 'Erro ao fazer upload do arquivo');
    }

    return response.json();
  },

  async listEnviosByCliente(clienteNome: string, dias = 30): Promise<any> {
    const response = await fetch(`/api/envios?source=FULL&client_id=${encodeURIComponent(clienteNome)}&dias=${dias}`);

    if (!response.ok) {
      throw new Error('Erro ao listar envios');
    }

    return response.json();
  },

  async getEnvioDetails(clienteNome: string, envioNum: string): Promise<any> {
    const response = await fetch(`/api/envios?source=FULL&client_id=${encodeURIComponent(clienteNome)}&envio_num=${encodeURIComponent(envioNum)}`);

    if (!response.ok) {
      throw new Error('Erro ao carregar detalhes do envio');
    }

    return response.json();
  },

  // Busca TODOS os itens (raw) de um cliente específico
  async getAllItemsByCliente(clienteNome: string): Promise<any[]> {
    const url = `/api/envios?source=FULL&client_id=${encodeURIComponent(clienteNome)}&list_all_items=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Erro ao carregar itens do cliente');
    }

    const data = await response.json();

    return data;
  },

  async searchSku(q: string, clientId: number): Promise<any[]> {
    // Permite wildcard "*" para carregar a lista inicial de SKUs
    if (q !== '*' && (!q || q.trim().length < 2)) return [];

    const response = await fetch(`/api/envios/search-sku?q=${encodeURIComponent(q)}&client_id=${clientId}&source=FULL`);

    if (!response.ok) {
      throw new Error('Erro na busca de SKU');
    }

    const data = await response.json();
    return data.results || [];
  },

  async matchFullLine(params: {
    rawId: number;
    matchedSku: string;
    createAlias?: boolean;
    aliasText?: string;
  }): Promise<{ envio_id: number; alias_ops: number; emitidos: number }> {
    const payload = {
      raw_id: params.rawId,
      matched_sku: params.matchedSku.toUpperCase().trim(),
      create_alias: !!params.createAlias,
      alias_text: params.aliasText?.trim() || undefined,
      source: 'FULL',
    };

    const token = localStorage.getItem('token');
    const response = await fetch('/api/envios/match-line', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Erro ao confirmar linha');
    }

    return data;
  },
};
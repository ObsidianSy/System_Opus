// Serviços de integração com n8n
import { getApiUrl as getBaseApiUrl } from '@/config/api';

// Interfaces para as diferentes entidades
export interface VendaItem {
  "SKU Produto": string;
  "Nome Produto": string;
  "Quantidade Vendida": number;
  "Preço Unitário": number;
}

export interface VendaData {
  "ID Venda": string;
  "Data Venda": string;
  "Nome Cliente": string;
  "items": VendaItem[];
}

export interface ClienteData {
  "ID Cliente": string;
  "Nome": string;
  "Documento": string;
  "Telefone": string;
  "Observações": string;
  "Total Comprado"?: number;
  "Total Pago"?: number;
  "Total atual"?: number;
}

export interface PagamentoData {
  "ID Pagamento": string;
  "Data Pagamento": string;
  "Nome Cliente": string;
  "Valor Pago": number;
  "Forma de Pagamento": string;
  "Observações": string;
}

export interface ComponenteKit {
  "SKU Componente": string;
  "Quantidade por Kit": number;
  "Preço Unitário": number;
}

export interface ProdutoData {
  "SKU": string;
  "Nome Produto": string;
  "Categoria": string;
  "Tipo Produto": string;
  "Quantidade Atual": number;
  "Unidade de Medida": string;
  "Preço Unitário": number;
  "Componentes"?: ComponenteKit[];
}

export interface MateriaPrimaData {
  "ID MateriaPrima": string;
  "SKU MatériaPrima": string;
  "Nome MatériaPrima": string;
  "Categoria": string;
  "Quantidade Atual": number;
  "Unidade de Medida": string;
  "Preço Unitário": number;
}

export interface ReceitaProdutoData {
  "SKU Produto": string;
  items: {
    "SKU Matéria-Prima": string;
    "Quantidade por Produto": number;
    "Unidade de Medida": string;
  }[];
}

export interface ReceitaFinanceiraData {
  "ID Receita Financeira": string;
  "Data Receita": string;
  "SKU Produto": string;
  "Nome Produto": string;
  "Quantidade": number;
  "Valor Receita": number;
}

export interface N8nRequest {
  sheetName: string;
  action: 'create' | 'upsert' | 'delete';
  data?: VendaData | ClienteData | ProdutoData | MateriaPrimaData | ReceitaProdutoData | ReceitaFinanceiraData | PagamentoData;
  sku?: string; // Para operações de delete
}

// URL base da API (usa configuração centralizada)
const getApiUrl = (): string => {
  return getBaseApiUrl('/api');
};

// Mapeamento de sheetName para endpoints da API
const SHEET_TO_ENDPOINT: Record<string, string> = {
  'Vendas': 'vendas',
  'Clientes': 'clientes',
  'Pagamentos': 'pagamentos',
  'Estoque': 'estoque',
  'Estoque_MateriaPrima': 'materia-prima',
  'Receita_Produto': 'receita-produto'
};

// Função genérica para enviar dados para a API
export const enviarDados = async (request: N8nRequest): Promise<boolean> => {
  try {
    const baseUrl = getApiUrl();
    const endpoint = SHEET_TO_ENDPOINT[request.sheetName];

    if (!endpoint) {
      console.error(`Endpoint não encontrado para ${request.sheetName}`);
      return false;
    }

    let url = `${baseUrl}/${endpoint}`;
    let method = 'POST';

    // Define método HTTP baseado na action
    if (request.action === 'upsert' && request.data) {
      // Para upsert, usamos PUT com o ID/SKU na URL
      const id = getIdFromData(request.data, request.sheetName);
      if (id) {
        url = `${baseUrl}/${endpoint}/${id}`;
        method = 'PUT';
      }
    } else if (request.action === 'delete' && request.sku) {
      url = `${baseUrl}/${endpoint}/${request.sku}`;
      method = 'DELETE';
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'DELETE' ? JSON.stringify(mapDataToApi(request.data, request.sheetName)) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na resposta do servidor:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao enviar dados:', error);
    return false;
  }
};

// Helper para extrair ID/SKU dos dados
const getIdFromData = (data: any, sheetName: string): string | null => {
  if (!data) return null;

  switch (sheetName) {
    case 'Clientes':
      return data['ID Cliente'];
    case 'Estoque':
      return data['SKU'];
    case 'Estoque_MateriaPrima':
      return data['SKU MatériaPrima'];
    case 'Receita_Produto':
      return data['SKU Produto'];
    case 'Vendas':
      return data['ID Venda'];
    case 'Pagamentos':
      return data['ID Pagamento'];
    default:
      return null;
  }
};

// Helper para mapear dados do formato n8n para formato da API
const mapDataToApi = (data: any, sheetName: string): any => {
  if (!data) return data;

  switch (sheetName) {
    case 'Clientes':
      return {
        nome: data['Nome'],
        documento: data['Documento'],
        telefone: data['Telefone'],
        observacoes: data['Observações']
      };

    case 'Estoque':
      return {
        sku: data['SKU'],
        nome_produto: data['Nome Produto'],
        categoria: data['Categoria'],
        tipo_produto: data['Tipo Produto'],
        quantidade_atual: data['Quantidade Atual'],
        unidade_medida: data['Unidade de Medida'],
        preco_unitario: data['Preço Unitário'],
        componentes: data['Componentes']?.map((c: any) => ({
          sku_componente: c['SKU Componente'],
          quantidade_por_kit: c['Quantidade por Kit'],
          preco_unitario: c['Preço Unitário']
        }))
      };

    case 'Estoque_MateriaPrima':
      return {
        id_materia_prima: data['ID MateriaPrima'],
        sku_materia_prima: data['SKU MatériaPrima'],
        nome_materia_prima: data['Nome MatériaPrima'],
        categoria: data['Categoria'],
        quantidade_atual: data['Quantidade Atual'],
        unidade_medida: data['Unidade de Medida'],
        preco_unitario: data['Preço Unitário']
      };

    case 'Vendas':
      return {
        id_venda: data['ID Venda'],
        data_venda: data['Data Venda'],
        id_cliente: data['ID Cliente'],
        nome_cliente: data['Nome Cliente'],
        items: data['items']?.map((item: any) => ({
          sku_produto: item['SKU Produto'],
          nome_produto: item['Nome Produto'],
          quantidade_vendida: item['Quantidade Vendida'],
          preco_unitario: item['Preço Unitário']
        }))
      };

    case 'Pagamentos':
      return {
        id_pagamento: data['ID Pagamento'],
        data_pagamento: data['Data Pagamento'],
        id_cliente: data['ID Cliente'],
        nome_cliente: data['Nome Cliente'],
        valor_pago: data['Valor Pago'],
        forma_pagamento: data['Forma de Pagamento'],
        observacoes: data['Observações']
      };

    case 'Receita_Produto':
      return {
        sku_produto: data['SKU Produto'],
        items: data['items']?.map((item: any) => ({
          sku_materia_prima: item['SKU Matéria-Prima'],
          quantidade_por_produto: item['Quantidade por Produto'],
          unidade_medida: item['Unidade de Medida']
        }))
      };

    default:
      return data;
  }
};

// Função para consultar dados da API por sheetName
export const consultarDados = async (sheetName: string): Promise<any[]> => {
  try {
    const baseUrl = getApiUrl();
    const endpoint = SHEET_TO_ENDPOINT[sheetName];

    if (!endpoint) {
      console.error(`Endpoint não encontrado para ${sheetName}`);
      return [];
    }

    const url = `${baseUrl}/${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Mapeia dados da API para formato esperado pelo frontend
    const mappedData = mapApiDataToFrontend(data, sheetName);

    // Se retornar um objeto único, transformar em array
    if (mappedData && !Array.isArray(mappedData) && typeof mappedData === 'object') {
      return [mappedData];
    }

    // Se retornar array, usar como está
    return Array.isArray(mappedData) ? mappedData : [];
  } catch (error) {
    console.error(`Erro ao consultar ${sheetName}:`, error);
    throw error; // Re-throw para permitir tratamento upstream
  }
};

// Helper para mapear dados da API para formato do frontend (n8n)
const mapApiDataToFrontend = (data: any[], sheetName: string): any[] => {
  if (!data || !Array.isArray(data)) return data;

  switch (sheetName) {
    case 'Clientes':
      return data.map(item => ({
        'ID Cliente': item.id,
        'Nome': item.nome,
        'Documento': item.documento,
        'Telefone': item.telefone,
        'Observações': item.observacoes,
        'Total Comprado': item.total_comprado || 0,
        'Total Pago': item.total_pago || 0,
        'Total atual': item.total_atual || 0
      }));

    case 'Estoque':
      return data.map(item => ({
        'SKU': item.sku,
        'Nome Produto': item.nome || item.nome_produto,  // ✅ Aceita ambos formatos
        'Categoria': item.categoria,
        'Tipo Produto': item.tipo_produto,
        'Quantidade Atual': parseFloat(item.quantidade_atual) || 0,  // ✅ Converter para número
        'Unidade de Medida': item.unidade_medida,
        'Preço Unitário': parseFloat(item.preco_unitario) || 0,  // ✅ Converter para número
        // Mantém a URL da foto vinda do backend para ser usada na UI
        'foto_url': item.foto_url,
        'Componentes': item.componentes?.map((c: any) => ({
          'SKU Componente': c.sku_componente,
          'Quantidade por Kit': c.quantidade_por_kit,
          'Preço Unitário': c.preco_unitario
        }))
      }));

    case 'Estoque_MateriaPrima':
      return data.map(item => ({
        'ID MateriaPrima': item.id,  // ✅ CORRETO
        'SKU MatériaPrima': item.sku,  // ✅ CORRETO
        'Nome MatériaPrima': item.nome,  // ✅ CORRETO
        'Categoria': item.categoria,
        'Quantidade Atual': item.quantidade_atual,
        'Unidade de Medida': item.unidade_medida,
        'Preço Unitário': item.preco_unitario
      }));

    case 'Vendas':
      return data.map(item => ({
        'ID Venda': item.venda_id,
        'Data Venda': item.data_venda,
        'Nome Cliente': item.nome_cliente,
        'SKU Produto': item.sku_produto,
        'Nome Produto': item.nome_produto,
        'Quantidade Vendida': parseFloat(item.quantidade_vendida) || 0,
        'Preço Unitário': parseFloat(item.preco_unitario) || 0,
        'Valor Total': parseFloat(item.valor_total) || 0,
        'Canal': item.canal,
        'Pedido UID': item.pedido_uid,
        // Mantém a URL da foto vinda do backend para ser usada na UI
        'foto_url': item.foto_url
      }));

    case 'Pagamentos':
      return data.map(item => ({
        'ID Pagamento': item.id,  // ✅ CORRETO
        'Data Pagamento': item.data_pagamento,
        'ID Cliente': item.id_cliente,
        'Nome Cliente': item.nome_cliente,
        'Valor Pago': item.valor_pago,
        'Forma de Pagamento': item.forma_pagamento,
        'Observações': item.observacoes
      }));

    case 'Receita_Produto':
      return data.map(item => ({
        'SKU Produto': item.sku_produto,
        'items': item.items?.map((i: any) => ({
          'SKU Matéria-Prima': i.sku_materia_prima,
          'Quantidade por Produto': i.quantidade_por_produto,
          'Unidade de Medida': i.unidade_medida
        }))
      }));

    default:
      return data;
  }
};

// Funções específicas para cada entidade

// Vendas
export const criarVenda = async (venda: VendaData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Vendas",
    action: "create",
    data: venda
  });
};

// Clientes
export const salvarCliente = async (cliente: ClienteData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Clientes",
    action: "create",
    data: cliente
  });
};

// Pagamentos
export const criarPagamento = async (pagamento: PagamentoData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Pagamentos",
    action: "create",
    data: pagamento
  });
};

// Produtos
export const salvarProduto = async (produto: ProdutoData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Estoque",
    action: "upsert",
    data: produto
  });
};

export const excluirProduto = async (sku: string): Promise<boolean> => {
  return enviarDados({
    sheetName: "Estoque",
    action: "delete",
    sku: sku
  });
};

// Matéria-Prima
export const salvarMateriaPrima = async (materiaPrima: MateriaPrimaData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Estoque_MateriaPrima",
    action: "upsert",
    data: materiaPrima
  });
};

export const excluirMateriaPrima = async (sku: string): Promise<boolean> => {
  return enviarDados({
    sheetName: "Estoque_MateriaPrima",
    action: "delete",
    sku: sku
  });
};

// Receita de Produto (fabricação)
export const salvarReceitaProduto = async (receita: ReceitaProdutoData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Receita_Produto",
    action: "upsert",
    data: receita
  });
};

// Receita Financeira
export const criarReceitaFinanceira = async (receita: ReceitaFinanceiraData): Promise<boolean> => {
  return enviarDados({
    sheetName: "Receita_Produto",
    action: "create",
    data: receita
  });
};

// Funções de consulta específicas
export const consultarEstoque = async (): Promise<any[]> => {
  return consultarDados('Estoque');
};

export const consultarClientes = async (): Promise<any[]> => {
  return consultarDados('Clientes');
};

export const consultarVendas = async (): Promise<any[]> => {
  return consultarDados('Vendas');
};

export const consultarReceitasProduto = async (): Promise<any[]> => {
  return consultarDados('Receita_Produto');
};

export const consultarPagamentos = async (): Promise<any[]> => {
  return consultarDados('Pagamentos');
};

// Utilitários para geração de IDs
export const gerarIdVenda = (): string => {
  const data = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const timestamp = Date.now().toString().slice(-3);
  return `VEND-${data}-${timestamp}`;
};

export const gerarIdCliente = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  return `CLI-${timestamp}`;
};

export const gerarSkuProduto = (categoria: string): string => {
  const prefixo = categoria.substring(0, 4).toUpperCase();
  const timestamp = Date.now().toString().slice(-3);
  return `${prefixo}-${timestamp}`;
};

export const gerarIdPagamento = (): string => {
  const data = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const timestamp = Date.now().toString().slice(-3);
  return `PAG-${data}-${timestamp}`;
};

export const gerarIdMateriaPrima = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  return `MP-${timestamp}`;
};

export const gerarIdReceita = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  return `REC-${timestamp}`;
};

export const gerarIdReceitaFinanceira = (): string => {
  const data = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const timestamp = Date.now().toString().slice(-3);
  return `RECFIN-${data}-${timestamp}`;
};
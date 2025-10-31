export interface ImportRow {
  id_raw: number;
  id_pedido: string | null;
  data: string | null;
  sku_original: string | null;
  sku_relacionado: string | null;
  qtd: number | null;
  valor_unit: number | null;
  cliente: string | null;
  canal: string | null;
  status: string | null;
}

export interface ImportSummary {
  total: number;
  relacionados: number;
  pendentes: number;
  taxa_match: number;
}

export interface RawExportOrder {
  raw_id: number;
  client_id: string;
  import_id: string;
  order_id: string;
  order_date: string;
  sku_text: string;
  qty: number;
  unit_price: number;
  total?: number;
  customer?: string;
  channel?: string;
  matched_sku?: string | null;
  match_score?: number | null;
  created_at?: string;
}

export interface ImportResponse {
  import_id: string;
  client_id: string;
  status: 'accepted' | 'processing' | 'completed' | 'error';
  message?: string;
}

export interface ImportListResponse {
  import_id: string;
  client_id: string;
  total: number;
  page: number;
  page_size: number;
  rows: RawExportOrder[];
}

export interface AutoMatchRequest {
  client_id: string;
  import_id: string;
  threshold?: number;
}

export interface AutoMatchResponse {
  total: number;
  auto_matched: number;
  pending: number;
}

export interface ManualMatchRequest {
  client_id: string;
  raw_id: number;
  stock_sku: string;
  confirm: boolean;
}

export interface LearnAliasRequest {
  client_id: string;
  pattern: string;
  stock_sku: string;
  source: 'manual' | 'auto';
}

export interface ImportFilters {
  client_id: string;
  import_id?: string;
  page?: number;
  page_size?: number;
  q?: string;
  order_date_from?: string;
  order_date_to?: string;
  sku?: string;
  status?: 'matched' | 'pending';
  channel?: string;
}
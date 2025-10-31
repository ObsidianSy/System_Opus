import { z } from 'zod';

// Schema para validação de cliente
export const clienteSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  documento: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      // Remove caracteres não numéricos
      const cleaned = val.replace(/\D/g, '');
      // Valida CPF (11 dígitos) ou CNPJ (14 dígitos)
      return cleaned.length === 11 || cleaned.length === 14;
    }, 'Documento deve ser um CPF ou CNPJ válido'),
  telefone: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const cleaned = val.replace(/\D/g, '');
      return cleaned.length >= 10 && cleaned.length <= 11;
    }, 'Telefone inválido'),
  email: z.string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  observacoes: z.string()
    .max(500, 'Observações deve ter no máximo 500 caracteres')
    .optional()
});

// Schema para validação de venda
export const vendaSchema = z.object({
  cliente: z.string().min(1, 'Cliente é obrigatório'),
  produtos: z.array(z.object({
    produto: z.string().min(1, 'Produto é obrigatório'),
    quantidade: z.number().positive('Quantidade deve ser positiva'),
    preco: z.number().positive('Preço deve ser positivo')
  })).min(1, 'Adicione pelo menos um produto'),
  data: z.date(),
  observacoes: z.string().max(500).optional()
});

// Schema para validação de produto
export const produtoSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  categoria: z.string().min(1, 'Categoria é obrigatória'),
  preco: z.number().positive('Preço deve ser positivo'),
  estoque: z.number().int().min(0, 'Estoque não pode ser negativo'),
  estoqueMinimo: z.number().int().min(0, 'Estoque mínimo não pode ser negativo'),
  descricao: z.string().max(500).optional()
});

// Schema para validação de pagamento
export const pagamentoSchema = z.object({
  cliente: z.string().min(1, 'Cliente é obrigatório'),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.date(),
  formaPagamento: z.enum(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia']),
  observacoes: z.string().max(500).optional()
});

// Função para validar CPF
export function validarCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let checkDigit = 11 - (sum % 11);
  if (checkDigit >= 10) checkDigit = 0;
  if (checkDigit !== parseInt(cleaned.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  checkDigit = 11 - (sum % 11);
  if (checkDigit >= 10) checkDigit = 0;
  if (checkDigit !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

// Função para validar CNPJ
export function validarCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  const firstMultipliers = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * firstMultipliers[i];
  }
  let checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (checkDigit !== parseInt(cleaned.charAt(12))) return false;

  // Validação do segundo dígito verificador
  const secondMultipliers = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * secondMultipliers[i];
  }
  checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (checkDigit !== parseInt(cleaned.charAt(13))) return false;

  return true;
}

// Função para formatar CPF/CNPJ
export function formatarDocumento(documento: string): string {
  const cleaned = documento.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // CPF: 000.000.000-00
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (cleaned.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return documento;
}

// Função para formatar telefone
export function formatarTelefone(telefone: string): string {
  const cleaned = telefone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // Celular: (00) 00000-0000
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    // Fixo: (00) 0000-0000
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  
  return telefone;
}
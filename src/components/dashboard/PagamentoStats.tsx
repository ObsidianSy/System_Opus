import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyAbbreviated } from '@/utils/formatters';

interface Cliente {
  "ID Cliente": string;
  "Nome": string;
  "Documento": string;
  "Telefone": string;
  "Email": string;
  "Total Comprado"?: number;
  "Total Pago"?: number;
}

interface Pagamento {
  "Data Pagamento": string;
  "Nome Cliente": string;
  "Valor Pago": number;
  "Forma de Pagamento": string;
  "Observações": string;
}

interface Venda {
  "Data Venda": string;
  "Nome Cliente": string;
  "SKU Produto": string;
  "Nome Produto": string;
  "Quantidade Vendida": number;
  "Preço Unitário": number;
  "Valor Total": number;
}

interface PagamentoStatsProps {
  pagamentos: Pagamento[];
  vendas: Venda[];
  clientes: Cliente[];
}

export const PagamentoStats = ({ pagamentos, vendas, clientes }: PagamentoStatsProps) => {
  const stats = useMemo(() => {
    // Calcular total pago
    const totalPago = pagamentos.reduce((acc, pag) => {
      const valor = typeof pag["Valor Pago"] === 'string' 
        ? parseFloat(pag["Valor Pago"]) || 0 
        : pag["Valor Pago"] || 0;
      return acc + valor;
    }, 0);
    
    // Calcular total de vendas por cliente
    const vendasPorCliente = vendas.reduce((acc, venda) => {
      const cliente = venda["Nome Cliente"];
      if (!acc[cliente]) acc[cliente] = 0;
      const valor = typeof venda["Valor Total"] === 'string'
        ? parseFloat(venda["Valor Total"]) || 0
        : venda["Valor Total"] || 0;
      acc[cliente] += valor;
      return acc;
    }, {} as Record<string, number>);
    
    // Calcular total pago por cliente
    const pagosPorCliente = pagamentos.reduce((acc, pag) => {
      const cliente = pag["Nome Cliente"];
      if (!acc[cliente]) acc[cliente] = 0;
      const valor = typeof pag["Valor Pago"] === 'string'
        ? parseFloat(pag["Valor Pago"]) || 0
        : pag["Valor Pago"] || 0;
      acc[cliente] += valor;
      return acc;
    }, {} as Record<string, number>);
    
    // Calcular total de vendas
    const totalVendas = Object.values(vendasPorCliente).reduce((acc, valor) => acc + valor, 0);
    
    // Calcular total em aberto
    const totalEmAberto = totalVendas - totalPago;
    
    console.log('💰 Debug PagamentoStats:', {
      totalVendas,
      totalPago,
      totalEmAberto,
      amostraPagamento: pagamentos[0] ? {
        valorPago: pagamentos[0]["Valor Pago"],
        tipo: typeof pagamentos[0]["Valor Pago"]
      } : null,
      amostraVenda: vendas[0] ? {
        valorTotal: vendas[0]["Valor Total"],
        tipo: typeof vendas[0]["Valor Total"]
      } : null
    });
    
    // Identificar clientes devedores
    const clientesDevedores = Object.keys(vendasPorCliente)
      .map(cliente => ({
        nome: cliente,
        totalComprado: vendasPorCliente[cliente] || 0,
        totalPago: pagosPorCliente[cliente] || 0,
        saldo: (vendasPorCliente[cliente] || 0) - (pagosPorCliente[cliente] || 0)
      }))
      .filter(cliente => cliente.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo);
    
    // Pagamentos recentes (últimos 30 dias)
    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const pagamentosRecentes = pagamentos.filter(pag => {
      try {
        const dataPag = new Date(pag["Data Pagamento"]);
        return dataPag >= trintaDiasAtras;
      } catch {
        return false;
      }
    });
    
    const totalPagoRecente = pagamentosRecentes.reduce((acc, pag) => {
      const valor = typeof pag["Valor Pago"] === 'string'
        ? parseFloat(pag["Valor Pago"]) || 0
        : pag["Valor Pago"] || 0;
      return acc + valor;
    }, 0);
    
    return {
      totalPago,
      totalVendas,
      totalEmAberto,
      clientesDevedores,
      totalPagoRecente,
      numeroClientesDevedores: clientesDevedores.length,
      maiorDevedor: clientesDevedores[0] || null
    };
  }, [pagamentos, vendas, clientes]);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Recebido</p>
              <p className="text-2xl font-bold text-success">
                {formatCurrencyAbbreviated(stats.totalPago)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total em Aberto</p>
              <p className="text-2xl font-bold text-warning">
                {formatCurrencyAbbreviated(stats.totalEmAberto)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Recebido (30 dias)</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrencyAbbreviated(stats.totalPagoRecente)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Users className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Clientes Devedores</p>
              <p className="text-2xl font-bold text-destructive">
                {stats.numeroClientesDevedores}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, Mail } from 'lucide-react';
import { formatCurrencyAbbreviated } from '@/utils/formatters';
interface Cliente {
  "ID Cliente": string;
  "Nome": string;
  "Documento": string;
  "Telefone": string;
  "Email": string;
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
interface ClientesDevedoresProps {
  pagamentos: Pagamento[];
  vendas: Venda[];
  clientes: Cliente[];
}
export const ClientesDevedores = ({
  pagamentos,
  vendas,
  clientes
}: ClientesDevedoresProps) => {
  const clientesDevedores = useMemo(() => {
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

    // Identificar clientes devedores com informações completas
    const devedores = Object.keys(vendasPorCliente).map(nomeCliente => {
      const clienteInfo = clientes.find(c => c["Nome"] === nomeCliente);
      const totalComprado = vendasPorCliente[nomeCliente] || 0;
      const totalPago = pagosPorCliente[nomeCliente] || 0;
      const saldo = totalComprado - totalPago;
      return {
        nome: nomeCliente,
        info: clienteInfo,
        totalComprado,
        totalPago,
        saldo,
        percentualPago: totalComprado > 0 ? totalPago / totalComprado * 100 : 0
      };
    }).filter(cliente => cliente.saldo > 0).sort((a, b) => b.saldo - a.saldo).slice(0, 10); // Top 10 devedores

    return devedores;
  }, [pagamentos, vendas, clientes]);
  const getSeverityColor = (percentualPago: number) => {
    if (percentualPago === 0) return 'destructive';
    if (percentualPago < 50) return 'secondary';
    return 'secondary';
  };
  const getSeverityText = (percentualPago: number) => {
    if (percentualPago === 0) return 'Não pagou';
    if (percentualPago < 30) return 'Crítico';
    if (percentualPago < 70) return 'Atenção';
    return 'Parcial';
  };
  if (clientesDevedores.length === 0) {
    return <Card className="glass-card">
        
        
      </Card>;
  }
  return <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Clientes Devedores ({clientesDevedores.length})
          </div>
          <Badge variant="secondary" className="text-xs">
            Top 10
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {clientesDevedores.map((cliente, index) => <div key={cliente.nome} className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                  <p className="font-medium text-foreground truncate">
                    {cliente.nome}
                  </p>
                  <Badge variant={getSeverityColor(cliente.percentualPago)} className="text-xs">
                    {getSeverityText(cliente.percentualPago)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-mono text-foreground">
                      {formatCurrencyAbbreviated(cliente.totalComprado)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pago: </span>
                    <span className="font-mono text-success">
                      {formatCurrencyAbbreviated(cliente.totalPago)}
                    </span>
                  </div>
                </div>
                
                <div className="mt-2">
                  <span className="text-muted-foreground text-sm">Pendente: </span>
                  <span className="font-mono text-warning font-bold">
                    {formatCurrencyAbbreviated(cliente.saldo)}
                  </span>
                </div>
                
                {cliente.info && <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {cliente.info["Telefone"] && <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {cliente.info["Telefone"]}
                      </div>}
                    {cliente.info["Email"] && <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {cliente.info["Email"]}
                      </div>}
                  </div>}
              </div>
              
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">
                  {cliente.percentualPago.toFixed(0)}% pago
                </div>
                <div className="w-20 bg-secondary rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{
                width: `${Math.min(cliente.percentualPago, 100)}%`
              }} />
                </div>
              </div>
            </div>)}
        </div>
      </CardContent>
    </Card>;
};
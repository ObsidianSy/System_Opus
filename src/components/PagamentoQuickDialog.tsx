import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { criarPagamento, gerarIdPagamento } from "@/services/n8nIntegration";
import { toNumber } from "@/utils/formatters";
import { z } from "zod";

const pagamentoSchema = z.object({
  valor: z.number().min(0.01, "Valor deve ser maior que zero"),
  data: z.string().nonempty("Data é obrigatória"),
  formaPagamento: z.enum([
    "Dinheiro",
    "PIX",
    "Cartão Crédito",
    "Cartão Débito",
    "Transferência",
    "Boleto",
  ]),
  observacoes: z
    .string()
    .max(500, "Observações deve ter no máximo 500 caracteres")
    .optional(),
});

interface PagamentoQuickDialogProps {
  clienteNome: string;
  clienteId: string;
  onSuccess: () => void;
}

export function PagamentoQuickDialog({
  clienteNome,
  clienteId,
  onSuccess,
}: PagamentoQuickDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [valor, setValor] = useState("");
  const [data, setData] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);

      // Sanitizar e converter valor
      const valorNumerico = toNumber(valor);

      // Validar dados
      const validated = pagamentoSchema.parse({
        valor: valorNumerico,
        data,
        formaPagamento,
        observacoes: observacoes || undefined,
      });

      // Criar pagamento
      const sucesso = await criarPagamento({
        "ID Pagamento": gerarIdPagamento(),
        "Nome Cliente": clienteNome,
        "Data Pagamento": validated.data,
        "Valor Pago": validated.valor,
        "Forma de Pagamento": validated.formaPagamento,
        "Observações": validated.observacoes || "",
      });

      if (sucesso) {
        toast.success("Pagamento registrado com sucesso!");
        setOpen(false);
        // Limpar formulário
        setValor("");
        setData(new Date().toISOString().split("T")[0]);
        setFormaPagamento("");
        setObservacoes("");
        // Chamar callback de sucesso
        onSuccess();
      } else {
        toast.error("Erro ao registrar pagamento");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast.error(firstError.message);
      } else {
        console.error("Erro ao registrar pagamento:", error);
        toast.error("Erro ao registrar pagamento");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="default">
          <CreditCard className="h-4 w-4 mr-2" />
          Registrar Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            Registre um novo pagamento para {clienteNome}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Cliente (readonly) */}
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={clienteNome}
                disabled
                className="bg-muted"
              />
            </div>

            {/* Data */}
            <div className="space-y-2">
              <Label htmlFor="data">Data do Pagamento *</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                type="text"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <Label htmlFor="formaPagamento">Forma de Pagamento *</Label>
              <Select
                value={formaPagamento}
                onValueChange={setFormaPagamento}
                disabled={isLoading}
                required
              >
                <SelectTrigger id="formaPagamento">
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Cartão Crédito">Cartão Crédito</SelectItem>
                  <SelectItem value="Cartão Débito">Cartão Débito</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações sobre o pagamento (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={isLoading}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {observacoes.length}/500 caracteres
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formaPagamento}>
              {isLoading ? "Registrando..." : "Registrar Pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

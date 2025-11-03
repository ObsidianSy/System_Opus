import { useState, memo, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { importService } from '@/services/importService';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

interface UploadProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

export const ImportTab = memo(function ImportTab() {
  const { usuario } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [importId, setImportId] = useState<string | null>(null);
  const [isEmitting, setIsEmitting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const {
    toast
  } = useToast();
  const {
    data: clientes
  } = useApiData('Clientes');

  // Cleanup do EventSource quando componente desmontar
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      setSelectedFile(file);
    }
  };
  const handleUpload = async () => {
    if (!selectedClient || !selectedFile) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, selecione um cliente e um arquivo.',
        variant: 'destructive'
      });
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setProgressMessage('Enviando arquivo...');

    try {
      const response = await importService.uploadFile(
        selectedClient,
        selectedFile,
        'ML',
        undefined,
        usuario?.email || 'usuario@sistema.com',
        usuario?.nome || 'Usuário Sistema'
      );

      const batchId = response.import_id;
      setImportId(batchId);

      // Conectar ao SSE para receber progresso em tempo real
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(`${apiUrl}/api/envios/upload-progress/${batchId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const progress: UploadProgress = JSON.parse(event.data);

        // Calcular porcentagem
        const percentage = progress.total > 0
          ? Math.round((progress.current / progress.total) * 100)
          : 0;

        setUploadProgress(percentage);
        setProgressMessage(progress.message);

        // Se completou, fechar conexão
        if (progress.stage === 'completed') {
          eventSource.close();
          toast({
            title: 'Upload concluído!',
            description: progress.message
          });

          // Reset form após 2 segundos
          setTimeout(() => {
            setSelectedFile(null);
            setUploadProgress(0);
            setProgressMessage('');
            setIsUploading(false);
          }, 2000);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsUploading(false);
        toast({
          title: 'Erro no progresso',
          description: 'Conexão de progresso perdida, mas upload pode ter sido concluído.',
          variant: 'destructive'
        });
      };

    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      setProgressMessage('');
      toast({
        title: 'Erro no upload',
        description: 'Falha ao enviar arquivo. Tente novamente.',
        variant: 'destructive'
      });
    }
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleEmitirVendas = async () => {
    if (!importId) {
      toast({
        title: 'Erro',
        description: 'ID de importação não encontrado.',
        variant: 'destructive'
      });
      return;
    }
    setIsEmitting(true);
    try {
      const result = await importService.emitirVendas({
        import_id: importId
      });
      if (result.candidatos === 0 && result.full_skipped > 0) {
        toast({
          title: 'Todos eram FULL',
          description: 'Todos os pedidos eram Mercado Fulfillment (sem baixa/financeiro).',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Vendas emitidas com sucesso',
          description: `Emitidos: ${result.inseridos} | Já existiam: ${result.ja_existiam} | FULL: ${result.full_skipped}`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao emitir vendas',
        description: error.message?.slice(0, 180) || 'Verifique o log',
        variant: 'destructive'
      });
    } finally {
      setIsEmitting(false);
    }
  };
  return <div className="grid gap-6 md:grid-cols-2">
    {/* Card de Upload */}
    <Card className="md:col-span-1">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Importar Planilha</CardTitle>
        <CardDescription>Upload de arquivo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seleção de Cliente */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            Cliente
            <span className="text-destructive">*</span>
          </label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((cliente: any) => <SelectItem key={cliente.Nome} value={cliente.Nome}>
                {cliente.Nome}
              </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Área de Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-1">
            Arquivo
            <span className="text-destructive">*</span>
          </label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer group" onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => document.getElementById('file-input')?.click()}>
            <input id="file-input" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />

            {selectedFile ? <div className="space-y-3">
              <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={e => {
                e.stopPropagation();
                setSelectedFile(null);
              }}>
                Remover arquivo
              </Button>
            </div> : <div className="space-y-3">
              <div className="p-3 bg-muted rounded-full w-fit mx-auto group-hover:bg-primary/10 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="font-medium text-sm">Arraste o arquivo aqui</p>
                <p className="text-xs text-muted-foreground">
                  ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV, XLSX (máx. 10MB)
                </p>
              </div>
            </div>}
          </div>
        </div>

        {/* Progress */}
        {isUploading && <div className="space-y-2">
          <Progress value={uploadProgress} className="h-2" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">
              {uploadProgress}%
            </p>
            {progressMessage && (
              <p className="text-sm text-muted-foreground text-center">
                {progressMessage}
              </p>
            )}
          </div>
        </div>}

        {/* Botão de Envio */}
        <Button onClick={handleUpload} disabled={!selectedClient || !selectedFile || isUploading} className="w-full" size="default">
          {isUploading ? <>
            <span className="animate-spin mr-2">⏳</span>
            Enviando...
          </> : <>
            <Upload className="h-4 w-4 mr-2" />
            Enviar Planilha
          </>}
        </Button>
      </CardContent>
    </Card>

    {/* Card de Informações */}
    <div className="space-y-4">
      {/* Status Card */}
      {importId && !isUploading && <div className="space-y-3">
        <Alert className="border-success/50 bg-success/10">
          <AlertCircle className="h-4 w-4 text-success" />
          <AlertDescription>
            <strong>Importação iniciada!</strong>
            <br />
            ID: <code className="text-xs bg-background px-1 py-0.5 rounded">{importId}</code>
            <br />
            <span className="text-xs">Acesse "Dados Importados" para visualizar.</span>
          </AlertDescription>
        </Alert>

        <Button onClick={handleEmitirVendas} disabled={isEmitting} className="w-full" variant="default">
          {isEmitting ? <>
            <span className="animate-spin mr-2">⏳</span>
            Processando...
          </> : <>
            <Send className="h-4 w-4 mr-2" />
            Emitir vendas deste import
          </>}
        </Button>
      </div>}

      {/* Instructions Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instruções</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Selecione o cliente correspondente aos dados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Faça upload de arquivos CSV ou Excel (.xlsx, .xls)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>O arquivo deve conter colunas: ID Pedido, Data, SKU, Quantidade, Valor</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Após o upload, os dados serão processados automaticamente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Use a aba "Relacionar Itens" para vincular SKUs não reconhecidos</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Recent Imports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Importações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Nenhuma importação recente
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>;
});
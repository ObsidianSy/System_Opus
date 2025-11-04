import { useState, memo } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Package, CheckCircle2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { importService } from '@/services/importService';
import { useApiData } from '@/hooks/useApiData';
import { useAuth } from '@/contexts/AuthContext';

interface ImportTabFullProps {
  onUploadSuccess?: (data: { envioNum: string; clienteNome: string; pendentes: number }) => void;
}

interface UploadResult {
  envioNum: string;
  totalLinhas: number;
  autoRelacionadas: number;
  pendentes: number;
}

export const ImportTabFull = memo(function ImportTabFull({ onUploadSuccess }: ImportTabFullProps) {
  const { usuario } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [envioNum, setEnvioNum] = useState<string>('');
  const [importDate, setImportDate] = useState<Date | undefined>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const { data: clientes } = useApiData('Clientes');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/pdf',
      ];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor, selecione um arquivo CSV, Excel ou PDF.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedClient || !envioNum || !selectedFile || !importDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha cliente, nº envio, data e selecione um arquivo.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await importService.uploadFileFull(
        selectedClient,
        envioNum,
        selectedFile,
        format(importDate, 'yyyy-MM-dd'),
        usuario?.email || 'usuario@sistema.com',
        usuario?.nome || 'Usuário Sistema'
      );

      // Se temos import_id, conectar ao SSE para progresso real
      if (response.import_id) {
        const eventSource = new EventSource(`/api/envios/upload-progress/${response.import_id}`);

        eventSource.onmessage = (event) => {
          try {
            const progress = JSON.parse(event.data);
            const percentage = progress.total > 0 
              ? Math.round((progress.current / progress.total) * 100) 
              : 0;
            
            setUploadProgress(percentage);

            // Fechar conexão quando completar
            if (progress.stage === 'completed' || progress.stage === 'error') {
              eventSource.close();
              setUploadProgress(100);
            }
          } catch (err) {
            console.error('Erro ao processar progresso:', err);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setUploadProgress(100);
        };

        // Timeout de segurança (2 minutos)
        setTimeout(() => {
          eventSource.close();
        }, 120000);
      } else {
        // Fallback: progresso fake se não tiver import_id
        setUploadProgress(100);
      }

      const autoRelacionadas = response.auto_relacionadas || 0;
      const pendentes = response.pendentes || 0;
      const totalLinhas = response.total_linhas || response.linhas_processadas || response.linhas || 0;

      // Armazena resultado para exibição
      setUploadResult({
        envioNum: response.envio_num,
        totalLinhas,
        autoRelacionadas,
        pendentes
      });

      toast({
        title: 'Upload concluído',
        description: `Envio ${response.envio_num} processado com sucesso`,
      });

      // Notifica o parent sobre o upload
      if (onUploadSuccess) {
        onUploadSuccess({
          envioNum: response.envio_num,
          clienteNome: selectedClient,
          pendentes
        });
      }

      // Limpa o form mas mantém o resultado visível
      setSelectedFile(null);
      setIsUploading(false);
      setEnvioNum('');
    } catch (error: any) {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Falha ao enviar arquivo. Tente novamente.',
        variant: 'destructive',
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

  return (
    <div className="space-y-6">
      {/* Resultado do Upload */}
      {uploadResult && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div className="ml-3 flex-1">
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">
                Envio {uploadResult.envioNum} importado com sucesso!
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Total de Linhas</div>
                  <div className="text-lg font-bold text-foreground">{uploadResult.totalLinhas}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Auto-Relacionados</div>
                  <div className="text-lg font-bold text-green-600">{uploadResult.autoRelacionadas}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pendentes</div>
                  <div className="text-lg font-bold text-orange-600">{uploadResult.pendentes}</div>
                </div>
              </div>
              {uploadResult.pendentes > 0 && (
                <div className="mt-2 text-xs text-orange-600">
                  ⚠️ {uploadResult.pendentes} {uploadResult.pendentes === 1 ? 'item precisa' : 'itens precisam'} ser relacionado{uploadResult.pendentes === 1 ? '' : 's'} manualmente
                </div>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Importar Envio Full
            </CardTitle>
            <CardDescription>Upload de arquivo ML Fulfillment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  {clientes.map((cliente: any) => (
                    <SelectItem key={cliente.Nome} value={cliente.Nome}>
                      {cliente.Nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Nº Envio
                <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="Ex: 53293771"
                value={envioNum}
                onChange={(e) => setEnvioNum(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Data de Importação
                <span className="text-destructive">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !importDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {importDate ? (
                      format(importDate, "PPP", { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={importDate}
                    onSelect={setImportDate}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                Arquivo
                <span className="text-destructive">*</span>
              </label>
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer group"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('file-input-full')?.click()}
              >
                <input
                  id="file-input-full"
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      Remover arquivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-full w-fit mx-auto group-hover:bg-primary/10 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Arraste o arquivo aqui</p>
                      <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        CSV, XLSX, PDF (máx. 10MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Enviando... {uploadProgress}%
                </p>
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!selectedClient || !envioNum || !selectedFile || isUploading}
              className="w-full"
              size="default"
            >
              {isUploading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar para Fulfillment
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Instruções</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Selecione o cliente interno correspondente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Informe o número do envio (ex: 53293771)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Faça upload do arquivo ML Full (CSV, XLSX ou PDF)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>O sistema irá processar e normalizar os SKUs automaticamente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>SKUs não reconhecidos aparecerão em "Pendências"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Kits são expandidos automaticamente para componentes</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

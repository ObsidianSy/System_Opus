import { Suspense, lazy, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Database, Link2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import { ImportClientProvider } from '@/contexts/ImportClientContext';

// Lazy load tabs
const ImportTabFull = lazy(() => import('@/components/import/ImportTabFull').then(m => ({ default: m.ImportTabFull })));
const FullImportedDataTab = lazy(() => import('@/components/import/FullImportedDataTab').then(m => ({ default: m.FullImportedDataTab })));
const FullRelateItemsTab = lazy(() => import('@/components/import/FullRelateItemsTab').then(m => ({ default: m.FullRelateItemsTab })));

const TabLoading = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

export default function ImportPlanilhaFull() {
  const [activeTab, setActiveTab] = useState('import');
  const [lastUploadData, setLastUploadData] = useState<{
    envioNum: string;
    clienteNome: string;
    pendentes: number;
  } | null>(null);

  const handleUploadSuccess = (data: { envioNum: string; clienteNome: string; pendentes: number }) => {
    setLastUploadData(data);
    setActiveTab('data'); // Muda para aba "Dados Importados"
  };

  return (
    <Layout>
      <ImportClientProvider>
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-6 border border-primary/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Importação Full (Fulfillment)</h1>
            </div>
            <p className="text-muted-foreground">
              Importe, visualize e relacione envios ML Fulfillment com seu estoque
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importar Planilha
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Dados Importados
              </TabsTrigger>
              <TabsTrigger value="relate" className="flex items-center gap-2 relative">
                <Link2 className="h-4 w-4" />
                Relacionar Itens
                {lastUploadData && lastUploadData.pendentes > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 h-5 min-w-5 flex items-center justify-center text-xs"
                  >
                    {lastUploadData.pendentes}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="mt-0">
              <Suspense fallback={<TabLoading />}>
                <ImportTabFull onUploadSuccess={handleUploadSuccess} />
              </Suspense>
            </TabsContent>

            <TabsContent value="data" className="mt-0">
              <Suspense fallback={<TabLoading />}>
                <FullImportedDataTab
                  initialEnvioNum={lastUploadData?.envioNum}
                  initialClienteNome={lastUploadData?.clienteNome}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="relate" className="mt-0">
              <Suspense fallback={<TabLoading />}>
                <FullRelateItemsTab
                  initialEnvioNum={lastUploadData?.envioNum}
                  initialClienteNome={lastUploadData?.clienteNome}
                />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </ImportClientProvider>
    </Layout>
  );
}
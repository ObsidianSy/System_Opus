import { Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Database, Link2, FileSpreadsheet } from 'lucide-react';
import Layout from '@/components/Layout';
import { ImportClientProvider } from '@/contexts/ImportClientContext';

// Lazy load tabs para melhor performance
const ImportTab = lazy(() => import('@/components/import/ImportTab').then(m => ({ default: m.ImportTab })));
const ImportedDataTab = lazy(() => import('@/components/import/ImportedDataTab').then(m => ({ default: m.ImportedDataTab })));
const RelateItemsTab = lazy(() => import('@/components/import/RelateItemsTab').then(m => ({ default: m.RelateItemsTab })));

// Loading component
const TabLoading = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

export default function ImportPlanilha() {
  return (
    <Layout>
      <ImportClientProvider>
        <div className="space-y-6">
          {/* Header com gradiente */}
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-6 border border-primary/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Importação de Planilha Upseller</h1>
            </div>
            <p className="text-muted-foreground">
              Importe, visualize e relacione dados de vendas da Upseller com seu estoque
            </p>
          </div>

          {/* Tabs melhoradas */}
          <Tabs defaultValue="import" className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/50">
              <TabsTrigger 
                value="import" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importar</span>
                <span className="sm:hidden">Import</span>
              </TabsTrigger>
              <TabsTrigger 
                value="data" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Dados Importados</span>
                <span className="sm:hidden">Dados</span>
              </TabsTrigger>
              <TabsTrigger 
                value="relate" 
                className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <Link2 className="h-4 w-4" />
                <span className="hidden sm:inline">Relacionar Itens</span>
                <span className="sm:hidden">Relacionar</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="mt-0">
              <Suspense fallback={<TabLoading />}>
                <ImportTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="data" className="mt-0">
              <Suspense fallback={<TabLoading />}>
                <ImportedDataTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="relate" className="mt-0">
              <Suspense fallback={<TabLoading />}>
                <RelateItemsTab />
              </Suspense>
            </TabsContent>
          </Tabs>
        </div>
      </ImportClientProvider>
    </Layout>
  );
}
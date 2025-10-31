import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FullKPIs } from "@/components/full/FullKPIs";
import { PendenciasTab } from "@/components/full/PendenciasTab";
import { RelacionadosTab } from "@/components/full/RelacionadosTab";
import { TodosTab } from "@/components/full/TodosTab";

export default function FullEnvios() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">FULL - Mercado Envios Full</h1>
          <p className="text-muted-foreground">
            Gerencie envios FULL, relacione SKUs e emita pedidos
          </p>
        </div>

        <FullKPIs />

        <Tabs defaultValue="pendencias" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pendencias">Pendências de SKU</TabsTrigger>
            <TabsTrigger value="relacionados">Relacionados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value="pendencias" className="space-y-4">
            <PendenciasTab />
          </TabsContent>

          <TabsContent value="relacionados" className="space-y-4">
            <RelacionadosTab />
          </TabsContent>

          <TabsContent value="todos" className="space-y-4">
            <TodosTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

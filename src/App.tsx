
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrivateRoute } from "@/components/PrivateRoute";
import Index from "./pages/Index";
import Estoque from "./pages/Estoque";
import EstoqueProduto from "./pages/EstoqueProduto";
import NotFound from "./pages/NotFound";
import Vendas from "./pages/Vendas";
import Clientes from "./pages/Clientes";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Pagamentos from "./pages/Pagamentos";
import Relatorios from "./pages/Relatorios";
import Despesas from "./pages/Despesas";
import ReceitaProduto from "./pages/ReceitaProduto";
import ImportPlanilha from "./pages/ImportPlanilha";
import ImportPlanilhaFull from "./pages/ImportPlanilhaFull";
import FullEnvios from "./pages/FullEnvios";
import ActivityLogs from "./pages/ActivityLogs";
import Devolucoes from "./pages/Devolucoes";
import FotosProdutos from "./pages/FotosProdutos";
import UserManagement from "./pages/UserManagement";
import Login from "./pages/Login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 10, // 10 minutos
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <DateFilterProvider>
          <TooltipProvider>
            <BrowserRouter>
              <AuthProvider>
                <Routes>
                  {/* Rota pública de login */}
                  <Route path="/login" element={<Login />} />

                  {/* Todas as outras rotas são protegidas */}
                  <Route path="/" element={<PrivateRoute><Index /></PrivateRoute>} />

                  {/* Rotas de Estoque */}
                  <Route path="/estoque" element={<PrivateRoute><Estoque /></PrivateRoute>} />
                  <Route path="/estoque/novo" element={<PrivateRoute><EstoqueProduto /></PrivateRoute>} />
                  <Route path="/estoque/editar/:id" element={<PrivateRoute><EstoqueProduto /></PrivateRoute>} />
                  <Route path="/estoque/entrada" element={<PrivateRoute><Estoque /></PrivateRoute>} />

                  {/* Rotas de Vendas */}
                  <Route path="/vendas" element={<PrivateRoute><Vendas /></PrivateRoute>} />

                  {/* Rotas de Clientes */}
                  <Route path="/clientes" element={<PrivateRoute><Clientes /></PrivateRoute>} />
                  <Route path="/cliente/:clienteId" element={<PrivateRoute><ClienteDetalhe /></PrivateRoute>} />

                  {/* Rota de Pagamentos */}
                  <Route path="/pagamentos" element={<PrivateRoute><Pagamentos /></PrivateRoute>} />

                  {/* Rota de Devoluções */}
                  <Route path="/devolucoes" element={<PrivateRoute><Devolucoes /></PrivateRoute>} />

                  {/* Rota de Relatórios */}
                  <Route path="/relatorios" element={<PrivateRoute><Relatorios /></PrivateRoute>} />

                  {/* Novas Rotas */}
                  <Route path="/despesas" element={<PrivateRoute><Despesas /></PrivateRoute>} />
                  <Route path="/receita-produto" element={<PrivateRoute><ReceitaProduto /></PrivateRoute>} />
                  <Route path="/import-planilha" element={<PrivateRoute><ImportPlanilha /></PrivateRoute>} />
                  <Route path="/import-planilha-full" element={<PrivateRoute><ImportPlanilhaFull /></PrivateRoute>} />
                  <Route path="/full-envios" element={<PrivateRoute><FullEnvios /></PrivateRoute>} />
                  <Route path="/activity-logs" element={<PrivateRoute><ActivityLogs /></PrivateRoute>} />
                  <Route path="/fotos-produtos" element={<PrivateRoute><FotosProdutos /></PrivateRoute>} />
                  <Route path="/usuarios" element={<PrivateRoute><UserManagement /></PrivateRoute>} />

                  {/* Rota 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
            <Toaster />
            <Sonner position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </DateFilterProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;

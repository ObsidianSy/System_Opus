import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { importService } from "@/services/importService";

export interface FullPendencia {
  full_raw_id: number;
  envio_id: number;
  envio_num: string;
  client_id: number;
  sku_texto: string;
  matched_sku: string | null;
  envio_status: string;
  is_emitted: boolean;
  status_match: string;
}

export interface FullRelacionado {
  full_raw_id: number;
  envio_id: number;
  envio_num: string;
  client_id: number;
  sku_texto: string;
  matched_sku: string;
  envio_status: string;
}

export interface FullTodos {
  full_raw_id: number;
  envio_id: number;
  envio_num: string;
  client_id: number;
  sku_texto: string;
  matched_sku: string | null;
  envio_status: string;
  status_match: string;
  is_emitted: boolean;
}

export interface FullKPIs {
  total: number;
  pendentes: number;
  relacionados: number;
  emitidos: number;
}

export interface Produto {
  sku: string;
  nome: string;
}

export const useFullData = (envioNum?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kpis, isLoading: isLoadingKPIs } = useQuery({
    queryKey: ["full-kpis"],
    queryFn: async (): Promise<FullKPIs> => {
      return await importService.getFullKPIs();
    },
  });

  const { data: pendencias, isLoading: isLoadingPendencias } = useQuery({
    queryKey: ["full-pendencias"],
    queryFn: async (): Promise<FullPendencia[]> => {
      return await importService.getFullPendencias();
    },
  });

  const { data: relacionados, isLoading: isLoadingRelacionados } = useQuery({
    queryKey: ["full-relacionados"],
    queryFn: async (): Promise<FullRelacionado[]> => {
      return await importService.getFullRelacionados();
    },
  });

  const { data: todos, isLoading: isLoadingTodos, refetch: refreshTodos } = useQuery({
    queryKey: ["full-todos", envioNum],
    queryFn: async (): Promise<FullTodos[]> => {
      return await importService.getFullTodos(envioNum);
    },
  });

  const relacionarSkuMutation = useMutation({
    mutationFn: async ({
      rawId,
      sku,
      alias,
    }: {
      rawId: number;
      sku: string;
      alias: string;
    }) => {
      await importService.relacionarSku(rawId, sku, alias);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["full-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["full-pendencias"] });
      queryClient.invalidateQueries({ queryKey: ["full-relacionados"] });
      queryClient.invalidateQueries({ queryKey: ["full-todos"] });

      toast({
        title: "SKU relacionado com sucesso",
        description: "O envio foi emitido automaticamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao relacionar SKU",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const emitirMutation = useMutation({
    mutationFn: async (envioId: number) => {
      await importService.emitirEnvio(envioId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["full-kpis"] });
      queryClient.invalidateQueries({ queryKey: ["full-relacionados"] });
      queryClient.invalidateQueries({ queryKey: ["full-todos"] });

      toast({
        title: "Envio emitido com sucesso",
        description: "Os dados foram registrados no sistema.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao emitir envio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const searchProdutos = async (query: string): Promise<Produto[]> => {
    if (!query || query.length < 2) return [];
    return await importService.searchProdutos(query);
  };

  return {
    kpis,
    isLoadingKPIs,
    pendencias,
    isLoadingPendencias,
    relacionados,
    isLoadingRelacionados,
    todos,
    isLoadingTodos,
    refreshTodos,
    relacionarSku: relacionarSkuMutation.mutate,
    isRelacionando: relacionarSkuMutation.isPending,
    emitir: emitirMutation.mutate,
    isEmitindo: emitirMutation.isPending,
    searchProdutos,
  };
};

import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';

interface ImportClientContextType {
  selectedClientId: string | null;
  setSelectedClientId: (clientId: string | null) => void;
  availableClients: string[];
  isLoadingClients: boolean;
}

const ImportClientContext = createContext<ImportClientContextType | undefined>(undefined);

export const ImportClientProvider = ({ children }: { children: ReactNode }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { data: clientes, isLoading: isLoadingClientes } = useApiData('Clientes');

  const availableClients = useMemo(() => {
    const nomes = Array.isArray(clientes)
      ? clientes
          .map((c: any) => (c?.['Nome'] ?? '').toString().trim())
          .filter(Boolean)
      : [];
    // Normaliza e dedup case-insensitive
    const set = new Map<string, string>();
    for (const nome of nomes) {
      const key = nome.toLocaleLowerCase();
      if (!set.has(key)) set.set(key, nome);
    }
    return [...set.values()].sort((a, b) => a.localeCompare(b));
  }, [clientes]);

  return (
    <ImportClientContext.Provider 
      value={{ 
        selectedClientId, 
        setSelectedClientId, 
        availableClients, 
        isLoadingClients: isLoadingClientes 
      }}
    >
      {children}
    </ImportClientContext.Provider>
  );
};

export const useImportClient = () => {
  const context = useContext(ImportClientContext);
  if (context === undefined) {
    throw new Error('useImportClient must be used within ImportClientProvider');
  }
  return context;
};

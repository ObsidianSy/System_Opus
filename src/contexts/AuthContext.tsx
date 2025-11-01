import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '@/config/api';

interface Usuario {
    id: string;
    nome: string;
    email: string;
}

interface AuthContextType {
    usuario: Usuario | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (token: string, usuario: Usuario) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Verificar se já tem token salvo ao carregar
    useEffect(() => {
        const verificarAutenticacao = async () => {
            const tokenSalvo = localStorage.getItem('token');
            const usuarioSalvo = localStorage.getItem('usuario');

            if (tokenSalvo && usuarioSalvo) {
                try {
                    // Verificar se token ainda é válido
                    const response = await fetch(getApiUrl('/api/auth/verify'), {
                        headers: {
                            'Authorization': `Bearer ${tokenSalvo}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        setToken(tokenSalvo);
                        setUsuario(data.usuario);
                    } else {
                        // Token inválido, limpar
                        localStorage.removeItem('token');
                        localStorage.removeItem('usuario');
                    }
                } catch (error) {
                    console.error('Erro ao verificar autenticação:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuario');
                }
            }

            setLoading(false);
        };

        verificarAutenticacao();
    }, []);

    const login = (novoToken: string, novoUsuario: Usuario) => {
        setToken(novoToken);
        setUsuario(novoUsuario);
        localStorage.setItem('token', novoToken);
        localStorage.setItem('usuario', JSON.stringify(novoUsuario));
    };

    const logout = () => {
        setToken(null);
        setUsuario(null);
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        navigate('/login');
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                token,
                isAuthenticated: !!token,
                loading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
}

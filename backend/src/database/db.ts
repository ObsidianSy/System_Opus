import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Configuração do pool de conexões
export const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'fabrica_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20, // Máximo de conexões no pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Testa a conexão
pool.on('connect', () => {
});

pool.on('error', (err) => {
    console.error('❌ Erro inesperado no pool de conexões:', err);
    process.exit(-1);
});

// Função helper para executar queries
export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        return res;
    } catch (error) {
        console.error('Erro na query:', { text, error });
        throw error;
    }
};

// Função para testar conexão
export const testConnection = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        return true;
    } catch (error) {
        console.error('❌ Erro ao testar conexão:', error);
        return false;
    }
};

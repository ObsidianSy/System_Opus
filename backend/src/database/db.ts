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
    idleTimeoutMillis: 30000, // 30 segundos para conexão ociosa
    connectionTimeoutMillis: 30000, // 30 segundos para conectar (aumentado de 2s -> 10s -> 30s)
    query_timeout: 30000, // 30 segundos timeout para queries
    keepAlive: true, // Mantém conexão ativa
    keepAliveInitialDelayMillis: 10000, // Delay inicial do keep-alive
    ssl: false // Desabilita SSL para conexão local
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

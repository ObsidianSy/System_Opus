import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { clientesRouter } from './routes/clientes';
import { vendasRouter } from './routes/vendas';
import { pagamentosRouter } from './routes/pagamentos';
import { estoqueRouter } from './routes/estoque';
import { materiaPrimaRouter } from './routes/materiaPrima';
import { receitaProdutoRouter } from './routes/receitaProduto';
import { enviosRouter } from './routes/envios';
import authRouter from './routes/auth';

// Carrega variáveis de ambiente
dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3001');

// Configuração de CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (ex: Postman, mobile apps, file://)
        if (!origin) return callback(null, true);

        // Em desenvolvimento, permite qualquer origem
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Middlewares
app.use(helmet()); // Segurança
app.use(compression()); // Compressão de respostas
app.use(express.json({ limit: '10mb' })); // Parser JSON
app.use(express.urlencoded({ extended: true }));

// Logger simples
app.use((req: Request, res: Response, next: NextFunction) => {
    next();
});

// Rota de health check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rotas da API
app.use('/api/auth', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/vendas', vendasRouter);
app.use('/api/pagamentos', pagamentosRouter);
app.use('/api/estoque', estoqueRouter);
app.use('/api/materia-prima', materiaPrimaRouter);
app.use('/api/receita-produto', receitaProdutoRouter);
app.use('/api/envios', enviosRouter);

// Serve arquivos estáticos do frontend (se existir pasta public)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback - todas as rotas não-API vão para index.html
app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Middleware de erro
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Erro:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Inicia o servidor

const server = app.listen(PORT, '0.0.0.0', () => {
});

server.on('listening', () => {
    const addr = server.address();
});

server.on('error', (error: any) => {
    console.error('❌ Erro ao iniciar servidor:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`⚠️  Porta ${PORT} já está em uso!`);
    }
    process.exit(1);
});

// Mantém o processo vivo
setInterval(() => {
    // Keep-alive para garantir que o processo não termine
}, 60000); // A cada 60 segundos

process.on('SIGTERM', () => {
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    server.close(() => {
        process.exit(0);
    });
});


export default app;

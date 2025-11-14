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
import { activityRouter } from './routes/activity';
import { devolucoesRouter } from './routes/devolucoes';
import authRouter from './routes/auth';
import produtoFotosRouter from './routes/produto-fotos';
import usuariosRouter from './routes/usuarios';
import { startCleanupTask } from './tasks/cleanupActivityLogs';

// Carrega variáveis de ambiente
dotenv.config();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3001');

// Configuração de CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:3000',
    'https://docker-opus-unified.q4xusi.easypanel.host'
];

app.use(cors({
    origin: (origin, callback) => {
        // Permite requisições sem origin (mesmo domínio, Postman, mobile apps)
        if (!origin) return callback(null, true);

        // Em desenvolvimento, permite qualquer origem
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // Verifica se a origin está na lista permitida
        if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.log(`❌ Origin bloqueada: ${origin}`);
            callback(null, true); // Em produção, permite de qualquer forma (API pública)
        }
    },
    credentials: true
}));

// Middlewares
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false, // Permite carregar recursos de outras origens
}));
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Parser JSON
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/usuarios', usuariosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/vendas', vendasRouter);
app.use('/api/pagamentos', pagamentosRouter);
app.use('/api/estoque', estoqueRouter);
app.use('/api/materia-prima', materiaPrimaRouter);
app.use('/api/receita-produto', receitaProdutoRouter);
app.use('/api/envios', enviosRouter);
app.use('/api/activity', activityRouter);
app.use('/api/devolucoes', devolucoesRouter);
app.use('/api/produto-fotos', produtoFotosRouter);

// Serve arquivos estáticos de upload com CORS
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', cors(), express.static(uploadsPath, {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, filePath) => {
        // Adiciona headers CORS específicos para imagens
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        // Define tipo MIME correto
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (filePath.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
        }
    }
}));

// Serve arquivos estáticos do frontend (se existir pasta public)
const publicPath = path.join(__dirname, '..', 'public');

// Serve arquivos estáticos com cabeçalhos corretos
app.use(express.static(publicPath, {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=UTF-8');
        }
    }
}));

// SPA fallback - todas as rotas não-API vão para index.html
app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Se for rota de API que não existe, passa para o erro handler
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Rota não encontrada' });
    }
    // Caso contrário, serve o index.html do frontend
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Erro ao enviar index.html:', err);
            res.status(500).send('Erro ao carregar aplicação');
        }
    });
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
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

server.on('listening', () => {
    try {
        startCleanupTask();
    } catch (err) {
        console.error('Erro ao iniciar task de limpeza:', err);
    }
});

server.on('error', (error: any) => {
    console.error('Erro ao iniciar servidor:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Porta ${PORT} já está em uso!`);
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

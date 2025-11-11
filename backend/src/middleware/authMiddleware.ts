import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Estender o tipo Request do Express para incluir user
export interface AuthRequest extends Request {
    user?: {
        id: string;
        nome: string;
        email: string;
        cargo: 'adm' | 'operador';
    };
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado no .env');
}

/**
 * Middleware opcional de autenticação
 * Decodifica o JWT do header Authorization e popula req.user
 * Se não houver token ou for inválido, continua sem popular req.user
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Sem token, continua sem autenticação
        return next();
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = {
            id: decoded.id,
            nome: decoded.nome,
            email: decoded.email,
            cargo: decoded.cargo
        };
    } catch (error) {
        // Token inválido, mas não bloqueia a requisição
        console.warn('⚠️ Token inválido ou expirado, continuando sem autenticação');
    }

    next();
};

/**
 * Middleware obrigatório de autenticação
 * Requer um token válido, caso contrário retorna 401
 */
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = {
            id: decoded.id,
            nome: decoded.nome,
            email: decoded.email,
            cargo: decoded.cargo
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};

import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../database/db';

const router = express.Router();

// Validar que o JWT_SECRET existe
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não está configurado no arquivo .env! Configure antes de iniciar o servidor.');
}

const JWT_SECRET = process.env.JWT_SECRET;

// Login
router.post('/login', async (req: any, res: Response) => {
    const { email, senha } = req.body;

    try {
        // Buscar usuário no banco
        const result = await pool.query(
            `SELECT id, nome, email, senha_hash, ativo, cargo 
       FROM obsidian.usuarios 
       WHERE email = $1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const usuario = result.rows[0];

        // Verificar se está ativo
        if (!usuario.ativo) {
            return res.status(403).json({ error: 'Usuário inativo' });
        }

        // Verificar senha com bcrypt
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Gerar token JWT
        const token = jwt.sign(
            {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                cargo: usuario.cargo
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                cargo: usuario.cargo
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Verificar token (usado para validar sessão)
router.get('/verify', async (req: any, res: Response) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        // Verificar se usuário ainda existe e está ativo
        const result = await pool.query(
            `SELECT id, nome, email, ativo, cargo 
       FROM obsidian.usuarios 
       WHERE id = $1`,
            [decoded.id]
        ); if (result.rows.length === 0 || !result.rows[0].ativo) {
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        res.json({
            usuario: {
                id: result.rows[0].id,
                nome: result.rows[0].nome,
                email: result.rows[0].email,
                cargo: result.rows[0].cargo
            }
        });

    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
        console.error('Erro ao verificar token:', error);
        res.status(500).json({ error: 'Erro ao verificar sessão' });
    }
});

export default router;

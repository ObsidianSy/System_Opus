import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../database/db';

const router = express.Router();

// Middleware simples para verificar se é admin (vai ser melhorado com JWT depois)
const checkAdmin = (req: any, res: Response, next: any) => {
    // Por enquanto, vamos confiar no header x-user-cargo
    // Depois você pode implementar verificação de JWT completa
    const userCargo = req.headers['x-user-cargo'];

    if (userCargo !== 'adm') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem gerenciar usuários.' });
    }

    next();
};

// GET /api/usuarios - Listar todos os usuários
router.get('/', checkAdmin, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT id, nome, email, cargo, ativo, created_at
            FROM obsidian.usuarios
            ORDER BY created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// POST /api/usuarios - Criar novo usuário
router.post('/', checkAdmin, async (req: Request, res: Response) => {
    const { nome, email, senha, cargo } = req.body;

    // Validações
    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (!['adm', 'operador'].includes(cargo || 'operador')) {
        return res.status(400).json({ error: 'Cargo deve ser "adm" ou "operador"' });
    }

    if (senha.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    try {
        // Verificar se email já existe
        const emailExists = await pool.query(
            'SELECT id FROM obsidian.usuarios WHERE email = $1',
            [email]
        );

        if (emailExists.rows.length > 0) {
            return res.status(409).json({ error: 'Email já cadastrado' });
        }

        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, 10);

        // Inserir usuário
        const result = await pool.query(`
            INSERT INTO obsidian.usuarios (nome, email, senha_hash, cargo, ativo, created_at)
            VALUES ($1, $2, $3, $4, true, NOW())
            RETURNING id, nome, email, cargo, ativo, created_at
        `, [nome, email, senhaHash, cargo || 'operador']);

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            usuario: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// PUT /api/usuarios/:id - Atualizar usuário
router.put('/:id', checkAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nome, email, senha, cargo, ativo } = req.body;

    try {
        // Verificar se usuário existe
        const userCheck = await pool.query(
            'SELECT id FROM obsidian.usuarios WHERE id = $1',
            [id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Construir query dinâmica
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (nome) {
            updates.push(`nome = $${paramCount}`);
            values.push(nome);
            paramCount++;
        }

        if (email) {
            // Verificar se email já existe em outro usuário
            const emailExists = await pool.query(
                'SELECT id FROM obsidian.usuarios WHERE email = $1 AND id != $2',
                [email, id]
            );

            if (emailExists.rows.length > 0) {
                return res.status(409).json({ error: 'Email já cadastrado em outro usuário' });
            }

            updates.push(`email = $${paramCount}`);
            values.push(email);
            paramCount++;
        }

        if (senha) {
            if (senha.length < 6) {
                return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
            }
            const senhaHash = await bcrypt.hash(senha, 10);
            updates.push(`senha_hash = $${paramCount}`);
            values.push(senhaHash);
            paramCount++;
        }

        if (cargo) {
            if (!['adm', 'operador'].includes(cargo)) {
                return res.status(400).json({ error: 'Cargo deve ser "adm" ou "operador"' });
            }
            updates.push(`cargo = $${paramCount}`);
            values.push(cargo);
            paramCount++;
        }

        if (typeof ativo === 'boolean') {
            updates.push(`ativo = $${paramCount}`);
            values.push(ativo);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        values.push(id);
        const query = `
            UPDATE obsidian.usuarios
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING id, nome, email, cargo, ativo, created_at
        `;

        const result = await pool.query(query, values);

        res.json({
            message: 'Usuário atualizado com sucesso',
            usuario: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// DELETE /api/usuarios/:id - Inativar usuário (soft delete)
router.delete('/:id', checkAdmin, async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE obsidian.usuarios
            SET ativo = false
            WHERE id = $1
            RETURNING id, nome, email
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        res.json({
            message: 'Usuário inativado com sucesso',
            usuario: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao inativar usuário:', error);
        res.status(500).json({ error: 'Erro ao inativar usuário' });
    }
});

export default router;

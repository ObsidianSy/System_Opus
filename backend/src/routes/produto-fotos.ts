import express, { Request, Response } from 'express';
import multer from 'multer';
import { pool } from '../database/db';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configurar multer para upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/fotos-produtos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'produto-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use apenas JPG, PNG ou WEBP.'));
        }
    }
});

// GET /api/produto-fotos - Lista produtos com suas fotos agrupados por base
router.get('/', async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT 
        produto_base,
        foto_url,
        foto_filename,
        COUNT(*) as quantidade_variantes,
        STRING_AGG(DISTINCT sku, ', ' ORDER BY sku) as skus_variantes
      FROM obsidian.v_produtos_com_foto
      GROUP BY produto_base, foto_url, foto_filename
      ORDER BY produto_base
    `);

        res.json(result.rows);
    } catch (error: any) {
        console.error('Erro ao listar produtos com fotos:', error);
        res.status(500).json({ error: 'Erro ao listar produtos com fotos' });
    }
});

// POST /api/produto-fotos - Upload de foto para produto base
router.post('/', upload.single('foto'), async (req: Request, res: Response) => {
    try {
        const { produto_base } = req.body;
        const file = req.file;

        if (!produto_base) {
            return res.status(400).json({ error: 'produto_base é obrigatório' });
        }

        if (!file) {
            return res.status(400).json({ error: 'Arquivo de foto é obrigatório' });
        }

        // Construir URL da foto (relativo ao servidor)
        const foto_url = `/uploads/fotos-produtos/${file.filename}`;

        // Verificar se produto_base existe nos produtos
        const checkProduct = await pool.query(`
      SELECT COUNT(*) as total
      FROM obsidian.produtos
      WHERE obsidian.extrair_produto_base(sku) = $1
    `, [produto_base.toUpperCase()]);

        if (parseInt(checkProduct.rows[0].total) === 0) {
            // Remover arquivo se produto não existe
            fs.unlinkSync(file.path);
            return res.status(404).json({ error: 'Nenhum produto encontrado com esse nome base' });
        }

        // Inserir ou atualizar foto
        const result = await pool.query(`
      INSERT INTO obsidian.produto_fotos (produto_base, foto_url, foto_filename, foto_size)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (produto_base) 
      DO UPDATE SET 
        foto_url = EXCLUDED.foto_url,
        foto_filename = EXCLUDED.foto_filename,
        foto_size = EXCLUDED.foto_size,
        updated_at = NOW()
      RETURNING *
    `, [produto_base.toUpperCase(), foto_url, file.filename, file.size]);

        res.json({
            message: 'Foto enviada com sucesso',
            foto: result.rows[0]
        });
    } catch (error: any) {
        console.error('Erro ao fazer upload de foto:', error);
        res.status(500).json({ error: 'Erro ao fazer upload de foto' });
    }
});

// DELETE /api/produto-fotos/:produto_base - Remove foto de produto
router.delete('/:produto_base', async (req: Request, res: Response) => {
    try {
        const { produto_base } = req.params;

        // Buscar informações da foto antes de deletar
        const foto = await pool.query(`
      SELECT foto_filename 
      FROM obsidian.produto_fotos 
      WHERE produto_base = $1
    `, [produto_base.toUpperCase()]);

        if (foto.rows.length === 0) {
            return res.status(404).json({ error: 'Foto não encontrada' });
        }

        // Deletar registro do banco
        await pool.query(`
      DELETE FROM obsidian.produto_fotos 
      WHERE produto_base = $1
    `, [produto_base.toUpperCase()]);

        // Remover arquivo físico
        const filePath = path.join(__dirname, '../../uploads/fotos-produtos', foto.rows[0].foto_filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'Foto removida com sucesso' });
    } catch (error: any) {
        console.error('Erro ao remover foto:', error);
        res.status(500).json({ error: 'Erro ao remover foto' });
    }
});

// GET /api/produto-fotos/buscar-bases - Busca produtos únicos por nome base
router.get('/buscar-bases', async (req: Request, res: Response) => {
    try {
        const { search } = req.query;

        let query = `
      SELECT 
        obsidian.extrair_produto_base(sku) as produto_base,
        COUNT(*) as quantidade_variantes,
        STRING_AGG(DISTINCT sku, ', ' ORDER BY sku) as skus_variantes,
        MAX(nome) as nome_exemplo
      FROM obsidian.produtos
    `;

        const params: any[] = [];

        if (search && typeof search === 'string') {
            query += ` WHERE sku ILIKE $1 OR nome ILIKE $1`;
            params.push(`%${search}%`);
        }

        query += `
      GROUP BY obsidian.extrair_produto_base(sku)
      ORDER BY produto_base
      LIMIT 100
    `;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error: any) {
        console.error('Erro ao buscar produtos base:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos base' });
    }
});

export default router;

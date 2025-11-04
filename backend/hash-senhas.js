/**
 * Script para migração de senhas em texto plano para bcrypt hash
 * 
 * ATENÇÃO: Execute este script UMA ÚNICA VEZ após implementar bcrypt
 * 
 * Uso:
 * node hash-senhas.js
 */

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const SALT_ROUNDS = 10;

async function hashSenhas() {
    try {
        console.log('🔐 Iniciando migração de senhas para bcrypt...\n');

        // Buscar todos os usuários
        const result = await pool.query(`
            SELECT id, email, senha_hash 
            FROM obsidian.usuarios
        `);

        if (result.rows.length === 0) {
            console.log('❌ Nenhum usuário encontrado na tabela obsidian.usuarios');
            process.exit(0);
        }

        console.log(`📊 Encontrados ${result.rows.length} usuários\n`);

        let hashJaFeitoCount = 0;
        let processadosCount = 0;

        for (const usuario of result.rows) {
            // Verificar se já está em formato bcrypt (começa com $2b$ ou $2a$)
            if (usuario.senha_hash && usuario.senha_hash.startsWith('$2')) {
                console.log(`✅ ${usuario.email} - Senha já está em bcrypt`);
                hashJaFeitoCount++;
                continue;
            }

            // Se não tem senha ou senha vazia, pular
            if (!usuario.senha_hash || usuario.senha_hash.trim() === '') {
                console.log(`⚠️  ${usuario.email} - Senha vazia, pulando`);
                continue;
            }

            // Fazer hash da senha atual
            const senhaEmTextoPlano = usuario.senha_hash;
            const hash = await bcrypt.hash(senhaEmTextoPlano, SALT_ROUNDS);

            // Atualizar no banco
            await pool.query(
                `UPDATE obsidian.usuarios 
                 SET senha_hash = $1 
                 WHERE id = $2`,
                [hash, usuario.id]
            );

            console.log(`🔒 ${usuario.email} - Senha convertida para bcrypt`);
            processadosCount++;
        }

        console.log('\n✨ Migração concluída!');
        console.log(`📈 Resumo:`);
        console.log(`   - Já estavam em bcrypt: ${hashJaFeitoCount}`);
        console.log(`   - Convertidas agora: ${processadosCount}`);
        console.log(`   - Total: ${result.rows.length}`);

    } catch (error) {
        console.error('❌ Erro ao processar senhas:', error);
    } finally {
        await pool.end();
    }
}

// Executar
hashSenhas();

/**
 * Script para gerar hashes bcrypt de senhas específicas
 * 
 * Útil para:
 * - Criar novos usuários com senha segura
 * - Resetar senhas de usuários existentes
 * - Gerar hashes para seed de banco de dados
 * 
 * Uso:
 * node gerar-hashes-senhas.js
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

// ============================================
// CONFIGURAÇÃO: Defina aqui as senhas padrão
// ============================================
const SENHAS_PADRAO = {
    'admin123': null,        // Senha administrativa comum
    '123456': null,          // Senha padrão simples
    'senha123': null,        // Outra senha comum
    'opus2024': null,        // Senha personalizada
    'sistema@123': null,     // Senha de sistema
};

// ============================================
// MODO 1: Apenas gerar hashes (sem salvar)
// ============================================
async function gerarHashes() {
    console.log('🔐 Gerando hashes bcrypt...\n');
    console.log('═'.repeat(80));

    for (const senha of Object.keys(SENHAS_PADRAO)) {
        const hash = await bcrypt.hash(senha, SALT_ROUNDS);
        SENHAS_PADRAO[senha] = hash;

        console.log(`\n📝 Senha: ${senha}`);
        console.log(`🔒 Hash:  ${hash}`);
        console.log('─'.repeat(80));
    }

    console.log('\n✅ Todos os hashes gerados!\n');
}

// ============================================
// MODO 2: Atualizar usuários específicos
// ============================================
async function atualizarUsuarios() {
    console.log('🔄 Atualizando senhas de usuários específicos...\n');

    // DEFINA AQUI: email do usuário -> nova senha
    const USUARIOS_PARA_ATUALIZAR = {
        // 'usuario@example.com': '123456',
        // 'admin@example.com': 'admin123',
        // Descomente e adicione os emails que deseja atualizar
    };

    if (Object.keys(USUARIOS_PARA_ATUALIZAR).length === 0) {
        console.log('⚠️  Nenhum usuário definido para atualização.');
        console.log('   Edite a constante USUARIOS_PARA_ATUALIZAR no script.\n');
        return;
    }

    for (const [email, senhaNova] of Object.entries(USUARIOS_PARA_ATUALIZAR)) {
        try {
            // Verificar se usuário existe
            const checkResult = await pool.query(
                'SELECT id, email FROM obsidian.usuarios WHERE email = $1',
                [email]
            );

            if (checkResult.rows.length === 0) {
                console.log(`❌ ${email} - Usuário não encontrado`);
                continue;
            }

            // Gerar hash
            const hash = await bcrypt.hash(senhaNova, SALT_ROUNDS);

            // Atualizar no banco
            await pool.query(
                'UPDATE obsidian.usuarios SET senha_hash = $1 WHERE email = $2',
                [hash, email]
            );

            console.log(`✅ ${email} - Senha atualizada`);
            console.log(`   Nova senha: ${senhaNova}`);
            console.log(`   Hash: ${hash.substring(0, 30)}...`);
            console.log('');

        } catch (error) {
            console.error(`❌ Erro ao atualizar ${email}:`, error.message);
        }
    }

    console.log('✨ Processo concluído!\n');
}

// ============================================
// MODO 3: Criar script SQL com hashes
// ============================================
async function gerarScriptSQL() {
    console.log('📄 Gerando script SQL com hashes...\n');
    console.log('═'.repeat(80));
    console.log('-- Script SQL com senhas em bcrypt hash');
    console.log('-- Gerado automaticamente em:', new Date().toLocaleString('pt-BR'));
    console.log('═'.repeat(80));
    console.log('');

    for (const senha of Object.keys(SENHAS_PADRAO)) {
        const hash = await bcrypt.hash(senha, SALT_ROUNDS);

        console.log(`-- Senha: ${senha}`);
        console.log(`-- Hash:  ${hash}`);
        console.log(`UPDATE obsidian.usuarios SET senha_hash = '${hash}' WHERE email = 'seu_email@exemplo.com';`);
        console.log('');
    }

    console.log('═'.repeat(80));
    console.log('✅ Script SQL gerado! Copie os comandos acima.\n');
}

// ============================================
// MODO 4: Resetar senha de um usuário específico
// ============================================
async function resetarSenhaUsuario(email, novaSenha) {
    console.log(`🔄 Resetando senha para: ${email}\n`);

    try {
        // Verificar se usuário existe
        const checkResult = await pool.query(
            'SELECT id, email, nome FROM obsidian.usuarios WHERE email = $1',
            [email]
        );

        if (checkResult.rows.length === 0) {
            console.log(`❌ Usuário ${email} não encontrado no banco de dados.\n`);
            return false;
        }

        const usuario = checkResult.rows[0];
        console.log(`👤 Usuário encontrado: ${usuario.nome}`);

        // Gerar hash
        const hash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
        console.log(`🔒 Hash gerado: ${hash.substring(0, 40)}...`);

        // Atualizar no banco
        await pool.query(
            'UPDATE obsidian.usuarios SET senha_hash = $1 WHERE id = $2',
            [hash, usuario.id]
        );

        console.log(`\n✅ Senha resetada com sucesso!`);
        console.log(`   Email: ${email}`);
        console.log(`   Nova senha: ${novaSenha}`);
        console.log(`   Hash completo: ${hash}\n`);

        return true;

    } catch (error) {
        console.error('❌ Erro ao resetar senha:', error.message);
        return false;
    }
}

// ============================================
// MENU PRINCIPAL
// ============================================
async function main() {
    console.log('\n🔐 GERADOR DE HASHES BCRYPT - System Opus\n');
    console.log('Escolha uma opção:\n');
    console.log('1. Gerar hashes das senhas padrão (apenas visualizar)');
    console.log('2. Atualizar senhas de usuários específicos no banco');
    console.log('3. Gerar script SQL com hashes');
    console.log('4. Resetar senha de um usuário específico');
    console.log('\n');

    // Pegar argumentos da linha de comando
    const args = process.argv.slice(2);
    const modo = args[0] || '1';

    try {
        switch (modo) {
            case '1':
                await gerarHashes();
                break;

            case '2':
                await atualizarUsuarios();
                break;

            case '3':
                await gerarScriptSQL();
                break;

            case '4':
                const email = args[1];
                const senha = args[2];

                if (!email || !senha) {
                    console.log('❌ Uso: node gerar-hashes-senhas.js 4 email@exemplo.com novaSenha123\n');
                    break;
                }

                await resetarSenhaUsuario(email, senha);
                break;

            default:
                console.log('❌ Opção inválida. Use: 1, 2, 3 ou 4\n');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await pool.end();
    }
}

// Executar
if (require.main === module) {
    main();
}

module.exports = { gerarHashes, atualizarUsuarios, resetarSenhaUsuario };

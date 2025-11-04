
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

(async () => {
    console.log('🔍 VERIFICANDO USUÁRIOS NO BANCO:\n');
    
    // Todos os usuários
    const todos = await pool.query(`
        SELECT id, nome, email, ativo 
        FROM obsidian.usuarios 
        ORDER BY nome
    `);
    
    console.log('📋 TODOS OS USUÁRIOS:');
    todos.rows.forEach(u => {
        console.log(`   ${u.ativo ? '✅' : '❌'} ${u.nome.padEnd(20)} | ${u.email}`);
    });
    
    // Verificar se Rafaela tem logs
    console.log('\n📊 LOGS POR USUÁRIO:\n');
    
    const logsPorUsuario = await pool.query(`
        SELECT 
            user_email,
            user_name,
            COUNT(*) as total_logs,
            MAX(created_at) as ultimo_log
        FROM obsidian.activity_logs
        GROUP BY user_email, user_name
        ORDER BY total_logs DESC
    `);
    
    logsPorUsuario.rows.forEach(u => {
        const ultimo = new Date(u.ultimo_log).toLocaleString('pt-BR');
        console.log(\`   \${u.user_name || u.user_email}: \${u.total_logs} logs (último: \${ultimo})\`);
    });
    
    await pool.end();
})();

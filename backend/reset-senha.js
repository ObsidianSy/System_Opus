const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: '72.60.147.138',
  port: 5432,
  database: 'obsidian',
  user: 'postgres',
  password: 'bb6cc576ca06d83f4b3d'
});

async function resetarSenha() {
  const email = 'teste@teste.com';
  const novaSenha = 'teste123'; // Senha que você vai usar para logar
  
  try {
    // Gerar novo hash bcrypt
    const senhaHash = await bcrypt.hash(novaSenha, 10);
    
    // Atualizar no banco
    const result = await pool.query(
      'UPDATE obsidian.usuarios SET senha_hash = $1 WHERE email = $2 RETURNING email, nome',
      [senhaHash, email]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Senha resetada com sucesso!');
      console.log('📧 Email:', result.rows[0].email);
      console.log('👤 Nome:', result.rows[0].nome);
      console.log('🔑 Nova senha: teste123');
      console.log('\n🔐 Agora você pode fazer login com:');
      console.log('   Email: teste@teste.com');
      console.log('   Senha: teste123');
    } else {
      console.log('❌ Usuário não encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro ao resetar senha:', error.message);
  } finally {
    await pool.end();
  }
}

resetarSenha();

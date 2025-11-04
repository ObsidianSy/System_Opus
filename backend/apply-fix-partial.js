const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    host: '72.60.147.138',
    port: 5432,
    database: 'obsidian',
    user: 'postgres',
    password: 'bb6cc576ca06d83f4b3d'
});

async function applyFix() {
    try {
        const sql = fs.readFileSync('fix-full-envio-emitir-partial.sql', 'utf8');

        console.log('Aplicando fix na função full_envio_emitir...\n');

        await pool.query(sql);

        console.log('✅ Função atualizada com sucesso!');
        console.log('');
        console.log('Mudanças aplicadas:');
        console.log('  - ✅ Removida validação que bloqueava emissão com pendentes');
        console.log('  - ✅ Emite apenas itens relacionados');
        console.log('  - ✅ Deixa pendentes para relacionar depois');
        console.log('  - ✅ Status do envio: "partial" se houver pendentes, "registrado" se tudo emitido');

    } catch (error) {
        console.error('❌ Erro ao aplicar fix:', error.message);
    } finally {
        await pool.end();
    }
}

applyFix();

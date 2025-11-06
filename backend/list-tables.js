const { pool } = require('./dist/database/db');

(async () => {
    try {
        const result = await pool.query(`
            SELECT table_name, 
                   (SELECT COUNT(*) FROM information_schema.columns 
                    WHERE table_schema='obsidian' AND table_name=t.table_name) as column_count
            FROM information_schema.tables t
            WHERE table_schema='obsidian'
            ORDER BY table_name
        `);

        console.log('\n📋 TABELAS DO SCHEMA OBSIDIAN:\n');
        result.rows.forEach(row => {
            console.log(`  ✓ ${row.table_name} (${row.column_count} colunas)`);
        });

        // Verificar se existe tabela de devoluções
        const devolucoes = result.rows.find(r => r.table_name.includes('devoluc') || r.table_name.includes('retorno') || r.table_name.includes('cancel'));

        if (devolucoes) {
            console.log(`\n✅ Encontrada tabela relacionada: ${devolucoes.table_name}`);
        } else {
            console.log('\n⚠️  Não existe tabela de devoluções/retornos ainda');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
})();

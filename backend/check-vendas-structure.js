const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({host:process.env.DB_HOST,port:parseInt(process.env.DB_PORT||'5432'),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
pool.query(\SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='obsidian' AND table_name='vendas' ORDER BY ordinal_position\).then(r=>{console.log('Colunas vendas:',r.rows.map(x=>x.column_name).join(', '));process.exit(0);}).catch(e=>{console.error(e);process.exit(1);});

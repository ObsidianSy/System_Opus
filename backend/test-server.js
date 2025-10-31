import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.get('/test', (req, res) => {
    res.json({ message: 'OK' });
});

console.log('Iniciando servidor de teste...');

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor teste rodando em http://localhost:${PORT}`);
});

server.on('listening', () => {
    console.log('👂 Servidor está ouvindo!');
});

server.on('error', (error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
});

// Mantém processo vivo
setInterval(() => { }, 1000);

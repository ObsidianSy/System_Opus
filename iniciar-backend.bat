@echo off
chcp 65001 > nul
echo ========================================
echo 🚀 Iniciar Backend - Sistema Fábrica
echo ========================================
echo.
echo Iniciando servidor backend na porta 3001...
echo.
echo ⚠️  CERTIFIQUE-SE DE:
echo   - PostgreSQL está rodando
echo   - Banco fabrica_db foi criado
echo   - Arquivo backend\.env está configurado
echo   - Migrations foram executadas (npm run db:migrate)
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
cd backend
npm run dev

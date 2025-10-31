@echo off
chcp 65001 > nul
echo ========================================
echo 🎨 Iniciar Frontend - Sistema Fábrica
echo ========================================
echo.
echo Iniciando aplicação React na porta 5173...
echo.
echo ⚠️  CERTIFIQUE-SE DE:
echo   - Backend está rodando (http://localhost:3001)
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
npm run dev

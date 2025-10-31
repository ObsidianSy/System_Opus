@echo off
chcp 65001 > nul
echo ========================================
echo 🚀 Instalação Backend - Sistema Fábrica
echo ========================================
echo.

echo 📦 Passo 1: Instalando dependências do backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências do backend
    pause
    exit /b 1
)
echo ✅ Dependências do backend instaladas!
echo.

echo 📝 Passo 2: Criando arquivo .env...
if not exist .env (
    copy .env.example .env > nul
    echo ✅ Arquivo .env criado! 
    echo ⚠️  IMPORTANTE: Edite backend\.env com suas credenciais do PostgreSQL!
    echo.
    echo Pressione qualquer tecla para abrir o .env no Notepad...
    pause > nul
    notepad .env
) else (
    echo ℹ️  Arquivo .env já existe
)
echo.

cd ..

echo 📦 Passo 3: Instalando dependências do frontend...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências do frontend
    pause
    exit /b 1
)
echo ✅ Dependências do frontend instaladas!
echo.

echo ========================================
echo ✅ Instalação concluída!
echo ========================================
echo.
echo 📋 Próximos passos:
echo.
echo 1. ✅ Instale o PostgreSQL (se ainda não instalou)
echo    👉 https://www.postgresql.org/download/
echo.
echo 2. ✅ Crie o banco de dados:
echo    👉 Abra pgAdmin ou psql
echo    👉 Execute: CREATE DATABASE fabrica_db;
echo.
echo 3. ✅ Configure o backend\.env com sua senha do PostgreSQL
echo.
echo 4. ✅ Execute as migrations:
echo    👉 cd backend
echo    👉 npm run db:migrate
echo.
echo 5. ✅ Inicie o servidor:
echo    👉 Abra 2 terminais:
echo    👉 Terminal 1: cd backend ^&^& npm run dev
echo    👉 Terminal 2: npm run dev
echo.
echo 📚 Leia GUIA_MIGRACAO.md para instruções detalhadas!
echo.
pause

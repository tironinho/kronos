@echo off
REM ============================================================================
REM SCRIPT DE INICIALIZAÇÃO KRONOS-X ENGINE V2 (WINDOWS)
REM ============================================================================

echo 🚀 Iniciando Sistema Kronos-X Engine V2...

REM Verifica se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não está instalado. Por favor, instale Node.js 18+ primeiro.
    pause
    exit /b 1
)

REM Verifica se npm está instalado
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm não está instalado. Por favor, instale npm primeiro.
    pause
    exit /b 1
)

echo ✅ Node.js detectado: 
node --version

REM Instala dependências se necessário
if not exist "node_modules" (
    echo 📦 Instalando dependências...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Erro ao instalar dependências
        pause
        exit /b 1
    )
    echo ✅ Dependências instaladas
) else (
    echo ✅ Dependências já instaladas
)

REM Verifica se arquivo .env existe
if not exist ".env.local" (
    echo ⚠️  Arquivo .env.local não encontrado
    echo 📝 Criando arquivo .env.local de exemplo...
    
    (
        echo # Configurações do Sistema
        echo NODE_ENV=development
        echo PORT=3000
        echo LOG_LEVEL=info
        echo.
        echo # Configurações da Binance ^(CONFIGURE SUAS CHAVES^)
        echo BINANCE_API_KEY=
        echo BINANCE_SECRET_KEY=
        echo BINANCE_BASE_REST=https://api.binance.com
        echo BINANCE_BASE_WS=wss://stream.binance.com:9443
        echo.
        echo # Símbolos para Monitorar
        echo SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT
        echo.
        echo # Configurações de Trading
        echo MAX_POSITION_SIZE=1000
        echo MAX_DAILY_LOSS=100
        echo STOP_LOSS_PERCENTAGE=2
        echo TAKE_PROFIT_PERCENTAGE=4
        echo MAX_CONCURRENT_POSITIONS=5
    ) > .env.local
    
    echo 📝 Arquivo .env.local criado. Configure suas chaves da Binance antes de continuar.
    echo ⚠️  IMPORTANTE: Configure BINANCE_API_KEY e BINANCE_SECRET_KEY no arquivo .env.local
    echo.
    echo Pressione qualquer tecla para continuar ou feche esta janela para sair...
    pause >nul
)

REM Cria diretório de logs se não existir
if not exist "logs" (
    echo 📁 Criando diretório de logs...
    mkdir logs
)

REM Verifica se há erros de TypeScript
echo 🔍 Verificando tipos TypeScript...
npm run type-check
if %errorlevel% neq 0 (
    echo ❌ Erros de TypeScript encontrados
    echo    Execute 'npm run type-check' para ver os detalhes
    pause
    exit /b 1
)
echo ✅ Verificação de tipos concluída

REM Inicia o sistema
echo.
echo 🎉 Sistema pronto para inicialização!
echo.
echo 📊 Dashboard: http://localhost:3000
echo 🔗 API: http://localhost:3000/api
echo 📈 Métricas: http://localhost:3000/api/metrics
echo 🎯 Sinais: http://localhost:3000/api/signals
echo 🏥 Saúde: http://localhost:3000/api/health
echo.
echo Pressione Ctrl+C para parar o sistema
echo.

REM Inicia o servidor de desenvolvimento
npm run dev

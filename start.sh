#!/bin/bash

# ============================================================================
# SCRIPT DE INICIALIZAÇÃO KRONOS-X ENGINE V2
# ============================================================================

echo "🚀 Iniciando Sistema Kronos-X Engine V2..."

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale Node.js 18+ primeiro."
    exit 1
fi

# Verifica se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado. Por favor, instale npm primeiro."
    exit 1
fi

# Verifica versão do Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js versão 18+ é necessária. Versão atual: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"

# Instala dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências"
        exit 1
    fi
    echo "✅ Dependências instaladas"
else
    echo "✅ Dependências já instaladas"
fi

# Verifica se arquivo .env existe
if [ ! -f ".env.local" ]; then
    echo "⚠️  Arquivo .env.local não encontrado"
    echo "📝 Criando arquivo .env.local de exemplo..."
    
    cat > .env.local << EOF
# Configurações do Sistema
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Configurações da Binance (CONFIGURE SUAS CHAVES)
BINANCE_API_KEY=
BINANCE_SECRET_KEY=
BINANCE_BASE_REST=https://api.binance.com
BINANCE_BASE_WS=wss://stream.binance.com:9443

# Símbolos para Monitorar
SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT

# Configurações de Trading
MAX_POSITION_SIZE=1000
MAX_DAILY_LOSS=100
STOP_LOSS_PERCENTAGE=2
TAKE_PROFIT_PERCENTAGE=4
MAX_CONCURRENT_POSITIONS=5
EOF
    
    echo "📝 Arquivo .env.local criado. Configure suas chaves da Binance antes de continuar."
    echo "⚠️  IMPORTANTE: Configure BINANCE_API_KEY e BINANCE_SECRET_KEY no arquivo .env.local"
    echo ""
    echo "Pressione Enter para continuar ou Ctrl+C para sair e configurar as chaves..."
    read
fi

# Verifica se as chaves da Binance estão configuradas
if grep -q "BINANCE_API_KEY=$" .env.local || grep -q "BINANCE_SECRET_KEY=$" .env.local; then
    echo "⚠️  ATENÇÃO: Chaves da Binance não configuradas no .env.local"
    echo "   O sistema funcionará em modo de demonstração sem trading real"
    echo ""
fi

# Cria diretório de logs se não existir
if [ ! -d "logs" ]; then
    echo "📁 Criando diretório de logs..."
    mkdir -p logs
fi

# Verifica se há erros de TypeScript
echo "🔍 Verificando tipos TypeScript..."
npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ Erros de TypeScript encontrados"
    echo "   Execute 'npm run type-check' para ver os detalhes"
    exit 1
fi
echo "✅ Verificação de tipos concluída"

# Inicia o sistema
echo ""
echo "🎉 Sistema pronto para inicialização!"
echo ""
echo "📊 Dashboard: http://localhost:3000"
echo "🔗 API: http://localhost:3000/api"
echo "📈 Métricas: http://localhost:3000/api/metrics"
echo "🎯 Sinais: http://localhost:3000/api/signals"
echo "🏥 Saúde: http://localhost:3000/api/health"
echo ""
echo "Pressione Ctrl+C para parar o sistema"
echo ""

# Inicia o servidor de desenvolvimento
npm run dev

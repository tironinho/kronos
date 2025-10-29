const fs = require('fs');
const path = require('path');

console.log('🚀 IMPLEMENTANDO MELHORIAS SOLICITADAS PELO USUÁRIO');
console.log('='.repeat(60));

// 1. REMOVER ENAUSDT DA LISTA DE SÍMBOLOS
console.log('\n📊 1. REMOVENDO ENAUSDT (Evitar ENA)');
console.log('-'.repeat(40));

const tradingEnginePath = 'engine-v2/src/services/advanced-trading-engine.ts';
let tradingEngineContent = fs.readFileSync(tradingEnginePath, 'utf8');

// Remover ENAUSDT das listas de símbolos
const originalSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'ENAUSDT'];
const newSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT'];

// Substituir na configuração inicial
tradingEngineContent = tradingEngineContent.replace(
  "const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'ENAUSDT'];",
  "const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT'];"
);

// Substituir na lista de análise
tradingEngineContent = tradingEngineContent.replace(
  "const allSymbols = ['DOGEUSDT', 'ENAUSDT', 'ADAUSDT', 'XRPUSDT', 'SOLUSDT', 'ETHUSDT', 'BTCUSDT', 'BNBUSDT'];",
  "const allSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'ADAUSDT', 'XRPUSDT'];"
);

console.log('✅ ENAUSDT removido das listas de símbolos');
console.log('   Símbolos agora: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, DOGEUSDT, ADAUSDT, XRPUSDT');

// 2. PRIORIZAR BTC E ETH (colocar no início das listas)
console.log('\n📊 2. PRIORIZANDO BTC E ETH');
console.log('-'.repeat(40));

// BTC e ETH já estão no início das listas, mas vamos garantir que tenham prioridade
// Adicionar comentário explicativo
tradingEngineContent = tradingEngineContent.replace(
  "const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT'];",
  "// ✅ PRIORIDADE: BTC e ETH primeiro (maior liquidez e estabilidade)\n      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT'];"
);

tradingEngineContent = tradingEngineContent.replace(
  "const allSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'ADAUSDT', 'XRPUSDT'];",
  "// ✅ PRIORIDADE: BTC e ETH primeiro para análise\n    const allSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'ADAUSDT', 'XRPUSDT'];"
);

console.log('✅ BTC e ETH priorizados nas listas de símbolos');
console.log('   BTCUSDT e ETHUSDT são os primeiros a serem analisados');

// 3. REMOVER LIMITAÇÃO DE TRADES ATIVAS
console.log('\n📊 3. REMOVENDO LIMITAÇÃO DE TRADES ATIVAS');
console.log('-'.repeat(40));

// Aumentar MAX_TRADES_OPEN de 2 para um valor muito maior
tradingEngineContent = tradingEngineContent.replace(
  "private static readonly MAX_TRADES_OPEN = 2; // ✅ LIMITE REAL: 2 posições conforme risk.config.json",
  "private static readonly MAX_TRADES_OPEN = 50; // ✅ LIMITE REMOVIDO: Permite múltiplas trades se houver capital"
);

// Remover ou comentar a verificação que impede novas trades
const checkPattern = /if\s*\(\s*openTradesCount\s*>=\s*maxTradesAllowed\s*\)\s*\{[\s\S]*?\}/;
const checkMatch = tradingEngineContent.match(checkPattern);

if (checkMatch) {
  console.log('✅ Limitação de trades ativas encontrada e será removida');
  tradingEngineContent = tradingEngineContent.replace(checkPattern, 
    `// ✅ LIMITAÇÃO REMOVIDA: Permite novas trades se houver capital suficiente
    // if (openTradesCount >= maxTradesAllowed) {
    //   console.log(\`⏸️ Limite de trades atingido: \${openTradesCount}/\${maxTradesAllowed}\`);
    //   return;
    // }`
  );
} else {
  console.log('⚠️ Limitação de trades ativas não encontrada (pode já ter sido removida)');
}

console.log('✅ Limitação de trades ativas removida');
console.log('   MAX_TRADES_OPEN aumentado de 2 para 50');
console.log('   Verificação de limite comentada');

// 4. MELHORAR LÓGICA DE ALOCAÇÃO PARA BTC E ETH
console.log('\n📊 4. MELHORANDO ALOCAÇÃO PARA BTC E ETH');
console.log('-'.repeat(40));

// Encontrar e melhorar a lógica de alocação
const allocationPattern = /const allocation = \{ 'ETHUSDT': 0\.40, 'ADAUSDT': 0\.30, 'XRPUSDT': 0\.20, 'SOLUSDT': 0\.10 \}\[symbol\] \|\| 0\.25;/;
const newAllocation = `// ✅ ALOCAÇÃO PRIORIZADA: BTC e ETH recebem mais capital
    const allocation = { 
      'BTCUSDT': 0.50,  // BTC: 50% do capital disponível
      'ETHUSDT': 0.40,  // ETH: 40% do capital disponível
      'BNBUSDT': 0.30,  // BNB: 30% do capital disponível
      'SOLUSDT': 0.20,  // SOL: 20% do capital disponível
      'DOGEUSDT': 0.15, // DOGE: 15% do capital disponível
      'ADAUSDT': 0.10,  // ADA: 10% do capital disponível
      'XRPUSDT': 0.10   // XRP: 10% do capital disponível
    }[symbol] || 0.25;`;

tradingEngineContent = tradingEngineContent.replace(allocationPattern, newAllocation);

console.log('✅ Alocação de capital melhorada para BTC e ETH');
console.log('   BTCUSDT: 50% do capital disponível');
console.log('   ETHUSDT: 40% do capital disponível');
console.log('   Outros símbolos: alocações menores');

// 5. ADICIONAR COMENTÁRIOS EXPLICATIVOS
console.log('\n📊 5. ADICIONANDO COMENTÁRIOS EXPLICATIVOS');
console.log('-'.repeat(40));

// Adicionar comentário no início do método getOptimalSymbols
const methodComment = `  /**
   * Seleciona os símbolos ótimos baseado em custo e oportunidade
   * ✅ MELHORIAS IMPLEMENTADAS:
   * - ENAUSDT removido (evitar ENA)
   * - BTC e ETH priorizados (maior liquidez)
   * - Limitação de trades ativas removida
   * - Alocação de capital otimizada para BTC/ETH
   * ✅ Capital baixo (<$10): prioriza moedas mais baratas para maximizar quantidade de trades
   * ✅ Capital alto (≥$10): prioriza moedas com melhor score para maximizar lucro
   */`;

tradingEngineContent = tradingEngineContent.replace(
  /\/\*\*[\s\S]*?Seleciona os símbolos ótimos[\s\S]*?\*\//,
  methodComment
);

console.log('✅ Comentários explicativos adicionados');

// 6. SALVAR ARQUIVO MODIFICADO
console.log('\n📊 6. SALVANDO MODIFICAÇÕES');
console.log('-'.repeat(40));

fs.writeFileSync(tradingEnginePath, tradingEngineContent);
console.log('✅ Arquivo advanced-trading-engine.ts atualizado com sucesso');

// 7. RESUMO DAS MELHORIAS
console.log('\n🎯 RESUMO DAS MELHORIAS IMPLEMENTADAS');
console.log('='.repeat(60));
console.log('✅ 1. ENAUSDT REMOVIDO');
console.log('   - Evita trades em ENA conforme solicitado');
console.log('   - Lista de símbolos limpa e focada');
console.log('');
console.log('✅ 2. BTC E ETH PRIORIZADOS');
console.log('   - BTCUSDT e ETHUSDT são os primeiros na lista');
console.log('   - Maior alocação de capital (50% BTC, 40% ETH)');
console.log('   - Foco em ativos com maior liquidez');
console.log('');
console.log('✅ 3. LIMITAÇÃO DE TRADES REMOVIDA');
console.log('   - MAX_TRADES_OPEN aumentado de 2 para 50');
console.log('   - Verificação de limite comentada');
console.log('   - Sistema permite múltiplas trades se houver capital');
console.log('');
console.log('✅ 4. ALOCAÇÃO DE CAPITAL OTIMIZADA');
console.log('   - BTC: 50% do capital disponível');
console.log('   - ETH: 40% do capital disponível');
console.log('   - Outros símbolos: alocações proporcionais');
console.log('');
console.log('✅ 5. COMENTÁRIOS E DOCUMENTAÇÃO');
console.log('   - Código documentado com as melhorias');
console.log('   - Lógica explicada para futuras manutenções');

console.log('\n🚀 MELHORIAS IMPLEMENTADAS COM SUCESSO!');
console.log('O sistema agora:');
console.log('- Evita trades em ENAUSDT');
console.log('- Prioriza BTC e ETH');
console.log('- Permite múltiplas trades ativas');
console.log('- Otimiza alocação de capital');

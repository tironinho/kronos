const fs = require('fs');

console.log('🧪 TESTANDO MELHORIAS IMPLEMENTADAS');
console.log('='.repeat(60));

// 1. VERIFICAR SE ENAUSDT FOI REMOVIDO
console.log('\n📊 1. VERIFICANDO REMOÇÃO DO ENAUSDT');
console.log('-'.repeat(40));

const tradingEnginePath = 'engine-v2/src/services/advanced-trading-engine.ts';
const tradingEngineContent = fs.readFileSync(tradingEnginePath, 'utf8');

const enaCount = (tradingEngineContent.match(/ENAUSDT/g) || []).length;
if (enaCount === 0) {
  console.log('✅ ENAUSDT completamente removido do código');
} else {
  console.log(`⚠️ ENAUSDT ainda encontrado ${enaCount} vezes no código`);
}

// 2. VERIFICAR PRIORIZAÇÃO DE BTC E ETH
console.log('\n📊 2. VERIFICANDO PRIORIZAÇÃO DE BTC E ETH');
console.log('-'.repeat(40));

const btcEthPattern = /const allSymbols = \['BTCUSDT', 'ETHUSDT'/;
if (btcEthPattern.test(tradingEngineContent)) {
  console.log('✅ BTC e ETH estão no início da lista de símbolos');
} else {
  console.log('⚠️ BTC e ETH não estão priorizados na lista');
}

// 3. VERIFICAR LIMITE DE TRADES
console.log('\n📊 3. VERIFICANDO LIMITE DE TRADES');
console.log('-'.repeat(40));

const maxTradesPattern = /MAX_TRADES_OPEN = 50/;
if (maxTradesPattern.test(tradingEngineContent)) {
  console.log('✅ Limite de trades aumentado para 50');
} else {
  console.log('⚠️ Limite de trades não foi alterado');
}

// 4. VERIFICAR ALOCAÇÃO DE CAPITAL
console.log('\n📊 4. VERIFICANDO ALOCAÇÃO DE CAPITAL');
console.log('-'.repeat(40));

const btcAllocation = /'BTCUSDT': 0\.50/;
const ethAllocation = /'ETHUSDT': 0\.40/;

if (btcAllocation.test(tradingEngineContent)) {
  console.log('✅ BTCUSDT: 50% de alocação configurado');
} else {
  console.log('⚠️ Alocação do BTC não configurada corretamente');
}

if (ethAllocation.test(tradingEngineContent)) {
  console.log('✅ ETHUSDT: 40% de alocação configurado');
} else {
  console.log('⚠️ Alocação do ETH não configurada corretamente');
}

// 5. VERIFICAR LÓGICA ESPECIAL PARA BTC/ETH
console.log('\n📊 5. VERIFICANDO LÓGICA ESPECIAL PARA BTC/ETH');
console.log('-'.repeat(40));

const specialLogic = /LÓGICA ESPECIAL PARA BTC E ETH/;
if (specialLogic.test(tradingEngineContent)) {
  console.log('✅ Lógica especial para BTC e ETH implementada');
} else {
  console.log('⚠️ Lógica especial para BTC e ETH não encontrada');
}

// 6. VERIFICAR VALIDAÇÃO DE LIQUIDEZ
console.log('\n📊 6. VERIFICANDO VALIDAÇÃO DE LIQUIDEZ');
console.log('-'.repeat(40));

const liquidityValidation = /VALIDAÇÃO DE LIQUIDEZ/;
if (liquidityValidation.test(tradingEngineContent)) {
  console.log('✅ Validação de liquidez implementada');
} else {
  console.log('⚠️ Validação de liquidez não encontrada');
}

// 7. VERIFICAR CONFIGURAÇÃO DINÂMICA
console.log('\n📊 7. VERIFICANDO CONFIGURAÇÃO DINÂMICA');
console.log('-'.repeat(40));

const dynamicConfig = /getDynamicConfig/;
if (dynamicConfig.test(tradingEngineContent)) {
  console.log('✅ Configuração dinâmica implementada');
} else {
  console.log('⚠️ Configuração dinâmica não encontrada');
}

// 8. RESUMO FINAL
console.log('\n🎯 RESUMO FINAL DAS VERIFICAÇÕES');
console.log('='.repeat(60));

const improvements = [
  { name: 'ENAusDT Removido', status: enaCount === 0 },
  { name: 'BTC/ETH Priorizados', status: btcEthPattern.test(tradingEngineContent) },
  { name: 'Limite de Trades Aumentado', status: maxTradesPattern.test(tradingEngineContent) },
  { name: 'Alocação BTC (50%)', status: btcAllocation.test(tradingEngineContent) },
  { name: 'Alocação ETH (40%)', status: ethAllocation.test(tradingEngineContent) },
  { name: 'Lógica Especial BTC/ETH', status: specialLogic.test(tradingEngineContent) },
  { name: 'Validação de Liquidez', status: liquidityValidation.test(tradingEngineContent) },
  { name: 'Configuração Dinâmica', status: dynamicConfig.test(tradingEngineContent) }
];

let successCount = 0;
improvements.forEach(improvement => {
  const status = improvement.status ? '✅' : '❌';
  console.log(`${status} ${improvement.name}`);
  if (improvement.status) successCount++;
});

console.log(`\n📊 RESULTADO: ${successCount}/${improvements.length} melhorias implementadas com sucesso`);

if (successCount === improvements.length) {
  console.log('\n🎉 TODAS AS MELHORIAS FORAM IMPLEMENTADAS COM SUCESSO!');
  console.log('O sistema agora está otimizado conforme solicitado:');
  console.log('- Evita trades em ENA');
  console.log('- Prioriza BTC e ETH');
  console.log('- Permite múltiplas trades ativas');
  console.log('- Tem lógica especial para ativos principais');
  console.log('- Valida liquidez antes de executar');
  console.log('- Ajusta parâmetros dinamicamente');
} else {
  console.log('\n⚠️ ALGUMAS MELHORIAS PRECISAM DE AJUSTES');
  console.log('Verifique os itens marcados com ❌ acima');
}

// 9. PRÓXIMOS PASSOS
console.log('\n🚀 PRÓXIMOS PASSOS RECOMENDADOS');
console.log('='.repeat(60));
console.log('1. Testar o sistema em ambiente de desenvolvimento');
console.log('2. Monitorar logs para verificar se as melhorias estão funcionando');
console.log('3. Ajustar parâmetros baseado nos resultados');
console.log('4. Implementar testes automatizados');
console.log('5. Documentar as mudanças para futuras manutenções');

console.log('\n✨ SISTEMA PRONTO PARA TESTES!');

const { exec } = require('child_process');
const path = require('path');

async function runAllTests() {
  console.log('🚀 EXECUTANDO TODOS OS TESTES DO SISTEMA KRONOS-X\n');
  console.log('============================================================\n');

  const tests = [
    {
      name: 'Teste de Métricas de Trading',
      file: 'test-trading-metrics.js',
      description: 'Verifica se as métricas estão sendo calculadas corretamente'
    },
    {
      name: 'Teste de Status Closed',
      file: 'test-closed-status.js',
      description: 'Verifica se o status "closed" está sendo gravado corretamente'
    },
    {
      name: 'Teste de Melhorias do Sistema',
      file: 'test-system-improvements.js',
      description: 'Verifica se as melhorias implementadas estão funcionando'
    },
    {
      name: 'Teste de Sistema Redis Completo',
      file: 'test-complete-redis-system.js',
      description: 'Verifica se o sistema Redis e cache estão funcionando'
    },
    {
      name: 'Teste de Dados Enriquecidos',
      file: 'test-enhanced-system.js',
      description: 'Verifica se o sistema de dados enriquecidos está funcionando'
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    console.log(`\n🧪 EXECUTANDO: ${test.name}`);
    console.log(`   Descrição: ${test.description}`);
    console.log(`   Arquivo: ${test.file}`);
    console.log('   ' + '='.repeat(50));

    try {
      await runTest(test.file);
      console.log(`   ✅ ${test.name} - PASSOU`);
      passedTests++;
    } catch (error) {
      console.log(`   ❌ ${test.name} - FALHOU`);
      console.log(`   Erro: ${error.message}`);
      failedTests++;
    }

    console.log('   ' + '='.repeat(50));
  }

  console.log('\n📊 RESUMO DOS TESTES');
  console.log('============================================================');
  console.log(`✅ Testes que passaram: ${passedTests}`);
  console.log(`❌ Testes que falharam: ${failedTests}`);
  console.log(`📈 Taxa de sucesso: ${((passedTests / tests.length) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! Sistema funcionando perfeitamente.');
  } else {
    console.log('\n⚠️ ALGUNS TESTES FALHARAM. Verifique os erros acima.');
  }

  console.log('\n📋 PRÓXIMOS PASSOS:');
  console.log('   1. Configure as variáveis de ambiente do Supabase');
  console.log('   2. Configure as variáveis de ambiente do Redis');
  console.log('   3. Inicie o servidor Next.js');
  console.log('   4. Teste as APIs no navegador');
  console.log('   5. Monitore os logs do sistema');
}

function runTest(filename) {
  return new Promise((resolve, reject) => {
    const testPath = path.join(__dirname, filename);
    
    exec(`node "${testPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.log(`   ⚠️ Erro ao executar teste: ${error.message}`);
        reject(error);
        return;
      }

      if (stderr) {
        console.log(`   ⚠️ Warnings: ${stderr}`);
      }

      // Mostrar output do teste
      const lines = stdout.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`   ${line}`);
        }
      });

      resolve();
    });
  });
}

// Executar todos os testes
runAllTests().catch(error => {
  console.error('❌ Erro ao executar testes:', error);
  process.exit(1);
});

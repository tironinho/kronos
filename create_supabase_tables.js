// Script para criar tabelas no Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  try {
    console.log('🔍 Lendo arquivo SQL...');
    const sqlFile = path.join(__dirname, 'supabase-setup.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Divide o SQL em comandos individuais
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    console.log(`📝 Executando ${commands.length} comandos SQL...\n`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Pula comentários
      if (command.startsWith('--')) {
        console.log(`   [${i + 1}/${commands.length}] ⏭️  Puleando comentário`);
        continue;
      }

      try {
        console.log(`   [${i + 1}/${commands.length}] Executando...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: command });
        
        // Se não funcionar com rpc, tenta outra abordagem
        if (error) {
          console.log(`      ⚠️  Tentei RPC, vou usar query direta...`);
          
          // Tenta executar direto via query builder se for INSERT/CREATE
          if (command.toUpperCase().includes('CREATE TABLE')) {
            console.log(`      ℹ️  Criando tabela...`);
            // Note: Supabase JS não suporta execução direta de SQL arbitrário
            // Usaremos o dashboard do Supabase para isso
            console.log(`      ⚠️  Execute manualmente no Supabase Dashboard`);
          }
        } else {
          console.log(`      ✅ Comando executado`);
        }
      } catch (err) {
        console.log(`      ⚠️  Erro: ${err.message}`);
      }
    }

    console.log('\n✅ Processo concluído!');
    console.log('\n📌 PRÓXIMOS PASSOS:');
    console.log('   1. Acesse: https://supabase.com/dashboard');
    console.log('   2. Vá para "SQL Editor" no seu projeto');
    console.log('   3. Cole o conteúdo de supabase-setup.sql');
    console.log('   4. Execute o SQL');
    console.log('   5. As tabelas estarão criadas!');

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

createTables();


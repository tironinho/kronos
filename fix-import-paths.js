const fs = require('fs');
const path = require('path');

function fixImportPaths() {
  console.log('🔧 CORRIGINDO CAMINHOS DE IMPORTAÇÃO...\n');

  const apiDir = path.join(__dirname, 'src', 'app', 'api');
  
  function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        processDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        processFile(filePath);
      }
    });
  }
  
  function processFile(filePath) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      // Padrões de importação para corrigir
      const patterns = [
        {
          from: /from ['"]\.\.\/\.\.\/\.\.\/services\//g,
          to: "from '@/services/"
        },
        {
          from: /from ['"]\.\.\/\.\.\/\.\.\/\.\.\/services\//g,
          to: "from '@/services/"
        },
        {
          from: /from ['"]\.\.\/\.\.\/services\//g,
          to: "from '@/services/"
        },
        {
          from: /from ['"]\.\.\/services\//g,
          to: "from '@/services/"
        },
        {
          from: /from ['"]\.\.\/\.\.\/\.\.\/config/g,
          to: "from '@/config"
        },
        {
          from: /from ['"]\.\.\/\.\.\/config/g,
          to: "from '@/config"
        },
        {
          from: /from ['"]\.\.\/config/g,
          to: "from '@/config"
        }
      ];
      
      patterns.forEach(pattern => {
        if (pattern.from.test(content)) {
          content = content.replace(pattern.from, pattern.to);
          modified = true;
        }
      });
      
      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Corrigido: ${path.relative(__dirname, filePath)}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${filePath}:`, error.message);
    }
  }
  
  if (fs.existsSync(apiDir)) {
    processDirectory(apiDir);
    console.log('\n✅ CORREÇÃO CONCLUÍDA!');
  } else {
    console.log('❌ Diretório API não encontrado');
  }
}

fixImportPaths();

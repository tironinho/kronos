import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  data?: any;
  stack?: string;
}

export class Logger {
  private static instance: Logger;
  private logFile: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private maxFiles: number = 5;
  private isInitialized: boolean = false;

  private constructor() {
    this.logFile = path.join(process.cwd(), 'logs.txt');
    this.initializeLogFile();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initializeLogFile() {
    try {
      // Criar diretório se não existir
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Criar arquivo de log se não existir
      if (!fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '');
      }

      // Adicionar cabeçalho se arquivo estiver vazio
      const stats = fs.statSync(this.logFile);
      if (stats.size === 0) {
        this.writeHeader();
      }

      this.isInitialized = true;
      console.log(`✅ Logger: Initialized - Log file: ${this.logFile}`);
    } catch (error) {
      console.error('❌ Logger: Failed to initialize:', error);
    }
  }

  private writeHeader() {
    const header = `# ============================================================================
# KRONOS-X TRADING ENGINE - LOG FILE
# ============================================================================
# Started: ${new Date().toISOString()}
# Log Level: DEBUG, INFO, WARN, ERROR, CRITICAL
# Format: [TIMESTAMP] [LEVEL] [COMPONENT] MESSAGE
# ============================================================================

`;
    fs.appendFileSync(this.logFile, header);
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp;
    const level = entry.level.padEnd(8);
    const component = entry.component ? `[${entry.component}]` : '[SYSTEM]';
    const message = entry.message;
    
    let logLine = `[${timestamp}] ${level} ${component} ${message}`;
    
    if (entry.data) {
      logLine += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
    }
    
    if (entry.stack) {
      logLine += `\n  Stack: ${entry.stack}`;
    }
    
    return logLine + '\n';
  }

  private writeToFile(entry: LogEntry) {
    if (!this.isInitialized) {
      return;
    }

    try {
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, logLine);
      
      // Verificar tamanho do arquivo e fazer rotação se necessário
      this.checkAndRotateLogFile();
    } catch (error) {
      console.error('❌ Logger: Failed to write to log file:', error);
    }
  }

  private checkAndRotateLogFile() {
    try {
      const stats = fs.statSync(this.logFile);
      
      if (stats.size > this.maxFileSize) {
        this.rotateLogFile();
      }
    } catch (error) {
      console.error('❌ Logger: Failed to check log file size:', error);
    }
  }

  private rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = `${this.logFile}.${timestamp}`;
      
      // Renomear arquivo atual
      fs.renameSync(this.logFile, rotatedFile);
      
      // Criar novo arquivo
      this.writeHeader();
      
      // Remover arquivos antigos
      this.cleanupOldLogFiles();
      
      console.log(`📁 Logger: Log file rotated - ${rotatedFile}`);
    } catch (error) {
      console.error('❌ Logger: Failed to rotate log file:', error);
    }
  }

  private cleanupOldLogFiles() {
    try {
      const logDir = path.dirname(this.logFile);
      const files = fs.readdirSync(logDir)
        .filter(file => file.startsWith('logs.txt.'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stats: fs.statSync(path.join(logDir, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Manter apenas os arquivos mais recentes
      if (files.length > this.maxFiles) {
        const filesToDelete = files.slice(this.maxFiles);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Logger: Deleted old log file - ${file.name}`);
        });
      }
    } catch (error) {
      console.error('❌ Logger: Failed to cleanup old log files:', error);
    }
  }

  private log(level: LogLevel, message: string, component?: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      data
    };

    if (error) {
      entry.stack = error.stack;
    }

    // Escrever no arquivo
    this.writeToFile(entry);

    // Também escrever no console com cores
    this.writeToConsole(entry);
  }

  private writeToConsole(entry: LogEntry) {
    const timestamp = entry.timestamp;
    const level = entry.level;
    const component = entry.component ? `[${entry.component}]` : '[SYSTEM]';
    const message = entry.message;

    let consoleMessage = `[${timestamp}] ${level} ${component} ${message}`;

    // Aplicar cores baseadas no nível
    switch (level) {
      case LogLevel.DEBUG:
        console.log(`🔍 ${consoleMessage}`);
        break;
      case LogLevel.INFO:
        console.log(`📊 ${consoleMessage}`);
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${consoleMessage}`);
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${consoleMessage}`);
        break;
      case LogLevel.CRITICAL:
        console.error(`🚨 ${consoleMessage}`);
        break;
    }

    if (entry.data) {
      console.log(`  Data:`, entry.data);
    }

    if (entry.stack) {
      console.error(`  Stack:`, entry.stack);
    }
  }

  // Métodos públicos para diferentes níveis de log
  public debug(message: string, component?: string, data?: any) {
    this.log(LogLevel.DEBUG, message, component, data);
  }

  public info(message: string, component?: string, data?: any) {
    this.log(LogLevel.INFO, message, component, data);
  }

  public warn(message: string, component?: string, data?: any) {
    this.log(LogLevel.WARN, message, component, data);
  }

  public error(message: string, component?: string, data?: any, error?: Error) {
    this.log(LogLevel.ERROR, message, component, data, error);
  }

  public critical(message: string, component?: string, data?: any, error?: Error) {
    this.log(LogLevel.CRITICAL, message, component, data, error);
  }

  // Métodos específicos para componentes do sistema
  public trading(message: string, data?: any) {
    this.info(message, 'TRADING', data);
  }

  public binance(message: string, data?: any) {
    this.info(message, 'BINANCE', data);
  }

  public supabase(message: string, data?: any) {
    this.info(message, 'SUPABASE', data);
  }

  public monitoring(message: string, data?: any) {
    this.info(message, 'MONITORING', data);
  }

  public alert(message: string, data?: any) {
    this.warn(message, 'ALERT', data);
  }

  public performance(message: string, data?: any) {
    this.info(message, 'PERFORMANCE', data);
  }

  // Métodos utilitários
  public getLogFile(): string {
    return this.logFile;
  }

  public getLogStats() {
    try {
      const stats = fs.statSync(this.logFile);
      return {
        file: this.logFile,
        size: stats.size,
        lastModified: stats.mtime,
        exists: true
      };
    } catch (error) {
      return {
        file: this.logFile,
        size: 0,
        lastModified: null,
        exists: false
      };
    }
  }

  public clearLogs() {
    try {
      fs.writeFileSync(this.logFile, '');
      this.writeHeader();
      console.log('🧹 Logger: Log file cleared');
    } catch (error) {
      console.error('❌ Logger: Failed to clear log file:', error);
    }
  }

  public readLogs(lines: number = 100): string[] {
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const logLines = content.split('\n');
      return logLines.slice(-lines);
    } catch (error) {
      console.error('❌ Logger: Failed to read log file:', error);
      return [];
    }
  }
}

// Instância singleton
export const logger = Logger.getInstance();

// Função de conveniência para substituir console.log
export function log(message: string, component?: string, data?: any) {
  logger.info(message, component, data);
}

// Função para logs de erro
export function logError(message: string, error?: Error, component?: string, data?: any) {
  logger.error(message, component, data, error);
}

// Função para logs de trading
export function logTrading(message: string, data?: any) {
  logger.trading(message, data);
}

// Função para logs de Binance
export function logBinance(message: string, data?: any) {
  logger.binance(message, data);
}

// Função para logs de Supabase
export function logSupabase(message: string, data?: any) {
  logger.supabase(message, data);
}

// Função para logs de monitoramento
export function logMonitoring(message: string, data?: any) {
  logger.monitoring(message, data);
}

// Função para logs de alertas
export function logAlert(message: string, data?: any) {
  logger.alert(message, data);
}

// Função para logs de performance
export function logPerformance(message: string, data?: any) {
  logger.performance(message, data);
}

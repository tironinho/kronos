// ============================================================================
// UTILITÁRIOS BASE DO SISTEMA KRONOS-X
// ============================================================================

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import _ from 'lodash';

// ============================================================================
// CRYPTO UTILITIES
// ============================================================================

export class CryptoUtils {
  /**
   * Gera assinatura HMAC SHA256 para autenticação Binance
   */
  static generateSignature(queryString: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(queryString).digest('hex');
  }

  /**
   * Gera timestamp atual em milissegundos
   */
  static getTimestamp(): number {
    return Date.now();
  }

  /**
   * Gera ID único para trades e sinais
   */
  static generateId(): string {
    return uuidv4();
  }

  /**
   * Gera ID único (alias para generateId)
   */
  static generateUniqueId(): string {
    return uuidv4();
  }

  /**
   * Criptografa dados sensíveis
   */
  static encrypt(text: string, key: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Descriptografa dados sensíveis
   */
  static decrypt(encryptedText: string, key: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

export class MathUtils {
  /**
   * Calcula média móvel simples
   */
  static simpleMovingAverage(values: number[], period: number): number[] {
    if (values.length < period) return [];
    
    const result: number[] = [];
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  /**
   * Calcula média móvel exponencial
   */
  static exponentialMovingAverage(values: number[], period: number): number[] {
    if (values.length < period) return [];
    
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Primeiro valor é a média simples
    const firstSMA = this.simpleMovingAverage(values.slice(0, period), period)[0];
    result.push(firstSMA);
    
    for (let i = period; i < values.length; i++) {
      const ema = (values[i] * multiplier) + (result[result.length - 1] * (1 - multiplier));
      result.push(ema);
    }
    
    return result;
  }

  /**
   * Calcula desvio padrão
   */
  static standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calcula z-score
   */
  static zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Calcula correlação de Pearson
   */
  static correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calcula percentil
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    
    if (Number.isInteger(index)) {
      return sorted[index];
    }
    
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Calcula volatilidade (desvio padrão dos retornos)
   */
  static volatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    return this.standardDeviation(returns) * Math.sqrt(252); // Anualizado
  }

  /**
   * Calcula Sharpe Ratio
   */
  static sharpeRatio(returns: number[], riskFreeRate: number = 0): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = this.standardDeviation(returns);
    
    return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev;
  }

  /**
   * Calcula máximo drawdown
   */
  static maxDrawdown(prices: number[]): number {
    if (prices.length === 0) return 0;
    
    let maxPrice = prices[0];
    let maxDD = 0;
    
    for (const price of prices) {
      if (price > maxPrice) {
        maxPrice = price;
      }
      const drawdown = (maxPrice - price) / maxPrice;
      maxDD = Math.max(maxDD, drawdown);
    }
    
    return maxDD;
  }
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

export class TimeUtils {
  /**
   * Converte timestamp para formato legível
   */
  static formatTimestamp(timestamp: number): string {
    return moment(timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');
  }

  /**
   * Converte timestamp para ISO string
   */
  static toISOString(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Obtém timestamp atual
   */
  static now(): number {
    return Date.now();
  }

  /**
   * Obtém timestamp de N minutos atrás
   */
  static minutesAgo(minutes: number): number {
    return Date.now() - (minutes * 60 * 1000);
  }

  /**
   * Obtém timestamp de N horas atrás
   */
  static hoursAgo(hours: number): number {
    return Date.now() - (hours * 60 * 60 * 1000);
  }

  /**
   * Obtém timestamp de N dias atrás
   */
  static daysAgo(days: number): number {
    return Date.now() - (days * 24 * 60 * 60 * 1000);
  }

  /**
   * Verifica se timestamp está dentro do período especificado
   */
  static isWithinPeriod(timestamp: number, periodMs: number): boolean {
    return (Date.now() - timestamp) <= periodMs;
  }

  /**
   * Calcula diferença em milissegundos entre dois timestamps
   */
  static diffMs(timestamp1: number, timestamp2: number): number {
    return Math.abs(timestamp1 - timestamp2);
  }

  /**
   * Converte milissegundos para formato legível
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export class ValidationUtils {
  /**
   * Valida se string não está vazia
   */
  static isNotEmpty(value: string): boolean {
    return value && value.trim().length > 0;
  }

  /**
   * Valida se número é positivo
   */
  static isPositive(value: number): boolean {
    return value > 0;
  }

  /**
   * Valida se número está dentro do range
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  /**
   * Valida se email é válido
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida se símbolo de trading é válido
   */
  static isValidSymbol(symbol: string): boolean {
    const symbolRegex = /^[A-Z]{3,10}[A-Z]{3,10}$/;
    return symbolRegex.test(symbol);
  }

  /**
   * Valida se timestamp é válido
   */
  static isValidTimestamp(timestamp: number): boolean {
    return timestamp > 0 && timestamp < 4102444800000; // Ano 2100
  }

  /**
   * Valida configuração de trading
   */
  static validateTradingConfig(config: any): boolean {
    return (
      config &&
      typeof config.max_position_size === 'number' &&
      config.max_position_size > 0 &&
      typeof config.risk_per_trade === 'number' &&
      config.risk_per_trade > 0 &&
      config.risk_per_trade <= 1 &&
      typeof config.stop_loss_percentage === 'number' &&
      config.stop_loss_percentage > 0 &&
      config.stop_loss_percentage <= 100
    );
  }
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

export class ArrayUtils {
  /**
   * Remove duplicatas de array
   */
  static unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  /**
   * Chunk array em pedaços menores
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Agrupa array por chave
   */
  static groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<K, T[]>);
  }

  /**
   * Ordena array por chave específica
   */
  static sortBy<T>(array: T[], keyFn: (item: T) => number | string): T[] {
    return [...array].sort((a, b) => {
      const aVal = keyFn(a);
      const bVal = keyFn(b);
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
      return 0;
    });
  }

  /**
   * Obtém último elemento do array
   */
  static last<T>(array: T[]): T | undefined {
    return array[array.length - 1];
  }

  /**
   * Obtém primeiro elemento do array
   */
  static first<T>(array: T[]): T | undefined {
    return array[0];
  }

  /**
   * Calcula soma de array numérico
   */
  static sum(array: number[]): number {
    return array.reduce((a, b) => a + b, 0);
  }

  /**
   * Calcula média de array numérico
   */
  static average(array: number[]): number {
    return array.length === 0 ? 0 : this.sum(array) / array.length;
  }

  /**
   * Encontra índice do elemento com maior valor
   */
  static maxIndex(array: number[]): number {
    if (array.length === 0) return -1;
    return array.indexOf(Math.max(...array));
  }

  /**
   * Encontra índice do elemento com menor valor
   */
  static minIndex(array: number[]): number {
    if (array.length === 0) return -1;
    return array.indexOf(Math.min(...array));
  }
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

export class ObjectUtils {
  /**
   * Deep clone de objeto
   */
  static deepClone<T>(obj: T): T {
    return _.cloneDeep(obj);
  }

  /**
   * Merge profundo de objetos
   */
  static deepMerge<T>(target: T, source: Partial<T>): T {
    return _.merge(target, source);
  }

  /**
   * Remove propriedades undefined/null
   */
  static clean<T>(obj: T): T {
    return _.pickBy(obj, (value) => value !== undefined && value !== null) as T;
  }

  /**
   * Verifica se objeto está vazio
   */
  static isEmpty(obj: any): boolean {
    return _.isEmpty(obj);
  }

  /**
   * Obtém valor aninhado com fallback
   */
  static get<T>(obj: any, path: string, defaultValue?: T): T {
    return _.get(obj, path, defaultValue);
  }

  /**
   * Define valor aninhado
   */
  static set(obj: any, path: string, value: any): void {
    _.set(obj, path, value);
  }

  /**
   * Verifica se objeto tem propriedade aninhada
   */
  static has(obj: any, path: string): boolean {
    return _.has(obj, path);
  }

  /**
   * Omit propriedades específicas
   */
  static omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    return _.omit(obj, keys);
  }

  /**
   * Pick propriedades específicas
   */
  static pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    return _.pick(obj, keys);
  }
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

export class StringUtils {
  /**
   * Capitaliza primeira letra
   */
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Converte para camelCase
   */
  static toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Converte para kebab-case
   */
  static toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Converte para snake_case
   */
  static toSnakeCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  /**
   * Trunca string com ellipsis
   */
  static truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.substring(0, length - 3) + '...';
  }

  /**
   * Remove caracteres especiais
   */
  static sanitize(str: string): string {
    return str.replace(/[^a-zA-Z0-9\s]/g, '');
  }

  /**
   * Gera string aleatória
   */
  static random(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Verifica se string contém apenas números
   */
  static isNumeric(str: string): boolean {
    return /^\d+$/.test(str);
  }

  /**
   * Formata número com separadores
   */
  static formatNumber(num: number, decimals: number = 2): string {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Formata porcentagem
   */
  static formatPercentage(num: number, decimals: number = 2): string {
    return `${(num * 100).toFixed(decimals)}%`;
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

export class ErrorUtils {
  /**
   * Cria erro customizado
   */
  static createError(message: string, code?: string, statusCode?: number): Error {
    const error = new Error(message);
    if (code) (error as any).code = code;
    if (statusCode) (error as any).statusCode = statusCode;
    return error;
  }

  /**
   * Verifica se erro é de timeout
   */
  static isTimeoutError(error: any): boolean {
    return error.code === 'ETIMEDOUT' || error.message?.includes('timeout');
  }

  /**
   * Verifica se erro é de conexão
   */
  static isConnectionError(error: any): boolean {
    return error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
  }

  /**
   * Obtém stack trace limpo
   */
  static getCleanStackTrace(error: Error): string {
    return error.stack?.split('\n').slice(0, 10).join('\n') || '';
  }

  /**
   * Formata erro para logging
   */
  static formatForLogging(error: any): Record<string, any> {
    return {
      message: error.message || 'Unknown error',
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      timestamp: Date.now()
    };
  }
}

// ============================================================================
// PROMISE UTILITIES
// ============================================================================

export class PromiseUtils {
  /**
   * Timeout para Promise
   */
  static withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
      })
    ]);
  }

  /**
   * Retry com backoff exponencial
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Executa promises em paralelo com limite
   */
  static async parallelLimit<T>(
    promises: (() => Promise<T>)[],
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const promiseFn of promises) {
      const promise = promiseFn().then(result => {
        results.push(result);
      });
      
      executing.push(promise);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p === promise), 1);
      }
    }
    
    await Promise.all(executing);
    return results;
  }

  /**
   * Debounce para funções assíncronas
   */
  static debounce<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    delayMs: number
  ): T {
    let timeoutId: NodeJS.Timeout;
    
    return ((...args: any[]) => {
      return new Promise((resolve, reject) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            const result = await fn(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delayMs);
      });
    }) as T;
  }
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

// Export direct utility functions for easy import
export const generateUniqueId = CryptoUtils.generateUniqueId;

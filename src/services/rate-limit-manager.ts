// ============================================================================
// RATE LIMIT MANAGER - Previne ban e monitora limites da Binance
// ============================================================================

import axios, { AxiosResponse } from 'axios';

export interface RateLimitInfo {
  header: string;
  used: number;
  max: number;
  remaining: number;
  percentage: number;
}

export class RateLimitManager {
  private static instance: RateLimitManager;
  private usedWeight: Map<string, number> = new Map();
  private orderCount: Map<string, number> = new Map();
  private banStatus: boolean = false;
  private blocked: boolean = false;
  private blockUntil: number = 0;
  private listener?: (info: RateLimitInfo[]) => void;

  private constructor() {}

  public static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager();
    }
    return RateLimitManager.instance;
  }

  /**
   * Verifica rate limits de uma resposta da API
   */
  checkRateLimit(response: AxiosResponse): void {
    // Ler todos os headers X-MBX-USED-WEIGHT-*
    const weightHeaders = Object.keys(response.headers)
      .filter(h => h.startsWith('x-mbx-used-weight-'));

    const limitInfo: RateLimitInfo[] = [];

    weightHeaders.forEach(header => {
      const used = parseInt(response.headers[header] || '0');
      const max = this.getMaxForInterval(header);
      
      this.usedWeight.set(header, used);
      
      const remaining = max - used;
      const percentage = (used / max) * 100;

      limitInfo.push({
        header,
        used,
        max,
        remaining,
        percentage
      });

      // Alerta se próximo do limite (80%)
      if (percentage > 80) {
        console.warn(`⚠️ Rate limit alto: ${header} = ${used}/${max} (${percentage.toFixed(1)}%)`);
      }

      // Bloqueia se > 95%
      if (percentage > 95) {
        console.error(`🚨 Rate limit crítico: ${header} = ${percentage.toFixed(1)}%`);
        this.blockTemporarily(60000); // 1 minuto
      }
    });

    // Ler X-MBX-ORDER-COUNT-*
    const orderHeaders = Object.keys(response.headers)
      .filter(h => h.startsWith('x-mbx-order-count-'));

    orderHeaders.forEach(header => {
      const used = parseInt(response.headers[header] || '0');
      this.orderCount.set(header, used);
      
      console.log(`📊 Order Count ${header}: ${used}`);
    });

    // Notifica listener
    if (this.listener && limitInfo.length > 0) {
      this.listener(limitInfo);
    }

    // Tratar status 429 (Too Many Requests)
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers['retry-after'] || '60');
      console.error(`🛑 HTTP 429 - Rate limit atingido! Aguardar ${retryAfter}s`);
      
      // Busca o peso usado mais alto
      const maxUsed = Math.max(...Array.from(this.usedWeight.values()));
      const maxOrderCount = Math.max(...Array.from(this.orderCount.values()));
      
      console.error(`   Weight usado: ${maxUsed}`);
      console.error(`   Order count: ${maxOrderCount}`);
      console.error(`   Bloqueando requests por ${retryAfter} segundos...`);
      
      this.blockTemporarily(retryAfter * 1000);
    }

    // Tratar status 418 (IP Ban)
    if (response.status === 418) {
      console.error('🚨🚨🚨 IP BANIDO pela Binance! 🚨🚨🚨');
      console.error('   Seu IP foi bloqueado temporariamente (2min - 3 dias)');
      console.error('   Sistema será interrompido automaticamente');
      
      this.banStatus = true;
      this.blockPermanently();
      
      // Emitir evento de emergência
      this.emergencyStop();
    }
  }

  /**
   * Retorna max para cada intervalo
   */
  private getMaxForInterval(header: string): number {
    if (header.includes('-1s-') || header.includes('-1S-')) return 1200;
    if (header.includes('-2s-') || header.includes('-2S-')) return 2400;
    if (header.includes('-5s-') || header.includes('-5S-')) return 6000;
    if (header.includes('-1m-') || header.includes('-1M-')) return 24000;
    if (header.includes('-2m-') || header.includes('-2M-')) return 48000;
    if (header.includes('-5m-') || header.includes('-5M-')) return 120000;
    if (header.includes('-10m-') || header.includes('-10M-')) return 240000;
    if (header.includes('-60s-') || header.includes('-60S-')) return 72000;
    
    return 1000; // Padrão conservador
  }

  /**
   * Bloqueia temporariamente (em milissegundos)
   */
  private blockTemporarily(ms: number): void {
    this.blocked = true;
    this.blockUntil = Date.now() + ms;

    console.warn(`🔒 Requisições bloqueadas até ${new Date(this.blockUntil).toLocaleTimeString()}`);

    setTimeout(() => {
      this.blocked = false;
      console.log('✅ Bloqueio removido, requisições liberadas');
    }, ms);
  }

  /**
   * Bloqueia permanentemente (IP banido)
   */
  private blockPermanently(): void {
    this.blocked = true;
    this.blockUntil = Infinity;
  }

  /**
   * Emergência: parar todo o sistema
   */
  private emergencyStop(): void {
    // Emitir evento global de emergência
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('BINANCE_IP_BANNED', {
        detail: {
          timestamp: Date.now(),
          weight: Array.from(this.usedWeight.entries()),
          orderCount: Array.from(this.orderCount.entries())
        }
      }));
    }

    // Log crítico
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('🚨 EMERGÊNCIA: IP BANIDO');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('AÇÃO NECESSÁRIA:');
    console.error('1. Parar trading imediatamente');
    console.error('2. Aguardar 2 minutos - 3 dias');
    console.error('3. Usar IP diferente ou VPN');
    console.error('4. Reduzir frequência de requests');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Verifica se é operação CRÍTICA de fechamento (nunca bloquear)
   * Whitelist: POST /fapi/v1/order com reduceOnly=true
   */
  isCriticalOperation(url?: string, method?: string, data?: any): boolean {
    if (!url) return false;
    
    // Ordem de fechamento em Futures
    const isFuturesOrder = url.includes('/fapi/v1/order') && method?.toUpperCase() === 'POST';
    
    if (isFuturesOrder) {
      // Verificar se tem reduceOnly=true nos dados
      const hasReduceOnly = 
        (typeof data === 'object' && data?.reduceOnly === true) ||
        (typeof data === 'string' && data.includes('reduceOnly=true'));
      
      return hasReduceOnly;
    }
    
    // Verificação de posição para fechar
    const isPositionCheck = url.includes('/fapi/v2/positionRisk') && method?.toUpperCase() === 'GET';
    
    return isPositionCheck;
  }

  /**
   * Verifica se deve bloquear request
   */
  shouldBlock(url?: string, method?: string, data?: any): boolean {
    if (this.banStatus) {
      // Mesmo em ban, permitir fechamentos críticos
      if (this.isCriticalOperation(url, method, data)) {
        return false;
      }
      return true;
    }

    if (this.blocked && Date.now() < this.blockUntil) {
      // Em bloqueio, permitir apenas operações críticas
      if (this.isCriticalOperation(url, method, data)) {
        console.log('✅ Permitindo operação CRÍTICA de fechamento apesar de bloqueio');
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Retorna tempo até poder fazer request
   */
  getBlockTimeRemaining(): number {
    if (!this.blocked) return 0;
    if (this.banStatus) return Infinity;
    
    const remaining = this.blockUntil - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Retorna informações de rate limit
   */
  getRateLimitInfo(): RateLimitInfo[] {
    const info: RateLimitInfo[] = [];

    this.usedWeight.forEach((used, header) => {
      const max = this.getMaxForInterval(header);
      const remaining = max - used;
      const percentage = (used / max) * 100;

      info.push({
        header,
        used,
        max,
        remaining,
        percentage
      });
    });

    return info;
  }

  /**
   * Retorna order count info
   */
  getOrderCountInfo(): Map<string, number> {
    return new Map(this.orderCount);
  }

  /**
   * Reset estatísticas
   */
  reset(): void {
    this.usedWeight.clear();
    this.orderCount.clear();
    this.banStatus = false;
    this.blocked = false;
    this.blockUntil = 0;
  }

  /**
   * Define listener para mudanças de rate limit
   */
  setListener(listener: (info: RateLimitInfo[]) => void): void {
    this.listener = listener;
  }

  /**
   * Retorna status de ban
   */
  isBanned(): boolean {
    return this.banStatus;
  }

  /**
   * Retorna se está bloqueado
   */
  isBlocked(): boolean {
    return this.shouldBlock();
  }
}

export const rateLimitManager = RateLimitManager.getInstance();


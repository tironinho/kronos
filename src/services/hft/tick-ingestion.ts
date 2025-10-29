/**
 * Tick-by-Tick Data Ingestion
 * 
 * Ingestão de dados tick-by-tick com:
 * - Sincronização NTP
 * - Timestamps precisos
 * - Desduplicação
 * - Validação de latência
 */

export interface Tick {
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: number; // Unix timestamp em ms
  exchangeTimestamp: number;
  sequenceId: number;
  tradeId: string;
}

export interface TickBuffer {
  ticks: Tick[];
  lastSequenceId: Map<string, number>;
  clockOffset: number; // Offset entre relógio local e exchange (ms)
}

export class TickIngestionEngine {
  private static instance: TickIngestionEngine;
  private buffers: Map<string, TickBuffer> = new Map();
  private clockSync: ClockSynchronizer;
  private heartbeatMonitor: HeartbeatMonitor;
  private readonly MAX_BUFFER_SIZE = 10000;
  private readonly MAX_LATENCY_MS = 100;

  private constructor() {
    this.clockSync = new ClockSynchronizer();
    this.heartbeatMonitor = new HeartbeatMonitor();
    this.startClockSync();
  }

  public static getInstance(): TickIngestionEngine {
    if (!TickIngestionEngine.instance) {
      TickIngestionEngine.instance = new TickIngestionEngine();
    }
    return TickIngestionEngine.instance;
  }

  /**
   * Inicia sincronização de relógio com NTP
   */
  private async startClockSync(): Promise<void> {
    // Sincronizar a cada 60 segundos
    setInterval(async () => {
      await this.clockSync.sync();
    }, 60000);
    
    // Sincronização inicial
    await this.clockSync.sync();
  }

  /**
   * Processa tick recebido
   */
  public async ingestTick(rawTick: any, symbol: string): Promise<Tick | null> {
    try {
      // Validar dados básicos
      if (!rawTick || !rawTick.p || !rawTick.q) {
        return null;
      }

      // Obter timestamp ajustado
      const exchangeTimestamp = rawTick.T || Date.now();
      const localTimestamp = Date.now();
      const clockOffset = this.clockSync.getOffset();
      const adjustedTimestamp = localTimestamp - clockOffset;

      // Validar latência
      const latency = localTimestamp - exchangeTimestamp;
      if (latency > this.MAX_LATENCY_MS) {
        console.warn(`⚠️ Tick ${symbol} com latência alta: ${latency}ms`);
        // Não rejeitar, mas logar
      }

      // Criar tick normalizado
      const tick: Tick = {
        symbol,
        price: parseFloat(rawTick.p),
        quantity: parseFloat(rawTick.q),
        side: rawTick.m === true ? 'SELL' : 'BUY', // m=true significa maker é sell
        timestamp: adjustedTimestamp,
        exchangeTimestamp,
        sequenceId: rawTick.e || 0,
        tradeId: rawTick.t?.toString() || `${symbol}_${exchangeTimestamp}`
      };

      // Verificar duplicatas
      const buffer = this.getOrCreateBuffer(symbol);
      if (this.isDuplicate(buffer, tick)) {
        return null; // Duplicata
      }

      // Adicionar ao buffer
      buffer.ticks.push(tick);
      buffer.lastSequenceId.set(symbol, tick.sequenceId);

      // Limitar tamanho do buffer
      if (buffer.ticks.length > this.MAX_BUFFER_SIZE) {
        buffer.ticks = buffer.ticks.slice(-this.MAX_BUFFER_SIZE);
      }

      // Heartbeat
      this.heartbeatMonitor.recordTick(symbol, adjustedTimestamp);

      return tick;
    } catch (error) {
      console.error(`❌ Erro ao processar tick ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Obtém ou cria buffer para símbolo
   */
  private getOrCreateBuffer(symbol: string): TickBuffer {
    if (!this.buffers.has(symbol)) {
      this.buffers.set(symbol, {
        ticks: [],
        lastSequenceId: new Map(),
        clockOffset: 0
      });
    }
    return this.buffers.get(symbol)!;
  }

  /**
   * Verifica se tick é duplicata
   */
  private isDuplicate(buffer: TickBuffer, tick: Tick): boolean {
    const lastSeq = buffer.lastSequenceId.get(tick.symbol);
    if (lastSeq !== undefined && tick.sequenceId <= lastSeq) {
      return true; // Sequence ID menor ou igual = duplicata
    }
    
    // Verificar por tradeId também
    const recentTicks = buffer.ticks.slice(-100);
    return recentTicks.some(t => t.tradeId === tick.tradeId);
  }

  /**
   * Obtém ticks recentes
   */
  public getRecentTicks(symbol: string, windowMs: number = 5000): Tick[] {
    const buffer = this.buffers.get(symbol);
    if (!buffer) return [];

    const cutoff = Date.now() - windowMs;
    return buffer.ticks.filter(t => t.timestamp >= cutoff);
  }

  /**
   * Valida se dados estão válidos (N0 gate)
   */
  public validateDataQuality(symbol: string): {
    valid: boolean;
    latency: number;
    heartbeatOk: boolean;
    lastTickAge: number;
  } {
    const buffer = this.buffers.get(symbol);
    const now = Date.now();

    if (!buffer || buffer.ticks.length === 0) {
      return {
        valid: false,
        latency: Infinity,
        heartbeatOk: false,
        lastTickAge: Infinity
      };
    }

    const lastTick = buffer.ticks[buffer.ticks.length - 1];
    const lastTickAge = now - lastTick.timestamp;
    const heartbeatOk = this.heartbeatMonitor.isHealthy(symbol);

    // Calcular latência média recente
    const recentTicks = this.getRecentTicks(symbol, 1000);
    const avgLatency = recentTicks.length > 0
      ? recentTicks.reduce((sum, t) => sum + (t.timestamp - t.exchangeTimestamp), 0) / recentTicks.length
      : 0;

    return {
      valid: lastTickAge < 5000 && heartbeatOk && avgLatency < this.MAX_LATENCY_MS,
      latency: avgLatency,
      heartbeatOk,
      lastTickAge
    };
  }
}

/**
 * Sincronizador de relógio (simulado - em produção usaria NTP real)
 */
class ClockSynchronizer {
  private offset: number = 0;

  public async sync(): Promise<void> {
    // Simulado: em produção, consultaria servidor NTP ou timestamp da exchange
    // Por enquanto, assume offset zero
    this.offset = 0;
  }

  public getOffset(): number {
    return this.offset;
  }
}

/**
 * Monitor de heartbeat
 */
class HeartbeatMonitor {
  private lastTickTime: Map<string, number> = new Map();
  private readonly TIMEOUT_MS = 5000; // 5 segundos sem tick = problema

  public recordTick(symbol: string, timestamp: number): void {
    this.lastTickTime.set(symbol, timestamp);
  }

  public isHealthy(symbol: string): boolean {
    const lastTick = this.lastTickTime.get(symbol);
    if (!lastTick) return false;
    
    const age = Date.now() - lastTick;
    return age < this.TIMEOUT_MS;
  }
}

export const tickIngestion = TickIngestionEngine.getInstance();


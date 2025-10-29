// ============================================================================
// WEBSOCKET SYSTEM - DADOS EM TEMPO REAL KRONOS-X
// ============================================================================

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  TradeData,
  DepthData,
  RealtimeData,
  WebSocketMessage,
  MetricsUpdate
} from '../types';
import { getConfig } from '../config';
import { getComponentLogger, SystemComponent, SystemAction } from './logging';
import { getSignalEngine } from './signal-engine';
import { getMetrics } from './metrics';
import { PromiseUtils, TimeUtils } from '../utils';

// ============================================================================
// INTERFACES DO WEBSOCKET
// ============================================================================

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval: number;
  pongTimeout: number;
}

export interface StreamSubscription {
  stream: string;
  symbol: string;
  callback: (data: any) => void;
}

export interface WebSocketStats {
  connected: boolean;
  reconnectAttempts: number;
  lastMessageTime: number;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  uptime: number;
}

// ============================================================================
// CLASSE PRINCIPAL DO WEBSOCKET
// ============================================================================

export class WebSocketManager extends EventEmitter {
  private static instance: WebSocketManager | null = null;
  private logger = getComponentLogger(SystemComponent.WebSocket);
  
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private subscriptions: Map<string, StreamSubscription> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private stats: WebSocketStats;
  private startTime: number;

  private constructor() {
    super();
    const config = getConfig();
    this.config = {
      url: config.getBinanceWsUrl(),
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      pongTimeout: 10000
    };
    
    this.stats = {
      connected: false,
      reconnectAttempts: 0,
      lastMessageTime: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      uptime: 0
    };
    
    this.startTime = TimeUtils.now();
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Conecta ao WebSocket
   */
  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.logger.info(SystemAction.SystemStart, 'WebSocket já está conectado');
      return;
    }

    // ✅ Validar URL antes de conectar
    if (!this.config.url || !this.config.url.startsWith('wss://')) {
      this.logger.warn(SystemAction.SystemStart, 'URL do WebSocket inválida ou não configurada, pulando conexão', {
        url: this.config.url
      });
      return;
    }

    try {
      this.ws = new WebSocket(this.config.url);
      
      this.ws.on('open', () => {
        this.stats.connected = true;
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        
        this.logger.info(SystemAction.SystemStart, 'WebSocket conectado', {
          url: this.config.url
        });
        
        this.startPingTimer();
        this.emit('connected');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error: Error) => {
        this.stats.errors++;
        // ✅ Não bloquear sistema com erros de WebSocket (não crítico)
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('404') || errorMessage.includes('Unexpected server response')) {
          this.logger.warn(SystemAction.ErrorHandling, 'WebSocket URL não encontrada (404) - pode ser normal se streams não estão configurados', {
            url: this.config.url,
            error: errorMessage.substring(0, 100)
          });
          // Não tentar reconectar se foi 404
          this.reconnectAttempts = this.config.maxReconnectAttempts;
        } else {
          this.logger.error(SystemAction.ErrorHandling, 'Erro no WebSocket', error);
        }
        // Não emitir error para não quebrar sistema
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        this.stats.connected = false;
        this.stopPingTimer();
        
        const closeReason = reason?.toString() || 'Desconhecido';
        
        // ✅ Não tentar reconectar se foi erro 404 ou URL incorreta
        if (code === 1006 && this.reconnectAttempts > 1) {
          this.logger.warn(SystemAction.SystemStop, 'WebSocket não conectou - verificando configuração de URL', {
            code,
            url: this.config.url,
            attempts: this.reconnectAttempts
          });
          return; // Não tentar reconectar mais
        }
        
        this.logger.debug(SystemAction.SystemStop, 'WebSocket desconectado', {
          code,
          reason: closeReason
        });
        
        this.emit('disconnected');
        
        // Tentar reconectar apenas se não excedeu limite
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.logger.warn(SystemAction.ErrorHandling, 'Máximo de tentativas de reconexão atingido - WebSocket desabilitado');
        }
      });

      this.ws.on('pong', () => {
        this.clearPongTimer();
        this.logger.debug(SystemAction.DataProcessing, 'Pong recebido');
      });

    } catch (error) {
      // ✅ Não lançar erro, apenas logar (WebSocket não é crítico)
      this.logger.warn(SystemAction.ErrorHandling, 'Erro ao conectar WebSocket (não crítico)', {
        error: (error as Error).message,
        url: this.config.url
      });
      // Não throw para não quebrar inicialização do sistema
    }
  }

  /**
   * Desconecta do WebSocket
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.clearReconnectTimer();
    this.stopPingTimer();
    this.stats.connected = false;
  }

  /**
   * Processa mensagem recebida
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.stream) {
        this.processStreamMessage(message);
      } else if (message.e) {
        this.processEventMessage(message);
      }
      
      this.stats.messagesReceived++;
      this.stats.lastMessageTime = TimeUtils.now();
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar mensagem WebSocket', 
        error as Error);
      this.stats.errors++;
    }
  }

  /**
   * Processa mensagem de stream
   */
  private processStreamMessage(message: any): void {
    const streamName = message.stream;
    const data = message.data;
    
    // Encontra subscription correspondente
    const subscription = Array.from(this.subscriptions.values())
      .find(sub => streamName.includes(sub.stream) && streamName.includes(sub.symbol.toLowerCase()));
    
    if (subscription) {
      subscription.callback(data);
    }
    
    // Processa dados específicos
    if (streamName.includes('@trade')) {
      this.processTradeData(data).catch(err => {
        this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar trade data', err as Error);
      });
    } else if (streamName.includes('@depth')) {
      this.processDepthData(data).catch(err => {
        this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar depth data', err as Error);
      });
    } else if (streamName.includes('@ticker')) {
      this.processTickerData(data);
    }
  }

  /**
   * Processa dados de trade
   */
  private async processTradeData(data: any): Promise<void> {
    try {
      const trade: TradeData = {
        price: parseFloat(data.p),
        quantity: parseFloat(data.q),
        is_buyer_maker: data.m,
        timestamp: data.T
      };

      // Adiciona ao SignalEngine
      const signalEngine = getSignalEngine();
      signalEngine.addTrade(data.s, trade);

      // ✅ HFT: Enviar para tick ingestion e feature store (lazy loading)
      // Usar try-catch interno para não bloquear se módulos não estiverem disponíveis
      try {
        // Importação dinâmica com tratamento robusto de erros
        const hftTickModule = await import('./hft/tick-ingestion').catch(() => null);
        const hftFeatureModule = await import('./hft/feature-store').catch(() => null);
        
        if (hftTickModule?.tickIngestion && hftFeatureModule?.featureStore) {
          // Criar tick para ingestão
          const tick = await hftTickModule.tickIngestion.ingestTick(data, data.s);
          if (tick) {
            // Adicionar ao feature store (sem order book por enquanto)
            await hftFeatureModule.featureStore.addTick(tick);
          }
        }
      } catch (hftError) {
        // Não bloquear se HFT falhar (não crítico para funcionamento básico)
        // Silenciosamente falhar se módulos HFT não estiverem disponíveis
        if (this.logger) {
          this.logger.debug(SystemAction.DataProcessing, 'HFT processing skipped (non-critical)', { 
            symbol: data.s
          });
        }
      }

      // Emite evento de trade
      this.emit('trade', {
        symbol: data.s,
        trade,
        timestamp: TimeUtils.now()
      });

      this.logger.debug(SystemAction.DataProcessing, 'Trade processado', {
        symbol: data.s,
        price: trade.price,
        quantity: trade.quantity
      });

    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar dados de trade', error as Error);
    }
  }

  /**
   * Processa dados de depth
   */
  private async processDepthData(data: any): Promise<void> {
    try {
      const depth: DepthData = {
        bids: data.b.map((bid: [string, string]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: data.a.map((ask: [string, string]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
        timestamp: data.E
      };

      // Adiciona ao SignalEngine
      const signalEngine = getSignalEngine();
      signalEngine.addDepth(data.s, depth);

      // ✅ HFT: Converter depth para OrderBookLevel e atualizar feature store (lazy loading)
      try {
        const hftFeatureModule = await import('./hft/feature-store').catch(() => null);
        
        if (hftFeatureModule?.featureStore) {
          const orderBookLevels = [
            ...depth.bids.map(([price, qty]: [number, number]) => ({
              price,
              quantity: qty,
              side: 'bid' as const
            })),
            ...depth.asks.map(([price, qty]: [number, number]) => ({
              price,
              quantity: qty,
              side: 'ask' as const
            }))
          ];
          
          // Atualizar order book no feature store
          hftFeatureModule.featureStore.updateOrderBook(data.s, orderBookLevels);
        }
      } catch (hftError) {
        // Não bloquear se HFT falhar (não crítico)
        if (this.logger) {
          this.logger.debug(SystemAction.DataProcessing, 'HFT depth processing skipped (non-critical)', {
            symbol: data.s
          });
        }
      }

      // Emite evento de depth
      this.emit('depth', {
        symbol: data.s,
        depth,
        timestamp: TimeUtils.now()
      });

      this.logger.debug(SystemAction.DataProcessing, 'Depth processado', {
        symbol: data.s,
        bids_count: depth.bids.length,
        asks_count: depth.asks.length
      });

    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar dados de depth', error as Error);
    }
  }

  /**
   * Processa dados de ticker
   */
  private processTickerData(data: any): void {
    try {
      // Emite evento de ticker
      this.emit('ticker', {
        symbol: data.s,
        price: parseFloat(data.c),
        change: parseFloat(data.P),
        volume: parseFloat(data.v),
        timestamp: TimeUtils.now()
      });

      this.logger.debug(SystemAction.DataProcessing, 'Ticker processado', {
        symbol: data.s,
        price: data.c,
        change: data.P
      });

    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar dados de ticker', error as Error);
    }
  }

  /**
   * Processa mensagem de evento
   */
  private processEventMessage(message: any): void {
    this.logger.debug(SystemAction.DataProcessing, 'Evento WebSocket recebido', { event: message.e });
    
    switch (message.e) {
      case 'executionReport':
        this.processExecutionReport(message);
        break;
      case 'outboundAccountPosition':
        this.processAccountPosition(message);
        break;
      case 'balanceUpdate':
        this.processBalanceUpdate(message);
        break;
      default:
        this.emit('event', message);
    }
  }

  /**
   * Processa execution report
   */
  private processExecutionReport(message: any): void {
    this.logger.info(SystemAction.DataProcessing, 'Execution report recebido', {
      symbol: message.s,
      orderId: message.i,
      status: message.X,
      filledQty: message.z
    });
    
    this.emit('execution', message);
  }

  /**
   * Processa account position
   */
  private processAccountPosition(message: any): void {
    this.logger.info(SystemAction.DataProcessing, 'Account position atualizado', {
      balances: message.B?.length || 0
    });
    
    this.emit('account', message);
  }

  /**
   * Processa balance update
   */
  private processBalanceUpdate(message: any): void {
    this.logger.debug(SystemAction.DataProcessing, 'Balance atualizado', {
      asset: message.a,
      delta: message.d
    });
    
    this.emit('balance', message);
  }

  /**
   * Subscreve a um stream
   */
  public subscribe(stream: string, symbol: string, callback: (data: any) => void): void {
    const key = `${stream}_${symbol}`;
    this.subscriptions.set(key, { stream, symbol, callback });
    
    // Se já está conectado, enviar mensagem de subscribe
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const streamName = `${symbol.toLowerCase()}@${stream}`;
      const subscribeMessage = {
        method: 'SUBSCRIBE',
        params: [streamName],
        id: Date.now()
      };
      
      this.ws.send(JSON.stringify(subscribeMessage));
      this.stats.messagesSent++;
      
      this.logger.info(SystemAction.DataProcessing, 'Subscrito a stream', {
        stream: streamName
      });
    }
  }

  /**
   * Cancela subscrição
   */
  public unsubscribe(stream: string, symbol: string): void {
    const key = `${stream}_${symbol}`;
    this.subscriptions.delete(key);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const streamName = `${symbol.toLowerCase()}@${stream}`;
      const unsubscribeMessage = {
        method: 'UNSUBSCRIBE',
        params: [streamName],
        id: Date.now()
      };
      
      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.stats.messagesSent++;
    }
  }

  /**
   * Agenda reconexão
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }
    
    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.logger.info(SystemAction.SystemStart, 'Tentando reconectar...', {
        attempt: this.reconnectAttempts
      });
      this.connect();
    }, this.config.reconnectInterval);
  }

  /**
   * Limpa timer de reconexão
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Inicia ping timer
   */
  private startPingTimer(): void {
    this.clearPingTimer();
    
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.startPongTimer();
      }
    }, this.config.pingInterval);
  }

  /**
   * Para ping timer
   */
  private stopPingTimer(): void {
    this.clearPingTimer();
    this.clearPongTimer();
  }

  /**
   * Limpa ping timer
   */
  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Inicia pong timer
   */
  private startPongTimer(): void {
    this.clearPongTimer();
    
    this.pongTimer = setTimeout(() => {
      this.logger.warn(SystemAction.ErrorHandling, 'Pong timeout - fechando conexão');
      if (this.ws) {
        this.ws.close();
      }
    }, this.config.pongTimeout);
  }

  /**
   * Limpa pong timer
   */
  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Subscreve a streams de mercado
   */
  public subscribeToMarketStreams(symbols: string[]): void {
    const streams = ['trade', 'depth', 'ticker'];
    
    for (const symbol of symbols) {
      for (const stream of streams) {
        this.subscribe(stream, symbol, (data) => {
          this.logger.debug(SystemAction.DataProcessing, `Stream ${stream} para ${symbol}`, { data });
        });
      }
    }

    this.logger.info(SystemAction.DataProcessing, 'Subscrito a streams de mercado', {
      symbols: symbols.length,
      streams: streams.length
    });
  }

  /**
   * Subscreve a user data stream
   */
  public subscribeToUserDataStream(listenKey: string): void {
    const baseUrl = this.config.url.endsWith('/ws') || this.config.url.endsWith('/stream')
      ? this.config.url
      : `${this.config.url}/ws`;
    
    const userStreamUrl = `${baseUrl}/${listenKey}`;
    
    // Criar nova conexão para user data stream
    const userWs = new WebSocket(userStreamUrl);
    
    userWs.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.e) {
          this.processEventMessage(message);
        }
      } catch (error) {
        this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar user data stream', error as Error);
      }
    });
    
    this.logger.info(SystemAction.DataProcessing, 'Subscrito a user data stream', {
      listenKey: listenKey.substring(0, 10) + '...'
    });
  }

  /**
   * Obtém estatísticas
   */
  public getStats(): WebSocketStats {
    this.stats.uptime = TimeUtils.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Obtém status da conexão
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// WEBSOCKET SERVER PARA CLIENTES
// ============================================================================

export class WebSocketServer extends EventEmitter {
  private static instance: WebSocketServer | null = null;
  private logger = getComponentLogger(SystemComponent.WebSocket);
  
  private server: WebSocket.Server | null = null;
  private clients = new Set<WebSocket>();

  public static getInstance(): WebSocketServer {
    if (!WebSocketServer.instance) {
      WebSocketServer.instance = new WebSocketServer();
    }
    return WebSocketServer.instance;
  }

  /**
   * Inicia servidor WebSocket
   */
  public start(port: number = 8081): void {
    try {
      this.server = new WebSocket.Server({ port });
      
      this.server.on('connection', (ws: WebSocket) => {
        this.clients.add(ws);
        this.logger.info(SystemAction.SystemStart, 'Cliente WebSocket conectado', {
          total_clients: this.clients.size
        });

        // Envia métricas iniciais
        this.sendToClient(ws, {
          type: 'metrics',
          data: getMetrics().getMetricsUpdate(),
          timestamp: TimeUtils.now()
        });

        ws.on('message', (message: WebSocket.Data) => {
          this.handleClientMessage(ws, message);
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          this.logger.info(SystemAction.SystemStop, 'Cliente WebSocket desconectado', {
            total_clients: this.clients.size
          });
        });

        ws.on('error', (error: Error) => {
          this.logger.error(SystemAction.ErrorHandling, 'Erro no cliente WebSocket', error as Error);
          this.clients.delete(ws);
        });
      });

      this.logger.info(SystemAction.SystemStart, 'Servidor WebSocket iniciado', { port });
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao iniciar servidor WebSocket', error as Error);
    }
  }

  /**
   * Para servidor WebSocket
   */
  public stop(): void {
    try {
      // Fechar todas as conexões de clientes
      for (const client of this.clients) {
        try {
          client.close();
        } catch (error) {
          // Ignorar erros ao fechar
        }
      }
      this.clients.clear();

      // Fechar servidor
      if (this.server) {
        this.server.close();
        this.server = null;
      }

      this.logger.info(SystemAction.SystemStop, 'Servidor WebSocket parado');
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao parar servidor WebSocket', error as Error);
    }
  }

  /**
   * Processa mensagem de cliente
   */
  private handleClientMessage(ws: WebSocket, message: WebSocket.Data): void {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          // Subscrever a streams específicas
          break;
        case 'unsubscribe':
          // Cancelar subscrição
          break;
        default:
          this.logger.debug(SystemAction.DataProcessing, 'Mensagem de cliente recebida', { type: data.type });
      }
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar mensagem de cliente', error as Error);
    }
  }

  /**
   * Envia mensagem para cliente
   */
  private sendToClient(ws: WebSocket, message: any): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao enviar mensagem para cliente', error as Error);
    }
  }

  /**
   * Broadcast para todos os clientes
   */
  public broadcast(message: any): void {
    for (const client of this.clients) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast de métricas
   */
  public broadcastMetrics(): void {
    const metrics = getMetrics().getMetricsUpdate();
    this.broadcast({
      type: 'metrics',
      data: metrics,
      timestamp: TimeUtils.now()
    });
  }
}

// ============================================================================
// EXPORTS E HELPERS
// ============================================================================

export function getWebSocketManager(): WebSocketManager {
  return WebSocketManager.getInstance();
}

export function getWebSocketServer(): WebSocketServer {
  return WebSocketServer.getInstance();
}

/**
 * Inicia sistema WebSocket completo
 */
export async function startWebSocketSystem(): Promise<void> {
  try {
    const manager = getWebSocketManager();
    const server = getWebSocketServer();
    
    // Inicia servidor WebSocket
    server.start();
    
    // Conecta ao WebSocket da Binance
    await manager.connect();
    
    // Subscreve a streams de mercado
    const config = getConfig();
    manager.subscribeToMarketStreams(config.getSymbols());
    
    // Configura broadcast de métricas
    const metrics = getMetrics();
    metrics.on('metrics_update', () => {
      server.broadcastMetrics();
    });
    
    console.log('Sistema WebSocket iniciado com sucesso');
    
  } catch (error) {
    console.error('Erro ao iniciar sistema WebSocket:', error as Error);
    throw error;
  }
}

/**
 * Para sistema WebSocket completo
 */
export function stopWebSocketSystem(): void {
  try {
    const manager = getWebSocketManager();
    const server = getWebSocketServer();
    
    manager.disconnect();
    server.stop();
    
    console.log('Sistema WebSocket parado');
  } catch (error) {
    console.error('Erro ao parar sistema WebSocket:', error as Error);
  }
}

export default WebSocketManager;

export const webSocketService = new WebSocketManager();

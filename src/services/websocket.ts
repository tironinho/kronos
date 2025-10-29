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
  private static instance: WebSocketManager;
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
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.logger.warn(SystemAction.DataProcessing, 'WebSocket já está conectado');
        return;
      }

      // Normaliza URL: Binance exige sufixo /ws para SUBSCRIBE/UNSUBSCRIBE API
      const baseUrl = this.config.url.endsWith('/ws') || this.config.url.endsWith('/stream')
        ? this.config.url
        : `${this.config.url}/ws`;
      this.logger.info(SystemAction.SystemStart, 'Conectando ao WebSocket', { url: baseUrl });

      this.ws = new WebSocket(baseUrl);
      this.setupEventHandlers();
      
      await this.waitForConnection();
      
      this.stats.connected = true;
      this.stats.reconnectAttempts = 0;
      this.startPingTimer();
      
      this.logger.info(SystemAction.SystemStart, 'WebSocket conectado com sucesso');
      this.emit('connected');
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao conectar WebSocket', error as Error);
      this.stats.errors++;
      this.handleReconnect();
    }
  }

  /**
   * Desconecta do WebSocket
   */
  public disconnect(): void {
    try {
      this.stopPingTimer();
      this.clearReconnectTimer();
      
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.stats.connected = false;
      this.logger.info(SystemAction.SystemStop, 'WebSocket desconectado');
      this.emit('disconnected');
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao desconectar WebSocket', error as Error);
    }
  }

  /**
   * Configura handlers de eventos do WebSocket
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.logger.info(SystemAction.SystemStart, 'Conexão WebSocket estabelecida');
      this.stats.connected = true;
      this.stats.reconnectAttempts = 0;
      this.emit('open');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.logger.warn(SystemAction.ErrorHandling, 'WebSocket fechado', { code, reason });
      this.stats.connected = false;
      this.emit('close', code, reason);
      this.handleReconnect();
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error(SystemAction.ErrorHandling, 'Erro no WebSocket', error);
      this.stats.errors++;
      this.emit('error', error);
    });

    this.ws.on('pong', () => {
      this.logger.debug(SystemAction.DataProcessing, 'Pong recebido');
      this.clearPongTimer();
    });
  }

  /**
   * Aguarda conexão ser estabelecida
   */
  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket não inicializado'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao conectar WebSocket'));
      }, 10000);

      this.ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Processa mensagem recebida
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      this.stats.messagesReceived++;
      this.stats.lastMessageTime = TimeUtils.now();
      
      const message = JSON.parse(data.toString());
      
      // Processa diferentes tipos de mensagem
      if (message.stream) {
        this.processStreamMessage(message);
      } else if (message.e) {
        this.processEventMessage(message);
      } else {
        this.logger.debug(SystemAction.DataProcessing, 'Mensagem WebSocket recebida', { message });
      }
      
      this.emit('message', message);
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar mensagem WebSocket', error as Error);
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
      this.processTradeData(data);
    } else if (streamName.includes('@depth')) {
      this.processDepthData(data);
    } else if (streamName.includes('@ticker')) {
      this.processTickerData(data);
    }
  }

  /**
   * Processa dados de trade
   */
  private processTradeData(data: any): void {
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
  private processDepthData(data: any): void {
    try {
      const depth: DepthData = {
        bids: data.b.map((bid: [string, string]) => [parseFloat(bid[0]), parseFloat(bid[1])]),
        asks: data.a.map((ask: [string, string]) => [parseFloat(ask[0]), parseFloat(ask[1])]),
        timestamp: data.E
      };

      // Adiciona ao SignalEngine
      const signalEngine = getSignalEngine();
      signalEngine.addDepth(data.s, depth);

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
        this.logger.debug(SystemAction.DataProcessing, 'Evento não processado', { event: message.e });
    }
  }

  /**
   * Processa relatório de execução
   */
  private processExecutionReport(data: any): void {
    this.logger.info(SystemAction.TradeExecution, 'Ordem executada', {
      symbol: data.s,
      side: data.S,
      quantity: data.q,
      price: data.p,
      status: data.X
    });

    this.emit('execution_report', data);
  }

  /**
   * Processa posição da conta
   */
  private processAccountPosition(data: any): void {
    this.logger.info(SystemAction.DataProcessing, 'Posição da conta atualizada', {
      balances: data.B
    });

    this.emit('account_position', data);
  }

  /**
   * Processa atualização de saldo
   */
  private processBalanceUpdate(data: any): void {
    this.logger.info(SystemAction.DataProcessing, 'Saldo atualizado', {
      asset: data.a,
      balance_delta: data.d,
      clear_time: data.T
    });

    this.emit('balance_update', data);
  }

  /**
   * Subscreve a um stream
   */
  public subscribe(stream: string, symbol: string, callback: (data: any) => void): void {
    const subscriptionKey = `${stream}_${symbol}`;
    const subscription: StreamSubscription = {
      stream,
      symbol,
      callback
    };

    this.subscriptions.set(subscriptionKey, subscription);
    
    this.logger.info(SystemAction.DataProcessing, 'Stream subscrito', { stream, symbol });
    
    // Se conectado, envia comando de subscription
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscriptionCommand(stream, symbol);
    }
  }

  /**
   * Remove subscription de um stream
   */
  public unsubscribe(stream: string, symbol: string): void {
    const subscriptionKey = `${stream}_${symbol}`;
    this.subscriptions.delete(subscriptionKey);
    
    this.logger.info(SystemAction.DataProcessing, 'Stream removido', { stream, symbol });
    
    // Se conectado, envia comando de unsubscription
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendUnsubscriptionCommand(stream, symbol);
    }
  }

  /**
   * Envia comando de subscription
   */
  private sendSubscriptionCommand(stream: string, symbol: string): void {
    const command = {
      method: 'SUBSCRIBE',
      params: [`${symbol.toLowerCase()}@${stream}`],
      id: TimeUtils.now()
    };

    this.send(JSON.stringify(command));
  }

  /**
   * Envia comando de unsubscription
   */
  private sendUnsubscriptionCommand(stream: string, symbol: string): void {
    const command = {
      method: 'UNSUBSCRIBE',
      params: [`${symbol.toLowerCase()}@${stream}`],
      id: TimeUtils.now()
    };

    this.send(JSON.stringify(command));
  }

  /**
   * Envia mensagem
   */
  public send(data: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      this.stats.messagesSent++;
    } else {
      this.logger.warn(SystemAction.ErrorHandling, 'Tentativa de envio com WebSocket desconectado');
    }
  }

  /**
   * Inicia timer de ping
   */
  private startPingTimer(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.startPongTimer();
      }
    }, this.config.pingInterval);
  }

  /**
   * Para timer de ping
   */
  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimer();
  }

  /**
   * Inicia timer de pong
   */
  private startPongTimer(): void {
    this.clearPongTimer();
    this.pongTimer = setTimeout(() => {
      this.logger.warn(SystemAction.ErrorHandling, 'Pong timeout - reconectando');
      this.handleReconnect();
    }, this.config.pongTimeout);
  }

  /**
   * Limpa timer de pong
   */
  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Trata reconexão
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error(SystemAction.ErrorHandling, 'Máximo de tentativas de reconexão atingido');
      this.emit('max_reconnect_attempts');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;

    this.logger.info(SystemAction.ErrorHandling, 'Tentando reconectar', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts
    });

    this.reconnectTimer = setTimeout(() => {
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
    const userDataUrl = `${baseUrl}/${listenKey}`;
    
    // Cria nova conexão para user data stream
    const userDataWs = new WebSocket(userDataUrl);
    
    userDataWs.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.processEventMessage(message);
      } catch (error) {
        this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar user data stream', error as Error);
      }
    });

    userDataWs.on('error', (error: Error) => {
      this.logger.error(SystemAction.ErrorHandling, 'Erro no user data stream', error);
    });

    this.logger.info(SystemAction.DataProcessing, 'Subscrito a user data stream', { listenKey });
  }

  /**
   * Obtém estatísticas do WebSocket
   */
  public getStats(): WebSocketStats {
    this.stats.uptime = TimeUtils.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Verifica se está conectado
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Obtém estado da conexão
   */
  public getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Reseta estatísticas
   */
  public resetStats(): void {
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
}

// ============================================================================
// WEBSOCKET SERVER PARA CLIENTES
// ============================================================================

export class WebSocketServer extends EventEmitter {
  private static instance: WebSocketServer;
  private logger = getComponentLogger(SystemComponent.WebSocket);
  private clients: Set<WebSocket> = new Set();
  private server: any = null;

  private constructor() {
    super();
  }

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
          this.logger.error(SystemAction.ErrorHandling, 'Erro no cliente WebSocket', error);
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
      if (this.server) {
        this.server.close();
        this.server = null;
      }
      
      // Fecha todas as conexões de clientes
      this.clients.forEach(client => {
        client.close();
      });
      this.clients.clear();
      
      this.logger.info(SystemAction.SystemStop, 'Servidor WebSocket parado');
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao parar servidor WebSocket', error as Error);
    }
  }

  /**
   * Processa mensagem do cliente
   */
  private handleClientMessage(ws: WebSocket, message: WebSocket.Data): void {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe_metrics':
          // Cliente quer receber métricas em tempo real
          this.logger.debug(SystemAction.DataProcessing, 'Cliente subscrito a métricas');
          break;
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: TimeUtils.now() });
          break;
        default:
          this.logger.debug(SystemAction.DataProcessing, 'Tipo de mensagem não reconhecido', { type: data.type });
      }
      
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao processar mensagem do cliente', error as Error);
    }
  }

  /**
   * Envia mensagem para cliente específico
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      this.logger.error(SystemAction.ErrorHandling, 'Erro ao enviar mensagem para cliente', error as Error);
    }
  }

  /**
   * Envia mensagem para todos os clientes
   */
  public broadcast(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  /**
   * Envia métricas para todos os clientes
   */
  public broadcastMetrics(): void {
    const metrics = getMetrics().getMetricsUpdate();
    this.broadcast({
      type: 'metrics',
      data: metrics,
      timestamp: TimeUtils.now()
    });
  }

  /**
   * Obtém número de clientes conectados
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém instância do WebSocketManager
 */
export function getWebSocketManager(): WebSocketManager {
  return WebSocketManager.getInstance();
}

/**
 * Obtém instância do WebSocketServer
 */
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
    console.error('Erro ao iniciar sistema WebSocket:', error);
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
    console.error('Erro ao parar sistema WebSocket:', error);
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default WebSocketManager;

// Export instance for easy import
export const webSocketService = new WebSocketManager();

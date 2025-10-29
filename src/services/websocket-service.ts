import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import CacheService from './cache-service';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  symbol?: string;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private cacheService: CacheService;

  private constructor() {
    this.cacheService = CacheService.getInstance();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Nova conexão WebSocket estabelecida');
      this.clients.add(ws);

      // Enviar dados iniciais
      this.sendInitialData(ws);

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 Conexão WebSocket fechada');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('Erro na conexão WebSocket:', error);
        this.clients.delete(ws);
      });
    });

    console.log('✅ WebSocket Server inicializado');
  }

  private async sendInitialData(ws: WebSocket): Promise<void> {
    try {
      // Enviar métricas de trading
      const metrics = await this.cacheService.getTradingMetrics();
      if (metrics) {
        this.sendToClient(ws, {
          type: 'trading_metrics',
          data: metrics,
          timestamp: new Date().toISOString()
        });
      }

      // Enviar dados de mercado para símbolos principais
      const mainSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      for (const symbol of mainSymbols) {
        const marketData = await this.cacheService.getMarketData(symbol);
        if (marketData) {
          this.sendToClient(ws, {
            type: 'market_data',
            data: marketData,
            symbol,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Enviar dados enriquecidos
      const enhancedData = await this.cacheService.getEnhancedData('sentiment');
      if (enhancedData) {
        this.sendToClient(ws, {
          type: 'market_sentiment',
          data: enhancedData,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Erro ao enviar dados iniciais:', error);
    }
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message);
        break;
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;
      default:
        console.log('Tipo de mensagem não reconhecido:', message.type);
    }
  }

  private handleSubscribe(ws: WebSocket, message: any): void {
    const { symbol, dataType } = message;
    console.log(`📡 Cliente se inscreveu em ${dataType} para ${symbol}`);
    
    // Enviar dados atuais se disponíveis
    this.sendCurrentData(ws, symbol, dataType);
  }

  private handleUnsubscribe(ws: WebSocket, message: any): void {
    const { symbol, dataType } = message;
    console.log(`📡 Cliente se desinscreveu de ${dataType} para ${symbol}`);
  }

  private async sendCurrentData(ws: WebSocket, symbol: string, dataType: string): Promise<void> {
    try {
      switch (dataType) {
        case 'market':
          const marketData = await this.cacheService.getMarketData(symbol);
          if (marketData) {
            this.sendToClient(ws, {
              type: 'market_data',
              data: marketData,
              symbol,
              timestamp: new Date().toISOString()
            });
          }
          break;

        case 'technical':
          const taData = await this.cacheService.getTechnicalAnalysis(symbol, '1h');
          if (taData) {
            this.sendToClient(ws, {
              type: 'technical_analysis',
              data: taData,
              symbol,
              timestamp: new Date().toISOString()
            });
          }
          break;

        case 'enhanced':
          const enhancedData = await this.cacheService.getEnhancedData(symbol);
          if (enhancedData) {
            this.sendToClient(ws, {
              type: 'enhanced_data',
              data: enhancedData,
              symbol,
              timestamp: new Date().toISOString()
            });
          }
          break;
      }
    } catch (error) {
      console.error('Erro ao enviar dados atuais:', error);
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Erro ao enviar mensagem para cliente:', error);
      }
    }
  }

  public broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error('Erro ao fazer broadcast:', error);
        }
      }
    });
  }

  public broadcastToSymbol(symbol: string, message: WebSocketMessage): void {
    // Por enquanto, faz broadcast para todos
    // Em uma implementação mais avançada, manteria lista de clientes por símbolo
    this.broadcast({ ...message, symbol });
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public getStats(): any {
    return {
      connectedClients: this.clients.size,
      serverStatus: this.wss ? 'running' : 'stopped',
      uptime: process.uptime()
    };
  }

  // Métodos para broadcasting de dados específicos
  public async broadcastTradingMetrics(): Promise<void> {
    const metrics = await this.cacheService.getTradingMetrics();
    if (metrics) {
      this.broadcast({
        type: 'trading_metrics',
        data: metrics,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async broadcastMarketData(symbol: string): Promise<void> {
    const marketData = await this.cacheService.getMarketData(symbol);
    if (marketData) {
      this.broadcastToSymbol(symbol, {
        type: 'market_data',
        data: marketData,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async broadcastTechnicalAnalysis(symbol: string, timeframe: string): Promise<void> {
    const taData = await this.cacheService.getTechnicalAnalysis(symbol, timeframe);
    if (taData) {
      this.broadcastToSymbol(symbol, {
        type: 'technical_analysis',
        data: taData,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async broadcastEnhancedData(symbol: string): Promise<void> {
    const enhancedData = await this.cacheService.getEnhancedData(symbol);
    if (enhancedData) {
      this.broadcastToSymbol(symbol, {
        type: 'enhanced_data',
        data: enhancedData,
        timestamp: new Date().toISOString()
      });
    }
  }

  public async broadcastTradeUpdate(tradeData: any): Promise<void> {
    this.broadcast({
      type: 'trade_update',
      data: tradeData,
      timestamp: new Date().toISOString()
    });
  }

  public async broadcastAlert(alertData: any): Promise<void> {
    this.broadcast({
      type: 'alert',
      data: alertData,
      timestamp: new Date().toISOString()
    });
  }
}

export default WebSocketService;

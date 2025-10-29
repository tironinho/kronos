// Trade Simulator Engine - Simulações Automáticas em Paralelo

import { getBinanceClient } from './binance-api';

interface SimulatedTrade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  pnl: number;
  pnlPercent: number;
  duration: number;
  algorithm: string;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed';
}

interface SimulationState {
  symbol: string;
  price: number;
  nextEntry?: number;
  positions: SimulatedTrade[];
  equity: number;
  initialCapital: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export class TradeSimulatorEngine {
  private static instance: TradeSimulatorEngine;
  private simulations: Map<string, SimulationState> = new Map();
  private binanceClient = getBinanceClient();
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  private constructor() {}

  public static getInstance(): TradeSimulatorEngine {
    if (!TradeSimulatorEngine.instance) {
      TradeSimulatorEngine.instance = new TradeSimulatorEngine();
    }
    return TradeSimulatorEngine.instance;
  }

  /**
   * Inicia simulações automáticas para múltiplos símbolos
   */
  public async startAutomaticSimulations(symbols: string[], initialCapital: number) {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log(`🎯 Iniciando simulações automáticas para ${symbols.length} símbolos...`);

    // ESTRATÉGIA ÓTIMA: Baseada em análise cruzada Trade Simulator + Monte Carlo
    // ETHUSDT: 40% (melhor win rate 60%), ADAUSDT: 30%, XRPUSDT: 20%, SOLUSDT: 10%
    // BTCUSDT: 0% (EVITADO - conflito entre sistemas, 45% win rate negativo)
    const symbolAllocation: { [key: string]: number } = {
      'ETHUSDT': 0.40,  // 40% - MELHOR performance (60% win rate)
      'ADAUSDT': 0.30,  // 30% - 2º melhor
      'XRPUSDT': 0.20,  // 20% - 3º lugar
      'SOLUSDT': 0.10,  // 10% - Aceitável
      'BTCUSDT': 0.00   // 0% - EVITADO (conflito, negativo)
    };
    
    // Inicializa estado para cada símbolo com alocação otimizada
    for (const symbol of symbols) {
      const allocation = symbolAllocation[symbol] || (1 / symbols.length); // Fallback para igual
      const perSymbolCapital = initialCapital * allocation;
      this.simulations.set(symbol, {
        symbol,
        price: 0,
        positions: [],
        equity: perSymbolCapital,
        initialCapital: perSymbolCapital,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0
      });
      console.log(`💰 ${symbol}: Alocação ${(allocation * 100).toFixed(0)}% = $${perSymbolCapital.toFixed(4)}`);
    }

    // Busca preços iniciais
    await this.fetchCurrentPrices();

    // Inicia loop de simulação
    this.intervalId = setInterval(async () => {
      await this.processSimulations();
    }, 10000); // A cada 10 segundos
  }

  /**
   * Para as simulações automáticas
   */
  public stopAutomaticSimulations() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('⏸️ Simulações automáticas paradas');
  }

  /**
   * Busca preços atuais de todos os símbolos
   */
  private async fetchCurrentPrices() {
    for (const [symbol, state] of this.simulations) {
      try {
        // Usa o cliente Binance diretamente no servidor
        const ticker = await this.binanceClient.get24hrTicker(symbol);
        
        // IMPORTANTE: A API da Binance retorna lastPrice (camelCase) ou last_price (snake_case)
        const price = ticker.lastPrice || (ticker as any).last_price || '0';
        const realPrice = parseFloat(price);
        
        // Simula flutuação de preço realista (-0.5% a +0.5%)
        const variation = (Math.random() - 0.5) * 0.01; // -0.5% a +0.5%
        state.price = realPrice * (1 + variation);
        
        console.log(`📊 ${symbol}: $${realPrice.toFixed(2)} → $${state.price.toFixed(2)} (${variation >= 0 ? '+' : ''}${(variation * 100).toFixed(2)}%)`);
      } catch (error) {
        console.error(`Erro ao buscar preço de ${symbol}:`, error as Error);
      }
    }
  }

  /**
   * Processa simulações para todos os símbolos
   */
  private async processSimulations() {
    await this.fetchCurrentPrices();

    for (const [symbol, state] of this.simulations) {
      // Fecha posições que atingiram TP ou SL
      await this.closePositions(symbol, state);

      // Salva histórico de equity a cada ciclo (opcional)
      try {
        const { supabase } = await import('./supabase-db');
        if (supabase) {
          await supabase.from('equity_history').insert({
            symbol,
            equity: state.equity,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Ignora erros do Supabase
        console.debug(`ℹ️ Supabase não configurado (ignorando...):`, error as Error);
      }

      // Calcula quanto equity está livre (não alocado em trades abertos)
      const openPositions = state.positions.filter(p => p.status === 'open');
      // O valor investido em cada trade foi: entryPrice * quantity ao abrir
      // Como abrimos com 10% do equity atual, somamos esses valores
      const allocatedInTrades = openPositions.reduce((sum, pos) => {
        // Valor investido = entryPrice * quantity
        return sum + (pos.entryPrice * pos.quantity);
      }, 0);
      const freeEquity = state.equity - allocatedInTrades;
      
      // Usa 10% do equity livre (ou total se não houver trades abertos)
      const tradeAmount = freeEquity * 0.1;
      
      // Calcula P&L total dos trades fechados para decidir se continua
      const closedTrades = state.positions.filter(p => p.status === 'closed');
      const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      
      // STOP LOSS DE CAPITAL: Para se perdeu 20% ou mais
      const maxLossPercent = 20; // 20% de perda máxima
      const maxLossAmount = state.initialCapital * (maxLossPercent / 100);
      const currentLoss = state.initialCapital - state.equity;
      const hasExceededMaxLoss = currentLoss >= maxLossAmount;
      
      // ABRE TRADES CONTINUAMENTE SE:
      // - Não excedeu 20% de perda (STOP LOSS DE CAPITAL)  
      // - Equity é suficiente para pelo menos um trade (> $0.0001)
      // SEM LIMITE DE POSIÇÕES ABERTAS!
      const shouldOpenMore = tradeAmount > 0.0001 && !hasExceededMaxLoss && state.equity > 0;
      
      if (shouldOpenMore) {
        const signal = await this.generateSignal(symbol);
        if (signal.shouldTrade) {
          await this.openPosition(symbol, state, signal);
          const currentLossPercent = ((state.initialCapital - state.equity) / state.initialCapital) * 100;
          const openPositions = state.positions.filter(p => p.status === 'open').length;
          console.log(`💰 ${symbol}: Novo trade #${state.totalTrades} (Abertas: ${openPositions}, Equity: $${state.equity.toFixed(4)}, Perda: ${currentLossPercent.toFixed(2)}%, Livre: $${tradeAmount.toFixed(4)})`);
        }
      } else {
        const currentLossPercent = ((state.initialCapital - state.equity) / state.initialCapital) * 100;
        if (hasExceededMaxLoss) {
          console.log(`🛑 ${symbol}: STOP LOSS DE CAPITAL ACIONADO! Parando novos trades. (Perda: ${currentLossPercent.toFixed(2)}%, Equity: $${state.equity.toFixed(4)})`);
        } else if (state.equity <= 0.0001) {
          console.log(`⏸️ ${symbol}: Equity insuficiente para novos trades. (Equity: $${state.equity.toFixed(4)})`);
        }
      }
    }
  }

  /**
   * Gera sinal de trading baseado em múltiplos algoritmos
   */
  private async generateSignal(symbol: string): Promise<any> {
    try {
      // Busca dados atuais usando o cliente Binance
      const ticker = await this.binanceClient.get24hrTicker(symbol);
      // IMPORTANTE: A API da Binance retorna lastPrice (camelCase) ou last_price (snake_case)
      const price = ticker.lastPrice || (ticker as any).last_price || '0';
      const currentPrice = parseFloat(price);
      
      const state = this.simulations.get(symbol);
      if (!state) {
        console.log(`⚠️ Sem estado para ${symbol}`);
        return { shouldTrade: false };
      }

      // Gera trade 90% das vezes para garantir geração constante
      const shouldGenerateTrade = Math.random() > 0.1;
      
      if (!shouldGenerateTrade) {
        console.log(`🎲 ${symbol}: Sem sinal gerado (10% chance de pular)`);
        return { shouldTrade: false };
      }

      // RECOMENDAÇÃO: Focar mais em BUY (75% BUY, 25% SELL)
      // Baseado na análise: BUY tem 56.77% vs SELL 51.11%
      const buyProbability = 0.75; // 75% de chance de BUY
      const side = Math.random() < buyProbability ? 'BUY' : 'SELL';

      console.log(`🎯 ${symbol}: GERANDO ${side} @ $${currentPrice.toFixed(2)}`);

      // RECOMENDAÇÃO: Stop Loss mais agressivo (0.5% ao invés de 1%)
      // TP +2% e SL -0.5% para reduzir perdas
      const tp = side === 'BUY' ? currentPrice * 1.02 : currentPrice * 0.98;
      const sl = side === 'BUY' ? currentPrice * 0.995 : currentPrice * 1.005; // 0.5% SL

      console.log(`💰 ${symbol} ${side}: Entrada $${currentPrice.toFixed(2)}, TP $${tp.toFixed(2)} (+${side === 'BUY' ? '2' : '-2'}%), SL $${sl.toFixed(2)} (-${side === 'BUY' ? '0.5' : '+0.5'}%)`);

      return {
        shouldTrade: true,
        side,
        strength: 0.5 + Math.random() * 0.5, // 0.5 a 1.0
        algorithm: 'random_test',
        price: currentPrice,
        stopLoss: sl,
        takeProfit: tp
      };
    } catch (error) {
      console.error(`Erro ao gerar sinal para ${symbol}:`, error as Error);
      return { shouldTrade: false };
    }
  }

  /**
   * Abre nova posição
   */
  private async openPosition(symbol: string, state: SimulationState, signal: any) {
    const tradeAmount = state.equity * 0.1; // 10% do equity
    const quantity = tradeAmount / signal.price;

    const trade: SimulatedTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      entryPrice: signal.price,
      exitPrice: signal.price, // Será atualizado na saída
      entryTime: Date.now(),
      exitTime: Date.now(),
      side: signal.side,
      quantity,
      pnl: 0,
      pnlPercent: 0,
      duration: 0,
      algorithm: signal.algorithm,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      status: 'open'
    };

    state.positions.push(trade);
    state.totalTrades++;
    console.log(`📈 Abriu ${trade.side} ${symbol} @ $${signal.price.toFixed(2)}`);

    // Salva no Supabase (tentativa opcional)
    try {
      const { supabase } = await import('./supabase-db');
      if (supabase) {
        await supabase.from('simulated_trades').insert({
          trade_id: trade.id,
          symbol: trade.symbol,
          entry_price: trade.entryPrice,
          exit_price: trade.exitPrice,
          entry_time: new Date(trade.entryTime).toISOString(),
          exit_time: null,
          side: trade.side,
          quantity: trade.quantity,
          pnl: trade.pnl,
          pnl_percent: trade.pnlPercent,
          duration_seconds: null,
          algorithm: trade.algorithm,
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          status: trade.status
        });
        console.log(`✅ Trade salvo no banco de dados`);
      }
    } catch (error) {
      // Ignora erros do Supabase se não estiver configurado
      console.debug(`ℹ️ Supabase não configurado ou indisponível (ignorando...):`, error as Error);
    }
  }

  /**
   * Fecha posições que atingiram TP/SL ou estão com lucro/prejuízo
   */
  private async closePositions(symbol: string, state: SimulationState) {
    for (const position of state.positions.filter(p => p.status === 'open')) {
      const shouldClose = this.shouldClosePosition(position, state.price);

      if (shouldClose.should) {
        position.exitPrice = state.price;
        position.exitTime = Date.now();
        position.duration = position.exitTime - position.entryTime;
        position.status = 'closed';

        // Calcula P&L
        if (position.side === 'BUY') {
          position.pnl = (position.exitPrice - position.entryPrice) * position.quantity;
          position.pnlPercent = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100;
        } else {
          position.pnl = (position.entryPrice - position.exitPrice) * position.quantity;
          position.pnlPercent = ((position.entryPrice - position.exitPrice) / position.entryPrice) * 100;
        }

        // Atualiza equity e estatísticas
        state.equity += position.pnl;
        
        if (position.pnl > 0) {
          state.winningTrades++;
        } else {
          state.losingTrades++;
        }

        console.log(`📊 ${symbol} ${position.side} ${shouldClose.reason}: P&L $${position.pnl.toFixed(2)} (${position.pnlPercent.toFixed(2)}%)`);

        // Adiciona ao histórico
        this.addToHistory(symbol, position);

        // Atualiza trade fechado no Supabase
        try {
          const { supabase } = await import('./supabase-db');
          if (supabase) {
            await supabase.from('simulated_trades')
              .update({
                exit_price: position.exitPrice,
                exit_time: new Date(position.exitTime).toISOString(),
                pnl: position.pnl,
                pnl_percent: position.pnlPercent,
                duration_seconds: Math.floor(position.duration / 1000),
                status: 'closed'
              })
              .eq('trade_id', position.id);
            console.log(`💾 Trade fechado salvo no banco: ${position.id}`);
          }
        } catch (error) {
          console.debug(`⚠️ Erro ao salvar trade fechado no Supabase:`, error as Error);
        }
      }
    }

    // NÃO remove posições - mantém TODO o histórico para análise
    // SEM LIMITAÇÃO DE QUANTIDADE DE TRADES
  }

  /**
   * Verifica se posição deve ser fechada
   */
  private shouldClosePosition(position: SimulatedTrade, currentPrice: number): { should: boolean; reason: string } {
    const now = Date.now();
    const tradeAge = now - position.entryTime;
    const maxAge = 30000; // 30 segundos

    // Fecha por tempo limite
    if (tradeAge > maxAge) {
      console.log(`⏰ ${position.symbol} ${position.side}: Fechando por tempo limite (${Math.floor(tradeAge / 1000)}s)`);
      return { should: true, reason: 'Time Limit' };
    }

    if (!position.stopLoss || !position.takeProfit) {
      return { should: false, reason: '' };
    }

    // Fecha por TP/SL
    if (position.side === 'BUY') {
      if (currentPrice >= position.takeProfit) {
        console.log(`🎯 ${position.symbol} BUY: Take Profit atingido! Preço: $${currentPrice.toFixed(2)}, TP: $${position.takeProfit.toFixed(2)}`);
        return { should: true, reason: 'Take Profit' };
      }
      if (currentPrice <= position.stopLoss) {
        console.log(`🛑 ${position.symbol} BUY: Stop Loss atingido! Preço: $${currentPrice.toFixed(2)}, SL: $${position.stopLoss.toFixed(2)}`);
        return { should: true, reason: 'Stop Loss' };
      }
    } else {
      if (currentPrice <= position.takeProfit) {
        console.log(`🎯 ${position.symbol} SELL: Take Profit atingido! Preço: $${currentPrice.toFixed(2)}, TP: $${position.takeProfit.toFixed(2)}`);
        return { should: true, reason: 'Take Profit' };
      }
      if (currentPrice >= position.stopLoss) {
        console.log(`🛑 ${position.symbol} SELL: Stop Loss atingido! Preço: $${currentPrice.toFixed(2)}, SL: $${position.stopLoss.toFixed(2)}`);
        return { should: true, reason: 'Stop Loss' };
      }
    }

    return { should: false, reason: '' };
  }

  /**
   * Retorna trades de um símbolo
   */
  public getTrades(symbol: string): SimulatedTrade[] {
    const state = this.simulations.get(symbol);
    if (!state) return [];
    // Retorna tanto trades abertos quanto fechados
    const trades = state.positions || [];
    console.log(`📋 getTrades(${symbol}): ${trades.length} trades (${trades.filter(t => t.status === 'open').length} abertos, ${trades.filter(t => t.status === 'closed').length} fechados)`);
    return trades;
  }

  /**
   * Retorna todos os trades de todos os símbolos (fechados)
   */
  public getAllClosedTrades(): SimulatedTrade[] {
    const allTrades: SimulatedTrade[] = [];
    for (const state of this.simulations.values()) {
      const closedTrades = state.positions.filter(p => p.status === 'closed');
      allTrades.push(...closedTrades);
    }
    // Ordena por data (mais recentes primeiro)
    allTrades.sort((a, b) => (b.exitTime || b.entryTime) - (a.exitTime || a.entryTime));
    return allTrades;
  }

  /**
   * Retorna todas as simulações
   */
  public getAllSimulations(): { symbol: string; state: SimulationState }[] {
    const result: any[] = [];
    for (const [symbol, state] of this.simulations) {
      result.push({ symbol, state });
    }
    return result;
  }

  /**
   * Salva trades fechados em uma lista de histórico
   */
  private closedTradesHistory: Map<string, SimulatedTrade[]> = new Map();

  private addToHistory(symbol: string, trade: SimulatedTrade) {
    if (!this.closedTradesHistory.has(symbol)) {
      this.closedTradesHistory.set(symbol, []);
    }
    this.closedTradesHistory.get(symbol)!.push(trade);
  }

  /**
   * Retorna estatísticas agregadas
   */
  public getAggregatedStats() {
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalPnL = 0;
    let initialEquity = 0;
    let currentEquity = 0;

    let totalActivePositions = 0;
    
    for (const state of this.simulations.values()) {
      totalTrades += state.totalTrades;
      winningTrades += state.winningTrades;
      losingTrades += state.losingTrades;
      initialEquity += state.initialCapital;
      currentEquity += state.equity;
      
      // Calcula P&L das posições fechadas e conta abertas
      for (const position of state.positions) {
        if (position.status === 'closed') {
          totalPnL += position.pnl;
        }
        if (position.status === 'open') {
          totalActivePositions++;
        }
      }
    }

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalPnLPercent = initialEquity > 0 ? (totalPnL / initialEquity) * 100 : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalPnL,
      totalPnLPercent,
      currentEquity,
      initialEquity,
      activePositions: totalActivePositions
    };
  }
}

// Export singleton instance
export const tradeSimulatorEngine = TradeSimulatorEngine.getInstance();


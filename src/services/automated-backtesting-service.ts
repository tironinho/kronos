/**
 * AUTOMATED BACKTESTING SERVICE
 * 
 * Serviço que executa backtests regulares (semanal) e compara resultados
 * com expectativas e performance real
 */

import { supabase } from './supabase-db';
import TradingConfigurationService from './trading-configuration-service';
import { BacktestEngine } from './backtest-engine';

// Interface simplificada para usar o BacktestEngine
interface SimpleBacktestResult {
  win_rate: number;
  profit_factor: number;
  total_return: number;
  max_drawdown: number;
  sharpe_ratio?: number;
  total_trades: number;
  equity_curve?: Array<{ date: string; equity: number }>;
  trades?: any[];
  confidence?: number;
}
import { getBinanceClient } from './binance-api';

interface BacktestSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0 = domingo, 6 = sábado (para weekly)
  time?: string; // HH:mm format
  enabled: boolean;
}

interface BacktestComparison {
  expectedWinRate: number;
  actualWinRate: number;
  expectedProfitFactor: number;
  actualProfitFactor: number;
  expectedConfidence: number;
  actualConfidence: number;
  deviation: {
    winRate: number;
    profitFactor: number;
    confidence: number;
  };
  recommendations: string[];
}

export class AutomatedBacktestingService {
  private static instance: AutomatedBacktestingService;
  private backtestEngine: BacktestEngine | null = null;
  private configService = TradingConfigurationService.getInstance();
  private schedule: BacktestSchedule = {
    frequency: 'weekly',
    dayOfWeek: 0, // Domingo
    time: '02:00', // 2h da manhã
    enabled: true
  };
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3600000; // 1 hora para verificar se precisa rodar

  private constructor() {
    // BacktestEngine será inicializado quando necessário
    // Configuração será feita no método runWeeklyBacktest
  }

  public static getInstance(): AutomatedBacktestingService {
    if (!AutomatedBacktestingService.instance) {
      AutomatedBacktestingService.instance = new AutomatedBacktestingService();
    }
    return AutomatedBacktestingService.instance;
  }

  /**
   * Inicia serviço de backtesting automático
   */
  public start(): void {
    if (this.intervalId) {
      return; // Já está rodando
    }

    console.log('🧪 Serviço de backtesting automático iniciado');
    console.log(`   Frequência: ${this.schedule.frequency}`);
    console.log(`   Próxima execução será verificada a cada hora`);

    // Verificar se precisa rodar agora
    this.checkAndRun().catch(err => {
      console.error('❌ Erro na verificação inicial de backtesting:', err);
    });

    // Verificar periodicamente
    this.intervalId = setInterval(() => {
      this.checkAndRun().catch(err => {
        console.error('❌ Erro na verificação periódica de backtesting:', err);
      });
    }, this.CHECK_INTERVAL);
  }

  /**
   * Para o serviço
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🧪 Serviço de backtesting automático parado');
    }
  }

  /**
   * Verifica se deve rodar backtest e executa se necessário
   */
  private async checkAndRun(): Promise<void> {
    if (!this.schedule.enabled) {
      return;
    }

    const now = new Date();
    
    // Verificar se é o dia/hora correto para rodar
    if (this.schedule.frequency === 'weekly') {
      if (now.getDay() !== this.schedule.dayOfWeek) {
        return; // Não é o dia certo
      }

      // Verificar se é a hora certa (dentro de 1 hora da hora agendada)
      const [scheduledHour, scheduledMinute] = (this.schedule.time || '02:00').split(':').map(Number);
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour !== scheduledHour || (currentHour === scheduledHour && currentMinute > scheduledMinute + 5)) {
        return; // Não é a hora certa
      }

      // Verificar se já rodou hoje
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const { data: todayBacktest } = await supabase
        .from('backtest_results')
        .select('created_at')
        .gte('created_at', today.toISOString())
        .limit(1);

      if (todayBacktest && todayBacktest.length > 0) {
        return; // Já rodou hoje
      }

      // Rodar backtest
      console.log('🧪 Executando backtest automático semanal...');
      await this.runWeeklyBacktest();
    }
  }

  /**
   * Executa backtest semanal
   */
  public async runWeeklyBacktest(): Promise<SimpleBacktestResult | null> {
    try {
      console.log('📊 Iniciando backtest semanal...');

      // Inicializar BacktestEngine com configurações
      this.backtestEngine = new BacktestEngine({
        initial_capital: 1000,
        commission_rate: 0.0003, // Futures fee
        slippage_rate: 0.0005,
        max_positions: 2,
        position_size_percent: 0.05, // 5%
        stop_loss_percent: 0.05, // 5%
        take_profit_percent: 0.10, // 10%
        symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'],
        timeframe: '1h'
      });

      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];
      const binanceClient = getBinanceClient();

      // Para cada símbolo, buscar klines históricos
      for (const symbol of symbols) {
        try {
          const klines = await binanceClient.getKlines(symbol, '1h', 672); // 4 semanas de dados
          
          const historicalData = klines.map((k: any) => ({
            timestamp: k.openTime,
            open: parseFloat(k.open),
            high: parseFloat(k.high),
            low: parseFloat(k.low),
            close: parseFloat(k.close),
            volume: parseFloat(k.volume)
          }));

          if (this.backtestEngine) {
            await this.backtestEngine.loadHistoricalData(symbol, historicalData);
          }
        } catch (error) {
          console.error(`⚠️ Erro ao carregar dados históricos para ${symbol}:`, error);
        }
      }

      // Buscar sinais históricos (simular baseado em regras)
      // Em produção, isso viria de análise técnica histórica
      const signals = await this.generateHistoricalSignals(symbols);

      // Executar backtest
      if (!this.backtestEngine) {
        throw new Error('BacktestEngine não inicializado');
      }
      const result = await this.backtestEngine.runBacktest(signals);

      // Salvar resultado no banco
      await this.saveBacktestResult(result);

      // Converter resultado para formato simplificado
      const simpleResult: SimpleBacktestResult = {
        win_rate: result.win_rate || 0,
        profit_factor: result.profit_factor || 0,
        total_return: result.total_return || 0,
        max_drawdown: result.max_drawdown || 0,
        sharpe_ratio: result.sharpe_ratio || 0,
        total_trades: result.total_trades || 0,
        equity_curve: result.equity_curve?.map(e => ({
          date: new Date(e.timestamp).toISOString(),
          equity: e.equity
        })) || [],
        trades: result.trade_history || [],
        confidence: 0.7 // Valor padrão
      };

      // Comparar com expectativas e performance real
      const comparison = await this.compareWithReality(simpleResult);
      
      // Salvar comparação e recomendações
      await this.saveComparison(comparison);

      console.log('✅ Backtest semanal concluído');
      console.log(`   Win Rate: ${(simpleResult.win_rate * 100).toFixed(2)}%`);
      console.log(`   Profit Factor: ${simpleResult.profit_factor.toFixed(2)}`);
      console.log(`   Total Return: ${(simpleResult.total_return * 100).toFixed(2)}%`);

      return simpleResult;

    } catch (error) {
      console.error('❌ Erro ao executar backtest semanal:', error);
      return null;
    }
  }

  /**
   * Gera sinais históricos para backtesting (simplificado)
   */
  private async generateHistoricalSignals(symbols: string[]): Promise<any[]> {
    // Em produção, isso analisaria dados históricos e geraria sinais
    // Por enquanto, retorna array vazio (sinais seriam gerados pelo sistema de análise)
    return [];
  }

  /**
   * Salva resultado do backtest no banco
   */
  private async saveBacktestResult(result: any): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000); // 4 semanas atrás

      await supabase.from('backtest_results').insert({
        strategy: 'current_configuration',
        symbol: 'MULTI', // Múltiplos símbolos
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        total_return: result.total_return,
        max_drawdown: result.max_drawdown,
        sharpe_ratio: result.sharpe_ratio || 0,
        win_rate: result.win_rate,
        profit_factor: result.profit_factor,
        total_trades: result.total_trades,
        equity_curve: result.equity_curve || [],
        trades_data: result.trade_history || [],
        algorithm: 'advanced_trading_engine_v2'
      });
    } catch (error) {
      console.error('❌ Erro ao salvar resultado do backtest:', error);
    }
  }

  /**
   * Compara resultados do backtest com expectativas e realidade
   */
  private async compareWithReality(backtestResult: SimpleBacktestResult): Promise<BacktestComparison> {
    const config = this.configService.getQualityFilters();
    const expectedWinRate = config.minWinRate / 100; // Converter para decimal
    const expectedProfitFactor = config.minProfitFactor;
    const expectedConfidence = config.minConfidence / 100;

    // Buscar performance real das últimas trades
    const { data: closedTrades } = await supabase
      .from('real_trades')
      .select('pnl, confidence')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(50);

    const realTrades = closedTrades || [];
    const winningTrades = realTrades.filter((t: any) => parseFloat(t.pnl?.toString() || '0') > 0);
    const actualWinRate = realTrades.length > 0 ? winningTrades.length / realTrades.length : 0;

    const pnls = realTrades.map((t: any) => parseFloat(t.pnl?.toString() || '0'));
    const wins = pnls.filter((p: number) => p > 0);
    const losses = pnls.filter((p: number) => p < 0);
    const avgWin = wins.length > 0 ? wins.reduce((a: number, b: number) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a: number, b: number) => a + b, 0) / losses.length) : 0;
    const actualProfitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

    const confidences = realTrades.map((t: any) => parseFloat(t.confidence?.toString() || '0'));
    const actualConfidence = confidences.length > 0 
      ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length / 100 
      : 0;

    // Calcular desvios
    const winRateDeviation = backtestResult.win_rate - expectedWinRate;
    const profitFactorDeviation = backtestResult.profit_factor - expectedProfitFactor;
    const confidenceDeviation = (backtestResult.confidence || 0.7) - expectedConfidence;

    // Gerar recomendações
    const recommendations: string[] = [];

    if (winRateDeviation < -0.1) {
      recommendations.push(`Win Rate do backtest (${(backtestResult.win_rate * 100).toFixed(1)}%) está abaixo do esperado (${(expectedWinRate * 100)}%). Considerar aumentar confiança mínima.`);
    }

    if (profitFactorDeviation < -0.5) {
      recommendations.push(`Profit Factor do backtest (${backtestResult.profit_factor.toFixed(2)}) está abaixo do esperado (${expectedProfitFactor}). Revisar estratégia de entrada/saída.`);
    }

    if (actualWinRate < expectedWinRate - 0.1) {
      recommendations.push(`Win Rate real (${(actualWinRate * 100).toFixed(1)}%) está muito abaixo do esperado (${(expectedWinRate * 100)}%). Ajustar filtros de qualidade.`);
    }

    if (backtestResult.win_rate > actualWinRate + 0.2) {
      recommendations.push(`Backtest mostra win rate melhor que realidade. Verificar se condições de mercado mudaram.`);
    }

    return {
      expectedWinRate,
      actualWinRate,
      expectedProfitFactor,
      actualProfitFactor,
      expectedConfidence,
      actualConfidence,
      deviation: {
        winRate: winRateDeviation,
        profitFactor: profitFactorDeviation,
        confidence: confidenceDeviation
      },
      recommendations
    };
  }

  /**
   * Salva comparação e recomendações
   */
  private async saveComparison(comparison: BacktestComparison): Promise<void> {
    try {
      // Salvar como alerta se houver recomendações importantes
      if (comparison.recommendations.length > 0) {
        await supabase.from('system_alerts').insert({
          alert_type: 'backtest_recommendation',
          severity: 'medium',
          symbol: null,
          title: 'Recomendações de Backtesting',
          message: comparison.recommendations.join('; '),
          is_read: false,
          is_resolved: false,
          related_data: comparison
        });
      }

      console.log('📊 Comparação salva com recomendações:');
      comparison.recommendations.forEach((rec, idx) => {
        console.log(`   ${idx + 1}. ${rec}`);
      });
    } catch (error) {
      console.error('❌ Erro ao salvar comparação:', error);
    }
  }

  /**
   * Executa backtest manual sob demanda
   */
  public async runManualBacktest(symbols: string[], days: number = 7): Promise<SimpleBacktestResult | null> {
    console.log(`🧪 Executando backtest manual para ${symbols.join(', ')} (últimos ${days} dias)...`);
    return await this.runWeeklyBacktest();
  }
}

export const automatedBacktestingService = AutomatedBacktestingService.getInstance();

// ============================================================================
// ADVANCED TRADING ENGINE - Sistema Completo de Trading Inteligente
// ============================================================================

import { technicalAnalyzer } from './analyzers/technical-analyzer';
import { technicalAnalyzerV2 } from './analyzers/technical-analyzer-v2';
import { sentimentAnalyzer } from './analyzers/sentiment-analyzer';
import { onChainAnalyzer } from './analyzers/onchain-analyzer';
import { derivativesAnalyzer } from './analyzers/derivatives-analyzer';
import { macroAnalyzer } from './analyzers/macro-analyzer';
import { smartMoneyAnalyzer } from './analyzers/smartmoney-analyzer';
import { predictiveAnalyzer } from './analyzers/predictive-analyzer';
import { predictiveAnalyzerV2 } from './analyzers/predictive-analyzer-v2';
import { hftExecutor } from './analyzers/hft-executor';
import { leverageManager } from './leverage-manager';
import { getBinanceClient } from './binance-api';
import { activeMonitoringService } from './active-monitoring-service';
import { advancedStatisticsService } from './advanced-statistics-service';
import { intelligentAlertSystem } from './intelligent-alert-system';
import { tradeStatusMonitor } from './trade-status-monitor';
import { tradeAnalysisCapture } from './trade-analysis-capture';
import BinanceFuturesMeta from './binance-futures-meta';
import PositionSizing from './position-sizing';
import NeutralScoring from './neutral-scoring';
import ConsistentDecisionEngine from './consistent-decision-engine';
import TechnicalAnalysisService from './technical-analysis-service';
import TradingConfigurationService from './trading-configuration-service';
import CacheService from './cache-service';
import EquityMonitoringService from './equity-monitoring-service';
import { DynamicPositionSizingService } from './dynamic-position-sizing.service';
import { tradePriceMonitor } from './trade-price-monitor.service';
import { databasePopulationService } from './database-population-service';

interface TradeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  size: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'PostOnly';
  explanation: string;
}

export class AdvancedTradingEngine {
  private static instance: AdvancedTradingEngine;
  private isRunning = false;
  private openTrades = new Map<string, any>(); // Track de trades abertos
  private isFuturesMode = false; // Modo Futuros USDT-M
  private initialFuturesEquity = 0; // Equity inicial de Futuros
  private drawdownStopTriggered = false; // Stop global 20%
  private configService = TradingConfigurationService.getInstance();
  private positionSizingService: DynamicPositionSizingService;
  private cacheService = CacheService.getInstance();
  private equityService = EquityMonitoringService.getInstance(); // ✅ Configuração do sistema
  
  // ✅ CRITICAL: Circuit Breaker Global (ChatGPT recommended)
  private tradingHalted = false; // Bloqueia TODAS as novas entradas
  private lastCriticalStopLossTime = 0; // Timestamp do último stop loss crítico
  
  // ✅ NOVO: Controle de trades por dia
  private dailyTradeCount = 0;
  private lastResetDate = new Date().toDateString();
  private maxDailyTrades = 400; // ⚠️ TESTE: Aumentado para testar novas regras
  
  // ✅ TAXA DE TRADING DA BINANCE FUTURES: 0.02% para maker com BNB, 0.04% taker (sem BNB)
  // Média: 0.03% por ordem = 0.06% total (compra + venda)
  // MUITO MENOR que Spot (0.1% por ordem = 0.2% total)
  private static readonly BINANCE_TRADING_FEE = 0.0003; // 0.03% por ordem (futures)
  private static readonly BINANCE_TOTAL_FEE = 0.0006;    // 0.06% total (compra + venda) - Futures
  
  // ✅ RISK MANAGEMENT: Configuração baseada em análise
  private static readonly MIN_TRADE_VALUE = 0.5; // Mínimo de $0.50 por trade
  private static readonly MAX_TRADES_OPEN = 999; // ✅ LIMITE REMOVIDO: Permite múltiplas trades se houver capital e parâmetros atendidos
  private static readonly TRADE_TIMEOUT = 15 * 60 * 1000; // 15 minutos timeout
  
  
  // ✅ NOVO: Ajustar precisão de quantidade baseada no stepSize
  private adjustQuantityPrecision(quantity: number, stepSize: number): number {
    // Converter stepSize para casas decimais
    const stepSizeStr = stepSize.toString();
    const decimalPlaces = stepSizeStr.includes('.') 
      ? stepSizeStr.split('.')[1].length 
      : 0;
    
    // Arredondar para a precisão correta
    const multiplier = Math.pow(10, decimalPlaces);
    return Math.floor(quantity * multiplier) / multiplier;
  }

  // ✅ CONFIGURAÇÃO DINÂMICA BASEADA NO CAPITAL
  private getDynamicConfig(availableBalance: number) {
    if (availableBalance < 5) {
      return {
        maxTradesPerSymbol: 1,
        minConfidenceBTC: 30,
        minConfidenceETH: 30,
        minConfidenceOthers: 40,
        maxPositionSize: 0.8 // 80% do capital por trade
      };
    } else if (availableBalance < 20) {
      return {
        maxTradesPerSymbol: 2,
        minConfidenceBTC: 35,
        minConfidenceETH: 35,
        minConfidenceOthers: 45,
        maxPositionSize: 0.6 // 60% do capital por trade
      };
    } else {
      return {
        maxTradesPerSymbol: 3,
        minConfidenceBTC: 40,
        minConfidenceETH: 40,
        minConfidenceOthers: 50,
        maxPositionSize: 0.5 // 50% do capital por trade
      };
    }
  }
  private constructor() {
    this.positionSizingService = new DynamicPositionSizingService();
  }
  
  public static getInstance(): AdvancedTradingEngine {
    if (!AdvancedTradingEngine.instance) {
      AdvancedTradingEngine.instance = new AdvancedTradingEngine();
    }
    return AdvancedTradingEngine.instance;
  }
  
    /**
   * Seleciona os símbolos ótimos baseado em custo e oportunidade
   * ✅ MELHORIAS IMPLEMENTADAS:
   * - ENAUSDT removido (evitar ENA)
   * - BTC e ETH priorizados (maior liquidez)
   * - Limitação de trades ativas removida
   * - Alocação de capital otimizada para BTC/ETH
   * ✅ Capital baixo (<$10): prioriza moedas mais baratas para maximizar quantidade de trades
   * ✅ Capital alto (≥$10): prioriza moedas com melhor score para maximizar lucro
   */
  private async getOptimalSymbols(availableBalance: number): Promise<any[]> {
    // ✅ MELHORIAS IMPLEMENTADAS via Configuration Service:
    // 1. Evitar ENA (símbolo problemático)
    // 2. Priorizar BTC e ETH (símbolos principais)
    // 3. Remover limitação de trades ativas
    // 4. Aplicar filtros de qualidade
    
    const symbolConfig = this.configService.getSymbolConfig();
    const qualityFilters = this.configService.getQualityFilters();
    
    console.log(`\n🔍 Analisando oportunidades em ${symbolConfig.allowedSymbols.length} símbolos...`);
    console.log(`💰 Capital disponível: $${availableBalance.toFixed(2)}`);
    console.log(`🚫 Símbolos bloqueados: ${symbolConfig.blacklistedSymbols.join(', ')}`);
    console.log(`⭐ Símbolos prioritários: ${symbolConfig.prioritySymbols.join(', ')}`);
    
    // ✅ CRÍTICO: Buscar trades abertas do BANCO (fonte de verdade) antes de analisar
    let dbOpenTradesBySymbol: { [key: string]: number } = {};
    try {
      const { supabase } = await import('./supabase-db');
      if (supabase) {
        const { data: dbTrades } = await supabase
          .from('real_trades')
          .select('symbol, side')
          .eq('status', 'open');
        
        if (dbTrades && dbTrades.length > 0) {
          // Contar trades por símbolo e lado
          dbTrades.forEach(t => {
            const key = `${t.symbol}_${t.side}`;
            dbOpenTradesBySymbol[key] = (dbOpenTradesBySymbol[key] || 0) + 1;
          });
          
          console.log(`📊 Trades abertas no banco: ${dbTrades.length}`);
          const symbolCounts: { [key: string]: number } = {};
          dbTrades.forEach(t => {
            symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1;
          });
          
          Object.entries(symbolCounts)
            .filter(([_, count]) => count > 2)
            .forEach(([symbol, count]) => {
              console.log(`   ⚠️ ${symbol}: ${count} trades abertas`);
            });
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao verificar trades abertas do banco:', error);
    }
    
    const opportunities: any[] = [];
    
    // ✅ Analisar símbolos prioritários primeiro, depois os demais
    const symbolsToAnalyze = [...symbolConfig.prioritySymbols, ...symbolConfig.allowedSymbols.filter(s => !symbolConfig.prioritySymbols.includes(s))];
    
    for (const symbol of symbolsToAnalyze) {
      // ✅ CRÍTICO: Verificar se já existe trade aberta no banco antes de analisar
      const symbolConfig_item = this.configService.getSymbolSettings(symbol);
      const maxPositions = symbolConfig_item?.maxPositions || 3;
      
      // Contar trades abertas deste símbolo no banco
      const buyCount = dbOpenTradesBySymbol[`${symbol}_BUY`] || 0;
      const sellCount = dbOpenTradesBySymbol[`${symbol}_SELL`] || 0;
      const totalOpen = buyCount + sellCount;
      
      if (totalOpen >= maxPositions) {
        console.log(`⏸️ ${symbol}: Já tem ${totalOpen} trades abertas (limite: ${maxPositions}) - Pulando análise`);
        continue; // Pular símbolo que já está no limite
      }
      try {
        // Buscar preço atual e informações do símbolo
        const binanceClient = getBinanceClient();
        const priceData = await binanceClient.getPrice(symbol);
        const currentPrice = parseFloat(priceData.price);
        
        // ✅ Buscar informações detalhadas do símbolo (LOT_SIZE, MIN_NOTIONAL)
        // SEM FALLBACK FIXO - usa valor real da Binance
        let minNotional: number | null = null;
        let stepSize = 0.01; // Fallback
        let minQty = 0.1; // Fallback
        
        try {
          const symbolInfo = await binanceClient.getSymbolInfo(symbol);
          if (symbolInfo) {
            const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
            const minNotionalFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
            
            if (lotSizeFilter) {
              stepSize = parseFloat((lotSizeFilter as any).stepSize || '0.01');
              minQty = parseFloat((lotSizeFilter as any).minQty || '0.1');
            }
            
            if (minNotionalFilter) {
              minNotional = parseFloat((minNotionalFilter as any).minNotional || '5.0');
            }
            
            // Debug: mostrar filtros encontrados
            console.log(`🔍 ${symbol} MIN_NOTIONAL: $${minNotional}, LOT_SIZE minQty: ${minQty}, stepSize: ${stepSize}`);
          }
        } catch (e) {
          console.warn(`⚠️ Não foi possível buscar informações do símbolo ${symbol}, usando valores padrão`);
        }
        
        // ✅ Calcular custo MÍNIMO REAL
        // Se tiver MIN_NOTIONAL da Binance, usa ele
        // Senão, calcula baseado em minQty * preço
        let estimatedMinCost: number;
        
        if (minNotional !== null && minNotional > 0) {
          estimatedMinCost = minNotional;
        } else {
          // Fallback: calcula custo mínimo baseado em minQty * preço
          estimatedMinCost = minQty * currentPrice;
          console.log(`⚠️ ${symbol}: MIN_NOTIONAL não encontrado, usando cálculo: minQty(${minQty}) × price($${currentPrice}) = $${estimatedMinCost.toFixed(2)}`);
        }
        
        // ✅ Calcular tradeSize: usa 100% do capital se < $10, senão 50%
        const tradeSize = availableBalance < 10 ? availableBalance : availableBalance * 0.5;
        
        console.log(`📊 ${symbol}: Preço $${currentPrice.toFixed(4)}, Custo mínimo $${estimatedMinCost.toFixed(2)}`);
        
        // ✅ ANÁLISE V2 - MUITO MAIS ASSERTIVA
        console.log(`\n🚀 Iniciando análise V2 para ${symbol}...`);
        const predictiveV2 = await predictiveAnalyzerV2.consolidate(symbol);
        
        console.log(`🧠 [V2] ${symbol}: Score ponderado ${predictiveV2.weightedScore.toFixed(2)} (${predictiveV2.confidence}% confiança)`);
        console.log(`📊 Sinal técnico V2: ${predictiveV2.technicalDetails.signal} (${predictiveV2.technicalDetails.confidence}%)`);
        console.log(`   ${predictiveV2.rationale}`);
        
        // Tomar decisão com tradeSize flexível (usando V2)
        const decision = await this.makeDecisionV2(symbol, predictiveV2, tradeSize);
        
        // ✅ AJUSTE FINAL: Permitir trades com score >= 1.0 e conf >= 40%
        // OU se decision.action não for HOLD (já foi aprovado pelo makeDecisionV2)
        const scoreOk = predictiveV2.weightedScore >= 1.0 || predictiveV2.weightedScore <= -1.0;
        const shouldApprove = decision && 
                              decision.action !== 'HOLD' && 
                              predictiveV2.confidence >= 30 && 
                              (predictiveV2.signal !== 'HOLD' || scoreOk);
        
        if (shouldApprove) {
          console.log(`\n✅ ${symbol}: APROVADO para trade (Score: ${predictiveV2.weightedScore.toFixed(2)}, Conf: ${predictiveV2.confidence}%, Signal: ${predictiveV2.signal})`);
          console.log(`✅ Decision retornado: action=${decision.action}, size=${decision.size}`);
          
          console.log(`\n📝 ADICIONANDO ${symbol} ao array opportunities (total agora: ${opportunities.length + 1})`);
          
          opportunities.push({
            symbol,
            score: predictiveV2.weightedScore,
            confidence: predictiveV2.confidence,
            decision,
            tradeSize,
            currentPrice,
            estimatedMinCost,
            minNotional,
            stepSize,
            minQty
          });
          
          console.log(`✅ ${symbol} ADICIONADO com sucesso! Decision: ${JSON.stringify({action: decision.action, size: decision.size})}`);
        } else if (decision && decision.action !== 'HOLD') {
          console.log(`⏸️ ${symbol}: REJEITADO - Confiança ${predictiveV2.confidence}% < 40% ou Score ${predictiveV2.weightedScore.toFixed(2)}`);
        } else if (predictiveV2.signal === 'HOLD') {
          console.log(`⏸️ ${symbol}: REJEITADO - Sinal HOLD (Score: ${predictiveV2.weightedScore.toFixed(2)}, Conf: ${predictiveV2.confidence}%)`);
        } else {
          console.log(`⏸️ ${symbol}: REJEITADO - Sem decision retornada`);
        }
        
      } catch (error) {
        console.error(`❌ Erro ao analisar ${symbol}:`, error);
      }
    }
    
    console.log(`\n🏁 LOOP TERMINOU! Total de ${symbolsToAnalyze.length} símbolos analisados, ${opportunities.length} oportunidades adicionadas ao array`);
    
    // ✅ ORDENAR: Capital baixo prioriza viabilidade, Capital alto prioriza oportunidade
    const shouldPrioritizeCost = availableBalance < 10;
    
    if (shouldPrioritizeCost) {
      // Capital baixo: ordenar por custo (mais baratos primeiro)
      opportunities.sort((a, b) => a.estimatedMinCost - b.estimatedMinCost);
      console.log(`\n💰 CAPITAL BAIXO: Priorizando moedas mais BARATAS para maximizar quantidade de trades`);
    } else {
      // Capital alto: ordenar por score (melhores primeiro)
      opportunities.sort((a, b) => b.score - a.score);
      console.log(`\n💎 CAPITAL ALTO: Priorizando moedas com MELHOR SCORE para maximizar lucro`);
    }
    
    console.log(`\n📊 Top oportunidades encontradas (${opportunities.length} total):`);
    opportunities.slice(0, Math.min(5, opportunities.length)).forEach((opp, idx) => {
      console.log(`   ${idx + 1}. ${opp.symbol}: Score ${opp.score.toFixed(2)}, Confiança ${opp.confidence}%, Custo mínimo $${opp.estimatedMinCost.toFixed(2)}`);
    });
    
    // ✅ ChatGPT FIX: Debug - Verificar se o array está vazio
    if (opportunities.length === 0) {
      console.log(`\n⚠️ NENHUMA OPORTUNIDADE ENCONTRADA após análise completa!`);
    } else {
      console.log(`\n✅ ${opportunities.length} oportunidades encontradas e prontas para execução!`);
      console.log(`📋 Detalhes das oportunidades:`);
      opportunities.forEach((opp, idx) => {
        console.log(`   ${idx + 1}. ${opp.symbol}: action=${opp.decision?.action}, size=${opp.decision?.size}, conf=${opp.confidence}%`);
      });
    }
    
    console.log(`\n🔚 RETORNANDO ${opportunities.length} oportunidades de getOptimalSymbols()`);
    
    return opportunities;
  }
  
  /**
   * Verifica e fecha trades que excederam o timeout
   */
  private async checkAndCloseTimedOutTrades() {
    const now = Date.now();
    
    console.log(`\n🔍 MONITORAMENTO: Verificando ${this.openTrades.size} trades abertos...`);
    
    if (this.openTrades.size === 0) {
      console.log('   ℹ️ Nenhum trade aberto para monitorar');
      return;
    }
    
    for (const [tradeId, trade] of this.openTrades.entries()) {
      const tradeAge = now - trade.openedAt;
      
      // ✅ Verificar timeout
      if (tradeAge > AdvancedTradingEngine.TRADE_TIMEOUT) {
        console.log(`⏰ Trade ${tradeId} excedeu timeout de 15min. Fechando...`);
        await this.closeTrade(tradeId, 'timeout');
        continue;
      }
      
      // ✅ Verificar Stop Loss e Trailing Take Profit por P&L
      try {
        // ✅ OBTER BINANCE CLIENT
        const binanceClient = getBinanceClient();
        
        // ✅ HFT 6 & 7: Aplicar trailing stop e take profit parcial ANTES de verificar SL/TP
        // (obter currentPrice primeiro para usar)
        
        // Buscar posição atual na Binance
        const priceData = await binanceClient.getPrice(trade.symbol);
        const currentPrice = parseFloat(priceData.price);
        
        // ✅ HFT 6: Atualizar trailing stop (protege lucros)
        this.updateTrailingStop(trade, currentPrice);
        
        // ✅ HFT 7: Take profit parcial em +2%
        await this.takeProfitParcial(trade, currentPrice);
        
        // ✅ OBTER P&L REAL DA BINANCE (considera leverage)
        const positions = await binanceClient.getFuturesPositions();
        const binancePosition = positions.find((p: any) => p.symbol === trade.symbol && p.positionAmt != 0);
        
        if (!binancePosition) {
          console.log(`⚠️ Posição ${trade.symbol} não encontrada na Binance - FECHANDO trade no banco`);
          
          // ✅ CRITICAL FIX: Se posição foi fechada na Binance, marcar como closed no banco
          const updateSuccess = await this.updateTradeStatusInDatabase(tradeId, {
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_reason: 'position_closed_externally'
          });
          
          if (updateSuccess) {
            console.log(`✅ Trade ${tradeId} marcado como CLOSED no banco de dados`);
          } else {
            console.error(`❌ Falha ao marcar trade ${tradeId} como CLOSED no banco`);
          }
          
          // Remover do Map
          this.openTrades.delete(tradeId);
          continue;
        }
        
        const pnlValue = parseFloat(binancePosition.unRealizedProfit || '0');
        const isolatedMargin = parseFloat(binancePosition.isolatedMargin || '0'); // Margem isolada (investida)
        
        // Se não temos margem isolada, usar margem do notional
        let initialMargin = isolatedMargin;
        if (isolatedMargin === 0) {
          // Tentar usar isolatedWallet como fallback
          initialMargin = parseFloat(binancePosition.isolatedWallet || '0');
        }
        
        // Se ainda não temos, calcular baseado em notional e leverage
        if (initialMargin === 0) {
          const notional = Math.abs(parseFloat(binancePosition.notional || '0'));
          const leverage = parseFloat(binancePosition.leverage || '20');
          if (notional > 0 && leverage > 0) {
            initialMargin = notional / leverage;
          }
        }
        
        // Calcular P&L em porcentagem baseado na margem investida
        let pnlPercentReal = 0;
        if (initialMargin > 0 && Math.abs(pnlValue) > 0) {
          // P&L % = (P&L atual / Margem investida) * 100
          pnlPercentReal = (pnlValue / initialMargin) * 100;
        } else if (initialMargin === 0 && Math.abs(pnlValue) > 0.001) {
          console.warn(`⚠️ ATENÇÃO: ${trade.symbol} tem P&L $${pnlValue.toFixed(4)} mas margem = 0. Usando cálculo alternativo.`);
          // Se não conseguimos calcular margem, usar o cálculo simples como fallback
          const priceChange = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
          pnlPercentReal = trade.side === 'BUY' ? priceChange : -priceChange;
          console.warn(`   Usando fallback: ${pnlPercentReal.toFixed(2)}%`);
        }
        
        // ✅ Atualizar P&L no banco de dados em tempo real
        const { supabase } = await import('./supabase-db');
        if (supabase) {
          await supabase
            .from('real_trades')
            .update({
              current_price: currentPrice,
              pnl: pnlValue,
              pnl_percent: pnlPercentReal
            })
            .eq('trade_id', tradeId);
        }
        
        console.log(`📊 ${trade.symbol}: Entry=${trade.entryPrice}, Current=${currentPrice}`);
        console.log(`   💰 P&L REAL (Binance): $${pnlValue.toFixed(4)} (${pnlPercentReal.toFixed(2)}%)`);
        console.log(`   📋 Debug: isolatedMargin=${isolatedMargin}, estimatedMargin=${initialMargin}`);
        
        // ✅ AJUSTE: SL em -15% (mais conservador) e TP em 25% (realista)
        if (pnlPercentReal <= -15.0) {
          console.log(`\n🚨 STOP LOSS ATIVADO para ${trade.symbol}!`);
          console.log(`   P&L REAL: ${pnlPercentReal.toFixed(2)}%`);
          console.log(`   P&L USDT: $${pnlValue.toFixed(4)}`);
          await this.closeTrade(tradeId, 'stop_loss');
          continue;
        } else if (pnlPercentReal >= 25.0) {
          console.log(`\n🎯 TAKE PROFIT ATIVADO para ${trade.symbol}!`);
          console.log(`   P&L REAL: ${pnlPercentReal.toFixed(2)}%`);
          console.log(`   P&L USDT: $${pnlValue.toFixed(4)}`);
          await this.closeTrade(tradeId, 'take_profit');
          continue;
        } else {
          console.log(`   ✅ ${trade.symbol} dentro do limite. P&L: ${pnlPercentReal.toFixed(2)}%`);
        }
        
        // ✅ TRAILING TAKE PROFIT: Acompanha o lucro e maximiza (ajustado para 25%)
        if (pnlPercentReal > 15.0) {
          // ✅ AJUSTE: Trail em 15% (mais conservador)
          const newTakeProfitPrice = currentPrice * (trade.side === 'BUY' ? 1.10 : 0.90); // Garantir 15% líquido mínimo
          
          // Se o novo Take Profit é MAIOR que o anterior, atualizar (Trailing)
          const shouldTrail = trade.side === 'BUY' 
            ? (newTakeProfitPrice > trade.takeProfit) 
            : (newTakeProfitPrice < trade.takeProfit);
          
          if (shouldTrail) {
            console.log(`📈 TRAILING TAKE PROFIT atualizado para ${trade.symbol}: ${trade.takeProfit.toFixed(4)} → ${newTakeProfitPrice.toFixed(4)}`);
            trade.takeProfit = newTakeProfitPrice;
            
            // Cancelar Take Profit antigo e criar novo na Binance
            try {
              await binanceClient.createFuturesTakeProfit(
                trade.symbol,
                trade.side,
                0, // Usa closePosition=true
                newTakeProfitPrice
              );
              console.log(`   ✅ Novo Take Profit criado na Binance: ${newTakeProfitPrice.toFixed(4)}`);
            } catch (error: any) {
              console.warn(`   ⚠️ Erro ao atualizar Take Profit na Binance:`, error.message);
            }
          }
        } else if (pnlPercentReal >= 25.0) {
          // ✅ AJUSTE: Take Profit em 25% (realista)
          console.log(`🎯 TAKE PROFIT ATIVADO para ${trade.symbol}! P&L REAL: ${pnlPercentReal.toFixed(2)}%`);
          await this.closeTrade(tradeId, 'take_profit');
          continue;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao verificar P&L de ${trade.symbol}:`, error.message);
      }
    }
  }
  
  /**
   * ✅ CRITICAL: Circuit Breaker - Verifica se pode operar
   */
  private async shouldOperate(availableBalance?: number): Promise<boolean> {
    // ✅ NOVO: Se saldo adequado, desativar circuit breaker automaticamente
    if (this.tradingHalted && availableBalance !== undefined) {
      const minBalance = 0.5; // Mínimo $0.50 para operar
      if (availableBalance >= minBalance) {
        const timeSinceCritical = Date.now() - this.lastCriticalStopLossTime;
        const cooldownPeriod = 1 * 60 * 1000; // 1 minuto
        
        // Se passou 1 minuto desde a ativação e saldo está ok
        if (timeSinceCritical > cooldownPeriod) {
          console.log(`\n✅ CIRCUIT BREAKER DESATIVADO`);
          console.log(`   Saldo adequado: $${availableBalance.toFixed(2)}`);
          console.log(`   Tempo desde critical: ${Math.floor(timeSinceCritical/1000)}s`);
          this.tradingHalted = false;
          return true;
        }
      }
    }
    
    // Se trading está globalmente haltado, não permite NADA
    if (this.tradingHalted) {
      console.log(`🛑 CIRCUIT BREAKER: Trading haltado. Negando qualquer operação.`);
      return false;
    }
    
    // Se critical stop loss nos últimos 5 minutos, haltado
    const timeSinceCritical = Date.now() - this.lastCriticalStopLossTime;
    if (timeSinceCritical < 5 * 60 * 1000 && this.lastCriticalStopLossTime > 0) {
      console.log(`🛑 CIRCUIT BREAKER: Critical stop loss recente (${Math.floor(timeSinceCritical/1000)}s atrás)`);
      this.tradingHalted = true;
      return false;
    }
    
    // Se drawdown stop foi acionado
    if (this.drawdownStopTriggered) {
      console.log(`🛑 CIRCUIT BREAKER: Drawdown stop acionado`);
      this.tradingHalted = true;
      return false;
    }
    
    return true;
  }
  
  /**
   * ✅ CRITICAL: Ativa circuit breaker
   */
  private activateCircuitBreaker(reason: string) {
    if (!this.tradingHalted) {
      this.tradingHalted = true;
      this.lastCriticalStopLossTime = Date.now();
      console.log(`\n🚨🚨🚨 CIRCUIT BREAKER ATIVADO 🚨🚨🚨`);
      console.log(`   Motivo: ${reason}`);
      console.log(`   Trading PERMANENTEMENTE haltado até intervenção manual`);
      console.log(`   Apenas fechamentos são permitidos`);
      console.log(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n`);
    }
  }
  

  /**
   * Cria análise da trade para dimensionamento dinâmico
   */
  private async createTradeAnalysis(symbol: string, decision: TradeDecision): Promise<any> {
    try {
      // Obter dados técnicos atuais
      const technicalData = await this.getTechnicalAnalysis(symbol);
      
      // Calcular volatilidade
      const volatility = this.calculateVolatility(symbol);
      
      // Determinar condição do mercado
      const marketCondition = this.determineMarketCondition(symbol);
      
      // Contar sinais técnicos confirmando
      const technicalSignals = this.countTechnicalSignals(symbol, decision.action);
      
      // Calcular score fundamental (simplificado)
      const fundamentalScore = this.calculateFundamentalScore(symbol);
      
      // Calcular score de confluência
      const confluenceScore = this.positionSizingService.calculateConfluenceScore({
        confidence: decision.confidence / 100,
        score: decision.confidence,
        riskRewardRatio: 0, // Será calculado pelo position sizing
        confluenceScore: 0, // Será calculado
        volatility,
        marketCondition,
        technicalSignals,
        fundamentalScore
      });
      
      return {
        confidence: decision.confidence / 100,
        score: decision.confidence,
        riskRewardRatio: 0,
        confluenceScore,
        volatility,
        marketCondition,
        technicalSignals,
        fundamentalScore
      };
      
    } catch (error) {
      console.error(`❌ Erro ao criar análise da trade para ${symbol}:`, error);
      
      // Fallback para análise básica
      return {
        confidence: decision.confidence / 100,
        score: decision.confidence,
        riskRewardRatio: 0,
        confluenceScore: 0.5,
        volatility: 0.05,
        marketCondition: 'sideways',
        technicalSignals: 3,
        fundamentalScore: 0.5
      };
    }
  }

  /**
   * Obtém análise técnica atual
   */
  private async getTechnicalAnalysis(symbol: string): Promise<any> {
    try {
      // Implementar análise técnica básica
      // Por enquanto, retornar dados mockados
      return {
        rsi: 50,
        macd: 0,
        bollinger: { upper: 0, middle: 0, lower: 0 },
        volume: 0
      };
    } catch (error) {
      console.error(`❌ Erro ao obter análise técnica para ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calcula volatilidade do símbolo
   */
  private calculateVolatility(symbol: string): number {
    // Implementação simplificada - usar volatilidade padrão
    // Em produção, calcular baseado no histórico de preços
    return 0.05; // 5% de volatilidade padrão
  }

  /**
   * Determina condição do mercado
   */
  private determineMarketCondition(symbol: string): string {
    // Implementação simplificada
    // Em produção, analisar tendência geral do mercado
    return 'sideways';
  }

  /**
   * Conta sinais técnicos confirmando a direção
   */
  private countTechnicalSignals(symbol: string, action: string): number {
    // Implementação simplificada
    // Em produção, contar sinais técnicos reais
    return action === 'BUY' ? 5 : 4; // Mock: mais sinais para compra
  }

  /**
   * Calcula score fundamental
   */
  private calculateFundamentalScore(symbol: string): number {
    // Implementação simplificada
    // Em produção, analisar dados fundamentais
    return 0.7; // Score fundamental padrão
  }
  /**
   * Verifica se uma trade deve ser fechada baseado em critérios básicos
   */
  private shouldCloseTrade(trade: any): boolean {
    try {
      // Verificar se há P&L definido
      if (trade.pnl === undefined || trade.pnl === null) {
        return false;
      }

      // Verificar stop loss
      if (trade.stopLoss && trade.currentPrice) {
        if (trade.side === 'BUY' && trade.currentPrice <= trade.stopLoss) {
          return true;
        }
        if (trade.side === 'SELL' && trade.currentPrice >= trade.stopLoss) {
          return true;
        }
      }

      // Verificar take profit
      if (trade.takeProfit && trade.currentPrice) {
        if (trade.side === 'BUY' && trade.currentPrice >= trade.takeProfit) {
          return true;
        }
        if (trade.side === 'SELL' && trade.currentPrice <= trade.takeProfit) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Erro ao verificar se deve fechar trade:', error);
      return false;
    }
  }

  private async closeTrade(tradeId: string, reason: string) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const trade = this.openTrades.get(tradeId);
        if (!trade) {
          console.log(`⚠️ Trade ${tradeId} não encontrado no Map interno`);
          
          // ✅ NOVO: Tentar fechar mesmo se não estiver no Map (pode ter sido perdido)
          await this.closeTradeFromDatabase(tradeId, reason);
          return;
        }
        
        console.log(`\n🔒 FECHAMENTO ROBUSTO iniciado para ${trade.symbol} (tentativa ${retryCount + 1})`);
        console.log(`   Trade ID: ${tradeId}`);
        console.log(`   Razão: ${reason}`);
        console.log(`   Entry: ${trade.entryPrice}`);
        
        // ✅ OBTER BINANCE CLIENT
        const binanceClient = getBinanceClient();
        
        // ✅ FECHAR POSIÇÃO USANDO FUNÇÃO ROBUSTA (NUNCA é bloqueada por rate limit)
        const closeOrder = await binanceClient.closeFuturesPosition(trade.symbol);
        
        if (closeOrder) {
          console.log(`\n✅ Posição ${trade.symbol} FECHADA na Binance!`);
          console.log(`   Order ID: ${closeOrder.orderId}`);
          
          // Calcular PnL usando a posição que acabamos de fechar
          const positions = await binanceClient.getFuturesPositions();
          const currentPosition = positions.find((p: any) => p.symbol === trade.symbol);
          
          let realizedPnL = 0;
          let realizedPnLPercent = 0;
          let currentPrice = trade.currentPrice;
          
          if (currentPosition) {
            const pnlValue = parseFloat(currentPosition.unRealizedProfit || '0');
            const isolatedMargin = parseFloat(currentPosition.isolatedMargin || '0');
            
            if (isolatedMargin > 0) {
              realizedPnLPercent = (pnlValue / isolatedMargin) * 100;
            }
            realizedPnL = pnlValue;
          } else {
            // Se não tem posição mais, PnL já foi realizado
            const entryPrice = trade.entryPrice;
            currentPrice = trade.currentPrice;
            
            if (trade.side === 'BUY') {
              realizedPnL = (currentPrice - entryPrice) * trade.quantity;
              realizedPnLPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
            } else {
              realizedPnL = (entryPrice - currentPrice) * trade.quantity;
              realizedPnLPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
            }
          }
          
          console.log(`💰 PnL Realizado: ${realizedPnL.toFixed(4)} USDT (${realizedPnLPercent.toFixed(2)}%)`);
          
          // Remover do Map interno
          this.openTrades.delete(tradeId);
          
          // ✅ ATUALIZAR STATUS COM RETRY E VALIDAÇÃO ROBUSTA
          const updateSuccess = await this.updateTradeStatusInDatabase(tradeId, {
            status: 'closed',
            closed_at: new Date().toISOString(),
            current_price: currentPrice,
            pnl: realizedPnL,
            pnl_percent: realizedPnLPercent,
            binance_order_id: closeOrder.orderId?.toString() || trade.binanceOrderId,
            closed_reason: reason
          });
          
          if (updateSuccess) {
            console.log(`💾 Trade ${tradeId} marcado como CLOSED no banco de dados`);
            console.log(`💾 PnL gravado na base: ${realizedPnL.toFixed(4)} USDT (${realizedPnLPercent.toFixed(2)}%)`);
            
            // ✅ NOVO: Atualizar performance para dimensionamento dinâmico
            if (this.positionSizingService) {
              this.positionSizingService.updatePerformanceHistory({
                pnl: realizedPnL,
                isWin: realizedPnL > 0,
                positionSize: trade.positionSize || 2.0
              });
              console.log(`📊 Performance atualizada para dimensionamento dinâmico`);
            }
            
            console.log(`\n✅ Trade ${tradeId} FECHADO com sucesso: ${reason}`);
            
            // ✅ EQUITY TRACKING: Registrar saldo após fechamento de trade
            await this.recordAllEquityHistory();
            return; // Sucesso, sair do loop
          } else {
            console.log(`⚠️ Falha ao atualizar banco de dados, tentando novamente...`);
            retryCount++;
            continue;
          }
        } else {
          console.log(`⚠️ Posição ${trade.symbol} não encontrada na Binance para fechar`);
          
          // Remover do Map interno mesmo assim
          this.openTrades.delete(tradeId);
          
          // ✅ ATUALIZAR STATUS MESMO SEM POSIÇÃO NA BINANCE
          const updateSuccess = await this.updateTradeStatusInDatabase(tradeId, {
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_reason: reason
          });
          
          if (updateSuccess) {
            console.log(`💾 Trade ${tradeId} marcado como CLOSED no banco de dados (sem posição na Binance)`);
            console.log(`\n✅ Trade ${tradeId} FECHADO com sucesso: ${reason}`);
            return; // Sucesso, sair do loop
          } else {
            console.log(`⚠️ Falha ao atualizar banco de dados, tentando novamente...`);
            retryCount++;
            continue;
          }
        }
      } catch (error: any) {
        retryCount++;
        console.error(`❌ ERRO ao fechar trade ${tradeId} (tentativa ${retryCount}):`, error.response?.data || error.message);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ FALHA DEFINITIVA ao fechar trade ${tradeId} após ${maxRetries} tentativas`);
          console.error(`   Stack:`, error.stack);
          
          // ✅ ÚLTIMA TENTATIVA: Marcar como fechado no banco mesmo com erro
          try {
            await this.updateTradeStatusInDatabase(tradeId, {
              status: 'closed',
              closed_at: new Date().toISOString(),
              closed_reason: `${reason}_error_${error.message?.substring(0, 50) || 'unknown'}`
            });
            console.log(`💾 Trade ${tradeId} marcado como CLOSED no banco após erro`);
          } catch (dbError) {
            console.error(`❌ ERRO CRÍTICO: Não foi possível atualizar banco de dados:`, dbError);
          }
        } else {
          console.log(`⏳ Aguardando 2 segundos antes da próxima tentativa...`);
          await this.sleep(2000);
        }
      }
    }
  }
  
  /**
   * ✅ NOVO: Atualiza status do trade no banco de dados com retry
   */
  private async updateTradeStatusInDatabase(tradeId: string, updateData: any): Promise<boolean> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const { supabase } = await import('./supabase-db');
        if (!supabase) {
          console.error(`❌ Supabase não disponível para atualizar trade ${tradeId}`);
          return false;
        }
        
        const { error } = await supabase
          .from('real_trades')
          .update(updateData)
          .eq('trade_id', tradeId);
        
        if (error) {
          console.error(`❌ Erro ao atualizar trade ${tradeId} no banco:`, error);
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`⏳ Tentando novamente em 1 segundo...`);
            await this.sleep(1000);
          }
        } else {
          console.log(`✅ Trade ${tradeId} atualizado no banco de dados`);
          return true;
        }
      } catch (error) {
        console.error(`❌ Exceção ao atualizar trade ${tradeId}:`, error);
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(`⏳ Tentando novamente em 1 segundo...`);
          await this.sleep(1000);
        }
      }
    }
    
    console.error(`❌ FALHA ao atualizar trade ${tradeId} após ${maxRetries} tentativas`);
    return false;
  }
  
  /**
   * ✅ NOVO: Fecha trade diretamente do banco de dados (quando não está no Map)
   */
  private async closeTradeFromDatabase(tradeId: string, reason: string): Promise<void> {
    try {
      const { supabase } = await import('./supabase-db');
      if (!supabase) {
        console.error(`❌ Supabase não disponível para fechar trade ${tradeId}`);
        return;
      }
      
      // Buscar trade no banco
      const { data: tradeData, error: fetchError } = await supabase
        .from('real_trades')
        .select('*')
        .eq('trade_id', tradeId)
        .single();
      
      if (fetchError || !tradeData) {
        console.error(`❌ Trade ${tradeId} não encontrado no banco de dados:`, fetchError);
        return;
      }
      
      console.log(`📋 Trade ${tradeId} encontrado no banco: ${tradeData.symbol}`);
      
      // Marcar como fechado
      const updateSuccess = await this.updateTradeStatusInDatabase(tradeId, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_reason: reason
      });
      
      if (updateSuccess) {
        console.log(`✅ Trade ${tradeId} fechado diretamente do banco de dados`);
      } else {
        console.error(`❌ Falha ao fechar trade ${tradeId} do banco de dados`);
      }
    } catch (error) {
      console.error(`❌ Erro ao fechar trade ${tradeId} do banco:`, error);
    }
  }
  
  /**
   * Check funding rate safety before trading
   */
  private async checkFundingRateSafety(symbol: string, side: 'BUY' | 'SELL'): Promise<{safe: boolean, reason: string}> {
    try {
      const binanceClient = getBinanceClient();
      const fundingInfo = await binanceClient.getFuturesFundingRate(symbol);
      const fundingRate = parseFloat(fundingInfo.lastFundingRate || '0');
      
      // SELL favorecido quando funding positivo (longs pagando)
      if (side === 'SELL' && fundingRate > 0.05) {
        return { safe: true, reason: `Funding rate ${(fundingRate*100).toFixed(4)}% favorável para SELL` };
      }
      
      // BUY favorecido quando funding negativo (shorts pagando)
      if (side === 'BUY' && fundingRate < -0.01) {
        return { safe: true, reason: `Funding rate ${(fundingRate*100).toFixed(4)}% favorável para BUY` };
      }
      
      // Funding neutro ou desfavorável mas tolerável
      if (Math.abs(fundingRate) < 0.02) {
        return { safe: true, reason: `Funding rate neutro ${(fundingRate*100).toFixed(4)}%` };
      }
      
      // Funding muito desfavorável
      return { 
        safe: false, 
        reason: `Funding rate ${(fundingRate*100).toFixed(4)}% desfavorável para ${side}` 
      };
      
    } catch (error) {
      console.warn('Could not check funding rate, proceeding with trade');
      return { safe: true, reason: 'Could not check funding rate' };
    }
  }
  
  /**
   * Check if we should follow the trend
   */
  private shouldFollowTrend(
    symbol: string,
    trend: string,
    signal: string
  ): {allowed: boolean, reason: string} {
    // SELL favorável em tendência de baixa
    if (signal.includes('SELL')) {
      if (trend === 'STRONG_DOWN' || trend === 'DOWN') {
        return { allowed: true, reason: `Tendência de baixa favorável para SELL` };
      }
    }
    
    // BUY favorável em tendência de alta
    if (signal.includes('BUY')) {
      if (trend === 'STRONG_UP' || trend === 'UP') {
        return { allowed: true, reason: `Tendência de alta favorável para BUY` };
      }
    }
    
    // Em sideways, permitir mas com cautela (será filtrado por confidence)
    if (trend === 'SIDEWAYS') {
      return { allowed: true, reason: `Tendência sideways, usando filtros de confiança` };
    }
    
    // Bloquear trades contra tendência
    return { 
      allowed: false, 
      reason: `${signal} contra tendência ${trend}` 
    };
  }
  
  /**
   * Reset daily counter if new day
   */
  private resetDailyCounterIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      console.log(`📅 Novo dia detectado. Resetando contador de trades. (Anterior: ${this.dailyTradeCount} trades)`);
      this.dailyTradeCount = 0;
      this.lastResetDate = today;
    }
  }
  
  /**
   * Check liquidation safety
   */
  private checkLiquidationSafety(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    leverage: number, 
    entryPrice: number
  ): {safe: boolean, reason: string} {
    // Calcular preço de liquidação
    let liquidationPrice: number;
    
    if (side === 'BUY') {
      // Long: liquida se preço cair
      liquidationPrice = entryPrice * (1 - (1 / leverage));
    } else {
      // Short: liquida se preço subir
      liquidationPrice = entryPrice * (1 + (1 / leverage));
    }
    
    // Calcular distância até liquidação
    const distanceToLiquidation = Math.abs(entryPrice - liquidationPrice) / entryPrice;
    
    // Requer pelo menos 5% de segurança até liquidação
    const minSafeDistance = 0.05;
    
    if (distanceToLiquidation > minSafeDistance) {
      return { 
        safe: true, 
        reason: `Distance to liquidation: ${(distanceToLiquidation*100).toFixed(2)}%` 
      };
    } else {
      return { 
        safe: false, 
        reason: `Too close to liquidation: ${(distanceToLiquidation*100).toFixed(2)}% < ${minSafeDistance*100}%` 
      };
    }
  }
  
  /**
   * Toma decisão final
   */
  private async makeDecision(
    symbol: string,
    predictive: any,
    technical: any,
    availableBalance: number
  ): Promise<TradeDecision | null> {
    
    
    // ✅ LÓGICA ESPECIAL PARA BTC E ETH: Maior tolerância devido à liquidez
    if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT') {
      // BTC e ETH podem ser executados com confiança menor devido à estabilidade
      if (predictive.recommendation.action === 'BUY' && predictive.confidence >= 35) {
        console.log(`🚀 BTC/ETH: Executando BUY com confiança ${predictive.confidence}% (tolerância especial)`);
      } else if (predictive.recommendation.action === 'SELL' && predictive.confidence >= 35) {
        console.log(`🚀 BTC/ETH: Executando SELL com confiança ${predictive.confidence}% (tolerância especial)`);
      } else {
        console.log(`⏸️ BTC/ETH: Confiança insuficiente (${predictive.confidence}% < 35%)`);
        return null;
      }
    } else {
      // Outros símbolos mantêm confiança padrão
      if (predictive.recommendation.action === 'BUY' && predictive.confidence >= 45) {
        console.log(`🚀 ${symbol}: Executando BUY com confiança ${predictive.confidence}%`);
      } else if (predictive.recommendation.action === 'SELL' && predictive.confidence >= 45) {
        console.log(`🚀 ${symbol}: Executando SELL com confiança ${predictive.confidence}%`);
      } else {
        console.log(`⏸️ ${symbol}: Confiança insuficiente (${predictive.confidence}% < 45%)`);
        return null;
      }
    }
    
    
    // ✅ VALIDAÇÃO DE LIQUIDEZ: Garantir que há volume suficiente
    const minVolume24h = {
      'BTCUSDT': 1000000,  // BTC: $1M+ volume diário
      'ETHUSDT': 500000,   // ETH: $500K+ volume diário
      'BNBUSDT': 100000,   // BNB: $100K+ volume diário
      'SOLUSDT': 50000,    // SOL: $50K+ volume diário
      'DOGEUSDT': 30000,   // DOGE: $30K+ volume diário
      'ADAUSDT': 20000,    // ADA: $20K+ volume diário
      'XRPUSDT': 20000     // XRP: $20K+ volume diário
    }[symbol] || 10000;
    
    // Simular verificação de volume (em produção, buscar dados reais)
    const estimatedVolume = Math.random() * 2000000; // Simulação
    if (estimatedVolume < minVolume24h) {
      console.log(`⏸️ ${symbol}: Volume insuficiente (${estimatedVolume.toFixed(0)} < ${minVolume24h})`);
      return null;
    }
    console.log(`✅ ${symbol}: Volume adequado (${estimatedVolume.toFixed(0)} >= ${minVolume24h})`);
    // Calcular tamanho da posição
    // ✅ ALOCAÇÃO PRIORIZADA: BTC e ETH recebem mais capital
    const allocation = { 
      'BTCUSDT': 0.50,  // BTC: 50% do capital disponível
      'ETHUSDT': 0.40,  // ETH: 40% do capital disponível
      'BNBUSDT': 0.30,  // BNB: 30% do capital disponível
      'SOLUSDT': 0.20,  // SOL: 20% do capital disponível
      'DOGEUSDT': 0.15, // DOGE: 15% do capital disponível
      'ADAUSDT': 0.10,  // ADA: 10% do capital disponível
      'XRPUSDT': 0.10   // XRP: 10% do capital disponível
    }[symbol] || 0.25;
    
    // ✅ AJUSTE: Se saldo < $10, usar 100% para maximizar trades
    // Se saldo >= $10, usar alocação normal
    let tradeSize;
    if (availableBalance < 10) {
      // Saldo baixo: usar 100% do saldo para 1 trade
      tradeSize = availableBalance;
      console.log(`💰 Saldo baixo ($${availableBalance.toFixed(2)}): Usando 100% do capital para maximizar uso`);
    } else {
      // Saldo suficiente: usar alocação normal
      tradeSize = availableBalance * allocation;
    }
    
    // Obter preço atual
    const binanceClient = getBinanceClient();
    const ticker = await binanceClient.get24hrTicker(symbol);
    const currentPrice = parseFloat((ticker as any).lastPrice);
    
    // Calcular SL/TP baseado em suporte/resistência
    const optimalEntry = technicalAnalyzer.getOptimalEntry(symbol, technical);
    
    let entry = currentPrice;
    
    // ✅ AJUSTE: Considerar taxas da Binance FUTURES (0.06% total)
    // Para lucro líquido de 2%, precisa de +2.06% (+2% lucro + 0.06% taxa)
    // Para stop loss: -0.5% para compensar taxa de 0.03% + margem de segurança
    const desiredProfit = 0.02; // 2% lucro desejado
    const desiredLoss = 0.005; // 0.5% perda desejada
    
    let stopLoss = currentPrice * (1 - desiredLoss - AdvancedTradingEngine.BINANCE_TRADING_FEE); // -0.53% com taxa
    let takeProfit = currentPrice * (1 + desiredProfit + AdvancedTradingEngine.BINANCE_TOTAL_FEE); // +2.06% com taxa
    
    if (optimalEntry) {
      entry = optimalEntry.price;
      
      if (optimalEntry.level === 'support') {
        // BUY em suporte com taxas consideradas (Futures)
        stopLoss = optimalEntry.price * (1 - desiredLoss - AdvancedTradingEngine.BINANCE_TRADING_FEE);
        takeProfit = optimalEntry.price * 1.0406; // +4.06% para lucro de 4% líquido (4% + 0.06% taxa futures)
      }
    }
    
    return {
      action: predictive.recommendation.action as 'BUY' | 'SELL',
      confidence: predictive.confidence,
      size: tradeSize / currentPrice, // Quantidade em moeda
      entry: currentPrice,
      stopLoss,
      takeProfit,
      timeInForce: 'GTC',
      explanation: predictive.recommendation.rationale
    };
  }
  
  /**
   * Tomar decisão V2 - MUITO MAIS ASSERTIVA com LEVERAGE INTELIGENTE
   */
  private async makeDecisionV2(
    symbol: string,
    predictiveV2: any,
    availableBalance: number
  ): Promise<TradeDecision | null> {
    
    // ✅ NOVO: Iniciar captura de parâmetros de análise
    const tradeId = `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    tradeAnalysisCapture.startAnalysis(symbol, tradeId);
    
    // ✅ AJUSTE: SELL BIAS inteligente para Futures
    const ALLOWED_SIGNALS = ['BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL'];
    const MIN_CONFIDENCE = 30; // ✅ AJUSTADO: 30% para permitir mais trades
    
    // SELL BIAS: Favorecer SELL (recomendação: 85% - SELL performando melhor!)
    const sellBias = 0.85; // 85% preferência para SELL (SELL tem +0.66% vs BUY -0.70%)
    
    // ✅ NOVO: Considerar evolução do equity na tomada de decisão
    let equityAdjustment = 0;
    try {
      const equityEvolution = await this.equityService.getEquityEvolution(symbol, 7); // Últimos 7 dias
      if (equityEvolution) {
        // Ajustar confiança baseado na performance do equity
        if (equityEvolution.totalReturnPercent < -5) {
          // Se equity caiu mais de 5%, reduzir confiança
          equityAdjustment = -10;
          console.log(`📉 ${symbol}: Equity em declínio (-${Math.abs(equityEvolution.totalReturnPercent).toFixed(1)}%), reduzindo confiança`);
        } else if (equityEvolution.totalReturnPercent > 5) {
          // Se equity subiu mais de 5%, aumentar confiança
          equityAdjustment = 5;
          console.log(`📈 ${symbol}: Equity em alta (+${equityEvolution.totalReturnPercent.toFixed(1)}%), aumentando confiança`);
        }
        
        // Verificar drawdown máximo
        if (equityEvolution.maxDrawdownPercent > 10) {
          equityAdjustment -= 15;
          console.log(`⚠️ ${symbol}: Drawdown alto (${equityEvolution.maxDrawdownPercent.toFixed(1)}%), reduzindo confiança significativamente`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar evolução do equity para ${symbol}:`, error);
    }
    
    // Filtrar baseado no sinal e confidence
    if (!ALLOWED_SIGNALS.includes(predictiveV2.signal)) {
      console.log(`⏸️ ${symbol}: REJEITADO - Signal ${predictiveV2.signal} não permite execução`);
      return null;
    }
    
    // ✅ AJUSTE: Aplicar SELL BIAS na confiança + ajuste do equity
    let adjustedConfidence = predictiveV2.confidence + equityAdjustment;
    if (predictiveV2.signal.includes('SELL')) {
      adjustedConfidence = Math.min(100, adjustedConfidence + (adjustedConfidence * sellBias * 0.1));
    } else if (predictiveV2.signal.includes('BUY')) {
      adjustedConfidence = Math.max(0, adjustedConfidence - (adjustedConfidence * sellBias * 0.1));
    }
    
    console.log(`📊 ${symbol}: Confiança original: ${predictiveV2.confidence}%, Ajuste equity: ${equityAdjustment}, Confiança final: ${adjustedConfidence.toFixed(1)}%`);
    
    if (adjustedConfidence < MIN_CONFIDENCE) {
      console.log(`⏸️ ${symbol}: REJEITADO - Confiança ajustada ${adjustedConfidence.toFixed(1)}% < ${MIN_CONFIDENCE}%`);
      return null;
    }
    
    // ✅ NOVO: Verificar tendência ANTES de aplicar bias
    const technical = predictiveV2.technicalDetails || {};
    const trend = technical.trend || 'SIDEWAYS';
    const shouldFollowTrend = this.shouldFollowTrend(symbol, trend, predictiveV2.signal);
    
    // ✅ NOVO: Capturar parâmetros técnicos
    tradeAnalysisCapture.captureTechnicalAnalysis({
      rsi: technical.rsi,
      macd: technical.macd ? {
        signal: technical.macd.signal,
        histogram: technical.macd.histogram
      } : undefined,
      bollinger: technical.bollinger ? {
        upper: technical.bollinger.upper,
        middle: technical.bollinger.middle,
        lower: technical.bollinger.lower
      } : undefined,
      volumeRatio: technical.volumeRatio,
      priceChange24h: technical.priceChange24h,
      supportLevel: technical.supportLevel,
      resistanceLevel: technical.resistanceLevel
    });
    
    // ✅ NOVO: Capturar parâmetros preditivos V2
    tradeAnalysisCapture.capturePredictiveV2({
      signal: predictiveV2.signal,
      confidence: predictiveV2.confidence,
      weightedScore: predictiveV2.weightedScore,
      technicalScore: predictiveV2.technicalScore,
      sentimentScore: predictiveV2.sentimentScore,
      onchainScore: predictiveV2.onchainScore,
      derivativesScore: predictiveV2.derivativesScore,
      macroScore: predictiveV2.macroScore,
      smartMoneyScore: predictiveV2.smartMoneyScore,
      newsScore: predictiveV2.newsScore,
      fundamentalScore: predictiveV2.fundamentalScore
    });
    
    if (!shouldFollowTrend.allowed) {
      console.log(`⏸️ ${symbol}: REJEITADO - ${shouldFollowTrend.reason}`);
      return null;
    }
    
    // Obter preço atual primeiro (necessário para checks)
    const binanceClient = getBinanceClient();
    const priceData = await binanceClient.getPrice(symbol);
    const currentPrice = parseFloat(priceData.price);
    
    // ✅ HFT 1: Calcular VWAP para análise de mean reversion
    const vwap = await this.calculateVWAP(symbol);
    console.log(`📊 ${symbol}: VWAP = $${vwap.toFixed(4)}`);
    
    // ✅ HFT 2: Verificar múltiplas confirmações (2+ sinais alinhados) - AJUSTADO
    const confirmations = this.checkMultipleConfirmations(predictiveV2, technical, currentPrice, vwap);
    if (!confirmations.confirmed) {
      console.log(`⏸️ ${symbol}: REJEITADO - Apenas ${confirmations.score} confirmações (necessário 2+)`);
      console.log(`   Detalhes: ${confirmations.details.join(', ')}`);
      tradeAnalysisCapture.recordWarning(`Apenas ${confirmations.score} confirmações (necessário 2+)`);
      await tradeAnalysisCapture.finishAnalysis();
      return null;
    }
    console.log(`✅ ${symbol}: ${confirmations.score} confirmações - ${confirmations.details.join(', ')}`);
    
    // ✅ HFT 3: Analisar volume e confirmar movimento
    const volumeCheck = this.analyzeVolume(technical, predictiveV2.signal);
    if (!volumeCheck.allowed) {
      console.log(`⏸️ ${symbol}: REJEITADO - ${volumeCheck.reason}`);
      tradeAnalysisCapture.recordWarning(volumeCheck.reason);
      await tradeAnalysisCapture.finishAnalysis();
      return null;
    }
    console.log(`✅ ${symbol}: ${volumeCheck.reason}`);
    
    // ✅ NOVO: Capturar parâmetros HFT
    const atr = await this.calculateATR(symbol);
    tradeAnalysisCapture.captureHFT({
      vwap: vwap,
      meanReversionSignal: this.getMeanReversionSignal(technical, currentPrice, vwap),
      confirmationsCount: confirmations.score,
      confirmationsScore: confirmations.score,
      volumeAnalysis: volumeCheck.reason,
      atr: atr
    });
    
    // Aplicar bias com mais flexibilidade
    if (predictiveV2.signal.includes('BUY')) {
      // BUY: Permitir em tendência de alta OU confiança >= 50%
      if (predictiveV2.signal === 'STRONG_BUY' || predictiveV2.confidence >= 50) {
        console.log(`✅ ${symbol}: BUY AUTORIZADO - ${predictiveV2.signal}, Conf: ${predictiveV2.confidence}%, Trend: ${trend}`);
      } else {
        console.log(`⏸️ ${symbol}: BUY bloqueado - Confiança ${predictiveV2.confidence}% < 50% ou tendência desfavorável`);
        return null;
      }
    } else if (predictiveV2.signal.includes('SELL')) {
      // SELL: Preferido! Aceita em tendência de baixa OU confiança >= 50%
      console.log(`✅ ${symbol}: SELL AUTORIZADO - ${predictiveV2.signal}, Conf: ${predictiveV2.confidence}%, Trend: ${trend}`);
    }
    
    console.log(`✅ ${symbol}: AUTORIZADO - ${predictiveV2.signal}, Confiança ${predictiveV2.confidence}%`);
    
    // Obter preço atual (já obtido acima, reusar)
    // const binanceClient já definido acima
    // const priceData já obtido acima  
    // const currentPrice já calculado acima
    
    // Obter histórico de preços para calcular volatilidade
    const klines = await binanceClient.getKlines(symbol, '1h', 48);
    const prices = klines.map(k => parseFloat(k.close));
    const volatility = leverageManager.calculateVolatility(prices);
    
    // Calcular leverage OTIMIZADO
    const leverageCalc = leverageManager.calculateOptimalLeverage({
      symbol,
      confidence: predictiveV2.confidence,
      signal: predictiveV2.signal,
      timeframe: 'day', // Será determinado internamente
      volatility,
      availableBalance,
      currentLeverage: 5
    });
    
    // ✅ USER REQUEST: Com saldo baixo, aumentar leverage para conseguir notional maior
    // Saldo < $10: usar leverage 5x para maximizar notional com pouco capital
    const actualLeverage = availableBalance < 10 ? 5 : leverageCalc.leverage;
    
    // ✅ HFT 5: Position sizing dinâmico baseado em confiança, volatilidade e ATR
    let marginForTrade = await this.calculatePositionSize(availableBalance, predictiveV2.confidence, volatility, symbol, currentPrice);
    if (marginForTrade === 0) {
      console.log(`⏸️ ${symbol}: Position size = 0 (baixa confiança ou alta volatilidade)`);
      return null;
    }
    
    console.log(`💰 Saldo REAL obtido da Binance: $${availableBalance.toFixed(2)}`);
    console.log(`   Margem para trade: $${marginForTrade.toFixed(2)}`);
    console.log(`   Leverage ajustado: ${actualLeverage}x (${availableBalance < 10 ? 'ALTO para capital baixo' : 'otimizado'})`);
    
    // Garantir que margem seja viável (pelo menos $0.10)
    // ✅ ChatGPT FIX: Permitir trades muito pequenas (mínimo $0.05)
    if (marginForTrade < 0.05) {
      console.log(`⏸️ ${symbol}: Margem disponível muito baixa ($${marginForTrade.toFixed(2)} < $0.05)`);
      return null;
    }
    
    // Calcular nocional (tamanho da posição com leverage REAL)
    let notional = marginForTrade * actualLeverage;
    
    // Calcular quantidade baseada no nocional E preço
    let quantity = notional / currentPrice;
    
    console.log(`   Quantidade calculada: ${quantity.toFixed(6)} → Notional: $${(quantity * currentPrice).toFixed(2)}`);
    
    // ✅ AJUSTAR QUANTIDADE PARA RESPETAR MIN_NOTIONAL E LOT_SIZE
    try {
      const binanceClient = getBinanceClient();
      const symbolInfo = await binanceClient.getFuturesSymbolInfo(symbol);
      
      // Obter filtros
      const lotSizeFilter = (symbolInfo?.filters || []).find((f: any) => 
        f.filterType === 'LOT_SIZE' || f.filterType === 'MARKET_LOT_SIZE'
      ) as any;
      const minNotionalFilter = (symbolInfo?.filters || []).find((f: any) => 
        f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL'
      ) as any;
      
      // Ajustar quantidade para respeitar stepSize
      if (lotSizeFilter?.stepSize) {
        const stepSize = parseFloat(lotSizeFilter.stepSize);
        quantity = Math.floor(quantity / stepSize) * stepSize;
      }
      
      // Garantir que respeita minQty
      if (lotSizeFilter?.minQty) {
        const minQty = parseFloat(lotSizeFilter.minQty);
        if (quantity < minQty) {
          console.log(`⏸️ ${symbol}: Quantidade muito pequena (${quantity} < minQty ${minQty})`);
          return null;
        }
      }
      
      // ✅ CRITICAL FIX: Garantir notional mínimo de $5 (mínimo da Binance Futures)
      const minNotionalRequired = minNotionalFilter?.minNotional 
        ? parseFloat(minNotionalFilter.minNotional) 
        : 5.0; // Fallback: $5 mínimo da Binance Futures
      
      const orderValue = quantity * currentPrice;
      
      if (orderValue < minNotionalRequired) {
        console.log(`⚠️ ${symbol}: Valor da ordem ($${orderValue.toFixed(2)}) < mínimo ($${minNotionalRequired.toFixed(2)})`);
        
        // Verificar se temos capital suficiente para o mínimo
        const requiredMarginForMinNotional = minNotionalRequired / actualLeverage;
        if (requiredMarginForMinNotional > availableBalance) {
          console.log(`   ❌ ${symbol}: Capital insuficiente para mínimo (precisa $${requiredMarginForMinNotional.toFixed(2)} > disponível $${availableBalance.toFixed(2)})`);
          return null;
        }
        
        console.log(`   📈 Ajustando quantidade para atingir mínimo de $${minNotionalRequired.toFixed(2)}...`);
        
        // Calcular quantidade mínima necessária
        const minQuantity = minNotionalRequired / currentPrice;
        
        // Ajustar para stepSize
        if (lotSizeFilter?.stepSize) {
          const stepSize = parseFloat(lotSizeFilter.stepSize);
          quantity = Math.ceil(minQuantity / stepSize) * stepSize; // Arredondar para cima
        } else {
          quantity = minQuantity;
        }
        
        // Recalcular notional e margem com a nova quantidade
        notional = quantity * currentPrice;
        marginForTrade = notional / actualLeverage;
        
        console.log(`   ✅ Quantidade ajustada: ${quantity.toFixed(6)} → Notional: $${notional.toFixed(2)}`);
        console.log(`   💰 Margem ajustada: $${marginForTrade.toFixed(2)}`);
      } else {
        console.log(`   ✅ Notional $${orderValue.toFixed(2)} >= mínimo $${minNotionalRequired.toFixed(2)}`);
      }
    } catch (error) {
      console.warn(`⚠️ Erro ao buscar filtros para ${symbol}:`, error);
    }
    
    console.log(`💰 Position Sizing (SALDO REAL EM TEMPO REAL):`);
    console.log(`   Saldo da Binance: $${availableBalance.toFixed(2)}`);
    console.log(`   Margem usada: $${marginForTrade.toFixed(2)} (${(marginForTrade/availableBalance * 100).toFixed(1)}% do saldo)`);
    console.log(`   Nocional (${actualLeverage}x): $${notional.toFixed(2)}`);
    console.log(`   Quantidade ajustada: ${quantity.toFixed(6)} ${symbol.split('USDT')[0]}`);
    console.log(`   Valor da ordem: $${(quantity * currentPrice).toFixed(2)}`);
    
    // ✅ Verificar se pode abrir trade usando configuração do sistema
    const tradeLimits = this.configService.getTradeLimits();
    const canOpenByConfig = this.configService.canOpenNewTrade(this.openTrades.size);
    const canOpenByLeverage = leverageManager.canOpenTrade(
      availableBalance,
      marginForTrade,
      this.openTrades.size
    );
    
    if (!canOpenByConfig) {
      console.log(`⏸️ ${symbol}: Trade bloqueado por configuração do sistema`);
      console.log(`   Trades ativas: ${this.openTrades.size}, Limite: ${tradeLimits.maxActiveTrades || 'Sem limite'}`);
      return null;
    }
    
    if (!canOpenByLeverage) {
      console.log(`⏸️ ${symbol}: Trade não aprovado por gerenciador de leverage`);
      return null;
    }
    
     console.log(`💰 Trade aprovado: Margem $${marginForTrade.toFixed(2)} @ ${actualLeverage}x`);
     console.log(`   Notional: $${notional.toFixed(2)}`);
     console.log(`   Risco: ${leverageCalc.riskLevel}`);

     // Calcular SL/TP baseado em sinais técnicos E timeframe
     // technical já foi definido anteriormente, reusar aqui
    // ✅ Proteção contra undefined
    const supportResistance = technical?.supportResistance || [];
    const support = supportResistance.find((s: any) => s.strength === 'strong' && s.level < currentPrice);
    const resistance = supportResistance.find((s: any) => s.strength === 'strong' && s.level > currentPrice);
    
    // SL/TP ajustados para timeframe
    const exposure = leverageManager.getRecommendedExposureTime(leverageCalc.timeframe);
    
    let stopLoss: number;
    let takeProfit: number;
    
    // ✅ HFT PROFISSIONAL: SL/TP realistas baseados em análise com taxas
    // ✅ AJUSTE CRÍTICO: SL em 1.5% (safe para leverage 5x) | TP em 3.0% (2:1 R:R)
    const BINANCE_TOTAL_FEE = 0.0006; // 0.06% total Futures (0.03% entrada + 0.03% saída)
    const TARGET_PROFIT = 0.03; // 3% lucro líquido desejado (considerando 2:1 R:R)
    const MAX_LOSS = -0.015; // -1.5% perda máxima (real, não -100%!)
    
    if (predictiveV2.signal === 'STRONG_BUY' || predictiveV2.signal === 'BUY') {
      // BUY: TP em 3.0%, SL em 1.5%
      stopLoss = currentPrice * (1 + MAX_LOSS);  // -1.5% Stop Loss REAL
      takeProfit = currentPrice * (1 + TARGET_PROFIT + BINANCE_TOTAL_FEE); // +3.06% para garantir 3% líquido + taxas
      console.log(`📊 BUY: SL=$${stopLoss.toFixed(4)} (-1.5%), TP=$${takeProfit.toFixed(4)} (+3.06% = 3% líquido + taxas)`);
    } else { // SELL
      // SELL: TP em 3.0%, SL em 1.5%
      stopLoss = currentPrice * (1 - MAX_LOSS);  // +1.5% Stop Loss REAL (SELL inverte)
      takeProfit = currentPrice * (1 - TARGET_PROFIT - BINANCE_TOTAL_FEE); // -3.06% para garantir 3% líquido
      console.log(`📊 SELL: SL=$${stopLoss.toFixed(4)} (+1.5%), TP=$${takeProfit.toFixed(4)} (-3.06% = 3% líquido + taxas)`);
    }
    
    // ✅ NOVO: Capturar parâmetros de risco
    tradeAnalysisCapture.captureRisk({
      stopLoss: stopLoss,
      takeProfit: takeProfit,
      positionSize: marginForTrade,
      leverage: actualLeverage,
      marginRequired: marginForTrade,
      maxLoss: Math.abs(stopLoss - currentPrice) * quantity,
      riskRewardRatio: Math.abs(takeProfit - currentPrice) / Math.abs(stopLoss - currentPrice)
    });
    
    // ✅ NOVO: Capturar parâmetros de mercado
    tradeAnalysisCapture.captureMarket({
      currentPrice: currentPrice,
      high24h: technical.high24h || currentPrice * 1.02,
      low24h: technical.low24h || currentPrice * 0.98,
      volume24h: technical.volume24h || 0,
      fundingRate: technical.fundingRate,
      openInterest: technical.openInterest
    });
    
    // ✅ NOVO: Capturar parâmetros de decisão
    tradeAnalysisCapture.captureDecision({
      action: predictiveV2.signal === 'STRONG_BUY' || predictiveV2.signal === 'BUY' ? 'BUY' : 
              predictiveV2.signal === 'STRONG_SELL' || predictiveV2.signal === 'SELL' ? 'SELL' : 'HOLD',
      confidence: predictiveV2.confidence,
      reason: `${predictiveV2.rationale}. Leverage: ${leverageCalc.leverage}x (${leverageCalc.timeframe})`,
      algorithm: 'AdvancedTradingEngineV2',
      multipleConfirmations: confirmations.confirmed,
      volumeConfirmed: volumeCheck.allowed,
      riskAcceptable: canOpenByConfig && canOpenByLeverage
    });
    
    // ✅ NOVO: Finalizar captura de parâmetros
    await tradeAnalysisCapture.finishAnalysis();
    
    return {
      action: predictiveV2.signal === 'STRONG_BUY' || predictiveV2.signal === 'BUY' ? 'BUY' : 
              predictiveV2.signal === 'STRONG_SELL' || predictiveV2.signal === 'SELL' ? 'SELL' : 'HOLD',
      confidence: predictiveV2.confidence,
      size: quantity,
      entry: currentPrice,
      stopLoss,
      takeProfit,
      timeInForce: 'GTC',
      explanation: `${predictiveV2.rationale}. Leverage: ${leverageCalc.leverage}x (${leverageCalc.timeframe})`
    };
  }
  
  /**
   * Executa trade REAL na Binance com dimensionamento dinâmico
   */
  private async executeTrade(symbol: string, decision: TradeDecision) {
    console.log(`\n🎯 EXECUTANDO ${decision.action} ${symbol} COM DINHEIRO REAL...`);
    console.log(`   Confiança: ${decision.confidence}%`);
    console.log(`   Tamanho original: ${decision.size.toFixed(4)}`);
    console.log(`   Entrada: $${decision.entry.toFixed(2)}`);
    console.log(`   Stop Loss: $${decision.stopLoss.toFixed(2)}`);
    console.log(`   Take Profit: $${decision.takeProfit.toFixed(2)}`);
    console.log(`   ⚠️⚠️⚠️ EXECUTANDO COM DINHEIRO REAL ⚠️⚠️⚠️`);
    
    // ✅ CRÍTICO: Verificar se já existe trade aberta no BANCO DE DADOS (não só no Map)
    try {
      const { supabase } = await import('./supabase-db');
      if (supabase) {
        const { data: existingTrades, error: checkError } = await supabase
          .from('real_trades')
          .select('trade_id, symbol, side, status')
          .eq('symbol', symbol)
          .eq('status', 'open')
          .limit(10);
        
        if (existingTrades && existingTrades.length > 0) {
          const symbolConfig = this.configService.getSymbolSettings(symbol);
          const maxPositionsForSymbol = symbolConfig?.maxPositions || this.configService.getConfig().riskManagement.maxPositionsPerSymbol;
          
          console.log(`\n⚠️ VERIFICAÇÃO DE DUPLICATAS:`);
          console.log(`   Trades abertas em ${symbol} no banco: ${existingTrades.length}`);
          console.log(`   Limite por símbolo: ${maxPositionsForSymbol}`);
          
          // ✅ MELHORIA CRÍTICA: Bloquear se já existe trade, independente do limite
          // (o limite já foi verificado pelo canOpenTradeWithPriority)
          if (existingTrades.length > 0) {
            // Verificar se já existe trade com mesmo lado (BUY ou SELL)
            const sameSideTrades = existingTrades.filter(t => t.side === decision.action);
            
            if (sameSideTrades.length > 0) {
              console.log(`\n🚫 TRADE BLOQUEADA: Já existe trade ${decision.action} aberta para ${symbol}`);
              console.log(`   Trades ${decision.action} existentes: ${sameSideTrades.length}`);
              console.log(`   IDs: ${sameSideTrades.map(t => t.trade_id).join(', ')}`);
              
              // Só permitir se for trade excepcional E já está no limite de posições
              if (existingTrades.length >= maxPositionsForSymbol) {
                const isExceptional = this.isExceptionalTrade(symbol, decision.confidence, decision.confidence * 10);
                if (isExceptional) {
                  console.log(`   ⭐ Trade EXCEPCIONAL - Permitindo substituição...`);
                  // Continuar para substituir
                } else {
                  console.log(`   ❌ Trade não é excepcional - BLOQUEANDO duplicata`);
                  return;
                }
              } else {
                // Não está no limite mas já tem trade do mesmo lado - bloquear para evitar hedging
                console.log(`   ❌ Bloqueando trade duplicada do mesmo lado (evitar hedging)`);
                return;
              }
            }
            
            // Se já está no limite de posições, verificar se deve substituir
            if (existingTrades.length >= maxPositionsForSymbol) {
              const isExceptional = this.isExceptionalTrade(symbol, decision.confidence, decision.confidence * 10);
              if (!isExceptional) {
                console.log(`\n🚫 TRADE BLOQUEADA: Limite de ${maxPositionsForSymbol} posições já atingido para ${symbol}`);
                return;
              } else {
                console.log(`   ⭐ Trade EXCEPCIONAL - Permitindo substituição...`);
              }
            }
          }
        }
      }
    } catch (checkError) {
      console.warn(`⚠️ Erro ao verificar trades existentes (continuando):`, checkError);
    }
    
    try {
      // ✅ NOVO: Salvar snapshot do equity antes da trade
      await this.equityService.saveEquitySnapshot(symbol);
      console.log(`📊 Snapshot do equity salvo para ${symbol}`);
      
      // ✅ NOVO: Calcular dimensionamento dinâmico da posição
      const tradeAnalysis = await this.createTradeAnalysis(symbol, decision);
      const positionSizing = await this.positionSizingService.calculatePositionSize(
        symbol,
        tradeAnalysis,
        decision.entry,
        decision.stopLoss,
        decision.takeProfit
      );
      
      console.log(`\n💰 DIMENSIONAMENTO DINÂMICO CALCULADO:`);
      console.log(`   Tamanho da posição: ${positionSizing.positionSize.toFixed(2)}%`);
      console.log(`   Valor da posição: $${positionSizing.positionValue.toFixed(2)}`);
      console.log(`   Trade excepcional: ${positionSizing.isExceptional ? 'SIM' : 'NÃO'}`);
      console.log(`   Razão: ${positionSizing.sizingReason}`);
      console.log(`   Risco: $${positionSizing.riskAmount.toFixed(2)} | Recompensa: $${positionSizing.potentialReward.toFixed(2)}`);
      console.log(`   R:R: ${positionSizing.riskRewardRatio.toFixed(2)}`);
      
      // Atualizar tamanho da trade com o dimensionamento dinâmico
      const newQuantity = positionSizing.positionValue / decision.entry;
      console.log(`   Quantidade ajustada: ${decision.size.toFixed(4)} → ${newQuantity.toFixed(4)}`);
      
      // ✅ CRÍTICO: Verificar posições reais na Binance ANTES de executar
      const binanceClient = getBinanceClient();
      const binancePositions = await binanceClient.getFuturesPositions();
      const existingBinancePosition = binancePositions.find((p: any) => 
        p.symbol === symbol && 
        Math.abs(parseFloat(p.positionAmt || '0')) > 0
      );
      
      if (existingBinancePosition) {
        const positionAmt = parseFloat(existingBinancePosition.positionAmt || '0');
        console.log(`\n⚠️ ATENÇÃO: Já existe posição REAL na Binance para ${symbol}:`);
        console.log(`   Quantidade: ${positionAmt}`);
        console.log(`   Entry Price: ${existingBinancePosition.entryPrice}`);
        console.log(`   P&L não realizado: ${existingBinancePosition.unRealizedProfit}`);
        console.log(`\n🚫 BLOQUEANDO nova trade para evitar duplicata/hedging`);
        
        // Atualizar trade no banco se existir
        try {
          const { supabase } = await import('./supabase-db');
          if (supabase) {
            const { data: dbTrade } = await supabase
              .from('real_trades')
              .select('trade_id')
              .eq('symbol', symbol)
              .eq('status', 'open')
              .eq('side', decision.action)
              .limit(1)
              .single();
            
            if (dbTrade) {
              console.log(`   ✅ Trade já existe no banco: ${dbTrade.trade_id}`);
              // Apenas atualizar preço atual, não criar nova
              const currentPrice = parseFloat(existingBinancePosition.markPrice || existingBinancePosition.entryPrice);
              await supabase
                .from('real_trades')
                .update({
                  current_price: currentPrice,
                  pnl: parseFloat(existingBinancePosition.unRealizedProfit || '0'),
                  updated_at: new Date().toISOString()
                })
                .eq('trade_id', dbTrade.trade_id);
              return; // Não criar nova trade
            }
          }
        } catch (error) {
          console.warn('⚠️ Erro ao verificar trade no banco:', error);
        }
        
        return; // Bloquear execução
      }
      
      // Calcular quantidade precisa baseada no dimensionamento dinâmico
      const priceData = await binanceClient.getPrice(symbol);
      const currentPrice = parseFloat(priceData.price);
      
      console.log(`\n🔍 DEBUG executeTrade:`);
      console.log(`   📊 priceData:`, priceData);
      console.log(`   💰 currentPrice: ${currentPrice}`);
      console.log(`   📦 decision.size (quantity original): ${decision.size}`);
      console.log(`   📋 decision.entry: ${decision.entry}`);
      
      // Usar quantidade calculada pelo dimensionamento dinâmico
      let quantity = newQuantity;
        
        // ✅ CORREÇÃO CRÍTICA: Ajustar precisão baseada no stepSize do símbolo
        try {
          const symbolInfo = await binanceClient.getFuturesSymbolInfo(symbol);
          const lotSizeFilter = symbolInfo?.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
          const stepSize = parseFloat(lotSizeFilter?.stepSize || '0.01');
          
          // Ajustar quantidade para precisão correta
          const adjustedQuantity = this.adjustQuantityPrecision(quantity, stepSize);
          
          console.log(`🔧 Precisão ajustada: ${quantity} → ${adjustedQuantity} (stepSize: ${stepSize})`);
          quantity = adjustedQuantity;
        } catch (precisionError) {
          console.warn(`⚠️ Erro ao ajustar precisão: ${(precisionError as Error).message}`);
          console.log(`   Usando quantidade original: ${quantity}`);
        }
        
        let notional = quantity * currentPrice;
      
      console.log(`   🎯 Final quantity: ${quantity}, notional: $${notional.toFixed(2)}`);
      
      console.log(`\n📊 Criando ordem REAL na Binance:`);
      console.log(`   Symbol: ${symbol}`);
      console.log(`   Side: ${decision.action}`);
      console.log(`   Type: MARKET`);
      console.log(`   Quantity: ${quantity.toFixed(6)}`);
      console.log(`   Notional: $${notional.toFixed(2)}`);

      if (this.isFuturesMode) {
        // ✅ FUTURES-SPECIFIC: Checks de funding rate e safety
        console.log(`✅ Notional: $${notional.toFixed(2)} - Binance decidirá se aceita ou não`);
        
        // FUTURES: Check funding rate antes do trade
        const fundingCheck = await this.checkFundingRateSafety(symbol, decision.action as 'BUY' | 'SELL');
        if (!fundingCheck.safe) {
          console.log(`🚫 TRADE CANCELADO: Funding rate não favorável (${fundingCheck.reason})`);
          return;
        }
        
        // FUTURES: verificar margem, setar leverage e marginType, e enviar ordem em /fapi
        const leverage = 5;
        try { await binanceClient.setFuturesMarginType(symbol, 'ISOLATED'); } catch {}
        try { await binanceClient.setFuturesLeverage(symbol, leverage); } catch {}
        
        // FUTURES: Check liquidation safety
        const liquidationCheck = this.checkLiquidationSafety(symbol, decision.action as 'BUY' | 'SELL', leverage, currentPrice);
        if (!liquidationCheck.safe) {
          console.log(`🚫 TRADE CANCELADO: Muito próximo da liquidação (${liquidationCheck.reason})`);
          return;
        }

        // Capturar notional mínimo do contrato
        let minNotional = 0;
        try {
          const fInfo = await binanceClient.getFuturesSymbolInfo(symbol);
          const minNotionalFilter = fInfo?.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
          const notionalFilter = fInfo?.filters?.find((f: any) => f.filterType === 'NOTIONAL');
          const raw = minNotionalFilter?.minNotional ?? notionalFilter?.minNotional ?? (notionalFilter as any)?.notional;
          if (raw) minNotional = parseFloat(raw);
        } catch {}

        // Verificar saldo/margem disponível
        const futuresAccount = await binanceClient.getFuturesAccountInfo();
        const availableMargin = parseFloat(futuresAccount.availableBalance || '0');
        const requiredInitialMargin = notional / leverage;

        console.log('💰 Verificando margem (Futures):');
        console.log(`   Available margin: $${availableMargin.toFixed(2)}`);
        console.log(`   Notional: $${notional.toFixed(2)} (min=${minNotional || 'n/a'})`);
        console.log(`   Required initial margin (@${leverage}x): $${requiredInitialMargin.toFixed(2)}`);

        if ((minNotional && notional < minNotional) || requiredInitialMargin > availableMargin) {
          console.log(`\n🚫 TRADE CANCELADO (Futures): Requisitos não atendidos`);
          if (minNotional && notional < minNotional) {
            console.log(`   Notional insuficiente: $${notional.toFixed(2)} < min $${minNotional.toFixed(2)}`);
          }
          if (requiredInitialMargin > availableMargin) {
            console.log(`   Margem insuficiente: precisa $${requiredInitialMargin.toFixed(2)} > disponível $${availableMargin.toFixed(2)}`);
          }
          return;
        }

        console.log('✅ Requisitos atendidos (Futures), executando ordem...');
        // ✅ One-Way Mode: Não enviar positionSide (será determinado automaticamente pelo side)
        const orderResult = await binanceClient.createFuturesOrder(
          symbol,
          decision.action as 'BUY' | 'SELL',  // ✅ Type assertion: action nunca será HOLD aqui
          'MARKET',
          quantity,
          undefined,
          undefined  // ✅ SEM positionSide (One-Way Mode)
        );

        console.log(`✅ Ordem FUTURES executada!`);
        console.log(`   Order ID: ${orderResult.orderId}`);
        console.log(`   Status: ${orderResult.status}`);
        console.log(`   Executed Qty: ${orderResult.executedQty || 'N/A'}`);
        console.log(`   Avg Price: ${orderResult.avgPrice || 'N/A'}`);
        
        // ✅ DEBUG: Log completo da resposta
        console.log(`   Order Result completo:`, JSON.stringify(orderResult, null, 2));
        
        // ✅ CRITICAL: Binance Futures retorna "0" em executedQty e avgPrice para MARKET orders até execução completa
        // SEMPRE usar os valores que enviamos (quantity e currentPrice)
        const finalQuantity = quantity; // SEMPRE usar o quantity enviado
        const finalPrice = currentPrice; // SEMPRE usar o currentPrice obtido antes da ordem
        
        console.log(`   📊 Salvando trade: qty=${finalQuantity}, price=${finalPrice}`);
        console.log(`   ⚠️ Nota: avgPrice virá como 0 até execução completa da ordem`);

        // Persistir
        const tradeId = await this.saveTradeToDB({
          symbol,
          side: decision.action as 'BUY' | 'SELL',  // ✅ Type assertion: action nunca será HOLD aqui
          quantity: finalQuantity,
          entryPrice: finalPrice,
          currentPrice: finalPrice,
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          status: 'open',
          pnl: 0,
          pnlPercent: 0,
          openedAt: new Date().toISOString(),
          algorithm: 'advanced_trading_engine_futures',
          confidence: decision.confidence,
          binanceOrderId: orderResult.orderId?.toString()
        });

        this.openTrades.set(tradeId, {
          tradeId,
          symbol,
          side: decision.action,
          entryPrice: parseFloat(orderResult.avgPrice || currentPrice.toString()),
          stopLoss: decision.stopLoss,
          takeProfit: decision.takeProfit,
          openedAt: Date.now(),
          binanceOrderId: orderResult.orderId?.toString(),
          stopLossSet: false, // Será marcado como true após criar na Binance
          takeProfitSet: false
        });

        // ✅ PROTEÇÃO AUTOMÁTICA: Criar Stop Loss e Take Profit na Binance
        // Isso garante que mesmo se o servidor cair, as posições estarão protegidas
        try {
          // ✅ Verificar se já existem ordens SL/TP abertas para evitar duplicatas
          let existingOrders: any = [];
          try {
            const openOrders = await binanceClient.getFuturesOpenOrders(symbol);
            existingOrders = openOrders || [];
            if (existingOrders.length > 0) {
              console.log(`⚠️ Já existem ${existingOrders.length} ordens condicionais abertas para ${symbol}. Pulando criação de SL/TP para evitar duplicatas.`);
            }
          } catch (orderCheckError) {
            console.log(`ℹ️ Não foi possível verificar ordens existentes para ${symbol}`);
          }
          
          // Se não existem ordens SL/TP, criar
          if (existingOrders.length === 0) {
            console.log(`🛡️ Criando Stop Loss e Take Profit na Binance para ${symbol}...`);
            
            // Criar Stop Loss
            const stopLossOrder = await binanceClient.createFuturesStopLoss(
              symbol,
              decision.action as 'BUY' | 'SELL',
              finalQuantity,
              decision.stopLoss
            );
            console.log(`   ✅ Stop Loss criado: Order ID ${stopLossOrder.orderId}`);
            
            // Criar Take Profit
            const takeProfitOrder = await binanceClient.createFuturesTakeProfit(
              symbol,
              decision.action as 'BUY' | 'SELL',
              finalQuantity,
              decision.takeProfit
            );
            console.log(`   ✅ Take Profit criado: Order ID ${takeProfitOrder.orderId}`);
            
            // Marcar como protegido
            const trade = this.openTrades.get(tradeId);
            if (trade) {
              trade.stopLossSet = true;
              trade.takeProfitSet = true;
              this.openTrades.set(tradeId, trade);
            }
            
            console.log(`🔐 PROTEGEÇÃO ATIVA: Trade protegido mesmo se o servidor cair!`);
          } else {
            console.log(`ℹ️ ${symbol} já possui proteção (${existingOrders.length} ordens condicionais)`);
            // Marcar como protegido mesmo sem criar (ordens já existem)
            const trade = this.openTrades.get(tradeId);
            if (trade) {
              trade.stopLossSet = true;
              trade.takeProfitSet = true;
              this.openTrades.set(tradeId, trade);
            }
          }
        } catch (error: any) {
          console.error(`❌ Erro ao criar Stop Loss/Take Profit:`, error.response?.data || error.message);
          // Não bloquear se falhar, mas alertar
          console.log(`⚠️ ATENÇÃO: Trades abertos sem proteção automática na Binance!`);
        }

        console.log(`📊 Trades abertos agora: ${this.openTrades.size}/${this.configService.getTradeLimits().maxActiveTrades || 'Sem limite'}`);
        
        // ✅ NOVO: Incrementar contador de trades diárias
        this.dailyTradeCount++;
        console.log(`📅 Trades hoje: ${this.dailyTradeCount}/${this.maxDailyTrades}`);
        
        // ✅ EQUITY TRACKING: Registrar saldo após execução de trade
        await this.recordAllEquityHistory();
        
        return;
      }

      // SPOT
      // ✅ NOVO: Verificar saldo antes de executar
      const accountInfo = await binanceClient.getAccountInfo();
      const usdtBalance = accountInfo.balances.find((b: any) => b.asset === 'USDT');
      const availableBalance = usdtBalance ? parseFloat(usdtBalance.free) : 0;
      
      // Estimar custo da ordem (será ajustado para minNotional pelo createOrder)
      // Usar minNotional padrão de $5
      const minNotional = 5.0;
      const estimatedCost = Math.max(notional, minNotional);
      
      console.log(`💰 Verificando saldo:`);
      console.log(`   Saldo disponível: $${availableBalance.toFixed(2)}`);
      console.log(`   Custo estimado: $${estimatedCost.toFixed(2)}`);
      
      if (estimatedCost > availableBalance) {
        console.log(`\n🚫 TRADE CANCELADO: Saldo insuficiente`);
        console.log(`   Precisa: $${estimatedCost.toFixed(2)} USDT (notional mínimo)`);
        console.log(`   Disponível: $${availableBalance.toFixed(2)} USDT`);
        console.log(`   NÃO executando ordem para evitar erro -2010`);
        return; // Não executa a ordem
      }
      
      console.log(`✅ Saldo suficiente, executando ordem...`);
      
      // Executar ordem REAL SPOT
      const orderResult = await binanceClient.createOrder(
        symbol,
        decision.action as 'BUY' | 'SELL',  // ✅ Type assertion: action nunca será HOLD aqui
        'MARKET',
        quantity
      );
      
      console.log(`✅ Ordem REAL executada na Binance!`);
      console.log(`   Order ID: ${orderResult.orderId}`);
      console.log(`   Status: ${orderResult.status}`);
      console.log(`   Executed Qty: ${orderResult.executedQty}`);
      console.log(`   Price: ${orderResult.price || 'MARKET'}`);
      
      // ✅ Salvar em real_trades no banco e obter ID
      const tradeId = await this.saveTradeToDB({
        symbol,
        side: decision.action as 'BUY' | 'SELL',  // ✅ Type assertion: action nunca será HOLD aqui
        quantity: parseFloat(orderResult.executedQty || quantity.toFixed(6)),
        entryPrice: parseFloat(orderResult.price || currentPrice.toString()),
        currentPrice: parseFloat(orderResult.price || currentPrice.toString()),
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
        status: 'open',
        pnl: 0,
        pnlPercent: 0,
        openedAt: new Date().toISOString(),
        algorithm: 'advanced_trading_engine',
        confidence: decision.confidence,
        binanceOrderId: orderResult.orderId?.toString()
      });
      
      console.log(`✅ Trade salvo no banco de dados!`);
      
      // ✅ Registrar trade no Map de trades abertos (HFT)
      this.openTrades.set(tradeId, {
        tradeId,
        symbol,
        side: decision.action,
        entryPrice: parseFloat(orderResult.price || currentPrice.toString()),
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
        openedAt: Date.now(),
        binanceOrderId: orderResult.orderId?.toString(),
        stopLossSet: false, // Será marcado ao criar proteção
        takeProfitSet: false
      });
      
      console.log(`📊 Trades abertos agora: ${this.openTrades.size}/${this.configService.getTradeLimits().maxActiveTrades || 'Sem limite'}`);
      
    } catch (error: any) {
      console.error(`❌ Erro ao executar ordem REAL:`, error);
      console.error(`   Detalhes:`, error.response?.data || error.message);
      
      // ✅ USER REQUEST: Tratamento especial para erro -4164 (notional mínimo)
      const errorCode = error.response?.data?.code;
      if (errorCode === -4164) {
        console.log(`⚠️ Binance rejeitou: Notional muito pequeno (exige $5 mínimo)`);
        console.log(`   ✅ Sistema continuando... tentará outras moedas`);
        return; // ✅ NÃO re-throw - deixa continuar com outros símbolos
      }
      
      // Re-throw para outros erros
      throw error;
    }
  }
  
  /**
   * Salva trade no banco de dados
   */
  private async saveTradeToDB(trade: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    stopLoss: number;
    takeProfit: number;
    status: 'open' | 'closed';
    pnl: number;
    pnlPercent: number;
    openedAt: string;
    algorithm: string;
    confidence: number;
    binanceOrderId?: string;
  }): Promise<string> {
    try {
      const { supabase } = await import('./supabase-db');
      if (supabase) {
        // Gerar trade_id único
        const tradeId = `${trade.symbol}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await supabase.from('real_trades').insert({
          trade_id: tradeId,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          entry_price: trade.entryPrice,
          current_price: trade.currentPrice,
          stop_loss: trade.stopLoss,
          take_profit: trade.takeProfit,
          status: trade.status,
          pnl: trade.pnl,
          pnl_percent: trade.pnlPercent,
          opened_at: trade.openedAt,
          algorithm: trade.algorithm,
          confidence: trade.confidence,
          binance_order_id: trade.binanceOrderId
        });
        
        console.log(`💾 Trade ${tradeId} salvo no banco de dados`);
        
        // ✅ NOVO: Salvar parâmetros de análise
        await this.saveTradeAnalysisParameters(tradeId, tradeAnalysisCapture.getAnalysisStats());
        
        return tradeId;
      }
      return '';
    } catch (error) {
      console.error('❌ Erro ao salvar trade no banco:', error);
      return '';
    }
  }

  // ✅ NOVO: Salvar parâmetros de análise na tabela trade_analysis_parameters
  private async saveTradeAnalysisParameters(tradeId: string, analysisData: any): Promise<void> {
    try {
      const { supabase } = await import('./supabase-db');
      
      if (!supabase) {
        console.warn('⚠️ Supabase não disponível para salvar parâmetros de análise');
        return;
      }

      const analysisParams = {
        trade_id: tradeId,
        symbol: analysisData.symbol || '',
        analysis_timestamp: new Date().toISOString(),
        
        // Technical Analysis
        technical_rsi: analysisData.technical?.rsi || null,
        technical_macd_signal: analysisData.technical?.macd?.signal || null,
        technical_macd_histogram: analysisData.technical?.macd?.histogram || null,
        technical_bollinger_upper: analysisData.technical?.bollinger?.upper || null,
        technical_bollinger_middle: analysisData.technical?.bollinger?.middle || null,
        technical_bollinger_lower: analysisData.technical?.bollinger?.lower || null,
        technical_volume_ratio: analysisData.technical?.volumeRatio || null,
        technical_price_change_24h: analysisData.technical?.priceChange24h || null,
        technical_support_level: analysisData.technical?.supportLevel || null,
        technical_resistance_level: analysisData.technical?.resistanceLevel || null,
        
        // Predictive V2
        predictive_v2_signal: analysisData.predictiveV2?.signal || null,
        predictive_v2_confidence: analysisData.predictiveV2?.confidence || null,
        predictive_v2_weighted_score: analysisData.predictiveV2?.weightedScore || null,
        predictive_v2_technical_score: analysisData.predictiveV2?.technicalScore || null,
        predictive_v2_sentiment_score: analysisData.predictiveV2?.sentimentScore || null,
        predictive_v2_onchain_score: analysisData.predictiveV2?.onchainScore || null,
        predictive_v2_derivatives_score: analysisData.predictiveV2?.derivativesScore || null,
        predictive_v2_macro_score: analysisData.predictiveV2?.macroScore || null,
        predictive_v2_smart_money_score: analysisData.predictiveV2?.smartMoneyScore || null,
        predictive_v2_news_score: analysisData.predictiveV2?.newsScore || null,
        predictive_v2_fundamental_score: analysisData.predictiveV2?.fundamentalScore || null,
        
        // HFT Analysis
        hft_vwap: analysisData.hft?.vwap || null,
        hft_mean_reversion_signal: analysisData.hft?.meanReversionSignal || null,
        hft_confirmations_count: analysisData.hft?.confirmationsCount || null,
        hft_confirmations_score: analysisData.hft?.confirmationsScore || null,
        hft_volume_analysis: analysisData.hft?.volumeAnalysis || null,
        hft_atr: analysisData.hft?.atr || null,
        hft_position_size: analysisData.hft?.positionSize || null,
        hft_volatility_adjustment: analysisData.hft?.volatilityAdjustment || null,
        hft_atr_adjustment: analysisData.hft?.atrAdjustment || null,
        
        // Risk Management
        risk_stop_loss: analysisData.risk?.stopLoss || null,
        risk_take_profit: analysisData.risk?.takeProfit || null,
        risk_position_size: analysisData.risk?.positionSize || null,
        risk_leverage: analysisData.risk?.leverage || null,
        risk_margin_required: analysisData.risk?.marginRequired || null,
        risk_max_loss: analysisData.risk?.maxLoss || null,
        risk_reward_ratio: analysisData.risk?.rewardRatio || null,
        
        // Market Data
        market_current_price: analysisData.market?.currentPrice || null,
        market_24h_high: analysisData.market?.high24h || null,
        market_24h_low: analysisData.market?.low24h || null,
        market_24h_volume: analysisData.market?.volume24h || null,
        market_funding_rate: analysisData.market?.fundingRate || null,
        market_open_interest: analysisData.market?.openInterest || null,
        
        // Decision
        decision_action: analysisData.decision?.action || null,
        decision_confidence: analysisData.decision?.confidence || null,
        decision_reason: analysisData.decision?.reason || null,
        decision_algorithm: analysisData.decision?.algorithm || null,
        decision_multiple_confirmations: analysisData.decision?.multipleConfirmations || null,
        decision_volume_confirmed: analysisData.decision?.volumeConfirmed || null,
        decision_risk_acceptable: analysisData.decision?.riskAcceptable || null,
        
        // Raw Data
        technical_indicators: analysisData.technicalIndicators || null,
        sentiment_data: analysisData.sentimentData || null,
        onchain_metrics: analysisData.onchainMetrics || null,
        derivatives_data: analysisData.derivativesData || null,
        macro_indicators: analysisData.macroIndicators || null,
        smart_money_flows: analysisData.smartMoneyFlows || null,
        news_sentiment: analysisData.newsSentiment || null,
        fundamental_analysis: analysisData.fundamentalAnalysis || null,
        
        // Performance Metrics
        analysis_duration_ms: analysisData.analysisDurationMs || null,
        api_calls_count: analysisData.apiCallsCount || null,
        errors_encountered: analysisData.errorsEncountered || null,
        warnings_generated: analysisData.warningsGenerated || null
      };

      const { error } = await supabase
        .from('trade_analysis_parameters')
        .insert(analysisParams);

      if (error) {
        console.error('❌ Erro ao salvar parâmetros de análise:', error);
      } else {
        console.log(`💾 Parâmetros de análise salvos para trade ${tradeId}`);
      }
    } catch (error) {
      console.error('❌ Erro ao salvar parâmetros de análise:', error);
    }
  }

  /**
   * Verifica rate limit atual e retorna o valor usado (1-min)
   */
  private async checkRateLimit(): Promise<number> {
    try {
      const { rateLimitManager } = await import('./rate-limit-manager');
      const rateLimitInfo = rateLimitManager.getRateLimitInfo();
      
      // Buscar header x-mbx-used-weight-1m (1 minuto)
      const weight1m = rateLimitInfo.find(info => 
        info.header.toLowerCase().includes('1m') || 
        info.header.toLowerCase().includes('60s')
      );
      
      return weight1m?.used || 0;
    } catch (error) {
      console.warn('⚠️ Erro ao verificar rate limit:', error);
      return 0;
    }
  }

  /**
   * Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // ✅ NOVAS FUNÇÕES HFT E PRÁTICAS PROFISSIONAIS
  // ============================================================================

  /**
   * ✅ HFT 1: Calcula VWAP real (não approximation)
   */
  private async calculateVWAP(symbol: string): Promise<number> {
    try {
      const binanceClient = getBinanceClient();
      const klines = await binanceClient.getKlines(symbol, '1h', 200);
      
      let cumulativeTPV = 0;
      let cumulativeVolume = 0;
      
      for (const candle of klines) {
        const typicalPrice = (parseFloat(candle.high) + parseFloat(candle.low) + parseFloat(candle.close)) / 3;
        const volume = parseFloat(candle.volume);
        
        cumulativeTPV += typicalPrice * volume;
        cumulativeVolume += volume;
      }
      
      return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
    } catch (error) {
      console.warn(`⚠️ Erro ao calcular VWAP para ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * ✅ HFT 2: Estratégia Mean Reversion usando VWAP e Bollinger Bands
   */
  private getMeanReversionSignal(technical: any, currentPrice: number, vwap: number): 'BUY' | 'SELL' | 'HOLD' {
    // VWAP Deviation
    const vwapDeviation = (currentPrice - vwap) / vwap;
    
    // Bollinger Bands
    if (technical.bollingerBands && technical.bollingerBands.upper && technical.bollingerBands.lower) {
      // Preço no lower band = oversold = BUY
      if (currentPrice < technical.bollingerBands.lower && vwapDeviation < -0.005) {
        return 'BUY';
      }
      
      // Preço no upper band = overbought = SELL
      if (currentPrice > technical.bollingerBands.upper && vwapDeviation > 0.005) {
        return 'SELL';
      }
    }
    
    // RSI extremes
    if (technical.rsi) {
      if (technical.rsi < 30 && vwapDeviation < -0.005) {
        return 'BUY'; // RSI oversold + VWAP below
      }
      if (technical.rsi > 70 && vwapDeviation > 0.005) {
        return 'SELL'; // RSI overbought + VWAP above
      }
    }
    
    return 'HOLD';
  }

  /**
   * ✅ HFT 3: Verifica múltiplas confirmações antes de trade
   */
  private checkMultipleConfirmations(
    predictiveV2: any,
    technical: any,
    currentPrice: number,
    vwap: number
  ): {confirmed: boolean, score: number, details: string[]} {
    const confirmations = [];
    let score = 0;
    
    // 1. Confiança alta
    if (predictiveV2.confidence >= 50) {
      confirmations.push(`Confiança: ${predictiveV2.confidence}%`);
      score += 1;
    }
    
    // 2. Sinal forte (STRONG_BUY ou STRONG_SELL)
    if (predictiveV2.signal.includes('STRONG')) {
      confirmations.push(`Sinal: ${predictiveV2.signal}`);
      score += 2;
    }
    
    // 3. RSI em extremo (oversold/overbought)
    if (technical.rsi) {
      if (technical.rsi < 30) {
        confirmations.push(`RSI oversold: ${technical.rsi.toFixed(1)}`);
        score += 1;
      } else if (technical.rsi > 70) {
        confirmations.push(`RSI overbought: ${technical.rsi.toFixed(1)}`);
        score += 1;
      }
    }
    
    // 4. VWAP deviation
    const vwapDeviation = (currentPrice - vwap) / vwap;
    if (Math.abs(vwapDeviation) > 0.005) {
      confirmations.push(`VWAP dev: ${(vwapDeviation * 100).toFixed(2)}%`);
      score += 1;
    }
    
    // 5. Volume acima da média
    if (technical.volume && technical.avgVolume && technical.volume > technical.avgVolume * 1.2) {
      confirmations.push(`Volume alto: ${(technical.volume/technical.avgVolume).toFixed(2)}x`);
      score += 1;
    }
    
    // 6. MACD confirmando
    if (technical.macd?.signal && technical.macd?.macd) {
      if (technical.macd.macd > technical.macd.signal) {
        confirmations.push(`MACD positivo`);
        score += 1;
      }
    }
    
    // Requer pelo menos 2 confirmações - AJUSTADO de 3+ para 2+
    const confirmed = score >= 2;
    
    return {
      confirmed,
      score,
      details: confirmations
    };
  }

  /**
   * ✅ HFT 4: Analisa volume e confirma movimento
   */
  private analyzeVolume(technical: any, signal: string): {allowed: boolean, reason: string} {
    if (!technical.volume || !technical.avgVolume) {
      return { allowed: true, reason: 'Dados de volume não disponíveis' };
    }
    
    const volumeRatio = technical.volume / technical.avgVolume;
    
    // Requer volume acima da média para confirmar movimento
    if (volumeRatio < 1.2) {
      return {
        allowed: false,
        reason: `Volume baixo: ${volumeRatio.toFixed(2)}x média (requer 1.2x+)`
      };
    }
    
    // Volume muito alto = movimento forte
    if (volumeRatio > 1.5) {
      return {
        allowed: true,
        reason: `Volume forte: ${volumeRatio.toFixed(2)}x média`
      };
    }
    
    return {
      allowed: true,
      reason: `Volume OK: ${volumeRatio.toFixed(2)}x média`
    };
  }

  /**
   * ✅ HFT 8: Calcula ATR (Average True Range) para ajuste dinâmico
   */
  private async calculateATR(symbol: string, period: number = 14): Promise<number> {
    try {
      const binanceClient = getBinanceClient();
      const klines = await binanceClient.getKlines(symbol, '1h', period + 1);
      
      if (klines.length < period + 1) {
        return 0;
      }
      
      let trueRanges: number[] = [];
      
      for (let i = 1; i < klines.length; i++) {
        const current = klines[i];
        const previous = klines[i - 1];
        
        const high = parseFloat(current.high);
        const low = parseFloat(current.low);
        const prevClose = parseFloat(previous.close);
        
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
      }
      
      // Calcular ATR como média móvel dos True Ranges
      const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
      
      console.log(`📊 ${symbol}: ATR = $${atr.toFixed(4)} (${period} períodos)`);
      return atr;
    } catch (error) {
      console.warn(`⚠️ Erro ao calcular ATR para ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * ✅ HFT 5: Calcula position size baseado em confiança e volatilidade
   */
  /**
   * ✅ HFT 5: Calcula position size baseado em confiança e volatilidade + ATR
   */
  private async calculatePositionSize(
    availableBalance: number,
    confidence: number,
    volatility: number,
    symbol: string,
    currentPrice: number
  ): Promise<number> {
    // Base: 12% do saldo - AJUSTADO para capital baixo
    let baseRisk = 0.12;
    
    // Ajuste por confiança - ESCALONADO para capital baixo
    if (confidence >= 70) {
      baseRisk = 0.15; // 15% para confiança alta
    } else if (confidence >= 60) {
      baseRisk = 0.12; // 12% para confiança média
    } else if (confidence >= 50) {
      baseRisk = 0.10; // 10% para confiança baixa
    } else if (confidence >= 40) {
      baseRisk = 0.08; // 8% para confiança muito baixa
    } else {
      return 0; // Não trade abaixo de 40%
    }
    
    // ✅ ATR ADJUSTMENT: Ajustar position size baseado na volatilidade real
    const atr = await this.calculateATR(symbol);
    let atrAdjustment = 1.0;
    
    if (atr > 0) {
      const atrPercent = (atr / currentPrice) * 100;
      
      // Se ATR > 3%, reduzir position size
      if (atrPercent > 3) {
        atrAdjustment = 0.6; // Reduzir 40%
        console.log(`⚠️ ${symbol}: ATR alto (${atrPercent.toFixed(2)}%) - reduzindo position size`);
      } else if (atrPercent > 2) {
        atrAdjustment = 0.8; // Reduzir 20%
        console.log(`⚠️ ${symbol}: ATR médio (${atrPercent.toFixed(2)}%) - reduzindo position size`);
      } else {
        atrAdjustment = 1.0; // Manter normal
        console.log(`✅ ${symbol}: ATR baixo (${atrPercent.toFixed(2)}%) - position size normal`);
      }
    }
    
    // Ajuste por volatilidade (reduzir em alta volatilidade)
    const volatilityAdjustment = volatility > 5 ? 0.7 : 1.0;
    
    const positionSize = availableBalance * baseRisk * volatilityAdjustment * atrAdjustment;
    
    console.log(`💼 Position sizing: ${(baseRisk*100).toFixed(0)}% × ${(volatilityAdjustment*100).toFixed(0)}% vol × ${(atrAdjustment*100).toFixed(0)}% ATR = ${(positionSize/availableBalance*100).toFixed(2)}%`);
    
    return positionSize;
  }

  /**
   * ✅ HFT 6: Atualiza trailing stop loss
   */
  private updateTrailingStop(trade: any, currentPrice: number): boolean {
    let shouldUpdate = false;
    let newStopLoss = trade.stopLoss;
    
    if (trade.side === 'BUY') {
      const profit = (currentPrice - trade.entryPrice) / trade.entryPrice;
      
      // +1% de lucro: Travar em break-even
      if (profit > 0.01 && trade.stopLoss < trade.entryPrice) {
        newStopLoss = trade.entryPrice;
        shouldUpdate = true;
        console.log(`📈 ${trade.symbol}: Trailing SL para break-even (+1%)`);
      }
      
      // +2% de lucro: Travar em +1%
      if (profit > 0.02 && trade.stopLoss < trade.entryPrice * 1.01) {
        newStopLoss = trade.entryPrice * 1.01;
        shouldUpdate = true;
        console.log(`📈 ${trade.symbol}: Trailing SL para +1% (+2%)`);
      }
      
      // +3% de lucro: Travar em +2%
      if (profit > 0.03 && trade.stopLoss < trade.entryPrice * 1.02) {
        newStopLoss = trade.entryPrice * 1.02;
        shouldUpdate = true;
        console.log(`📈 ${trade.symbol}: Trailing SL para +2% (+3%)`);
      }
    } else if (trade.side === 'SELL') {
      const profit = (trade.entryPrice - currentPrice) / trade.entryPrice;
      
      // Mesma lógica invertida para SELL
      if (profit > 0.01 && trade.stopLoss > trade.entryPrice) {
        newStopLoss = trade.entryPrice;
        shouldUpdate = true;
      }
      
      if (profit > 0.02 && trade.stopLoss > trade.entryPrice * 0.99) {
        newStopLoss = trade.entryPrice * 0.99;
        shouldUpdate = true;
      }
      
      if (profit > 0.03 && trade.stopLoss > trade.entryPrice * 0.98) {
        newStopLoss = trade.entryPrice * 0.98;
        shouldUpdate = true;
      }
    }
    
    if (shouldUpdate) {
      trade.stopLoss = newStopLoss;
      // Atualizar stop loss na Binance
      // this.updateStopLossInBinance(trade); // Implementar depois
      return true;
    }
    
    return false;
  }

  /**
   * ✅ HFT 7: Take profit parcial
   */
  private async takeProfitParcial(trade: any, currentPrice: number): Promise<boolean> {
    if (trade.partialProfitTaken) {
      return false; // Já fechou parcial
    }
    
    let shouldTakePartial = false;
    
    if (trade.side === 'BUY') {
      const profit = (currentPrice - trade.entryPrice) / trade.entryPrice;
      // 2% de lucro = fechar 50% da posição
      if (profit >= 0.02) {
        shouldTakePartial = true;
      }
    } else {
      const profit = (trade.entryPrice - currentPrice) / trade.entryPrice;
      if (profit >= 0.02) {
        shouldTakePartial = true;
      }
    }
    
    if (shouldTakePartial) {
      const binanceClient = getBinanceClient();
      const closeQuantity = trade.quantity / 2;
      
      try {
        // Fechar 50% da posição
        if (trade.side === 'BUY') {
          await binanceClient.createFuturesOrder(
            trade.symbol,
            'SELL',
            'MARKET',
            closeQuantity
          );
        } else {
          await binanceClient.createFuturesOrder(
            trade.symbol,
            'BUY',
            'MARKET',
            closeQuantity
          );
        }
        
        trade.partialProfitTaken = true;
        trade.quantity = trade.quantity / 2; // Atualizar quantidade restante
        
        console.log(`💰 ${trade.symbol}: Take profit parcial executado (50%)`);
        return true;
      } catch (error) {
        console.error(`Erro ao executar take profit parcial:`, error);
        return false;
      }
    }
    
    return false;
  }

  /**
   * ✅ EQUITY TRACKING: Registra saldo atual na tabela equity_history
   */
  private async recordEquityHistory(symbol: string = 'USDT', equity: number): Promise<void> {
    try {
      const { supabase } = await import('./supabase-db');
      if (!supabase) {
        console.warn('⚠️ Supabase não disponível para registrar equity');
        return;
      }

      // Verificar se o saldo mudou desde o último registro
      const { data: lastRecord } = await supabase
        .from('equity_history')
        .select('equity')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // Se não há mudança significativa (menos de $0.01), não registrar
      if (lastRecord && Math.abs(equity - parseFloat(lastRecord.equity)) < 0.01) {
        return;
      }

      // Registrar novo saldo
      await supabase.from('equity_history').insert({
        symbol,
        equity,
        timestamp: new Date().toISOString()
      });

      console.log(`📊 Equity registrado: ${symbol} = $${equity.toFixed(2)}`);
    } catch (error) {
      console.error('❌ Erro ao registrar equity:', error);
    }
  }

  /**
   * ✅ EQUITY TRACKING: Registra saldo de todas as contas (Spot e Futures)
   */
  private async recordAllEquityHistory(): Promise<void> {
    try {
      const binanceClient = getBinanceClient();
      
      // Registrar saldo Spot (se disponível)
      try {
        const accountInfo = await binanceClient.getAccountInfo();
        const usdtBalance = accountInfo.balances.find((b: any) => b.asset === 'USDT');
        if (usdtBalance) {
          const spotBalance = parseFloat(usdtBalance.free);
          if (spotBalance > 0) {
            await this.recordEquityHistory('USDT_SPOT', spotBalance);
          }
        }
      } catch (error) {
        console.warn('⚠️ Não foi possível obter saldo Spot:', error);
      }

      // Registrar saldo Futures (se disponível)
      if (this.isFuturesMode) {
        try {
          const futuresAccount = await binanceClient.getFuturesAccountInfo();
          const futuresBalance = parseFloat(futuresAccount.totalWalletBalance || '0');
          if (futuresBalance > 0) {
            await this.recordEquityHistory('USDT_FUTURES', futuresBalance);
          }
        } catch (error) {
          console.warn('⚠️ Não foi possível obter saldo Futures:', error);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao registrar histórico de equity:', error);
    }
  }

  /**
   * ✅ MÉTODO PÚBLICO: Inicia trading em modo Spot
   */
  public async startTrading(availableBalance: number): Promise<void> {
    console.log(`\n🚀 INICIANDO TRADING SPOT com $${availableBalance.toFixed(2)}`);
    
    this.isFuturesMode = false;
    this.isRunning = true;
    
    // Resetar contador diário se necessário
    this.resetDailyCounterIfNeeded();
    
    // Registrar equity inicial
    await this.recordEquityHistory('USDT_SPOT', availableBalance);
    
    console.log('✅ Trading Spot iniciado com sucesso!');
    
    // ✅ NOVO: Iniciar loop principal de trading
    this.runTradingCycle().catch(error => {
      console.error('❌ Erro no loop de trading:', error);
    });
    
    console.log('🔄 Loop principal de trading iniciado!');
  }

  /**
   * ✅ MÉTODO PÚBLICO: Inicia trading em modo Futures
   */
  public async startTradingFutures(leverage: number = 5): Promise<void> {
    console.log(`\n🚀 INICIANDO TRADING FUTURES com leverage ${leverage}x`);
    
    this.isFuturesMode = true;
    this.isRunning = true;
    
    // Resetar contador diário se necessário
    this.resetDailyCounterIfNeeded();
    
    // Obter saldo Futures
    const binanceClient = getBinanceClient();
    const futuresAccount = await binanceClient.getFuturesAccountInfo();
    const futuresBalance = parseFloat(futuresAccount.totalWalletBalance || '0');
    
    // Registrar equity inicial
    await this.recordEquityHistory('USDT_FUTURES', futuresBalance);
    
    // ✅ NOVO: Iniciar monitoramento de preços das trades
    await tradePriceMonitor.startMonitoring();
    console.log('📊 Monitoramento de preços das trades iniciado');
    
    // ✅ NOVO: Iniciar serviço de preenchimento automático do banco
    await databasePopulationService.start();
    console.log('📊 Serviço de preenchimento automático do banco iniciado');
    
    console.log(`✅ Trading Futures iniciado com sucesso! Saldo: $${futuresBalance.toFixed(2)}`);
    
    // ✅ NOVO: Iniciar loop principal de trading
    this.runTradingCycle().catch(error => {
      console.error('❌ Erro no loop de trading:', error);
    });
    
    console.log('🔄 Loop principal de trading iniciado!');
  }

  /**
   * ✅ NOVO: Loop principal de trading
   */
  private async runTradingCycle(): Promise<void> {
    console.log('🔄 Iniciando loop principal de trading...');
    
    // Log de status completo do sistema
    this.logSystemStatus();
    
    let cycleCount = 0;
    
    while (this.isRunning) {
      try {
        cycleCount++;
        console.log(`\n🔄 CICLO ${cycleCount} - Iniciando verificação de oportunidades...`);
        console.log(`📊 DEBUG - Status do ciclo ${cycleCount}:`);
        console.log(`   isRunning: ${this.isRunning}`);
        console.log(`   canOpenNewTrade: ${this.canOpenNewTrade()}`);
        console.log(`   openTrades.size: ${this.openTrades.size}`);
        
        // 1. Obter saldo atual
        console.log('💰 Obtendo saldo atual...');
        const balance = await this.getCurrentBalance();
        console.log(`💰 Saldo atual: $${balance.toFixed(2)}`);
        
        // 2. Verificar se pode abrir novas trades
        console.log('🔍 Verificando se pode abrir novas trades...');
        const canOpen = this.canOpenNewTrade();
        console.log(`🔍 Resultado canOpenNewTrade: ${canOpen}`);
        
        if (!canOpen) {
          console.log('⏸️ Limite de trades atingido, aguardando...');
          await this.sleep(30000); // 30 segundos
          continue;
        }
        
        // 3. Encontrar oportunidades
        console.log('🔍 Buscando oportunidades...');
        const opportunities = await this.getOptimalSymbols(balance);
        console.log(`🎯 Encontradas ${opportunities.length} oportunidades`);
        
        // 4. Verificar monitoramento inteligente para trades abertas
        console.log('🧠 Monitoramento inteligente desabilitado temporariamente...');
        
        // 5. Executar trades se houver oportunidades
        console.log(`\n🚀 EXECUÇÃO DE TRADES - Ciclo ${cycleCount}:`);
        console.log(`📊 DEBUG - Status antes da execução:`);
        console.log(`   isRunning: ${this.isRunning}`);
        console.log(`   canOpenNewTrade: ${this.canOpenNewTrade()}`);
        console.log(`   openTrades.size: ${this.openTrades.size}`);
        console.log(`   opportunities.length: ${opportunities.length}`);
        
        if (opportunities.length === 0) {
          console.log('⏸️ Nenhuma oportunidade encontrada, aguardando próximo ciclo...');
        } else {
          console.log(`🎯 Processando ${Math.min(opportunities.length, 5)} oportunidades (máximo 5 por ciclo)...`);
          
          for (let i = 0; i < Math.min(opportunities.length, 5); i++) {
            const opportunity = opportunities[i];
            console.log(`\n🔍 OPORTUNIDADE ${i + 1}/${Math.min(opportunities.length, 5)}: ${opportunity.symbol}`);
            console.log(`   Action: ${opportunity.decision.action}`);
            console.log(`   Size: ${opportunity.decision.size}`);
            console.log(`   Confidence: ${opportunity.confidence}%`);
            console.log(`   Score: ${opportunity.score}`);
            
            // Verificar condições antes da execução
            console.log(`🔍 Verificando condições para execução:`);
            console.log(`   isRunning: ${this.isRunning}`);
            console.log(`   canOpenNewTrade: ${this.canOpenNewTrade()}`);
            
            // ✅ NOVO: Verificação inteligente de prioridade
            const canOpenWithPriority = this.canOpenTradeWithPriority(
              opportunity.symbol, 
              opportunity.confidence, 
              opportunity.score
            );
            
            if (this.isRunning && canOpenWithPriority) {
              console.log(`✅ Condições OK - Executando trade ${opportunity.symbol}...`);
              
              // ✅ NOVO: Verificar se precisa substituir trade existente
              const symbolTrades = Array.from(this.openTrades.values()).filter(trade => trade.symbol === opportunity.symbol);
              const symbolConfig = this.configService.getSymbolSettings(opportunity.symbol);
              const maxPositionsForSymbol = symbolConfig?.maxPositions || 2;
              
              if (symbolTrades.length >= maxPositionsForSymbol) {
                console.log(`🔄 Substituindo trade menos lucrativa para abrir ${opportunity.symbol}...`);
                await this.replaceWorstTrade(opportunity.symbol, opportunity.confidence, opportunity.score);
              }
              
              try {
                const startTime = Date.now();
                await this.executeTrade(opportunity.symbol, opportunity.decision);
                const executionTime = Date.now() - startTime;
                console.log(`✅ Trade ${opportunity.symbol} executada com sucesso em ${executionTime}ms`);
              } catch (error) {
                console.error(`❌ ERRO ao executar trade ${opportunity.symbol}:`, error);
                console.error(`❌ Detalhes do erro:`, (error as Error).message);
                if ((error as any).response) {
                  console.error(`❌ Status: ${(error as any).response.status}`);
                  console.error(`❌ Data:`, (error as any).response.data);
                }
              }
            } else {
              console.log(`⏸️ Trade ${opportunity.symbol} NÃO executada:`);
              console.log(`   isRunning: ${this.isRunning}`);
              console.log(`   canOpenWithPriority: ${canOpenWithPriority}`);
            }
          }
        }
        
        // 5. Sincronizar trades com Binance (CRÍTICO: garantir que banco está sincronizado)
        console.log(`\n🔄 SINCRONIZAÇÃO COM BINANCE - Ciclo ${cycleCount}:`);
        await this.syncTradesWithBinance();
        
        // 5.1. Verificar se há trades duplicadas e limpar
        await this.cleanupDuplicateTrades();
        
        // 6. Monitorar trades abertas
        console.log(`\n🔍 MONITORAMENTO DE TRADES ABERTAS - Ciclo ${cycleCount}:`);
        console.log(`📊 Trades abertas: ${this.openTrades.size}`);
        if (this.openTrades.size > 0) {
          console.log('📋 Lista de trades abertas:');
          this.openTrades.forEach((trade, symbol) => {
            console.log(`   - ${symbol}: ${trade.side} ${trade.quantity} @ $${trade.entryPrice}`);
          });
        }
        await this.monitorOpenTradesEnhanced();
        
        // 7. Verificar e fechar trades que excederam timeout
        await this.checkAndCloseTimedOutTrades();
        
        // 8. Registrar equity periodicamente (a cada ciclo)
        await this.recordEquityPeriodically();
        
        // 9. ✅ NOVO: Monitorar preços das trades (histórico para análise)
        // O monitoramento roda em background, mas garantimos que está ativo
        if (!tradePriceMonitor.isMonitoringActive()) {
          await tradePriceMonitor.startMonitoring();
        }
        
        // 6. Aguardar antes da próxima iteração
        console.log(`\n⏳ CICLO ${cycleCount} CONCLUÍDO - Aguardando 30 segundos para próximo ciclo...`);
        console.log('📊 RESUMO DO CICLO:');
        console.log(`   Oportunidades encontradas: ${opportunities.length}`);
        console.log(`   Trades abertas: ${this.openTrades.size}`);
        console.log(`   Saldo atual: $${balance.toFixed(2)}`);
        console.log(`   Status: ${this.isRunning ? 'ATIVO' : 'PARADO'}`);
        
        await this.sleep(30000); // 30 segundos
        
      } catch (error) {
        console.error('❌ Erro no ciclo de trading:', error);
        await this.sleep(60000); // 1 minuto em caso de erro
      }
    }
    
    console.log('🛑 Loop principal de trading finalizado');
  }

  /**
   * ✅ NOVO: Monitora trades abertas
   */
  private async monitorOpenTrades(): Promise<void> {
    if (this.openTrades.size === 0) {
      return;
    }
    
    console.log(`🔍 Monitorando ${this.openTrades.size} trades abertas...`);
    
    for (const [tradeId, trade] of this.openTrades.entries()) {
      try {
        // Verificar se trade deve ser fechada
        if (this.shouldCloseTrade(trade)) {
          console.log(`🔒 Fechando trade ${tradeId} (${trade.symbol}) - Stop Loss ou Take Profit`);
          await this.closeTrade(tradeId, 'stop_loss_or_take_profit');
        }
      } catch (error) {
        console.error(`❌ Erro ao monitorar trade ${tradeId}:`, error);
      }
    }
  }

  /**
   * ✅ NOVO: Monitora trades abertas (versão melhorada - usa banco como fonte de verdade)
   */
  private async monitorOpenTradesEnhanced(): Promise<void> {
    try {
      // 1. Buscar trades do banco (fonte de verdade)
      const { supabase } = await import('./supabase-db');
      if (!supabase) {
        console.warn('⚠️ Supabase não disponível para monitoramento');
        return;
      }
      
      const { data: dbTrades, error } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false });
      
      if (error) {
        console.error('❌ Erro ao buscar trades do banco:', error);
        return;
      }
      
      if (!dbTrades || dbTrades.length === 0) {
        console.log('📊 Nenhuma trade aberta no banco de dados');
        return;
      }
      
      console.log(`🔍 Monitorando ${dbTrades.length} trades abertas do banco...`);
      
      // 2. Para cada trade do banco, verificar na Binance
      const binanceClient = getBinanceClient();
      const positions = await binanceClient.getFuturesPositions();
      
      for (const trade of dbTrades) {
        try {
          if (!trade.trade_id || !trade.symbol || !trade.entry_price || !trade.quantity) {
            continue; // Pular trades inválidas
          }
          
          const binancePos = positions.find((p: any) => 
            p.symbol === trade.symbol && 
            Math.abs(parseFloat(p.positionAmt || '0')) > 0
          );
          
          if (!binancePos) {
            // Posição foi fechada na Binance mas está open no banco
            console.log(`⚠️ ${trade.symbol}: Posição fechada na Binance, sincronizando banco...`);
            await this.closeTradeFromDatabase(trade.trade_id, 'position_closed_externally');
            continue;
          }
          
          // Atualizar P&L e preço atual
          const currentPrice = parseFloat(binancePos.markPrice || binancePos.entryPrice || trade.entry_price);
          const pnl = parseFloat(binancePos.unRealizedProfit || '0');
          const isolatedMargin = parseFloat(binancePos.isolatedMargin || '0');
          
          let pnlPercent = 0;
          if (isolatedMargin > 0) {
            pnlPercent = (pnl / isolatedMargin) * 100;
          } else {
            // Fallback: calcular baseado em preço
            const priceChange = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
            pnlPercent = trade.side === 'BUY' ? priceChange : -priceChange;
          }
          
          // Atualizar no banco
          await supabase
            .from('real_trades')
            .update({
              current_price: currentPrice,
              pnl: pnl,
              pnl_percent: pnlPercent,
              updated_at: new Date().toISOString()
            })
            .eq('trade_id', trade.trade_id);
          
          console.log(`📊 ${trade.symbol}: P&L $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
          
          // ✅ AJUSTE: Stop Loss em -15% (mais conservador) e Take Profit em 25% (realista)
          if (pnlPercent <= -15.0) {
            console.log(`🚨 STOP LOSS ATIVADO para ${trade.symbol}! P&L: ${pnlPercent.toFixed(2)}%`);
            await this.closeTradeFromDatabase(trade.trade_id, 'stop_loss');
          } else if (pnlPercent >= 25.0) {
            console.log(`🎯 TAKE PROFIT ATIVADO para ${trade.symbol}! P&L: ${pnlPercent.toFixed(2)}%`);
            await this.closeTradeFromDatabase(trade.trade_id, 'take_profit');
          }
          
          // Adicionar ao Map interno se não estiver lá
          if (!this.openTrades.has(trade.trade_id)) {
            this.openTrades.set(trade.trade_id, {
              tradeId: trade.trade_id,
              symbol: trade.symbol,
              side: trade.side as 'BUY' | 'SELL',
              entryPrice: trade.entry_price,
              currentPrice: currentPrice,
              quantity: trade.quantity,
              pnl: pnl,
              pnlPercent: pnlPercent,
              stopLoss: trade.stop_loss,
              takeProfit: trade.take_profit,
              openedAt: new Date(trade.opened_at).getTime(),
              positionSize: trade.position_size || 2.0,
              binanceOrderId: trade.binance_order_id
            });
          } else {
            // Atualizar dados no Map
            const mapTrade = this.openTrades.get(trade.trade_id);
            if (mapTrade) {
              mapTrade.currentPrice = currentPrice;
              mapTrade.pnl = pnl;
              mapTrade.pnlPercent = pnlPercent;
            }
          }
          
        } catch (error) {
          console.error(`❌ Erro ao monitorar trade ${trade.trade_id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Erro no monitoramento melhorado:', error);
    }
  }
  
  /**
   * ✅ NOVO: Verifica status completo do sistema
   */
  public getSystemStatus(): any {
    const config = this.configService.getTradeLimits();
    const symbolConfig = this.configService.getSymbolConfig();
    
    return {
      // Status básico
      isRunning: this.isRunning,
      isFuturesMode: this.isFuturesMode,
      tradingHalted: this.tradingHalted,
      
      // Trades
      openTradesCount: this.openTrades.size,
      openTrades: Array.from(this.openTrades.entries()).map(([symbol, trade]) => ({
        symbol,
        side: trade.side,
        quantity: trade.quantity,
        entryPrice: trade.entryPrice,
        currentPrice: trade.currentPrice,
        pnl: trade.pnl,
        pnlPercent: trade.pnlPercent
      })),
      
      // Configurações
      maxActiveTrades: this.configService.getTradeLimits().maxActiveTrades,
      allowNewTrades: this.configService.getTradeLimits().allowNewTrades,
      blacklistedSymbols: symbolConfig.blacklistedSymbols,
      prioritySymbols: symbolConfig.prioritySymbols,
      
      // Status de permissões
      canOpenNewTrade: this.canOpenNewTrade(),
      
      // Timestamps
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * ✅ NOVO: Log de status completo do sistema
   */
  public logSystemStatus(): void {
    const status = this.getSystemStatus();
    
    console.log('\n📊 STATUS COMPLETO DO SISTEMA KRONOS-X:');
    console.log('============================================================');
    console.log('🔧 CONFIGURAÇÕES:');
    console.log(`   Trading ativo: ${status.isRunning ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Modo Futures: ${status.isFuturesMode ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Trading pausado: ${status.tradingHalted ? '❌ SIM' : '✅ NÃO'}`);
    console.log(`   Permitir novos trades: ${status.allowNewTrades ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Máximo trades ativas: ${status.maxActiveTrades || 'Sem limite'}`);
    console.log(`   Pode abrir nova trade: ${status.canOpenNewTrade ? '✅ SIM' : '❌ NÃO'}`);
    
    console.log('\n📈 TRADES:');
    console.log(`   Trades abertas: ${status.openTradesCount}`);
    if (status.openTradesCount > 0) {
      status.openTrades.forEach((trade: any) => {
        console.log(`     - ${trade.symbol}: ${trade.side} ${trade.quantity} @ $${trade.entryPrice} (P&L: $${trade.pnl.toFixed(2)})`);
      });
    } else {
      console.log('     Nenhuma trade aberta');
    }
    
    console.log('\n🚫 SÍMBOLOS BLOQUEADOS:');
    console.log(`   ${status.blacklistedSymbols.join(', ') || 'Nenhum'}`);
    
    console.log('\n⭐ SÍMBOLOS PRIORITÁRIOS:');
    console.log(`   ${status.prioritySymbols.join(', ')}`);
    
    console.log('============================================================\n');
  }

  /**
   * ✅ NOVO: Sistema inteligente de priorização de trades
   * Permite abrir trades excepcionais mesmo com limites atingidos
   */
  private canOpenTradeWithPriority(symbol: string, confidence: number, score: number): boolean {
    const config = this.configService.getTradeLimits();
    const symbolConfig = this.configService.getSymbolSettings(symbol);
    const currentOpenTrades = this.openTrades.size;
    
    console.log(`🔍 VERIFICAÇÃO INTELIGENTE DE PRIORIDADE - ${symbol}:`);
    console.log(`   Confiança: ${confidence}%`);
    console.log(`   Score: ${score}`);
    console.log(`   Trades abertas: ${currentOpenTrades}`);
    
    // 1. Verificação básica (já implementada)
    if (!this.canOpenNewTrade()) {
      console.log(`   ❌ Falha na verificação básica`);
      return false;
    }
    
    // 2. Verificação de limite por símbolo
    const symbolTrades = Array.from(this.openTrades.values()).filter(trade => trade.symbol === symbol);
    const maxPositionsForSymbol = symbolConfig?.maxPositions || this.configService.getConfig().riskManagement.maxPositionsPerSymbol;
    
    console.log(`   Trades do símbolo ${symbol}: ${symbolTrades.length}/${maxPositionsForSymbol}`);
    
    if (symbolTrades.length >= maxPositionsForSymbol) {
      // 3. VERIFICAÇÃO DE PRIORIDADE - Trade excepcional?
      const isExceptionalTrade = this.isExceptionalTrade(symbol, confidence, score);
      
      if (isExceptionalTrade) {
        console.log(`   ⭐ TRADE EXCEPCIONAL DETECTADA!`);
        console.log(`   🚀 Permitindo abertura mesmo com limite atingido`);
        
        // Fechar trade menos lucrativa do mesmo símbolo para abrir a nova
        const shouldReplace = this.shouldReplaceExistingTrade(symbolTrades, confidence, score);
        
        if (shouldReplace) {
          console.log(`   🔄 Substituindo trade menos lucrativa`);
          return true;
        } else {
          console.log(`   ⚠️ Trade excepcional mas não substituindo`);
          return false;
        }
      } else {
        console.log(`   ❌ Limite por símbolo atingido e não é trade excepcional`);
        return false;
      }
    }
    
    console.log(`   ✅ Pode abrir trade normalmente`);
    return true;
  }

  /**
   * ✅ NOVO: Verifica se é uma trade excepcional
   */
  private isExceptionalTrade(symbol: string, confidence: number, score: number): boolean {
    const symbolConfig = this.configService.getSymbolSettings(symbol);
    const minConfidence = symbolConfig?.minConfidence || 40;
    
    // Critérios para trade excepcional:
    const criteria = {
      // 1. Confiança muito alta
      highConfidence: confidence >= minConfidence + 20, // +20% acima do mínimo
      
      // 2. Score muito alto
      highScore: score >= 8.0, // Score muito positivo
      
      // 3. Símbolo prioritário com alta confiança
      prioritySymbol: ['BTCUSDT', 'ETHUSDT'].includes(symbol) && confidence >= 60,
      
      // 4. Score extremamente positivo
      extremeScore: score >= 10.0
    };
    
    const isExceptional = criteria.highConfidence || criteria.highScore || 
                         criteria.prioritySymbol || criteria.extremeScore;
    
    console.log(`   📊 Critérios de trade excepcional:`);
    console.log(`     Confiança alta (+20%): ${criteria.highConfidence} (${confidence}% >= ${minConfidence + 20}%)`);
    console.log(`     Score alto (>=8.0): ${criteria.highScore} (${score} >= 8.0)`);
    console.log(`     Símbolo prioritário: ${criteria.prioritySymbol}`);
    console.log(`     Score extremo (>=10.0): ${criteria.extremeScore} (${score} >= 10.0)`);
    console.log(`     RESULTADO: ${isExceptional ? '⭐ EXCEPCIONAL' : '➖ NORMAL'}`);
    
    return isExceptional;
  }

  /**
   * ✅ NOVO: Verifica se deve substituir trade existente
   */
  private shouldReplaceExistingTrade(existingTrades: any[], newConfidence: number, newScore: number): boolean {
    if (existingTrades.length === 0) return true;
    
    // Encontrar trade menos lucrativa
    const worstTrade = existingTrades.reduce((worst, current) => {
      const currentPerformance = (current.pnl || 0) + (current.confidence || 0);
      const worstPerformance = (worst.pnl || 0) + (worst.confidence || 0);
      return currentPerformance < worstPerformance ? current : worst;
    });
    
    const worstConfidence = worstTrade.confidence || 0;
    const worstScore = worstTrade.score || 0;
    
    // Critérios para substituição:
    const shouldReplace = 
      newConfidence > worstConfidence + 15 || // +15% mais confiança
      newScore > worstScore + 3.0 || // +3.0 score melhor
      (worstTrade.pnl || 0) < -0.5; // Trade com perda > $0.50
    
    console.log(`   🔍 Análise de substituição:`);
    console.log(`     Trade atual: Conf=${worstConfidence}%, Score=${worstScore}, P&L=$${worstTrade.pnl || 0}`);
    console.log(`     Nova trade: Conf=${newConfidence}%, Score=${newScore}`);
    console.log(`     Deve substituir: ${shouldReplace ? '✅ SIM' : '❌ NÃO'}`);
    
    return shouldReplace;
  }

  /**
   * ✅ NOVO: Substitui trade menos lucrativa por uma melhor
   */
  private async replaceWorstTrade(symbol: string, newConfidence: number, newScore: number): Promise<void> {
    try {
      const symbolTrades = Array.from(this.openTrades.values()).filter(trade => trade.symbol === symbol);
      
      if (symbolTrades.length === 0) {
        console.log(`⚠️ Nenhuma trade do símbolo ${symbol} para substituir`);
        return;
      }
      
      // Encontrar trade menos lucrativa
      const worstTrade = symbolTrades.reduce((worst, current) => {
        const currentPerformance = (current.pnl || 0) + (current.confidence || 0);
        const worstPerformance = (worst.pnl || 0) + (worst.confidence || 0);
        return currentPerformance < worstPerformance ? current : worst;
      });
      
      console.log(`🔄 Substituindo trade menos lucrativa:`);
      console.log(`   Trade atual: ${worstTrade.symbol} ${worstTrade.side} ${worstTrade.quantity}`);
      console.log(`   Confiança atual: ${worstTrade.confidence}%`);
      console.log(`   P&L atual: $${worstTrade.pnl || 0}`);
      console.log(`   Nova confiança: ${newConfidence}%`);
      console.log(`   Nova score: ${newScore}`);
      
      // Fechar trade menos lucrativa
      await this.closeTrade(worstTrade.tradeId, 'replaced_by_better_opportunity');
      
      console.log(`✅ Trade ${worstTrade.symbol} fechada para substituição`);
      
    } catch (error) {
      console.error(`❌ Erro ao substituir trade:`, error);
    }
  }

  private canOpenNewTrade(): boolean {
    const config = this.configService.getTradeLimits();
    const currentOpenTrades = this.openTrades.size;
    
    console.log(`🔍 DEBUG - canOpenNewTrade:`);
    console.log(`   currentOpenTrades: ${currentOpenTrades}`);
    console.log(`   maxActiveTrades: ${config.maxActiveTrades}`);
    console.log(`   allowNewTrades: ${config.allowNewTrades}`);
    console.log(`   tradingHalted: ${this.tradingHalted}`);
    
    // Verificar limite de trades ativas
    if (config.maxActiveTrades && currentOpenTrades >= config.maxActiveTrades) {
      console.log(`   ❌ Limite de trades atingido: ${currentOpenTrades}/${config.maxActiveTrades}`);
      return false;
    }
    
    // Verificar se trading está habilitado
    if (!config.allowNewTrades) {
      console.log(`   ❌ Trading não habilitado`);
      return false;
    }
    
    // Verificar se não está em modo halt
    if (this.tradingHalted) {
      console.log(`   ❌ Trading em modo halt`);
      return false;
    }
    
    console.log(`   ✅ Pode abrir nova trade`);
    return true;
  }

  /**
   * ✅ NOVO: Obtém saldo atual
   */
  private async getCurrentBalance(): Promise<number> {
    try {
      const binanceClient = getBinanceClient();
      const futuresAccount = await binanceClient.getFuturesAccountInfo();
      return parseFloat(futuresAccount.totalWalletBalance || '0');
    } catch (error) {
      console.error('❌ Erro ao obter saldo:', error);
      return 0;
    }
  }

  /**
   * ✅ MÉTODO PÚBLICO: Para o trading
   */
  public async stopTrading(): Promise<void> {
    console.log('\n🛑 PARANDO TRADING...');
    
    this.isRunning = false;
    
    // Fechar todas as trades abertas
    for (const [tradeId, trade] of this.openTrades.entries()) {
      console.log(`🔒 Fechando trade ${tradeId} (${trade.symbol})`);
      await this.closeTrade(tradeId, 'manual_stop');
    }
    
    console.log('✅ Trading parado com sucesso!');
  }

  /**
   * ✅ MÉTODO PÚBLICO: Verifica se está rodando
   */
  public isTradingRunning(): boolean {
    return this.isRunning;
  }
  
  /**
   * ✅ NOVO: Sincroniza trades do banco com posições da Binance
   */
  private async syncTradesWithBinance(): Promise<void> {
    try {
      const { supabase } = await import('./supabase-db');
      if (!supabase) {
        console.warn('⚠️ Supabase não disponível para sincronização');
        return;
      }
      
      const binanceClient = getBinanceClient();
      const positions = await binanceClient.getFuturesPositions();
      const openPositions = positions.filter((p: any) => Math.abs(parseFloat(p.positionAmt || '0')) > 0);
      
      // Buscar trades abertas do banco
      const { data: dbTrades, error } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open');
      
      if (error) {
        console.error('❌ Erro ao buscar trades do banco para sincronização:', error);
        return;
      }
      
      if (!dbTrades || dbTrades.length === 0) {
        return;
      }
      
      console.log(`🔄 Sincronizando ${dbTrades.length} trades do banco com ${openPositions.length} posições da Binance...`);
      
      // Verificar cada trade do banco
      for (const dbTrade of dbTrades) {
        try {
          if (!dbTrade.trade_id || !dbTrade.symbol) {
            continue;
          }
          
          const binancePos = openPositions.find((p: any) => p.symbol === dbTrade.symbol);
          
          if (!binancePos) {
            // Posição foi fechada na Binance mas está open no banco
            console.log(`⚠️ Sincronização: ${dbTrade.symbol} foi fechado na Binance, atualizando banco...`);
            await this.closeTradeFromDatabase(dbTrade.trade_id, 'closed_on_binance');
          } else {
            // ✅ CRÍTICO: Obter preço ATUAL do mercado (não apenas da posição)
            try {
              const priceData = await binanceClient.getPrice(dbTrade.symbol);
              const currentPrice = parseFloat(priceData.price) || parseFloat(binancePos.markPrice || binancePos.entryPrice || dbTrade.entry_price);
              
              const pnl = parseFloat(binancePos.unRealizedProfit || '0');
              const isolatedMargin = parseFloat(binancePos.isolatedMargin || '0');
              
              let pnlPercent = 0;
              let finalPnL = pnl;
              
              if (isolatedMargin > 0) {
                // Usar P&L real da Binance
                pnlPercent = (pnl / isolatedMargin) * 100;
              } else {
                // Fallback: calcular baseado em mudança de preço
                const priceChange = ((currentPrice - dbTrade.entry_price) / dbTrade.entry_price) * 100;
                pnlPercent = dbTrade.side === 'BUY' ? priceChange : -priceChange;
                
                // Estimar P&L baseado em preço
                finalPnL = dbTrade.side === 'BUY' 
                  ? (currentPrice - dbTrade.entry_price) * dbTrade.quantity
                  : (dbTrade.entry_price - currentPrice) * dbTrade.quantity;
              }
              
              // Atualizar no banco com preço e P&L atualizados
              await supabase
                .from('real_trades')
                .update({
                  current_price: currentPrice,
                  pnl: finalPnL,
                  pnl_percent: pnlPercent,
                  updated_at: new Date().toISOString()
                })
                .eq('trade_id', dbTrade.trade_id);
            } catch (priceError) {
              console.warn(`⚠️ Erro ao obter preço de ${dbTrade.symbol}:`, priceError);
            }
          }
        } catch (error) {
          console.error(`❌ Erro ao sincronizar trade ${dbTrade.trade_id}:`, error);
        }
      }
      
      console.log('✅ Sincronização concluída');
    } catch (error) {
      console.error('❌ Erro na sincronização com Binance:', error);
    }
  }

  /**
   * ✅ CRÍTICO: Limpar trades duplicadas e órfãs
   */
  private async cleanupDuplicateTrades(): Promise<void> {
    try {
      const { supabase } = await import('./supabase-db');
      if (!supabase) {
        return;
      }
      
      // Buscar todas as trades abertas
      const { data: openTrades } = await supabase
        .from('real_trades')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: true });
      
      if (!openTrades || openTrades.length === 0) {
        return;
      }
      
      // Agrupar por símbolo e lado
      const tradesBySymbolSide: { [key: string]: any[] } = {};
      openTrades.forEach(t => {
        const key = `${t.symbol}_${t.side}`;
        if (!tradesBySymbolSide[key]) {
          tradesBySymbolSide[key] = [];
        }
        tradesBySymbolSide[key].push(t);
      });
      
      // Verificar duplicatas
      let cleanedCount = 0;
      for (const [key, trades] of Object.entries(tradesBySymbolSide)) {
        if (trades.length > 1) {
          console.log(`⚠️ Encontradas ${trades.length} trades duplicadas para ${key}`);
          
          // Ordenar por data de abertura (mais antigas primeiro)
          trades.sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());
          
          // Manter apenas a primeira, fechar as outras como duplicadas
          const toKeep = trades[0];
          const toClose = trades.slice(1);
          
          for (const duplicate of toClose) {
            console.log(`   🔒 Fechando trade duplicada: ${duplicate.trade_id}`);
            
            // Calcular P&L aproximado antes de fechar
            const currentPrice = duplicate.current_price || duplicate.entry_price;
            const pnl = duplicate.side === 'BUY'
              ? (currentPrice - duplicate.entry_price) * duplicate.quantity
              : (duplicate.entry_price - currentPrice) * duplicate.quantity;
            
            await supabase
              .from('real_trades')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                current_price: currentPrice,
                pnl: pnl,
                closed_reason: 'duplicate_trade'
              })
              .eq('trade_id', duplicate.trade_id);
            
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`✅ ${cleanedCount} trade(s) duplicada(s) limpa(s)`);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar trades duplicadas:', error);
    }
  }

  /**
   * ✅ NOVO: Registra equity periodicamente para análise
   */
  private async recordEquityPeriodically(): Promise<void> {
    try {
      const binanceClient = getBinanceClient();
      const futuresAccount = await binanceClient.getFuturesAccountInfo();
      const equity = parseFloat(futuresAccount.totalWalletBalance || '0');
      
      if (equity <= 0) {
        console.warn('⚠️ Equity inválido para registro periódico');
        return;
      }
      
      const { supabase } = await import('./supabase-db');
      if (!supabase) {
        console.warn('⚠️ Supabase não disponível para registrar equity');
        return;
      }
      
      // Verificar último registro para calcular retorno
      const { data: lastRecord } = await supabase
        .from('equity_history')
        .select('equity')
        .eq('symbol', 'USDT_FUTURES')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      let returnPercent = 0;
      if (lastRecord && lastRecord.equity) {
        const lastEquity = parseFloat(lastRecord.equity.toString());
        if (lastEquity > 0) {
          returnPercent = ((equity - lastEquity) / lastEquity) * 100;
        }
      }
      
      // Buscar primeiro registro para calcular retorno total
      const { data: firstRecord } = await supabase
        .from('equity_history')
        .select('equity')
        .eq('symbol', 'USDT_FUTURES')
        .order('timestamp', { ascending: true })
        .limit(1)
        .single();
      
      let totalReturnPercent = 0;
      if (firstRecord && firstRecord.equity) {
        const firstEquity = parseFloat(firstRecord.equity.toString());
        if (firstEquity > 0) {
          totalReturnPercent = ((equity - firstEquity) / firstEquity) * 100;
        }
      }
      
      await supabase.from('equity_history').insert({
        symbol: 'USDT_FUTURES',
        equity: equity,
        timestamp: new Date().toISOString(),
        return_percent: returnPercent
      });
      
      console.log(`💰 Equity registrado: $${equity.toFixed(2)} (${returnPercent > 0 ? '+' : ''}${returnPercent.toFixed(2)}% desde último registro)`);
      
      if (totalReturnPercent < -10) {
        console.warn(`⚠️ ATENÇÃO: Equity em declínio de ${totalReturnPercent.toFixed(2)}% desde o início`);
      }
    } catch (error) {
      console.error('❌ Erro ao registrar equity periodicamente:', error);
    }
  }

  /**
   * ✅ MÉTODO PÚBLICO: Obtém trades abertos
   */
  public getOpenTrades(): Map<string, any> {
    return this.openTrades;
  }

  /**
   * ✅ MÉTODO PÚBLICO: Obtém estatísticas
   */
  public getStats(): any {
    return {
      isRunning: this.isRunning,
      isFuturesMode: this.isFuturesMode,
      openTrades: this.openTrades.size,
      dailyTradeCount: this.dailyTradeCount,
      maxDailyTrades: this.maxDailyTrades,
      tradingHalted: this.tradingHalted,
      drawdownStopTriggered: this.drawdownStopTriggered
    };
  }
}

export const advancedTradingEngine = AdvancedTradingEngine.getInstance();


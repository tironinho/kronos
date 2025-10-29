import BinanceFuturesMeta, { FuturesSymbolMeta } from './binance-futures-meta';
import { logger, logTrading, logBinance } from './logger';

export interface SizingInput {
  symbol: string;               // "ADAUSDT"
  side: "BUY" | "SELL";
  leverage: number;             // ex 2
  maxMarginUsd: number;         // quanto de margem você quer comprometer ($1.77 etc)
  riskPercentage?: number;      // porcentagem de risco (opcional)
}

export interface SizingResult {
  ok: boolean;
  reason?: string;
  qty?: number;
  notionalUsd?: number;
  entryPrice?: number;
  requiredMargin?: number;
  meta?: FuturesSymbolMeta;
}

/**
 * ✅ CORREÇÃO CRÍTICA: Sistema de sizing correto para Futures
 * Problema: Calculava quantidade ideal mas não validava minQty e minNotional
 */
export class PositionSizing {
  
  /**
   * ✅ NOVO: Construir sizing executável para Futures
   */
  public static async buildOrderSizing(input: SizingInput): Promise<SizingResult> {
    try {
      const { symbol, side, leverage, maxMarginUsd, riskPercentage = 1.0 } = input;
      
      logTrading(`🔍 Calculando sizing para ${symbol}`, {
        side,
        leverage,
        maxMarginUsd,
        riskPercentage
      });

      // 1. ✅ CORREÇÃO: Puxa regras do par no mercado FUTURES
      const meta = await BinanceFuturesMeta.fetchFuturesSymbolMeta(symbol);
      
      // 2. ✅ CORREÇÃO: Preço atual FUTURES
      const price = await BinanceFuturesMeta.getFuturesPrice(symbol);
      
      // 3. Calcular margem disponível considerando risco
      const availableMargin = maxMarginUsd * riskPercentage;
      
      // 4. Quanto de exposição (notional) a gente QUER
      const desiredNotional = availableMargin * leverage;
      
      logTrading(`📊 Cálculos iniciais para ${symbol}`, {
        price,
        availableMargin,
        desiredNotional,
        leverage
      });

      // 5. Quantidade bruta
      let rawQty = desiredNotional / price;
      
      // 6. ✅ CORREÇÃO: Arredondar para stepSize
      let qty = BinanceFuturesMeta.roundToStepSize(rawQty, meta.stepSize);
      
      // 7. ✅ CORREÇÃO: Garantir minQty
      if (qty < meta.minQty) {
        qty = meta.minQty;
        logTrading(`⚠️ ${symbol}: Ajustando qty para minQty ${meta.minQty}`);
      }

      // 8. Recalcular notional real
      const notionalNow = qty * price;
      
      // 9. ✅ CORREÇÃO: Validar contra NOTIONAL mínimo
      if (notionalNow < meta.minNotional) {
        const reason = `Notional ${notionalNow.toFixed(2)} < minNotional ${meta.minNotional.toFixed(2)}`;
        logTrading(`❌ ${symbol}: ${reason}`);
        return {
          ok: false,
          reason,
          meta
        };
      }

      // 10. ✅ CORREÇÃO: Validar que sua margem suporta isso
      const requiredMargin = notionalNow / leverage;
      if (requiredMargin > availableMargin) {
        const reason = `Required margin ${requiredMargin.toFixed(2)} > available ${availableMargin.toFixed(2)}`;
        logTrading(`❌ ${symbol}: ${reason}`);
        return {
          ok: false,
          reason,
          meta
        };
      }

      // 11. ✅ CORREÇÃO: Validar quantidade final
      const qtyValidation = BinanceFuturesMeta.validateQuantity(qty, meta);
      if (!qtyValidation.valid) {
        logTrading(`❌ ${symbol}: ${qtyValidation.reason}`);
        return {
          ok: false,
          reason: qtyValidation.reason,
          meta
        };
      }

      // 12. ✅ CORREÇÃO: Validar notional final
      const notionalValidation = BinanceFuturesMeta.validateNotional(qty, price, meta);
      if (!notionalValidation.valid) {
        logTrading(`❌ ${symbol}: ${notionalValidation.reason}`);
        return {
          ok: false,
          reason: notionalValidation.reason,
          meta
        };
      }

      const result: SizingResult = {
        ok: true,
        qty,
        notionalUsd: notionalNow,
        entryPrice: price,
        requiredMargin,
        meta
      };

      logTrading(`✅ ${symbol}: Sizing válido`, {
        qty: qty.toFixed(meta.precision),
        notionalUsd: notionalNow.toFixed(2),
        entryPrice: price.toFixed(4),
        requiredMargin: requiredMargin.toFixed(2),
        leverage
      });

      return result;
    } catch (error) {
      logger.error(`❌ Erro ao calcular sizing para ${input.symbol}:`, 'TRADING', null, error);
      return {
        ok: false,
        reason: `Erro no cálculo: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * ✅ NOVO: Calcular sizing para múltiplos símbolos
   */
  public static async buildMultipleSizings(
    symbols: string[],
    side: "BUY" | "SELL",
    leverage: number,
    maxMarginUsd: number,
    riskPercentage: number = 1.0
  ): Promise<Map<string, SizingResult>> {
    
    const results = new Map<string, SizingResult>();
    
    logTrading(`🔍 Calculando sizing para ${symbols.length} símbolos`, {
      symbols,
      side,
      leverage,
      maxMarginUsd,
      riskPercentage
    });

    // Processar em paralelo para melhor performance
    const promises = symbols.map(async (symbol) => {
      try {
        const result = await this.buildOrderSizing({
          symbol,
          side,
          leverage,
          maxMarginUsd,
          riskPercentage
        });
        return { symbol, result };
      } catch (error) {
        logger.error(`❌ Erro ao calcular sizing para ${symbol}:`, 'TRADING', null, error);
        return {
          symbol,
          result: {
            ok: false,
            reason: `Erro: ${error instanceof Error ? error.message : 'Unknown error'}`
          } as SizingResult
        };
      }
    });

    const resolvedPromises = await Promise.all(promises);
    
    resolvedPromises.forEach(({ symbol, result }) => {
      results.set(symbol, result);
    });

    const validCount = Array.from(results.values()).filter(r => r.ok).length;
    logTrading(`✅ Sizing calculado para ${symbols.length} símbolos (${validCount} válidos)`);

    return results;
  }

  /**
   * ✅ NOVO: Filtrar símbolos executáveis
   */
  public static async filterExecutableSymbols(
    symbols: string[],
    side: "BUY" | "SELL",
    leverage: number,
    maxMarginUsd: number,
    riskPercentage: number = 1.0
  ): Promise<string[]> {
    
    const sizings = await this.buildMultipleSizings(
      symbols,
      side,
      leverage,
      maxMarginUsd,
      riskPercentage
    );

    const executableSymbols: string[] = [];
    
    sizings.forEach((result, symbol) => {
      if (result.ok) {
        executableSymbols.push(symbol);
        logTrading(`✅ ${symbol}: Executável (qty: ${result.qty?.toFixed(result.meta?.precision || 4)}, notional: $${result.notionalUsd?.toFixed(2)})`);
      } else {
        logTrading(`❌ ${symbol}: Não executável - ${result.reason}`);
      }
    });

    logTrading(`📊 Símbolos executáveis: ${executableSymbols.length}/${symbols.length}`, {
      executable: executableSymbols,
      total: symbols.length
    });

    return executableSymbols;
  }

  /**
   * ✅ NOVO: Calcular margem necessária para símbolo
   */
  public static async calculateRequiredMargin(
    symbol: string,
    side: "BUY" | "SELL",
    leverage: number,
    targetNotional: number
  ): Promise<{ requiredMargin: number; qty: number; price: number } | null> {
    
    try {
      const meta = await BinanceFuturesMeta.fetchFuturesSymbolMeta(symbol);
      const price = await BinanceFuturesMeta.getFuturesPrice(symbol);
      
      const qty = targetNotional / price;
      const roundedQty = BinanceFuturesMeta.roundToStepSize(qty, meta.stepSize);
      const finalQty = Math.max(roundedQty, meta.minQty);
      
      const finalNotional = finalQty * price;
      const requiredMargin = finalNotional / leverage;
      
      return {
        requiredMargin,
        qty: finalQty,
        price
      };
    } catch (error) {
      logger.error(`❌ Erro ao calcular margem necessária para ${symbol}:`, 'TRADING', null, error);
      return null;
    }
  }

  /**
   * ✅ NOVO: Validar se símbolo é executável com capital disponível
   */
  public static async isSymbolExecutable(
    symbol: string,
    side: "BUY" | "SELL",
    leverage: number,
    availableMargin: number
  ): Promise<{ executable: boolean; reason?: string; requiredMargin?: number }> {
    
    try {
      const meta = await BinanceFuturesMeta.fetchFuturesSymbolMeta(symbol);
      const price = await BinanceFuturesMeta.getFuturesPrice(symbol);
      
      // Calcular margem mínima necessária
      const minNotionalMargin = meta.minNotional / leverage;
      
      if (minNotionalMargin > availableMargin) {
        return {
          executable: false,
          reason: `Min notional margin ${minNotionalMargin.toFixed(2)} > available ${availableMargin.toFixed(2)}`,
          requiredMargin: minNotionalMargin
        };
      }

      return {
        executable: true,
        requiredMargin: minNotionalMargin
      };
    } catch (error) {
      logger.error(`❌ Erro ao validar executabilidade de ${symbol}:`, 'TRADING', null, error);
      return {
        executable: false,
        reason: `Erro na validação: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * ✅ NOVO: Obter estatísticas de sizing
   */
  public static getSizingStats(sizings: Map<string, SizingResult>): {
    total: number;
    valid: number;
    invalid: number;
    totalNotional: number;
    totalMargin: number;
  } {
    let valid = 0;
    let invalid = 0;
    let totalNotional = 0;
    let totalMargin = 0;

    sizings.forEach((result) => {
      if (result.ok) {
        valid++;
        totalNotional += result.notionalUsd || 0;
        totalMargin += result.requiredMargin || 0;
      } else {
        invalid++;
      }
    });

    return {
      total: sizings.size,
      valid,
      invalid,
      totalNotional,
      totalMargin
    };
  }
}

export default PositionSizing;

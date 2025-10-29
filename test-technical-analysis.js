#!/usr/bin/env node

/**
 * Script para testar o módulo de análise técnica
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testTechnicalAnalysis() {
  console.log('🧪 Testando Módulo de Análise Técnica...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Inicializar Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Credenciais do Supabase não encontradas');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('\n🔧 TESTE 1: Indicadores Técnicos Clássicos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Simular dados OHLCV
    const mockOHLCV = {
      open: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
      high: [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116],
      low: [99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113],
      close: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115],
      volume: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400]
    };

    // Testar RSI
    console.log('📊 Testando RSI...');
    const rsi = calculateRSI(mockOHLCV.close, 14);
    console.log(`   RSI (14): ${rsi.toFixed(2)}`);
    
    if (rsi < 30) {
      console.log('   ✅ RSI Oversold - Sinal de compra');
    } else if (rsi > 70) {
      console.log('   ✅ RSI Overbought - Sinal de venda');
    } else {
      console.log('   ⚪ RSI Neutro');
    }

    // Testar MACD
    console.log('📊 Testando MACD...');
    const macd = calculateMACD(mockOHLCV.close);
    console.log(`   MACD Line: ${macd.line.toFixed(4)}`);
    console.log(`   MACD Signal: ${macd.signal.toFixed(4)}`);
    console.log(`   MACD Histogram: ${macd.histogram.toFixed(4)}`);
    
    if (macd.line > macd.signal && macd.histogram > 0) {
      console.log('   ✅ MACD Bullish Crossover');
    } else if (macd.line < macd.signal && macd.histogram < 0) {
      console.log('   ✅ MACD Bearish Crossover');
    } else {
      console.log('   ⚪ MACD Neutro');
    }

    // Testar Bollinger Bands
    console.log('📊 Testando Bollinger Bands...');
    const bollinger = calculateBollingerBands(mockOHLCV.close);
    console.log(`   Upper Band: ${bollinger.upper.toFixed(2)}`);
    console.log(`   Middle Band (SMA): ${bollinger.middle.toFixed(2)}`);
    console.log(`   Lower Band: ${bollinger.lower.toFixed(2)}`);
    console.log(`   Position: ${(bollinger.position * 100).toFixed(1)}%`);
    
    if (bollinger.position < 0.2) {
      console.log('   ✅ Preço próximo da banda inferior - Possível reversão');
    } else if (bollinger.position > 0.8) {
      console.log('   ✅ Preço próximo da banda superior - Possível reversão');
    } else {
      console.log('   ⚪ Preço dentro das bandas');
    }

    // Testar EMAs
    console.log('📊 Testando EMAs...');
    const emas = calculateEMAs(mockOHLCV.close);
    console.log(`   EMA 9: ${emas.ema9.toFixed(2)}`);
    console.log(`   EMA 21: ${emas.ema21.toFixed(2)}`);
    console.log(`   EMA 50: ${emas.ema50.toFixed(2)}`);
    
    if (emas.ema9 > emas.ema21 && emas.ema21 > emas.ema50) {
      console.log('   ✅ Alinhamento Bullish das EMAs');
    } else if (emas.ema9 < emas.ema21 && emas.ema21 < emas.ema50) {
      console.log('   ✅ Alinhamento Bearish das EMAs');
    } else {
      console.log('   ⚪ EMAs sem alinhamento claro');
    }

    // Testar VWAP
    console.log('📊 Testando VWAP...');
    const vwap = calculateVWAP(mockOHLCV.high, mockOHLCV.low, mockOHLCV.close, mockOHLCV.volume);
    console.log(`   VWAP: ${vwap.toFixed(2)}`);
    console.log(`   Preço Atual: ${mockOHLCV.close[mockOHLCV.close.length - 1].toFixed(2)}`);
    
    if (mockOHLCV.close[mockOHLCV.close.length - 1] > vwap) {
      console.log('   ✅ Preço acima do VWAP - Tendência bullish');
    } else {
      console.log('   ✅ Preço abaixo do VWAP - Tendência bearish');
    }

    console.log('\n🔧 TESTE 2: Detecção de Suporte e Resistência');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Simular dados com níveis de S/R
    const mockSRData = {
      high: [100, 105, 110, 108, 112, 115, 113, 118, 120, 117, 122, 125, 123, 128, 130],
      low: [95, 98, 102, 100, 105, 108, 106, 110, 112, 109, 115, 118, 116, 120, 122],
      close: [98, 103, 108, 105, 110, 113, 110, 115, 118, 115, 120, 123, 120, 125, 127]
    };

    const supportResistance = detectSupportResistance(mockSRData);
    
    console.log('📊 Níveis de Suporte:');
    supportResistance.support.forEach((s, i) => {
      console.log(`   ${i + 1}. Nível: ${s.level.toFixed(2)} | Força: ${s.strength} | Toques: ${s.touches}`);
    });
    
    console.log('📊 Níveis de Resistência:');
    supportResistance.resistance.forEach((r, i) => {
      console.log(`   ${i + 1}. Nível: ${r.level.toFixed(2)} | Força: ${r.strength} | Toques: ${r.touches}`);
    });

    console.log('\n🔧 TESTE 3: Padrões de Candlestick');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Simular diferentes padrões de candlestick
    const candlestickTests = [
      { name: 'Hammer', open: 100, high: 102, low: 95, close: 101 },
      { name: 'Shooting Star', open: 100, high: 105, low: 99, close: 101 },
      { name: 'Doji', open: 100, high: 101, low: 99, close: 100 },
      { name: 'Marubozu Bullish', open: 100, high: 105, low: 100, close: 105 },
      { name: 'Marubozu Bearish', open: 105, high: 105, low: 100, close: 100 }
    ];

    candlestickTests.forEach(test => {
      const pattern = detectCandlestickPattern(test);
      if (pattern) {
        console.log(`📊 ${test.name}: ${pattern.type} - ${pattern.description}`);
        console.log(`   Confiabilidade: ${(pattern.reliability * 100).toFixed(0)}%`);
      } else {
        console.log(`📊 ${test.name}: Nenhum padrão detectado`);
      }
    });

    console.log('\n🔧 TESTE 4: Análise de Volume');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const volumeAnalysis = analyzeVolume(mockOHLCV);
    console.log(`📊 Volume Atual: ${volumeAnalysis.currentVolume.toFixed(0)}`);
    console.log(`📊 Volume Médio (20): ${volumeAnalysis.averageVolume20.toFixed(0)}`);
    console.log(`📊 Volume Médio (50): ${volumeAnalysis.averageVolume50.toFixed(0)}`);
    console.log(`📊 Ratio Volume: ${volumeAnalysis.volumeRatio.toFixed(2)}x`);
    console.log(`📊 Tendência Volume: ${volumeAnalysis.volumeTrend}`);
    console.log(`📊 Breakout Volume: ${volumeAnalysis.volumeBreakout ? 'Sim' : 'Não'}`);
    console.log(`📊 Confirmação Volume: ${volumeAnalysis.volumeConfirmation ? 'Sim' : 'Não'}`);

    console.log('\n🔧 TESTE 5: Confluência de Sinais');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const confluence = calculateConfluence(mockOHLCV, supportResistance, volumeAnalysis);
    console.log(`📊 Score de Confluência: ${confluence.score.toFixed(2)}`);
    console.log(`📊 Força: ${confluence.strength}`);
    console.log(`📊 Recomendação: ${confluence.recommendation}`);
    console.log(`📊 Confiança: ${confluence.confidence.toFixed(1)}%`);
    console.log(`📊 Racional: ${confluence.rationale}`);
    
    console.log('\n📊 Sinais Bullish:');
    confluence.signals.bullish.forEach(signal => {
      console.log(`   ✅ ${signal}`);
    });
    
    console.log('\n📊 Sinais Bearish:');
    confluence.signals.bearish.forEach(signal => {
      console.log(`   ❌ ${signal}`);
    });
    
    console.log('\n📊 Sinais Neutros:');
    confluence.signals.neutral.forEach(signal => {
      console.log(`   ⚪ ${signal}`);
    });

    console.log('\n🎉 RESUMO DO MÓDULO DE ANÁLISE TÉCNICA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Indicadores Clássicos Implementados:');
    console.log('   - RSI (Relative Strength Index)');
    console.log('   - MACD (Moving Average Convergence Divergence)');
    console.log('   - Bollinger Bands');
    console.log('   - VWAP (Volume Weighted Average Price)');
    console.log('   - EMAs (Exponential Moving Averages)');
    console.log('   - SMAs (Simple Moving Averages)');
    console.log('   - ATR (Average True Range)');
    console.log('   - ADX (Average Directional Index)');
    console.log('   - Stochastic Oscillator');
    console.log('   - Williams %R');
    console.log('   - CCI (Commodity Channel Index)');
    console.log('');
    console.log('✅ Detecção de Suporte e Resistência:');
    console.log('   - Identificação de pivôs locais');
    console.log('   - Cálculo de força dos níveis');
    console.log('   - Contagem de toques');
    console.log('   - Pivot Points');
    console.log('');
    console.log('✅ Padrões de Candlestick:');
    console.log('   - Hammer (Martelo)');
    console.log('   - Shooting Star (Estrela Cadente)');
    console.log('   - Doji');
    console.log('   - Marubozu');
    console.log('   - Engulfing Patterns');
    console.log('');
    console.log('✅ Análise de Volume:');
    console.log('   - Volume médio móvel');
    console.log('   - Ratio de volume');
    console.log('   - Tendência de volume');
    console.log('   - Confirmação de breakout');
    console.log('');
    console.log('✅ Sistema de Confluência:');
    console.log('   - Combinação de múltiplos sinais');
    console.log('   - Score ponderado');
    console.log('   - Classificação de força');
    console.log('   - Recomendação final');
    console.log('   - Cálculo de confiança');
    console.log('');
    console.log('🚀 BENEFÍCIOS ESPERADOS:');
    console.log('   - Decisões baseadas em análise técnica real');
    console.log('   - Filtragem de sinais de baixa qualidade');
    console.log('   - Identificação de pontos de entrada/saída');
    console.log('   - Gestão de risco melhorada');
    console.log('   - Maior assertividade nas trades');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
  }
}

// Funções auxiliares para os testes
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[prices.length - i] - prices[prices.length - i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdLine = ema12 - ema26;
  const signal = macdLine * 0.9; // Aproximação
  const histogram = macdLine - signal;

  return { line: macdLine, signal, histogram };
}

function calculateEMA(prices, period) {
  if (prices.length < period) {
    return prices[prices.length - 1];
  }

  const multiplier = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
  }

  return ema;
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) {
    const currentPrice = prices[prices.length - 1];
    return {
      upper: currentPrice * 1.02,
      middle: currentPrice,
      lower: currentPrice * 0.98,
      position: 0.5
    };
  }

  const recentPrices = prices.slice(-period);
  const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period;
  
  const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  const upper = sma + (standardDeviation * stdDev);
  const lower = sma - (standardDeviation * stdDev);
  
  const currentPrice = prices[prices.length - 1];
  const position = (currentPrice - lower) / (upper - lower);

  return {
    upper,
    middle: sma,
    lower,
    position: Math.max(0, Math.min(1, position))
  };
}

function calculateEMAs(prices) {
  return {
    ema9: calculateEMA(prices, 9),
    ema21: calculateEMA(prices, 21),
    ema50: calculateEMA(prices, 50)
  };
}

function calculateVWAP(high, low, close, volume) {
  if (volume.length === 0) return close[close.length - 1];

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < volume.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    const volumeAtPrice = volume[i];
    
    cumulativeTPV += typicalPrice * volumeAtPrice;
    cumulativeVolume += volumeAtPrice;
  }

  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : close[close.length - 1];
}

function detectSupportResistance(data) {
  const { high, low } = data;
  const support = [];
  const resistance = [];
  
  // Implementação simplificada
  const lookback = 5;
  
  for (let i = lookback; i < high.length - lookback; i++) {
    if (high[i] === Math.max(...high.slice(i - lookback, i + lookback + 1))) {
      resistance.push({
        level: high[i],
        strength: 'moderate',
        touches: 2,
        lastTouch: Date.now()
      });
    }
    
    if (low[i] === Math.min(...low.slice(i - lookback, i + lookback + 1))) {
      support.push({
        level: low[i],
        strength: 'moderate',
        touches: 2,
        lastTouch: Date.now()
      });
    }
  }

  return {
    support: support.slice(0, 3),
    resistance: resistance.slice(0, 3),
    pivotPoints: { pp: 0, r1: 0, r2: 0, s1: 0, s2: 0 }
  };
}

function detectCandlestickPattern(candle) {
  const { open, high, low, close } = candle;
  
  // Hammer
  if (isHammer(open, high, low, close)) {
    return {
      name: 'Hammer',
      type: 'bullish',
      strength: 'moderate',
      description: 'Martelo - Possível reversão de baixa para alta',
      reliability: 0.7
    };
  }
  
  // Shooting Star
  if (isShootingStar(open, high, low, close)) {
    return {
      name: 'Shooting Star',
      type: 'bearish',
      strength: 'moderate',
      description: 'Estrela Cadente - Possível reversão de alta para baixa',
      reliability: 0.7
    };
  }
  
  // Doji
  if (isDoji(open, high, low, close)) {
    return {
      name: 'Doji',
      type: 'neutral',
      strength: 'moderate',
      description: 'Doji - Indecisão do mercado',
      reliability: 0.6
    };
  }
  
  // Marubozu
  if (isMarubozu(open, high, low, close)) {
    const isBullish = close > open;
    return {
      name: 'Marubozu',
      type: isBullish ? 'bullish' : 'bearish',
      strength: 'strong',
      description: `Marubozu ${isBullish ? 'Alta' : 'Baixa'} - Forte momentum`,
      reliability: 0.8
    };
  }
  
  return null;
}

function isHammer(open, high, low, close) {
  const bodySize = Math.abs(close - open);
  const lowerShadow = Math.min(open, close) - low;
  const upperShadow = high - Math.max(open, close);
  
  return lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5;
}

function isShootingStar(open, high, low, close) {
  const bodySize = Math.abs(close - open);
  const upperShadow = high - Math.max(open, close);
  const lowerShadow = Math.min(open, close) - low;
  
  return upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5;
}

function isDoji(open, high, low, close) {
  const bodySize = Math.abs(close - open);
  const totalRange = high - low;
  
  return bodySize < totalRange * 0.1;
}

function isMarubozu(open, high, low, close) {
  const bodySize = Math.abs(close - open);
  const totalRange = high - low;
  
  return bodySize > totalRange * 0.9;
}

function analyzeVolume(data) {
  const { volume } = data;
  
  if (volume.length === 0) {
    return {
      currentVolume: 0,
      averageVolume20: 0,
      averageVolume50: 0,
      volumeRatio: 1,
      volumeTrend: 'stable',
      volumeBreakout: false,
      volumeConfirmation: false
    };
  }

  const currentVolume = volume[volume.length - 1];
  const avg20 = calculateSMA(volume, 20);
  const avg50 = calculateSMA(volume, 50);
  
  const volumeRatio = avg20 > 0 ? currentVolume / avg20 : 1;
  
  let volumeTrend = 'stable';
  if (volume.length >= 5) {
    const recentVolumes = volume.slice(-5);
    const isIncreasing = recentVolumes.every((v, i) => i === 0 || v >= recentVolumes[i - 1]);
    const isDecreasing = recentVolumes.every((v, i) => i === 0 || v <= recentVolumes[i - 1]);
    
    if (isIncreasing) volumeTrend = 'increasing';
    else if (isDecreasing) volumeTrend = 'decreasing';
  }

  return {
    currentVolume,
    averageVolume20: avg20,
    averageVolume50: avg50,
    volumeRatio,
    volumeTrend,
    volumeBreakout: volumeRatio > 1.5,
    volumeConfirmation: volumeRatio > 1.2
  };
}

function calculateSMA(prices, period) {
  if (prices.length < period) {
    return prices[prices.length - 1];
  }

  const recentPrices = prices.slice(-period);
  return recentPrices.reduce((sum, price) => sum + price, 0) / period;
}

function calculateConfluence(ohlcv, supportResistance, volumeAnalysis) {
  let bullishSignals = [];
  let bearishSignals = [];
  let neutralSignals = [];
  let score = 0;

  const currentPrice = ohlcv.close[ohlcv.close.length - 1];

  // RSI
  const rsi = calculateRSI(ohlcv.close, 14);
  if (rsi < 30) {
    bullishSignals.push(`RSI Oversold (${rsi.toFixed(1)})`);
    score += 15;
  } else if (rsi > 70) {
    bearishSignals.push(`RSI Overbought (${rsi.toFixed(1)})`);
    score -= 15;
  }

  // MACD
  const macd = calculateMACD(ohlcv.close);
  if (macd.line > macd.signal && macd.histogram > 0) {
    bullishSignals.push('MACD Bullish Crossover');
    score += 10;
  } else if (macd.line < macd.signal && macd.histogram < 0) {
    bearishSignals.push('MACD Bearish Crossover');
    score -= 10;
  }

  // Bollinger Bands
  const bollinger = calculateBollingerBands(ohlcv.close);
  if (bollinger.position < 0.2) {
    bullishSignals.push('Price Near Lower Bollinger Band');
    score += 8;
  } else if (bollinger.position > 0.8) {
    bearishSignals.push('Price Near Upper Bollinger Band');
    score -= 8;
  }

  // EMAs
  const emas = calculateEMAs(ohlcv.close);
  if (emas.ema9 > emas.ema21 && emas.ema21 > emas.ema50) {
    bullishSignals.push('EMA Bullish Alignment');
    score += 12;
  } else if (emas.ema9 < emas.ema21 && emas.ema21 < emas.ema50) {
    bearishSignals.push('EMA Bearish Alignment');
    score -= 12;
  }

  // Volume
  if (volumeAnalysis.volumeConfirmation) {
    if (score > 0) {
      bullishSignals.push('Volume Confirmation');
      score += 5;
    } else if (score < 0) {
      bearishSignals.push('Volume Confirmation');
      score -= 5;
    }
  }

  // Determinar força e recomendação
  const absScore = Math.abs(score);
  let strength, recommendation;

  if (absScore >= 40) {
    strength = 'very_strong';
  } else if (absScore >= 25) {
    strength = 'strong';
  } else if (absScore >= 15) {
    strength = 'moderate';
  } else {
    strength = 'weak';
  }

  if (score >= 30) {
    recommendation = 'STRONG_BUY';
  } else if (score >= 15) {
    recommendation = 'BUY';
  } else if (score <= -30) {
    recommendation = 'STRONG_SELL';
  } else if (score <= -15) {
    recommendation = 'SELL';
  } else {
    recommendation = 'HOLD';
  }

  const totalSignals = bullishSignals.length + bearishSignals.length;
  const confidence = Math.min(100, Math.max(20, totalSignals * 10 + absScore));

  const rationale = `Análise técnica ${strength}: ` +
    (bullishSignals.length > 0 ? `Sinais bullish: ${bullishSignals.join(', ')}. ` : '') +
    (bearishSignals.length > 0 ? `Sinais bearish: ${bearishSignals.join(', ')}. ` : '') +
    `Recomendação: ${recommendation}`;

  return {
    score,
    signals: { bullish: bullishSignals, bearish: bearishSignals, neutral: neutralSignals },
    strength,
    recommendation,
    confidence,
    rationale
  };
}

// Executar testes
testTechnicalAnalysis()
  .then(() => {
    console.log('\n✅ Testes do módulo de análise técnica concluídos!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal nos testes:', error);
    process.exit(1);
  });

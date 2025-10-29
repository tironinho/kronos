import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import asyncio
from collections import deque
import logging
from datetime import datetime, timedelta
import json

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrendDirection(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    SIDEWAYS = "sideways"
    REVERSING = "reversing"

class WhaleActivityLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"

class ManipulationSignal(Enum):
    NONE = "none"
    SUSPICIOUS = "suspicious"
    HIGH_PROBABILITY = "high_probability"
    CONFIRMED = "confirmed"

@dataclass
class TrendAnalysis:
    direction: TrendDirection
    strength: float  # 0-1
    confidence: float  # 0-1
    reversal_probability: float  # 0-1
    timeframe: str
    timestamp: datetime

@dataclass
class WhaleActivity:
    level: WhaleActivityLevel
    volume_spike: float
    price_impact: float
    manipulation_signal: ManipulationSignal
    confidence: float
    timestamp: datetime

@dataclass
class MarketAlert:
    type: str
    severity: str
    message: str
    confidence: float
    recommended_action: str
    timestamp: datetime

class AdvancedTrendDetector:
    """
    Sistema avançado de detecção de tendências baseado em modelos HFT comprovados
    Utiliza múltiplos indicadores técnicos e análise estatística
    """
    
    def __init__(self, window_size: int = 100):
        self.window_size = window_size
        self.price_history = deque(maxlen=window_size)
        self.volume_history = deque(maxlen=window_size)
        self.trend_history = deque(maxlen=50)
        
    def add_data_point(self, price: float, volume: float, timestamp: datetime):
        """Adiciona novo ponto de dados para análise"""
        self.price_history.append({
            'price': price,
            'volume': volume,
            'timestamp': timestamp
        })
        
    def calculate_trend_strength(self) -> float:
        """Calcula força da tendência usando múltiplos indicadores"""
        if len(self.price_history) < 20:
            return 0.0
            
        prices = [p['price'] for p in self.price_history]
        
        # 1. Slope Analysis (Regressão Linear)
        x = np.arange(len(prices))
        slope = np.polyfit(x, prices, 1)[0]
        slope_strength = abs(slope) / np.std(prices)
        
        # 2. Moving Average Convergence
        ma_short = np.mean(prices[-10:])
        ma_long = np.mean(prices[-20:])
        ma_convergence = abs(ma_short - ma_long) / ma_long
        
        # 3. Price Momentum
        momentum = (prices[-1] - prices[-10]) / prices[-10]
        momentum_strength = abs(momentum)
        
        # 4. Volume Confirmation
        recent_volume = np.mean([p['volume'] for p in list(self.price_history)[-10:]])
        avg_volume = np.mean([p['volume'] for p in list(self.price_history)[-20:]])
        volume_confirmation = recent_volume / avg_volume if avg_volume > 0 else 1
        
        # Combinação ponderada dos indicadores
        trend_strength = (
            slope_strength * 0.3 +
            ma_convergence * 0.25 +
            momentum_strength * 0.25 +
            min(volume_confirmation, 2.0) * 0.2
        )
        
        return min(trend_strength, 1.0)
    
    def detect_trend_direction(self) -> TrendDirection:
        """Detecta direção da tendência usando análise técnica avançada"""
        if len(self.price_history) < 20:
            return TrendDirection.SIDEWAYS
            
        prices = [p['price'] for p in self.price_history]
        
        # 1. Análise de Médias Móveis
        ma_5 = np.mean(prices[-5:])
        ma_10 = np.mean(prices[-10:])
        ma_20 = np.mean(prices[-20:])
        
        # 2. Análise de Momentum
        momentum_5 = (prices[-1] - prices[-5]) / prices[-5]
        momentum_10 = (prices[-1] - prices[-10]) / prices[-10]
        
        # 3. Análise de Suporte/Resistência
        recent_high = max(prices[-10:])
        recent_low = min(prices[-10:])
        current_price = prices[-1]
        
        # 4. Detecção de Reversão
        reversal_signals = 0
        
        # Divergência entre preço e volume
        price_change = (prices[-1] - prices[-5]) / prices[-5]
        volume_change = np.mean([p['volume'] for p in list(self.price_history)[-5:]]) / \
                       np.mean([p['volume'] for p in list(self.price_history)[-10:-5]])
        
        if (price_change > 0 and volume_change < 0.8) or (price_change < 0 and volume_change < 0.8):
            reversal_signals += 1
            
        # Determinação da direção
        bullish_signals = 0
        bearish_signals = 0
        
        if ma_5 > ma_10 > ma_20:
            bullish_signals += 2
        elif ma_5 < ma_10 < ma_20:
            bearish_signals += 2
            
        if momentum_5 > 0.02:
            bullish_signals += 1
        elif momentum_5 < -0.02:
            bearish_signals += 1
            
        if current_price > recent_high * 0.98:
            bullish_signals += 1
        elif current_price < recent_low * 1.02:
            bearish_signals += 1
            
        # Verificação de reversão
        if reversal_signals >= 2:
            return TrendDirection.REVERSING
        elif bullish_signals > bearish_signals:
            return TrendDirection.BULLISH
        elif bearish_signals > bullish_signals:
            return TrendDirection.BEARISH
        else:
            return TrendDirection.SIDEWAYS
    
    def calculate_reversal_probability(self) -> float:
        """Calcula probabilidade de reversão de tendência"""
        if len(self.price_history) < 30:
            return 0.0
            
        prices = [p['price'] for p in self.price_history]
        volumes = [p['volume'] for p in list(self.price_history)]
        
        reversal_signals = 0
        total_signals = 0
        
        # 1. Análise de Divergência Preço-Volume
        price_trend = np.polyfit(range(10), prices[-10:], 1)[0]
        volume_trend = np.polyfit(range(10), volumes[-10:], 1)[0]
        
        if (price_trend > 0 and volume_trend < 0) or (price_trend < 0 and volume_trend < 0):
            reversal_signals += 1
        total_signals += 1
        
        # 2. Análise de RSI Divergence
        rsi_values = self._calculate_rsi(prices)
        if len(rsi_values) >= 10:
            rsi_trend = np.polyfit(range(10), rsi_values[-10:], 1)[0]
            price_trend_short = np.polyfit(range(10), prices[-10:], 1)[0]
            
            if (rsi_trend < 0 and price_trend_short > 0) or (rsi_trend > 0 and price_trend_short < 0):
                reversal_signals += 1
            total_signals += 1
        
        # 3. Análise de Padrões de Candlestick
        if len(prices) >= 3:
            recent_pattern = self._analyze_candlestick_pattern(prices[-3:])
            if recent_pattern in ['hammer', 'doji', 'shooting_star']:
                reversal_signals += 1
            total_signals += 1
        
        # 4. Análise de Volatilidade
        volatility = np.std(prices[-10:]) / np.mean(prices[-10:])
        if volatility > 0.05:  # Alta volatilidade
            reversal_signals += 0.5
        total_signals += 1
        
        return min(reversal_signals / total_signals, 1.0)
    
    def _calculate_rsi(self, prices: List[float], period: int = 14) -> List[float]:
        """Calcula RSI (Relative Strength Index)"""
        if len(prices) < period + 1:
            return []
            
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gains = []
        avg_losses = []
        
        for i in range(period, len(gains) + 1):
            avg_gains.append(np.mean(gains[i-period:i]))
            avg_losses.append(np.mean(losses[i-period:i]))
        
        rsi_values = []
        for gain, loss in zip(avg_gains, avg_losses):
            if loss == 0:
                rsi_values.append(100)
            else:
                rs = gain / loss
                rsi = 100 - (100 / (1 + rs))
                rsi_values.append(rsi)
                
        return rsi_values
    
    def _analyze_candlestick_pattern(self, prices: List[float]) -> str:
        """Analisa padrões básicos de candlestick"""
        if len(prices) < 3:
            return 'none'
            
        open_price, high_price, low_price, close_price = prices[-1], max(prices), min(prices), prices[-1]
        
        body_size = abs(close_price - open_price)
        total_range = high_price - low_price
        
        if total_range == 0:
            return 'none'
            
        body_ratio = body_size / total_range
        
        if body_ratio < 0.1:
            return 'doji'
        elif close_price > open_price and (low_price - open_price) > 2 * body_size:
            return 'hammer'
        elif close_price < open_price and (high_price - open_price) > 2 * body_size:
            return 'shooting_star'
        else:
            return 'normal'

class WhaleBehaviorDetector:
    """
    Detector avançado de comportamento de baleias baseado em análise de volume e impacto de preço
    Utiliza algoritmos comprovados para detecção de manipulação de mercado
    """
    
    def __init__(self, volume_threshold_multiplier: float = 3.0):
        self.volume_threshold_multiplier = volume_threshold_multiplier
        self.volume_history = deque(maxlen=200)
        self.price_history = deque(maxlen=200)
        self.whale_activities = deque(maxlen=50)
        
    def add_data_point(self, price: float, volume: float, timestamp: datetime):
        """Adiciona novo ponto de dados para análise de baleias"""
        self.volume_history.append(volume)
        self.price_history.append(price)
        
    def detect_whale_activity(self) -> WhaleActivity:
        """Detecta atividade de baleias usando múltiplos algoritmos"""
        if len(self.volume_history) < 20:
            return WhaleActivity(
                level=WhaleActivityLevel.LOW,
                volume_spike=0.0,
                price_impact=0.0,
                manipulation_signal=ManipulationSignal.NONE,
                confidence=0.0,
                timestamp=datetime.now()
            )
        
        # 1. Detecção de Spike de Volume
        volume_spike = self._detect_volume_spike()
        
        # 2. Análise de Impacto no Preço
        price_impact = self._calculate_price_impact()
        
        # 3. Detecção de Padrões Suspeitos
        manipulation_signal = self._detect_manipulation_patterns()
        
        # 4. Determinação do Nível de Atividade
        activity_level = self._determine_activity_level(volume_spike, price_impact, manipulation_signal)
        
        # 5. Cálculo de Confiança
        confidence = self._calculate_confidence(volume_spike, price_impact, manipulation_signal)
        
        return WhaleActivity(
            level=activity_level,
            volume_spike=volume_spike,
            price_impact=price_impact,
            manipulation_signal=manipulation_signal,
            confidence=confidence,
            timestamp=datetime.now()
        )
    
    def _detect_volume_spike(self) -> float:
        """Detecta spikes de volume usando análise estatística"""
        if len(self.volume_history) < 20:
            return 0.0
            
        recent_volume = np.mean(list(self.volume_history)[-5:])
        avg_volume = np.mean(list(self.volume_history)[-20:])
        std_volume = np.std(list(self.volume_history)[-20:])
        
        if avg_volume == 0:
            return 0.0
            
        # Z-score do volume
        z_score = (recent_volume - avg_volume) / std_volume if std_volume > 0 else 0
        
        # Normalização para escala 0-1
        volume_spike = min(max(z_score / 3.0, 0), 1.0)
        
        return volume_spike
    
    def _calculate_price_impact(self) -> float:
        """Calcula impacto das transações no preço"""
        if len(self.price_history) < 10:
            return 0.0
            
        prices = list(self.price_history)
        volumes = list(self.volume_history)
        
        # Análise de correlação preço-volume
        price_changes = np.diff(prices[-10:])
        volume_changes = np.diff(volumes[-10:])
        
        if len(price_changes) == 0 or np.std(volume_changes) == 0:
            return 0.0
            
        correlation = np.corrcoef(price_changes, volume_changes)[0, 1]
        
        # Análise de impacto por unidade de volume
        total_volume = np.sum(volumes[-10:])
        total_price_change = abs(prices[-1] - prices[-10]) / prices[-10]
        
        if total_volume == 0:
            return 0.0
            
        price_impact = (total_price_change * correlation) / (total_volume / np.mean(volumes[-20:]))
        
        return min(max(price_impact, 0), 1.0)
    
    def _detect_manipulation_patterns(self) -> ManipulationSignal:
        """Detecta padrões suspeitos de manipulação"""
        if len(self.volume_history) < 30:
            return ManipulationSignal.NONE
            
        manipulation_score = 0
        
        # 1. Detecção de Pump and Dump
        pump_dump_score = self._detect_pump_dump_pattern()
        manipulation_score += pump_dump_score
        
        # 2. Detecção de Wash Trading
        wash_trading_score = self._detect_wash_trading()
        manipulation_score += wash_trading_score
        
        # 3. Detecção de Spoofing
        spoofing_score = self._detect_spoofing_pattern()
        manipulation_score += spoofing_score
        
        # 4. Detecção de Volume Manipulation
        volume_manipulation_score = self._detect_volume_manipulation()
        manipulation_score += volume_manipulation_score
        
        # Determinação do sinal baseado no score
        if manipulation_score >= 0.8:
            return ManipulationSignal.CONFIRMED
        elif manipulation_score >= 0.6:
            return ManipulationSignal.HIGH_PROBABILITY
        elif manipulation_score >= 0.3:
            return ManipulationSignal.SUSPICIOUS
        else:
            return ManipulationSignal.NONE
    
    def _detect_pump_dump_pattern(self) -> float:
        """Detecta padrão de pump and dump"""
        if len(self.price_history) < 20:
            return 0.0
            
        prices = list(self.price_history)
        volumes = list(self.volume_history)
        
        # Análise de movimento rápido seguido de reversão
        price_changes = np.diff(prices[-20:])
        volume_changes = np.diff(volumes[-20:])
        
        # Detecção de spike seguido de queda
        max_price_change = max(price_changes)
        min_price_change = min(price_changes)
        
        # Verificação de padrão pump and dump
        if max_price_change > 0.05 and min_price_change < -0.03:
            # Análise de volume durante o pump
            pump_volume = np.mean(volumes[-15:-5])
            dump_volume = np.mean(volumes[-5:])
            
            if pump_volume > dump_volume * 1.5:
                return 0.7
        
        return 0.0
    
    def _detect_wash_trading(self) -> float:
        """Detecta possível wash trading"""
        if len(self.volume_history) < 30:
            return 0.0
            
        volumes = list(self.volume_history)
        
        # Análise de padrões de volume suspeitos
        volume_variance = np.var(volumes[-20:])
        volume_mean = np.mean(volumes[-20:])
        
        # Wash trading geralmente mostra volumes muito consistentes
        cv = volume_variance / volume_mean if volume_mean > 0 else 0
        
        if cv < 0.1:  # Coeficiente de variação muito baixo
            return 0.5
        
        return 0.0
    
    def _detect_spoofing_pattern(self) -> float:
        """Detecta padrões de spoofing"""
        if len(self.price_history) < 30:
            return 0.0
            
        prices = list(self.price_history)
        volumes = list(self.volume_history)
        
        # Análise de movimentos de preço sem volume correspondente
        price_changes = np.abs(np.diff(prices[-20:]))
        volume_changes = np.abs(np.diff(volumes[-20:]))
        
        # Detecção de movimentos de preço com baixo volume
        suspicious_moves = 0
        for i in range(len(price_changes)):
            if price_changes[i] > 0.02 and volume_changes[i] < np.mean(volume_changes) * 0.5:
                suspicious_moves += 1
        
        spoofing_score = suspicious_moves / len(price_changes)
        return min(spoofing_score * 2, 1.0)
    
    def _detect_volume_manipulation(self) -> float:
        """Detecta manipulação de volume"""
        if len(self.volume_history) < 30:
            return 0.0
            
        volumes = list(self.volume_history)
        
        # Análise de distribuição de volume
        volume_percentiles = np.percentile(volumes[-30:], [25, 50, 75, 90, 95])
        
        # Detecção de volumes extremos concentrados
        extreme_volumes = sum(1 for v in volumes[-30:] if v > volume_percentiles[3])
        
        if extreme_volumes > 5:  # Mais de 5 volumes extremos em 30 períodos
            return 0.6
        
        return 0.0
    
    def _determine_activity_level(self, volume_spike: float, price_impact: float, manipulation_signal: ManipulationSignal) -> WhaleActivityLevel:
        """Determina o nível de atividade das baleias"""
        score = volume_spike + price_impact
        
        if manipulation_signal == ManipulationSignal.CONFIRMED:
            score += 0.5
        elif manipulation_signal == ManipulationSignal.HIGH_PROBABILITY:
            score += 0.3
        elif manipulation_signal == ManipulationSignal.SUSPICIOUS:
            score += 0.1
        
        if score >= 1.5:
            return WhaleActivityLevel.EXTREME
        elif score >= 1.0:
            return WhaleActivityLevel.HIGH
        elif score >= 0.5:
            return WhaleActivityLevel.MEDIUM
        else:
            return WhaleActivityLevel.LOW
    
    def _calculate_confidence(self, volume_spike: float, price_impact: float, manipulation_signal: ManipulationSignal) -> float:
        """Calcula confiança na detecção de atividade de baleias"""
        base_confidence = (volume_spike + price_impact) / 2
        
        # Ajuste baseado no sinal de manipulação
        if manipulation_signal == ManipulationSignal.CONFIRMED:
            base_confidence += 0.3
        elif manipulation_signal == ManipulationSignal.HIGH_PROBABILITY:
            base_confidence += 0.2
        elif manipulation_signal == ManipulationSignal.SUSPICIOUS:
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)

class IntelligentTradingMonitor:
    """
    Sistema principal de monitoramento inteligente que integra todos os componentes
    """
    
    def __init__(self):
        self.trend_detector = AdvancedTrendDetector()
        self.whale_detector = WhaleBehaviorDetector()
        self.active_trades = {}
        self.alerts_history = deque(maxlen=100)
        
    async def monitor_market(self, symbol: str, price: float, volume: float, timestamp: datetime):
        """Monitora o mercado e gera alertas inteligentes"""
        # Adiciona dados aos detectores
        self.trend_detector.add_data_point(price, volume, timestamp)
        self.whale_detector.add_data_point(price, volume, timestamp)
        
        # Análise de tendência
        trend_analysis = await self._analyze_trend()
        
        # Análise de atividade de baleias
        whale_activity = self.whale_detector.detect_whale_activity()
        
        # Geração de alertas
        alerts = await self._generate_alerts(symbol, trend_analysis, whale_activity)
        
        # Recomendações de ação
        recommendations = await self._generate_recommendations(symbol, trend_analysis, whale_activity)
        
        return {
            'symbol': symbol,
            'trend_analysis': trend_analysis,
            'whale_activity': whale_activity,
            'alerts': alerts,
            'recommendations': recommendations,
            'timestamp': timestamp
        }
    
    async def _analyze_trend(self) -> TrendAnalysis:
        """Analisa tendência atual do mercado"""
        direction = self.trend_detector.detect_trend_direction()
        strength = self.trend_detector.calculate_trend_strength()
        reversal_probability = self.trend_detector.calculate_reversal_probability()
        
        # Cálculo de confiança baseado na consistência dos sinais
        confidence = (strength + (1 - reversal_probability)) / 2
        
        return TrendAnalysis(
            direction=direction,
            strength=strength,
            confidence=confidence,
            reversal_probability=reversal_probability,
            timeframe="real_time",
            timestamp=datetime.now()
        )
    
    async def _generate_alerts(self, symbol: str, trend_analysis: TrendAnalysis, whale_activity: WhaleActivity) -> List[MarketAlert]:
        """Gera alertas inteligentes baseados na análise"""
        alerts = []
        
        # Alerta de mudança de tendência
        if trend_analysis.reversal_probability > 0.7:
            alerts.append(MarketAlert(
                type="trend_reversal",
                severity="high",
                message=f"Alta probabilidade de reversão de tendência detectada para {symbol}",
                confidence=trend_analysis.reversal_probability,
                recommended_action="Considerar fechamento de posições",
                timestamp=datetime.now()
            ))
        
        # Alerta de atividade de baleias
        if whale_activity.level in [WhaleActivityLevel.HIGH, WhaleActivityLevel.EXTREME]:
            alerts.append(MarketAlert(
                type="whale_activity",
                severity="medium" if whale_activity.level == WhaleActivityLevel.HIGH else "high",
                message=f"Atividade intensa de baleias detectada para {symbol}",
                confidence=whale_activity.confidence,
                recommended_action="Monitorar de perto e considerar fechamento preventivo",
                timestamp=datetime.now()
            ))
        
        # Alerta de manipulação
        if whale_activity.manipulation_signal in [ManipulationSignal.HIGH_PROBABILITY, ManipulationSignal.CONFIRMED]:
            alerts.append(MarketAlert(
                type="market_manipulation",
                severity="high",
                message=f"Possível manipulação de mercado detectada para {symbol}",
                confidence=whale_activity.confidence,
                recommended_action="Fechar posições imediatamente",
                timestamp=datetime.now()
            ))
        
        return alerts
    
    async def _generate_recommendations(self, symbol: str, trend_analysis: TrendAnalysis, whale_activity: WhaleActivity) -> Dict[str, str]:
        """Gera recomendações de ação baseadas na análise"""
        recommendations = {}
        
        # Recomendação baseada na tendência
        if trend_analysis.direction == TrendDirection.REVERSING:
            recommendations['trend_action'] = "CLOSE_POSITIONS"
        elif trend_analysis.direction == TrendDirection.BULLISH and trend_analysis.confidence > 0.7:
            recommendations['trend_action'] = "HOLD_LONG"
        elif trend_analysis.direction == TrendDirection.BEARISH and trend_analysis.confidence > 0.7:
            recommendations['trend_action'] = "HOLD_SHORT"
        else:
            recommendations['trend_action'] = "MONITOR"
        
        # Recomendação baseada na atividade de baleias
        if whale_activity.level == WhaleActivityLevel.EXTREME:
            recommendations['whale_action'] = "CLOSE_IMMEDIATELY"
        elif whale_activity.level == WhaleActivityLevel.HIGH:
            recommendations['whale_action'] = "CLOSE_PREVENTIVELY"
        elif whale_activity.level == WhaleActivityLevel.MEDIUM:
            recommendations['whale_action'] = "REDUCE_POSITION"
        else:
            recommendations['whale_action'] = "MONITOR"
        
        # Recomendação final combinada
        if recommendations.get('whale_action') in ['CLOSE_IMMEDIATELY', 'CLOSE_PREVENTIVELY']:
            recommendations['final_action'] = recommendations['whale_action']
        elif recommendations.get('trend_action') == 'CLOSE_POSITIONS':
            recommendations['final_action'] = 'CLOSE_POSITIONS'
        else:
            recommendations['final_action'] = 'MONITOR'
        
        return recommendations
    
    def should_close_trade(self, trade_id: str, symbol: str, current_pnl: float) -> Tuple[bool, str]:
        """Determina se uma trade deve ser fechada baseado no monitoramento"""
        # Verifica se há alertas críticos para o símbolo
        recent_alerts = [alert for alert in self.alerts_history 
                        if alert.timestamp > datetime.now() - timedelta(minutes=5)]
        
        critical_alerts = [alert for alert in recent_alerts 
                          if alert.type in ['market_manipulation', 'trend_reversal'] 
                          and alert.severity == 'high']
        
        if critical_alerts:
            return True, f"Fechamento por alerta crítico: {critical_alerts[0].message}"
        
        # Verifica atividade de baleias
        whale_activity = self.whale_detector.detect_whale_activity()
        if whale_activity.level == WhaleActivityLevel.EXTREME and whale_activity.confidence > 0.8:
            return True, f"Fechamento por atividade extrema de baleias (confiança: {whale_activity.confidence:.2f})"
        
        # Verifica probabilidade de reversão com lucro
        trend_analysis = self.trend_detector.calculate_reversal_probability()
        if trend_analysis > 0.8 and current_pnl > 0:
            return True, f"Fechamento preventivo por alta probabilidade de reversão ({trend_analysis:.2f}) com lucro"
        
        return False, ""

# Exemplo de uso
async def main():
    monitor = IntelligentTradingMonitor()
    
    # Simulação de dados de mercado
    symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT']
    
    for symbol in symbols:
        # Simulação de dados
        price = 50000 + np.random.normal(0, 1000)
        volume = 1000000 + np.random.normal(0, 100000)
        
        result = await monitor.monitor_market(symbol, price, volume, datetime.now())
        
        print(f"\n=== Análise para {symbol} ===")
        print(f"Tendência: {result['trend_analysis'].direction.value}")
        print(f"Força: {result['trend_analysis'].strength:.2f}")
        print(f"Probabilidade de reversão: {result['trend_analysis'].reversal_probability:.2f}")
        print(f"Atividade de baleias: {result['whale_activity'].level.value}")
        print(f"Sinal de manipulação: {result['whale_activity'].manipulation_signal.value}")
        
        if result['alerts']:
            print("Alertas:")
            for alert in result['alerts']:
                print(f"  - {alert.type}: {alert.message}")
        
        print(f"Ação recomendada: {result['recommendations']['final_action']}")

if __name__ == "__main__":
    asyncio.run(main())

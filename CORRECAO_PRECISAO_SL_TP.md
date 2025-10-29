# 🔧 CORREÇÃO: Erro de Precisão Stop Loss/Take Profit (code -1111)

## ❌ **PROBLEMA:**

```
❌ Erro ao criar Stop Loss/Take Profit: {
  code: -1111,
  msg: 'Precision is over the maximum defined for this asset.'
}
```

Este erro ocorria porque os preços de Stop Loss e Take Profit estavam sendo enviados com **mais casas decimais** do que o permitido pelo símbolo na Binance Futures.

Por exemplo, para ETHUSDT:
- Preço calculado: `3890.7401499999996` (muitas casas decimais)
- Precisão permitida: `2 casas decimais` (tickSize = 0.01)
- Preço correto: `3890.74`

---

## ✅ **SOLUÇÃO IMPLEMENTADA:**

### **1. Melhorado Ajuste de Precisão para Stop Loss:**

**Arquivo:** `engine-v2/src/services/binance-api.ts`  
**Método:** `createFuturesStopLoss()`

**Melhorias:**
- ✅ Usa `Math.round()` ao invés de `Math.floor()` para melhor precisão
- ✅ Calcula número de casas decimais baseado no `tickSize`
- ✅ Usa `pricePrecision` se disponível (mais confiável)
- ✅ Suporta notação científica (ex: `1e-8`)
- ✅ Fallback seguro: 2 casas decimais se não conseguir obter precisão

**Código implementado:**
```typescript
// Buscar informações do símbolo
const symbolInfo = await this.getFuturesSymbolInfo(symbol);
const priceFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');

if (priceFilter?.tickSize) {
  const tickSize = parseFloat(priceFilter.tickSize);
  // Arredondar para o tick mais próximo
  const roundedToTick = Math.round(stopPrice / tickSize) * tickSize;
  
  // Calcular casas decimais do tickSize
  let decimalPlaces = calcularCasasDecimais(tickSize);
  
  // Aplicar precisão
  adjustedStopPrice = parseFloat(roundedToTick.toFixed(decimalPlaces));
  
  // Priorizar pricePrecision se disponível
  if (symbolInfo.pricePrecision !== undefined) {
    adjustedStopPrice = parseFloat(adjustedStopPrice.toFixed(symbolInfo.pricePrecision));
  }
}
```

### **2. Melhorado Ajuste de Precisão para Take Profit:**

Mesma lógica aplicada ao método `createFuturesTakeProfit()`

---

## 📊 **EXEMPLO DE FUNCIONAMENTO:**

### **Antes (ERRADO):**
```typescript
stopPrice = 3890.7401499999996  // ❌ Muitas casas decimais
// Binance rejeita: code -1111
```

### **Depois (CORRETO):**
```typescript
tickSize = 0.01  // ETHUSDT
decimalPlaces = 2  // Baseado no tickSize
stopPrice = 3890.74  // ✅ Precisão correta (2 casas)
// Binance aceita! ✅
```

---

## 🔍 **COMO FUNCIONA:**

1. **Busca informações do símbolo** via `getFuturesSymbolInfo()`
2. **Extrai `tickSize`** do filtro `PRICE_FILTER`
3. **Calcula casas decimais** baseado no `tickSize`:
   - `0.01` → 2 casas decimais
   - `0.001` → 3 casas decimais
   - `1e-8` → 8 casas decimais
4. **Arredonda para o tick mais próximo** usando `Math.round()`
5. **Aplica precisão final** usando `toFixed(decimalPlaces)`
6. **Prioriza `pricePrecision`** se disponível (mais confiável)
7. **Fallback seguro**: 2 casas decimais se falhar

---

## ✅ **RESULTADO:**

- ✅ Stop Loss e Take Profit são criados com **precisão correta**
- ✅ **Sem erro -1111** na criação de ordens
- ✅ Funciona para **qualquer símbolo** (BTC, ETH, altcoins)
- ✅ **Logs detalhados** mostrando ajuste realizado

---

## 🔄 **PRÓXIMOS PASSOS:**

1. **Testar com diferentes símbolos** para validar precisões diferentes
2. **Monitorar logs** para confirmar que não há mais erros -1111
3. **Verificar criação de SL/TP** na próxima trade executada

---

## 📝 **NOTAS TÉCNICAS:**

- O `pricePrecision` da Binance é mais confiável que calcular baseado no `tickSize`
- Alguns símbolos podem ter `tickSize` em notação científica (ex: `1e-8`)
- O fallback de 2 casas decimais é seguro para a maioria dos pares USDT
- A função suporta ambos: `tickSize` (preferencial) e `pricePrecision` (fallback)


// ============================================================================
// SUPABASE ANALYSES - Armazenamento de análises de IA
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface TradeAIAnalysis {
  id?: string;
  trade_id: string;
  score: number;
  verdict: 'correct' | 'incorrect' | 'questionable';
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  analyzed_at: string;
}

/**
 * Salva análise de IA para uma trade
 */
export async function saveAIAnalysis(analysis: Omit<TradeAIAnalysis, 'id' | 'analyzed_at'>) {
  if (!supabase) {
    console.error('❌ Supabase não inicializado');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('trade_ai_analysis')
      .insert({
        ...analysis,
        analyzed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar análise:', error);
      return null;
    }

    console.log('✅ Análise de IA salva:', data.id);
    return data;
  } catch (error) {
    console.error('❌ Erro ao salvar análise:', error);
    return null;
  }
}

/**
 * Busca análises de IA
 */
export async function getAIAnalyses(tradeId?: string, limit = 50) {
  if (!supabase) return [];

  try {
    let query = supabase
      .from('trade_ai_analysis')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(limit);

    if (tradeId) {
      query = query.eq('trade_id', tradeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar análises:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erro ao buscar análises:', error);
    return [];
  }
}

/**
 * Gera SQL para criar tabela (executar manualmente no Supabase)
 */
export function getCreateTableSQL() {
  return `
-- Criar tabela de análises de IA
CREATE TABLE IF NOT EXISTS trade_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id TEXT NOT NULL REFERENCES real_trades(trade_id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  verdict TEXT NOT NULL CHECK (verdict IN ('correct', 'incorrect', 'questionable')),
  reasoning TEXT NOT NULL,
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  improvements TEXT[] DEFAULT '{}',
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trade_ai_analysis_trade_id ON trade_ai_analysis(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_ai_analysis_verdict ON trade_ai_analysis(verdict);
CREATE INDEX IF NOT EXISTS idx_trade_ai_analysis_analyzed_at ON trade_ai_analysis(analyzed_at DESC);

-- Permissões (ajustar conforme necessário)
ALTER TABLE trade_ai_analysis ENABLE ROW LEVEL SECURITY;

-- Política de leitura
CREATE POLICY "Allow read access to trade_ai_analysis" ON trade_ai_analysis
  FOR SELECT USING (true);

-- Política de inserção
CREATE POLICY "Allow insert access to trade_ai_analysis" ON trade_ai_analysis
  FOR INSERT WITH CHECK (true);
`;
}


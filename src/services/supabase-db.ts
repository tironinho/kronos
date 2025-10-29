// Serviço para integração com Supabase

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvfuruydocgexxdzdilh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZnVydXlkb2NnZXh4ZHpkaWxoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNTM4MSwiZXhwIjoyMDc2OTExMzgxfQ.Mu3nFA50b2EhdynjSSv7tCIPwmiNS55ba6mOHfY6T4g';

// Só cria o client se as URLs estão configuradas
let supabase: any = null;

try {
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client inicializado');
  } else {
    console.warn('⚠️ Supabase não configurado - variáveis de ambiente não encontradas');
  }
} catch (error) {
  console.error('❌ Erro ao inicializar Supabase:', error);
}

export { supabase };

// Interfaces para tipagem
export interface SimulatedTrade {
  id?: number;
  trade_id: string;
  symbol: string;
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string | null;
  side: 'BUY' | 'SELL';
  quantity: number;
  pnl: number;
  pnl_percent: number;
  duration_seconds: number | null;
  algorithm: string;
  stop_loss: number | null;
  take_profit: number | null;
  status: 'open' | 'closed';
  created_at?: string;
}

export interface SimulationStats {
  id?: number;
  symbol: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  total_pnl_percent: number;
  equity: number;
  active_positions: number;
  updated_at?: string;
}

export interface SimulationConfig {
  id?: number;
  symbol: string;
  initial_capital: number;
  max_positions: number;
  position_size_percent: number;
  stop_loss_percent: number;
  take_profit_percent: number;
  is_active: boolean;
  started_at: string | null;
  stopped_at: string | null;
  created_at?: string;
  updated_at?: string;
}

// Funções para salvar dados
export async function saveSimulatedTrade(trade: SimulatedTrade) {
  const { data, error } = await supabase
    .from('simulated_trades')
    .insert(trade);

  return { data, error };
}

export async function getSimulatedTrades(symbol?: string, limit = 100) {
  let query = supabase.from('simulated_trades').select('*');

  if (symbol) {
    query = query.eq('symbol', symbol);
  }

  query = query.order('created_at', { ascending: false }).limit(limit);

  const { data, error } = await query;

  return { data, error };
}

export async function getSimulationStats(symbol: string) {
  const { data, error } = await supabase
    .from('simulation_stats')
    .select('*')
    .eq('symbol', symbol)
    .single();

  return { data, error };
}

export async function getAllSimulationStats() {
  const { data, error } = await supabase
    .from('simulation_stats')
    .select('*')
    .order('updated_at', { ascending: false });

  return { data, error };
}

export async function saveSimulationConfig(config: SimulationConfig) {
  const { data, error } = await supabase
    .from('simulation_config')
    .insert(config);

  return { data, error };
}

export async function updateSimulationConfig(symbol: string, updates: Partial<SimulationConfig>) {
  const { data, error } = await supabase
    .from('simulation_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('symbol', symbol)
    .select()
    .single();

  return { data, error };
}

export async function getActiveSimulationConfigs() {
  const { data, error } = await supabase
    .from('simulation_config')
    .select('*')
    .eq('is_active', true);

  return { data, error };
}

export async function saveEquityHistory(symbol: string, equity: number) {
  const { data, error } = await supabase
    .from('equity_history')
    .insert({
      symbol,
      equity,
      timestamp: new Date().toISOString()
    });

  return { data, error };
}

export async function getEquityHistory(symbol: string, hours = 24) {
  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - hours);

  const { data, error } = await supabase
    .from('equity_history')
    .select('*')
    .eq('symbol', symbol)
    .gte('timestamp', hoursAgo.toISOString())
    .order('timestamp', { ascending: true });

  return { data, error };
}

// Interface para Monte Carlo
export interface MonteCarloSimulation {
  id?: number;
  simulation_id: string;
  symbol: string;
  current_price: number;
  price_change: number;
  price_change_percent: number;
  initial_capital: number;
  num_simulations: number;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  confidence_lower: number;
  confidence_upper: number;
  estimated_profit?: number;
  risk_reward_ratio?: number;
  success_probability?: number;
  execution_time_ms: number;
  timestamp?: string;
}

// Funções para Monte Carlo
export async function saveMonteCarloSimulation(sim: MonteCarloSimulation) {
  const { data, error } = await supabase
    .from('monte_carlo_simulations')
    .insert(sim);

  return { data, error };
}

export async function getMonteCarloSimulations(symbol?: string, limit = 100) {
  let query = supabase.from('monte_carlo_simulations').select('*');

  if (symbol) {
    query = query.eq('symbol', symbol);
  }

  query = query.order('timestamp', { ascending: false }).limit(limit);

  const { data, error } = await query;

  return { data, error };
}


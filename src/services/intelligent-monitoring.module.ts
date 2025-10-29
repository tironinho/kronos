import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { IntelligentMonitoringService } from './intelligent-monitoring.service';
import { AdvancedTradingEngine } from './advanced-trading-engine';
import { BinanceApiService } from './binance-api';
import { SupabaseService } from './supabase';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [
    IntelligentMonitoringService,
    AdvancedTradingEngine,
    BinanceApiService,
    SupabaseService,
  ],
  exports: [
    IntelligentMonitoringService,
    AdvancedTradingEngine,
  ],
})
export class IntelligentMonitoringModule {}

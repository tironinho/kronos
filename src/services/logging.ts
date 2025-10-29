// ============================================================================
// SISTEMA DE LOGGING KRONOS-X
// ============================================================================

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import {
    LogLevel,
    SystemComponent,
    SystemAction
} from '../types/index';

// Removemos re-exports de tipos inexistentes para evitar warnings de build
export { LogLevel, SystemComponent, SystemAction };

// ============================================================================
// CONFIGURAÇÃO DO WINSTON
// ============================================================================

const logDir = path.join(process.cwd(), 'logs');

// Cria diretório de logs se não existir
if (!fs.existsSync(logDir)) {
	fs.mkdirSync(logDir, { recursive: true });
}

// Formato customizado para logs
const customFormat = winston.format.combine(
	winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
	winston.format.errors({ stack: true }),
	winston.format.json(),
	winston.format.printf(({ timestamp, level, message, component, action, ...meta }) => {
		return JSON.stringify({
			timestamp,
			level,
			message,
			component,
			action,
			...meta
		});
	})
);

// Configuração do logger principal
const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: customFormat,
	defaultMeta: { service: 'kronos-x-engine' },
	transports: [
		// Console transport
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			)
		}),
		
		// File transport para todos os logs
		new winston.transports.File({
			filename: path.join(logDir, 'kronos-x.log'),
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
			tailable: true
		}),
		
		// File transport para erros
		new winston.transports.File({
			filename: path.join(logDir, 'error.log'),
			level: 'error',
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
			tailable: true
		})
	]
});

// ============================================================================
// SISTEMA DE LOGS AVANÇADO
// ============================================================================

export class SystemLogger {
	private static instance: SystemLogger;
    private logs: any[] = [];
	private maxLogs: number;
    private statistics: any;

	private constructor(maxLogs: number = 10000) {
		this.maxLogs = maxLogs;
		this.statistics = this.initializeStatistics();
	}

	public static getInstance(maxLogs?: number): SystemLogger {
		if (!SystemLogger.instance) {
			SystemLogger.instance = new SystemLogger(maxLogs);
		}
		return SystemLogger.instance;
	}

	/**
	 * Inicializa estatísticas de log
	 */
    private initializeStatistics(): any {
		return {
			total_logs: 0,
			logs_by_level: {
				[LogLevel.DEBUG]: 0,
				[LogLevel.INFO]: 0,
				[LogLevel.WARN]: 0,
				[LogLevel.ERROR]: 0,
				[LogLevel.CRITICAL]: 0
			},
			logs_by_component: {
				[SystemComponent.TradingEngine]: 0,
				[SystemComponent.SignalEngine]: 0,
				[SystemComponent.BinanceAPI]: 0,
				[SystemComponent.MonteCarlo]: 0,
				[SystemComponent.TradeOrchestrator]: 0,
				[SystemComponent.AdvancedTrading]: 0,
				[SystemComponent.ConfidenceModel]: 0,
				[SystemComponent.MLModels]: 0,
				[SystemComponent.RLAgent]: 0,
				[SystemComponent.AIAgent]: 0,
				[SystemComponent.HealthMonitor]: 0,
				[SystemComponent.Database]: 0,
				[SystemComponent.WebSocket]: 0
			},
			logs_by_action: {
				[SystemAction.SystemStart]: 0,
				[SystemAction.SystemStop]: 0,
				[SystemAction.Configuration]: 0,
				[SystemAction.DataProcessing]: 0,
				[SystemAction.SignalGeneration]: 0,
				[SystemAction.TradeExecution]: 0,
				[SystemAction.RiskManagement]: 0,
				[SystemAction.ErrorHandling]: 0,
				[SystemAction.PerformanceUpdate]: 0,
				[SystemAction.AlertTriggered]: 0
			},
			error_rate: 0,
			average_response_time_ms: 0,
			last_updated: Date.now()
		};
	}

	/**
	 * Adiciona log ao sistema
	 */
    public async addLog(
        level: LogLevel,
        component: SystemComponent,
        action: SystemAction,
        message: string,
        data?: Record<string, any>,
        success: boolean = true,
        errorMessage?: string,
        stackTrace?: string,
        durationMs?: number
    ): Promise<void> {
        const log = {
			log_id: this.generateLogId(),
			level,
			component,
			action,
			message,
			data,
			success,
			error_message: errorMessage,
			stack_trace: stackTrace,
			timestamp: Date.now(),
			duration_ms: durationMs
		};

		// Adiciona ao array de logs
		this.logs.push(log);
		
		// Remove logs antigos se necessário
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		// Atualiza estatísticas
		this.updateStatistics(log);

		// Log no Winston
		this.logToWinston(log);

		// Log no console se necessário
		if (process.env.NODE_ENV === 'development') {
			console.log(`[${level.toUpperCase()}] ${component}: ${message}`);
		}
	}

	/**
	 * Gera ID único para log
	 */
	private generateLogId(): string {
		return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Atualiza estatísticas de log
	 */
	private updateStatistics(log: any): void {
		this.statistics.total_logs++;
		this.statistics.logs_by_level[log.level]++;
		this.statistics.logs_by_component[log.component]++;
		this.statistics.logs_by_action[log.action]++;
		
		// Calcula taxa de erro
		const errorLogs = this.statistics.logs_by_level[LogLevel.ERROR] + 
						 this.statistics.logs_by_level[LogLevel.CRITICAL];
		this.statistics.error_rate = errorLogs / this.statistics.total_logs;

		// Calcula tempo médio de resposta
		if (log.duration_ms !== undefined) {
			const totalDuration = this.logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0);
			this.statistics.average_response_time_ms = totalDuration / this.logs.length;
		}

		this.statistics.last_updated = Date.now();
	}

	/**
	 * Log no Winston
	 */
	private logToWinston(log: any): void {
		const winstonLevel = log.level === LogLevel.CRITICAL ? 'error' : log.level;
		
		logger.log(winstonLevel, log.message, {
			component: log.component,
			action: log.action,
			success: log.success,
			error_message: log.error_message,
			stack_trace: log.stack_trace,
			duration_ms: log.duration_ms,
			data: log.data
		});
	}

	/**
	 * Obtém logs em formato JSON
	 */
	public async getLogsJson(): Promise<string> {
		return JSON.stringify(this.logs, null, 2);
	}

	/**
	 * Obtém logs recentes
	 */
    public async getRecentLogs(count: number = 100): Promise<any[]> {
		return this.logs.slice(-count);
	}

	/**
	 * Obtém logs de erro
	 */
    public async getErrorLogs(): Promise<any[]> {
		return this.logs.filter(log => 
			log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
		);
	}

	/**
	 * Obtém logs por componente
	 */
    public async getLogsByComponent(component: string): Promise<any[]> {
		if (!component) return this.logs;
		return this.logs.filter(log => log.component === component);
	}

	/**
	 * Obtém estatísticas de log
	 */
    public async getLogStatistics(): Promise<any> {
		return { ...this.statistics };
	}

	/**
	 * Limpa logs antigos
	 */
	public async clearOldLogs(olderThanMs: number): Promise<void> {
		const cutoffTime = Date.now() - olderThanMs;
		this.logs = this.logs.filter(log => log.timestamp > cutoffTime);
	}

	/**
	 * Exporta logs para arquivo
	 */
	public async exportLogs(filename?: string): Promise<string> {
		const exportFilename = filename || `kronos-x-logs-${Date.now()}.json`;
		const exportPath = path.join(logDir, exportFilename);
		
		const exportData = {
			logs: this.logs,
			statistics: this.statistics,
			exported_at: Date.now()
		};

		fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
		return exportPath;
	}
}

// ============================================================================
// LOGGERS ESPECÍFICOS POR COMPONENTE
// ============================================================================

export class ComponentLogger {
	private systemLogger: SystemLogger;
	private component: SystemComponent;

	constructor(component: SystemComponent) {
		this.systemLogger = SystemLogger.getInstance();
		this.component = component;
	}

	/**
	 * Log de debug
	 */
	public async debug(action: SystemAction, message: string, data?: Record<string, any>): Promise<void> {
		await this.systemLogger.addLog(
			LogLevel.DEBUG,
			this.component,
			action,
			message,
			data,
			true
		);
	}

	/**
	 * Log de informação
	 */
	public async info(action: SystemAction, message: string, data?: Record<string, any>): Promise<void> {
		await this.systemLogger.addLog(
			LogLevel.INFO,
			this.component,
			action,
			message,
			data,
			true
		);
	}

	/**
	 * Log de aviso
	 */
	public async warn(action: SystemAction, message: string, data?: Record<string, any>): Promise<void> {
		await this.systemLogger.addLog(
			LogLevel.WARN,
			this.component,
			action,
			message,
			data,
			true
		);
	}

	/**
	 * Log de erro
	 */
	public async error(
		action: SystemAction, 
		message: string, 
		error?: Error, 
		data?: Record<string, any>
	): Promise<void> {
		await this.systemLogger.addLog(
			LogLevel.ERROR,
			this.component,
			action,
			message,
			data,
			false,
			error?.message,
			error?.stack
		);
	}

	/**
	 * Log crítico
	 */
	public async critical(
		action: SystemAction, 
		message: string, 
		error?: Error, 
		data?: Record<string, any>
	): Promise<void> {
		await this.systemLogger.addLog(
			LogLevel.CRITICAL,
			this.component,
			action,
			message,
			data,
			false,
			error?.message,
			error?.stack
		);
	}

	/**
	 * Log de performance
	 */
	public async performance(
		action: SystemAction,
		message: string,
		durationMs: number,
		data?: Record<string, any>
	): Promise<void> {
		await this.systemLogger.addLog(
			LogLevel.INFO,
			this.component,
			action,
			message,
			data,
			true,
			undefined,
			undefined,
			durationMs
		);
	}
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

/**
 * Obtém logger do sistema
 */
export function getSystemLogger(): SystemLogger {
	return SystemLogger.getInstance();
}

/**
 * Obtém logger de componente
 */
export function getComponentLogger(component: SystemComponent): ComponentLogger {
	return new ComponentLogger(component);
}

/**
 * Log rápido de informação
 */
export async function logInfo(
	component: SystemComponent,
	action: SystemAction,
	message: string,
	data?: Record<string, any>
): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(LogLevel.INFO, component, action, message, data, true);
}

/**
 * Log rápido de erro
 */
export async function logError(
	component: SystemComponent,
	action: SystemAction,
	message: string,
	error?: Error,
	data?: Record<string, any>
): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(
		LogLevel.ERROR,
		component,
		action,
		message,
		data,
		false,
		error?.message,
		error?.stack
	);
}

/**
 * Log rápido de performance
 */
export async function logPerformance(
	component: SystemComponent,
	action: SystemAction,
	message: string,
	durationMs: number,
	data?: Record<string, any>
): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(
		LogLevel.INFO,
		component,
		action,
		message,
		data,
		true,
		undefined,
		undefined,
		durationMs
	);
}

// ============================================================================
// MIDDLEWARE DE LOGGING PARA API ROUTES
// ============================================================================

export function createLoggingMiddleware(component: SystemComponent) {
	return async (req: any, res: any, next: any) => {
		const startTime = Date.now();
		const logger = getComponentLogger(component);

		// Log da requisição
		await logger.info(
			SystemAction.DataProcessing,
			`API Request: ${req.method} ${req.url}`,
			{
				method: req.method,
				url: req.url,
				headers: req.headers,
				body: req.body
			}
		);

		// Intercepta resposta
		const originalSend = res.send;
		res.send = function(data: any) {
			const duration = Date.now() - startTime;
			
			// Log da resposta
			logger.performance(
				SystemAction.DataProcessing,
				`API Response: ${req.method} ${req.url}`,
				duration,
				{
					status_code: res.statusCode,
					response_size: data?.length || 0
				}
			);

			return originalSend.call(this, data);
		};

		if (next) next();
	};
}

// ============================================================================
// EXPORT FUNCTIONS FOR DIRECT USE
// ============================================================================

/**
 * Direct logging functions for easy import
 */
export async function info(message: string, data?: Record<string, any>): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(LogLevel.INFO, SystemComponent.TradingEngine, SystemAction.DataProcessing, message, data, true);
}

export async function warn(message: string, data?: Record<string, any>): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(LogLevel.WARN, SystemComponent.TradingEngine, SystemAction.DataProcessing, message, data, true);
}

export async function error(message: string, data?: Record<string, any>): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(LogLevel.ERROR, SystemComponent.TradingEngine, SystemAction.ErrorHandling, message, data, false);
}

export async function debug(message: string, data?: Record<string, any>): Promise<void> {
	const logger = getSystemLogger();
	await logger.addLog(LogLevel.DEBUG, SystemComponent.TradingEngine, SystemAction.DataProcessing, message, data, true);
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default SystemLogger;

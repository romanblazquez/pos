/**
 * Structured logging with correlation IDs.
 *
 * Every log line is a structured record carrying a `correlationId` so a single
 * checkout can be traced end-to-end across the POS, the saga, the payment
 * orchestrator and the sync engine. The default sink prints JSON to the console;
 * production wires an OpenTelemetry log exporter via {@link LogSink}.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  level: LogLevel;
  message: string;
  correlationId?: string;
  context: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export const consoleSink: LogSink = {
  write(record) {
    const line = JSON.stringify(record);
    if (record.level === 'error') console.error(line);
    else if (record.level === 'warn') console.warn(line);
    else console.log(line);
  },
};

export class Logger {
  constructor(
    private readonly context: string,
    private readonly sink: LogSink = consoleSink,
    private readonly correlationId?: string,
  ) {}

  /** Derive a child logger bound to a correlation id (one per checkout/sync run). */
  withCorrelation(correlationId: string): Logger {
    return new Logger(this.context, this.sink, correlationId);
  }

  child(context: string): Logger {
    return new Logger(`${this.context}.${context}`, this.sink, this.correlationId);
  }

  private emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    this.sink.write({
      level,
      message,
      context: this.context,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.emit('debug', message, data);
  }
  info(message: string, data?: Record<string, unknown>): void {
    this.emit('info', message, data);
  }
  warn(message: string, data?: Record<string, unknown>): void {
    this.emit('warn', message, data);
  }
  error(message: string, data?: Record<string, unknown>): void {
    this.emit('error', message, data);
  }
}

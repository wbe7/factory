/**
 * Structured logging module for Factory.
 * Provides colored console output and optional JSON Lines file logging.
 */
import { appendFile } from 'fs/promises';
import type { LogLevel } from './types';

// ANSI color codes for console output
const COLORS = {
    reset: '\x1b[0m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
} as const;

// Level colors mapping
const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: COLORS.gray,
    info: COLORS.cyan,
    warn: COLORS.yellow,
    error: COLORS.red,
};

// Level priority for filtering
const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Level icons for console output
const LEVEL_ICONS: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
};

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    duration?: number;
}

export interface LoggerOptions {
    logFile?: string | null;
    level: LogLevel;
    quiet: boolean;
}

/**
 * Logger class with dual output: colored console + optional JSON file.
 */
export class Logger {
    private logFile: string | null;
    private level: LogLevel;
    private quiet: boolean;
    private pendingWrites: Promise<void>[] = [];

    constructor(options: LoggerOptions) {
        this.logFile = options.logFile ?? null;
        this.level = options.level;
        this.quiet = options.quiet;
    }

    /**
     * Check if a message at given level should be logged.
     */
    private shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.level];
    }

    /**
     * Format timestamp for console output (HH:MM:SS).
     */
    private formatTime(date: Date): string {
        return date.toTimeString().slice(0, 8);
    }

    /**
     * Write a log entry to console and/or file.
     */
    private log(level: LogLevel, message: string, context?: Record<string, unknown>, duration?: number): void {
        if (!this.shouldLog(level)) return;

        const timestamp = new Date().toISOString();
        const entry: LogEntry = { timestamp, level, message };
        if (context) entry.context = context;
        if (duration !== undefined) entry.duration = duration;

        // Console output (unless quiet mode)
        if (!this.quiet) {
            const color = LEVEL_COLORS[level];
            const icon = LEVEL_ICONS[level];
            const time = this.formatTime(new Date());
            let consoleMsg = `${COLORS.gray}${time}${COLORS.reset} ${icon} ${color}${message}${COLORS.reset}`;

            if (duration !== undefined) {
                consoleMsg += ` ${COLORS.gray}(${this.formatDuration(duration)})${COLORS.reset}`;
            }

            // Show context in console when log level is debug (more verbose output)
            if (context && Object.keys(context).length > 0 && this.level === 'debug') {
                consoleMsg += ` ${COLORS.gray}${JSON.stringify(context)}${COLORS.reset}`;
            }

            if (level === 'error') {
                console.error(consoleMsg);
            } else {
                console.log(consoleMsg);
            }
        }

        // File output (JSON Lines format)
        if (this.logFile) {
            const jsonLine = JSON.stringify(entry) + '\n';
            const writePromise = appendFile(this.logFile, jsonLine).catch(err => {
                // Don't crash on file write errors, just log to stderr
                console.error(`Failed to write to log file: ${err.message}`);
            });
            this.pendingWrites.push(writePromise);
            // Remove the promise from array once settled to prevent memory leaks
            writePromise.finally(() => {
                const index = this.pendingWrites.indexOf(writePromise);
                if (index > -1) {
                    this.pendingWrites.splice(index, 1);
                }
            });
        }
    }

    /**
     * Format duration in human-readable format.
     */
    private formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.round(ms / 100) / 10;
        return `${seconds}s`;
    }

    /**
     * Log a debug message.
     */
    debug(message: string, context?: Record<string, unknown>): void {
        this.log('debug', message, context);
    }

    /**
     * Log an info message.
     */
    info(message: string, context?: Record<string, unknown>): void {
        this.log('info', message, context);
    }

    /**
     * Log a warning message.
     */
    warn(message: string, context?: Record<string, unknown>): void {
        this.log('warn', message, context);
    }

    /**
     * Log an error message.
     */
    error(message: string, context?: Record<string, unknown>): void {
        this.log('error', message, context);
    }

    /**
     * Create a timer that returns duration when stopped.
     * @param label - Label for the timing operation
     * @returns A function that stops the timer and returns duration in milliseconds
     */
    timer(label: string): () => number {
        const start = performance.now();
        return () => {
            const duration = Math.round(performance.now() - start);
            this.log('debug', label, undefined, duration);
            return duration;
        };
    }

    /**
     * Log a timing event manually.
     */
    timing(message: string, durationMs: number, context?: Record<string, unknown>): void {
        this.log('info', message, context, durationMs);
    }

    /**
     * Wait for all pending file writes to complete.
     */
    async close(): Promise<void> {
        await Promise.all(this.pendingWrites);
        this.pendingWrites = [];
    }
}

/**
 * Create a logger instance from FactoryConfig.
 */
export function createLogger(config: { logFile: string | null; logLevel: LogLevel; quiet: boolean }): Logger {
    return new Logger({
        logFile: config.logFile,
        level: config.logLevel,
        quiet: config.quiet,
    });
}

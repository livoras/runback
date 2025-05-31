/**
 * 日志级别枚举
 */
export enum LogLevel {
  NONE = 0,   // 不输出任何日志
  ERROR = 1,  // 只输出错误
  WARN = 2,   // 输出警告和错误
  INFO = 3,   // 输出信息、警告和错误
  DEBUG = 4,  // 输出所有日志，包括调试信息
}

/**
 * 日志配置接口
 */
export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
  customLogger?: (level: string, message: string, ...args: any[]) => void;
}

/**
 * 日志管理器类
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private customLogger?: (level: string, message: string, ...args: any[]) => void;

  /**
   * 创建日志管理器
   * @param options 日志配置选项
   */
  constructor(options: LoggerOptions) {
    this.level = options.level;
    this.prefix = options.prefix || '';
    this.customLogger = options.customLogger;
  }

  /**
   * 输出调试级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  /**
   * 输出信息级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  /**
   * 输出警告级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  /**
   * 输出错误级别日志
   * @param message 日志消息
   * @param args 额外参数
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  /**
   * 更新日志级别
   * @param level 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 内部日志输出方法
   * @param logLevel 日志级别
   * @param levelName 级别名称
   * @param message 日志消息
   * @param args 额外参数
   */
  private log(logLevel: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (this.level < logLevel) return;

    const formattedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;

    if (this.customLogger) {
      this.customLogger(levelName, formattedMessage, ...args);
      return;
    }

    switch (logLevel) {
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        // console.info(formattedMessage, ...args);
        break;
      case LogLevel.DEBUG:
        // console.log(formattedMessage, ...args);
        break;
    }
  }
}

/**
 * 创建默认日志管理器
 */
export const createDefaultLogger = (level: LogLevel = LogLevel.INFO): Logger => {
  return new Logger({ level });
};

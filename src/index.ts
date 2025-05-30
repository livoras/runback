import { config } from 'dotenv';

// 加载环境变量
config();

export interface AppConfig {
  name: string;
  env: string;
  port: number;
  host: string;
}

export function getConfig(): AppConfig {
  return {
    name: process.env.APP_NAME || 'Runback',
    env: process.env.APP_ENV || 'development',
    port: parseInt(process.env.APP_PORT || '3000', 10),
    host: process.env.APP_HOST || 'localhost',
  };
}

export function hello(name: string): string {
  const config = getConfig();
  return `Hello, ${name}! Running on ${config.name} (${config.env})`;
}

if (require.main === module) {
  const config = getConfig();
  console.log(`Starting ${config.name} in ${config.env} mode`);
  console.log(`Server will run on ${config.host}:${config.port}`);
  console.log(hello('World'));
} 
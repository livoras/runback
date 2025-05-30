import { hello, getConfig } from '../src/index';

describe('App Configuration', () => {
  it('should return default config when env vars are not set', () => {
    const config = getConfig();
    expect(config.name).toBe('Runback');
    expect(config.env).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.host).toBe('localhost');
  });
});

describe('hello', () => {
  it('should return greeting with name and config info', () => {
    const result = hello('World');
    expect(result).toContain('Hello, World!');
    expect(result).toContain('Runback');
    expect(result).toContain('development');
  });
}); 
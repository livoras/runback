import { hello } from './index';

describe('hello', () => {
  it('should return greeting with name', () => {
    expect(hello('World')).toBe('Hello, World!');
  });
}); 
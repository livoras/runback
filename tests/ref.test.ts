import { createRef, RefKey } from '../src/ref';

describe('Ref Proxy Path Builder', () => {
  it('should build correct id and path', () => {
    const ref = createRef('ojbk');
    const key = ref.a.b.c.$ref;

    expect(key).toBeInstanceOf(RefKey);
    expect(key.id).toBe('ojbk');
    expect(key.path).toBe('a.b.c');
    expect(String(key)).toBe('ojbk.a.b.c');
  });

  it('should support empty path', () => {
    const ref = createRef('root');
    expect(ref.$ref.id).toBe('root');
    expect(ref.$ref.path).toBe('');
    expect(String(ref.$ref)).toBe('root.');
  });

  it('should be stable for long chains', () => {
    const ref = createRef('base');
    const key = ref.foo.bar.baz.qux.quux.$ref;

    expect(key.id).toBe('base');
    expect(key.path).toBe('foo.bar.baz.qux.quux');
  });

  it('should not break on symbol access', () => {
    const ref = createRef('id');
    const symbol = Symbol('test');
    expect((ref as any)[symbol]).toBeUndefined();
  });
});

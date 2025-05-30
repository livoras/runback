import { createRef, collect } from '../src/ref';

describe('collect', () => {
  const ref = createRef('OJBK');

  it('should collect a single ref path', () => {
    const input = {
      user: {
        name: ref.profile.name,
        age: 25,
      },
    };

    const result = collect(input);
    expect(result).toEqual({
      'user.name': 'OJBK.profile.name',
    });
  });

  it('should collect multiple ref paths at different depths', () => {
    const input = {
      user: {
        name: ref.profile.name,
        email: ref.profile.email,
      },
      settings: {
        token: ref.auth.token,
      },
    };

    const result = collect(input);
    expect(result).toEqual({
      'user.name': 'OJBK.profile.name',
      'user.email': 'OJBK.profile.email',
      'settings.token': 'OJBK.auth.token',
    });
  });

  it('should skip non-ref values', () => {
    const input = {
      plain: 'string',
      number: 42,
      nested: {
        list: [1, 2, 3],
        obj: { foo: 'bar' },
      },
    };

    const result = collect(input);
    expect(result).toEqual({});
  });

  it('should ignore nulls and undefined values', () => {
    const input = {
      a: null,
      b: undefined,
      c: {
        d: null,
        e: undefined,
      },
    };

    const result = collect(input);
    expect(result).toEqual({});
  });

  it('should support deeply nested refs', () => {
    const input = {
      a: {
        b: {
          c: ref.deeply.nested.value,
        },
      },
    };

    const result = collect(input);
    expect(result).toEqual({
      'a.b.c': 'OJBK.deeply.nested.value',
    });
  });

  it('handles root-level array of objects', () => {
    const input = [
      { x: ref.a },
      { y: ref.b },
    ];

    expect(collect(input)).toEqual({
      '0.x': 'OJBK.a',
      '1.y': 'OJBK.b',
    });
  });
});

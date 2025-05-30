import { inject } from '../src/ref';

describe('inject', () => {
  it('should inject a flat path', () => {
    const from = { user: { name: 'Alice' } };
    const to: any = {};
    const mapping = { 'name': 'user.name' };

    inject(to, from, mapping);
    expect(to).toEqual({ name: 'Alice' });
  });

  it('should inject deeply nested paths', () => {
    const from = { user: { name: 'Bob', email: 'bob@example.com' } };
    const to: any = {};
    const mapping = {
      'profile.username': 'user.name',
      'profile.contact.email': 'user.email',
    };

    inject(to, from, mapping);
    expect(to).toEqual({
      profile: {
        username: 'Bob',
        contact: {
          email: 'bob@example.com',
        },
      },
    });
  });

  it('should handle missing source paths gracefully', () => {
    const from = { user: {} };
    const to: any = {};
    const mapping = {
      'profile.username': 'user.name', // user.name 不存在
    };

    inject(to, from, mapping);
    expect(to).toEqual({
      profile: {
        username: undefined,
      },
    });
  });

  it('should not overwrite existing nested objects', () => {
    const from = { data: { value: 42 } };
    const to: any = { result: { existing: true } };
    const mapping = { 'result.number': 'data.value' };

    inject(to, from, mapping);
    expect(to).toEqual({
      result: {
        existing: true,
        number: 42,
      },
    });
  });

  it('should create intermediate objects if not exist', () => {
    const from = { user: { id: 123 } };
    const to: any = {};
    const mapping = { 'a.b.c.d': 'user.id' };

    inject(to, from, mapping);
    expect(to).toEqual({
      a: {
        b: {
          c: {
            d: 123,
          },
        },
      },
    });
  });

  it('should preserve existing unrelated properties', () => {
    const from = {
      user: {
        name: 'Charlie',
      },
    };
  
    const to: any = {
      profile: {
        age: 30,
      },
    };
  
    const mapping = {
      'profile.name': 'user.name',
    };
  
    inject(to, from, mapping);
  
    expect(to).toEqual({
      profile: {
        age: 30,          // ✅ 保留原有字段
        name: 'Charlie',  // ✅ 新增映射字段
      },
    });
  });
  
});

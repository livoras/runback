export class RefKey {
    constructor(public id: string, public path: string) { }

    toString(): string {
        return `${this.id}.${this.path}`;
    }

    [Symbol.toPrimitive](): string {
        return this.toString();
    }
}

type RefType = {
    [key: string]: RefType;
} & {
    $ref: RefKey;
};

export const createRef = (id: string, path: string[] = []): RefType => {
  const handler: ProxyHandler<any> = {
    get(_, prop: string | symbol) {
      if (prop === '$ref') {
        return new RefKey(id, path.join('.'));
      }
      if (typeof prop === 'symbol') return undefined;
      return createRef(id, [...path, prop]);
    },
  };

  return new Proxy({}, handler) as RefType;
}

export const collect = (obj: any): Record<string, string> => {
  const result: Record<string, string> = {};

  const walk = (current: any, path: (string | number)[] = []) => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        walk(item, [...path, index]);
      });
    } else if (typeof current === 'object' && current !== null) {
      for (const key of Object.keys(current)) {
        const value = current[key];
        const newPath = [...path, key];

        if (value?.$ref instanceof RefKey) {
          result[pathToDotString(newPath)] = `${value.$ref.id}.${value.$ref.path}`;
        } else {
          walk(value, newPath);
        }
      }
    }
  };

  const pathToDotString = (segments: (string | number)[]): string =>
    segments.map(String).join('.');

  walk(obj);
  return result;
};

export const inject = (to: any, from: any, mapping: Record<string, string>): void => {
  for (const [toPath, fromPath] of Object.entries(mapping)) {
    const toKeys = toPath.split('.');
    const fromKeys = fromPath.split('.');

    // 获取源值
    let fromValue = from;
    for (const key of fromKeys) {
      if (fromValue == null) break;
      fromValue = fromValue[key];
    }

    // 递归创建目标路径并赋值
    let current = to;
    for (let i = 0; i < toKeys.length; i++) {
      const key = toKeys[i];
      if (i === toKeys.length - 1) {
        current[key] = fromValue;
      } else {
        if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
          current[key] = {};
        }
        current = current[key];
      }
    }
  }
};

// const from = {
//     user: {
//         name: 'Bob',
//         email: 'alice@example.com',
//     },
// };

// const to: any = { 'test': { 'name': 'Alice' }, 'good': { 'name': 'Bob' } };

// const mapping = {
//     'profile.username': 'user.name',
//     'profile.contact.email': 'user.email',
//     'good.name': 'user.name',
// };

// inject(to, from, mapping);

// console.log(to);
  /*
  {
    profile: {
      username: 'Alice',
      contact: {
        email: 'alice@example.com'
      }
    }
  }
  */
  
  export const collectFromRefString = (obj: any): Record<string, string | string[]> => {
    const result: Record<string, string | string[]> = {};
  
    const walk = (current: any, path: (string | number)[] = []) => {
      if (typeof current === 'string') {
        if (current.startsWith('$ref.')) {
          // 处理逗号分隔的引用
          const refs = current.split(',').map(ref => ref.replace(/^\s*\$ref\./, '').trim());
          if (refs.length > 1) {
            result[path.join('.')] = refs;
          } else {
            result[path.join('.')] = refs[0];
          }
          return;
        }
      }
  
      if (Array.isArray(current)) {
        current.forEach((item, index) => {
          walk(item, [...path, index]);
        });
      } else if (typeof current === 'object' && current !== null) {
        for (const key of Object.keys(current)) {
          walk(current[key], [...path, key]);
        }
      }
    };
  
    walk(obj);
    return result;
  };
  


const input =  { message: ["$ref.logId", "$ref.logId2"] }

console.log(collectFromRefString(input));
/*
{
  "users[0].name": "REF.a.b",
  "users[2].profile.email": "REF.x.y",
  "meta.version": "SYS.version"
}
*/



// ✅ 使用示例
// const ref = createRef('ojbk');

// console.log(ref.a.b.c.$ref.id);     // "ojbk"
// console.log(ref.a.b.c.$ref.path);   // "a.b.c"
// console.log(ref.b.$ref.toString())

// const ref2 = createRef("OJBK");

// const input = {
//     user: {
//         name: ref2.remote.data.name,
//         age: 13,
//     },
//     settings: {
//         token: ref2.api.token,
//         theme: 'dark',
//     },
// };

// console.log(collect(input));

// /*
// {
//   "user.name": "OJBK.remote.data.name",
//   "settings.token": "OJBK.api.token"
// }
// */


export class RefKey {
    constructor(public id: string, public path: string) {}
  
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
  
  export function createRef(id: string, path: string[] = []): RefType {
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
  
//   // ✅ 使用示例
//   const ref = createRef('ojbk');
  
//   console.log(ref.a.b.c.$ref.id);     // "ojbk"
//   console.log(ref.a.b.c.$ref.path);   // "a.b.c"
//   console.log(ref.a.b.c.$ref);   // "ojbk.a.b.c"
  
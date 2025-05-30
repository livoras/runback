export function createProxy(obj: any, callback: (path: string, value: any) => void, path: string[] = []): any {
  if (typeof obj !== 'object' || obj === null) return obj;

  return new Proxy(obj, {
    get(target, key, receiver) {
      const val = Reflect.get(target, key, receiver);
      if (typeof val === 'object' && val !== null) {
        return createProxy(val, callback, [...path, String(key)]);
      }
      return val;
    },
    set(target, key, value, receiver) {
      const fullPath = [...path, String(key)].join('.');
      callback(fullPath, value);

      // 如果是对象，递归代理
      const newValue = typeof value === 'object' && value !== null
        ? createProxy(value, callback, [...path, String(key)])
        : value;

      return Reflect.set(target, key, newValue, receiver);
    }
  });
}

// const proxy = createProxy({ a: { b: { c: 1 } } }, (path, value) => {
//   console.log(path, value);
// });

// proxy.a.b.c = 'xxx';    // 打印: a.b.c xxx
// proxy.a.b = { c: 2, d: 3 };  // 打印: a.b { c: 2, d: 3 }
// proxy.a.b.d = 123;      // 打印: a.b.d 123
// proxy.a = { z: 9 };     // 打印: a { z: 9 }
// proxy.a.z = 10;         // 打印: a.z 10
// proxy.a[0] = 100
// console.log(JSON.stringify(proxy))

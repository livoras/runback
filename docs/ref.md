# 🔗 `createRef` & `RefKey` 使用文档

`createRef` 是一个用于构建链式路径表达的工具，适用于构建结构化字段路径，如数据库字段、表单字段、工作流节点等。

---

## ✨ 核心功能

- 支持任意链式属性访问：`ref.a.b.c`
- 最终通过 `. $ref` 获取路径信息
- 类型安全，无需硬编码路径字符串
- 输出格式统一：`id.path`（如 `"user.name.age"`）

---

## 🧱 API 说明

### `createRef(id: string): RefType`

创建一个引用路径对象。

**参数**

| 名称 | 类型   | 说明           |
|------|--------|----------------|
| `id` | string | 初始标识符，例如 `"user"`、`"ojbk"` |

**返回**

链式可访问的 `Proxy` 对象，最后通过 `. $ref` 获取路径信息。

---

### `RefKey` 类

通过 `. $ref` 返回的结构对象，包含路径信息。

| 属性名 | 类型   | 说明                 |
|--------|--------|----------------------|
| `id`   | string | 起始标识符            |
| `path` | string | 访问链组成的路径，如 `a.b.c` |

**方法**

- `toString()`：返回格式为 `id.path` 的字符串
- `[Symbol.toPrimitive]()`：支持模板字符串插值自动转字符串

---

## 📌 使用示例

```ts
import { createRef } from './ref';

const ref = createRef('ojbk');

console.log(ref.a.b.c.$ref.id);     // => "ojbk"
console.log(ref.a.b.c.$ref.path);   // => "a.b.c"
console.log(String(ref.a.b.c.$ref)); // => "ojbk.a.b.c"

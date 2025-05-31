# Runback

Runback 是一个轻量级、高性能的 TypeScript 工作流引擎，专为构建复杂业务流程而设计。它支持条件分支、并行执行、迭代处理等高级功能，同时保持简单直观的 API。

## 设计理念

Runback 的核心设计理念是：

1. **声明式定义**：通过 JSON 配置定义工作流，而不是命令式代码
2. **自动依赖管理**：自动处理步骤间的依赖关系，无需手动排序
3. **数据流驱动**：以数据流为中心，步骤间通过引用传递数据
4. **并行执行**：自动并行执行无依赖关系的步骤，提高性能
5. **灵活扩展**：支持自定义动作和条件逻辑

## 快速开始

### 安装

```bash
npm install runback
```

### 基本使用

```typescript
import { Workflow } from 'runback';

// 定义工作流
const workflow = new Workflow({
  steps: [
    { id: "step1", action: "fetchData", options: { url: "https://api.example.com/data" } },
    { id: "step2", action: "processData", options: { data: "$ref.step1" } },
    { id: "step3", action: "saveResult", options: { result: "$ref.step2" } }
  ]
});

// 定义动作
const actions = {
  fetchData: async ({ url }) => { /* 获取数据 */ },
  processData: async ({ data }) => { /* 处理数据 */ },
  saveResult: async ({ result }) => { /* 保存结果 */ }
};

// 执行工作流
workflow.run({ actions });
```

## 核心概念

### 步骤 (Step)

步骤是工作流的基本单位，每个步骤包含以下属性：

- `id`：步骤唯一标识符
- `action`：要执行的动作名称
- `options`：传递给动作的参数
- `depends`：显式依赖的其他步骤 ID
- `type`：步骤类型，可选值为 "step"(默认)、"trigger" 或 "if"
- `each`：用于迭代执行的数据源

### 数据引用

使用 `$ref` 语法引用其他步骤的输出：

```typescript
{ options: { data: "$ref.stepId.property" } }
```

也可以在迭代步骤中使用特殊引用：

- `$ref.$item`：当前迭代项
- `$ref.$index`：当前迭代索引

## 高级功能

### 条件分支 (if)

使用 `type: "if"` 创建条件分支：

```typescript
const workflow = new Workflow({
  steps: [
    { id: "getData", action: "fetchUserData", options: { userId: 123 } },
    { 
      id: "checkAccess", 
      action: "verifyPermission", 
      options: { user: "$ref.getData" },
      type: "if"
    },
    { 
      id: "processData", 
      action: "process", 
      options: { data: "$ref.getData" },
      depends: ["checkAccess.true"] // 只在条件为 true 时执行
    },
    { 
      id: "accessDenied", 
      action: "sendNotification", 
      options: { message: "Access denied" },
      depends: ["checkAccess.false"] // 只在条件为 false 时执行
    }
  ]
});
```

条件步骤会在上下文中设置 `.true` 或 `.false` 属性，其他步骤可以依赖这些属性。

### 并行执行 (Fork/Join)

Runback 自动支持并行执行模式：

```typescript
const workflow = new Workflow({
  steps: [
    { id: "getData", action: "fetchData" },
    // 这两个步骤会并行执行 (fork)
    { id: "processA", action: "processA", options: { data: "$ref.getData" } },
    { id: "processB", action: "processB", options: { data: "$ref.getData" } },
    // 这个步骤会等待上面两个步骤完成后执行 (join)
    { 
      id: "combine", 
      action: "combineResults", 
      options: { 
        resultA: "$ref.processA", 
        resultB: "$ref.processB" 
      }
    }
  ]
});
```

### 迭代处理 (Each)

使用 `each` 属性对数组数据进行迭代处理：

```typescript
const workflow = new Workflow({
  steps: [
    { id: "getUsers", action: "fetchUserList" },
    { 
      id: "processUsers", 
      action: "processUser", 
      options: { 
        user: "$ref.$item",
        index: "$ref.$index"
      },
      each: "$ref.getUsers.list" // 迭代 getUsers.list 数组
    }
  ]
});
```

迭代步骤会并行处理数组中的每个元素，并将结果合并为一个数组。

## 日志控制

Runback 提供了灵活的日志控制机制：

```typescript
import { Workflow, LogLevel } from 'runback';

// 在创建时设置日志级别
const workflow = new Workflow(options, LogLevel.DEBUG);

// 或在运行时设置日志级别
workflow.run({ actions, logLevel: LogLevel.ERROR });
```

可用的日志级别：

- `LogLevel.NONE`：关闭所有日志
- `LogLevel.ERROR`：只显示错误
- `LogLevel.WARN`：显示警告和错误
- `LogLevel.INFO`：显示信息、警告和错误（默认）
- `LogLevel.DEBUG`：显示所有调试信息

## 错误处理

Runback 提供了全面的错误处理机制：

```typescript
try {
  await workflow.run({ actions });
} catch (error) {
  console.error('Workflow execution failed:', error);
}
```

步骤执行失败时，工作流会立即终止并抛出异常。

## 项目结构

- `src/` - 源代码目录
  - `work.ts` - 核心工作流引擎
  - `ref.ts` - 引用处理
  - `createProxy.ts` - 上下文代理
  - `logger.ts` - 日志系统
- `tests/` - 测试文件目录
- `dist/` - 编译输出目录

## 开发命令

- `npm run build` - 编译 TypeScript 代码
- `npm start` - 运行编译后的代码
- `npm run dev` - 使用 ts-node 运行开发环境
- `npm test` - 运行测试
- `npm run test:watch` - 以监听模式运行测试

## 许可证

MIT
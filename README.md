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

## 历史记录功能

Runback 提供了完善的历史记录功能，可以追踪工作流的完整执行过程，并支持断点续跑和选择性重试。

### 执行记录结构

每次工作流执行都会生成一个 `RunHistoryRecord` 记录，包含以下信息：

```typescript
interface RunHistoryRecord {
  runId: string;          // 运行唯一ID (使用uuid生成)
  startTime: string;      // 工作流开始时间 (ISO格式)
  endTime: string;        // 工作流结束时间 (ISO格式)
  duration: number;       // 总执行时长(毫秒)
  status: 'running' | 'failed' | 'success' | 'aborted' | 'pending';
  steps: {                // 步骤执行记录映射
    [stepId: string]: StepExecutionRecord;
  };
  context: any;           // 最终上下文快照
  error?: {               // 错误信息(如果执行失败)
    message: string;
    stack?: string;
  };
}

interface StepExecutionRecord {
  step: Step;            // 步骤定义
  startTime: string;      // 开始时间 (ISO格式)
  endTime: string;        // 结束时间 (ISO格式)
  duration: number;       // 执行时长(毫秒)
  status: RunStatus;      // 执行状态
  options?: any;          // 步骤配置
  inputs: any;            // 输入参数
  outputs?: any;          // 输出结果
  onlyRun: boolean;       // 是否在 onlyRuns 模式下运行
  error?: {               // 错误信息
    message: string;
    stack?: string;
  };
  context: any;          // 执行时的上下文快照
}
```

### 使用历史记录

#### 1. 获取执行历史

```typescript
// 运行工作流并获取历史记录
const history = await workflow.run({ actions });

// 历史记录是一个数组，包含所有运行的记录
console.log('执行历史:', history);
```

#### 2. 断点续跑

```typescript
// 第一次运行
const history1 = await workflow.run({ actions });

// 基于上次的历史记录继续运行
const history2 = await workflow.run({ 
  actions,
  history: history1,  // 传入历史记录
  entry: 'failedStep' // 从指定步骤开始
});
```

#### 3. 选择性重试

```typescript
// 第一次运行
const history1 = await workflow.run({ actions });

// 只重试特定的步骤（即使它们的依赖不满足）
const history2 = await workflow.run({
  actions,
  history: history1,  // 传入历史记录以获取上下文
  onlyRuns: ['step2', 'step3']  // 只运行指定的步骤
});
```

### 历史记录的特点

1. **完整追踪**：记录每个步骤的输入、输出、执行时间和状态
2. **上下文快照**：保存执行时的完整上下文，便于调试和重试
3. **断点续跑**：可以从任意步骤继续执行工作流
4. **选择性重试**：可以只重试特定的步骤，跳过依赖检查
5. **错误恢复**：当工作流失败时，可以从失败点继续执行

### 最佳实践

1. **持久化存储**：将历史记录保存到数据库或文件系统，以便后续分析和重试
2. **定期清理**：设置历史记录的保留策略，避免占用过多存储空间
3. **监控告警**：监控工作流的执行状态，对失败的工作流设置告警
4. **版本控制**：对工作流定义进行版本控制，确保历史记录与工作流定义的一致性

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

## 高级特性

### 选择性执行 (onlyRuns)

使用 `onlyRuns` 选项可以只运行指定的步骤，同时保留完整的上下文：

```typescript
// 第一次完整运行
const history = await workflow.run({ actions });

// 只运行特定步骤（使用历史上下文）
await workflow.run({ 
  actions,
  history,
  onlyRuns: ["step2", "step3"]  // 只运行这些步骤
});
```

特点：
- 自动从历史记录中恢复上下文
- 跳过依赖检查，直接运行指定步骤
- 适合调试和部分重试场景

### 执行记录

工作流执行后返回详细的执行记录：

```typescript
interface StepExecutionRecord {
  step: Step;                    // 步骤定义
  startTime: string;             // 开始时间
  endTime: string;               // 结束时间
  duration: number;              // 执行时长(毫秒)
  status: 'pending' | 'running' | 'success' | 'failed';
  options?: Record<string, any>; // 步骤配置
  inputs: any;                   // 输入参数
  outputs?: any;                 // 输出结果
  onlyRun: boolean;              // 是否在 onlyRuns 模式下运行
  error?: {                      // 错误信息
    message: string;
    stack?: string;
  };
  context: any;                  // 执行时的上下文快照
}
```

## 最佳实践

### 性能优化

1. **并行执行**：无依赖关系的步骤会自动并行执行
2. **依赖缓存**：使用高效的依赖解析算法
3. **最小化上下文更新**：使用代理模式监听数据变化
4. **选择性执行**：使用 `onlyRuns` 进行部分重试

### 调试技巧

1. 设置 `logLevel: LogLevel.DEBUG` 获取详细日志
2. 使用 `onlyRuns` 进行局部调试
3. 检查执行记录中的上下文状态

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
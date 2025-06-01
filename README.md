# Runback

<p align="center">
  <img src="images/runback-cropped.png" alt="Runback Logo" height="200">
</p>

<p align="center">
  <strong>渐进式工作流框架</strong>
</p>

<p align="center">
  <a href="#特性">特性</a> •
  <a href="#安装">安装</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#工作流构建模式">工作流构建模式</a> •
  <a href="#api参考">API参考</a> •
  <a href="#最佳实践">最佳实践</a>
</p>

<div align="center">

  ![CI](https://github.com/livoras/runback/actions/workflows/ci-test.yml/badge.svg)
  ![GitHub last commit](https://img.shields.io/github/last-commit/livoras/confow)
  <!-- ![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2022-green)
  ![Electron Version](https://img.shields.io/badge/electron-%3E%3D%2035-green) -->
  <!-- ![npm Version](https://img.shields.io/badge/npm-%3E%3D%208-red) -->
  
</div>

## 简介

Runback 是一个渐进式工作流框架，其核心理念是"结果即流程"。

与传统工作流系统需要预先定义整个流程不同，Runback 允许开发者从任意结果反推工作流。框架会自动记录每个动作（action）的运行结果，你可以随时基于感兴趣的结果进行下一步操作。当你得到想要的结果时，工作流的编排也自动完成了。

这种工作方式让你不需要过于关注编排本身，而是关注感兴趣的任意结果，以一种充满创造性的方式逐步构建流程。

## 安装

```bash
npm install runback
```

## 快速开始

**1. 第一个地方：创建并添加初始步骤**
```typescript
// 定义动作
const actions = {
  'fetchUser': async (options) => {
    // 模拟从API获取用户数据
    return { user: { id: options.userId, name: "John Doe" } };
  },
  'processUser': async (options) => {
    // 处理用户数据
    return { 
      processed: {
        ...options.user,
        status: 'processed',
        timestamp: new Date().toISOString()
      }
    };
  },
  'generateReport': async (options) => {
    // 生成报告
    return {
      report: `User ${options.processed.name} processed at ${options.processed.timestamp}`
    };
  }
};

// 创建并添加初始步骤
const work = new Work(actions, 'user-workflow.json');
await work.load(); // 加载历史记录（如果有的话）

await work.step({
  id: 'step1',
  action: 'fetchUser',
  options: { userId: '123' }  // 使用固定参数
});
```

**2. 第二个地方：继续构建工作流**
```typescript
// 加载之前的工作流
const work = new Work(actions, 'user-workflow.json');
await work.load(); // 加载包含 step1 步骤的工作流

// 添加处理步骤
await work.step({
  id: 'processUser',
  action: 'processUser',
  options: { user: '$ref.step1.user' }  // 引用上一步的结果
});

// 添加报告生成步骤
await work.step({
  id: 'createReport',
  action: 'generateReport',
  options: { processed: '$ref.processUser.processed' }  // 引用上一步的结果
});
```

**3. 第三个地方：执行工作流**
```typescript
// 加载完整的工作流
const work = new Work(actions, 'user-workflow.json');
await work.load();

// 执行整个工作流，指定入口步骤和参数
await work.run({ 
  entry: 'step1', 
  entryOptions: { userId: '124' }  // 动态传入参数，会覆盖 step1 中的固定参数
});
```

这个示例展示了 Runback 的核心特性：
1. 可以在不同地方逐步构建工作流
2. 每个步骤的结果可以被后续步骤引用
3. 工作流状态会自动保存到文件
4. 可以通过 `work.run()` 动态指定入口步骤和参数

## 特性

### 1. 渐进式构建与执行

在传统工作流系统中，通常需要预先定义整个工作流，然后一次性执行。而 Runback 允许你按需添加和执行步骤，这带来了极大的灵活性。

**核心机制**：
- 通过 `work.step()` 方法添加并选择性地执行单个步骤
- 每个步骤有唯一的ID，可以独立执行
- 步骤执行后会更新工作流状态
- 可以通过 `run` 参数控制是否立即执行步骤

### 2. 结果保存与引用

每个步骤的执行结果都会被保存，并可以通过特殊的引用语法被后续步骤使用。

**引用机制**：
- 使用 `$ref.步骤ID.属性路径` 语法引用之前步骤的结果
- 支持嵌套属性访问
- 在循环中可以使用 `$ref.$item` 引用当前迭代项

### 3. 状态持久化

Runback 会自动保存工作流状态到文件，包括所有步骤定义和最后一次运行的历史记录。你可以随时通过 `work.load()` 方法从文件加载工作流状态，继续构建或执行。

## 工作流构建模式

Runback 支持两种工作流构建模式：

### 1. 渐进式构建模式

通过 `work.step(step, true)` 添加步骤并立即执行，这样可以一步一步地构建和执行工作流，每一步都会立即产生结果，可以根据当前结果决定下一步操作。

```typescript
// 添加并立即执行步骤
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
}, true); // true 是默认值，可以省略
```

### 2. 编排构建模式

通过 `work.step(step, false)` 添加步骤但不立即执行，这样可以先定义整个工作流的结构，然后再通过 `work.run()` 一次性执行所有步骤。

```typescript
// 只添加步骤，不立即执行
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
}, false);

await work.step({
  id: 'processData',
  action: 'processData',
  options: {
    message: '$ref.getData.message'
  }
}, false);

// 一次性执行所有步骤，必须指定入口步骤
await work.run({ 
  entry: 'getData',  // 指定入口步骤
  actions: work.actions 
});
```

## 运行工作流

### 1. 指定运行起点

Runback 支持从任意步骤开始运行工作流。通过 `work.run({ entry: 'stepId' })` 指定入口步骤，系统会自动执行该步骤及其所有依赖步骤。

```typescript
// 从 step1 开始运行
await work.run({ 
  entry: 'step1'  // 必须指定入口步骤
});

// 从 processData 开始运行
await work.run({ 
  entry: 'processData'  // 可以从任意步骤开始
});
```

### 2. 运行参数

通过 `entryOptions` 可以在运行时动态覆盖入口步骤的参数。这对于需要根据不同场景调整参数的情况特别有用。

```typescript
// 定义步骤时使用固定参数
await work.step({
  id: 'step1',
  action: 'fetchUser',
  options: { userId: '123' }  // 固定参数
});

// 运行时覆盖参数
await work.run({ 
  entry: 'step1',
  entryOptions: { userId: '456' }  // 动态参数会覆盖固定参数
});
```

### 3. 指定步骤运行

使用 `onlyRuns` 模式可以直接指定要运行的步骤，不需要指定入口步骤。如果这些步骤依赖其他步骤的数据，系统会自动从历史记录中加载。

```typescript
// 只运行特定的步骤
await work.run({ 
  onlyRuns: ['processData', 'generateReport']  // 直接指定要运行的步骤
});
```

### 4. 断点运行

通过 `resume` 参数可以加载上次运行的完整上下文，这样从任意入口步骤开始运行时，都可以访问到上次运行的所有结果。这对于需要基于上次运行结果继续处理的情况特别有用。

```typescript
// 可以从上次运行结果中的任意步骤开始
await work.run({ 
  entry: 'processData', 
  resume: true // 使用上次运行的数据
});
```

## 控制流

### 1. 条件（if）

Runback 支持通过 `type: 'if'` 来创建条件分支。条件步骤会返回一个布尔值，后续步骤可以通过 `depends` 属性指定在条件为 true 或 false 时执行。

```typescript
// 定义动作
const actions = {
  'fetchUser': async (options) => {
    // 模拟从API获取用户数据
    return { 
      user: { 
        id: options.userId, 
        name: "John Doe",
        role: "admin"  // 用户角色
      } 
    };
  },
  'checkPermission': async (options) => {
    // 检查用户权限
    return options.user.role === 'admin';
  },
  'processAdminTask': async (options) => {
    // 处理管理员任务
    return { 
      message: `Admin ${options.user.name} processed task successfully` 
    };
  },
  'handleNoPermission': async (options) => {
    // 处理无权限情况
    return { 
      error: `User ${options.user.name} has no permission to perform this task` 
    };
  }
};

// 创建工作流
const work = new Work(actions, 'permission-workflow.json');
await work.load();

// 1. 获取用户信息
await work.step({
  id: 'getUser',
  action: 'fetchUser',
  options: { userId: '123' }
});

// 2. 检查权限（条件步骤）
await work.step({
  id: 'checkPermission',
  action: 'checkPermission',
  options: { user: '$ref.getUser.user' },
  type: 'if'  // 标记为条件步骤
});

// 3. 根据权限执行不同操作
await work.step({
  id: 'processAdminTask',
  action: 'processAdminTask',
  options: { user: '$ref.getUser.user' },
  depends: ['checkPermission.true']  // 只在权限检查通过时执行
});

await work.step({
  id: 'handleNoPermission',
  action: 'handleNoPermission',
  options: { user: '$ref.getUser.user' },
  depends: ['checkPermission.false']  // 只在权限检查失败时执行
});

// 执行工作流，指定入口步骤
await work.run({ entry: 'getUser' });
```

在这个例子中：
1. `checkPermission` 步骤被标记为条件步骤（`type: 'if'`）
2. 条件步骤会返回一个布尔值（true/false）
3. 后续步骤通过 `depends` 属性指定在什么条件下执行：
   - `checkPermission.true` 表示在条件为 true 时执行
   - `checkPermission.false` 表示在条件为 false 时执行
4. 工作流会根据条件自动选择执行路径

### 2. 数组处理（each）

Runback 支持通过 `each` 属性对数组数据进行迭代处理。在迭代步骤中，可以使用 `$ref.$item` 引用当前迭代项，使用 `$ref.$index` 引用当前索引。

```typescript
// 定义动作
const actions = {
  'fetchUsers': async () => {
    // 模拟从API获取用户列表
    return { 
      users: [
        { id: '1', name: 'Alice', score: 85 },
        { id: '2', name: 'Bob', score: 92 },
        { id: '3', name: 'Charlie', score: 78 }
      ]
    };
  },
  'processUser': async (options) => {
    // 处理单个用户数据
    const { user, index } = options;
    return {
      id: user.id,
      name: user.name,
      grade: user.score >= 90 ? 'A' : user.score >= 80 ? 'B' : 'C',
      rank: index + 1
    };
  },
  'generateReport': async (options) => {
    // 生成汇总报告
    const { processedUsers } = options;
    const gradeCount = {
      A: processedUsers.filter(u => u.grade === 'A').length,
      B: processedUsers.filter(u => u.grade === 'B').length,
      C: processedUsers.filter(u => u.grade === 'C').length
    };
    return {
      totalUsers: processedUsers.length,
      gradeDistribution: gradeCount,
      users: processedUsers
    };
  }
};

// 创建工作流
const work = new Work(actions, 'user-processing.json');
await work.load();

// 1. 获取用户列表
await work.step({
  id: 'getUsers',
  action: 'fetchUsers',
  options: {}
});

// 2. 对每个用户进行处理
await work.step({
  id: 'processUsers',
  action: 'processUser',
  each: '$ref.getUsers.users',  // 遍历用户数组
  options: {
    user: '$ref.$item',        // 引用当前用户
    index: '$ref.$index'       // 引用当前索引
  }
});

// 3. 生成汇总报告
await work.step({
  id: 'createReport',
  action: 'generateReport',
  options: {
    processedUsers: '$ref.processUsers'  // 引用处理后的用户数组
  }
});

// 执行工作流
await work.run({ entry: 'getUsers' });
```

在这个例子中：
1. `processUsers` 步骤通过 `each` 属性指定要遍历的数组
2. 在迭代步骤中：
   - `$ref.$item` 引用当前正在处理的用户对象
   - `$ref.$index` 引用当前处理的索引位置
3. 迭代步骤的结果会自动合并为一个数组
4. 后续步骤可以直接引用整个处理后的数组

### 3. 并行和合并

Runback 的步骤执行机制是基于依赖关系的自动并行执行。只要一个步骤的所有依赖步骤都完成了，这个步骤就会立即执行，不需要手动处理并行和合并逻辑。

```typescript
// 定义动作
const actions = {
  'fetchData': async () => {
    // 模拟获取数据
    return { data: "原始数据" };
  },
  'processA': async (options) => {
    // 处理数据的方式 A
    return { result: `A处理: ${options.data}` };
  },
  'processB': async (options) => {
    // 处理数据的方式 B
    return { result: `B处理: ${options.data}` };
  },
  'combineResults': async (options) => {
    // 合并处理结果
    return {
      finalResult: `合并结果: ${options.resultA.result}, ${options.resultB.result}`
    };
  }
};

// 创建工作流
const work = new Work(actions, 'parallel-workflow.json');
await work.load();

// 1. 获取数据
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
});

// 2. 并行处理数据（两个处理步骤都依赖 getData）
await work.step({
  id: 'processA',
  action: 'processA',
  options: { data: '$ref.getData.data' }
});

await work.step({
  id: 'processB',
  action: 'processB',
  options: { data: '$ref.getData.data' }
});

// 3. 合并结果（依赖两个处理步骤）
await work.step({
  id: 'combine',
  action: 'combineResults',
  options: {
    resultA: '$ref.processA',
    resultB: '$ref.processB'
  }
});

// 执行工作流
await work.run({ entry: 'getData' });
```

在这个例子中：
1. `processA` 和 `processB` 都依赖 `getData` 的结果
2. 当 `getData` 完成后，`processA` 和 `processB` 会自动并行执行
3. 当 `processA` 和 `processB` 都完成后，`combine` 步骤会自动执行
4. 整个过程不需要手动处理并行和合并逻辑

### 4. 分支汇聚

在条件分支场景中，Runback 支持通过逗号分隔的引用路径来实现分支汇聚。当使用逗号分隔多个引用时，系统会尝试按顺序获取这些值，返回第一个成功获取到的值。这个特性在处理条件分支的结果汇聚时特别有用。

```typescript
// 定义动作
const actions = {
  'checkUser': async (options) => {
    // 检查用户状态
    return options.userId === 'admin';
  },
  'processAdmin': async (options) => {
    // 处理管理员逻辑
    return { message: "管理员处理完成" };
  },
  'processNormalUser': async (options) => {
    // 处理普通用户逻辑
    return { message: "普通用户处理完成" };
  },
  'mergeResult': async (options) => {
    // 合并处理结果
    return {
      finalMessage: options.result,
      timestamp: new Date().toISOString()
    };
  }
};

// 创建工作流
const work = new Work(actions, 'branch-workflow.json');
await work.load();

// 1. 检查用户类型（条件步骤）
await work.step({
  id: 'checkUser',
  action: 'checkUser',
  options: { userId: 'admin' },
  type: 'if'
});

// 2. 根据用户类型处理（两个分支）
await work.step({
  id: 'processAdmin',
  action: 'processAdmin',
  options: {},
  depends: ['checkUser.true']
});

await work.step({
  id: 'processNormalUser',
  action: 'processNormalUser',
  options: {},
  depends: ['checkUser.false']
});

// 3. 合并分支结果
await work.step({
  id: 'mergeResult',
  action: 'mergeResult',
  options: {
    // 使用逗号分隔的引用，系统会返回第一个成功获取到的值
    result: '$ref.processAdmin.message,$ref.processNormalUser.message'
  }
});

// 执行工作流
await work.run({ entry: 'checkUser' });
```

在这个例子中：
1. `checkUser` 步骤根据用户ID返回 true/false
2. 根据条件结果，会执行 `processAdmin` 或 `processNormalUser` 其中一个步骤
3. `mergeResult` 步骤使用逗号分隔的引用：
   - `$ref.processAdmin.message,$ref.processNormalUser.message`
   - 如果用户是管理员，会获取到 `processAdmin.message` 的值
   - 如果用户是普通用户，会获取到 `processNormalUser.message` 的值
4. 系统会自动处理分支汇聚，不需要手动判断哪个分支被执行

## API参考

### Work 类

```typescript
class Work {
  constructor(actions?: Record<string, Function>, savePath?: string);
  
  // 核心方法
  async step(step: Step, run: boolean = true): Promise<any>;  // 添加单个步骤，并可选择是否立即执行
  async run(options: RunOptions): Promise<RunHistoryRecord[]>;  // 执行整个工作流
  
  // 状态管理
  async load(path?: string): Promise<void>;  // 加载工作流状态
}
```

### Step 接口

```typescript
interface Step {
  id: string;  // 步骤唯一标识符
  action: string;  // 要执行的动作名称
  type?: "if";  // 步骤类型，'if' 表示条件步骤
  name?: string;  // 步骤名称
  options?: Record<string, any>;  // 传递给动作的参数
  depends?: string[];  // 依赖的步骤
  each?: string;  // 用于迭代的数据引用
}
```

### RunOptions 接口

```typescript
interface RunOptions {
  entry?: string;  // 入口步骤ID
  entryOptions?: any;  // 入口步骤的参数
  actions?: Record<string, Function>;  // 可执行的动作
  history?: RunHistoryRecord[];  // 历史记录
  onlyRuns?: string[];  // 只运行指定的步骤
  logLevel?: LogLevel;  // 日志级别
  resume?: boolean;  // 是否恢复执行
}
```

## 许可证

MIT
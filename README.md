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
const history = await work.run({ 
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

Runback 支持将当前工作流状态保存到文件，稍后再恢复并继续构建。

**持久化机制**：
- `work.save()` 方法将工作流状态保存到文件
- `work.load()` 方法从文件加载工作流状态
- 保存的内容包括所有步骤定义和最后一次运行的历史记录

## 控制流

### 条件（if）

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

### 数组处理（each）

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

### fork/join
TODO

## 工作流构建模式

Runback 支持两种工作流构建模式：

### 渐进式构建模式

通过 `work.step(step, true)` 添加步骤并立即执行，这样可以一步一步地构建和执行工作流，每一步都会立即产生结果，可以根据当前结果决定下一步操作。

```typescript
// 添加并立即执行步骤
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
}, true); // true 是默认值，可以省略
```

### 编排构建模式

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

// 一次性执行所有步骤
const history = await work.run({ actions: work.actions });
```

## 实际应用示例：数据处理管道

```typescript
// 定义动作
const actions = {
  'fetchData': async () => {
    return { text: "Hello, World! This is a test." };
  },
  'tokenize': async (options) => {
    return options.text.split(/\s+/);
  },
  'filter': async (word) => {
    return word.word.replace(/[.,!?]/g, '');
  },
  'count': async (options) => {
    return { 
      word: options.word,
      length: options.word.length
    };
  },
  'summarize': async (options) => {
    const lengths = options.items.map(item => item.length);
    const total = lengths.reduce((sum, len) => sum + len, 0);
    return {
      wordCount: options.items.length,
      averageLength: total / options.items.length,
      words: options.items.map(item => item.word)
    };
  }
};

// 创建工作流
const work = new Work(actions, 'text-processing.json');

// 第一阶段：获取数据并分词
await work.step({ id: 'getData', action: 'fetchData', options: {} });
await work.step({
  id: 'tokenize',
  action: 'tokenize',
  options: { text: '$ref.getData.text' }
});

// 保存当前状态
await work.save();

// 第二阶段：继续处理
await work.load();

// 对每个单词进行处理
await work.step({
  id: 'cleanWords',
  action: 'filter',
  each: '$ref.tokenize',
  options: { word: '$ref.$item' }
});

// 统计每个单词的长度
await work.step({
  id: 'wordLengths',
  action: 'count',
  each: '$ref.cleanWords',
  options: { word: '$ref.$item' }
});

// 生成汇总报告
await work.step({
  id: 'summary',
  action: 'summarize',
  options: { items: '$ref.wordLengths' }
});

// 查看最终结果
console.log(work.lastRun.results.summary);
```

## 适用场景

Runback 特别适合以下场景：

1. **长时间运行的数据处理任务**：可以分阶段执行，中间可以暂停和恢复
2. **需要人工干预的流程**：某些步骤可能需要人工审核或输入
3. **探索性数据分析**：可以根据前面步骤的结果动态决定后续步骤
4. **分布式任务处理**：不同的步骤可以在不同的时间或不同的机器上执行

## API参考

### Work 类

```typescript
class Work {
  constructor(actions?: Record<string, Function>, savePath?: string);
  
  // 核心方法
  async step(step: Step, run: boolean = true): Promise<any>;  // 添加单个步骤，并可选择是否立即执行
  async run(options: RunOptions): Promise<RunHistoryRecord[]>;  // 执行整个工作流
  
  // 状态管理
  async save(savePath?: string): Promise<void>;  // 保存工作流状态
  async load(path?: string): Promise<void>;  // 加载工作流状态
}
```

### Step 接口

```typescript
interface Step {
  id: string;  // 步骤唯一标识符
  action: string;  // 要执行的动作名称
  options?: any;  // 传递给动作的参数
  each?: string;  // 用于迭代的数据引用
  condition?: string;  // 执行条件
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
}
```

## 项目结构

- `src/` - 源代码目录
  - `work.ts` - 核心工作流引擎
  - `workflow.ts` - 工作流执行器
  - `ref.ts` - 引用处理
- `examples/` - 示例代码
- `docs/` - 文档
- `dist/` - 编译输出目录

## 许可证

MIT

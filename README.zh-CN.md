<p align="center">
  <img src="images/runback-cropped.png" alt="Runback Logo" height="200">
</p>

<p align="center">
  <strong>Runback·渐进式工作流框架</strong>
</p>

<p align="center">
  <a href="#特性">特性</a> •
  <a href="#安装">安装</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#工作流构建模式">工作流构建模式</a> •
  <a href="#运行工作流">运行工作流</a> •
  <a href="#控制流">控制流</a> •
  <a href="#api参考">API参考</a>
</p>

<div align="center">

  ![CI](https://github.com/livoras/runback/actions/workflows/ci-test.yml/badge.svg)
  ![GitHub last commit](https://img.shields.io/github/last-commit/livoras/confow)
  <!-- ![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2022-green)
  ![Electron Version](https://img.shields.io/badge/electron-%3E%3D%2035-green) -->
  <!-- ![npm Version](https://img.shields.io/badge/npm-%3E%3D%208-red) -->
  
</div>

## 简介

Runback 是一个渐进式工作流框架，其核心理念是"**结果即流程**"。

与传统工作流系统需要预先定义整个流程不同，Runback 允许开发者从任意结果反推工作流。框架会自动记录每个动作（action）的运行结果，你可以随时基于感兴趣的结果进行下一步操作。当你得到想要的结果时，工作流的编排也自动完成了。

这种工作方式让你不需要过于关注编排本身，而是关注感兴趣的任意结果，以一种充满创造性的方式逐步构建流程。

## 安装

```bash
npm install runback
```

## 快速开始

**1. 创建并添加初始步骤**
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

**2. 继续构建工作流**
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

**3. 执行工作流**
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
- **数组索引访问**：使用 `$ref.步骤ID[0].属性` 通过索引访问数组元素
- 支持**多重数组索引**：`$ref.步骤ID[0].items[1].name`
- 在循环中可以使用 `$ref.$item` 引用当前迭代项

**数组索引示例**：
```typescript
// 访问数组中的第一个用户
{ user: '$ref.getUserList[0]' }

// 访问第二个用户的邮箱
{ email: '$ref.getUserList[1].email' }

// 访问嵌套数组元素
{ value: '$ref.data[0].items[2].value' }

// 与逗号分隔的备选项结合
{ data: '$ref.primary[0].data,$ref.backup[1].data' }
```

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

Runback 支持三种不同的执行模式：

1. **入口驱动**：`run({ entry: 'stepId' })` - 从特定步骤开始，执行所有依赖
2. **退出驱动**：`run({ exit: 'stepId' })` - 指定期望的最终结果，让系统找到最优路径
3. **选择执行**：`run({ onlyRuns: [...] })` - 直接执行指定的步骤

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

### 3. 指定结束

通过 `exit` 参数指定工作流的结束节点。当执行到指定节点时，工作流立即停止。结合"结果即流程"的理念，当得到满意的结果时可以反推工作流。

**退出驱动执行**：当只指定 `exit`（不指定 `entry`）时，Runback 会自动：
1. **反向追踪依赖关系**，找到退出节点的所有根步骤
2. **过滤执行路径**，只包含到达退出节点必需的步骤
3. **从根步骤开始**，执行到退出节点为止

```typescript
// 传统方式 - 同时指定入口和退出
await work.run({ 
  entry: 'startProcess',
  exit: 'generateImage'  // 当这个步骤的结果满足需求时，工作流将在此终止
});

// 退出驱动方式 - 只指定退出，让系统找到路径
await work.run({ 
  exit: 'generateImage'  // 系统自动找到根步骤和执行路径
});

// 示例：包含多个分支的复杂工作流
const workflow = new Workflow({
  steps: [
    { id: 'fetchData', action: 'fetchData' },
    { id: 'processA', action: 'processA', depends: ['fetchData'] },
    { id: 'processB', action: 'processB', depends: ['fetchData'] },
    { id: 'unrelatedTask', action: 'unrelated', depends: ['fetchData'] }, // 不会运行
    { id: 'mergeResults', action: 'merge', depends: ['processA', 'processB'] }
  ]
});

// 只运行：fetchData -> processA -> processB -> mergeResults
// 跳过：unrelatedTask（不在到达 mergeResults 的路径中）
await workflow.run({ exit: 'mergeResults' });
```

**主要优势**：
- **高效执行**：只运行到达期望结果必需的步骤
- **自动路径发现**：无需手动追踪依赖关系
- **多根节点支持**：处理具有多个起始点的工作流
- **"结果即流程"**：专注于期望的结果，让系统确定路径

### 4. 指定步骤运行

使用 `onlyRuns` 模式可以直接指定要运行的步骤，不需要指定入口步骤。如果这些步骤依赖其他步骤的数据，系统会自动从历史记录中加载。

```typescript
// 只运行特定的步骤
await work.run({ 
  onlyRuns: ['processData', 'generateReport']  // 直接指定要运行的步骤
});
```

### 5. 断点运行

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

### 2. 分支汇聚

在条件分支场景中，Runback 支持通过依赖语法来实现分支汇聚。框架支持 **AND** 和 **OR** 两种关系：

- **AND 关系**：`depends: ['stepA', 'stepB']` - 等待所有步骤完成
- **OR 关系**：`depends: ['stepA,stepB']` - 等待任意步骤完成（单个字符串中用逗号分隔）

```typescript
// 1. 获取用户信息
await work.step({
  id: 'getUser',
  action: 'fetchUser',
  options: { userId: '123' }
});

// 2. 检查用户状态（条件步骤）
await work.step({
  id: 'checkStatus',
  action: 'checkUserStatus',
  options: { user: '$ref.getUser.user' },
  type: 'if'  // 标记为条件步骤
});

// 3. 根据不同状态执行不同操作
await work.step({
  id: 'processActiveUser',
  action: 'processActiveUser',
  options: { user: '$ref.getUser.user' },
  depends: ['checkStatus.true']  // 用户活跃时执行
});

await work.step({
  id: 'sendWelcomeBack',
  action: 'sendWelcomeBack',
  options: { user: '$ref.getUser.user' },
  depends: ['checkStatus.false']  // 用户不活跃时执行
});

// 4. 使用 OR 依赖的分支汇聚 - 任意前置步骤完成后执行
await work.step({
  id: 'logUserActivity',
  action: 'logActivity',
  options: { 
    userId: '$ref.getUser.user.id',
    timestamp: new Date().toISOString()
  },
  depends: ['processActiveUser,sendWelcomeBack']  // OR：任意一个步骤完成后执行
});

// 替代方案：AND 依赖 - 所有前置步骤完成后执行
await work.step({
  id: 'logAllActivity',
  action: 'logAllActivity',
  options: { 
    userId: '$ref.getUser.user.id',
    timestamp: new Date().toISOString()
  },
  depends: ['processActiveUser', 'sendWelcomeBack']  // AND：等待两个步骤都完成
});

// 5. 继续后续处理
await work.step({
  id: 'continueProcessing',
  action: 'continueWorkflow',
  options: {},
  depends: ['logUserActivity']  // 等待日志记录完成
});
```

在这个例子中：
1. **条件执行**：根据状态只会执行 `processActiveUser` 或 `sendWelcomeBack` 其中一个
2. **OR 合并**：`logUserActivity` 使用 `['processActiveUser,sendWelcomeBack']`（逗号分隔）在完成的分支结束后执行
3. **AND 合并**：`logAllActivity` 使用 `['processActiveUser', 'sendWelcomeBack']`（分离的数组元素）等待两者都完成（虽然在条件场景中只会执行其中一个）
4. **灵活合并**：条件分支选择 OR，并行执行场景选择 AND

### 3. 数组处理（each）

Runback 支持通过 `each` 属性对数组数据进行迭代处理。`each` 字段支持两种形式：

1. **引用形式**：`each: '$ref.步骤ID.数组属性'` - 引用之前步骤的数组数据
2. **直接数组形式**：`each: [...]` - 直接使用字面量数组

在迭代步骤中，可以使用 `$ref.$item` 引用当前迭代项，使用 `$ref.$index` 引用当前索引。

#### 使用引用数组

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

#### 使用直接数组

你也可以直接在 `each` 字段中使用数组，而无需引用之前步骤的结果：

```typescript
// 定义动作
const actions = {
  'processItem': async (item) => {
    // 当没有提供 options 时，item 会直接作为参数传递
    return `processed-${item}`;
  },
  'processWithOptions': async (options) => {
    // 当提供了 options 时，使用原有的行为
    return `processed-${options.value}-with-index-${options.index}`;
  }
};

// 创建工作流
const work = new Work(actions, 'direct-array-workflow.json');
await work.load();

// 1. 直接使用数组处理项目 - 没有 options，item 直接作为参数传递
await work.step({
  id: 'processItems',
  action: 'processItem',
  each: ['apple', 'banana', 'orange']  // 直接数组，不需要依赖分析
  // 没有 options - 每个 item 会直接传递给 action
});

// 2. 使用 options 处理项目
await work.step({
  id: 'processWithOptions',
  action: 'processWithOptions',
  each: [10, 20, 30],  // 直接数组
  options: {
    value: '$ref.$item',    // 引用当前项目
    index: '$ref.$index'    // 引用当前索引
  }
});

// 3. 使用数组索引语法处理特定数组元素
await work.step({
  id: 'processSpecificElements',
  action: 'processSpecificData',
  options: {
    firstItem: '$ref.processItems[0]',      // 访问第一个处理后的项目
    lastItem: '$ref.processWithOptions[2]', // 访问第三个处理后的项目
    combined: '$ref.processItems[0],$ref.processWithOptions[1]' // 组合特定元素
  }
});

// 执行工作流
await work.run({ entry: 'processItems' });
```

#### 主要特性：

1. **引用数组**：`each: '$ref.步骤ID.数组属性'` - 引用之前步骤的数组数据
2. **直接数组**：`each: [...]` - 直接使用字面量数组，不需要依赖分析
3. **简化参数传递**：当没有提供 `options` 时，当前项目会直接作为 action 的参数传递
4. **标准参数传递**：当提供了 `options` 时，使用 `$ref.$item` 和 `$ref.$index` 引用当前项目和索引
5. **自动结果合并**：迭代步骤的结果会自动合并为一个数组
6. **后续引用**：后续步骤可以直接引用整个处理后的数组

在这些例子中：
1. 直接数组不需要依赖分析，可以立即使用
2. 当没有指定 `options` 时，每个项目会直接传递给 action 函数
3. 当指定了 `options` 时，使用传统的 `$ref.$item` 和 `$ref.$index` 引用
4. 两种方式都支持任意数据类型：字符串、数字、对象、数组等

### 4. 并行和合并

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

### 5. 分支合并

在条件分支场景中，Runback 支持通过逗号分隔的引用路径来实现分支汇聚。当使用条件分支（if）时，只会执行满足条件的分支，而合并节点会在任意一个分支完成时触发，不需要等待所有分支都完成。

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

// 2. 根据用户类型处理（两个分支，只会执行其中一个）
await work.step({
  id: 'processAdmin',
  action: 'processAdmin',
  options: {},
  depends: ['checkUser.true']  // 只有 checkUser 返回 true 时才会执行
});

await work.step({
  id: 'processNormalUser',
  action: 'processNormalUser',
  options: {},
  depends: ['checkUser.false']  // 只有 checkUser 返回 false 时才会执行
});

// 3. 合并分支结果 - 任意一个分支完成就会触发
await work.step({
  id: 'mergeResult',
  action: 'mergeResult',
  options: {
    // 使用逗号分隔的引用，系统会返回第一个成功获取到的值
    // 由于条件分支只会执行其中一个，所以这里会获取到实际执行的那个分支的结果
    result: '$ref.processAdmin.message,$ref.processNormalUser.message'
  }
});

// 执行工作流
await work.run({ entry: 'checkUser' });
```

在这个例子中：
1. `checkUser` 步骤根据用户ID返回 true/false
2. 根据条件结果，只会执行 `processAdmin` 或 `processNormalUser` 其中一个步骤：
   - 如果用户是管理员（checkUser 返回 true），只会执行 processAdmin
   - 如果用户是普通用户（checkUser 返回 false），只会执行 processNormalUser
3. `mergeResult` 步骤使用逗号分隔的引用：
   - `$ref.processAdmin.message,$ref.processNormalUser.message`
   - 由于条件分支只会执行其中一个，所以这里会获取到实际执行的那个分支的结果
   - 合并节点不关心是哪个分支触发的，只要任意一个分支完成就会执行
4. 重要特性：条件分支只会执行其中一个，而合并节点在任意分支完成时都会触发

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
  each?: string | any[];  // 用于迭代的数据引用或直接数组
}
```

### RunOptions 接口

```typescript
interface RunOptions {
  entry?: string;  // 入口步骤ID
  exit?: string;  // 退出步骤ID，用于退出驱动执行
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
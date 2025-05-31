# 渐进式构建工作流

## 概述

渐进式构建工作流是 Runback 框架的核心特性之一，它允许用户以灵活的方式逐步构建、执行和管理工作流。与传统工作流系统不同，渐进式工作流不需要预先定义整个流程，而是可以随时添加、执行和保存步骤，为复杂任务处理提供了更大的灵活性。

## 核心特性

### 1. 工作流可以一步一步地构建和执行

在传统工作流系统中，通常需要预先定义整个工作流，然后一次性执行。而渐进式构建工作流允许你按需添加和执行步骤，这带来了极大的灵活性。

**核心机制**：
- 通过 `work.step()` 方法添加并立即执行单个步骤
- 每个步骤有唯一的ID，可以独立执行
- 步骤执行后会更新工作流状态

**示例**：

```typescript
// 创建工作流实例
const work = new Work({
  'fetchData': async (options) => {
    // 模拟API调用
    return { users: ['用户1', '用户2', '用户3'] };
  }
}, 'workflow-state.json');

// 添加并执行第一个步骤
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: { source: 'api' }
});

// 此时可以暂停，稍后再继续添加步骤
// ...

// 稍后再添加并执行下一个步骤
await work.step({
  id: 'processData',
  action: 'processUsers',
  options: { data: '$ref.getData.users' }
});
```

### 2. 每个步骤的结果会保存下来，供后续步骤引用

这是渐进式工作流的关键特性之一，每个步骤的执行结果都会被保存，并可以通过特殊的引用语法被后续步骤使用。

**引用机制**：
- 使用 `$ref.步骤ID.属性路径` 语法引用之前步骤的结果
- 支持嵌套属性访问
- 在循环中可以使用 `$ref.$item` 引用当前迭代项

**示例**：

```typescript
// 第一个步骤：获取数据
await work.step({
  id: 'fetchUsers',
  action: 'apiCall',
  options: { endpoint: '/users' }
});
// 假设结果是: { data: ['Alice', 'Bob', 'Charlie'] }

// 第二个步骤：引用第一个步骤的结果
await work.step({
  id: 'formatUsers',
  action: 'formatNames',
  options: { 
    names: '$ref.fetchUsers.data',  // 引用前一步骤的data属性
    prefix: 'User: '
  }
});
// 假设结果是: { formattedNames: ['User: Alice', 'User: Bob', 'User: Charlie'] }

// 第三个步骤：对第二步的结果进行迭代处理
await work.step({
  id: 'sendEmails',
  action: 'sendEmail',
  each: '$ref.formatUsers.formattedNames',  // 遍历这个数组
  options: {
    recipient: '$ref.$item'  // 引用当前迭代项
  }
});
```

### 3. 可以随时保存当前状态，下次继续构建

渐进式工作流的另一个重要特性是状态持久化，可以将当前工作流状态保存到文件，稍后再恢复并继续构建。

**持久化机制**：
- `work.save()` 方法将工作流状态保存到文件
- `work.load()` 方法从文件加载工作流状态
- 保存的内容包括所有步骤定义和最后一次运行的历史记录

**示例**：

```typescript
// 创建工作流并设置保存路径
const work = new Work(actions, 'my-workflow.json');

// 添加并执行一些步骤
await work.step({ id: 'step1', action: 'doSomething', options: {...} });
await work.step({ id: 'step2', action: 'doSomethingElse', options: {...} });

// 保存当前状态
await work.save();

// 在另一个时间或另一个进程中
const newWork = new Work(actions, 'my-workflow.json');
// 加载之前保存的状态
await newWork.load();

// 继续添加新步骤
await newWork.step({ id: 'step3', action: 'finalStep', options: {...} });
```

## 实际应用示例：数据处理管道

下面是一个完整的例子，展示如何使用渐进式工作流构建一个数据处理管道：

```typescript
// 定义动作
const actions = {
  'fetchData': async () => {
    // 模拟获取原始数据
    return { text: "Hello, World! This is a test." };
  },
  'tokenize': async (options) => {
    // 将文本分割成单词
    return options.text.split(/\s+/);
  },
  'filter': async (word) => {
    // 过滤掉标点符号
    return word.word.replace(/[.,!?]/g, '');
  },
  'count': async (options) => {
    // 统计单词长度
    return { 
      word: options.word,
      length: options.word.length
    };
  },
  'summarize': async (options) => {
    // 汇总统计
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

// 第一天：获取数据并分词
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
});

await work.step({
  id: 'tokenize',
  action: 'tokenize',
  options: {
    text: '$ref.getData.text'
  }
});

// 保存当前状态
await work.save();

// 第二天：继续处理
await work.load();

// 对每个单词进行处理
await work.step({
  id: 'cleanWords',
  action: 'filter',
  each: '$ref.tokenize',
  options: {
    word: '$ref.$item'
  }
});

// 统计每个单词的长度
await work.step({
  id: 'wordLengths',
  action: 'count',
  each: '$ref.cleanWords',
  options: {
    word: '$ref.$item'
  }
});

// 生成汇总报告
await work.step({
  id: 'summary',
  action: 'summarize',
  options: {
    items: '$ref.wordLengths'
  }
});

// 查看最终结果
console.log(work.lastRun.results.summary);
```

在这个例子中：
1. 我们首先获取文本数据并分词
2. 然后保存状态，可以暂停处理
3. 稍后恢复状态，继续处理每个单词
4. 最后生成汇总报告

整个过程可以分散在不同的时间点完成，每一步都可以独立执行，且后续步骤可以引用前面步骤的结果。

## 适用场景

渐进式构建工作流特别适合以下场景：

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
  async step(step: Step): Promise<any>;  // 执行单个步骤
  async run(options: RunOptions): Promise<RunHistoryRecord[]>;  // 执行整个工作流
  
  // 状态管理
  async save(savePath?: string): Promise<void>;  // 保存工作流状态
  async load(path?: string): Promise<void>;  // 加载工作流状态
  json(): any;  // 将工作流序列化为JSON
  
  // 其他方法
  init(): void;  // 初始化步骤映射
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

## 最佳实践

1. **为步骤指定有意义的ID**：使用描述性的ID有助于理解工作流结构
2. **合理组织动作函数**：将相关功能封装到独立的动作中
3. **定期保存工作流状态**：特别是在执行耗时步骤之前
4. **使用条件执行**：通过 `condition` 属性控制步骤是否执行
5. **利用迭代处理**：对数组数据使用 `each` 属性进行批量处理

## 结论

渐进式构建工作流提供了一种灵活、可扩展的方式来处理复杂任务。通过逐步构建、状态保存和数据引用机制，它使得工作流开发变得更加直观和高效。无论是简单的数据处理还是复杂的业务流程，渐进式工作流都能提供强大的支持。

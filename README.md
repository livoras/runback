# Runback

<p align="center">
  <img src="images/runback-cropped.png" alt="Runback Logo" width="200" height="200">
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

## 安装

```bash
npm install runback
```

## 快速开始

```typescript
import { Work } from 'runback';

// 定义动作
const actions = {
  'fetchData': async () => {
    return { message: "Hello, Runback!" };
  },
  'processData': async (options) => {
    return { processed: options.message.toUpperCase() };
  }
};

// 创建工作流
const work = new Work(actions, 'my-workflow.json');

// 添加并执行步骤
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
});

await work.step({
  id: 'processData',
  action: 'processData',
  options: {
    message: '$ref.getData.message'
  }
});

// 查看结果
console.log(work.lastRun.results.processData);
// 输出: { processed: "HELLO, RUNBACK!" }

// 保存工作流状态
await work.save();
```

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
  json(): any;  // 将工作流序列化为JSON
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

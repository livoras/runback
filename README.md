<p align="center">
  <img src="https://github.com/livoras/runback/blob/main/images/runback-cropped.png" alt="Runback Logo" height="200">
</p>

<p align="center">
  <strong>Runback·Progressive Workflow Framework</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#workflow-building-patterns">Workflow Building Patterns</a> •
  <a href="#running-workflows">Running Workflows</a> •
  <a href="#control-flow">Control Flow</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="README.zh-CN.md">中文文档</a>
</p>

<div align="center">

  ![CI](https://github.com/livoras/runback/actions/workflows/ci-test.yml/badge.svg)
  ![GitHub last commit](https://img.shields.io/github/last-commit/livoras/runback)
  
</div>

## Introduction

Runback is a progressive workflow framework built around the core concept of "**result as process**".

Unlike traditional workflow systems that require pre-defining entire processes, Runback allows developers to build workflows by working backwards from any desired result. The framework automatically records the results of each action, enabling you to proceed with next steps based on any interesting outcomes. When you achieve your desired result, the workflow orchestration is automatically completed.

This approach lets you focus less on orchestration itself and more on any interesting results, building your process in a creative, step-by-step manner.

## Installation

```bash
npm install runback
```

## Quick Start

**1. Create and Add Initial Steps**
```typescript
// Define actions
const actions = {
  'fetchUser': async (options) => {
    // Simulate fetching user data from API
    return { user: { id: options.userId, name: "John Doe" } };
  },
  'processUser': async (options) => {
    // Process user data
    return { 
      processed: {
        ...options.user,
        status: 'processed',
        timestamp: new Date().toISOString()
      }
    };
  },
  'generateReport': async (options) => {
    // Generate report
    return {
      report: `User ${options.processed.name} processed at ${options.processed.timestamp}`
    };
  }
};

// Create and add initial steps
const work = new Work(actions, 'user-workflow.json');
await work.load(); // Load history (if any)

await work.step({
  id: 'step1',
  action: 'fetchUser',
  options: { userId: '123' }  // Use fixed parameters
});
```

**2. Continue Building the Workflow**
```typescript
// Load previous workflow
const work = new Work(actions, 'user-workflow.json');
await work.load(); // Load workflow containing step1

// Add processing step
await work.step({
  id: 'processUser',
  action: 'processUser',
  options: { user: '$ref.step1.user' }  // Reference result from previous step
});

// Add report generation step
await work.step({
  id: 'createReport',
  action: 'generateReport',
  options: { processed: '$ref.processUser.processed' }  // Reference result from previous step
});
```

**3. Execute the Workflow**
```typescript
// Load complete workflow
const work = new Work(actions, 'user-workflow.json');
await work.load();

// Execute entire workflow, specifying entry step and parameters
await work.run({ 
  entry: 'step1', 
  entryOptions: { userId: '124' }  // Dynamically pass parameters, will override fixed parameters in step1
});
```

This example demonstrates Runback's core features:
1. Build workflows incrementally in different locations
2. Reference results from previous steps in subsequent steps
3. Automatic workflow state persistence to file
4. Dynamic entry step and parameter specification via `work.run()`

## Features

### 1. Progressive Building and Execution

Unlike traditional workflow systems that typically require pre-defining entire workflows before execution, Runback allows you to add and execute steps as needed, providing great flexibility.

**Core Mechanisms**:
- Add and optionally execute individual steps via `work.step()`
- Each step has a unique ID and can be executed independently
- Step execution updates workflow state
- Control immediate step execution via the `run` parameter

### 2. Result Persistence and Reference

Each step's execution result is saved and can be referenced by subsequent steps using a special reference syntax.

**Reference Mechanism**:
- Use `$ref.stepId.propertyPath` syntax to reference previous step results
- Supports nested property access
- Use `$ref.$item` to reference current iteration item in loops

### 3. State Persistence

Runback automatically persists workflow state to a file, including all step definitions and the last run's history. You can load workflow state at any time via `work.load()` to continue building or executing.

## Workflow Building Patterns

Runback supports two workflow building patterns:

### 1. Progressive Building Pattern

Add and immediately execute steps via `work.step(step, true)`, allowing you to build and execute workflows step by step, with each step producing immediate results that can inform the next action.

```typescript
// Add and immediately execute step
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
}, true); // true is default and can be omitted
```

### 2. Orchestration Building Pattern

Add steps without immediate execution via `work.step(step, false)`, allowing you to define the entire workflow structure first, then execute all steps at once via `work.run()`.

```typescript
// Add steps without immediate execution
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

// Execute all steps at once, must specify entry step
await work.run({ 
  entry: 'getData',  // Specify entry step
  actions: work.actions 
});
```

## Running Workflows

Runback supports three distinct execution modes:

1. **Entry-driven**: `run({ entry: 'stepId' })` - Start from a specific step and execute all dependencies
2. **Exit-driven**: `run({ exit: 'stepId' })` - Specify the desired end result and let the system find the optimal path
3. **Selective**: `run({ onlyRuns: [...] })` - Execute only specific steps directly

### 1. Specifying Run Start Point

Runback supports starting workflow execution from any step. Use `work.run({ entry: 'stepId' })` to specify the entry step, and the system will automatically execute that step and all its dependencies.

```typescript
// Run from step1
await work.run({ 
  entry: 'step1'  // Must specify entry step
});

// Run from processData
await work.run({ 
  entry: 'processData'  // Can start from any step
});
```

### 2. Runtime Parameters

Use `entryOptions` to dynamically override entry step parameters at runtime. This is particularly useful for scenarios requiring parameter adjustments based on different contexts.

```typescript
// Use fixed parameters when defining step
await work.step({
  id: 'step1',
  action: 'fetchUser',
  options: { userId: '123' }  // Fixed parameters
});

// Override parameters at runtime
await work.run({ 
  entry: 'step1',
  entryOptions: { userId: '456' }  // Dynamic parameters override fixed parameters
});
```

### 3. Specifying Exit

Use the `exit` parameter to specify the workflow's exit node. When the specified node is executed, the workflow stops immediately. This aligns with the "result as process" philosophy, allowing you to select any satisfactory result as the workflow endpoint.

**Exit-driven Execution**: When only `exit` is specified (without `entry`), Runback automatically:
1. **Traces back dependencies** to find all root steps for the exit node
2. **Filters execution path** to include only necessary steps to reach the exit
3. **Starts from root steps** and executes until the exit node is reached

```typescript
// Traditional approach - specify both entry and exit
await work.run({ 
  entry: 'startProcess',
  exit: 'generateImage'  // Workflow terminates here when this step's result meets requirements
});

// Exit-driven approach - specify only exit, let system find the path
await work.run({ 
  exit: 'generateImage'  // System automatically finds root steps and execution path
});

// Example: Complex workflow with multiple branches
const workflow = new Workflow({
  steps: [
    { id: 'fetchData', action: 'fetchData' },
    { id: 'processA', action: 'processA', depends: ['fetchData'] },
    { id: 'processB', action: 'processB', depends: ['fetchData'] },
    { id: 'unrelatedTask', action: 'unrelated', depends: ['fetchData'] }, // Won't run
    { id: 'mergeResults', action: 'merge', depends: ['processA', 'processB'] }
  ]
});

// Only runs: fetchData -> processA -> processB -> mergeResults
// Skips: unrelatedTask (not in the path to mergeResults)
await workflow.run({ exit: 'mergeResults' });
```

**Key Benefits**:
- **Efficient execution**: Only runs steps necessary to reach the desired result
- **Automatic path discovery**: No need to manually trace dependencies
- **Multiple root support**: Handles workflows with multiple starting points
- **"Result as process"**: Focus on the desired outcome, let the system determine the path

### 4. Specified Step Execution

Use `onlyRuns` mode to directly specify which steps to run, without needing to specify an entry step. If these steps depend on data from other steps, the system will automatically load from history.

```typescript
// Run only specific steps
await work.run({ 
  onlyRuns: ['processData', 'generateReport']  // Directly specify steps to run
});
```

### 5. Breakpoint Execution

Use the `resume` parameter to load the complete context from the last run, allowing access to all results from the previous run when starting from any entry step. This is particularly useful for scenarios requiring continuation based on previous run results.

```typescript
// Can start from any step in last run's results
await work.run({ 
  entry: 'processData', 
  resume: true // Use data from last run
});
```

## Control Flow

### 1. Conditions (if)

Runback supports conditional branching via `type: 'if'`. Conditional steps return a boolean value, and subsequent steps can specify execution conditions using the `depends` property.

```typescript
// Define actions
const actions = {
  'fetchUser': async (options) => {
    // Simulate fetching user data from API
    return { 
      user: { 
        id: options.userId, 
        name: "John Doe",
        role: "admin"  // User role
      } 
    };
  },
  'checkPermission': async (options) => {
    // Check user permissions
    return options.user.role === 'admin';
  },
  'processAdminTask': async (options) => {
    // Process admin task
    return { 
      message: `Admin ${options.user.name} processed task successfully` 
    };
  },
  'handleNoPermission': async (options) => {
    // Handle no permission case
    return { 
      error: `User ${options.user.name} has no permission to perform this task` 
    };
  }
};

// Create workflow
const work = new Work(actions, 'permission-workflow.json');
await work.load();

// 1. Get user info
await work.step({
  id: 'getUser',
  action: 'fetchUser',
  options: { userId: '123' }
});

// 2. Check permissions (conditional step)
await work.step({
  id: 'checkPermission',
  action: 'checkPermission',
  options: { user: '$ref.getUser.user' },
  type: 'if'  // Mark as conditional step
});

// 3. Execute different operations based on permissions
await work.step({
  id: 'processAdminTask',
  action: 'processAdminTask',
  options: { user: '$ref.getUser.user' },
  depends: ['checkPermission.true']  // Execute only when permission check passes
});

await work.step({
  id: 'handleNoPermission',
  action: 'handleNoPermission',
  options: { user: '$ref.getUser.user' },
  depends: ['checkPermission.false']  // Execute only when permission check fails
});

// Execute workflow, specifying entry step
await work.run({ entry: 'getUser' });
```

In this example:
1. `checkPermission` step is marked as a conditional step (`type: 'if'`)
2. Conditional step returns a boolean value (true/false)
3. Subsequent steps specify execution conditions via `depends` property:
   - `checkPermission.true` means execute when condition is true
   - `checkPermission.false` means execute when condition is false
4. Workflow automatically selects execution path based on conditions

### 2. Branch Merge

In conditional branching scenarios, Runback supports branch merging via dependency syntax. The framework supports both **AND** and **OR** relationships:

- **AND relationship**: `depends: ['stepA', 'stepB']` - Wait for ALL steps to complete
- **OR relationship**: `depends: ['stepA,stepB']` - Wait for ANY step to complete (comma-separated in single string)

```typescript
// 1. Get user info
await work.step({
  id: 'getUser',
  action: 'fetchUser',
  options: { userId: '123' }
});

// 2. Check user status (conditional step)
await work.step({
  id: 'checkStatus',
  action: 'checkUserStatus',
  options: { user: '$ref.getUser.user' },
  type: 'if'  // Mark as conditional step
});

// 3. Execute different operations based on status
await work.step({
  id: 'processActiveUser',
  action: 'processActiveUser',
  options: { user: '$ref.getUser.user' },
  depends: ['checkStatus.true']  // Execute for active users
});

await work.step({
  id: 'sendWelcomeBack',
  action: 'sendWelcomeBack',
  options: { user: '$ref.getUser.user' },
  depends: ['checkStatus.false']  // Execute for inactive users
});

// 4. Branch merge using OR dependency - Execute when ANY predecessor completes
await work.step({
  id: 'logUserActivity',
  action: 'logActivity',
  options: { 
    userId: '$ref.getUser.user.id',
    timestamp: new Date().toISOString()
  },
  depends: ['processActiveUser,sendWelcomeBack']  // OR: Execute after EITHER step completes
});

// Alternative: AND dependency - Execute when ALL predecessors complete
await work.step({
  id: 'logAllActivity',
  action: 'logAllActivity',
  options: { 
    userId: '$ref.getUser.user.id',
    timestamp: new Date().toISOString()
  },
  depends: ['processActiveUser', 'sendWelcomeBack']  // AND: Wait for BOTH steps
});

// 5. Continue processing
await work.step({
  id: 'continueProcessing',
  action: 'continueWorkflow',
  options: {},
  depends: ['logUserActivity']  // Wait for logging to complete
});
```

In this example:
1. **Conditional execution**: Only one of `processActiveUser` or `sendWelcomeBack` will execute based on status
2. **OR merge**: `logUserActivity` uses `['processActiveUser,sendWelcomeBack']` (comma-separated) to execute when the completed branch finishes
3. **AND merge**: `logAllActivity` uses `['processActiveUser', 'sendWelcomeBack']` (separate array elements) to wait for both (though only one will actually execute in conditional scenarios)
4. **Flexible merging**: Choose OR for conditional branches, AND for parallel execution scenarios

### 3. Array Processing (each)

Runback supports array data iteration via the `each` property. The `each` field supports two forms:

1. **Reference form**: `each: '$ref.stepId.arrayProperty'` - References array data from previous steps
2. **Direct array form**: `each: [...]` - Uses a literal array directly

In iteration steps, use `$ref.$item` to reference the current iteration item and `$ref.$index` to reference the current index.

#### Using Reference Arrays

```typescript
// Define actions
const actions = {
  'fetchUsers': async () => {
    // Simulate fetching user list from API
    return { 
      users: [
        { id: '1', name: 'Alice', score: 85 },
        { id: '2', name: 'Bob', score: 92 },
        { id: '3', name: 'Charlie', score: 78 }
      ]
    };
  },
  'processUser': async (options) => {
    // Process single user data
    const { user, index } = options;
    return {
      id: user.id,
      name: user.name,
      grade: user.score >= 90 ? 'A' : user.score >= 80 ? 'B' : 'C',
      rank: index + 1
    };
  },
  'generateReport': async (options) => {
    // Generate summary report
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

// Create workflow
const work = new Work(actions, 'user-processing.json');
await work.load();

// 1. Get user list
await work.step({
  id: 'getUsers',
  action: 'fetchUsers',
  options: {}
});

// 2. Process each user
await work.step({
  id: 'processUsers',
  action: 'processUser',
  each: '$ref.getUsers.users',  // Iterate over user array
  options: {
    user: '$ref.$item',        // Reference current user
    index: '$ref.$index'       // Reference current index
  }
});

// 3. Generate summary report
await work.step({
  id: 'createReport',
  action: 'generateReport',
  options: {
    processedUsers: '$ref.processUsers'  // Reference processed user array
  }
});

// Execute workflow
await work.run({ entry: 'getUsers' });
```

#### Using Direct Arrays

You can also use arrays directly in the `each` field without referencing previous step results:

```typescript
// Define actions
const actions = {
  'processItem': async (item) => {
    // When no options are provided, the item is passed directly as parameter
    return `processed-${item}`;
  },
  'processWithOptions': async (options) => {
    // When options are provided, use the original behavior
    return `processed-${options.value}-with-index-${options.index}`;
  }
};

// Create workflow
const work = new Work(actions, 'direct-array-workflow.json');
await work.load();

// 1. Process items directly with array - no options, item passed as parameter
await work.step({
  id: 'processItems',
  action: 'processItem',
  each: ['apple', 'banana', 'orange']  // Direct array, no dependency analysis needed
  // No options - each item will be passed directly to the action
});

// 2. Process items with options
await work.step({
  id: 'processWithOptions',
  action: 'processWithOptions',
  each: [10, 20, 30],  // Direct array
  options: {
    value: '$ref.$item',    // Reference current item
    index: '$ref.$index'    // Reference current index
  }
});

// Execute workflow
await work.run({ entry: 'processItems' });
```

#### Key Features:

1. **Reference arrays**: `each: '$ref.stepId.arrayProperty'` - References array data from previous steps
2. **Direct arrays**: `each: [...]` - Uses literal arrays directly, no dependency analysis required
3. **Simplified parameter passing**: When no `options` are provided, the current item is passed directly as the action parameter
4. **Standard parameter passing**: When `options` are specified, use `$ref.$item` and `$ref.$index` for current item and index
5. **Automatic result merging**: Iteration step results automatically merge into an array
6. **Subsequent references**: Later steps can directly reference the entire processed array

In these examples:
1. Direct arrays don't require dependency analysis and can be used immediately
2. When no `options` are specified, each item is passed directly to the action function
3. When `options` are specified, the traditional `$ref.$item` and `$ref.$index` references are used
4. Both approaches support any data types: strings, numbers, objects, arrays, etc.

### 4. Parallel and Merge

Runback's step execution mechanism is based on automatic parallel execution of dependencies. As soon as all dependencies of a step are completed, that step executes immediately, without manual parallel and merge logic handling.

```typescript
// Define actions
const actions = {
  'fetchData': async () => {
    // Simulate fetching data
    return { data: "raw data" };
  },
  'processA': async (options) => {
    // Process data method A
    return { result: `A process: ${options.data}` };
  },
  'processB': async (options) => {
    // Process data method B
    return { result: `B process: ${options.data}` };
  },
  'combineResults': async (options) => {
    // Combine processing results
    return {
      finalResult: `Combined result: ${options.resultA.result}, ${options.resultB.result}`
    };
  }
};

// Create workflow
const work = new Work(actions, 'parallel-workflow.json');
await work.load();

// 1. Get data
await work.step({
  id: 'getData',
  action: 'fetchData',
  options: {}
});

// 2. Parallel data processing (both processing steps depend on getData)
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

// 3. Combine results (depends on both processing steps)
await work.step({
  id: 'combine',
  action: 'combineResults',
  options: {
    resultA: '$ref.processA',
    resultB: '$ref.processB'
  }
});

// Execute workflow
await work.run({ entry: 'getData' });
```

In this example:
1. Both `processA` and `processB` depend on `getData` results
2. When `getData` completes, `processA` and `processB` automatically execute in parallel
3. When both `processA` and `processB` complete, `combine` step automatically executes
4. No manual parallel and merge logic handling required

### 5. Branch Merge

In conditional branching scenarios, Runback supports branch merging via comma-separated reference paths. When using conditional branches (if), only the branch that satisfies the condition will be executed, and the merge node will trigger when any branch completes, without waiting for all branches to complete.

```typescript
// Define actions
const actions = {
  'checkUser': async (options) => {
    // Check user status
    return options.userId === 'admin';
  },
  'processAdmin': async (options) => {
    // Process admin logic
    return { message: "Admin processing complete" };
  },
  'processNormalUser': async (options) => {
    // Process normal user logic
    return { message: "Normal user processing complete" };
  },
  'mergeResult': async (options) => {
    // Merge processing results
    return {
      finalMessage: options.result,
      timestamp: new Date().toISOString()
    };
  }
};

// Create workflow
const work = new Work(actions, 'branch-workflow.json');
await work.load();

// 1. Check user type (conditional step)
await work.step({
  id: 'checkUser',
  action: 'checkUser',
  options: { userId: 'admin' },
  type: 'if'
});

// 2. Process based on user type (two branches, only one will execute)
await work.step({
  id: 'processAdmin',
  action: 'processAdmin',
  options: {},
  depends: ['checkUser.true']  // Only executes when checkUser returns true
});

await work.step({
  id: 'processNormalUser',
  action: 'processNormalUser',
  options: {},
  depends: ['checkUser.false']  // Only executes when checkUser returns false
});

// 3. Merge branch results - triggers when any branch completes
await work.step({
  id: 'mergeResult',
  action: 'mergeResult',
  options: {
    // Use comma-separated references, system returns the result from the executed branch
    // Since only one branch will execute, this will get the result from that branch
    result: '$ref.processAdmin.message,$ref.processNormalUser.message'
  }
});

// Execute workflow
await work.run({ entry: 'checkUser' });
```

In this example:
1. `checkUser` step returns true/false based on user ID
2. Based on condition result, only one of `processAdmin` or `processNormalUser` will execute:
   - If user is admin (checkUser returns true), only processAdmin will execute
   - If user is normal (checkUser returns false), only processNormalUser will execute
3. `mergeResult` step uses comma-separated references:
   - `$ref.processAdmin.message,$ref.processNormalUser.message`
   - Since only one branch will execute, this will get the result from that branch
   - The merge node doesn't care which branch triggered it, it executes as soon as any branch completes
4. Key features: Only one conditional branch executes, and the merge node triggers when any branch completes

## API Reference

### Work Class

```typescript
class Work {
  constructor(actions?: Record<string, Function>, savePath?: string);
  
  // Core methods
  async step(step: Step, run: boolean = true): Promise<any>;  // Add single step, optionally execute immediately
  async run(options: RunOptions): Promise<RunHistoryRecord[]>;  // Execute entire workflow
  
  // State management
  async load(path?: string): Promise<void>;  // Load workflow state
}
```

### Step Interface

```typescript
interface Step {
  id: string;  // Unique step identifier
  action: string;  // Action name to execute
  type?: "if";  // Step type, 'if' indicates conditional step
  name?: string;  // Step name
  options?: Record<string, any>;  // Parameters passed to action
  depends?: string[];  // Dependent steps
  each?: string | any[];  // Data reference for iteration or direct array
}
```

### RunOptions Interface

```typescript
interface RunOptions {
  entry?: string;  // Entry step ID
  exit?: string;  // Exit step ID for exit-driven execution
  entryOptions?: any;  // Entry step parameters
  actions?: Record<string, Function>;  // Executable actions
  history?: RunHistoryRecord[];  // History records
  onlyRuns?: string[];  // Only run specified steps
  logLevel?: LogLevel;  // Log level
  resume?: boolean;  // Whether to resume execution
}
```

## License

MIT 
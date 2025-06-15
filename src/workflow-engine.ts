import { createProxy } from "./createProxy"
import { Logger, LogLevel, createDefaultLogger } from "./logger"
import { v4 as uuidv4 } from 'uuid';

export type RunStatus = 'running' | 'failed' | 'success' | "aborted" | "pending"

export type RunOptions<TStep = any> = {
  actions?: Record<string, Function>,
  history?: RunHistoryRecord[], // 执行记录数组
  onlyRuns?: string[],
  entry?: string,
  exit?: string,
  logLevel?: LogLevel,
  resume?: boolean,
  entryOptions?: any, // to cover the entry steps options
}

// 步骤执行记录
interface StepExecutionRecord {
  step: any;
  startTime: string;      // ISO格式开始时间
  endTime: string;        // ISO格式结束时间
  duration: number;       // 执行时长(毫秒)
  status: RunStatus;
  options?: Record<string, any>; // 步骤配置选项（来自step.options）
  inputs: any;            // 输入参数（来自runOptions）
  outputs?: any;          // 输出结果
  onlyRun: boolean;       // 是否在 onlyRuns 模式下运行
  error?: {               // 错误信息(如果执行失败)
    message: string;
    stack?: string;
  };
  context: any;           // 执行时的上下文
}

// 工作流运行记录
export interface RunHistoryRecord {
  runId: string;          // 运行唯一ID (使用uuid生成)
  startTime: string;      // 工作流开始时间
  endTime: string;        // 工作流结束时间
  duration: number;       // 总执行时长
  status: RunStatus;
  steps: { [stepId: string]: StepExecutionRecord }; // 步骤记录映射
  context: any;           // 最终上下文快照
  error?: {               // 错误信息(如果执行失败)
    message: string;
    stack?: string;
  };
}

/**
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 */
const clone = (obj: any) => {
  return JSON.parse(JSON.stringify(obj))
}

// 执行记录管理函数
const createRunningRecord = (): RunHistoryRecord => {
  return {
    runId: uuidv4(),
    startTime: new Date().toISOString(),
    endTime: '',
    duration: 0,
    status: 'running',
    steps: {},
    context: {},
  }
}

const markRecordSuccess = (record: RunHistoryRecord, ctx: any) => {
  record.endTime = new Date().toISOString()
  record.duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime()
  record.status = "success"
  record.context = ctx
}

const markRecordFailed = (record: RunHistoryRecord, ctx: any, error: Error) => {
  record.endTime = new Date().toISOString()
  record.duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime()
  record.status = "failed"
  record.error = {
    message: error.message,
    stack: error.stack
  }
  record.context = ctx
}

const createRunningStepRecord = (step: any, ctx: any, onlyRun: boolean = false): StepExecutionRecord => {
  return {
    step,
    startTime: new Date().toISOString(),
    endTime: '',
    duration: 0,
    status: 'running',
    options: step.options,
    inputs: null,
    outputs: undefined,
    onlyRun,
    error: undefined,
    context: clone(ctx),
  }
}

const markStepSuccess = (record: StepExecutionRecord, result: any) => {
  record.endTime = new Date().toISOString()
  record.duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime()
  record.status = "success"
  record.outputs = result
}

const markStepFailed = (record: StepExecutionRecord, error: Error) => {
  record.endTime = new Date().toISOString()
  record.duration = new Date(record.endTime).getTime() - new Date(record.startTime).getTime()
  record.status = "failed"
  record.error = {
    message: error.message,
    stack: error.stack
  }
}

/**
 * 抽象的工作流引擎基类
 * 包含语法无关的核心功能：执行记录管理、生命周期管理、上下文管理等
 */
export abstract class WorkflowEngine<TStep = any> {
  protected logger: Logger

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logger = createDefaultLogger(logLevel)
  }

  // 抽象方法 - 需要子类实现的语法特定逻辑
  protected abstract getAllSteps(): TStep[]
  protected abstract getStepId(step: TStep): string
  protected abstract parseDependencies(steps: TStep[]): void
  
  // 可运行步骤判断的抽象方法
  protected abstract isStepDependenciesSatisfied(step: TStep, setKeys: Set<string>, depsCache: Map<string, boolean>): boolean
  protected abstract applyEntryOptions(step: TStep, entryOptions: any): void

  // 通用的可运行步骤判断逻辑
  protected getAllRunnableSteps(
    runOptions: RunOptions<TStep>, 
    stepsNotRun: TStep[], 
    ctx: any, 
    setKeys: Set<string>, 
    entrySteps: string[] = []
  ): TStep[] {
    // 创建依赖检查缓存，避免重复计算
    const depsCache = new Map<string, boolean>()
    
    this.logger.debug('Checking runnable steps', { stepsCount: stepsNotRun.length, entrySteps })
    
    // 如果指定了 onlyRuns，则跳过依赖检查，直接返回匹配的步骤
    if (runOptions.onlyRuns?.length) {
      this.logger.debug('Running in onlyRuns mode, skipping dependency checks');
      return stepsNotRun.filter(step => runOptions.onlyRuns?.includes(this.getStepId(step)));
    }
    
    const runnableSteps = stepsNotRun.filter(step => {
      const stepId = this.getStepId(step)
      
      // 入口步骤总是可运行的
      if (entrySteps.includes(stepId)) {
        if (runOptions.entryOptions) {
          this.applyEntryOptions(step, runOptions.entryOptions)
        }
        this.logger.debug(`Step ${stepId} is entry step, can run`)
        return true
      }
      
      const stepDeps = this.getStepDependencies(stepId)
      if (stepDeps.length === 0) {
        // 对于没有依赖且不是入口步骤的情况，给出警告
        if (entrySteps.length > 0) {
          this.logger.warn(`Step ${stepId} has no dependencies but is not in entry steps`)
        } else {
          this.logger.warn(`Step ${stepId} has no dependencies but no entry specified`)
        }
        return false
      }
      
      // 使用子类实现的依赖满足判断
      const canRun = this.isStepDependenciesSatisfied(step, setKeys, depsCache)
      if (canRun) {
        this.logger.debug(`Dependencies for step ${stepId} are satisfied, can run`)
      } else {
        this.logger.debug(`Dependencies for step ${stepId} are not satisfied, cannot run yet`, { deps: stepDeps })
      }
      
      return canRun
    })
    
    this.logger.debug('Found runnable steps', { count: runnableSteps.length })
    return runnableSteps
  }
  // 步骤执行抽象方法 - 子类实现语法特定的执行逻辑
  protected abstract isEachStep(step: TStep): boolean
  protected abstract prepareStepInput(step: TStep, ctx: any): any
  protected abstract prepareEachStepInput(step: TStep, ctx: any): { list: any[], prepareItemInput: (item: any, index: number) => any }
  protected abstract updateContextWithResult(step: TStep, result: any, ctx: any): void

  // 通用的步骤执行模板方法
  protected async executeStepLogic(
    step: TStep, 
    action: Function, 
    ctx: any, 
    stepRecord: StepExecutionRecord
  ): Promise<any> {
    if (this.isEachStep(step)) {
      return await this.executeEachStepTemplate(step, action, ctx, stepRecord)
    } else {
      return await this.executeNormalStepTemplate(step, action, ctx, stepRecord)
    }
  }

  private async executeNormalStepTemplate(step: TStep, action: Function, ctx: any, stepRecord: StepExecutionRecord) {
    const stepId = this.getStepId(step)
    this.logger.debug(`Preparing to execute normal step: ${stepId}`)
    
    const actionInput = this.prepareStepInput(step, ctx)
    this.logger.debug(`Input for step ${stepId}`, actionInput)

    stepRecord.inputs = actionInput
    
    const result = actionInput !== undefined ? await action(actionInput) : await action()
    this.logger.debug(`Result of step ${stepId}`, result)

    stepRecord.outputs = result
    this.updateContextWithResult(step, result, ctx)
    
    return result
  }

  private async executeEachStepTemplate(step: TStep, action: Function, ctx: any, stepRecord: StepExecutionRecord) {
    const stepId = this.getStepId(step)
    this.logger.debug(`Preparing to execute iteration step: ${stepId}`)
    
    const { list, prepareItemInput } = this.prepareEachStepInput(step, ctx)
    this.logger.debug(`Data source for iteration step ${stepId}`, { items: list?.length })

    const inputs: any = []
    stepRecord.inputs = inputs
    
    const results: any[] = []
    stepRecord.outputs = results
    
    if (!Array.isArray(list)) {
      const errorMsg = `Data source for iteration step ${stepId} is not an array`
      this.logger.error(errorMsg, list)
      throw new Error(errorMsg)
    }

    await Promise.all(list.map(async (item: any, index: number) => {
      this.logger.debug(`Executing item ${index} of iteration step ${stepId}`)
      
      const actionParam = prepareItemInput(item, index)
      inputs.push(actionParam)
      
      const result = actionParam !== undefined ? await action(actionParam) : await action()
      this.logger.debug(`Result of item ${index} for iteration step ${stepId}`, result)
      results.push(result)
    }))
    
    this.logger.debug(`All results for iteration step ${stepId}`, { count: results.length })
    this.updateContextWithResult(step, results, ctx)
    return results
  }
  
  // 依赖图抽象方法 - 子类实现语法特定的依赖获取和解析
  protected abstract getStepDependencies(stepId: string): (string | string[])[]
  protected abstract extractStepIdFromDependency(dep: string): string | null
  protected abstract stepExists(stepId: string): boolean

  // 公开 API - 基于抽象方法的通用实现
  getRootSteps(stepId: string): string[] {
    // 检查步骤是否存在
    if (!this.stepExists(stepId)) {
      throw new Error(`Step ${stepId} not found`)
    }

    const visited = new Set<string>() // 防止循环依赖
    const rootSteps = new Set<string>() // 使用Set避免重复

    /**
     * 递归查找根步骤
     * @param currentStepId 当前步骤ID
     */
    const findRoots = (currentStepId: string) => {
      // 防止循环依赖
      if (visited.has(currentStepId)) {
        return
      }
      visited.add(currentStepId)

      const currentStepDeps = this.getStepDependencies(currentStepId)
      
      // 如果当前步骤没有依赖，它就是根步骤
      if (currentStepDeps.length === 0) {
        rootSteps.add(currentStepId)
        return
      }

      // 递归查找每个依赖的根步骤
      currentStepDeps.forEach(dep => {
        if (Array.isArray(dep)) {
          // 处理数组形式的依赖（或关系）
          dep.forEach(d => {
            const rootStepId = this.extractStepIdFromDependency(d)
            if (rootStepId) {
              findRoots(rootStepId)
            }
          })
        } else {
          // 处理字符串形式的依赖
          const rootStepId = this.extractStepIdFromDependency(dep)
          if (rootStepId) {
            findRoots(rootStepId)
          }
        }
      })
    }

    findRoots(stepId)
    
    return Array.from(rootSteps).sort() // 返回排序后的数组
  }

  getPathSteps(targetStepId: string): string[] {
    // 检查步骤是否存在
    if (!this.stepExists(targetStepId)) {
      throw new Error(`Step ${targetStepId} not found`)
    }

    const visited = new Set<string>() // 防止循环依赖
    const pathSteps = new Set<string>() // 使用Set避免重复

    /**
     * 递归查找路径上的步骤
     * @param currentStepId 当前步骤ID
     */
    const findPathSteps = (currentStepId: string) => {
      // 防止循环依赖
      if (visited.has(currentStepId)) {
        return
      }
      visited.add(currentStepId)

      // 当前步骤本身也是路径的一部分
      pathSteps.add(currentStepId)

      const currentStepDeps = this.getStepDependencies(currentStepId)
      
      // 递归查找每个依赖的步骤
      currentStepDeps.forEach(dep => {
        if (Array.isArray(dep)) {
          // 处理数组形式的依赖（或关系）- 这里我们需要所有可能的分支
          dep.forEach(d => {
            const depStepId = this.extractStepIdFromDependency(d)
            if (depStepId) {
              findPathSteps(depStepId)
            }
          })
        } else {
          // 处理字符串形式的依赖
          const depStepId = this.extractStepIdFromDependency(dep)
          if (depStepId) {
            findPathSteps(depStepId)
          }
        }
      })
    }

    findPathSteps(targetStepId)
    
    return Array.from(pathSteps).sort() // 返回排序后的数组
  }

  /**
   * 主运行方法 - 语法无关的工作流执行框架
   */
  async run(options?: RunOptions<TStep>, stepsNotRun: TStep[] = [...this.getAllSteps()], stepsRun: TStep[] = []) {
    // 如果提供了日志级别，则更新日志管理器的级别
    if (options?.logLevel !== undefined) {
      this.logger.setLevel(options.logLevel)
    }
    
    // 处理运行模式：确定入口点和过滤步骤
    let entrySteps: string[] = []
    let filteredSteps: TStep[] = stepsNotRun
    
    if (options?.onlyRuns?.length) {
      // onlyRuns 模式：直接指定要运行的步骤
      this.logger.info(`Running only specified steps: ${options.onlyRuns?.join(', ')}`);
    } else if (options?.entry) {
      // entry 模式：从指定入口开始
      entrySteps = [options.entry]
      this.logger.info(`Entry-driven execution: starting from ${options.entry}`)
    } else if (options?.exit) {
      // exit 模式：通过反查根节点确定入口，并过滤出路径上的步骤
      entrySteps = this.getRootSteps(options.exit)
      const pathSteps = this.getPathSteps(options.exit)
      filteredSteps = stepsNotRun.filter(step => pathSteps.includes(this.getStepId(step)))
      this.logger.info(`Exit-driven execution: found root steps for ${options.exit}`, entrySteps)
      this.logger.info(`Exit-driven execution: filtering to path steps`, pathSteps)
    } else {
      throw new Error('Must specify either entry, exit, or onlyRuns in run options')
    }
    
    // 更新 stepsNotRun 为过滤后的步骤
    stepsNotRun = filteredSteps
    
    const record = createRunningRecord()
    const history = options?.history || []
    let ctx: any = {}
    
    try {
      // 初始化执行记录数组
      let setKeys: Set<string> = new Set()
      ctx = this.createContext(setKeys)
      
      // 如果指定了 onlyRuns 或 resume，从历史记录恢复上下文
      if (options?.onlyRuns?.length || options?.resume) {
        if (options?.resume) {
          this.logger.info('Resuming workflow execution');
        }
        
        if (history.length > 0) {
          const lastRecord = history[history.length - 1];
          ctx = this.createContext(setKeys, lastRecord.context);
          this.logger.debug('Restored context from history', ctx);
        }
      }
      
      this.logger.info('Starting workflow execution')
      
      while (stepsNotRun.length > 0) {
        const readySteps = this.getAllRunnableSteps(options || {}, stepsNotRun, ctx, setKeys, entrySteps)
        if (readySteps.length === 0) {
          this.logger.info('No runnable steps, workflow execution completed')
          break
        }
        
        this.logger.debug('\n--------------------------------')
        this.logger.info(`Preparing to execute ${readySteps.length} step(s)`, readySteps.map(s => this.getStepId(s)))
        
        await Promise.all(readySteps.map(step => 
          this.executeStep(step, options, ctx, stepsNotRun, stepsRun, record)
        ))

        // 检查是否执行了 exit 节点
        if (options?.exit && stepsRun.some(step => this.getStepId(step) === options.exit)) {
          this.logger.info(`Exit node ${options.exit} executed, stopping workflow execution`)
          break;
        }
      }
      markRecordSuccess(record, ctx)
    } catch (error) {
      markRecordFailed(record, ctx, error as Error)
    }
    
    // 将成功记录添加到历史记录中
    history.push(clone(record))
    
    this.logger.info('Workflow execution completed')
    return history
  }

  /**
   * 创建上下文代理对象
   */
  private createContext(setKeys: Set<string>, initialContext: any = {}) {
    return createProxy(initialContext, (path, value) => {
      this.logger.debug(`\x1b[34m--> Context change\x1b[0m`, path, value)
      setKeys.add(path)
      this.logger.debug('Updated key set', Array.from(setKeys))
    })
  }

  /**
   * 执行单个步骤 - 语法无关的执行框架
   */
  private async executeStep(
    step: TStep, 
    options: RunOptions<TStep> | undefined, 
    ctx: any, 
    stepsNotRun: TStep[], 
    stepsRun: TStep[], 
    record: RunHistoryRecord
  ) {
    const stepId = this.getStepId(step)
    const stepAction = (step as any).action
    this.logger.info(`Executing step: ${stepId}`, { action: stepAction, type: (step as any).type })

    const onlyRun = options?.onlyRuns?.includes(stepId) || false;
    const stepRecord = createRunningStepRecord(step, ctx, onlyRun)
    record.steps[stepId] = stepRecord
    
    const action = options?.actions?.[stepAction]
    if (!action) {
      const errorMsg = `Action not found: ${stepAction}`
      this.logger.error(errorMsg)
      markStepFailed(stepRecord, new Error(errorMsg))
      throw new Error(errorMsg) 
    }

    try {
      // 调用子类实现的具体执行逻辑
      await this.executeStepLogic(step, action, ctx, stepRecord)
      
      this.moveStepToRun(step, stepsNotRun, stepsRun)
      this.logger.info(`Step ${stepId} execution completed`)
      markStepSuccess(stepRecord, stepRecord.outputs)
    } catch (error) {
      this.logger.error(`Step ${stepId} execution failed`, error)
      markStepFailed(stepRecord, error as Error)
      throw error
    }
  }

  /**
   * 移动步骤到已运行列表
   */
  protected moveStepToRun(step: TStep, stepsNotRun: TStep[], stepsRun: TStep[]) {
    const index = stepsNotRun.indexOf(step)
    if (index !== -1) {
      stepsNotRun.splice(index, 1)
      stepsRun.push(step)
      const stepId = this.getStepId(step)
      this.logger.debug(`Step ${stepId} moved to run list`, { notRunCount: stepsNotRun.length, runCount: stepsRun.length })
    } else {
      const stepId = this.getStepId(step)
      this.logger.warn(`Attempted to move step not in the not-run list: ${stepId}`)
    }
  }

  /**
   * 通用的深拷贝方法
   */
  protected clone(obj: any) {
    return clone(obj)
  }
} 
import { collect, collectFromRefString, inject } from "./ref"
import { createProxy } from "./createProxy"
import { Logger, LogLevel, createDefaultLogger } from "./logger"
import { v4 as uuidv4 } from 'uuid';

export type Step = {
  id: string,
  action: string,
  type?: "trigger" | "step" | "if",
  name?: string,
  options?: Record<string, any>,
  depends?: string[],
  each?: string,
}

export type WorkflowOptions = {
  steps: Step[],
}

export type RunStatus = 'running' | 'failed' | 'success' | "aborted" | "pending"

export type RunOptions = {
  actions?: Record<string, Function>,
  history?: RunHistoryRecord[], // 执行记录数组
  // useHisotry?: boolean,
  onlyRuns?: string[],
  entry?: string,
  exit?: string,
  logLevel?: LogLevel,
  resume?: boolean,
  entryOptions?: any, // to cover the entry steps options
}

// 步骤执行记录
interface StepExecutionRecord {
  step: Step;
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

type WorkflowHistory = RunHistoryRecord[];

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

const createRunningStepRecord = (step: Step, ctx: any, onlyRun: boolean = false): StepExecutionRecord => {
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
 * 深拷贝对象
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 */
const clone = (obj: any) => {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 获取路径的所有前缀
 * @param path 路径字符串
 * @returns 前缀数组
 */
const getPrefixes = (path: string) => {
  const parts = path.split('.')
  return parts.map((_, i) => parts.slice(0, i + 1).join('.'))
}

/**
 * 检查所有依赖是否已满足
 * @param deps 依赖列表，每个依赖可以是字符串或字符串数组（表示"或"关系）
 * @param setKeys 已设置的键集合
 * @param cache 依赖检查缓存
 * @returns 是否所有依赖都已满足
 */
const isAllDepsMet = (deps: (string | string[])[], setKeys: Set<string>, cache: Map<string, boolean> = new Map()) => {
  // 如果没有依赖，直接返回 true
  if (deps.length === 0) return true
  
  // 使用缓存键（依赖数组+setKeys大小）来检查是否有缓存结果
  const cacheKey = `${JSON.stringify(deps)}:${setKeys.size}`
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }
  
  const result = deps.every(dep => {
    // 如果是数组，表示"或"关系，只要满足其中一个即可
    if (Array.isArray(dep)) {
      return dep.some(d => {
        // 特殊依赖：$item 和 $index 总是被视为已满足
        if (d.startsWith("$item") || d.startsWith("$index")) {
          return true
        }
        // 检查依赖的前缀路径是否已满足
        const prefixes = getPrefixes(d)
        return prefixes.some(prefix => setKeys.has(prefix))
      })
    }
    
    // 单个依赖的处理（原有逻辑）
    // 特殊依赖：$item 和 $index 总是被视为已满足
    if (dep.startsWith("$item") || dep.startsWith("$index")) {
      return true
    }
    
    // 检查依赖的前缀路径是否已满足
    const prefixes = getPrefixes(dep)
    return prefixes.some(prefix => setKeys.has(prefix))
  })
  
  // 缓存结果
  cache.set(cacheKey, result)
  return result
}

/**
 * 根据路径获取对象中的值
 * @param o 对象
 * @param p 路径字符串
 * @returns 路径对应的值
 */
const getByPath = (o: any, p: string) => {
  return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
}

export class Workflow {
  public entry: string | undefined
  public deps: Record<string, (string | string[])[]> = {}
  private logger: Logger

  constructor(public options: WorkflowOptions, logLevel: LogLevel = LogLevel.INFO) {
    this.logger = createDefaultLogger(logLevel)
    this.options.steps && this.parseDepends(this.options.steps)
    this.logger.debug('Dependency parsing completed', this.deps)
  }

  parseDepends(steps: Step[]) {
    const idsSet = new Set<string>()
    for (const step of steps) {
      idsSet.add(step.id)
    }
    for (const step of steps) {
      // 检查 each 和 if 不能同时使用
      if (step.each && step.type === 'if') {
        throw new Error(`Step ${step.id} cannot use 'each' and 'if' simultaneously`)
      }
      
      const depends = step.depends ?? []
      const optionsDeps = collectFromRefString(step.options || {})
      const deps = [...depends, ...Object.values(optionsDeps)] as (string | string[])[] 
      if (step.each) {
        deps.push(step.each.replace("$ref.", ''))
      }
      this.checkDepsValid(deps, idsSet, step.id)
      this.deps[step.id] = deps
    }
  }

  checkDepsValid(deps: (string | string[])[], idsSet: Set<string>, stepId: string) {
    deps.forEach(dep => {
      const ensureDep = (depItem: string) => {
        const root = depItem.split('.')[0]
        if (['$item', '$index'].includes(root)) {
          return
        }
        if (!idsSet.has(root)) {
          throw new Error(`Step ${stepId} depends on non-existent step: ${depItem}`)
        }
      }

      if (typeof dep === 'string') {
        ensureDep(dep)
      } else {
        dep.forEach(d => {
          ensureDep(d)
        })
      }
    })
  }

  async run(options?: RunOptions, stepsNotRun: Step[] = [...this.options.steps], stepsRun: Step[] = []) {
    // 如果提供了日志级别，则更新日志管理器的级别
    if (options?.logLevel !== undefined) {
      this.logger.setLevel(options.logLevel)
    }
    
    const record = createRunningRecord()
    const history = options?.history || []
    let ctx: any = {}
    try {
      // 初始化执行记录数组
      let setKeys: Set<string> = new Set()
      ctx = this.createContext(setKeys)
      
      // 如果指定了 onlyRuns，从历史记录恢复上下文
      if (options?.onlyRuns?.length || options?.resume) {
        if (options?.onlyRuns?.length) {
          this.logger.info(`Running only specified steps: ${options.onlyRuns?.join(', ')}`);
        }

        if (options?.resume) {
          this.logger.info('Resuming workflow execution');
        }
        
        if (history.length > 0) {
          const lastRecord = history[history.length - 1];
          ctx = this.createContext(setKeys, lastRecord.context);
          this.logger.debug('Restored context from history for onlyRuns mode', ctx);
        }
      }
      
      this.logger.info('Starting workflow execution')
      
      while (stepsNotRun.length > 0) {
        const readySteps = this.getAllRunnableSteps(options || {}, stepsNotRun, ctx, setKeys)
        if (readySteps.length === 0) {
          this.logger.info('No runnable steps, workflow execution completed')
          break
        }
        
        this.logger.debug('\n--------------------------------')
        this.logger.info(`Preparing to execute ${readySteps.length} step(s)`, readySteps.map(s => s.id))
        
        await Promise.all(readySteps.map(step => 
          this.executeStep(step, options, ctx, stepsNotRun, stepsRun, record)
        ))

        // 检查是否执行了 exit 节点
        if (options?.exit && stepsRun.some(step => step.id === options.exit)) {
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
  
  private createContext(setKeys: Set<string>, initialContext: any = {}) {
    return createProxy(initialContext, (path, value) => {
      this.logger.debug(`\x1b[34m--> Context change\x1b[0m`, path, value)
      setKeys.add(path)
      this.logger.debug('Updated key set', Array.from(setKeys))
    })
  }
  
  private async executeStep(step: Step, options: RunOptions | undefined, ctx: any, stepsNotRun: Step[], stepsRun: Step[], record: RunHistoryRecord) {
    this.logger.info(`Executing step: ${step.id}`, { action: step.action, type: step.type })

    const onlyRun = options?.onlyRuns?.includes(step.id) || false;
    const stepRecord = createRunningStepRecord(step, ctx, onlyRun)
    record.steps[step.id] = stepRecord
    
    const action = options?.actions?.[step.action]
    if (!action) {
      const errorMsg = `Action not found: ${step.action}`
      this.logger.error(errorMsg)
      markStepFailed(stepRecord, new Error(errorMsg))
      throw new Error(errorMsg) 
    }

    try {
      if (step.each) {
        await this.executeEachStep(step, action, ctx, stepRecord)
      } else {
        await this.executeNormalStep(step, action, ctx, stepRecord)
      }
      
      this.moveStepToRun(step, stepsNotRun, stepsRun)
      this.logger.info(`Step ${step.id} execution completed`)
      markStepSuccess(stepRecord, stepRecord.outputs)
    } catch (error) {
      this.logger.error(`Step ${step.id} execution failed`, error)
      markStepFailed(stepRecord, error as Error)
      throw error
    }
  }
  
  private async executeNormalStep(step: Step, action: Function, ctx: any, stepRecord: StepExecutionRecord) {
    this.logger.debug(`Preparing to execute normal step: ${step.id}`)
    const actionOption = this.prepareActionOptions(step, ctx)
    this.logger.debug(`Options for step ${step.id}`, actionOption)

    stepRecord.inputs = actionOption
    
    const result = actionOption ? await action(actionOption) : await action()
    this.logger.debug(`Result of step ${step.id}`, result)

    stepRecord.outputs = result

    if (step.type === 'if') {
      const branch = result ? 'true' : 'false'
      ctx[`${step.id}.${branch}`] = true
      this.logger.debug(`Conditional step ${step.id} branch: ${branch}`)
    } else {
      ctx[step.id] = result
    }
    
    return result
  }
  
  private async executeEachStep(step: Step, action: Function, ctx: any, stepRecord: StepExecutionRecord) {
    this.logger.debug(`Preparing to execute iteration step: ${step.id}`)
    
    const each = step.each!.replace("$ref.", '')
    const list = getByPath(ctx, each)

    const inputs: any = []
    stepRecord.inputs = inputs
    
    const results: any[] = []
    stepRecord.outputs = results
    
    if (!Array.isArray(list)) {
      const errorMsg = `Data source ${each} for iteration step ${step.id} is not an array`
      this.logger.error(errorMsg, list)
      throw new Error(errorMsg)
    }
    
    this.logger.debug(`Data source for iteration step ${step.id}`, { path: each, items: list.length })

    await Promise.all(list.map(async (item: any, index: number) => {
      this.logger.debug(`Executing item ${index} of iteration step ${step.id}`)
      const itemOptions = this.prepareEachItemOptions(step, ctx, item, index)
      inputs.push(itemOptions)
      const result = itemOptions ? await action(itemOptions) : await action()
      this.logger.debug(`Result of item ${index} for iteration step ${step.id}`, result)
      results.push(result)
    }))
    
    this.logger.debug(`All results for iteration step ${step.id}`, { count: results.length })
    ctx[step.id] = results
    return results
  }
  
  /**
   * 将依赖映射转换为字符串映射，选择第一个满足条件的值
   * @param mapping 依赖映射
   * @param ctx 上下文对象
   * @returns 字符串映射
   */
  private convertMappingToStringMapping(mapping: Record<string, string | string[]>, ctx: any): Record<string, string> {
    const stringMapping: Record<string, string> = {}
    for (const [key, value] of Object.entries(mapping)) {
      if (Array.isArray(value)) {
        // 对于数组形式的依赖，找到第一个满足条件的值
        const satisfiedValue = value.find(v => {
          const prefixes = getPrefixes(v)
          return prefixes.some(prefix => {
            const val = getByPath(ctx, prefix)
            return val !== undefined && val !== null
          })
        })
        if (satisfiedValue) {
          stringMapping[key] = satisfiedValue
        }
      } else {
        stringMapping[key] = value
      }
    }
    this.logger.debug('-------->', stringMapping)
    return stringMapping
  }

  private prepareActionOptions(step: Step, ctx: any) {
    if (!step.options) return undefined
    
    const actionOption = clone(step.options)
    const mapping = collectFromRefString(actionOption)
    const stringMapping = this.convertMappingToStringMapping(mapping, ctx)
    inject(actionOption, ctx, stringMapping)
    return actionOption
  }
  
  private prepareEachItemOptions(step: Step, ctx: any, item: any, index: number) {
    if (!step.options) return undefined
    
    const itemOptions = clone(step.options)
    const mapping = collectFromRefString(itemOptions)
    const itemContext = { ...ctx, $item: item, $index: index }
    const stringMapping = this.convertMappingToStringMapping(mapping, itemContext)
    inject(itemOptions, itemContext, stringMapping)
    return itemOptions
  }

  /**
   * 获取所有可运行的步骤
   * @param runOptions 运行选项
   * @param stepsNotRun 未运行的步骤列表
   * @param ctx 上下文
   * @param setKeys 已设置的键集合
   * @returns 可运行的步骤列表
   */
  getAllRunnableSteps(runOptions: RunOptions, stepsNotRun: Step[], ctx: any, setKeys: Set<string>) {
    // 创建依赖检查缓存，避免重复计算
    const depsCache = new Map<string, boolean>()
    
    this.logger.debug('Checking runnable steps', { stepsCount: stepsNotRun.length })
    
    // 如果指定了 onlyRuns，则跳过依赖检查，直接返回匹配的步骤
    if (runOptions.onlyRuns?.length) {
      this.logger.debug('Running in onlyRuns mode, skipping dependency checks');
      return stepsNotRun.filter(step => runOptions.onlyRuns?.includes(step.id));
    }
    
    const runnableSteps = stepsNotRun.filter(step => {
      // 入口步骤总是可运行的
      if (step.id === runOptions?.entry) {
        if (runOptions.entryOptions) {
          // Merge entryOptions with existing options, with entryOptions taking precedence
          step.options = {
            ...(step.options || {}),
            ...runOptions.entryOptions
          };
        }
        this.logger.debug(`Step ${step.id} is entry step, can run`)
        return true
      }
      
      const deps = this.deps[step.id]
      if (deps.length === 0) {
        this.logger.warn(`Step ${step.id} has no dependencies but is not an entry step`)
        return false
      }
      
      // 使用缓存检查依赖
      const canRun = isAllDepsMet(deps, setKeys, depsCache)
      if (canRun) {
        this.logger.debug(`Dependencies for step ${step.id} are satisfied, can run`)
      } else {
        this.logger.debug(`Dependencies for step ${step.id} are not satisfied, cannot run yet`, { deps })
      }
      
      return canRun
    })
    
    this.logger.debug('Found runnable steps', { count: runnableSteps.length })
    return runnableSteps
  }

  // getNextStep 方法已被 getAllRunnableSteps 替代，不再需要

  moveStepToRun(step: Step, stepsNotRun: Step[], stepsRun: Step[]) {
    // stepsNotRun = stepsNotRun.filter(s => s.id !== step.id)
    const index = stepsNotRun.indexOf(step)
    if (index !== -1) {
      stepsNotRun.splice(index, 1)
      stepsRun.push(step)
      this.logger.debug(`Step ${step.id} moved to run list`, { notRunCount: stepsNotRun.length, runCount: stepsRun.length })
    } else {
      this.logger.warn(`Attempted to move step not in the not-run list: ${step.id}`)
    }
  }

  json() {
    // TODO
  }
}

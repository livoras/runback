import { collect, collectFromRefString, inject } from "./ref"
import { createProxy } from "./createProxy"
import { Logger, LogLevel, createDefaultLogger } from "./logger"

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

export type RunOptions = {
  actions?: Record<string, Function>,
  history?: any[], // 执行记录数组
  useHisotry?: boolean,
  onlyRuns?: string[],
  entry?: string,
  logLevel?: LogLevel,
}

// 步骤执行记录
interface StepExecutionRecord {
  id: string;             // 步骤唯一ID
  action: string;         // 执行的操作名
  startTime: string;      // ISO格式开始时间
  endTime: string;        // ISO格式结束时间
  duration: number;       // 执行时长(毫秒)
  status: 'success' | 'failed' | 'skipped'; // 执行状态
  options?: Record<string, any>; // 步骤配置选项（来自step.options）
  inputs: any;            // 输入参数（来自runOptions）
  outputs?: any;          // 输出结果
  error?: {               // 错误信息(如果执行失败)
    message: string;
    stack?: string;
  };
  context: any;           // 执行时的上下文
}

// 工作流运行记录
interface RunHistoryRecord {
  runId: string;          // 运行唯一ID (使用uuid生成)
  startTime: string;      // 工作流开始时间
  endTime: string;        // 工作流结束时间
  duration: number;       // 总执行时长
  status: 'completed' | 'failed' | 'partial'; // 最终状态
  steps: { [stepId: string]: StepExecutionRecord }; // 步骤记录映射
  context: any;           // 最终上下文快照
}

type WorkflowHistory = RunHistoryRecord[];

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
 * @param deps 依赖列表
 * @param setKeys 已设置的键集合
 * @param cache 依赖检查缓存
 * @returns 是否所有依赖都已满足
 */
const isAllDepsMet = (deps: string[], setKeys: Set<string>, cache: Map<string, boolean> = new Map()) => {
  // 如果没有依赖，直接返回 true
  if (deps.length === 0) return true
  
  // 使用缓存键（依赖数组+setKeys大小）来检查是否有缓存结果
  const cacheKey = `${deps.join('|')}:${setKeys.size}`
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }
  
  const result = deps.every(dep => {
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
  public deps: Record<string, string[]> = {}
  private logger: Logger

  constructor(public options: WorkflowOptions, logLevel: LogLevel = LogLevel.INFO) {
    this.logger = createDefaultLogger(logLevel)
    this.options.steps && this.parseDepends(this.options.steps)
    this.logger.debug('Dependency parsing completed', this.deps)
  }

  parseDepends(steps: Step[]) {
    for (const step of steps) {
      const depends = step.depends ?? []
      const optionsDeps =  collectFromRefString(step.options || {})
      const deps = [...depends, ...Object.values(optionsDeps)]
      if (step.each) {
        deps.push(step.each.replace("$ref.", ''))
      }
      this.deps[step.id] = deps
    }
  }

  async run(options?: RunOptions, stepsNotRun: Step[] = [...this.options.steps], stepsRun: Step[] = []) {
    // 如果提供了日志级别，则更新日志管理器的级别
    if (options?.logLevel !== undefined) {
      this.logger.setLevel(options.logLevel)
    }
    
    // 初始化执行记录数组
    const history = options?.history || []
    
    let setKeys: Set<string> = new Set()
    let ctx = this.createContext(setKeys)
    
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
        this.executeStep(step, options, ctx, stepsNotRun, stepsRun)
      ))
    }
    
    // 将最终的上下文状态添加到执行记录中
    history.push(clone(ctx))
    
    this.logger.info('Workflow execution completed')
    return history
  }
  
  private createContext(setKeys: Set<string>) {
    return createProxy({}, (path, value) => {
      this.logger.debug('--> Context change', path, value)
      setKeys.add(path)
      this.logger.debug('Updated key set', Array.from(setKeys))
    })
  }
  
  private async executeStep(step: Step, options: RunOptions | undefined, ctx: any, stepsNotRun: Step[], stepsRun: Step[]) {
    this.logger.info(`Executing step: ${step.id}`, { action: step.action, type: step.type })
    
    const action = options?.actions?.[step.action]
    if (!action) {
      const errorMsg = `Action not found: ${step.action}`
      this.logger.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    try {
      if (step.each) {
        await this.executeEachStep(step, action, ctx)
      } else {
        await this.executeNormalStep(step, action, ctx)
      }
      
      this.moveStepToRun(step, stepsNotRun, stepsRun)
      this.logger.info(`Step ${step.id} execution completed`)
    } catch (error) {
      this.logger.error(`Step ${step.id} execution failed`, error)
      throw error
    }
  }
  
  private async executeNormalStep(step: Step, action: Function, ctx: any) {
    this.logger.debug(`Preparing to execute normal step: ${step.id}`)
    
    const actionOption = this.prepareActionOptions(step, ctx)
    this.logger.debug(`Options for step ${step.id}`, actionOption)
    
    const result = actionOption ? await action(actionOption) : await action()
    this.logger.debug(`Result of step ${step.id}`, result)
    
    if (step.type === 'if') {
      const branch = result ? 'true' : 'false'
      ctx[`${step.id}.${branch}`] = true
      this.logger.debug(`Conditional step ${step.id} branch: ${branch}`)
    } else {
      ctx[step.id] = result
    }
    
    return result
  }
  
  private async executeEachStep(step: Step, action: Function, ctx: any) {
    this.logger.debug(`Preparing to execute iteration step: ${step.id}`)
    
    const each = step.each!.replace("$ref.", '')
    const list = getByPath(ctx, each)
    
    if (!Array.isArray(list)) {
      const errorMsg = `Data source ${each} for iteration step ${step.id} is not an array`
      this.logger.error(errorMsg, list)
      throw new Error(errorMsg)
    }
    
    this.logger.debug(`Data source for iteration step ${step.id}`, { path: each, items: list.length })
    
    const results: any[] = []
    await Promise.all(list.map(async (item: any, index: number) => {
      this.logger.debug(`Executing item ${index} of iteration step ${step.id}`)
      const itemOptions = this.prepareEachItemOptions(step, ctx, item, index)
      const result = itemOptions ? await action(itemOptions) : await action()
      this.logger.debug(`Result of item ${index} for iteration step ${step.id}`, result)
      results.push(result)
    }))
    
    this.logger.debug(`All results for iteration step ${step.id}`, { count: results.length })
    ctx[step.id] = results
    return results
  }
  
  private prepareActionOptions(step: Step, ctx: any) {
    if (!step.options) return undefined
    
    const actionOption = clone(step.options)
    const mapping = collectFromRefString(actionOption)
    inject(actionOption, ctx, mapping)
    return actionOption
  }
  
  private prepareEachItemOptions(step: Step, ctx: any, item: any, index: number) {
    if (!step.options) return undefined
    
    const itemOptions = clone(step.options)
    const mapping = collectFromRefString(itemOptions)
    inject(itemOptions, { ...ctx, $item: item, $index: index }, mapping)
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
    
    const runnableSteps = stepsNotRun.filter(step => {
      // 入口步骤总是可运行的
      if (step.id === runOptions?.entry) {
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

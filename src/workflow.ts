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
  each?: string | any[],
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
  return p.split('.').reduce((a, k) => {
    if (a == null) return undefined
    // 如果键是数字字符串且当前对象是数组，则转换为数字索引
    if (Array.isArray(a) && /^\d+$/.test(k)) {
      return a[parseInt(k, 10)]
    }
    return a[k]
  }, o)
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
      
      // 处理逗号分隔的依赖：将 'stepA,stepB' 转换为 ['stepA', 'stepB']
      const processedDepends: (string | string[])[] = []
      for (const dep of depends) {
        if (dep.includes(',')) {
          // 如果包含逗号，分割成数组（OR关系）
          processedDepends.push(dep.split(',').map(d => d.trim()))
        } else {
          // 单个依赖保持原样
          processedDepends.push(dep)
        }
      }
      
      const deps = [...processedDepends, ...Object.values(optionsDeps)] as (string | string[])[] 
      if (step.each) {
        if (typeof step.each === 'string') {
          // 字符串形式的 each，直接添加依赖
          let eachDep = step.each.replace("$ref.", '')
          // 处理数组索引语法: [0] -> .0
          eachDep = eachDep.replace(/\[(\d+)\]/g, '.$1')
          deps.push(eachDep)
        } else if (Array.isArray(step.each)) {
          // 数组形式的 each，使用 collectFromRefString 来收集依赖
          const eachDeps = collectFromRefString(step.each)
          deps.push(...Object.values(eachDeps))
        }
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
    
    // 处理运行模式：确定入口点和过滤步骤
    let entrySteps: string[] = []
    let filteredSteps: Step[] = stepsNotRun
    
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
      filteredSteps = stepsNotRun.filter(step => pathSteps.includes(step.id))
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
  
  /**
   * 解析引用路径，处理 $ref. 前缀和数组索引语法
   * @param refString 引用字符串
   * @returns 处理后的路径字符串
   */
  private parseRefPath(refString: string): string {
    let refPath = refString.replace("$ref.", '')
    return refPath.replace(/\[(\d+)\]/g, '.$1')
  }

  /**
   * 通用的引用解析函数，处理对象中的所有 $ref 引用
   * @param obj 要处理的对象
   * @param ctx 上下文
   * @returns 解析后的对象
   */
  private resolveReferences(obj: any, ctx: any): any {
    const clonedObj = clone(obj)
    const mapping = collectFromRefString(clonedObj)
    const stringMapping = this.convertMappingToStringMapping(mapping, ctx)
    inject(clonedObj, ctx, stringMapping)
    return clonedObj
  }

  /**
   * 解析单个引用值
   * @param value 可能是引用的值
   * @param ctx 上下文
   * @returns 解析后的实际值
   */
  private resolveRefValue(value: any, ctx: any): any {
    if (typeof value === 'string' && value.startsWith('$ref.')) {
      const refPath = this.parseRefPath(value)
      return getByPath(ctx, refPath)
    }
    
    // 如果是对象或数组，需要递归处理内部的引用
    if (value && typeof value === 'object') {
      return this.resolveReferences(value, ctx)
    }
    
    return value
  }

  /**
   * 解析 each 中的引用并返回实际的列表
   * @param each each 配置值
   * @param ctx 上下文
   * @returns 解析后的数组
   */
  private resolveEachList(each: string | any[], ctx: any): any[] {
    if (Array.isArray(each)) {
      // 如果 each 是数组，需要解析其中的引用
      return each.map(item => this.resolveRefValue(item, ctx))
    } else {
      // 如果 each 是字符串，从上下文中获取
      return this.resolveRefValue(each, ctx)
    }
  }

  private async executeEachStep(step: Step, action: Function, ctx: any, stepRecord: StepExecutionRecord) {
    this.logger.debug(`Preparing to execute iteration step: ${step.id}`)
    
    const list = this.resolveEachList(step.each!, ctx)
    
    if (Array.isArray(step.each)) {
      this.logger.debug(`Using processed array for iteration step ${step.id}`, { items: list.length })
    } else {
      this.logger.debug(`Data source for iteration step ${step.id}`, { path: this.parseRefPath(step.each!), items: list?.length })
    }

    const inputs: any = []
    stepRecord.inputs = inputs
    
    const results: any[] = []
    stepRecord.outputs = results
    
    if (!Array.isArray(list)) {
      const errorMsg = `Data source for iteration step ${step.id} is not an array`
      this.logger.error(errorMsg, list)
      throw new Error(errorMsg)
    }

    await Promise.all(list.map(async (item: any, index: number) => {
      this.logger.debug(`Executing item ${index} of iteration step ${step.id}`)
      
      let actionParam: any
      if (Array.isArray(step.each)) {
        // 如果 each 是具体数组，忽略 options，直接用解析好的数据
        actionParam = item
      } else {
        // 如果 each 是字符串引用，才考虑用 options 模板
        if (step.options) {
          actionParam = this.prepareEachItemOptions(step, ctx, item, index)
        } else {
          actionParam = item
        }
      }
      
      
      inputs.push(actionParam)
      const result = actionParam !== undefined ? await action(actionParam) : await action()
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
          // 特殊处理 $item 和 $index
          if (v === '$item' || v === '$index') {
            return ctx[v] !== undefined
          }
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
        // 特殊处理 $item 和 $index
        if (value === '$item' || value === '$index') {
          stringMapping[key] = value
        } else {
          stringMapping[key] = value
        }
      }
    }
    this.logger.debug('-------->', stringMapping)
    return stringMapping
  }

  private prepareActionOptions(step: Step, ctx: any) {
    if (!step.options) return undefined
    
    return this.resolveReferences(step.options, ctx)
  }
  
  private prepareEachItemOptions(step: Step, ctx: any, item: any, index: number) {
    if (!step.options) return undefined
    
    const itemContext = { ...ctx, $item: item, $index: index }
    return this.resolveReferences(step.options, itemContext)
  }



  /**
   * 获取所有可运行的步骤
   * @param runOptions 运行选项
   * @param stepsNotRun 未运行的步骤列表
   * @param ctx 上下文
   * @param setKeys 已设置的键集合
   * @param entrySteps 入口步骤列表（用于支持多入口点）
   * @returns 可运行的步骤列表
   */
  getAllRunnableSteps(runOptions: RunOptions, stepsNotRun: Step[], ctx: any, setKeys: Set<string>, entrySteps: string[] = []) {
    // 创建依赖检查缓存，避免重复计算
    const depsCache = new Map<string, boolean>()
    
    this.logger.debug('Checking runnable steps', { stepsCount: stepsNotRun.length, entrySteps })
    
    // 如果指定了 onlyRuns，则跳过依赖检查，直接返回匹配的步骤
    if (runOptions.onlyRuns?.length) {
      this.logger.debug('Running in onlyRuns mode, skipping dependency checks');
      return stepsNotRun.filter(step => runOptions.onlyRuns?.includes(step.id));
    }
    
    const runnableSteps = stepsNotRun.filter(step => {
      // 入口步骤总是可运行的
      if (entrySteps.includes(step.id)) {
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
        // 对于没有依赖且不是入口步骤的情况，给出警告
        if (entrySteps.length > 0) {
          this.logger.warn(`Step ${step.id} has no dependencies but is not in entry steps`)
        } else {
          this.logger.warn(`Step ${step.id} has no dependencies but no entry specified`)
        }
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

  /**
   * 获取指定步骤的所有根步骤
   * @param stepId 要查找根步骤的步骤ID
   * @returns 包含所有根步骤ID的数组
   */
  getRootSteps(stepId: string): string[] {
    // 检查步骤是否存在
    const step = this.options.steps.find(s => s.id === stepId)
    if (!step) {
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

      const currentStepDeps = this.deps[currentStepId] || []
      
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
            const rootStepId = this.extractStepIdFromDep(d)
            if (rootStepId) {
              findRoots(rootStepId)
            }
          })
        } else {
          // 处理字符串形式的依赖
          const rootStepId = this.extractStepIdFromDep(dep)
          if (rootStepId) {
            findRoots(rootStepId)
          }
        }
      })
    }

    findRoots(stepId)
    
    return Array.from(rootSteps).sort() // 返回排序后的数组
  }

  /**
   * 从依赖字符串中提取步骤ID
   * @param dep 依赖字符串，可能是 "stepId"、"stepId.property" 等
   * @returns 提取出的步骤ID，如果无效则返回null
   */
  private extractStepIdFromDep(dep: string): string | null {
    // 跳过特殊依赖
    if (dep.startsWith('$item') || dep.startsWith('$index')) {
      return null
    }

    // 提取根步骤ID（取第一个点之前的部分）
    const parts = dep.split('.')
    const stepId = parts[0]
    
    // 检查步骤是否存在
    const stepExists = this.options.steps.some(s => s.id === stepId)
    return stepExists ? stepId : null
  }

  /**
   * 获取到达指定步骤所需的所有步骤（包括目标步骤本身）
   * @param targetStepId 目标步骤ID
   * @returns 包含所有必要步骤ID的数组
   */
  getPathSteps(targetStepId: string): string[] {
    // 检查步骤是否存在
    const step = this.options.steps.find(s => s.id === targetStepId)
    if (!step) {
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

      const currentStepDeps = this.deps[currentStepId] || []
      
      // 递归查找每个依赖的步骤
      currentStepDeps.forEach(dep => {
        if (Array.isArray(dep)) {
          // 处理数组形式的依赖（或关系）- 这里我们需要所有可能的分支
          dep.forEach(d => {
            const depStepId = this.extractStepIdFromDep(d)
            if (depStepId) {
              findPathSteps(depStepId)
            }
          })
        } else {
          // 处理字符串形式的依赖
          const depStepId = this.extractStepIdFromDep(dep)
          if (depStepId) {
            findPathSteps(depStepId)
          }
        }
      })
    }

    findPathSteps(targetStepId)
    
    return Array.from(pathSteps).sort() // 返回排序后的数组
  }

  json() {
    // TODO
  }
}

import { collect, collectFromRefString, inject } from "./ref"
import { WorkflowEngine, RunOptions, RunHistoryRecord } from "./workflow-engine"
import { LogLevel } from "./logger"

export type Step = {
  id: string,
  action: string,
  type?: "trigger" | "step" | "if",
  name?: string,
  options?: Record<string, any>,
  each?: string | any[],
}

export type WorkflowOptions = {
  steps: Step[],
}

// 重新导出引擎中的类型
export { RunStatus, RunHistoryRecord, RunOptions } from "./workflow-engine"

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

export class Workflow extends WorkflowEngine<Step> {
  public entry: string | undefined
  public deps: Record<string, (string | string[])[]> = {}

  constructor(public options: WorkflowOptions, logLevel: LogLevel = LogLevel.INFO) {
    super(logLevel)
    this.options.steps && this.parseDepends(this.options.steps)
    this.logger.debug('Dependency parsing completed', this.deps)
  }

  // 实现抽象方法
  protected getAllSteps(): Step[] {
    return this.options.steps || []
  }

  protected getStepId(step: Step): string {
    return step.id
  }

  protected parseDependencies(steps: Step[]): void {
    this.parseDepends(steps)
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
      
      // 从 options 中收集所有 $ref 依赖
      const optionsDeps = collectFromRefString(step.options || {})
      const deps = [...Object.values(optionsDeps)] as (string | string[])[] 
      
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

  /**
   * 获取所有可运行的步骤
   * @param runOptions 运行选项
   * @param stepsNotRun 未运行的步骤列表
   * @param ctx 上下文
   * @param setKeys 已设置的键集合
   * @param entrySteps 入口步骤列表（用于支持多入口点）
   * @returns 可运行的步骤列表
   */
  // 实现可运行步骤判断的抽象方法 - V1 特定实现
  protected isStepDependenciesSatisfied(step: Step, setKeys: Set<string>, depsCache: Map<string, boolean>): boolean {
    const deps = this.deps[step.id]
    return this.isAllDepsMet(deps, setKeys, depsCache)
  }

  /**
   * 检查所有依赖是否已满足 - V1 特定实现
   * @param deps 依赖列表，每个依赖可以是字符串或字符串数组（表示"或"关系）
   * @param setKeys 已设置的键集合
   * @param cache 依赖检查缓存
   * @returns 是否所有依赖都已满足
   */
  private isAllDepsMet(deps: (string | string[])[], setKeys: Set<string>, cache: Map<string, boolean> = new Map()) {
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

  protected applyEntryOptions(step: Step, entryOptions: any): void {
    // Merge entryOptions with existing options, with entryOptions taking precedence
    step.options = {
      ...(step.options || {}),
      ...entryOptions
    };
  }

  // 实现步骤执行抽象方法 - V1 特定实现
  protected isEachStep(step: Step): boolean {
    return !!step.each
  }

  protected prepareStepInput(step: Step, ctx: any): any {
    return this.prepareActionOptions(step, ctx)
  }

  protected prepareEachStepInput(step: Step, ctx: any): { list: any[], prepareItemInput: (item: any, index: number) => any } {
    const list = this.resolveEachList(step.each!, ctx)
    
    const prepareItemInput = (item: any, index: number) => {
      if (Array.isArray(step.each)) {
        // 如果 each 是具体数组，忽略 options，直接用解析好的数据
        return item
      } else {
        // 如果 each 是字符串引用，才考虑用 options 模板
        if (step.options) {
          return this.prepareEachItemOptions(step, ctx, item, index)
        } else {
          return item
        }
      }
    }

    return { list, prepareItemInput }
  }

  protected updateContextWithResult(step: Step, result: any, ctx: any): void {
    if (step.type === 'if') {
      const branch = result ? 'true' : 'false'
      ctx[`${step.id}.${branch}`] = true
      this.logger.debug(`Conditional step ${step.id} branch: ${branch}`)
    } else {
      ctx[step.id] = result
    }
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
    const clonedObj = this.clone(obj)
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

  // 实现依赖图抽象方法 - V1 特定实现
  protected getStepDependencies(stepId: string): (string | string[])[] {
    return this.deps[stepId] || []
  }

  protected extractStepIdFromDependency(dep: string): string | null {
    // 跳过特殊依赖
    if (dep.startsWith('$item') || dep.startsWith('$index')) {
      return null
    }

    // 提取根步骤ID（取第一个点之前的部分）
    const parts = dep.split('.')
    const stepId = parts[0]
    
    // 检查步骤是否存在
    return this.stepExists(stepId) ? stepId : null
  }

  protected stepExists(stepId: string): boolean {
    return this.options.steps.some(s => s.id === stepId)
  }

  json() {
    // TODO
  }
}

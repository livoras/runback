import { collect, collectFromRefString, inject } from "./ref"
import { createProxy } from "./createProxy"

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
  history?: Record<string, any>,
  always?: boolean,
  onlyRuns?: string[],
  entry?: string,
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
  const parts = path.split('.');
  return parts.map((_, i) => parts.slice(0, i + 1).join('.'));
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
  return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
}

export class Workflow {
  public entry: string | undefined
  public deps: Record<string, string[]> = {}

  constructor(public options: WorkflowOptions) {
    this.options.steps && this.parseDepends(this.options.steps)
    console.log(this.deps)
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
    let setKeys: Set<string> = new Set()
    let ctx = this.createContext(setKeys)
    
    while (stepsNotRun.length > 0) {
      const readySteps = this.getAllRunnableSteps(options || {}, stepsNotRun, ctx, setKeys)
      if (readySteps.length === 0) break
      
      console.log('\n--------------------------------')
      console.log('readySteps', readySteps)
      
      await Promise.all(readySteps.map(step => 
        this.executeStep(step, options, ctx, stepsNotRun, stepsRun)
      ))
    }
  }
  
  private createContext(setKeys: Set<string>) {
    return createProxy({}, (path, value) => {
      console.log('--> change', path, value)
      setKeys.add(path)
      console.log('after setKeys', setKeys)
    })
  }
  
  private async executeStep(step: Step, options: RunOptions | undefined, ctx: any, stepsNotRun: Step[], stepsRun: Step[]) {
    const action = options?.actions?.[step.action]
    if (!action) throw new Error(`action ${step.action} not found`)
    
    if (step.each) {
      await this.executeEachStep(step, action, ctx)
    } else {
      await this.executeNormalStep(step, action, ctx)
    }
    
    this.moveStepToRun(step, stepsNotRun, stepsRun)
  }
  
  private async executeNormalStep(step: Step, action: Function, ctx: any) {
    const actionOption = this.prepareActionOptions(step, ctx)
    const result = actionOption ? await action(actionOption) : await action()
    
    if (step.type === 'if') {
      const branch = result ? 'true' : 'false'
      ctx[`${step.id}.${branch}`] = result === true
    } else {
      ctx[step.id] = result
    }
    
    return result
  }
  
  private async executeEachStep(step: Step, action: Function, ctx: any) {
    console.log("each step")
    const each = step.each!.replace("$ref.", '')
    const list = getByPath(ctx, each)
    console.log(each, list)
    
    const results: any[] = []
    await Promise.all(list.map(async (item: any, index: number) => {
      const itemOptions = this.prepareEachItemOptions(step, ctx, item, index)
      const result = itemOptions ? await action(itemOptions) : await action()
      console.log('each result', result)
      results.push(result)
    }))
    
    console.log('run each results', results)
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
    
    return stepsNotRun.filter(step => {
      // 入口步骤总是可运行的
      if (step.id === runOptions?.entry) return true
      
      const deps = this.deps[step.id]
      if (deps.length === 0) {
        console.warn(`步骤 ${step.id} 没有依赖，但不是入口步骤`)
        return false
      }
      
      // 使用缓存检查依赖
      return isAllDepsMet(deps, setKeys, depsCache)
    })
  }

  // getNextStep 方法已被 getAllRunnableSteps 替代，不再需要

  moveStepToRun(step: Step, stepsNotRun: Step[], stepsRun: Step[]) {
    // stepsNotRun = stepsNotRun.filter(s => s.id !== step.id)
    stepsNotRun.splice(stepsNotRun.indexOf(step), 1)
    stepsRun.push(step)
  }

  json() {
    // TODO
  }
}

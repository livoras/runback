import { WorkflowEngine, getPrefixes, getByPath } from './workflow-engine'
import { LogLevel } from './logger'
import { injectInput, Context, RefMapping } from './injectInput'

// V2 步骤定义
export type Step2 = {
  id: string,
  action: string,
  each: boolean,  // V2中each是布尔值，不是数组或字符串
  input: any,
  ref?: RefMapping,  // V2使用ref对象进行字段映射
  type?: string  // 添加type字段支持条件步骤
}

export type WorkflowOptions2 = {
  steps: Step2[],
}

/**
 * V2 语法工作流实现
 * 基于 injectInput 的部分映射语义和 ref 对象的字段级映射
 */
export class Workflow2 extends WorkflowEngine<Step2> {
  public entry: string | undefined
  public deps: Record<string, (string | string[])[]> = {}

  constructor(public options: WorkflowOptions2, logLevel: LogLevel = LogLevel.INFO) {
    super(logLevel)
    this.parseDependencies(this.options.steps)
  }

  // 实现基础抽象方法 - V2 特定
  protected getAllSteps(): Step2[] {
    return this.options.steps
  }

  protected getStepId(step: Step2): string {
    return step.id
  }

  protected parseDependencies(steps: Step2[]): void {
    this.parseDepends(steps)
  }

  /**
   * 解析V2语法的依赖关系
   * V2的依赖来自于ref对象的值，而不是像V1那样从options中解析$ref
   */
  private parseDepends(steps: Step2[]) {
    const idsSet = new Set(steps.map(s => s.id))
    
    steps.forEach(step => {
      const stepId = step.id
      const deps: (string | string[])[] = []
      
      if (step.ref) {
        // 从ref对象的值中提取依赖
        Object.values(step.ref).forEach(refValue => {
          const refDeps = this.extractDependenciesFromRefValue(refValue)
          deps.push(...refDeps)
        })
      }
      
      this.deps[stepId] = deps
      
      // 验证依赖的有效性
      this.checkDepsValid(deps, idsSet, stepId)
    })
    
    this.logger.debug('V2 Dependencies parsed', this.deps)
  }

  /**
   * 从ref值中提取依赖关系
   * V2支持备选引用（逗号分隔），需要解析所有可能的依赖
   */
  private extractDependenciesFromRefValue(refValue: string): (string | string[])[] {
    // 处理备选引用（逗号分隔）
    const alternatives = refValue.split(',').map(s => s.trim())
    
    if (alternatives.length === 1) {
      // 单一引用
      return [alternatives[0]]
    } else {
      // 多个备选引用，构成或关系
      return [alternatives]
    }
  }

  /**
   * 验证依赖有效性 - V2版本
   */
  private checkDepsValid(deps: (string | string[])[], idsSet: Set<string>, stepId: string) {
    this.validateDependencies(deps, idsSet, stepId)
  }

  // 实现特殊依赖判断 - V2 特定
  protected isSpecialDependency(dep: string): boolean {
    // V2中，备选引用可能包含不存在的步骤，这是允许的
    const stepId = dep.split('.')[0]
    return !this.stepExists(stepId)
  }

  // 实现依赖满足判断 - V2 特定实现
  protected isStepDependenciesSatisfied(step: Step2, setKeys: Set<string>, depsCache: Map<string, boolean>): boolean {
    const stepId = step.id
    const deps = this.deps[stepId]
    
    if (!deps || deps.length === 0) {
      return true
    }
    
    return this.isAllDepsMet(deps, setKeys, depsCache)
  }

  /**
   * 检查所有依赖是否满足 - V2版本
   * V2的依赖检查逻辑与V1类似，但引用格式不同
   */
  private isAllDepsMet(deps: (string | string[])[], setKeys: Set<string>, cache: Map<string, boolean> = new Map()) {
    const cacheKey = JSON.stringify(deps)
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!
    }
    
    const result = deps.every(dep => {
      if (Array.isArray(dep)) {
        // 或关系：任意一个满足即可（备选引用）
        return dep.some(d => {
          const prefixes = getPrefixes(d)
          return prefixes.some(prefix => setKeys.has(prefix))
        })
      } else {
        // 单一依赖：检查前缀路径是否已满足
        const prefixes = getPrefixes(dep)
        return prefixes.some(prefix => setKeys.has(prefix))
      }
    })
    
    cache.set(cacheKey, result)
    return result
  }

  // 实现选项访问抽象方法 - V2中使用input代替options
  protected getStepOptions(step: Step2): any {
    // V2使用input代替options
    return step.input
  }

  protected setStepOptions(step: Step2, options: any): void {
    // V2直接修改step.input，复用基类的通用entryOptions逻辑
    step.input = options
  }

  // 实现步骤执行抽象方法 - V2 特定实现
  protected isEachStep(step: Step2): boolean {
    return step.each === true
  }

  protected prepareStepInput(step: Step2, ctx: any): any {
    // 使用V2的injectInput进行部分映射
    // entryOptions已经通过基类的applyEntryOptions合并到step.input中
    return injectInput(step.input, step.ref || {}, ctx)
  }

  protected prepareEachStepInput(step: Step2, ctx: any): { list: any[], prepareItemInput: (item: any, index: number) => any } {
    // V2中each是布尔值，数据来源于input经过ref映射后的结果
    const processedInput = injectInput(step.input, step.ref || {}, ctx)
    
    // V2的each模式下，processedInput应该是一个数组
    if (!Array.isArray(processedInput)) {
      throw new Error(`Step ${step.id} is marked as each=true but processed input is not array: ${typeof processedInput}`)
    }
    
    const list = processedInput
    
    const prepareItemInput = (item: any, index: number) => {
      // V2的each模式下，每个item就是直接的输入数据
      return item
    }

    return { list, prepareItemInput }
  }

  // 实现依赖图抽象方法 - V2 特定实现
  protected getStepDependencies(stepId: string): (string | string[])[] {
    return this.deps[stepId] || []
  }

  protected extractStepIdFromDependency(dep: string): string | null {
    // V2的引用格式：taskId.path.to.field
    // 提取根步骤ID（取第一个点之前的部分）
    const parts = dep.split('.')
    const stepId = parts[0]
    
    // 检查步骤是否存在
    return this.stepExists(stepId) ? stepId : null
  }

  protected stepExists(stepId: string): boolean {
    return this.options.steps.some(s => s.id === stepId)
  }

  /**
   * 序列化工作流定义为JSON
   */
  json() {
    return {
      steps: this.options.steps,
      dependencies: this.deps
    }
  }
} 
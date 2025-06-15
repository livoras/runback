import path from "path";
import { RunHistoryRecord, RunOptions, Step, Workflow, WorkflowOptions } from "./workflow";
import { Step2, Workflow2, WorkflowOptions2 } from "./workflow2";
import { WorkflowEngine } from "./workflow-engine";
import fs from 'fs-extra'

/**
 * 抽象的工作基类，支持不同版本的工作流引擎
 */
abstract class WorkBase<TStep, TWorkflow extends WorkflowEngine<TStep>> {
  public lastRun: RunHistoryRecord | null = null
  public steps: TStep[] = []
  private stepsMap: Record<string, TStep> = {}

  constructor(public actions?: Record<string, Function>, public savePath?: string) { }

  // 抽象方法 - 子类实现具体的工作流创建逻辑
  protected abstract createWorkflow(steps: TStep[]): TWorkflow
  protected abstract getStepId(step: TStep): string
  protected abstract getVersionTag(): string

  private json() {
    return { 
      version: this.getVersionTag(),
      steps: Object.values(this.stepsMap), 
      lastRun: this.lastRun 
    }
  }

  public async save(savePath?: string) {
    savePath = savePath || this.savePath
    if (!savePath) {
      throw new Error('savePath is required')
    }
    const dir = path.dirname(savePath)
    await fs.ensureDir(dir)
    await fs.writeFile(savePath, JSON.stringify(this.json(), null, 2))
  }

  public async load(path?: string) {
    path = path || this.savePath
    if (!path) {
      throw new Error('path is required')
    }
    if (!await fs.exists(path)) { return }
    const json = await fs.readFile(path, 'utf-8')
    const { steps, lastRun, version } = JSON.parse(json)
    
    // 版本检查（可选的警告）
    if (version && version !== this.getVersionTag()) {
      console.warn(`Loading ${version} workflow data into ${this.getVersionTag()} work instance`)
    }
    
    this.steps = steps
    this.lastRun = lastRun
    this.init()
  }

  private init() {
    this.steps.forEach(step => {
      const stepId = this.getStepId(step)
      this.stepsMap[stepId] = step
    })
  }

  public async step(step: TStep, run: boolean = true) {
    const stepId = this.getStepId(step)
    this.stepsMap[stepId] = step
    this.steps = Object.values(this.stepsMap)
    const steps = this.steps
    
    if (run) {
      const workflow = this.createWorkflow(steps)
      const oldHistory: RunHistoryRecord[] = this.lastRun ? [this.lastRun] : []
      const history = await workflow.run({ 
        actions: this.actions, 
        history: oldHistory, 
        onlyRuns: [stepId] 
      })
      this.lastRun = history[history.length - 1]
    }
    
    if (this.savePath) {
      await this.save(this.savePath)
    }
    return this.json()
  }

  public async run(options: RunOptions<TStep>) {
    const steps = Object.values(this.stepsMap)
    const workflow = this.createWorkflow(steps)
    return await workflow.run({ ...options, actions: this.actions || {} })
  }
}

/**
 * V1 工作流的 Work 类 - 保持向后兼容性
 */
export class Work extends WorkBase<Step, Workflow> {
  protected createWorkflow(steps: Step[]): Workflow {
    return new Workflow({ steps })
  }

  protected getStepId(step: Step): string {
    return step.id
  }

  protected getVersionTag(): string {
    return 'v1'
  }
}

/**
 * V2 工作流的 Work 类
 */
export class Work2 extends WorkBase<Step2, Workflow2> {
  protected createWorkflow(steps: Step2[]): Workflow2 {
    return new Workflow2({ steps })
  }

  protected getStepId(step: Step2): string {
    return step.id
  }

  protected getVersionTag(): string {
    return 'v2'
  }
}

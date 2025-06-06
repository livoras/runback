import path from "path";
import { RunHistoryRecord, RunOptions, Step, Workflow, WorkflowOptions } from "./workflow";
import fs from 'fs-extra'

export class Work {
  public lastRun: RunHistoryRecord | null = null
  public steps: Step[] = []
  private stepsMap: Record<string, Step> = {}

  constructor(public actions?: Record<string, Function>, public savePath?: string) { }

  private json() {
    return { steps: Object.values(this.stepsMap), lastRun: this.lastRun }
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
    const { steps, lastRun } = JSON.parse(json)
    this.steps = steps
    this.lastRun = lastRun
    this.init()
  }

  private init() {
    this.steps.forEach(step => {
      this.stepsMap[step.id] = step
    })
  }


  public async step(step: Step, run: boolean = true) {
    this.stepsMap[step.id] = step
    const steps = Object.values(this.stepsMap)
    if (run) {
      const workflow = new Workflow({ steps })
      const oldHistory: RunHistoryRecord[] = this.lastRun ? [this.lastRun] : []
      const history = await workflow.run({ ...step.options, actions: this.actions, history: oldHistory, onlyRuns: [step.id] })
      this.lastRun = history[history.length - 1]
    }
    if (this.savePath) {
      await this.save(this.savePath)
    }
    return this.json()
  }

  public async run(options: RunOptions) {
    const steps = Object.values(this.stepsMap)
    const workflow = new Workflow({ steps })
    return await workflow.run({ ...options, actions: this.actions || {} })
  }
}

import { collect, collectFromRefString, inject } from "./ref"
import { createProxy } from "./createProxy"

type Step = {
  id: string,
  action: string,
  type?: "trigger" | "step" | "if",
  name?: string,
  options?: Record<string, any>,
  depends?: string[],
  each?: string,
}

type WorkflowOptions = {
  steps: Step[],
}

type RunOptions = {
  actions?: Record<string, Function>,
  history?: Record<string, any>,
  always?: boolean,
  onlyRuns?: string[],
  entry?: string,
}

const actions = {
  start: () => {
    console.log("start")
  },
  getUserInfo: (options: { id: number }) => {
    if (!options?.id) {
      throw new Error("id is required")
    }
    console.log("run action getUserInfo", options.id)
    return { name: "jerry"  }
  },
  sayHi: ({ input: { name } }: { input: { name: string } }) => {
    console.log(`run action sayHi!! ${name}`)
    return { result: `hi!!! ${name}` }
  },
  log: (message: string) => {
    console.log(`run action log ${message}`)
  }
}

const clone = (obj: any) => {
  return JSON.parse(JSON.stringify(obj))
}

class Workflow {
  public entry: string | undefined

  constructor(public options: WorkflowOptions) {
    this.options.steps && this.parseDepends(this.options.steps)
  }

  parseDepends(steps: Step[]) {
    for (const step of steps) {
      console.log(step.id)
      const depends = step.depends ?? []
      const optionsDeps =  collectFromRefString(step.options || {})
      console.log(depends, optionsDeps)
    }
  }

  async run(options?: RunOptions, stepsNotRun: Step[] = [...this.options.steps], stepsRun: Step[] = []) {
    // console.log("TODO", options)
    let step;
    let ctx = createProxy({}, (path, value) => {
      console.log('--> chagne', path, value)
    })
    while (true) {
      step = this.getNextStep(options || {}, stepsNotRun, ctx);
      if (!step) {
        console.log('no step to run done!');
        break;
      }

      console.log(step.id, '--->');
      const action = options?.actions?.[step.action];
      if (!action) {
        throw new Error(`action ${step.action} not found`)
      }

      let actionOption;
      if (step.options) {
        actionOption = clone(step.options)
        const mapping = collectFromRefString(actionOption)
        inject(actionOption, ctx, mapping)
      }

      console.log('calling action', step.action, step.options, actionOption)
      const result = actionOption ? await action(actionOption) : await action()
      if (step.type === 'if') {
        const branch = result ? "true" : "false"
        ctx[step.id][branch] = true
      } else {
        ctx[step.id] = result
      }

      this.moveStepToRun(step, stepsNotRun, stepsRun);
    }
  }

  getNextStep(runOptions: RunOptions, stepsNotRun: Step[], ctx: any) {
    for (let i = 0; i < stepsNotRun.length; i++) {
      const step = stepsNotRun[i]
      if (step.id === runOptions?.entry) {
        return step
      }
    }
    return null
  }

  moveStepToRun(step: Step, stepsNotRun: Step[], stepsRun: Step[]) {
    // stepsNotRun = stepsNotRun.filter(s => s.id !== step.id)
    stepsNotRun.splice(stepsNotRun.indexOf(step), 1)
    stepsRun.push(step)
  }

  json() {
    // TODO
  }
}


const wf = new Workflow({
  steps: [
    { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
    { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } } },
    { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
  ]
})

wf.run({ entry: "getUserInfoId", actions })

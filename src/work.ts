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

const logGreen = (...args: any[]) => {
  console.log(`\x1b[32m${args.join(' ')}\x1b[0m`)
}

const actions = {
  start: () => {
    console.log("start")
  },
  getUserInfo: (options: { id: number }) => {
    if (!options?.id) {
      throw new Error("id is required")
    }
    logGreen("run action getUserInfo", options.id)
    return { name: "lily"  }
  },
  sayHi: ({ input: { name } }: { input: { name: string } }) => {
    logGreen(`run action sayHi!! ${name}`)
    return { result: `hi!!! ${name}` }
  },
  log: ({ message }: { message: string }) => {
    logGreen(`run action log ${message}`)
  },
  checkUserName: ({ name }: { name: string }) => {
    logGreen("run action checkUserName", name)
    return ["jerry", "tom"].includes(name)
  }
}

const clone = (obj: any) => {
  return JSON.parse(JSON.stringify(obj))
}

const getPrefixes = (path: string) => {
  const parts = path.split('.');
  return parts.map((_, i) => parts.slice(0, i + 1).join('.'));
}

const isAllDepsMet = (deps: string[], setKeys: Set<string>) => {
  // console.log("check met", deps, setKeys)
  return deps.every(dep => {
    const prefixes = getPrefixes(dep)
    // console.log('check dep', dep, prefixes, prefixes.some(prefix => setKeys.has(prefix)))
    return prefixes.some(prefix => setKeys.has(prefix))
  })
}

class Workflow {
  public entry: string | undefined
  public deps: Record<string, string[]> = {}

  constructor(public options: WorkflowOptions) {
    this.options.steps && this.parseDepends(this.options.steps)
  }

  parseDepends(steps: Step[]) {
    for (const step of steps) {
      const depends = step.depends ?? []
      const optionsDeps =  collectFromRefString(step.options || {})
      this.deps[step.id] = [...depends, ...Object.values(optionsDeps)]
    }
  }

  async run(options?: RunOptions, stepsNotRun: Step[] = [...this.options.steps], stepsRun: Step[] = []) {
    // console.log("TODO", options)
    let setKeys: Set<string> = new Set()
    let step;
    let ctx = createProxy({}, (path, value) => {
      console.log('--> change', path, value)
      setKeys.add(path)
    })
    while (true) {
      step = this.getNextStep(options || {}, stepsNotRun, ctx, setKeys);
      if (!step) {
        console.log('no step to run done!');
        break;
      }

      console.log(step.id, '--->');
      const action = options?.actions?.[step.action];
      if (!action) {
        throw new Error(`action ${step.action} not found`)
      }
      console.log('\n--------------------------------')

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
        ctx[`${step.id}.${branch}`] = true
      } else {
        ctx[step.id] = result
      }

      this.moveStepToRun(step, stepsNotRun, stepsRun);
    }
  }

  getNextStep(runOptions: RunOptions, stepsNotRun: Step[], ctx: any, setKeys: Set<string>) {
    for (let i = 0; i < stepsNotRun.length; i++) {
      const step = stepsNotRun[i]
      // console.log('\n--------------------------------')
      // console.log("checking...", step.id)
      // // console.log('context -->', ctx)
      // console.log('deps -->', this.deps[step.id])
      // console.log('setKeys -->', setKeys)
      if (step.id === runOptions?.entry) {
        return step
      }
      const deps = this.deps[step.id]
      if (deps.length === 0) {
        console.warn(`step ${step.id} has no deps, but it is not entry`)
      }
      if (isAllDepsMet(deps, setKeys)) {
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
    { id: "checkUserName", action: "checkUserName", options: { name: "$ref.getUserInfoId.name" }, type: "if" },
    { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } }, depends: ["checkUserName.true"] },
    { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
  ]
})

wf.run({ entry: "getUserInfoId", actions })

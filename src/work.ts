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

const actions1 = {
  start: () => {
    console.log("start")
  },
  getUserInfo: (options: { id: number }) => {
    if (!options?.id) {
      throw new Error("id is required")
    }
    logGreen("run action getUserInfo", options.id)
    return { name: "jerry"  }
  },
  sayHi: ({ input: { name } }: { input: { name: string } }) => {
    logGreen(`run action sayHi!! ${name}`)
    return { result: `hi!!! ${name}` }
  },
  log: ({ message }: { message: string }) => {
    logGreen(`run action log ${message}`)
    return "OJBK"
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
    if (dep.startsWith("$item") || dep.startsWith("$index")) {
      return true
    }
    
    const prefixes = getPrefixes(dep)
    // console.log('check dep~~~~~~~', dep, prefixes, prefixes.some(prefix => setKeys.has(prefix)), setKeys)
    return prefixes.some(prefix => setKeys.has(prefix))
  })
}

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
    // console.log("TODO", options)
    let setKeys: Set<string> = new Set()
    let step;
    let ctx = createProxy({}, (path, value) => {
      console.log('--> change', path, value)
      setKeys.add(path)
      console.log('after setKeys', setKeys)
    })
    while (stepsNotRun.length > 0) {
      const readySteps = this.getAllRunnableSteps(options || {}, stepsNotRun, ctx, setKeys);
      if (readySteps.length === 0) break;
      console.log('\n--------------------------------')
      console.log('readySteps', readySteps)
    
      await Promise.all(readySteps.map(async step => {
        const action = options?.actions?.[step.action];
        if (!action) throw new Error(`action ${step.action} not found`);
    
        let actionOption: any;
        if (step.options) {
          actionOption = clone(step.options);
          const mapping = collectFromRefString(actionOption);
          inject(actionOption, ctx, mapping);
        }
    
        if (!step.each) {
          const result = actionOption ? await action(actionOption) : await action();
          if (step.type === 'if') {
            const branch = result ? 'true' : 'false'
            ctx[`${step.id}.${branch}`] = result === true;
          } else {
            ctx[step.id] = result;
          }
        } else {
          console.log("each step")
          const each = step.each.replace("$ref.", '')
          const list = getByPath(ctx, each)
          console.log(each, list)
          const results: any[] = []
          await Promise.all(list.map(async (item: any, index: number) => {
            let itemOptions
            if (step.options) {
              itemOptions = clone(step.options)
              const mapping = collectFromRefString(itemOptions);
              inject(itemOptions, { ...ctx, $item: item, $index: index }, mapping);
            }
            const result = itemOptions ? await action(itemOptions) : await action();
            console.log('each result', result)
            results.push(result)
          }))
          console.log('run each results', results)
          ctx[step.id] = results
        }

        this.moveStepToRun(step, stepsNotRun, stepsRun);
      }));
    }
  }

  getAllRunnableSteps(runOptions: RunOptions, stepsNotRun: Step[], ctx: any, setKeys: Set<string>) {
    return stepsNotRun.filter(step => {
      if (step.id === runOptions?.entry) return true;
      const deps = this.deps[step.id];
      if (deps.length === 0) {
        console.warn(`step ${step.id} has no deps, but it is not entry`)
        return false
      }
      // console.log('check deps', step.id, deps, setKeys)
      return isAllDepsMet(deps, setKeys);
    });
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
        continue
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


// const wf = new Workflow({
//   steps: [
//     { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
//     { id: "checkUserName", action: "checkUserName", options: { name: "$ref.getUserInfoId.name" }, type: "if" },
//     { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } }, depends: ["checkUserName.true"] },
//     { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
//     { id: "logId2", action: "log", options: { message: "$ref.sayHiId.result" } },
//     { id: "logId3", action: "log", options: { message: ["$ref.logId", "$ref.logId2"] } },
//   ]
// })

// wf.run({ entry: "getUserInfoId", actions: actions1 })

const actions = {
  start: () => {
    console.log("start")
  },
  getUserInfo: (options: { id: number }) => {
    if (!options?.id) {
      throw new Error("id is required")
    }
    logGreen("run action getUserInfo", options.id)
    return { name: "jerry"  }
  },
  sayHi: ({ input: { name } }: { input: { name: string } }) => {
    logGreen(`run action sayHi!! ${name}`)
    return { result: `hi!!! ${name}` }
  },
  log: ({ message }: { message: string }) => {
    logGreen(`run action log ${message}`)
    return `${message[0]} - ${message[1]}`
  },
  logItem: ({ message }: { message: string }) => {
    logGreen(`run action logItem ${message}`)
    return message
  },
  checkUserName: ({ name }: { name: string }) => {
    logGreen("run action checkUserName", name)
    return ["jerry", "tom"].includes(name)
  },
  getUserList: () => {
    logGreen("run action getUserList")
    return { list: [{ name: "jerry" }, { name: "tom" }] }
  }
}

const wf2 = new Workflow({
  steps: [
    { id: "getUserListId", action: "getUserList" },
    { id: "logId", action: "log", options: { message: ["$ref.$item.name", "$ref.$index"] }, each: "$ref.getUserListId.list" },
    { id: "logItemId", action: "logItem", options: { message: "$ref.$item" }, each: "$ref.logId" },
  ]
})

wf2.run({ entry: "getUserListId", actions })

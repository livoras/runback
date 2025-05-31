import { Workflow } from './work'
import { LogLevel } from './logger'

// 测试用的操作函数
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

console.log('\n=== Test Workflow 1 (Default Log Level: INFO) ===\n')
const wf = new Workflow({
  steps: [
    { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
    { id: "checkUserName", action: "checkUserName", options: { name: "$ref.getUserInfoId.name" }, type: "if" },
    { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } }, depends: ["checkUserName.true"] },
    { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
    { id: "logId2", action: "log", options: { message: "$ref.sayHiId.result" } },
    { id: "logId3", action: "log", options: { message: ["$ref.logId", "$ref.logId2"] } },
  ]
})

// Run with default log level (INFO)
wf.run({ entry: "getUserInfoId", actions: actions })

console.log('\n=== Test Workflow 2 (Log Level: DEBUG) ===\n')
// Test workflow 2 - Using each functionality with DEBUG log level
const wf2 = new Workflow({
  steps: [
    { id: "getUserListId", action: "getUserList" },
    { id: "logId", action: "log", options: { message: ["$ref.$item.name", "$ref.$index"] }, each: "$ref.getUserListId.list" },
    { id: "logItemId", action: "logItem", options: { message: "$ref.$item" }, each: "$ref.logId" },
  ]
}, LogLevel.DEBUG) // Set log level to DEBUG in constructor

wf2.run({ entry: "getUserListId", actions })


console.log('\n=== Test Workflow 3 (Log Level: ERROR) ===\n')
// Test workflow 3 - Using ERROR log level (minimal logging)
const wf3 = new Workflow({
  steps: [
    { id: "getUserListId", action: "getUserList" },
    { id: "logId", action: "log", options: { message: ["$ref.$item.name", "$ref.$index"] }, each: "$ref.getUserListId.list" },
  ]
})

if (require.main === module) {
  (async () => {
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "step1", options: { name: "jerry" } },
        { id: "step2", action: "step2", options: { user: "$ref.step1" } },
      ]
    })
    const actions = {
      step1: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { name: "jerry" }
      },
      step2: (options: { user: any }) => {
        return { userName: options.user.name }
      }
    }
      const history = await workflow.run({ actions, entry: "step1" })
      console.dir(history, { depth: null, colors: true })
  })();

  (async () => {
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "step1" },
        { id: "step2", action: "step2", each: "$ref.step1", options: { user: "$ref.$item" } },
      ]
    })
    const actions = {
      step1: () => {
        return [{ name: "jerry" }, { name: "tom" }]
      },
      step2: async (options: { user: any }) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { userName: options.user.name }
      }
    }
    const history = await workflow.run({ actions, entry: "step1" })
    console.dir(history, { depth: null, colors: true })

    const history2 = await workflow.run({ actions, entry: "step1", history })
    console.dir(history2, { depth: null, colors: true })
  })();

  (async () => {
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "step1" },
        { id: "step2", action: "step2", each: "$ref.step1", options: { user: "$ref.$item" } },
      ]
    })
    const actions = {
      step1: () => {
        return [{ name: "jerry" }, { name: "tom" }]
      },
      step2: async (options: { user: any }) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { userName: options.user.name }
      }
    }
    const history = await workflow.run({ actions, entry: "step1" })
    console.dir(history, { depth: null, colors: true })

    const history2 = await workflow.run({ actions, entry: "step1", history, onlyRuns: ["step2"] })
    console.dir(history2, { depth: null, colors: true })
  })();

  (async () => {
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "step1" },
        { id: "step2", action: "step2", each: "$ref.step1", options: { user: "$ref.$item" } },
        { id: "step3", action: "step3", options: { total: "$ref.step2.length" } },
      ]
    })
    const actions = {
      step1: () => {
        return [{ name: "jerry" }, { name: "tom" }]
      },
      step2: async (options: { user: any }) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { userName: options.user.name }
      },
      step3: async (options: { total: any }) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return options.total + 1
      }
    }
    const history = await workflow.run({ actions, entry: "step1" })
    console.dir(history, { depth: null, colors: true })

    const history2 = await workflow.run({ actions, entry: "step2", history, resume: true })
    console.dir(history2, { depth: null, colors: true })
  })();
}

// Set log level to ERROR at runtime
// wf3.run({ entry: "getUserListId", actions, logLevel: LogLevel.ERROR })


// console.log('\n=== Test Workflow 4 (Workflow with Error, Log Level: WARN) ===\n')
// // Test workflow 4 - Deliberately introducing an error, using WARN log level
// const wf4 = new Workflow({
//   steps: [
//     { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
//     // Deliberately using a non-existent action
//     { id: "nonExistingAction", action: "nonExistingAction", depends: ["getUserInfoId"] },
//   ]
// }, LogLevel.WARN)

// try {
//   wf4.run({ entry: "getUserInfoId", actions })
// } catch (error: any) {
//   console.log('Caught workflow error:', error.message)
// }

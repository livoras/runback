import { Workflow } from './work'

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

// 注释掉的测试工作流
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

// wf.run({ entry: "getUserInfoId", actions: actions })

// 测试工作流2 - 使用each功能
const wf2 = new Workflow({
  steps: [
    { id: "getUserListId", action: "getUserList" },
    { id: "logId", action: "log", options: { message: ["$ref.$item.name", "$ref.$index"] }, each: "$ref.getUserListId.list" },
    { id: "logItemId", action: "logItem", options: { message: "$ref.$item" }, each: "$ref.logId" },
  ]
})

wf2.run({ entry: "getUserListId", actions })

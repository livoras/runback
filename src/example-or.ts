import { Workflow } from './workflow'
import { LogLevel } from './logger'

// 测试用的操作函数
const logGreen = (...args: any[]) => {
    console.log(`\x1b[32m${args.join(' ')}\x1b[0m`)
}


// (async () => {
//     console.log('\n\n------------fuck------------------------------------------------')
//     const workflow = new Workflow({
//         steps: [
//             { id: "step1", action: "step1" },
//             { id: "step2", action: "check", options: { list: "$ref.step1" }, type: "if" },
//             { id: "step3True", action: "step3", options: { list: "$ref.step1" }, depends: ["step2.true"] },
//             { id: "step3False", action: "step4", options: { list: "$ref.step1" }, depends: ["step2.false"] },
//             { id: "step5", action: "step5", options: { message: "$ref.step3True, $ref.step3False" } },
//         ]
//     })
//     const actions = {
//         step1: () => {
//             return [{ name: "jerry" }, { name: "tom" }]
//         },
//         check: async (options: { list: any[] }) => {
//             return options.list.length > 1
//         },
//         step3: async (options: { list: any[] }) => {
//             console.log(">>>>>>>> true list", options.list)
//             return 'from true branch'
//         },
//         step4: async (options: { list: any[] }) => {
//             console.log("<<<<<<<< false list", options.list)
//             return 'from false branch'
//         },
//         step5: async (options: { message: string }) => {
//             console.log(">>>>>>>> Step5 message", options.message)
//             return options.message
//         }
//     }
//     const history = await workflow.run({ actions, entry: "step1" })
//     // console.dir(history, { depth: null, colors: true })
// })();

(async () => {
    console.log('\n\n------------fuck------------------------------------------------')
    const workflow = new Workflow({
        steps: [
            { id: "step1", action: "step1" },
            { id: "step2", action: "check", options: { list: "$ref.step1" }, type: "if" },
            { id: "step3True", action: "step3", options: { list: "$ref.step1" }, depends: ["step2.true"] },
            { id: "step3False", action: "step4", options: { list: "$ref.step1" }, depends: ["step2.false"] },
            { id: "processTrue", action: "process", depends: ["step3True"] },
            { id: "step5", action: "step5", options: { message: "$ref.step3False, $ref.processTrue.result" } },
        ]
    })
    const actions = {
        step1: () => {
            return [{ name: "jerry" }, { name: "tom" }]
        },
        check: async (options: { list: any[] }) => {
            return options.list.length > 1
        },
        step3: async (options: { list: any[] }) => {
            console.log(">>>>>>>> true list", options.list)
            return 'from true branch'
        },
        step4: async (options: { list: any[] }) => {
            console.log("<<<<<<<< false list", options.list)
            return 'from false branch'
        },
        step5: async (options: { message: string }) => {
            console.log(">>>>>>>> Step5 message", options.message)
            return options.message
        },
        process: async () => {
            console.log("Process true")
            return { "result": null }
        }
    }
    const history = await workflow.run({ actions, entry: "step1" })
    console.dir(history, { depth: null, colors: true })
})();
import { Workflow } from '../src/workflow'
import { LogLevel } from '../src/logger'

describe('Workflow with OR dependencies', () => {
  it('should execute step5 with either step3True or step3False result', async () => {
    // 记录执行顺序
    const executionOrder: string[] = []
    const callCounts: Record<string, number> = {
      step1: 0,
      check: 0,
      step3: 0,
      step4: 0,
      step5: 0
    }
    
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "step1" },
        { id: "step2", action: "check", options: { list: "$ref.step1" }, type: "if" },
        { id: "step3True", action: "step3", options: { list: "$ref.step1" }, depends: ["step2.true"] },
        { id: "step3False", action: "step4", options: { list: "$ref.step1" }, depends: ["step2.false"] },
        { id: "step5", action: "step5", options: { message: "$ref.step3True, $ref.step3False" } },
      ]
    }, LogLevel.DEBUG)

    const actions = {
      step1: () => {
        callCounts.step1++
        executionOrder.push('step1')
        return [{ name: "jerry" }, { name: "tom" }]
      },
      check: async (options: { list: any[] }) => {
        callCounts.check++
        executionOrder.push('step2')
        return options.list.length > 1
      },
      step3: async (options: { list: any[] }) => {
        callCounts.step3++
        executionOrder.push('step3True')
        return 'from true branch'
      },
      step4: async (options: { list: any[] }) => {
        callCounts.step4++
        executionOrder.push('step3False')
        return 'from false branch'
      },
      step5: async (options: { message: string }) => {
        callCounts.step5++
        executionOrder.push('step5')
        return options.message
      }
    }

    const history = await workflow.run({ actions, entry: "step1" })
    const lastRecord = history[history.length - 1]

    // 验证执行状态
    expect(lastRecord.status).toBe('success')
    
    // 验证执行顺序
    expect(executionOrder).toContain('step1')
    expect(executionOrder).toContain('step2')
    expect(executionOrder).toContain('step5')
    
    // 验证条件分支：只执行了其中一个分支
    const hasTrueBranch = executionOrder.includes('step3True')
    const hasFalseBranch = executionOrder.includes('step3False')
    expect(hasTrueBranch !== hasFalseBranch).toBe(true) // 只能有一个分支执行
    
    // 验证函数调用次数
    expect(callCounts.step1).toBe(1)
    expect(callCounts.check).toBe(1)
    expect(callCounts.step5).toBe(1)
    if (hasTrueBranch) {
      expect(callCounts.step3).toBe(1)
      expect(callCounts.step4).toBe(0)
    } else {
      expect(callCounts.step3).toBe(0)
      expect(callCounts.step4).toBe(1)
    }
    
    // 验证 step5 的输入
    const step5Record = lastRecord.steps['step5']
    expect(step5Record.status).toBe('success')
    expect(step5Record.inputs.message).toBe(hasTrueBranch ? 'from true branch' : 'from false branch')
    
    // 验证步骤执行状态
    expect(lastRecord.steps['step1'].status).toBe('success')
    expect(lastRecord.steps['step2'].status).toBe('success')
    if (hasTrueBranch) {
      expect(lastRecord.steps['step3True'].status).toBe('success')
      expect(lastRecord.steps.hasOwnProperty('step3False')).toBe(false)
    } else {
      expect(lastRecord.steps.hasOwnProperty('step3True')).toBe(false)
      expect(lastRecord.steps['step3False'].status).toBe('success')
    }
  })

  it('should handle empty list case correctly', async () => {
    const executionOrder: string[] = []
    const callCounts: Record<string, number> = {
      step1: 0,
      check: 0,
      step3: 0,
      step4: 0,
      step5: 0
    }
    
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "step1" },
        { id: "step2", action: "check", options: { list: "$ref.step1" }, type: "if" },
        { id: "step3True", action: "step3", options: { list: "$ref.step1" }, depends: ["step2.true"] },
        { id: "step3False", action: "step4", options: { list: "$ref.step1" }, depends: ["step2.false"] },
        { id: "step5", action: "step5", options: { message: "$ref.step3True, $ref.step3False" } },
      ]
    }, LogLevel.DEBUG)

    const actions = {
      step1: () => {
        callCounts.step1++
        executionOrder.push('step1')
        return [] // 返回空列表
      },
      check: async (options: { list: any[] }) => {
        callCounts.check++
        executionOrder.push('step2')
        return options.list.length > 1
      },
      step3: async (options: { list: any[] }) => {
        callCounts.step3++
        executionOrder.push('step3True')
        return 'from true branch'
      },
      step4: async (options: { list: any[] }) => {
        callCounts.step4++
        executionOrder.push('step3False')
        return 'from false branch'
      },
      step5: async (options: { message: string }) => {
        callCounts.step5++
        executionOrder.push('step5')
        return options.message
      }
    }

    const history = await workflow.run({ actions, entry: "step1" })
    const lastRecord = history[history.length - 1]

    // 验证执行状态
    expect(lastRecord.status).toBe('success')
    
    // 验证执行顺序
    expect(executionOrder).toContain('step1')
    expect(executionOrder).toContain('step2')
    expect(executionOrder).toContain('step3False') // 空列表应该走 false 分支
    expect(executionOrder).toContain('step5')
    expect(executionOrder).not.toContain('step3True')
    
    // 验证函数调用次数
    expect(callCounts.step1).toBe(1)
    expect(callCounts.check).toBe(1)
    expect(callCounts.step3).toBe(0)
    expect(callCounts.step4).toBe(1)
    expect(callCounts.step5).toBe(1)
    
    // 验证 step5 的输入
    const step5Record = lastRecord.steps['step5']
    expect(step5Record.status).toBe('success')
    expect(step5Record.inputs.message).toBe('from false branch')
    
    // 验证步骤执行状态
    expect(lastRecord.steps['step1'].status).toBe('success')
    expect(lastRecord.steps['step2'].status).toBe('success')
    expect(lastRecord.steps.hasOwnProperty('step3True')).toBe(false)
    expect(lastRecord.steps['step3False'].status).toBe('success')
  })

  it('should handle long array (length > 2) and execute true branch', async () => {
    const executionOrder: string[] = []
    const results: Record<string, any> = {}
    const callCounts: Record<string, number> = {
      generateData: 0,
      checkLength: 0,
      processData: 0,
      checkNotEmpty: 0,
      furtherProcess: 0,
      processEmpty: 0,
      combineResults: 0
    }
    
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "generateData" },
        { id: "step2", action: "checkLength", options: { data: "$ref.step1" }, type: "if" },
        { id: "step3", action: "processData", options: { data: "$ref.step1" }, depends: ["step2.true"] },
        { id: "step4", action: "checkNotEmpty", options: { data: "$ref.step1" }, type: "if", depends: ["step2.false"] },
        { id: "step5", action: "furtherProcess", options: { data: "$ref.step3" }, depends: ["step3"] },
        { id: "step6", action: "processEmpty", options: { data: "$ref.step1" }, depends: ["step4.true"] },
        { id: "step7", action: "combineResults", options: { 
          message: "$ref.step3,$ref.step5,$ref.step6",
          data: "$ref.step1"
        } },
      ]
    }, LogLevel.DEBUG)


    const actions = {
      generateData: () => {
        callCounts.generateData++
        executionOrder.push('step1')
        // 返回长度大于2的数组，确保走true分支
        const data = [{ id: 1, value: 'item1' }, { id: 2, value: 'item2' }, { id: 3, value: 'item3' }]
        results.step1 = data
        return data
      },
      checkLength: async (options: { data: any[] }) => {
        callCounts.checkLength++
        executionOrder.push('step2')
        return options.data.length > 2
      },
      processData: async (options: { data: any[] }) => {
        callCounts.processData++
        executionOrder.push('step3')
        const result = options.data.map(item => ({ ...item, processed: true }))
        results.step3 = result
        return result
      },
      checkNotEmpty: async (options: { data: any[] }) => {
        callCounts.checkNotEmpty++
        executionOrder.push('step4')
        return options.data.length > 0
      },
      furtherProcess: async (options: { data: any[] }) => {
        callCounts.furtherProcess++
        executionOrder.push('step5')
        const result = options.data.map(item => ({ ...item, furtherProcessed: true }))
        results.step5 = result
        return result
      },
      processEmpty: async (options: { data: any[] }) => {
        callCounts.processEmpty++
        executionOrder.push('step6')
        const result = options.data.map(item => ({ ...item, emptyProcessed: true }))
        results.step6 = result
        return result
      },
      combineResults: async (options: { message: string, data: any[] }) => {
        callCounts.combineResults++
        executionOrder.push('step7')
        return {
          message: options.message,
          originalData: options.data,
          executionPath: executionOrder.join(' -> ')
        }
      }
    }

    const history = await workflow.run({ actions, entry: "step1" })
    const lastRecord = history[history.length - 1]

    // 验证执行状态
    expect(lastRecord.status).toBe('success')
    
    // 验证执行顺序
    expect(executionOrder).toEqual([
      'step1', 'step2', 'step3', 'step5', 'step7'
    ])
    
    // 验证函数调用次数
    expect(callCounts.generateData).toBe(1)
    expect(callCounts.checkLength).toBe(1)
    expect(callCounts.processData).toBe(1)
    expect(callCounts.furtherProcess).toBe(1)
    expect(callCounts.combineResults).toBe(1)
    expect(callCounts.checkNotEmpty).toBe(0)
    expect(callCounts.processEmpty).toBe(0)
    
    // 验证步骤执行状态
    expect(lastRecord.steps['step1'].status).toBe('success')
    expect(lastRecord.steps['step2'].status).toBe('success')
    expect(lastRecord.steps['step3'].status).toBe('success')
    expect(lastRecord.steps['step5'].status).toBe('success')
    expect(lastRecord.steps['step7'].status).toBe('success')
    expect(lastRecord.steps.hasOwnProperty('step4')).toBe(false)
    expect(lastRecord.steps.hasOwnProperty('step6')).toBe(false)
    
    // 验证 step7 的输入
    const step7Record = lastRecord.steps['step7']
    expect(step7Record.status).toBe('success')
    expect(step7Record.inputs.message).toStrictEqual(results.step3)
    
    // 验证最终结果
    const finalResult = lastRecord.steps['step7'].outputs
    expect(finalResult).toHaveProperty('message')
    expect(finalResult).toHaveProperty('originalData')
    expect(finalResult).toHaveProperty('executionPath')
    expect(finalResult.originalData).toEqual(results.step1)
  })
  
  it('should handle short array (length <= 2) and execute false branch', async () => {
    const executionOrder: string[] = []
    const results: Record<string, any> = {}
    const callCounts: Record<string, number> = {
      generateData: 0,
      checkLength: 0,
      processData: 0,
      checkNotEmpty: 0,
      furtherProcess: 0,
      processEmpty: 0,
      combineResults: 0
    }
    
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "generateData" },
        { id: "step2", action: "checkLength", options: { data: "$ref.step1" }, type: "if" },
        { id: "step3", action: "processData", options: { data: "$ref.step1" }, depends: ["step2.true"] },
        { id: "step4", action: "checkNotEmpty", options: { data: "$ref.step1" }, type: "if", depends: ["step2.false"] },
        { id: "step5", action: "furtherProcess", options: { data: "$ref.step3" }, depends: ["step3"] },
        { id: "step6", action: "processEmpty", options: { data: "$ref.step1" }, depends: ["step4.true"] },
        { id: "step7", action: "combineResults", options: { 
          message: "$ref.step3,$ref.step5,$ref.step6",
          data: "$ref.step1"
        } },
      ]
    }, LogLevel.DEBUG)

    const actions = {
      generateData: () => {
        callCounts.generateData++
        executionOrder.push('step1')
        // 返回长度为2的数组，确保走false分支
        const data = [{ id: 1, value: 'item1' }, { id: 2, value: 'item2' }]
        results.step1 = data
        return data
      },
      checkLength: async (options: { data: any[] }) => {
        callCounts.checkLength++
        executionOrder.push('step2')
        return options.data.length > 2
      },
      processData: async (options: { data: any[] }) => {
        callCounts.processData++
        executionOrder.push('step3')
        const result = options.data.map(item => ({ ...item, processed: true }))
        results.step3 = result
        return result
      },
      checkNotEmpty: async (options: { data: any[] }) => {
        callCounts.checkNotEmpty++
        executionOrder.push('step4')
        // 返回true，测试执行step6和step7的情况
        return true
      },
      furtherProcess: async (options: { data: any[] }) => {
        callCounts.furtherProcess++
        executionOrder.push('step5')
        const result = options.data.map(item => ({ ...item, furtherProcessed: true }))
        results.step5 = result
        return result
      },
      processEmpty: async (options: { data: any[] }) => {
        callCounts.processEmpty++
        executionOrder.push('step6')
        const result = options.data.map(item => ({ ...item, emptyProcessed: true }))
        results.step6 = result
        return result
      },
      combineResults: async (options: { message: string, data: any[] }) => {
        callCounts.combineResults++
        executionOrder.push('step7')
        return {
          message: options.message,
          originalData: options.data,
          executionPath: executionOrder.join(' -> ')
        }
      }
    }

    const history = await workflow.run({ actions, entry: "step1" })
    const lastRecord = history[history.length - 1]

    // 验证执行状态
    expect(lastRecord.status).toBe('success')
    
    // 验证执行顺序
    expect(executionOrder).toEqual([
      'step1', 'step2', 'step4', 'step6', 'step7'
    ])
    
    // 验证函数调用次数
    expect(callCounts.generateData).toBe(1)
    expect(callCounts.checkLength).toBe(1)
    expect(callCounts.checkNotEmpty).toBe(1)
    expect(callCounts.processEmpty).toBe(1)
    expect(callCounts.combineResults).toBe(1)
    expect(callCounts.processData).toBe(0)
    expect(callCounts.furtherProcess).toBe(0)
    
    // 验证步骤执行状态
    expect(lastRecord.steps['step1'].status).toBe('success')
    expect(lastRecord.steps['step2'].status).toBe('success')
    expect(lastRecord.steps['step4'].status).toBe('success')
    expect(lastRecord.steps['step6'].status).toBe('success')
    expect(lastRecord.steps['step7'].status).toBe('success')
    expect(lastRecord.steps.hasOwnProperty('step3')).toBe(false)
    expect(lastRecord.steps.hasOwnProperty('step5')).toBe(false)
    
    // 验证 step7 的输入
    const step7Record = lastRecord.steps['step7']
    expect(step7Record.status).toBe('success')
    expect(step7Record.inputs.message).toStrictEqual(results.step6)
    
    // 验证最终结果
    const finalResult = lastRecord.steps['step7'].outputs
    expect(finalResult).toHaveProperty('message')
    expect(finalResult).toHaveProperty('originalData')
    expect(finalResult).toHaveProperty('executionPath')
    expect(finalResult.originalData).toEqual(results.step1)
  })
  
  it('should handle empty array and skip all processing steps', async () => {
    const executionOrder: string[] = []
    const results: Record<string, any> = {}
    const callCounts: Record<string, number> = {
      generateData: 0,
      checkLength: 0,
      processData: 0,
      checkNotEmpty: 0,
      furtherProcess: 0,
      processEmpty: 0,
      combineResults: 0
    }
    
    const workflow = new Workflow({
      steps: [
        { id: "step1", action: "generateData" },
        { id: "step2", action: "checkLength", options: { data: "$ref.step1" }, type: "if" },
        { id: "step3", action: "processData", options: { data: "$ref.step1" }, depends: ["step2.true"] },
        { id: "step4", action: "checkNotEmpty", options: { data: "$ref.step1" }, type: "if", depends: ["step2.false"] },
        { id: "step5", action: "furtherProcess", options: { data: "$ref.step3" }, depends: ["step3"] },
        { id: "step6", action: "processEmpty", options: { data: "$ref.step1" }, depends: ["step4.true"] },
        { id: "step7", action: "combineResults", options: { 
          message: "$ref.step3,$ref.step5,$ref.step6",
          data: "$ref.step1"
        } },
      ]
    }, LogLevel.DEBUG)

    const actions = {
      generateData: () => {
        callCounts.generateData++
        executionOrder.push('step1')
        // 返回空数组
        const data: any[] = []
        results.step1 = data
        return data
      },
      checkLength: async (options: { data: any[] }) => {
        callCounts.checkLength++
        executionOrder.push('step2')
        return options.data.length > 2
      },
      processData: async (options: { data: any[] }) => {
        callCounts.processData++
        executionOrder.push('step3')
        const result = options.data.map(item => ({ ...item, processed: true }))
        results.step3 = result
        return result
      },
      checkNotEmpty: async (options: { data: any[] }) => {
        callCounts.checkNotEmpty++
        executionOrder.push('step4')
        // 返回false，测试不执行step6和step7的情况
        return false
      },
      furtherProcess: async (options: { data: any[] }) => {
        callCounts.furtherProcess++
        executionOrder.push('step5')
        const result = options.data.map(item => ({ ...item, furtherProcessed: true }))
        results.step5 = result
        return result
      },
      processEmpty: async (options: { data: any[] }) => {
        callCounts.processEmpty++
        executionOrder.push('step6')
        const result = options.data.map(item => ({ ...item, emptyProcessed: true }))
        results.step6 = result
        return result
      },
      combineResults: async (options: { message: string, data: any[] }) => {
        callCounts.combineResults++
        executionOrder.push('step7')
        return {
          message: options.message,
          originalData: options.data,
          executionPath: executionOrder.join(' -> ')
        }
      }
    }

    const history = await workflow.run({ actions, entry: "step1" })
    const lastRecord = history[history.length - 1]

    // 验证执行状态
    expect(lastRecord.status).toBe('success')
    
    // 验证执行顺序
    expect(executionOrder).toEqual([
      'step1', 'step2', 'step4'
    ])
    
    // 验证函数调用次数
    expect(callCounts.generateData).toBe(1)
    expect(callCounts.checkLength).toBe(1)
    expect(callCounts.checkNotEmpty).toBe(1)
    expect(callCounts.processEmpty).toBe(0)
    expect(callCounts.combineResults).toBe(0)
    expect(callCounts.processData).toBe(0)
    expect(callCounts.furtherProcess).toBe(0)
    
    // 验证步骤执行状态
    expect(lastRecord.steps['step1'].status).toBe('success')
    expect(lastRecord.steps['step2'].status).toBe('success')
    expect(lastRecord.steps['step4'].status).toBe('success')
    expect(lastRecord.steps.hasOwnProperty('step3')).toBe(false)
    expect(lastRecord.steps.hasOwnProperty('step5')).toBe(false)
    expect(lastRecord.steps.hasOwnProperty('step6')).toBe(false)
    expect(lastRecord.steps.hasOwnProperty('step7')).toBe(false)
  })
}) 
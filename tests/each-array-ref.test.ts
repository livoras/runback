import { Workflow } from '../src/workflow'
import { LogLevel } from '../src/logger'

describe('Each Array Reference Resolution', () => {
  test('should resolve string refs in array each and ignore options', async () => {
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction'
        },
        {
          id: 'testStep',
          action: 'testAction',
          each: ["$ref.start.content", "OJBK"],
          options: [null, null] // 应该被忽略
        }
      ]
    }, LogLevel.ERROR)

    const results: any[] = []
    const actions = {
      startAction: () => ({ content: "hello" }),
      testAction: (param: any) => {
        results.push(param)
        return `processed: ${param}`
      }
    }

    await workflow.run({
      entry: 'start',
      actions
    })

    // 应该忽略 options，直接传递解析后的值
    expect(results).toEqual(['hello', 'OJBK'])
  })

  test('should resolve object refs in array each', async () => {
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction'
        },
        {
          id: 'testStep',
          action: 'testAction',
          each: [
            { user: "$ref.start.name", type: "primary" },
            { user: "OJBK", type: "secondary" }
          ]
        }
      ]
    }, LogLevel.ERROR)

    const results: any[] = []
    const actions = {
      startAction: () => ({ name: "Alice" }),
      testAction: (param: any) => {
        results.push(param)
        return `processed: ${JSON.stringify(param)}`
      }
    }

    await workflow.run({
      entry: 'start',
      actions
    })

    expect(results).toEqual([
      { user: "Alice", type: "primary" },
      { user: "OJBK", type: "secondary" }
    ])
  })

  test('should resolve nested refs in array each', async () => {
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction'
        },
        {
          id: 'testStep',
          action: 'testAction',
          each: [
            { 
              config: {
                name: "$ref.start.user.name",
                age: "$ref.start.user.age"
              }
            },
            { 
              config: {
                name: "Bob",
                age: 25
              }
            }
          ]
        }
      ]
    }, LogLevel.ERROR)

    const results: any[] = []
    const actions = {
      startAction: () => ({ 
        user: { name: "Alice", age: 30 }
      }),
      testAction: (param: any) => {
        results.push(param)
        return `processed: ${JSON.stringify(param)}`
      }
    }

    await workflow.run({
      entry: 'start',
      actions
    })

    expect(results).toEqual([
      { 
        config: {
          name: "Alice",
          age: 30
        }
      },
      { 
        config: {
          name: "Bob",
          age: 25
        }
      }
    ])
  })

  test('should use options template when each is string reference', async () => {
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction'
        },
        {
          id: 'testStep',
          action: 'testAction',
          each: "$ref.start.items", // 字符串引用
          options: {
            prefix: "item:",
            value: "$ref.$item",
            index: "$ref.$index"
          }
        }
      ]
    }, LogLevel.ERROR)

    const results: any[] = []
    const actions = {
      startAction: () => ({ 
        items: ["A", "B"]
      }),
      testAction: (param: any) => {
        results.push(param)
        return `processed: ${JSON.stringify(param)}`
      }
    }

    await workflow.run({
      entry: 'start',
      actions
    })

    // 字符串引用时应该使用 options 模板
    expect(results).toEqual([
      { prefix: "item:", value: "A", index: 0 },
      { prefix: "item:", value: "B", index: 1 }
    ])
  })

  test('should handle mixed array with refs and literal values', async () => {
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction'
        },
        {
          id: 'testStep',
          action: 'testAction',
          each: [
            "$ref.start.name",
            "literal",
            { name: "$ref.start.title", value: 42 },
            ["$ref.start.items[0]", "nested"]
          ]
        }
      ]
    }, LogLevel.ERROR)

    const results: any[] = []
    const actions = {
      startAction: () => ({ 
        name: "Alice",
        title: "Engineer", 
        items: ["first", "second"]
      }),
      testAction: (param: any) => {
        results.push(param)
        return `processed`
      }
    }

    await workflow.run({
      entry: 'start',
      actions
    })

    expect(results).toEqual([
      "Alice",
      "literal", 
      { name: "Engineer", value: 42 },
      ["first", "nested"]
    ])
  })
}) 
import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2'
import { LogLevel } from '../src/logger'

describe('Workflow2 V2 Syntax Tests', () => {
  const mockActions = {
    getUser: () => ({ id: 123, name: 'Alice', role: 'admin' }),
    processUser: (input: any) => ({ processed: true, ...input }),
    getUsers: () => ({ 
      list: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
    }),
    processEachUser: (input: any) => ({ processed: true, ...input }),
    log: (input: any) => {
      console.log('Log action:', input)
      return { logged: true }
    }
  }

  test('should execute simple V2 workflow with ref mapping', async () => {
    const steps: Step2[] = [
      {
        id: 'getUser',
        action: 'getUser',
        each: false,
        input: {}
      },
      {
        id: 'processUser',
        action: 'processUser',
        each: false,
        input: {
          userId: 0,
          name: 'placeholder'
        },
        ref: {
          "userId": "getUser.id",
          "name": "getUser.name"
        }
      }
    ]

    const workflow = new Workflow2({ steps }, LogLevel.INFO)
    const history = await workflow.run({
      actions: mockActions,
      entry: 'getUser'
    })

    expect(history).toHaveLength(1)
    expect(history[0].status).toBe('success')
    expect(history[0].steps['getUser'].outputs).toEqual({ id: 123, name: 'Alice', role: 'admin' })
    expect(history[0].steps['processUser'].outputs).toEqual({
      processed: true,
      userId: 123,
      name: 'Alice'
    })
  })

  test('should handle backup references', async () => {
    const steps: Step2[] = [
      {
        id: 'getUser',
        action: 'getUser',
        each: false,
        input: {}
      },
      {
        id: 'processUser',
        action: 'processUser',
        each: false,
        input: {
          name: 'default',
          email: 'default@example.com'
        },
        ref: {
          "name": "getUser.name",
          "email": "getUser.email,getUser.fallbackEmail"  // 备选引用都不存在，保持默认值
        }
      }
    ]

    const workflow = new Workflow2({ steps }, LogLevel.INFO)
    const history = await workflow.run({
      actions: mockActions,
      entry: 'getUser'
    })

    expect(history[0].status).toBe('success')
    expect(history[0].steps['processUser'].outputs.name).toBe('Alice')
    // email字段应该保持input中的默认值，因为备选引用都找不到
    expect(history[0].steps['processUser'].outputs.email).toBe('default@example.com')
  })

  test('should execute V2 each workflow', async () => {
    const steps: Step2[] = [
      {
        id: 'getUsers',
        action: 'getUsers',
        each: false,
        input: {}
      },
      {
        id: 'processUsers',
        action: 'processEachUser',
        each: true,  // V2中each是布尔值
        input: [],
        ref: {
          "[]": "getUsers.list"  // 整个数组替换
        }
      }
    ]

    const workflow = new Workflow2({ steps }, LogLevel.INFO)
    const history = await workflow.run({
      actions: mockActions,
      entry: 'getUsers'
    })

    expect(history[0].status).toBe('success')
    expect(history[0].steps['processUsers'].outputs).toHaveLength(2)
    expect(history[0].steps['processUsers'].outputs[0]).toEqual({
      processed: true,
      id: 1,
      name: 'Alice'
    })
    expect(history[0].steps['processUsers'].outputs[1]).toEqual({
      processed: true,
      id: 2,
      name: 'Bob'
    })
  })

  test('should parse V2 dependencies correctly', () => {
    const steps: Step2[] = [
      {
        id: 'step1',
        action: 'getUser', 
        each: false,
        input: {}
      },
      {
        id: 'step2',
        action: 'processUser',
        each: false,
        input: { name: 'test' },
        ref: {
          "name": "step1.name",
          "id": "step1.id"
        }
      }
    ]

    const workflow = new Workflow2({ steps }, LogLevel.INFO)
    
    // 检查依赖解析
    expect(workflow.deps['step1']).toEqual([])
    expect(workflow.deps['step2']).toEqual(['step1.name', 'step1.id'])
  })

  test('should handle array field mapping', async () => {
    const steps: Step2[] = [
      {
        id: 'getUsers',
        action: 'getUsers',
        each: false,
        input: {}
      },
      {
        id: 'processUsers',
        action: 'processEachUser',
        each: true,
        input: [
          {
            userId: 0,
            name: 'placeholder',
            status: 'active'
          }
        ],
        ref: {
          "[].userId": "getUsers.list[].id",
          "[].name": "getUsers.list[].name"
          // status字段保持input中的原值
        }
      }
    ]

    const workflow = new Workflow2({ steps }, LogLevel.INFO)
    const history = await workflow.run({
      actions: mockActions,
      entry: 'getUsers'
    })

    expect(history[0].status).toBe('success')
    const outputs = history[0].steps['processUsers'].outputs
    expect(outputs).toHaveLength(2)
    
    // 验证字段映射和原值保持
    expect(outputs[0]).toEqual({
      processed: true,
      userId: 1,
      name: 'Alice',
      status: 'active'
    })
    expect(outputs[1]).toEqual({
      processed: true,
      userId: 2,
      name: 'Bob',
      status: 'active'
    })
  })
}) 
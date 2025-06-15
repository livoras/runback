import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2'
import { LogLevel } from '../src/logger'

describe('Workflow2 OnlyRuns Functionality - V2 Syntax', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock Date.now() to return a fixed timestamp
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should only run specified steps when onlyRuns is provided', async () => {
    const step1Action = jest.fn().mockResolvedValue('step1 result')
    const step2Action = jest.fn().mockResolvedValue('step2 result')
    const step3Action = jest.fn().mockResolvedValue('step3 result')
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'step1',
          each: false,
          input: {}
        },
        { 
          id: 'step2', 
          action: 'step2',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'  // V2: 依赖 step1
          }
        },
        { 
          id: 'step3', 
          action: 'step3',
          each: false,
          input: {},
          ref: {
            dependency: 'step2'  // V2: 依赖 step2
          }
        },
      ]
    }, LogLevel.ERROR)

    const actions = {
      step1: step1Action,
      step2: step2Action,
      step3: step3Action
    }

    // First run - normal execution
    const history = await workflow.run({
      actions,
      entry: 'step1'
    })

    // All steps should have run
    expect(step1Action).toHaveBeenCalledTimes(1)
    expect(step2Action).toHaveBeenCalledTimes(1)
    expect(step3Action).toHaveBeenCalledTimes(1)

    // Reset mocks
    step1Action.mockClear()
    step2Action.mockClear()
    step3Action.mockClear()

    // Second run - only run step3
    const history2 = await workflow.run({
      actions,
      history,
      onlyRuns: ['step3']
    })

    // Only step3 should have run
    expect(step1Action).not.toHaveBeenCalled()
    expect(step2Action).not.toHaveBeenCalled()
    expect(step3Action).toHaveBeenCalledTimes(1)

    // Verify the step3 record has onlyRun: true
    const step3Record = history2[1]?.steps?.step3
    expect(step3Record).toBeDefined()
    expect(step3Record?.onlyRun).toBe(true)
    expect(step3Record?.status).toBe('success')
  })

  it('should restore context from history when running with onlyRuns', async () => {
    const step1Action = jest.fn().mockResolvedValue({ user: 'test-user' })
    const step2Action = jest.fn().mockImplementation((input) => `Processed ${input.userId}`)
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'step1',
          each: false,
          input: {}
        },
        { 
          id: 'step2', 
          action: 'step2',
          each: false,
          input: {
            userId: 'default'
          },
          ref: {
            'userId': 'step1.user'  // V2: 使用 ref 映射字段
          }
        },
      ]
    }, LogLevel.ERROR)

    const actions = {
      step1: step1Action,
      step2: step2Action
    }

    // First run - normal execution
    const history = await workflow.run({
      actions,
      entry: 'step1'
    })

    // Reset mocks but keep the implementation
    step1Action.mockClear()
    step2Action.mockClear()

    // Second run - only run step2
    const history2 = await workflow.run({
      actions,
      history,
      onlyRuns: ['step2']
    })

    // step1 should not have run again
    expect(step1Action).not.toHaveBeenCalled()
    // step2 should have run with the context from history
    expect(step2Action).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'test-user'
    }))

    const step2Record = history2[1]?.steps?.step2
    expect(step2Record).toBeDefined()
    expect(step2Record?.onlyRun).toBe(true)
    expect(step2Record?.status).toBe('success')
  })

  it('should handle onlyRuns with non-existent step IDs', async () => {
    const step1Action = jest.fn().mockResolvedValue('step1 result')
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'step1',
          each: false,
          input: {}
        },
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { step1: step1Action },
      entry: 'step1'
    })

    step1Action.mockClear()

    // Try to run with non-existent step ID
    const history2 = await workflow.run({
      actions: { step1: step1Action },
      history,
      onlyRuns: ['non-existent-step']
    })

    // No steps should have run
    expect(step1Action).not.toHaveBeenCalled()
    expect(history2[1]?.steps).toEqual({})
  })

  it('should handle onlyRuns with multiple steps', async () => {
    const step1Action = jest.fn().mockResolvedValue('step1 result')
    const step2Action = jest.fn().mockResolvedValue('step2 result')
    const step3Action = jest.fn().mockResolvedValue('step3 result')
    const step4Action = jest.fn().mockResolvedValue('step4 result')
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'step1',
          each: false,
          input: {}
        },
        { 
          id: 'step2', 
          action: 'step2',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'
          }
        },
        { 
          id: 'step3', 
          action: 'step3',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'  // 独立分支
          }
        },
        { 
          id: 'step4', 
          action: 'step4',
          each: false,
          input: {},
          ref: {
            dependency: 'step3'
          }
        },
      ]
    }, LogLevel.ERROR)

    const actions = {
      step1: step1Action,
      step2: step2Action,
      step3: step3Action,
      step4: step4Action
    }

    // First run - normal execution
    const history = await workflow.run({
      actions,
      entry: 'step1'
    })

    // All steps should have run
    expect(step1Action).toHaveBeenCalledTimes(1)
    expect(step2Action).toHaveBeenCalledTimes(1)
    expect(step3Action).toHaveBeenCalledTimes(1)
    expect(step4Action).toHaveBeenCalledTimes(1)

    // Reset mocks
    step1Action.mockClear()
    step2Action.mockClear()
    step3Action.mockClear()
    step4Action.mockClear()

    // Second run - only run step2 and step4
    const history2 = await workflow.run({
      actions,
      history,
      onlyRuns: ['step2', 'step4']
    })

    // Only step2 and step4 should have run
    expect(step1Action).not.toHaveBeenCalled()
    expect(step2Action).toHaveBeenCalledTimes(1)
    expect(step3Action).not.toHaveBeenCalled()
    expect(step4Action).toHaveBeenCalledTimes(1)

    // Verify both steps have onlyRun: true
    const step2Record = history2[1]?.steps?.step2
    const step4Record = history2[1]?.steps?.step4
    
    expect(step2Record).toBeDefined()
    expect(step2Record?.onlyRun).toBe(true)
    expect(step2Record?.status).toBe('success')
    
    expect(step4Record).toBeDefined()
    expect(step4Record?.onlyRun).toBe(true)
    expect(step4Record?.status).toBe('success')
  })

  it('should handle onlyRuns with each steps', async () => {
    const getItems = jest.fn().mockResolvedValue(['item1', 'item2', 'item3'])
    const processItem = jest.fn().mockImplementation((item) => `processed_${item}`)
    const finalStep = jest.fn().mockImplementation((input) => `final_${input.count}`)
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getItems', 
          action: 'getItems',
          each: false,
          input: {}
        },
        { 
          id: 'processItems', 
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            '[]': 'getItems'  // V2: 数组替换
          }
        },
        { 
          id: 'final', 
          action: 'finalStep',
          each: false,
          input: {
            count: 0
          },
          ref: {
            'count': 'processItems.length'
          }
        },
      ]
    }, LogLevel.ERROR)

    const actions = {
      getItems: getItems,
      processItem: processItem,
      finalStep: finalStep
    }

    // First run - normal execution
    const history = await workflow.run({
      actions,
      entry: 'getItems'
    })

    expect(getItems).toHaveBeenCalledTimes(1)
    expect(processItem).toHaveBeenCalledTimes(3)
    expect(finalStep).toHaveBeenCalledTimes(1)

    // Reset mocks
    getItems.mockClear()
    processItem.mockClear()
    finalStep.mockClear()

    // Second run - only run processItems (each step)
    const history2 = await workflow.run({
      actions,
      history,
      onlyRuns: ['processItems']
    })

    // Only processItems should have run
    expect(getItems).not.toHaveBeenCalled()
    expect(processItem).toHaveBeenCalledTimes(3)  // should use context from history
    expect(finalStep).not.toHaveBeenCalled()

    // Verify processItems record has onlyRun: true
    const processItemsRecord = history2[1]?.steps?.processItems
    expect(processItemsRecord).toBeDefined()
    expect(processItemsRecord?.onlyRun).toBe(true)
    expect(processItemsRecord?.status).toBe('success')
    expect(processItemsRecord?.outputs).toEqual([
      'processed_item1',
      'processed_item2', 
      'processed_item3'
    ])
  })

  it('should handle onlyRuns with conditional steps', async () => {
    const checkCondition = jest.fn().mockResolvedValue(true)
    const trueBranch = jest.fn().mockResolvedValue('true_result')
    const falseBranch = jest.fn().mockResolvedValue('false_result')
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'condition', 
          action: 'checkCondition',
          each: false,
          input: {},
          type: 'if'  // V2: 条件步骤
        },
        { 
          id: 'trueBranch', 
          action: 'trueBranch',
          each: false,
          input: {},
          ref: {
            dependency: 'condition.true'
          }
        },
        { 
          id: 'falseBranch', 
          action: 'falseBranch',
          each: false,
          input: {},
          ref: {
            dependency: 'condition.false'
          }
        },
      ]
    }, LogLevel.ERROR)

    const actions = {
      checkCondition: checkCondition,
      trueBranch: trueBranch,
      falseBranch: falseBranch
    }

    // First run - normal execution
    const history = await workflow.run({
      actions,
      entry: 'condition'
    })

    expect(checkCondition).toHaveBeenCalledTimes(1)
    expect(trueBranch).toHaveBeenCalledTimes(1)  // condition was true
    expect(falseBranch).not.toHaveBeenCalled()   // false branch not executed

    // Reset mocks
    checkCondition.mockClear()
    trueBranch.mockClear()
    falseBranch.mockClear()

    // Second run - only run trueBranch
    const history2 = await workflow.run({
      actions,
      history,
      onlyRuns: ['trueBranch']
    })

    // Only trueBranch should have run
    expect(checkCondition).not.toHaveBeenCalled()
    expect(trueBranch).toHaveBeenCalledTimes(1)
    expect(falseBranch).not.toHaveBeenCalled()

    // Verify trueBranch record has onlyRun: true
    const trueBranchRecord = history2[1]?.steps?.trueBranch
    expect(trueBranchRecord).toBeDefined()
    expect(trueBranchRecord?.onlyRun).toBe(true)
    expect(trueBranchRecord?.status).toBe('success')
    expect(trueBranchRecord?.outputs).toBe('true_result')
  })

  it('should handle onlyRuns with complex field mapping', async () => {
    const getUserData = jest.fn().mockResolvedValue({
      users: [
        { id: 1, name: 'Alice', role: 'admin' },
        { id: 2, name: 'Bob', role: 'user' }
      ],
      metadata: { version: '1.0', timestamp: '2023-01-01' }
    })
    
    const transformUser = jest.fn().mockImplementation((userData) => {
      return {
        transformedUser: `${userData.name}_v${userData.version}_${userData.role}`,
        originalId: userData.id
      }
    })

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUserData', 
          action: 'getUserData',
          each: false,
          input: {}
        },
        { 
          id: 'transformUsers', 
          action: 'transformUser',
          each: true,
          input: [
            {
              id: 0,
              name: 'placeholder',
              role: 'default',
              version: '0.0'
            }
          ],
          ref: {
            '[].id': 'getUserData.users[].id',
            '[].name': 'getUserData.users[].name',
            '[].role': 'getUserData.users[].role',
            '[].version': 'getUserData.metadata.version'
          }
        }
      ]
    }, LogLevel.ERROR)

    const actions = {
      getUserData: getUserData,
      transformUser: transformUser
    }

    // First run - normal execution
    const history = await workflow.run({
      actions,
      entry: 'getUserData'
    })

    expect(getUserData).toHaveBeenCalledTimes(1)
    expect(transformUser).toHaveBeenCalledTimes(2)

    // Reset mocks
    getUserData.mockClear()
    transformUser.mockClear()

    // Second run - only run transformUsers with complex field mapping
    const history2 = await workflow.run({
      actions,
      history,
      onlyRuns: ['transformUsers']
    })

    // Only transformUsers should have run
    expect(getUserData).not.toHaveBeenCalled()
    expect(transformUser).toHaveBeenCalledTimes(2)

    // Verify the field mapping worked correctly with preserved context
    expect(transformUser).toHaveBeenCalledWith({
      id: 1,
      name: 'Alice',
      role: 'admin',
      version: '1.0'
    })
    expect(transformUser).toHaveBeenCalledWith({
      id: 2,
      name: 'Bob',
      role: 'user',
      version: '1.0'
    })

    // Verify transformUsers record has onlyRun: true
    const transformUsersRecord = history2[1]?.steps?.transformUsers
    expect(transformUsersRecord).toBeDefined()
    expect(transformUsersRecord?.onlyRun).toBe(true)
    expect(transformUsersRecord?.status).toBe('success')
    expect(transformUsersRecord?.outputs).toEqual([
      {
        transformedUser: 'Alice_v1.0_admin',
        originalId: 1
      },
      {
        transformedUser: 'Bob_v1.0_user',
        originalId: 2
      }
    ])
  })
}); 
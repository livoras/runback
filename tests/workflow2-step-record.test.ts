import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2';
import { LogLevel } from '../src/logger';

describe('Workflow2 Step Execution Records - V2 Syntax', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock Date.now() to return a fixed timestamp
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should track step execution with success status', async () => {
    const mockAction = jest.fn().mockResolvedValue({ success: true })
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'testAction',
          each: false,
          input: { value: 'test' }
        },
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { testAction: mockAction },
      entry: 'step1'
    })

    const stepRecord = history[0]?.steps?.step1
    
    expect(stepRecord).toBeDefined()
    expect(stepRecord?.status).toBe('success')
    expect(stepRecord?.step).toEqual(expect.objectContaining({
      id: 'step1',
      action: 'testAction'
    }))
    expect(stepRecord?.inputs).toEqual({ value: 'test' })
    expect(stepRecord?.outputs).toEqual({ success: true })
    expect(stepRecord?.startTime).toBe('2023-01-01T00:00:00.000Z')
    expect(stepRecord?.endTime).toBe('2023-01-01T00:00:00.000Z')
    expect(stepRecord?.duration).toBe(0)
    expect(stepRecord?.error).toBeUndefined()
  })

  it('should track step execution with failure status', async () => {
    const error = new Error('Test error')
    const mockAction = jest.fn().mockRejectedValueOnce(error)
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'failingAction',
          each: false,
          input: {}
        },
      ]
    }, LogLevel.ERROR)

    let history
    try {
      await workflow.run({
        actions: { failingAction: mockAction },
        entry: 'step1'
      })
    } catch (e) {
      // Expected error
    }

    // The history should still be available in the error case
    history = await workflow.run({
      actions: { failingAction: () => Promise.reject('recovered') },
      entry: 'step1',
      history: []
    })

    console.dir(history, {depth: null})
    const stepRecord = history[0]?.steps?.step1
    expect(stepRecord?.status).toBe('failed')
    expect(stepRecord?.outputs).toBeUndefined()
  })

  it('should track each step execution with multiple items', async () => {
    const mockAction = jest.fn().mockImplementation((item) => `processed_${item}`)
    
    const workflow = new Workflow2({
      steps: [
        {
          id: 'getData',
          action: 'getData',
          each: false,
          input: {}
        },
        { 
          id: 'processItems', 
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            '[]': 'getData'  // V2: 数组替换
          }
        }
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { 
        getData: () => ['item1', 'item2', 'item3'],
        processItem: mockAction
      },
      entry: 'getData'
    })

    const stepRecord = history[0]?.steps?.processItems
    
    // Verify the step was executed
    expect(stepRecord).toBeDefined()
    expect(mockAction).toHaveBeenCalledTimes(3)
    expect(mockAction).toHaveBeenCalledWith('item1')
    expect(mockAction).toHaveBeenCalledWith('item2')
    expect(mockAction).toHaveBeenCalledWith('item3')
    
    // Verify the step was marked as success
    expect(stepRecord?.status).toBe('success')
    expect(stepRecord?.outputs).toEqual([
      'processed_item1',
      'processed_item2',
      'processed_item3'
    ])
  })

  it('should maintain history between runs', async () => {
    // Create a mock function that returns different values based on call count
    const mockAction = jest.fn()
      .mockResolvedValueOnce('first run')
      .mockResolvedValueOnce('second run')
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'testAction',
          each: false,
          input: {}
        },
      ]
    }, LogLevel.ERROR)

    // First run
    const firstRun = await workflow.run({
      actions: { testAction: mockAction },
      entry: 'step1'
    })

    // Create a new workflow instance to ensure clean state
    const workflow2 = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'testAction',
          each: false,
          input: {}
        },
      ]
    }, LogLevel.ERROR)

    // Second run with history from first run
    const secondRun = await workflow2.run({
      actions: { testAction: mockAction },
      entry: 'step1',
      history: firstRun
    })

    // Verify mock was called twice
    expect(mockAction).toHaveBeenCalledTimes(2)
    
    // Get the step records
    const firstRunRecord = firstRun[0]?.steps?.step1
    const secondRunRecord = secondRun[0]?.steps?.step1
    
    // Verify both runs were recorded
    expect(firstRunRecord).toBeDefined()
    expect(secondRunRecord).toBeDefined()
    
    // Check that the outputs are what we expect
    expect(firstRunRecord?.status).toBe('success')
    expect(secondRunRecord?.status).toBe('success')
  })

  it('should track step execution with field mapping', async () => {
    const getUserData = jest.fn().mockResolvedValue({
      user: { id: 1, name: 'Alice' },
      metadata: { version: '1.0' }
    })
    
    const processUser = jest.fn().mockImplementation((input) => {
      return `processed_${input.userName}_v${input.version}`
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
          id: 'processUser', 
          action: 'processUser',
          each: false,
          input: {
            userName: 'default',
            version: '0.0'
          },
          ref: {
            'userName': 'getUserData.user.name',
            'version': 'getUserData.metadata.version'
          }
        }
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { 
        getUserData: getUserData,
        processUser: processUser
      },
      entry: 'getUserData'
    })

    const getUserRecord = history[0]?.steps?.getUserData
    const processUserRecord = history[0]?.steps?.processUser
    
    // Verify getUserData step
    expect(getUserRecord).toBeDefined()
    expect(getUserRecord?.status).toBe('success')
    expect(getUserRecord?.inputs).toEqual({})
    expect(getUserRecord?.outputs).toEqual({
      user: { id: 1, name: 'Alice' },
      metadata: { version: '1.0' }
    })
    
    // Verify processUser step with field mapping
    expect(processUserRecord).toBeDefined()
    expect(processUserRecord?.status).toBe('success')
    expect(processUserRecord?.inputs).toEqual({
      userName: 'Alice',
      version: '1.0'
    })
    expect(processUserRecord?.outputs).toBe('processed_Alice_v1.0')
    
    // Verify processUser was called with mapped fields
    expect(processUser).toHaveBeenCalledWith({
      userName: 'Alice',
      version: '1.0'
    })
  })

  it('should track step execution with backup references', async () => {
    const step1 = jest.fn().mockResolvedValue({ data: 'primary' })
    const step2 = jest.fn().mockResolvedValue(null)  // 返回 null，触发备选
    const step3 = jest.fn().mockResolvedValue({ backup: 'fallback_value' })
    const processData = jest.fn().mockImplementation((input) => `processed_${input.value}`)
    
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
            dependency: 'step1'
          }
        },
        { 
          id: 'processData', 
          action: 'processData',
          each: false,
          input: {
            value: 'default'
          },
          ref: {
            'value': 'step2.data,step3.backup'  // V2: 备选引用，step2返回null所以step2.data是undefined
          }
        }
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { 
        step1: step1,
        step2: step2,
        step3: step3,
        processData: processData
      },
      entry: 'step1'
    })

    const processDataRecord = history[0]?.steps?.processData
    
    // Verify processData step used backup reference
    expect(processDataRecord).toBeDefined()
    expect(processDataRecord?.status).toBe('success')
    expect(processDataRecord?.inputs).toEqual({
      value: 'fallback_value'  // 应该使用备选值
    })
    expect(processDataRecord?.outputs).toBe('processed_fallback_value')
    
    // Verify processData was called with backup value
    expect(processData).toHaveBeenCalledWith({
      value: 'fallback_value'
    })
  })

  it('should track conditional step execution', async () => {
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
        }
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { 
        checkCondition: checkCondition,
        trueBranch: trueBranch,
        falseBranch: falseBranch
      },
      entry: 'condition'
    })

    const conditionRecord = history[0]?.steps?.condition
    const trueBranchRecord = history[0]?.steps?.trueBranch
    const falseBranchRecord = history[0]?.steps?.falseBranch
    
    // Verify condition step
    expect(conditionRecord).toBeDefined()
    expect(conditionRecord?.status).toBe('success')
    expect(conditionRecord?.outputs).toBe(true)
    
    // Verify true branch executed
    expect(trueBranchRecord).toBeDefined()
    expect(trueBranchRecord?.status).toBe('success')
    expect(trueBranchRecord?.outputs).toBe('true_result')
    
    // Verify false branch was not executed
    expect(falseBranchRecord).toBeUndefined()
    
    // Verify only condition and trueBranch were called
    expect(checkCondition).toHaveBeenCalledTimes(1)
    expect(trueBranch).toHaveBeenCalledTimes(1)
    expect(falseBranch).not.toHaveBeenCalled()
  })

  it('should track complex each step execution with field mapping', async () => {
    const getUsersData = jest.fn().mockResolvedValue({
      users: [
        { id: 1, name: 'Alice', role: 'admin' },
        { id: 2, name: 'Bob', role: 'user' }
      ],
      metadata: { version: '1.0', timestamp: '2023-01-01' }
    })
    
    const processUserWithMeta = jest.fn().mockImplementation((userData) => {
      return {
        processedName: `${userData.name}_v${userData.version}`,
        role: userData.role,
        timestamp: userData.timestamp
      }
    })

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUsersData', 
          action: 'getUsersData',
          each: false,
          input: {}
        },
        { 
          id: 'processUsers', 
          action: 'processUserWithMeta',
          each: true,
          input: [
            {
              id: 0,
              name: 'placeholder',
              role: 'default',
              version: '0.0',
              timestamp: 'unknown'
            }
          ],
          ref: {
            '[].id': 'getUsersData.users[].id',
            '[].name': 'getUsersData.users[].name',
            '[].role': 'getUsersData.users[].role',
            '[].version': 'getUsersData.metadata.version',
            '[].timestamp': 'getUsersData.metadata.timestamp'
          }
        }
      ]
    }, LogLevel.ERROR)

    const history = await workflow.run({
      actions: { 
        getUsersData: getUsersData,
        processUserWithMeta: processUserWithMeta
      },
      entry: 'getUsersData'
    })

    const processUsersRecord = history[0]?.steps?.processUsers
    
    // Verify processUsers step
    expect(processUsersRecord).toBeDefined()
    expect(processUsersRecord?.status).toBe('success')
    
    // Verify input mapping
    expect(processUsersRecord?.inputs).toEqual([
      {
        id: 1,
        name: 'Alice',
        role: 'admin',
        version: '1.0',
        timestamp: '2023-01-01'
      },
      {
        id: 2,
        name: 'Bob',
        role: 'user',
        version: '1.0',
        timestamp: '2023-01-01'
      }
    ])
    
    // Verify output
    expect(processUsersRecord?.outputs).toEqual([
      {
        processedName: 'Alice_v1.0',
        role: 'admin',
        timestamp: '2023-01-01'
      },
      {
        processedName: 'Bob_v1.0',
        role: 'user',
        timestamp: '2023-01-01'
      }
    ])
    
    // Verify function calls
    expect(processUserWithMeta).toHaveBeenCalledTimes(2)
    expect(getUsersData).toHaveBeenCalledTimes(1)
  })
}); 
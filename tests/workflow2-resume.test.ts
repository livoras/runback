import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2'
import { LogLevel } from '../src/logger'

describe('Workflow2 Resume Functionality - V2 Syntax', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock Date.now() to return a fixed timestamp
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2023-01-01T00:00:00Z').getTime())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should resume workflow from the specified entry point', async () => {
    const step1Action = jest.fn().mockResolvedValue([{ name: 'alice' }, { name: 'bob' }])
    const step2Action = jest.fn().mockImplementation(async (user: any) => {
      // Don't use real timers in test
      return { userName: user.name.toUpperCase() }
    })
    const step3Action = jest.fn().mockImplementation(async (input: any) => {
      // Don't use real timers in test
      return input.total * 2
    })
    
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
          each: true,
          input: [],
          ref: {
            '[]': 'step1'  // V2: 使用 ref 替换数组
          }
        },
        { 
          id: 'step3', 
          action: 'step3',
          each: false,
          input: {
            total: 0
          },
          ref: {
            'total': 'step2.length'  // V2: 使用 ref 映射字段
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
    expect(step2Action).toHaveBeenCalledTimes(2) // Called for each item in step1 result
    expect(step3Action).toHaveBeenCalledTimes(1)
    // History contains one entry per run, not per step
    expect(history).toHaveLength(1)

    // Reset mocks
    step1Action.mockClear()
    step2Action.mockClear()
    step3Action.mockClear()

    // Second run - resume from step2
    const resumeHistory = await workflow.run({
      actions,
      entry: 'step2',  // Resume from step2
      history,
      resume: true
    })

    // Only step2 and step3 should have run
    expect(step1Action).not.toHaveBeenCalled()
    expect(step2Action).toHaveBeenCalledTimes(2) // Called for each item in step1 result
    expect(step3Action).toHaveBeenCalledTimes(1)
    
    // The resume should create a new history entry
    expect(resumeHistory.length).toBe(2)
    
    // Get the resume run record which should contain our steps
    const resumeRun = resumeHistory[1]
    
    // Verify step3 was executed and has the correct result (2 items in step2 array, so 2*2=4)
    const step3Record = resumeRun.steps['step3']
    expect(step3Record).toBeDefined()
    expect(step3Record?.outputs).toBe(4)
  })

  it('should not execute any steps when resuming with invalid entry point', async () => {
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
            dependency: 'step1'  // V2: 简单依赖关系
          }
        },
      ]
    }, LogLevel.ERROR)

    const step1Action = jest.fn().mockResolvedValue('result1')
    const step2Action = jest.fn().mockResolvedValue('result2')

    const actions = {
      step1: step1Action,
      step2: step2Action
    }

    // First run - normal execution
    const history = await workflow.run({ actions, entry: 'step1' })
    
    // Reset mocks
    step1Action.mockClear()
    step2Action.mockClear()

    // Try to resume with invalid entry point
    const resumeHistory = await workflow.run({
      actions,
      entry: 'nonexistent',
      history,
      resume: true
    })
    
    // No steps should have been executed
    expect(step1Action).not.toHaveBeenCalled()
    expect(step2Action).not.toHaveBeenCalled()
    // Should return the same history since no steps were executed
    expect(resumeHistory).toEqual(history)
  })

  it('should resume with complex field mapping', async () => {
    const fetchUserData = jest.fn().mockResolvedValue({
      users: [
        { id: 1, name: 'Alice', role: 'admin' },
        { id: 2, name: 'Bob', role: 'user' }
      ],
      metadata: { version: '1.0', timestamp: '2023-01-01' }
    })
    const processUsers = jest.fn().mockImplementation((userData: any) => {
      return {
        processed: true,
        userId: userData.userId,
        userName: userData.userName,
        userRole: userData.userRole,
        version: userData.version
      }
    })
    const generateReport = jest.fn().mockImplementation((data: any) => {
      return {
        report: `Processed ${data.processedData.length} users`,
        summary: data.processedData
      }
    })

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'fetchData', 
          action: 'fetchUserData',
          each: false,
          input: {}
        },
        { 
          id: 'processUsers', 
          action: 'processUsers',
          each: true,
          input: [
            {
              userId: 0,
              userName: 'placeholder',
              userRole: 'default',
              version: '0.0'
            }
          ],
          ref: {
            '[].userId': 'fetchData.users[].id',
            '[].userName': 'fetchData.users[].name',
            '[].userRole': 'fetchData.users[].role',
            '[].version': 'fetchData.metadata.version'
          }
        },
        { 
          id: 'generateReport', 
          action: 'generateReport',
          each: false,
          input: {
            processedData: []
          },
          ref: {
            'processedData': 'processUsers'
          }
        },
      ]
    }, LogLevel.ERROR)

    const actions = {
      fetchUserData: fetchUserData,
      processUsers: processUsers,
      generateReport: generateReport
    }

    // First run - execute all steps
    const history = await workflow.run({
      actions,
      entry: 'fetchData'
    })

    expect(history).toHaveLength(1)
    expect(fetchUserData).toHaveBeenCalledTimes(1)
    expect(processUsers).toHaveBeenCalledTimes(2)
    expect(generateReport).toHaveBeenCalledTimes(1)

    // Reset mocks
    fetchUserData.mockClear()
    processUsers.mockClear()
    generateReport.mockClear()

    // Resume from processUsers step
    const resumeHistory = await workflow.run({
      actions,
      entry: 'processUsers',
      history,
      resume: true
    })

    // Only processUsers and generateReport should execute
    expect(fetchUserData).not.toHaveBeenCalled()
    expect(processUsers).toHaveBeenCalledTimes(2)
    expect(generateReport).toHaveBeenCalledTimes(1)

    expect(resumeHistory).toHaveLength(2)
    
    // Verify the resume run has correct data
    const resumeRun = resumeHistory[1]
    expect(resumeRun.steps.processUsers.outputs).toEqual([
      {
        processed: true,
        userId: 1,
        userName: 'Alice',
        userRole: 'admin',
        version: '1.0'
      },
      {
        processed: true,
        userId: 2,
        userName: 'Bob',
        userRole: 'user',
        version: '1.0'
      }
    ])
    
    expect(resumeRun.steps.generateReport.outputs).toEqual({
      report: 'Processed 2 users',
      summary: resumeRun.steps.processUsers.outputs
    })
  })

  it('should handle conditional steps in resume', async () => {
    const checkCondition = jest.fn().mockResolvedValue(true)
    const trueBranch = jest.fn().mockResolvedValue('true_result')
    const falseBranch = jest.fn().mockResolvedValue('false_result')
    const finalStep = jest.fn().mockResolvedValue('final_result')

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
        { 
          id: 'final', 
          action: 'finalStep',
          each: false,
          input: {},
          ref: {
            dependency: 'trueBranch,falseBranch'  // V2: 备选依赖
          }
        }
      ]
    }, LogLevel.ERROR)

    const actions = {
      checkCondition: checkCondition,
      trueBranch: trueBranch,
      falseBranch: falseBranch,
      finalStep: finalStep
    }

    // First run
    const history = await workflow.run({
      actions,
      entry: 'condition'
    })

    expect(checkCondition).toHaveBeenCalledTimes(1)
    expect(trueBranch).toHaveBeenCalledTimes(1)  // condition returned true
    expect(falseBranch).not.toHaveBeenCalled()   // false branch not executed
    expect(finalStep).toHaveBeenCalledTimes(1)

    // Reset mocks
    checkCondition.mockClear()
    trueBranch.mockClear()
    falseBranch.mockClear()
    finalStep.mockClear()

    // Resume from trueBranch
    const resumeHistory = await workflow.run({
      actions,
      entry: 'trueBranch',
      history,
      resume: true
    })

    // Only trueBranch and final should execute
    expect(checkCondition).not.toHaveBeenCalled()
    expect(trueBranch).toHaveBeenCalledTimes(1)
    expect(falseBranch).not.toHaveBeenCalled()
    expect(finalStep).toHaveBeenCalledTimes(1)

    expect(resumeHistory).toHaveLength(2)
    
    // Verify the resume run has correct conditional context
    const resumeRun = resumeHistory[1]
    expect(resumeRun.context['condition.true']).toBe(true)
    expect(resumeRun.context['condition.false']).toBeUndefined()
    expect(resumeRun.steps.trueBranch.outputs).toBe('true_result')
    expect(resumeRun.steps.final.outputs).toBe('final_result')
  })

  it('should resume with preserved context from history', async () => {
    const initialStep = jest.fn().mockResolvedValue({ 
      data: 'initial_value',
      timestamp: '2023-01-01T00:00:00Z'
    })
    const dependentStep = jest.fn().mockImplementation((input: any) => {
      return {
        processedData: `processed_${input.data}`,
        originalTimestamp: input.timestamp,
        processedAt: '2023-01-01T01:00:00Z'
      }
    })

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'initial', 
          action: 'initialStep',
          each: false,
          input: {}
        },
        { 
          id: 'dependent', 
          action: 'dependentStep',
          each: false,
          input: {
            data: 'default',
            timestamp: 'unknown'
          },
          ref: {
            'data': 'initial.data',
            'timestamp': 'initial.timestamp'
          }
        }
      ]
    }, LogLevel.ERROR)

    const actions = {
      initialStep: initialStep,
      dependentStep: dependentStep
    }

    // First run - only execute initial step
    const history = await workflow.run({
      actions,
      entry: 'initial',
      exit: 'initial'  // Stop after initial step
    })

    expect(initialStep).toHaveBeenCalledTimes(1)
    expect(dependentStep).not.toHaveBeenCalled()
    expect(history).toHaveLength(1)

    // Reset mocks
    initialStep.mockClear()
    dependentStep.mockClear()

    // Resume from dependent step - should use context from history
    const resumeHistory = await workflow.run({
      actions,
      entry: 'dependent',
      history,
      resume: true
    })

    // Only dependent step should execute, using preserved context
    expect(initialStep).not.toHaveBeenCalled()
    expect(dependentStep).toHaveBeenCalledTimes(1)
    
    // Verify dependent step received correct data from preserved context
    expect(dependentStep).toHaveBeenCalledWith({
      data: 'initial_value',
      timestamp: '2023-01-01T00:00:00Z'
    })

    expect(resumeHistory).toHaveLength(2)
    
    const resumeRun = resumeHistory[1]
    expect(resumeRun.steps.dependent.outputs).toEqual({
      processedData: 'processed_initial_value',
      originalTimestamp: '2023-01-01T00:00:00Z',
      processedAt: '2023-01-01T01:00:00Z'
    })
  })
}); 
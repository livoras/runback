import { Workflow } from '../src/work'

describe('resume functionality', () => {
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
    const step2Action = jest.fn().mockImplementation(async (options: { user: any }) => {
      // Don't use real timers in test
      return { userName: options.user.name.toUpperCase() }
    })
    const step3Action = jest.fn().mockImplementation(async (options: { total: any }) => {
      // Don't use real timers in test
      return options.total * 2
    })
    
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'step1' },
        { id: 'step2', action: 'step2', each: '$ref.step1', options: { user: '$ref.$item' } },
        { id: 'step3', action: 'step3', options: { total: '$ref.step2.length' } },
      ]
    })

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
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'step1' },
        { id: 'step2', action: 'step2', depends: ['step1'] },
      ]
    })

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
})

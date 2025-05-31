import { Workflow } from '../src/workflow'

describe('onlyRuns functionality', () => {
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
    
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'step1' },
        { id: 'step2', action: 'step2', depends: ['step1'] },
        { id: 'step3', action: 'step3', depends: ['step2'] },
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
    const step2Action = jest.fn().mockImplementation(({ userId }) => `Processed ${userId}`)
    
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'step1' },
        { id: 'step2', action: 'step2', options: { userId: '$ref.step1.user' } },
      ]
    })

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
    
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'step1' },
      ]
    })

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
})

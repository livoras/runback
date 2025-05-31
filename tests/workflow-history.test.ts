import { Workflow } from '../src/work'

describe('Workflow History', () => {
  // Mock actions for testing
  const mockActions: Record<string, jest.Mock> = {
    getUserInfo: jest.fn().mockResolvedValue({ name: 'testUser', role: 'admin' }),
    checkPermission: jest.fn().mockImplementation(({ role }) => role === 'admin'),
    logAccess: jest.fn().mockResolvedValue('access_logged'),
    fetchData: jest.fn().mockResolvedValue(['data1', 'data2']),
    processItem: jest.fn().mockImplementation(({ item }) => `processed_${item}`)
  }

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  it('should record final context in history', async () => {
    const workflow = new Workflow({
      steps: [
        { id: 'getUser', action: 'getUserInfo' },
        { 
          id: 'checkAccess', 
          action: 'checkPermission', 
          options: { role: '$ref.getUser.role' },
          type: 'if',
          depends: ['getUser']
        },
        { 
          id: 'logAccess', 
          action: 'logAccess',
          depends: ['checkAccess.true']
        },
        { 
          id: 'fetchData', 
          action: 'fetchData',
          depends: ['getUser']
        }
      ]
    })

    const history: any[] = []
    await workflow.run({ 
      actions: mockActions,
      history,
      entry: 'getUser' 
    })

    // History should have one entry (the final context)
    expect(history).toHaveLength(1)
    
    const finalContext = history[0]
    
    // Verify final context contains all expected data
    expect(finalContext.getUser).toBeDefined()
    expect(finalContext.getUser.name).toBe('testUser')
    expect(finalContext['checkAccess.true']).toBe(true)
    expect(finalContext.logAccess).toBe('access_logged')
    expect(finalContext.fetchData).toEqual(['data1', 'data2'])
    
    // Verify mock functions were called correctly
    expect(mockActions.getUserInfo).toHaveBeenCalled()
    expect(mockActions.checkPermission).toHaveBeenCalledWith({ role: 'admin' })
    expect(mockActions.logAccess).toHaveBeenCalled()
    expect(mockActions.fetchData).toHaveBeenCalled()
    
    // Verify fetchData was called
    expect(mockActions.fetchData).toHaveBeenCalled()
  })

  it('should handle empty history array', async () => {
    const workflow = new Workflow({
      steps: [
        { id: 'getUser', action: 'getUserInfo' },
        { 
          id: 'fetchData', 
          action: 'fetchData',
          depends: ['getUser']
        }
      ]
    })

    const history: any[] = []
    const result = await workflow.run({ 
      actions: mockActions,
      history,
      entry: 'getUser' 
    })

    // Should return the history array with one entry
    expect(result).toBe(history)
    expect(history).toHaveLength(1)
    expect(history[0].getUser).toBeDefined()
    expect(history[0].fetchData).toEqual(['data1', 'data2'])
  })

  it('should work with each steps', async () => {
    // 为这个测试单独设置 processItem 的 mock 实现
    const processItemMock = jest.fn()
      .mockImplementation(({ item }) => `processed_${item}`)

    const workflow = new Workflow({
      steps: [
        { id: 'getItems', action: 'fetchData' },
        {
          id: 'processItems',
          action: 'processItem',
          each: '$ref.getItems',
          options: { item: '$item' },
          depends: ['getItems']
        }
      ]
    })

    const history: any[] = []
    // Create a new actions object with the custom processItem mock
    const actions = {
      ...mockActions,
      processItem: processItemMock
    }
    
    await workflow.run({
      actions,
      history,
      entry: 'getItems'
    })

    // Verify final context contains processed items
    expect(history).toHaveLength(1)
    // Verify the results are stored in the context
    expect(history[0].processItems).toEqual([
      'processed_$item',
      'processed_$item'
    ])
    
    // Verify processItem was called with the expected arguments
    expect(processItemMock).toHaveBeenCalledTimes(2)
    expect(processItemMock).toHaveBeenCalledWith({ item: '$item' })
  })

  it('should handle workflow without history option', async () => {
    const workflow = new Workflow({
      steps: [
        { id: 'getUser', action: 'getUserInfo' }
      ]
    })

    const result = await workflow.run({
      actions: mockActions,
      entry: 'getUser'
    })

    // Should return the history array with one entry when no history option is provided
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0].getUser).toBeDefined()
    expect(result[0].getUser.name).toBe('testUser')
  })

  it('should correctly append to history when run multiple times', async () => {
    const workflow = new Workflow({
      steps: [
        { id: 'getUser', action: 'getUserInfo' },
        { 
          id: 'fetchData', 
          action: 'fetchData',
          depends: ['getUser']
        }
      ]
    })

    const history: any[] = []
    
    // First run
    const result1 = await workflow.run({
      actions: mockActions,
      history,
      entry: 'getUser'
    })

    // Verify first run results
    expect(result1).toBe(history)
    expect(history).toHaveLength(1)
    expect(history[0].getUser).toBeDefined()
    expect(history[0].fetchData).toEqual(['data1', 'data2'])
    
    // Update mock to return different data
    mockActions.getUserInfo.mockResolvedValueOnce({ name: 'anotherUser', role: 'user' })
    mockActions.fetchData.mockResolvedValueOnce(['data3', 'data4'])
    
    // Second run with same history array
    const result2 = await workflow.run({
      actions: mockActions,
      history,
      entry: 'getUser'
    })
    
    // Verify second run results and history
    expect(result2).toBe(history) // Should be the same array
    expect(history).toHaveLength(2) // Should have two entries now
    
    // First entry should remain unchanged
    expect(history[0].getUser.name).toBe('testUser')
    expect(history[0].fetchData).toEqual(['data1', 'data2'])
    
    // Second entry should have new data
    expect(history[1].getUser.name).toBe('anotherUser')
    expect(history[1].fetchData).toEqual(['data3', 'data4'])
    
    // Verify mock calls
    expect(mockActions.getUserInfo).toHaveBeenCalledTimes(2)
    expect(mockActions.fetchData).toHaveBeenCalledTimes(2)
  })
})

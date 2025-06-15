import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2'
import { LogLevel } from '../src/logger'

describe('Workflow2 History - V2 Syntax', () => {
  // Mock actions for testing
  const mockActions: Record<string, jest.Mock> = {
    getUserInfo: jest.fn().mockResolvedValue({ name: 'testUser', role: 'admin' }),
    checkPermission: jest.fn().mockImplementation((data) => data.role === 'admin'),
    logAccess: jest.fn().mockResolvedValue('access_logged'),
    fetchData: jest.fn().mockResolvedValue(['data1', 'data2']),
    processItem: jest.fn().mockImplementation((item) => `processed_${item}`)
  }

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  it('should record final context in history', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUser', 
          action: 'getUserInfo',
          each: false,
          input: {}
        },
        { 
          id: 'checkAccess', 
          action: 'checkPermission',
          each: false,
          input: {
            role: 'default'
          },
          ref: {
            role: 'getUser.role'
          },
          type: 'if'  // V2: 指定为条件步骤
        },
        { 
          id: 'logAccess', 
          action: 'logAccess',
          each: false,
          input: {},
          ref: {
            // 依赖条件步骤的 true 分支
            dependency: 'checkAccess.true'
          }
        },
        { 
          id: 'fetchData', 
          action: 'fetchData',
          each: false,
          input: {},
          ref: {
            dependency: 'getUser'
          }
        }
      ]
    }, LogLevel.ERROR)

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
    expect(finalContext.context.getUser).toBeDefined()
    expect(finalContext.context.getUser.name).toBe('testUser')
    expect(finalContext.context['checkAccess.true']).toBe(true)
    expect(finalContext.context.logAccess).toBe('access_logged')
    expect(finalContext.context.fetchData).toEqual(['data1', 'data2'])
    
    // Verify mock functions were called correctly
    expect(mockActions.getUserInfo).toHaveBeenCalled()
    expect(mockActions.checkPermission).toHaveBeenCalledWith({ role: 'admin' })
    expect(mockActions.logAccess).toHaveBeenCalled()
    expect(mockActions.fetchData).toHaveBeenCalled()
  })

  it('should handle empty history array', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUser', 
          action: 'getUserInfo',
          each: false,
          input: {}
        },
        { 
          id: 'fetchData', 
          action: 'fetchData',
          each: false,
          input: {},
          ref: {
            dependency: 'getUser'
          }
        }
      ]
    }, LogLevel.ERROR)

    const history: any[] = []
    const result = await workflow.run({ 
      actions: mockActions,
      history,
      entry: 'getUser' 
    })

    // Should return the history array with one entry
    expect(result).toBe(history)
    expect(history).toHaveLength(1)
    expect(history[0].context.getUser).toBeDefined()
    expect(history[0].context.fetchData).toEqual(['data1', 'data2'])
  })

  it('should work with each steps', async () => {
    // 为这个测试单独设置 processItem 的 mock 实现
    const processItemMock = jest.fn()
      .mockImplementation((item) => `processed_${item}`)

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getItems', 
          action: 'fetchData',
          each: false,
          input: {}
        },
        {
          id: 'processItems',
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            '[]': 'getItems'
          }
        }
      ]
    }, LogLevel.ERROR)

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
    expect(history[0].context.processItems).toEqual([
      'processed_data1',
      'processed_data2'
    ])
    
    // Verify processItem was called with the expected arguments
    expect(processItemMock).toHaveBeenCalledTimes(2)
    expect(processItemMock).toHaveBeenCalledWith('data1')
    expect(processItemMock).toHaveBeenCalledWith('data2')
  })

  it('should handle workflow without history option', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUser', 
          action: 'getUserInfo',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR)

    const result = await workflow.run({
      actions: mockActions,
      entry: 'getUser'
    })

    // Should return the history array with one entry when no history option is provided
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0].context.getUser).toBeDefined()
    expect(result[0].context.getUser.name).toBe('testUser')
  })

  it('should correctly append to history when run multiple times', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUser', 
          action: 'getUserInfo',
          each: false,
          input: {}
        },
        { 
          id: 'fetchData', 
          action: 'fetchData',
          each: false,
          input: {},
          ref: {
            dependency: 'getUser'
          }
        }
      ]
    }, LogLevel.ERROR)

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
    expect(history[0].context.getUser).toBeDefined()
    expect(history[0].context.fetchData).toEqual(['data1', 'data2'])
    
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
    expect(history[0].context.getUser.name).toBe('testUser')
    expect(history[0].context.fetchData).toEqual(['data1', 'data2'])
    
    // Second entry should have new data
    expect(history[1].context.getUser.name).toBe('anotherUser')
    expect(history[1].context.fetchData).toEqual(['data3', 'data4'])
    
    // Verify mock calls
    expect(mockActions.getUserInfo).toHaveBeenCalledTimes(2)
    expect(mockActions.fetchData).toHaveBeenCalledTimes(2)
  })

  it('should record status and error correctly for successful run', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getUser', 
          action: 'getUserInfo',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR);
    
    const history: any[] = [];
    await workflow.run({ actions: mockActions, history, entry: 'getUser' });
    const record = history[history.length - 1];
    expect(record.status).toBe('success');
    expect(record.error).toBeUndefined();
  });

  it('should record status and error correctly for failed run', async () => {
    const errorActions = {
      ...mockActions,
      failStep: jest.fn().mockImplementation(() => { throw new Error('测试错误') })
    };
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'failStep', 
          action: 'failStep',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR);
    
    const history = await workflow.run({ actions: errorActions as any, history: [], entry: 'failStep' })
    const record = history[history.length - 1];
    expect(record.status).toBe('failed');
    expect(record.error?.message).toBe('测试错误');
    expect(record.error?.stack).toBeDefined();
  });
}); 
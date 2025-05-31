import { Workflow } from '../src/workflow'

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
    expect(history[0].context.getUser).toBeDefined()
    expect(history[0].context.fetchData).toEqual(['data1', 'data2'])
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
    expect(history[0].context.processItems).toEqual([
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
    expect(result[0].context.getUser).toBeDefined()
    expect(result[0].context.getUser.name).toBe('testUser')
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

  it('should handle multiple consecutive runs with history', async () => {
    const workflow = new Workflow({
      steps: [
        { id: 'counter', action: 'incrementCounter' },
        { 
          id: 'process', 
          action: 'processData',
          depends: ['counter']
        }
      ]
    })

    // Initialize mock actions
    const mockIncrementCounter = jest.fn()
    const mockProcessData = jest.fn()
    
    const history: any[] = []
    const runCount = 10 // Run the workflow 10 times
    
    for (let i = 0; i < runCount; i++) {
      // Setup mocks for this run
      const counterValue = i + 1
      const processedValue = `processed_${counterValue}`
      
      mockIncrementCounter.mockResolvedValueOnce(counterValue)
      mockProcessData.mockResolvedValueOnce(processedValue)
      
      // Run the workflow
      const result = await workflow.run({
        actions: {
          incrementCounter: mockIncrementCounter,
          processData: mockProcessData
        },
        history,
        entry: 'counter'
      })
      
      // Verify the result is the same array as history
      expect(result).toBe(history)
      expect(history).toHaveLength(i + 1)
      
      // Verify the latest history entry
      const latest = history[history.length - 1]
      expect(latest.context.counter).toBe(counterValue)
      expect(latest.context.process).toBe(processedValue)
      
      // Verify all previous history entries are unchanged
      for (let j = 0; j < i; j++) {
        expect(history[j].context.counter).toBe(j + 1)
        expect(history[j].context.process).toBe(`processed_${j + 1}`)
      }
    }
    
    // Verify mocks were called the correct number of times
    expect(mockIncrementCounter).toHaveBeenCalledTimes(runCount)
    expect(mockProcessData).toHaveBeenCalledTimes(runCount)
    
    // Verify final history state
    expect(history).toHaveLength(runCount)
    expect(history[runCount - 1].context.counter).toBe(runCount)
    expect(history[runCount - 1].context.process).toBe(`processed_${runCount}`)
  })

  it('should correctly record execution time in history', async () => {
    // 创建一个简单的 workflow，包含一个异步操作以产生可测量的执行时间
    const workflow = new Workflow({
      steps: [
        { 
          id: 'delay', 
          action: 'delayAction',
        },
        { 
          id: 'process', 
          action: 'processAction',
          depends: ['delay']
        }
      ]
    })

    // 模拟一个延迟操作，确保有可测量的执行时间
    const mockDelay = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    )
    const mockProcess = jest.fn().mockResolvedValue('processed')

    const history: any[] = []
    
    // 第一次运行
    const startTime1 = Date.now()
    await workflow.run({
      actions: {
        delayAction: mockDelay,
        processAction: mockProcess
      },
      history,
      entry: 'delay'
    })
    const endTime1 = Date.now()

    // 验证第一次运行的时间记录
    expect(history).toHaveLength(1)
    const record1 = history[0]
    
    // 验证时间戳格式
    expect(record1.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(record1.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    
    // 验证开始时间在预期范围内
    const recordStart1 = new Date(record1.startTime).getTime()
    expect(recordStart1).toBeGreaterThanOrEqual(startTime1 - 1000) // 允许1秒误差
    expect(recordStart1).toBeLessThanOrEqual(startTime1 + 1000)
    
    // 验证结束时间在预期范围内
    const recordEnd1 = new Date(record1.endTime).getTime()
    expect(recordEnd1).toBeGreaterThanOrEqual(endTime1 - 1000)
    expect(recordEnd1).toBeLessThanOrEqual(endTime1 + 1000)
    
    // 验证持续时间
    expect(record1.duration).toBeGreaterThanOrEqual(100) // 至少包含延迟时间
    expect(record1.duration).toBe(recordEnd1 - recordStart1)

    // 第二次运行
    const startTime2 = Date.now()
    await workflow.run({
      actions: {
        delayAction: mockDelay,
        processAction: mockProcess
      },
      history,
      entry: 'delay'
    })
    const endTime2 = Date.now()

    // 验证第二次运行的时间记录
    expect(history).toHaveLength(2)
    const record2 = history[1]
    
    // 验证时间戳格式
    expect(record2.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(record2.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    
    // 验证开始时间在预期范围内
    const recordStart2 = new Date(record2.startTime).getTime()
    expect(recordStart2).toBeGreaterThanOrEqual(startTime2 - 1000)
    expect(recordStart2).toBeLessThanOrEqual(startTime2 + 1000)
    
    // 验证结束时间在预期范围内
    const recordEnd2 = new Date(record2.endTime).getTime()
    expect(recordEnd2).toBeGreaterThanOrEqual(endTime2 - 1000)
    expect(recordEnd2).toBeLessThanOrEqual(endTime2 + 1000)
    
    // 验证持续时间
    expect(record2.duration).toBeGreaterThanOrEqual(100)
    expect(record2.duration).toBe(recordEnd2 - recordStart2)

    // 验证两次运行的时间顺序
    expect(new Date(record1.startTime).getTime()).toBeLessThan(new Date(record2.startTime).getTime())
    expect(new Date(record1.endTime).getTime()).toBeLessThanOrEqual(new Date(record2.startTime).getTime())
  })

  it('should record status and error correctly for successful run', async () => {
    const workflow = new Workflow({
      steps: [{ id: 'getUser', action: 'getUserInfo' }]
    });
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
    const workflow = new Workflow({
      steps: [{ id: 'failStep', action: 'failStep' }]
    });
    const history = await workflow.run({ actions: errorActions as any, history: [], entry: 'failStep' })
    const record = history[history.length - 1];
    expect(record.status).toBe('failed');
    expect(record.error?.message).toBe('测试错误');
    expect(record.error?.stack).toBeDefined();
  });

})

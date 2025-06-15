import { Work } from '../src/work'
import path from 'path'

// Mock fs-extra 模块
jest.mock('fs-extra', () => {
  // 在工厂函数内部创建 mock 函数
  return {
    ensureDir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    readFile: jest.fn().mockResolvedValue(JSON.stringify({
      steps: [
        { id: 'testStep', action: 'testAction', options: { test: 'value' } }
      ],
      lastRun: { results: { testStep: { success: true } } }
    }))
  }
})

// 获取 mock 函数的引用
const fs = require('fs-extra')
const mockEnsureDir = fs.ensureDir as jest.Mock
const mockWriteFile = fs.writeFile as jest.Mock
const mockExists = fs.exists as jest.Mock
const mockReadFile = fs.readFile as jest.Mock

describe('Work', () => {

  // Mock actions for testing
  const mockActions = {
    fetchData: jest.fn().mockImplementation(() => {
      return { data: ['item1', 'item2', 'item3'] }
    }),
    processItem: jest.fn().mockImplementation((options: { item: string }) => {
      return { processed: `processed-${options.item}` }
    }),
    summarize: jest.fn().mockImplementation((options: { items: any[] }) => {
      return { count: options.items.length, items: options.items }
    })
  }

  beforeEach(() => {
    // Reset all mock functions
    Object.values(mockActions).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockClear()
      }
    })
    
    // Reset fs-extra mocks
    mockEnsureDir.mockClear()
    mockWriteFile.mockClear()
    mockExists.mockClear()
    mockReadFile.mockClear()
  })

  describe('constructor', () => {
    it('should initialize with empty steps and null lastRun', () => {
      const work = new Work()
      expect(work['steps']).toEqual([])
      expect(work['lastRun']).toBeNull()
      expect(work['stepsMap']).toEqual({})
    })

    it('should initialize with provided actions and savePath', () => {
      const work = new Work(mockActions, 'test-path.json')
      expect(work.actions).toBe(mockActions)
      expect(work.savePath).toBe('test-path.json')
    })
  })

  describe('save', () => {
    it('should throw error if savePath is not provided', async () => {
      const work = new Work()
      await expect(work.save()).rejects.toThrow('savePath is required')
    })

    it('should save work state to file', async () => {
      const savePath = 'test-save-path.json'
      const work = new Work(mockActions, savePath)
      
      await work.save()
      
      expect(mockEnsureDir).toHaveBeenCalledWith(path.dirname(savePath))
      expect(mockWriteFile).toHaveBeenCalledWith(
        savePath,
        JSON.stringify({ version: 'v1', steps: [], lastRun: null }, null, 2)
      )
    })

    it('should use provided savePath over instance savePath', async () => {
      const instancePath = 'instance-path.json'
      const providedPath = 'provided-path.json'
      const work = new Work(mockActions, instancePath)
      
      await work.save(providedPath)
      
      expect(mockEnsureDir).toHaveBeenCalledWith(path.dirname(providedPath))
      expect(mockWriteFile).toHaveBeenCalledWith(
        providedPath,
        JSON.stringify({ version: 'v1', steps: [], lastRun: null }, null, 2)
      )
    })
  })

  describe('load', () => {
    it('should throw error if path is not provided', async () => {
      const work = new Work()
      await expect(work.load()).rejects.toThrow('path is required')
    })

    it('should load work state from file', async () => {
      const work = new Work(mockActions, 'test-path.json')
      
      await work.load()
      
      expect(mockExists).toHaveBeenCalledWith('test-path.json')
      expect(mockReadFile).toHaveBeenCalledWith('test-path.json', 'utf-8')
      expect(work['steps']).toEqual([
        { id: 'testStep', action: 'testAction', options: { test: 'value' } }
      ])
      expect(work['lastRun']).toEqual({ results: { testStep: { success: true } } })
      expect(work['stepsMap']).toEqual({
        testStep: { id: 'testStep', action: 'testAction', options: { test: 'value' } }
      })
    })

    it('should do nothing if file does not exist', async () => {
      mockExists.mockResolvedValueOnce(false)
      
      const work = new Work(mockActions, 'non-existent.json')
      await work.load()
      
      expect(mockReadFile).not.toHaveBeenCalled()
      expect(work['steps']).toEqual([])
    })
  })

  describe('step', () => {
    it('should add step to stepsMap and update steps array', async () => {
      const work = new Work(mockActions)
      const step = { id: 'step1', action: 'fetchData', options: {} }
      
      await work.step(step, false)
      
      expect(work['stepsMap']).toEqual({ step1: step })
      expect(work['steps']).toEqual([step])
    })

    it('should run the step when run=true', async () => {
      const work = new Work(mockActions)
      const step = { id: 'step1', action: 'fetchData', options: {} }
      
      await work.step(step, true)
      
      expect(mockActions.fetchData).toHaveBeenCalled()
      expect(work['lastRun']).not.toBeNull()
    })

    it('should not run the step when run=false', async () => {
      const work = new Work(mockActions)
      const step = { id: 'step1', action: 'fetchData', options: {} }
      
      await work.step(step, false)
      
      expect(mockActions.fetchData).not.toHaveBeenCalled()
      expect(work['lastRun']).toBeNull()
    })

    it('should save state after step if savePath is provided', async () => {
      const work = new Work(mockActions, 'test-path.json')
      const step = { id: 'step1', action: 'fetchData', options: {} }
      
      await work.step(step, false)
      
      expect(mockEnsureDir).toHaveBeenCalled()
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should return json representation after step', async () => {
      const work = new Work(mockActions)
      const step = { id: 'step1', action: 'fetchData', options: {} }
      
      const result = await work.step(step, false)
      
      expect(result).toEqual({
        version: 'v1',
        steps: [step],
        lastRun: null
      })
    })
  })

  describe('run', () => {
    it('should execute workflow with all steps', async () => {
      const work = new Work(mockActions)
      
      // Add steps without running
      await work.step({ id: 'fetchData', action: 'fetchData', options: {} }, false)
      await work.step({ 
        id: 'processItems', 
        action: 'processItem', 
        each: '$ref.fetchData.data',
        options: { item: '$ref.$item' }
      }, false)
      await work.step({
        id: 'summarize',
        action: 'summarize',
        options: { items: '$ref.processItems' }
      }, false)
      
      // Run the workflow
      const history = await work.run({ actions: mockActions, entry: 'fetchData' })
      
      // Verify actions were called
      expect(mockActions.fetchData).toHaveBeenCalled()
      expect(mockActions.processItem).toHaveBeenCalledTimes(3) // For each item
      expect(mockActions.summarize).toHaveBeenCalled()
      
      // Verify history was returned
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThan(0)
    })

    it('should pass actions from constructor if not provided in options', async () => {
      const work = new Work(mockActions)
      
      await work.step({ id: 'fetchData', action: 'fetchData', options: {} }, false)
      
      // Run without providing actions in options
      await work.run({ entry: 'fetchData' })
      
      expect(mockActions.fetchData).toHaveBeenCalled()
    })
  })

  describe('json', () => {
    it('should return steps and lastRun in json format', () => {
      const work = new Work()
      const step = { id: 'step1', action: 'action1', options: {} }
      work['stepsMap'] = { step1: step }
      work['lastRun'] = { results: { step1: { success: true } } } as any
      
      const json = work['json']()
      
      expect(json).toEqual({
        version: 'v1',
        steps: [step],
        lastRun: { results: { step1: { success: true } } }
      })
    })
  })

  describe('init', () => {
    it('should populate stepsMap from steps array', () => {
      const work = new Work()
      const step1 = { id: 'step1', action: 'action1', options: {} }
      const step2 = { id: 'step2', action: 'action2', options: {} }
      work['steps'] = [step1, step2]
      
      work['init']()
      
      expect(work['stepsMap']).toEqual({
        step1: step1,
        step2: step2
      })
    })
  })
})

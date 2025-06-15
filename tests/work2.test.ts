import { Work2 } from '../src/work'
import { Step2 } from '../src/workflow2'
import path from 'path'

// Mock fs-extra 模块
jest.mock('fs-extra', () => {
  // 在工厂函数内部创建 mock 函数
  return {
    ensureDir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    readFile: jest.fn().mockResolvedValue(JSON.stringify({
      version: 'v2',
      steps: [
        { id: 'testStep', action: 'testAction', each: false, input: { test: 'value' } }
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

describe('Work2', () => {
  let mockActions: Record<string, jest.Mock>

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockActions = {
      fetchData: jest.fn().mockResolvedValue(['item1', 'item2', 'item3']),
      processItem: jest.fn().mockImplementation((item: string) => `processed_${item}`),
      summarize: jest.fn().mockResolvedValue({ total: 3, processed: true })
    }

    // Reset fs-extra mocks
    mockEnsureDir.mockClear()
    mockWriteFile.mockClear()
    mockExists.mockClear()
    mockReadFile.mockClear()
  })

  describe('constructor', () => {
    it('should initialize with empty steps and null lastRun', () => {
      const work = new Work2()
      
      expect(work.steps).toEqual([])
      expect(work.lastRun).toBeNull()
      expect(work.actions).toBeUndefined()
      expect(work.savePath).toBeUndefined()
    })

    it('should initialize with provided actions and savePath', () => {
      const work = new Work2(mockActions, 'test-path.json')
      
      expect(work.actions).toBe(mockActions)
      expect(work.savePath).toBe('test-path.json')
    })
  })

  describe('save', () => {
    it('should save work state to file with v2 version tag', async () => {
      const savePath = 'test-save-path.json'
      const work = new Work2(mockActions, savePath)
      
      await work.save()
      
      expect(mockEnsureDir).toHaveBeenCalledWith(path.dirname(savePath))
      expect(mockWriteFile).toHaveBeenCalledWith(
        savePath,
        JSON.stringify({ version: 'v2', steps: [], lastRun: null }, null, 2)
      )
    })
  })

  describe('load', () => {
    it('should load work state from file', async () => {
      const work = new Work2(mockActions, 'test-path.json')
      
      await work.load()
      
      expect(mockExists).toHaveBeenCalledWith('test-path.json')
      expect(mockReadFile).toHaveBeenCalledWith('test-path.json', 'utf-8')
      expect(work.steps).toEqual([
        { id: 'testStep', action: 'testAction', each: false, input: { test: 'value' } }
      ])
      expect(work.lastRun).toEqual({ results: { testStep: { success: true } } })
    })

    it('should warn when loading different version', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      mockReadFile.mockResolvedValueOnce(JSON.stringify({
        version: 'v1',
        steps: [],
        lastRun: null
      }))
      
      const work = new Work2(mockActions, 'test-path.json')
      await work.load()
      
      expect(consoleSpy).toHaveBeenCalledWith('Loading v1 workflow data into v2 work instance')
      consoleSpy.mockRestore()
    })
  })

  describe('step', () => {
    it('should add V2 step to stepsMap and update steps array', async () => {
      const work = new Work2(mockActions)
      const step: Step2 = { 
        id: 'step1', 
        action: 'fetchData', 
        each: false,
        input: { source: 'api' }
      }
      
      await work.step(step, false)
      
      expect(work['stepsMap']).toEqual({ step1: step })
      expect(work.steps).toEqual([step])
    })

    it('should run the V2 step when run=true', async () => {
      const work = new Work2(mockActions)
      const step: Step2 = { 
        id: 'step1', 
        action: 'fetchData', 
        each: false,
        input: { source: 'api' }
      }
      
      await work.step(step, true)
      
      expect(mockActions.fetchData).toHaveBeenCalledWith({ source: 'api' })
      expect(work.lastRun).not.toBeNull()
    })

    it('should return json representation with v2 version', async () => {
      const work = new Work2(mockActions)
      const step: Step2 = { 
        id: 'step1', 
        action: 'fetchData', 
        each: false,
        input: { source: 'api' }
      }
      
      const result = await work.step(step, false)
      
      expect(result).toEqual({
        version: 'v2',
        steps: [step],
        lastRun: null
      })
    })
  })

  describe('run', () => {
    it('should execute V2 workflow with all steps', async () => {
      const work = new Work2(mockActions)
      
      // Add V2 steps without running
      await work.step({ 
        id: 'fetchData', 
        action: 'fetchData', 
        each: false,
        input: { source: 'api' }
      }, false)
      
      await work.step({ 
        id: 'processItems', 
        action: 'processItem', 
        each: true,
        input: [],
        ref: {
          '[]': 'fetchData'  // V2: 数组替换语法
        }
      }, false)
      
      await work.step({
        id: 'summarize',
        action: 'summarize',
        each: false,
        input: {},
        ref: {
          items: 'processItems'  // V2: 字段映射语法
        }
      }, false)
      
      // Run the V2 workflow
      const history = await work.run({ entry: 'fetchData' })
      
      // Verify actions were called
      expect(mockActions.fetchData).toHaveBeenCalledWith({ source: 'api' })
      expect(mockActions.processItem).toHaveBeenCalledTimes(3) // For each item
      expect(mockActions.summarize).toHaveBeenCalledWith({ items: ['processed_item1', 'processed_item2', 'processed_item3'] })
      
      // Verify history was returned
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThan(0)
    })

    it('should support entryOptions with V2 workflow', async () => {
      const work = new Work2(mockActions)
      
      await work.step({ 
        id: 'fetchData', 
        action: 'fetchData', 
        each: false,
        input: { source: 'default' }
      }, false)
      
      // Run with entryOptions
      await work.run({ 
        entry: 'fetchData',
        entryOptions: { source: 'dynamic', count: 5 }
      })
      
      // entryOptions should override input
      expect(mockActions.fetchData).toHaveBeenCalledWith({ source: 'dynamic', count: 5 })
    })
  })
}) 
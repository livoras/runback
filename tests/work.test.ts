import { Workflow } from '../src/work'

describe('Workflow', () => {
  // 模拟的 actions
  const mockActions = {
    getUserInfo: jest.fn().mockImplementation((options: { id: number }) => {
      if (!options?.id) throw new Error("id is required")
      return { name: "jerry" }
    }),
    checkUserName: jest.fn().mockImplementation(({ name }: { name: string }) => {
      return ["jerry", "tom"].includes(name)
    }),
    sayHi: jest.fn().mockImplementation(({ input: { name } }: { input: { name: string } }) => {
      return { result: `hi!!! ${name}` }
    }),
    log: jest.fn().mockImplementation(({ message }: { message: string }) => {
      return "OJBK"
    }),
    delay: jest.fn().mockImplementation(async ({ ms }: { ms: number }) => {
      await new Promise(resolve => setTimeout(resolve, ms))
      return `delayed ${ms}ms`
    })
  }

  beforeEach(() => {
    // 重置所有 mock 函数的调用记录
    Object.values(mockActions).forEach(action => {
      if (jest.isMockFunction(action)) {
        action.mockClear()
      }
    })
  })

  describe('if logic', () => {
    it('should execute true branch when condition is true', async () => {
      const wf = new Workflow({
        steps: [
          { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
          { id: "checkUserName", action: "checkUserName", options: { name: "$ref.getUserInfoId.name" }, type: "if" },
          { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } }, depends: ["checkUserName.true"] },
          { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
        ]
      })

      await wf.run({ actions: mockActions, entry: "getUserInfoId" })

      expect(mockActions.getUserInfo).toHaveBeenCalledWith({ id: 123 })
      expect(mockActions.checkUserName).toHaveBeenCalledWith({ name: "jerry" })
      expect(mockActions.sayHi).toHaveBeenCalledWith({ input: { name: "jerry" } })
      expect(mockActions.log).toHaveBeenCalledWith({ message: "hi!!! jerry" })
    })

    it('should not execute false branch when condition is false', async () => {
      mockActions.getUserInfo.mockImplementationOnce(() => ({ name: "unknown" }))
      
      const wf = new Workflow({
        steps: [
          { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
          { id: "checkUserName", action: "checkUserName", options: { name: "$ref.getUserInfoId.name" }, type: "if" },
          { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } }, depends: ["checkUserName.true"] },
          { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
        ]
      })

      await wf.run({ actions: mockActions, entry: "getUserInfoId" })

      expect(mockActions.getUserInfo).toHaveBeenCalledWith({ id: 123 })
      expect(mockActions.checkUserName).toHaveBeenCalledWith({ name: "unknown" })
      expect(mockActions.sayHi).not.toHaveBeenCalled()
      expect(mockActions.log).not.toHaveBeenCalled()
    })
  })

  describe('entry logic', () => {
    it('should start from specified entry point', async () => {
      const wf = new Workflow({
        steps: [
          { id: "step1", action: "log", options: { message: "step1" } },
          { id: "step2", action: "log", options: { message: "step2" } },
          { id: "step3", action: "log", options: { message: "step3" } },
        ]
      })

      await wf.run({ actions: mockActions, entry: "step2" })

      expect(mockActions.log).toHaveBeenCalledTimes(1)
      expect(mockActions.log).toHaveBeenCalledWith({ message: "step2" })
    })
  })

  describe('dependencies', () => {
    it('should wait for all dependencies to complete', async () => {
      const wf = new Workflow({
        steps: [
          { id: "step0", action: "log", options: { "message": "step0" }},
          { id: "step1", action: "delay", options: { ms: 100 }, depends: ["step0"] },
          { id: "step2", action: "delay", options: { ms: 50 }, depends: ["step0"] },
          { id: "step3", action: "log", options: { message: ["$ref.step1", "$ref.step2"] }, depends: ["step1", "step2"] },
        ]
      })

      const startTime = Date.now()
      await wf.run({ actions: mockActions, entry: "step0" })
      const endTime = Date.now()

      expect(endTime - startTime).toBeGreaterThanOrEqual(100) // 应该等待最长的延迟
      expect(mockActions.log).toHaveBeenCalledWith({ message: ["delayed 100ms", "delayed 50ms"] })
    })
  })

  describe('entry、无依赖、依赖 entry 的 step 执行情况', () => {
    it('step1 (entry) 和 step3 (依赖 entry) 被执行，step2 (无依赖) 不被执行', async () => {
      const step1Action = jest.fn()
      const step2Action = jest.fn()
      const step3Action = jest.fn()
      const wf = new Workflow({
        steps: [
          { id: "step1", action: "step1Action" }, // entry
          { id: "step2", action: "step2Action" }, // 无依赖
          { id: "step3", action: "step3Action", options: { from: "$ref.step1" } }, // 自动依赖 step1
        ]
      })
      await wf.run({ actions: { step1Action, step2Action, step3Action }, entry: "step1" })
      expect(step1Action).toHaveBeenCalled()
      expect(step3Action).toHaveBeenCalledWith({ from: undefined }) // step1Action 返回 undefined，from: undefined
      expect(step2Action).not.toHaveBeenCalled()
    })
  })

  describe('孤立 step 不会被执行', () => {
    it('should not execute steps without depends and not entry', async () => {
      const orphanAction = jest.fn()
      const wf = new Workflow({
        steps: [
          { id: "entryStep", action: "log", options: { message: "entry" } },
          { id: "orphanStep", action: "orphanAction" }, // 没有 depends，也不是 entry
        ]
      })
      await wf.run({ actions: { ...mockActions, orphanAction }, entry: "entryStep" })
      expect(mockActions.log).toHaveBeenCalledWith({ message: "entry" })
      expect(orphanAction).not.toHaveBeenCalled()
    })
  })

  describe('parameter collection', () => {
    it('should correctly collect and inject parameters', async () => {
      const wf = new Workflow({
        steps: [
          { id: "step1", action: "getUserInfo", options: { id: 123 } },
          { id: "step2", action: "sayHi", options: { input: { name: "$ref.step1.name" } } },
          { id: "step3", action: "log", options: { message: "$ref.step2.result" } },
        ]
      })

      await wf.run({ actions: mockActions, entry: "step1" })

      expect(mockActions.getUserInfo).toHaveBeenCalledWith({ id: 123 })
      expect(mockActions.sayHi).toHaveBeenCalledWith({ input: { name: "jerry" } })
      expect(mockActions.log).toHaveBeenCalledWith({ message: "hi!!! jerry" })
    })

    it('should handle nested parameter references', async () => {
      const wf = new Workflow({
        steps: [
          { id: "step1", action: "getUserInfo", options: { id: 123 } },
          { id: "step2", action: "sayHi", options: { input: { name: "$ref.step1.name" } } },
          { id: "step3", action: "log", options: { message: { nested: "$ref.step2.result" } } },
        ]
      })

      await wf.run({ actions: mockActions, entry: "step1" })

      expect(mockActions.log).toHaveBeenCalledWith({ message: { nested: "hi!!! jerry" } })
    })
  })

  describe('concurrent execution', () => {
    it('should execute independent steps concurrently', async () => {
      const wf = new Workflow({
        steps: [
          { id: "step0", action: "log", options: { message: "step0" } },
          { id: "step1", action: "delay", options: { ms: 100 }, depends: ["step0"] },
          { id: "step2", action: "delay", options: { ms: 100 }, depends: ["step0"] },
          { id: "step3", action: "delay", options: { ms: 100 }, depends: ["step0"] },
          { id: "step4", action: "log", options: { message: ["$ref.step1", "$ref.step2", "$ref.step3"] }, depends: ["step1", "step2", "step3"] },
        ]
      })

      const startTime = Date.now()
      await wf.run({ actions: mockActions, entry: "step0" })
      const endTime = Date.now()

      // 由于并发执行，总时间应该接近最长的单个步骤时间，而不是所有步骤时间的总和
      expect(endTime - startTime).toBeLessThan(300)
      expect(mockActions.log).toHaveBeenCalledWith({
        message: ["delayed 100ms", "delayed 100ms", "delayed 100ms"]
      })
    })
  })
}) 
import { Workflow } from '../src/workflow'

describe('Workflow Exit', () => {
  // 模拟的 actions
  const mockActions = {
    step1: jest.fn().mockImplementation(() => {
      return { result: 'step1 executed' }
    }),
    step2: jest.fn().mockImplementation(() => {
      return { result: 'step2 executed' }
    }),
    step3: jest.fn().mockImplementation(() => {
      return { result: 'step3 executed' }
    }),
    exitStep: jest.fn().mockImplementation(() => {
      return { result: 'exit step executed' }
    }),
    afterExit: jest.fn().mockImplementation(() => {
      return { result: 'after exit executed' }
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

  describe('exit 功能', () => {
    it('应该在执行 exit 节点后停止工作流执行', async () => {
      const wf = new Workflow({
        steps: [
          { id: 'step1', action: 'step1' },
          { id: 'step2', action: 'step2', options: { $depends: "$ref.step1" } },
          { id: 'exitStep', action: 'exitStep', options: { $depends: "$ref.step2" } },
          { id: 'afterExit', action: 'afterExit', options: { $depends: "$ref.exitStep" } } // 依赖 exitStep，不会在同一轮执行
        ]
      })

      await wf.run({ 
        actions: mockActions, 
        entry: 'step1',
        exit: 'exitStep' // 指定 exitStep 为退出节点
      })

      // 验证执行顺序和调用情况
      expect(mockActions.step1).toHaveBeenCalled()
      expect(mockActions.step2).toHaveBeenCalled()
      expect(mockActions.exitStep).toHaveBeenCalled()
      expect(mockActions.afterExit).not.toHaveBeenCalled() // 这个不应该被调用，因为工作流在 exitStep 后停止
    })

    it('如果 exit 节点未被执行，工作流应该正常完成所有步骤', async () => {
      const wf = new Workflow({
        steps: [
          { id: 'step1', action: 'step1' },
          { id: 'step2', action: 'step2', options: { $depends: "$ref.step1" } },
          { id: 'step3', action: 'step3', options: { $depends: "$ref.step2" } }
        ]
      })

      await wf.run({ 
        actions: mockActions, 
        entry: 'step1',
        exit: 'exitStep' // 指定一个不存在的退出节点
      })

      // 验证所有步骤都被执行
      expect(mockActions.step1).toHaveBeenCalled()
      expect(mockActions.step2).toHaveBeenCalled()
      expect(mockActions.step3).toHaveBeenCalled()
    })

    it('应该在多个并行步骤中正确处理 exit 节点', async () => {
      const wf = new Workflow({
        steps: [
          { id: 'step1', action: 'step1' },
          { id: 'step2', action: 'step2', options: { $depends: "$ref.step1" } },
          { id: 'exitStep', action: 'exitStep', options: { $depends: "$ref.step1" } }, // 与 step2 并行
          { id: 'afterExit', action: 'afterExit', options: { $depends: "$ref.step2,$ref.exitStep" } } // 依赖 step2 和 exitStep，不会在同一轮执行
        ]
      })

      await wf.run({ 
        actions: mockActions, 
        entry: 'step1',
        exit: 'exitStep'
      })

      // 验证执行情况
      expect(mockActions.step1).toHaveBeenCalled()
      expect(mockActions.step2).toHaveBeenCalled() // 这个会被调用，因为它与 exitStep 并行
      expect(mockActions.exitStep).toHaveBeenCalled()
      expect(mockActions.afterExit).not.toHaveBeenCalled() // 这个不应该被调用，因为工作流在 exitStep 后停止
    })

    it('如果 exit 是入口节点，应该立即停止工作流', async () => {
      const wf = new Workflow({
        steps: [
          { id: 'exitStep', action: 'exitStep' },
          { id: 'afterExit', action: 'afterExit', options: { $depends: "$ref.exitStep" } }
        ]
      })

      await wf.run({ 
        actions: mockActions, 
        entry: 'exitStep',
        exit: 'exitStep'
      })

      // 验证只有入口/退出节点被执行
      expect(mockActions.exitStep).toHaveBeenCalled()
      expect(mockActions.afterExit).not.toHaveBeenCalled()
    })
  })
})

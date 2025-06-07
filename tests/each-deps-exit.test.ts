import { Workflow } from '../src/workflow'

describe('Each Dependencies Exit Mode', () => {
  test('should correctly analyze roots for end step with each and dependencies', async () => {
    // 构建测试场景：
    // 1. start 步骤（根节点）
    // 2. step2 使用 each: ["$ref.start.content", "OJBK"] 
    // 3. step3 依赖 step2 的输出
    // 4. end 依赖 start 和 step3
    
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction',
          options: {
            message: 'Hello World'
          }
        },
        {
          id: 'step2',
          action: 'eachAction',
          each: ['$ref.start.content', 'OJBK']
        },
        {
          id: 'step3', 
          action: 'processAction',
          options: {
            data: '$ref.step2'
          }
        },
        {
          id: 'end',
          action: 'endAction',
          options: {
            startData: '$ref.start',
            step3Data: '$ref.step3'
          }
        }
      ]
    })

    // 分析 end 步骤的根节点
    const rootSteps = workflow.getRootSteps('end')
    
    // 分析 end 步骤的完整路径
    const pathSteps = workflow.getPathSteps('end')
    
    
    
              // 验证根节点分析结果
     // 按照依赖分析逻辑：
     // end 依赖 [start, step3]
     // - start 没有依赖，所以 start 是根节点
     // - step3 依赖 step2
     // - step2 的 each: ['$ref.start.content', 'OJBK'] 中有 '$ref.start.content'，所以 step2 依赖 start
     // - start 没有依赖，所以 start 是根节点
     // 最终根节点应该只有 start
     expect(rootSteps).toEqual(['start'])
    
         // 验证路径分析结果
     // 完整路径应该包含：start -> step2 -> step3 -> end
     expect(pathSteps.sort()).toEqual(['end', 'start', 'step2', 'step3'])
  })

  test('should compare array vs string each dependency behavior', () => {
    // 测试数组形式的 each（不产生依赖）
    const workflowArrayEach = new Workflow({
      steps: [
        { id: 'start', action: 'startAction' },
        { id: 'step2', action: 'eachAction', each: ['$ref.start.content', 'OJBK'] },
        { id: 'end', action: 'endAction', options: { step2Data: '$ref.step2' } }
      ]
    })

    // 测试字符串形式的 each（产生依赖）  
    const workflowStringEach = new Workflow({
      steps: [
        { id: 'start', action: 'startAction' },
        { id: 'step2', action: 'eachAction', each: '$ref.start.content' },
        { id: 'end', action: 'endAction', options: { step2Data: '$ref.step2' } }
      ]
    })

    const arrayEachRoots = workflowArrayEach.getRootSteps('end')
    const stringEachRoots = workflowStringEach.getRootSteps('end')

         console.log('Array each roots:', arrayEachRoots)
     console.log('String each roots:', stringEachRoots)

     // 修复 bug 后：数组形式也会分析依赖，step2 依赖 start，所以只有一个根节点
     expect(arrayEachRoots).toEqual(['start'])
     
          // 字符串形式：step2 依赖 start，所以只有一个根节点
     expect(stringEachRoots).toEqual(['start'])
   })

  test('should handle mixed each array with and without refs', () => {
    // 测试混合数组：包含引用和字面量
    const workflowMixed = new Workflow({
      steps: [
        { id: 'start', action: 'startAction' },
        { id: 'step2', action: 'eachAction', each: ['$ref.start.content', 'literal1', 'literal2'] },
        { id: 'end', action: 'endAction', options: { step2Data: '$ref.step2' } }
      ]
    })

    // 测试纯字面量数组
    const workflowLiteral = new Workflow({
      steps: [
        { id: 'start', action: 'startAction' },
        { id: 'step2', action: 'eachAction', each: ['literal1', 'literal2', 'literal3'] },
        { id: 'end', action: 'endAction', options: { step2Data: '$ref.step2' } }
      ]
    })

    const mixedRoots = workflowMixed.getRootSteps('end')
    const literalRoots = workflowLiteral.getRootSteps('end')

    // 混合数组：因为有 $ref.start.content，所以 step2 依赖 start
    expect(mixedRoots).toEqual(['start'])
    
         // 纯字面量数组：step2 不依赖任何步骤，但 end 依赖 step2，所以 step2 是根节点
     expect(literalRoots).toEqual(['step2'])
  })

  test('should execute workflow in exit mode correctly', async () => {
    const workflow = new Workflow({
      steps: [
        {
          id: 'start',
          action: 'startAction'
        },
        {
          id: 'step2',
          action: 'eachAction', 
          each: ['$ref.start.content', 'OJBK']
        },
        {
          id: 'step3',
          action: 'processAction',
          options: {
            data: '$ref.step2'
          }
        },
        {
          id: 'end',
          action: 'endAction',
          options: {
            startValue: '$ref.start.value',
            step3Result: '$ref.step3'
          }
        },
        {
          id: 'unused',
          action: 'unusedAction'
        }
      ]
    })

    const actions = {
      startAction: () => {
        return { content: 'test-content', value: 42 }
      },
      eachAction: (item: any) => {
        return `processed-${item}`
      },
             processAction: (options: any) => {
         return `final-${options.data.join(',')}`
       },
             endAction: (options: any) => {
         return `end-${options.startValue}-${options.step3Result}`
       },
      unusedAction: () => {
        return 'should not execute'
      }
    }

    // 在 exit 模式下运行工作流
    const history = await workflow.run({
      actions,
      exit: 'end'
    })

    const record = history[0]
    
    // 验证只执行了必要的步骤，unused 步骤不应该执行
    expect(Object.keys(record.steps)).toEqual(['start', 'step2', 'step3', 'end'])
    expect(record.steps.unused).toBeUndefined()
    
    // 验证执行结果
    expect(record.steps.start.outputs).toEqual({ content: 'test-content', value: 42 })
    expect(record.steps.step2.outputs).toEqual(['processed-test-content', 'processed-OJBK'])
    expect(record.steps.step3.outputs).toBe('final-processed-test-content,processed-OJBK')
    expect(record.steps.end.outputs).toBe('end-42-final-processed-test-content,processed-OJBK')
    
    // 验证工作流状态
    expect(record.status).toBe('success')
  })

  test('should handle complex dependency analysis', () => {
    // 测试更复杂的依赖关系
    const workflow = new Workflow({
      steps: [
        { id: 'root1', action: 'action1' },
        { id: 'root2', action: 'action2' },
        { id: 'branch1', action: 'action3', options: { data: '$ref.root1' } },
        { id: 'branch2', action: 'action4', options: { data: '$ref.root2' } },
        { id: 'merge', action: 'action5', options: { data1: '$ref.branch1', data2: '$ref.branch2' } },
        { id: 'each-step', action: 'action6', each: '$ref.merge.items' },
        { id: 'final', action: 'action7', options: { mergeData: '$ref.merge', eachData: '$ref.each-step' } }
      ]
    })

    const rootSteps = workflow.getRootSteps('final')
    const pathSteps = workflow.getPathSteps('final')
    
    // final 的根节点应该是 root1 和 root2
    expect(rootSteps.sort()).toEqual(['root1', 'root2'])
    
    // 完整路径应该包含所有相关步骤
    expect(pathSteps.sort()).toEqual(['branch1', 'branch2', 'each-step', 'final', 'merge', 'root1', 'root2'])
  })
}) 
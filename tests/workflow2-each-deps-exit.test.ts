import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2';
import { LogLevel } from '../src/logger';

describe('Workflow2 Each Dependencies Exit Mode - V2 Syntax', () => {
  test('should correctly analyze roots for end step with each and dependencies', async () => {
    // 构建测试场景：
    // 1. start 步骤（根节点）
    // 2. step2 使用 each: true，通过 ref 从 start.content 获取数组数据
    // 3. step3 依赖 step2 的输出
    // 4. end 依赖 start 和 step3
    
    const workflow = new Workflow2({
      steps: [
        {
          id: 'start',
          action: 'startAction',
          each: false,
          input: {
            message: 'Hello World'
          }
        },
        {
          id: 'step2',
          action: 'eachAction',
          each: true,
          input: [],
          ref: {
            '[]': 'start.content'  // V2: 数组替换语法
          }
        },
        {
          id: 'step3', 
          action: 'processAction',
          each: false,
          input: {
            data: 'placeholder'
          },
          ref: {
            'data': 'step2'  // V2: 字段映射
          }
        },
        {
          id: 'end',
          action: 'endAction',
          each: false,
          input: {
            startData: 'placeholder',
            step3Data: 'placeholder'
          },
          ref: {
            'startData': 'start',
            'step3Data': 'step3'  // V2: 多字段映射
          }
        }
      ]
    }, LogLevel.ERROR);

    // 分析 end 步骤的根节点
    const rootSteps = workflow.getRootSteps('end');
    
    // 分析 end 步骤的完整路径
    const pathSteps = workflow.getPathSteps('end');
    
    // 验证根节点分析结果
    // 按照依赖分析逻辑：
    // end 依赖 [start, step3]
    // - start 没有依赖，所以 start 是根节点
    // - step3 依赖 step2
    // - step2 的 ref: { '[]': 'start.content' } 依赖 start
    // - start 没有依赖，所以 start 是根节点
    // 最终根节点应该只有 start
    expect(rootSteps).toEqual(['start']);
    
    // 验证路径分析结果
    // 完整路径应该包含：start -> step2 -> step3 -> end
    expect(pathSteps.sort()).toEqual(['end', 'start', 'step2', 'step3']);
  });

  test('should compare array vs ref each dependency behavior', () => {
    // 测试 V2 中 each 的依赖行为
    // V2 中 each 是布尔值，数据来源通过 ref 指定
    const workflowWithRef = new Workflow2({
      steps: [
        { id: 'start', action: 'startAction', each: false, input: {} },
        { 
          id: 'step2', 
          action: 'eachAction', 
          each: true,
          input: [],
          ref: { '[]': 'start.content' }  // V2: 通过 ref 获取数组
        },
        { 
          id: 'end', 
          action: 'endAction', 
          each: false,
          input: { step2Data: 'placeholder' },
          ref: { 'step2Data': 'step2' }
        }
      ]
    }, LogLevel.ERROR);

    // 测试没有 ref 的 each 步骤（使用静态数组）
    const workflowWithoutRef = new Workflow2({
      steps: [
        { id: 'start', action: 'startAction', each: false, input: {} },
        { 
          id: 'step2', 
          action: 'eachAction', 
          each: true,
          input: ['literal1', 'literal2', 'literal3']  // V2: 静态数组
        },
        { 
          id: 'end', 
          action: 'endAction', 
          each: false,
          input: { step2Data: 'placeholder' },
          ref: { 'step2Data': 'step2' }
        }
      ]
    }, LogLevel.ERROR);

    const withRefRoots = workflowWithRef.getRootSteps('end');
    const withoutRefRoots = workflowWithoutRef.getRootSteps('end');

    console.log('With ref roots:', withRefRoots);
    console.log('Without ref roots:', withoutRefRoots);

    // 有 ref 的情况：step2 依赖 start，所以只有一个根节点
    expect(withRefRoots).toEqual(['start']);
    
    // 没有 ref 的情况：step2 不依赖任何步骤，但 end 依赖 step2，所以 step2 是根节点
    expect(withoutRefRoots).toEqual(['step2']);
  });

  test('should handle mixed ref mappings with and without dependencies', () => {
    // 测试混合引用：包含依赖和字面量
    const workflowMixed = new Workflow2({
      steps: [
        { id: 'start', action: 'startAction', each: false, input: {} },
        { 
          id: 'step2', 
          action: 'eachAction', 
          each: true,
          input: [],
          ref: { 
            '[]': 'start.content',  // 依赖 start
            'metadata': 'start.info'  // 也依赖 start
          }
        },
        { 
          id: 'end', 
          action: 'endAction', 
          each: false,
          input: { step2Data: 'placeholder' },
          ref: { 'step2Data': 'step2' }
        }
      ]
    }, LogLevel.ERROR);

    // 测试纯字面量输入
    const workflowLiteral = new Workflow2({
      steps: [
        { id: 'start', action: 'startAction', each: false, input: {} },
        { 
          id: 'step2', 
          action: 'eachAction', 
          each: true,
          input: ['literal1', 'literal2', 'literal3']  // 纯字面量
        },
        { 
          id: 'end', 
          action: 'endAction', 
          each: false,
          input: { step2Data: 'placeholder' },
          ref: { 'step2Data': 'step2' }
        }
      ]
    }, LogLevel.ERROR);

    const mixedRoots = workflowMixed.getRootSteps('end');
    const literalRoots = workflowLiteral.getRootSteps('end');

    // 混合引用：因为有 ref 依赖 start，所以 step2 依赖 start
    expect(mixedRoots).toEqual(['start']);
    
    // 纯字面量：step2 不依赖任何步骤，但 end 依赖 step2，所以 step2 是根节点
    expect(literalRoots).toEqual(['step2']);
  });

  test('should execute workflow in exit mode correctly', async () => {
    const workflow = new Workflow2({
      steps: [
        {
          id: 'start',
          action: 'startAction',
          each: false,
          input: {}
        },
        {
          id: 'step2',
          action: 'eachAction', 
          each: true,
          input: [],
          ref: {
            '[]': 'start.content'  // V2: 数组替换
          }
        },
        {
          id: 'step3',
          action: 'processAction',
          each: false,
          input: {
            data: 'placeholder'
          },
          ref: {
            'data': 'step2'  // V2: 字段映射
          }
        },
        {
          id: 'end',
          action: 'endAction',
          each: false,
          input: {
            startValue: 'placeholder',
            step3Result: 'placeholder'
          },
          ref: {
            'startValue': 'start.value',
            'step3Result': 'step3'  // V2: 多字段映射
          }
        },
        {
          id: 'unused',
          action: 'unusedAction',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      startAction: () => {
        return { content: ['test-item1', 'test-item2'], value: 42 };
      },
      eachAction: (item: any) => {
        return `processed-${item}`;
      },
      processAction: (input: any) => {
        return `final-${input.data.join(',')}`;
      },
      endAction: (input: any) => {
        return `end-${input.startValue}-${input.step3Result}`;
      },
      unusedAction: () => {
        return 'should not execute';
      }
    };

    // 在 exit 模式下运行工作流
    const history = await workflow.run({
      actions,
      exit: 'end'
    });

    const record = history[0];
    
    // 验证只执行了必要的步骤，unused 步骤不应该执行
    expect(Object.keys(record.steps)).toEqual(['start', 'step2', 'step3', 'end']);
    expect(record.steps.unused).toBeUndefined();
    
    // 验证执行结果
    expect(record.steps.start.outputs).toEqual({ content: ['test-item1', 'test-item2'], value: 42 });
    expect(record.steps.step2.outputs).toEqual(['processed-test-item1', 'processed-test-item2']);
    expect(record.steps.step3.outputs).toBe('final-processed-test-item1,processed-test-item2');
    expect(record.steps.end.outputs).toBe('end-42-final-processed-test-item1,processed-test-item2');
    
    // 验证工作流状态
    expect(record.status).toBe('success');
  });

  test('should handle complex dependency analysis', () => {
    // 测试更复杂的依赖关系
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'root1', 
          action: 'action1', 
          each: false,
          input: {} 
        },
        { 
          id: 'root2', 
          action: 'action2', 
          each: false,
          input: {} 
        },
        { 
          id: 'branch1', 
          action: 'action3', 
          each: false,
          input: { data: 'placeholder' },
          ref: { 'data': 'root1' }
        },
        { 
          id: 'branch2', 
          action: 'action4', 
          each: false,
          input: { data: 'placeholder' },
          ref: { 'data': 'root2' }
        },
        { 
          id: 'merge', 
          action: 'action5', 
          each: false,
          input: { data1: 'placeholder', data2: 'placeholder' },
          ref: { 'data1': 'branch1', 'data2': 'branch2' }
        },
        { 
          id: 'each-step', 
          action: 'action6', 
          each: true,
          input: [],
          ref: { '[]': 'merge.items' }
        },
        { 
          id: 'final', 
          action: 'action7', 
          each: false,
          input: { mergeData: 'placeholder', eachData: 'placeholder' },
          ref: { 'mergeData': 'merge', 'eachData': 'each-step' }
        }
      ]
    }, LogLevel.ERROR);

    const rootSteps = workflow.getRootSteps('final');
    const pathSteps = workflow.getPathSteps('final');
    
    // final 的根节点应该是 root1 和 root2
    expect(rootSteps.sort()).toEqual(['root1', 'root2']);
    
    // 完整路径应该包含所有相关步骤
    expect(pathSteps.sort()).toEqual(['branch1', 'branch2', 'each-step', 'final', 'merge', 'root1', 'root2']);
  });

  test('should handle backup references in exit mode', () => {
    // 测试备选引用在退出模式下的依赖分析
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'primary', 
          action: 'primaryAction', 
          each: false,
          input: {} 
        },
        { 
          id: 'backup', 
          action: 'backupAction', 
          each: false,
          input: {} 
        },
        { 
          id: 'consumer', 
          action: 'consumerAction', 
          each: false,
          input: { result: 'placeholder' },
          ref: { 'result': 'primary.data,backup.data' }  // 备选引用
        },
        { 
          id: 'final', 
          action: 'finalAction', 
          each: false,
          input: { data: 'placeholder' },
          ref: { 'data': 'consumer' }
        }
      ]
    }, LogLevel.ERROR);

    const rootSteps = workflow.getRootSteps('final');
    const pathSteps = workflow.getPathSteps('final');
    
    // 由于备选引用，final 的根节点应该包含 primary 和 backup
    expect(rootSteps.sort()).toEqual(['backup', 'primary']);
    
    // 完整路径应该包含所有步骤
    expect(pathSteps.sort()).toEqual(['backup', 'consumer', 'final', 'primary']);
  });

  test('should execute with backup references correctly', async () => {
    // 简化测试：测试正常情况下的备选引用（primary 不存在，使用 backup）
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'backup', 
          action: 'backupAction', 
          each: false,
          input: {}
        },
        { 
          id: 'consumer', 
          action: 'consumerAction', 
          each: false,
          input: { result: 'default' },
          ref: { 'result': 'nonexistent.data,backup.data' }  // 备选引用：第一个不存在，使用第二个
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      backupAction: () => ({ data: 'backup_result' }),
      consumerAction: (input: any) => input
    };

    // 运行工作流
    const history = await workflow.run({
      actions,
      exit: 'consumer'
    });

    const record = history[0];
    
    // 验证 backup 成功，consumer 使用了 backup 的结果
    expect(record.steps.backup.status).toBe('success');
    expect(record.steps.consumer.status).toBe('success');
    expect(record.steps.consumer.outputs).toEqual({ result: 'backup_result' });
  });

  test('should handle conditional steps in exit mode', () => {
    // 测试条件步骤在退出模式下的依赖分析
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'condition', 
          action: 'checkCondition', 
          each: false,
          input: {},
          type: 'if'  // V2: 条件步骤
        },
        { 
          id: 'trueBranch', 
          action: 'trueBranch', 
          each: false,
          input: { trigger: 'placeholder' },
          ref: { 'trigger': 'condition.true' }  // 条件为真时执行
        },
        { 
          id: 'falseBranch', 
          action: 'falseBranch', 
          each: false,
          input: { trigger: 'placeholder' },
          ref: { 'trigger': 'condition.false' }  // 条件为假时执行
        },
        { 
          id: 'merge', 
          action: 'mergeAction', 
          each: false,
          input: { result: 'placeholder' },
          ref: { 'result': 'trueBranch.data,falseBranch.data' }  // 备选引用
        }
      ]
    }, LogLevel.ERROR);

    const rootSteps = workflow.getRootSteps('merge');
    const pathSteps = workflow.getPathSteps('merge');
    
    // merge 的根节点应该是 condition（条件步骤）
    expect(rootSteps).toEqual(['condition']);
    
    // 完整路径应该包含所有相关步骤
    expect(pathSteps.sort()).toEqual(['condition', 'falseBranch', 'merge', 'trueBranch']);
  });

  test('should execute conditional workflow correctly', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'condition', 
          action: 'checkCondition', 
          each: false,
          input: { value: 10 },
          type: 'if'
        },
        { 
          id: 'trueBranch', 
          action: 'trueBranch', 
          each: false,
          input: { trigger: 'placeholder' },
          ref: { 'trigger': 'condition.true' }
        },
        { 
          id: 'falseBranch', 
          action: 'falseBranch', 
          each: false,
          input: { trigger: 'placeholder' },
          ref: { 'trigger': 'condition.false' }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      checkCondition: (input: any) => input.value > 5,  // 返回 true
      trueBranch: () => ({ data: 'true_result' }),
      falseBranch: () => ({ data: 'false_result' })
    };

    // 运行工作流，条件为真，应该只执行 trueBranch
    const history = await workflow.run({
      actions,
      exit: 'trueBranch'
    });

    const record = history[0];
    
    // 验证条件步骤和真分支都执行了
    expect(record.steps.condition.status).toBe('success');
    expect(record.steps.condition.outputs).toBe(true);
    expect(record.steps.trueBranch.status).toBe('success');
    expect(record.steps.trueBranch.outputs).toEqual({ data: 'true_result' });
    
    // 假分支不应该执行
    expect(record.steps.falseBranch).toBeUndefined();
  });
}); 
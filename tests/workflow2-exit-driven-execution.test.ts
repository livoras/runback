import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2';
import { LogLevel } from '../src/logger';

describe('Workflow2 Exit-driven Execution - V2 Syntax', () => {
  test('should run from root steps when only exit is specified', async () => {
    const results: string[] = [];
    
    const actions = {
      'action1': () => { results.push('step1'); return 'result1'; },
      'action2': () => { results.push('step2'); return 'result2'; },
      'action3': () => { results.push('step3'); return 'result3'; },
      'action4': () => { results.push('step4'); return 'result4'; }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'action1',
          each: false,
          input: {}
        },
        { 
          id: 'step2', 
          action: 'action2',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'  // V2: 依赖 step1
          }
        },
        { 
          id: 'step3', 
          action: 'action3',
          each: false,
          input: {},
          ref: {
            dependency: 'step2'  // V2: 依赖 step2
          }
        },
        { 
          id: 'step4', 
          action: 'action4',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'  // V2: 依赖 step1（独立分支）
          }
        }
      ]
    }, LogLevel.ERROR);

    // 只指定 exit，应该从 step1（根节点）开始运行
    const history = await workflow.run({
      actions,
      exit: 'step3'
    });

    // 应该执行了 step1 -> step2 -> step3，但不执行 step4
    expect(results).toEqual(['step1', 'step2', 'step3']);
    expect(history[0].status).toBe('success');
  });

  test('should handle multiple root steps for exit', async () => {
    const results: string[] = [];
    
    const actions = {
      'actionA': () => { results.push('rootA'); return 'resultA'; },
      'actionB': () => { results.push('rootB'); return 'resultB'; },
      'actionC': () => { results.push('stepC'); return 'resultC'; },
      'actionD': () => { results.push('stepD'); return 'resultD'; },
      'actionFinal': () => { results.push('final'); return 'resultFinal'; }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'rootA', 
          action: 'actionA',
          each: false,
          input: {}
        },
        { 
          id: 'rootB', 
          action: 'actionB',
          each: false,
          input: {}
        },
        { 
          id: 'stepC', 
          action: 'actionC',
          each: false,
          input: {},
          ref: {
            dependency: 'rootA'
          }
        },
        { 
          id: 'stepD', 
          action: 'actionD',
          each: false,
          input: {},
          ref: {
            dependency: 'rootB'
          }
        },
        { 
          id: 'final', 
          action: 'actionFinal',
          each: false,
          input: {},
          ref: {
            depC: 'stepC',
            depD: 'stepD'  // V2: 多个依赖
          }
        }
      ]
    }, LogLevel.ERROR);

    // 只指定 exit 为 final，应该从 rootA 和 rootB 开始运行
    const history = await workflow.run({
      actions,
      exit: 'final'
    });

    // 应该执行所有步骤
    expect(results.sort()).toEqual(['rootA', 'rootB', 'stepC', 'stepD', 'final'].sort());
    expect(history[0].status).toBe('success');
  });

  test('should work with complex dependency graph', async () => {
    const results: string[] = [];
    
    const actions = {
      'fetchData': () => { results.push('fetchData'); return { data: 'test' }; },
      'processData': () => { results.push('processData'); return { processed: true }; },
      'validateData': () => { results.push('validateData'); return { valid: true }; },
      'saveData': () => { results.push('saveData'); return { saved: true }; }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'fetch', 
          action: 'fetchData',
          each: false,
          input: {}
        },
        { 
          id: 'process', 
          action: 'processData',
          each: false,
          input: {},
          ref: {
            dependency: 'fetch'
          }
        },
        { 
          id: 'validate', 
          action: 'validateData',
          each: false,
          input: {
            data: null
          },
          ref: {
            'data': 'process.processed'  // V2: 字段映射
          }
        },
        { 
          id: 'save', 
          action: 'saveData',
          each: false,
          input: {},
          ref: {
            depProcess: 'process',
            depValidate: 'validate'  // V2: 多个依赖
          }
        }
      ]
    }, LogLevel.ERROR);

    // 只指定 exit 为 save
    const history = await workflow.run({
      actions,
      exit: 'save'
    });

    // 应该执行所有必要的步骤
    expect(results).toEqual(['fetchData', 'processData', 'validateData', 'saveData']);
    expect(history[0].status).toBe('success');
  });

  test('should handle conditional steps in exit-driven execution', async () => {
    const results: string[] = [];
    
    const actions = {
      'checkCondition': () => { results.push('check'); return true; },
      'actionTrue': () => { results.push('trueAction'); return 'true result'; },
      'actionFalse': () => { results.push('falseAction'); return 'false result'; },
      'mergeResults': () => { results.push('merge'); return 'merged'; }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'check', 
          action: 'checkCondition',
          each: false,
          input: {},
          type: 'if'  // V2: 条件步骤
        },
        { 
          id: 'trueAction', 
          action: 'actionTrue',
          each: false,
          input: {},
          ref: {
            dependency: 'check.true'  // V2: 条件依赖
          }
        },
        { 
          id: 'falseAction', 
          action: 'actionFalse',
          each: false,
          input: {},
          ref: {
            dependency: 'check.false'  // V2: 条件依赖
          }
        },
        { 
          id: 'merge', 
          action: 'mergeResults',
          each: false,
          input: {},
          ref: {
            dependency: 'trueAction,falseAction'  // V2: 备选依赖，任意一个满足即可
          }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      exit: 'merge'
    });

    // 应该执行 check -> trueAction -> merge（因为条件为true）
    expect(results).toEqual(['check', 'trueAction', 'merge']);
    expect(history[0].status).toBe('success');
  });

  test('should throw error when exit step does not exist', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'action1',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR);

    await expect(workflow.run({
      actions: { action1: () => 'result' },
      exit: 'nonExistent'
    })).rejects.toThrow('Step nonExistent not found');
  });

  test('should throw error when no entry, exit, or onlyRuns specified', async () => {
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'action1',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR);

    await expect(workflow.run({
      actions: { action1: () => 'result' }
    })).rejects.toThrow('Must specify either entry, exit, or onlyRuns in run options');
  });

  test('should work with each steps in exit-driven execution', async () => {
    const results: any[] = [];
    
    const actions = {
      'generateList': () => { 
        results.push('generateList'); 
        return { items: ['a', 'b', 'c'] }; 
      },
      'processItem': (item: any) => { 
        results.push(`process-${item}`); 
        return `processed-${item}`; 
      },
      'summarize': () => { 
        results.push('summarize'); 
        return 'summary'; 
      }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'generate', 
          action: 'generateList',
          each: false,
          input: {}
        },
        { 
          id: 'process', 
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            '[]': 'generate.items'  // V2: 数组替换
          }
        },
        { 
          id: 'summary', 
          action: 'summarize',
          each: false,
          input: {},
          ref: {
            dependency: 'process'
          }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      exit: 'summary'
    });

    expect(results).toEqual(['generateList', 'process-a', 'process-b', 'process-c', 'summarize']);
    expect(history[0].status).toBe('success');
  });

  test('should handle complex field mapping in exit-driven execution', async () => {
    const results: any[] = [];
    
    const actions = {
      'fetchUsers': () => {
        results.push('fetchUsers');
        return {
          users: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' }
          ],
          metadata: { version: '1.0' }
        };
      },
      'processUser': (userData: any) => {
        results.push(`process-${userData.name}-v${userData.version}`);
        return {
          processed: userData.name,
          version: userData.version,
          id: userData.id
        };
      },
      'finalizeResults': (input: any) => {
        results.push(`finalize-${input.count}`);
        return `finalized_${input.count}`;
      }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'fetchUsers', 
          action: 'fetchUsers',
          each: false,
          input: {}
        },
        { 
          id: 'processUsers', 
          action: 'processUser',
          each: true,
          input: [
            {
              id: 0,
              name: 'placeholder',
              version: '0.0'
            }
          ],
          ref: {
            '[].id': 'fetchUsers.users[].id',
            '[].name': 'fetchUsers.users[].name',
            '[].version': 'fetchUsers.metadata.version'  // V2: 复杂字段映射
          }
        },
        { 
          id: 'finalize', 
          action: 'finalizeResults',
          each: false,
          input: {
            count: 0
          },
          ref: {
            'count': 'processUsers.length'  // V2: 长度映射
          }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      exit: 'finalize'
    });

    expect(results).toEqual([
      'fetchUsers',
      'process-Alice-v1.0',
      'process-Bob-v1.0',
      'finalize-2'
    ]);
    expect(history[0].status).toBe('success');
  });

  test('should handle backup references in exit-driven execution', async () => {
    const results: string[] = [];
    
    const actions = {
      'step1': () => { results.push('step1'); return { data: 'primary' }; },
      'step2': () => { results.push('step2'); return null; }, // 返回 null，触发备选
      'step3': () => { results.push('step3'); return { backup: 'secondary' }; },
      'final': (input: any) => { 
        results.push(`final-${input.value}`); 
        return `processed_${input.value}`; 
      }
    };

    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'step1',
          each: false,
          input: {}
        },
        { 
          id: 'step2', 
          action: 'step2',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'
          }
        },
        { 
          id: 'step3', 
          action: 'step3',
          each: false,
          input: {},
          ref: {
            dependency: 'step1'
          }
        },
        { 
          id: 'final', 
          action: 'final',
          each: false,
          input: {
            value: 'default'
          },
          ref: {
            'value': 'step2.data,step3.backup'  // V2: 备选引用，逗号分隔
          }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      exit: 'final'
    });

    expect(results).toEqual(['step1', 'step2', 'step3', 'final-secondary']);
    expect(history[0].status).toBe('success');
  });
}); 
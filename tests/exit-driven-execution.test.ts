import { Workflow } from '../src/workflow';
import { LogLevel } from '../src/logger';

describe('Exit-driven Execution', () => {
  test('should run from root steps when only exit is specified', async () => {
    const results: string[] = [];
    
    const actions = {
      'action1': () => { results.push('step1'); return 'result1'; },
      'action2': () => { results.push('step2'); return 'result2'; },
      'action3': () => { results.push('step3'); return 'result3'; },
      'action4': () => { results.push('step4'); return 'result4'; }
    };

    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'action1' },
        { id: 'step2', action: 'action2', depends: ['step1'] },
        { id: 'step3', action: 'action3', depends: ['step2'] },
        { id: 'step4', action: 'action4', depends: ['step1'] }
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

    const workflow = new Workflow({
      steps: [
        { id: 'rootA', action: 'actionA' },
        { id: 'rootB', action: 'actionB' },
        { id: 'stepC', action: 'actionC', depends: ['rootA'] },
        { id: 'stepD', action: 'actionD', depends: ['rootB'] },
        { id: 'final', action: 'actionFinal', depends: ['stepC', 'stepD'] }
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

    const workflow = new Workflow({
      steps: [
        { id: 'fetch', action: 'fetchData' },
        { 
          id: 'process', 
          action: 'processData',
          depends: ['fetch']
        },
        { 
          id: 'validate', 
          action: 'validateData',
          options: { data: '$ref.process.processed' }
        },
        { 
          id: 'save', 
          action: 'saveData',
          depends: ['process', 'validate']
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

    const workflow = new Workflow({
      steps: [
        { id: 'check', action: 'checkCondition', type: 'if' },
        { id: 'trueAction', action: 'actionTrue', depends: ['check.true'] },
        { id: 'falseAction', action: 'actionFalse', depends: ['check.false'] },
        { id: 'merge', action: 'mergeResults', depends: ['trueAction,falseAction'] }
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
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'action1' }
      ]
    }, LogLevel.ERROR);

    await expect(workflow.run({
      actions: { action1: () => 'result' },
      exit: 'nonExistent'
    })).rejects.toThrow('Step nonExistent not found');
  });

  test('should throw error when no entry, exit, or onlyRuns specified', async () => {
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'action1' }
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

    const workflow = new Workflow({
      steps: [
        { id: 'generate', action: 'generateList' },
        { 
          id: 'process', 
          action: 'processItem',
          each: '$ref.generate.items'
        },
        { 
          id: 'summary', 
          action: 'summarize',
          depends: ['process']
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
}); 
import { Workflow } from '../src/workflow';
import { LogLevel } from '../src/logger';

describe('Workflow getRootSteps', () => {
  test('should find single root step for linear chain', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'action1' },
        { id: 'step2', action: 'action2', depends: ['step1'] },
        { id: 'step3', action: 'action3', depends: ['step2'] }
      ]
    }, LogLevel.ERROR);

    // step3 的根步骤应该是 step1
    const roots = workflow.getRootSteps('step3');
    expect(roots).toEqual(['step1']);

    // step2 的根步骤也应该是 step1
    const roots2 = workflow.getRootSteps('step2');
    expect(roots2).toEqual(['step1']);

    // step1 的根步骤是它自己
    const roots1 = workflow.getRootSteps('step1');
    expect(roots1).toEqual(['step1']);
  });

  test('should find multiple root steps for complex dependency graph', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'root1', action: 'action1' },
        { id: 'root2', action: 'action2' },
        { id: 'step3', action: 'action3', depends: ['root1'] },
        { id: 'step4', action: 'action4', depends: ['root2'] },
        { id: 'final', action: 'actionFinal', depends: ['step3', 'step4'] }
      ]
    }, LogLevel.ERROR);

    // final 的根步骤应该是 root1 和 root2
    const roots = workflow.getRootSteps('final');
    expect(roots).toEqual(['root1', 'root2']);
  });

  test('should handle reference dependencies in options', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'data', action: 'fetchData' },
        { 
          id: 'process', 
          action: 'processData',
          options: { input: '$ref.data.result' }
        }
      ]
    }, LogLevel.ERROR);

    const roots = workflow.getRootSteps('process');
    expect(roots).toEqual(['data']);
  });

  test('should handle each dependencies with string reference', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'getData', action: 'fetchData' },
        { 
          id: 'processEach', 
          action: 'processItem',
          each: '$ref.getData.items',
          options: { item: '$ref.$item' }
        }
      ]
    }, LogLevel.ERROR);

    const roots = workflow.getRootSteps('processEach');
    expect(roots).toEqual(['getData']);
  });

  test('should handle each dependencies with direct array', () => {
    const workflow = new Workflow({
      steps: [
        { 
          id: 'processItems', 
          action: 'processItem',
          each: ['item1', 'item2', 'item3']
        }
      ]
    }, LogLevel.ERROR);

    // 直接数组没有依赖，所以根步骤是自己
    const roots = workflow.getRootSteps('processItems');
    expect(roots).toEqual(['processItems']);
  });

  test('should handle conditional dependencies', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'check', action: 'checkCondition', type: 'if' },
        { id: 'trueAction', action: 'actionTrue', depends: ['check.true'] },
        { id: 'falseAction', action: 'actionFalse', depends: ['check.false'] },
        { id: 'merge', action: 'mergeResults', depends: ['trueAction', 'falseAction'] }
      ]
    }, LogLevel.ERROR);

    const roots = workflow.getRootSteps('merge');
    expect(roots).toEqual(['check']);
  });

  test('should handle mixed dependency types', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'root1', action: 'action1' },
        { id: 'root2', action: 'action2' },
        { 
          id: 'step3', 
          action: 'action3', 
          depends: ['root1'],
          options: { data: '$ref.root2.result' }
        },
        { 
          id: 'step4', 
          action: 'action4',
          each: '$ref.step3.items',
          options: { item: '$ref.$item' }
        }
      ]
    }, LogLevel.ERROR);

    // step4 依赖 step3，step3 依赖 root1 和 root2
    const roots = workflow.getRootSteps('step4');
    expect(roots).toEqual(['root1', 'root2']);
  });

  test('should throw error for non-existent step', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'step1', action: 'action1' }
      ]
    }, LogLevel.ERROR);

    expect(() => {
      workflow.getRootSteps('nonExistent');
    }).toThrow('Step nonExistent not found');
  });

  test('should handle complex branching with multiple roots', () => {
    const workflow = new Workflow({
      steps: [
        { id: 'rootA', action: 'actionA' },
        { id: 'rootB', action: 'actionB' },
        { id: 'rootC', action: 'actionC' },
        { id: 'stepD', action: 'actionD', depends: ['rootA', 'rootB'] },
        { id: 'stepE', action: 'actionE', depends: ['rootC'] },
        { 
          id: 'stepF', 
          action: 'actionF', 
          depends: ['stepD'],
          options: { data: '$ref.stepE.result' }
        }
      ]
    }, LogLevel.ERROR);

    // stepF 依赖 stepD（通过 depends）和 stepE（通过 options）
    // stepD 依赖 rootA 和 rootB
    // stepE 依赖 rootC
    // 所以 stepF 的根步骤是 rootA, rootB, rootC
    const roots = workflow.getRootSteps('stepF');
    expect(roots).toEqual(['rootA', 'rootB', 'rootC']);
  });
}); 
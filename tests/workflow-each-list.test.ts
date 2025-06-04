import { Workflow } from '../src/workflow';
import { LogLevel } from '../src/logger';

describe('Workflow Each with Direct Array', () => {
  test('should support direct array in each field', async () => {
    const results: any[] = [];
    
    const actions = {
      processItem: (item: any) => {
        results.push(item);
        return `processed-${item}`;
      }
    };

    const workflow = new Workflow({
      steps: [
        {
          id: 'processItems',
          action: 'processItem',
          each: ['apple', 'banana', 'orange']
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'processItems'
    });

    // 验证执行结果
    expect(results).toEqual(['apple', 'banana', 'orange']);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processItems.outputs).toEqual(['processed-apple', 'processed-banana', 'processed-orange']);
  });

  test('should pass item directly as parameter when no options provided', async () => {
    const receivedParams: any[] = [];
    
    const actions = {
      logItem: (item: any) => {
        receivedParams.push(item);
        return `logged-${item}`;
      }
    };

    const workflow = new Workflow({
      steps: [
        {
          id: 'logItems',
          action: 'logItem',
          each: [1, 2, 3]
          // 注意：没有 options 字段
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'logItems'
    });

    // 验证参数传递
    expect(receivedParams).toEqual([1, 2, 3]);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.logItems.outputs).toEqual(['logged-1', 'logged-2', 'logged-3']);
  });

  test('should work with complex objects in direct array', async () => {
    const processedItems: any[] = [];
    
    const actions = {
      processUser: (user: any) => {
        processedItems.push(user);
        return { ...user, processed: true };
      }
    };

    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ];

    const workflow = new Workflow({
      steps: [
        {
          id: 'processUsers',
          action: 'processUser',
          each: users
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'processUsers'
    });

    // 验证处理结果
    expect(processedItems).toEqual(users);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processUsers.outputs).toEqual([
      { id: 1, name: 'Alice', processed: true },
      { id: 2, name: 'Bob', processed: true },
      { id: 3, name: 'Charlie', processed: true }
    ]);
  });

  test('should still work with options when provided', async () => {
    const receivedOptions: any[] = [];
    
    const actions = {
      processWithOptions: (options: any) => {
        receivedOptions.push(options);
        return `processed-${options.value}-with-${options.suffix}`;
      }
    };

    const workflow = new Workflow({
      steps: [
        {
          id: 'processWithOptions',
          action: 'processWithOptions',
          each: ['item1', 'item2'],
          options: {
            value: '$ref.$item',
            suffix: 'test',
            index: '$ref.$index'
          }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'processWithOptions'
    });

    // 验证 options 处理
    expect(receivedOptions).toEqual([
      { value: 'item1', suffix: 'test', index: 0 },
      { value: 'item2', suffix: 'test', index: 1 }
    ]);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processWithOptions.outputs).toEqual([
      'processed-item1-with-test',
      'processed-item2-with-test'
    ]);
  });

  test('should handle empty direct array', async () => {
    const actions = {
      processEmpty: (item: any) => {
        return `processed-${item}`;
      }
    };

    const workflow = new Workflow({
      steps: [
        {
          id: 'processEmpty',
          action: 'processEmpty',
          each: []
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'processEmpty'
    });

    // 验证空数组处理
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processEmpty.outputs).toEqual([]);
  });

  test('should work in combination with other steps', async () => {
    const results: any[] = [];
    
    const actions = {
      generateData: () => {
        return { generated: true };
      },
      processItem: (item: any) => {
        results.push(item);
        return `processed-${item}`;
      },
      finalStep: (options: any) => {
        return `final-${options.processedData.length}`;
      }
    };

    const workflow = new Workflow({
      steps: [
        {
          id: 'generate',
          action: 'generateData'
        },
        {
          id: 'processItems',
          action: 'processItem',
          each: ['a', 'b', 'c'],
          depends: ['generate']
        },
        {
          id: 'final',
          action: 'finalStep',
          depends: ['processItems'],
          options: {
            processedData: '$ref.processItems'
          }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'generate'
    });

    // 验证完整流程
    expect(results).toEqual(['a', 'b', 'c']);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.final.outputs).toBe('final-3');
  });

  test('should work with mixed data types in direct array', async () => {
    const receivedItems: any[] = [];
    
    const actions = {
      processMixed: (item: any) => {
        receivedItems.push(item);
        return typeof item;
      }
    };

    const mixedArray = [
      'string',
      123,
      { key: 'value' },
      [1, 2, 3],
      true,
      null
    ];

    const workflow = new Workflow({
      steps: [
        {
          id: 'processMixed',
          action: 'processMixed',
          each: mixedArray
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions,
      entry: 'processMixed'
    });

    // 验证混合类型处理
    expect(receivedItems).toEqual(mixedArray);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processMixed.outputs).toEqual([
      'string',
      'number', 
      'object',
      'object',
      'boolean',
      'object'
    ]);
  });
}); 
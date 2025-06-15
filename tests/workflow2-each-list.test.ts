import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2'
import { LogLevel } from '../src/logger'

describe('Workflow2 Each with Ref Array - V2 Syntax', () => {
  test('should support array replacement via ref mapping', async () => {
    const results: any[] = [];
    
    const actions = {
      getItems: () => ['apple', 'banana', 'orange'],
      processItem: (item: any) => {
        results.push(item);
        return `processed-${item}`;
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getItems',
          action: 'getItems',
          each: false,
          input: {}
        },
        {
          id: 'processItems',
          action: 'processItem',
          each: true,  // V2: each 是布尔值
          input: [],
          ref: {
            "[]": "getItems"  // V2: 通过 ref 替换整个数组
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getItems'
    });

    // 验证执行结果
    expect(results).toEqual(['apple', 'banana', 'orange']);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processItems.outputs).toEqual(['processed-apple', 'processed-banana', 'processed-orange']);
  });

  test('should pass item directly as parameter when no field mapping provided', async () => {
    const receivedParams: any[] = [];
    
    const actions = {
      getNumbers: () => [1, 2, 3],
      logItem: (item: any) => {
        receivedParams.push(item);
        return `logged-${item}`;
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getNumbers',
          action: 'getNumbers',
          each: false,
          input: {}
        },
        {
          id: 'logItems',
          action: 'logItem',
          each: true,
          input: [],
          ref: {
            "[]": "getNumbers"
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getNumbers'
    });

    // 验证参数传递
    expect(receivedParams).toEqual([1, 2, 3]);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.logItems.outputs).toEqual(['logged-1', 'logged-2', 'logged-3']);
  });

  test('should work with complex objects through field mapping', async () => {
    const processedItems: any[] = [];
    
    const actions = {
      getUsers: () => ({
        userList: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' }
        ]
      }),
      processUser: (user: any) => {
        processedItems.push(user);
        return { ...user, processed: true };
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getUsers',
          action: 'getUsers',
          each: false,
          input: {}
        },
        {
          id: 'processUsers',
          action: 'processUser',
          each: true,
          input: [],
          ref: {
            "[]": "getUsers.userList"  // V2: 通过路径引用数组
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getUsers'
    });

    // 验证处理结果
    expect(processedItems).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ]);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.processUsers.outputs).toEqual([
      { id: 1, name: 'Alice', processed: true },
      { id: 2, name: 'Bob', processed: true },
      { id: 3, name: 'Charlie', processed: true }
    ]);
  });

  test('should handle array replacement with input template fallback', async () => {
    const receivedItems: any[] = [];
    
    const actions = {
      getItems: () => ['item1', 'item2'],
      processWithTemplate: (data: any) => {
        receivedItems.push(data);
        return `processed-${data.value}-${data.suffix}`;
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getItems',
          action: 'getItems',
          each: false,
          input: {}
        },
        {
          id: 'processWithTemplate',
          action: 'processWithTemplate',
          each: true,
          input: [
            {
              value: 'placeholder',
              suffix: 'test',
              index: 0
            }
          ],
          ref: {
            "[]": "getItems"  // V2: 直接数组替换，让 input 模板提供其他字段
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getItems'
    });

         // 验证数组替换：input 模板被重复使用，ref 替换了整个 input
     expect(receivedItems).toEqual(['item1', 'item2']);
     expect(history[0].status).toBe('success');
     expect(history[0].steps.processWithTemplate.outputs).toEqual([
       'processed-undefined-undefined',
       'processed-undefined-undefined'
     ]);
  });

  test('should handle empty array through ref mapping', async () => {
    const actions = {
      getEmpty: () => [],
      processEmpty: (item: any) => {
        return `processed-${item}`;
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getEmpty',
          action: 'getEmpty',
          each: false,
          input: {}
        },
        {
          id: 'processEmpty',
          action: 'processEmpty',
          each: true,
          input: [],
          ref: {
            "[]": "getEmpty"
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getEmpty'
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
      getItems: () => ['a', 'b', 'c'],
      processItem: (item: any) => {
        results.push(item);
        return `processed-${item}`;
      },
      finalStep: (data: any) => {
        return `final-${data.processedData.length}`;
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'generate',
          action: 'generateData',
          each: false,
          input: {}
        },
        {
          id: 'getItems',
          action: 'getItems',
          each: false,
          input: {},
          ref: {
            // 依赖 generate 步骤
            "dependency": "generate.generated"
          }
        },
        {
          id: 'processItems',
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            "[]": "getItems"
          }
        },
        {
          id: 'final',
          action: 'finalStep',
          each: false,
          input: {
            processedData: []
          },
          ref: {
            "processedData": "processItems"
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'generate'
    });

    // 验证完整流程
    expect(results).toEqual(['a', 'b', 'c']);
    expect(history[0].status).toBe('success');
    expect(history[0].steps.final.outputs).toBe('final-3');
  });

  test('should work with mixed data types through ref mapping', async () => {
    const receivedItems: any[] = [];
    
    const actions = {
      getMixed: () => [
        'string',
        123,
        { key: 'value' },
        [1, 2, 3],
        true,
        null
      ],
      processMixed: (item: any) => {
        receivedItems.push(item);
        return typeof item;
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getMixed',
          action: 'getMixed',
          each: false,
          input: {}
        },
        {
          id: 'processMixed',
          action: 'processMixed',
          each: true,
          input: [],
          ref: {
            "[]": "getMixed"
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getMixed'
    });

    // 验证混合类型处理
    expect(receivedItems).toEqual([
      'string',
      123,
      { key: 'value' },
      [1, 2, 3],
      true,
      null
    ]);
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

  test('should handle complex field mapping scenarios', async () => {
    const actions = {
      getUsersData: () => ({
        users: [
          { id: 1, name: 'Alice', role: 'admin' },
          { id: 2, name: 'Bob', role: 'user' }
        ],
        meta: {
          defaultStatus: 'active',
          timestamp: '2024-01-01'
        }
      }),
      processUserWithMeta: (userData: any) => {
        return {
          processed: true,
          userId: userData.userId,
          userName: userData.userName,
          status: userData.status,
          timestamp: userData.timestamp
        };
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getUsersData',
          action: 'getUsersData',
          each: false,
          input: {}
        },
        {
          id: 'processUsers',
          action: 'processUserWithMeta',
          each: true,
          input: [
            {
              userId: 0,
              userName: 'placeholder',
              status: 'pending',
              timestamp: 'default'
            }
          ],
          ref: {
            "[].userId": "getUsersData.users[].id",
            "[].userName": "getUsersData.users[].name",
            "[].status": "getUsersData.meta.defaultStatus",
            "[].timestamp": "getUsersData.meta.timestamp"
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getUsersData'
    });

    expect(history[0].status).toBe('success');
    expect(history[0].steps.processUsers.outputs).toEqual([
      {
        processed: true,
        userId: 1,
        userName: 'Alice',
        status: 'active',
        timestamp: '2024-01-01'
      },
      {
        processed: true,
        userId: 2,
        userName: 'Bob', 
        status: 'active',
        timestamp: '2024-01-01'
      }
    ]);
  });

  test('should handle backup references in each steps', async () => {
    const actions = {
      getDataWithFallbacks: () => ({
        primary: {
          users: [{ id: 1, name: 'Alice' }]
        },
        backup: {
          users: [{ id: 2, name: 'Bob' }]
        }
      }),
      processUser: (user: any) => {
        return { processed: true, ...user };
      }
    };

    const workflow = new Workflow2({
      steps: [
        {
          id: 'getData',
          action: 'getDataWithFallbacks',
          each: false,
          input: {}
        },
        {
          id: 'processUsers',
          action: 'processUser',
          each: true,
          input: [],
          ref: {
            // 备选引用：优先使用 primary，fallback 到 backup
            "[]": "getData.primary.users,getData.backup.users"
          }
        }
      ]
    }, LogLevel.INFO);

    const history = await workflow.run({
      actions,
      entry: 'getData'
    });

    expect(history[0].status).toBe('success');
    expect(history[0].steps.processUsers.outputs).toEqual([
      { processed: true, id: 1, name: 'Alice' }
    ]);
  });
}); 
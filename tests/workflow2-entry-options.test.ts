import { Workflow2, Step2, WorkflowOptions2 } from '../src/workflow2';
import { LogLevel } from '../src/logger';

describe('Workflow2 Entry Options - V2 Syntax', () => {
  it('should override entry step input with entryOptions', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'entryStep', 
          action: 'testAction',
          each: false,
          input: { 
            defaultParam: 'default',
            shouldBeOverridden: 'original'
          } 
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      testAction: mockAction.mockImplementation((input: any) => {
        return input;
      })
    };

    // Act
    const entryOptions = {
      shouldBeOverridden: 'new value',
      newParam: 'dynamic'
    };
    
    await workflow.run({
      actions,
      entry: 'entryStep',
      entryOptions
    });

    // Assert
    expect(mockAction).toHaveBeenCalledTimes(1);
    const calledWith = mockAction.mock.calls[0][0];
    
    // Original input should be preserved
    expect(calledWith.defaultParam).toBe('default');
    // entryOptions should override existing input
    expect(calledWith.shouldBeOverridden).toBe('new value');
    // New options from entryOptions should be added
    expect(calledWith.newParam).toBe('dynamic');
  });

  it('should work with empty entryOptions', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'entryStep', 
          action: 'testAction',
          each: false,
          input: { 
            param1: 'value1',
            param2: 'value2'
          } 
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      testAction: mockAction.mockImplementation((input: any) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'entryStep',
      entryOptions: {}
    });

    // Assert
    expect(mockAction).toHaveBeenCalledTimes(1);
    const calledWith = mockAction.mock.calls[0][0];
    expect(calledWith).toEqual({
      param1: 'value1',
      param2: 'value2'
    });
  });

  it('should work when entry step has empty input', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'entryStep', 
          action: 'testAction',
          each: false,
          input: {}
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      testAction: mockAction.mockImplementation((input: any) => input)
    };

    // Act
    const entryOptions = {
      dynamicParam: 'dynamic value'
    };
    
    await workflow.run({
      actions,
      entry: 'entryStep',
      entryOptions
    });

    // Assert
    expect(mockAction).toHaveBeenCalledTimes(1);
    const calledWith = mockAction.mock.calls[0][0];
    expect(calledWith).toEqual({
      dynamicParam: 'dynamic value'
    });
  });

  it('should not affect non-entry steps', async () => {
    // Arrange
    const mockAction1 = jest.fn();
    const mockAction2 = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'entryStep', 
          action: 'action1',
          each: false,
          input: { param: 'value1' }
        },
        { 
          id: 'nextStep', 
          action: 'action2',
          each: false,
          input: { param: 'value2' },
          ref: {
            dependency: 'entryStep'  // V2: 使用 ref 表示依赖
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      action1: mockAction1.mockImplementation((input: any) => input),
      action2: mockAction2.mockImplementation((input: any) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'entryStep',
      entryOptions: { param: 'overridden' }
    });

    // Assert
    // Entry step input should be overridden
    expect(mockAction1).toHaveBeenCalledWith({ param: 'overridden' });
    // Non-entry step should receive original input plus injected dependency
    expect(mockAction2).toHaveBeenCalledWith({ 
      param: 'value2',
      dependency: { param: 'overridden' }  // V2: ref 映射会注入依赖结果
    });
  });

  it('should work with field mapping and entryOptions', async () => {
    // Arrange
    const mockAction1 = jest.fn();
    const mockAction2 = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'entryStep', 
          action: 'action1',
          each: false,
          input: { 
            userId: 'default-user',
            config: 'default-config'
          }
        },
        { 
          id: 'processStep', 
          action: 'action2',
          each: false,
          input: { 
            userInfo: 'placeholder',
            version: '1.0'
          },
          ref: {
            'userInfo': 'entryStep.userId',  // V2: 字段映射
            'version': 'entryStep.config'
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      action1: mockAction1.mockImplementation((input: any) => input),
      action2: mockAction2.mockImplementation((input: any) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'entryStep',
      entryOptions: { 
        userId: 'dynamic-user',
        config: 'production-config'
      }
    });

    // Assert
    // Entry step should use entryOptions
    expect(mockAction1).toHaveBeenCalledWith({ 
      userId: 'dynamic-user',
      config: 'production-config'
    });
    
    // Dependent step should receive mapped values from entry step result
    expect(mockAction2).toHaveBeenCalledWith({ 
      userInfo: 'dynamic-user',
      version: 'production-config'
    });
  });

  it('should work with each steps and entryOptions', async () => {
    // Arrange
    const getData = jest.fn();
    const processItem = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getData', 
          action: 'getData',
          each: false,
          input: { 
            source: 'default',
            count: 3
          }
        },
        { 
          id: 'processItems', 
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            '[]': 'getData'  // V2: 数组替换
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      getData: getData.mockImplementation((input) => {
        // Return different data based on source
        if (input.source === 'dynamic') {
          return ['dynamic1', 'dynamic2'];
        }
        return ['default1', 'default2', 'default3'];
      }),
      processItem: processItem.mockImplementation((item) => `processed_${item}`)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'getData',
      entryOptions: { 
        source: 'dynamic',
        count: 2
      }
    });

    // Assert
    // Entry step should use entryOptions
    expect(getData).toHaveBeenCalledWith({ 
      source: 'dynamic',
      count: 2
    });
    
    // Each step should process the dynamic data
    expect(processItem).toHaveBeenCalledTimes(2);
    expect(processItem).toHaveBeenCalledWith('dynamic1');
    expect(processItem).toHaveBeenCalledWith('dynamic2');
  });

  it('should work with conditional steps and entryOptions', async () => {
    // Arrange
    const checkCondition = jest.fn();
    const trueBranch = jest.fn();
    const falseBranch = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'condition', 
          action: 'checkCondition',
          each: false,
          input: { 
            mode: 'default',
            threshold: 5
          },
          type: 'if'  // V2: 条件步骤
        },
        { 
          id: 'trueBranch', 
          action: 'trueBranch',
          each: false,
          input: {},
          ref: {
            dependency: 'condition.true'
          }
        },
        { 
          id: 'falseBranch', 
          action: 'falseBranch',
          each: false,
          input: {},
          ref: {
            dependency: 'condition.false'
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      checkCondition: checkCondition.mockImplementation((input) => {
        // Return different result based on mode
        return input.mode === 'test' && input.threshold > 10;
      }),
      trueBranch: trueBranch.mockResolvedValue('true_result'),
      falseBranch: falseBranch.mockResolvedValue('false_result')
    };

    // Act - Test with entryOptions that should trigger true branch
    await workflow.run({
      actions,
      entry: 'condition',
      entryOptions: { 
        mode: 'test',
        threshold: 15
      }
    });

    // Assert
    // Condition step should use entryOptions
    expect(checkCondition).toHaveBeenCalledWith({ 
      mode: 'test',
      threshold: 15
    });
    
    // True branch should have executed
    expect(trueBranch).toHaveBeenCalledTimes(1);
    expect(falseBranch).not.toHaveBeenCalled();
  });

  it('should preserve ref mappings with entryOptions override', async () => {
    // Arrange
    const sourceAction = jest.fn();
    const targetAction = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'source', 
          action: 'sourceAction',
          each: false,
          input: { 
            baseValue: 'original',
            multiplier: 1
          }
        },
        { 
          id: 'target', 
          action: 'targetAction',
          each: false,
          input: { 
            computedValue: 'default',
            factor: 0
          },
          ref: {
            'computedValue': 'source.baseValue',
            'factor': 'source.multiplier'  // V2: 多字段映射
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      sourceAction: sourceAction.mockImplementation((input) => ({
        baseValue: `processed_${input.baseValue}`,
        multiplier: input.multiplier * 10
      })),
      targetAction: targetAction.mockImplementation((input) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'source',
      entryOptions: { 
        baseValue: 'dynamic',
        multiplier: 5
      }
    });

    // Assert
    // Source step should use entryOptions
    expect(sourceAction).toHaveBeenCalledWith({ 
      baseValue: 'dynamic',
      multiplier: 5
    });
    
    // Target step should receive correctly mapped values
    expect(targetAction).toHaveBeenCalledWith({ 
      computedValue: 'processed_dynamic',
      factor: 50
    });
  });

  it('should handle entryOptions with null and undefined values', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'testStep', 
          action: 'testAction',
          each: false,
          input: { 
            param1: 'original',
            param2: 'keep',
            param3: 'override'
          } 
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      testAction: mockAction.mockImplementation((input: any) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'testStep',
      entryOptions: { 
        param1: null,
        param3: undefined,
        param4: 'new'
      }
    });

    // Assert
    expect(mockAction).toHaveBeenCalledWith({
      param1: null,
      param2: 'keep',
      param3: undefined,
      param4: 'new'
    });
  });

  it('should handle entryOptions with nested objects', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'testStep', 
          action: 'testAction',
          each: false,
          input: { 
            config: {
              database: { host: 'localhost', port: 5432 },
              cache: { ttl: 300 }
            },
            metadata: { version: '1.0' }
          } 
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      testAction: mockAction.mockImplementation((input: any) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'testStep',
      entryOptions: { 
        config: {
          database: { host: 'prod-db', port: 3306 },
          redis: { host: 'redis-server' }
        },
        newField: 'added'
      }
    });

    // Assert
    expect(mockAction).toHaveBeenCalledWith({
      config: {
        database: { host: 'prod-db', port: 3306 },
        redis: { host: 'redis-server' }
      },
      metadata: { version: '1.0' },
      newField: 'added'
    });
  });

  it('should work with multiple entry points and different entryOptions', async () => {
    // Arrange
    const action1 = jest.fn();
    const action2 = jest.fn();
    const action3 = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'step1', 
          action: 'action1',
          each: false,
          input: { mode: 'default', value: 1 }
        },
        { 
          id: 'step2', 
          action: 'action2',
          each: false,
          input: { mode: 'default', value: 2 }
        },
        { 
          id: 'step3', 
          action: 'action3',
          each: false,
          input: { result: 'placeholder' },
          ref: {
            'result': 'step1.output,step2.output'  // 备选引用
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      action1: action1.mockImplementation((input) => ({ output: `result_${input.mode}_${input.value}` })),
      action2: action2.mockImplementation((input) => ({ output: `result_${input.mode}_${input.value}` })),
      action3: action3.mockImplementation((input) => input)
    };

    // Act - 第一次运行，从 step1 开始
    await workflow.run({
      actions,
      entry: 'step1',
      entryOptions: { mode: 'test', value: 10 }
    });

    // Assert - 第一次运行
    expect(action1).toHaveBeenCalledWith({ mode: 'test', value: 10 });
    expect(action2).not.toHaveBeenCalled();
    expect(action3).toHaveBeenCalledWith({ result: 'result_test_10' });

    // Reset mocks
    action1.mockClear();
    action2.mockClear();
    action3.mockClear();

    // Act - 第二次运行，从 step2 开始
    await workflow.run({
      actions,
      entry: 'step2',
      entryOptions: { mode: 'prod', value: 20 }
    });

    // Assert - 第二次运行
    expect(action1).not.toHaveBeenCalled();
    expect(action2).toHaveBeenCalledWith({ mode: 'prod', value: 20 });
    expect(action3).toHaveBeenCalledWith({ result: 'result_prod_20' });
  });

  it('should handle entryOptions with array replacement in each steps', async () => {
    // Arrange
    const getItems = jest.fn();
    const processItem = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'getItems', 
          action: 'getItems',
          each: false,
          input: { 
            source: 'default',
            items: ['a', 'b', 'c']
          }
        },
        { 
          id: 'processEach', 
          action: 'processItem',
          each: true,
          input: [],
          ref: {
            '[]': 'getItems.items'  // V2: 数组替换
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      getItems: getItems.mockImplementation((input) => input),
      processItem: processItem.mockImplementation((item) => `processed_${item}`)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'getItems',
      entryOptions: { 
        source: 'dynamic',
        items: ['x', 'y']  // 覆盖原始数组
      }
    });

    // Assert
    expect(getItems).toHaveBeenCalledWith({ 
      source: 'dynamic',
      items: ['x', 'y']
    });
    
    expect(processItem).toHaveBeenCalledTimes(2);
    expect(processItem).toHaveBeenCalledWith('x');
    expect(processItem).toHaveBeenCalledWith('y');
  });

  it('should handle entryOptions with complex ref mappings', async () => {
    // Arrange
    const sourceAction = jest.fn();
    const targetAction = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'source', 
          action: 'sourceAction',
          each: false,
          input: { 
            user: { id: 1, name: 'default' },
            settings: { theme: 'light', lang: 'en' }
          }
        },
        { 
          id: 'target', 
          action: 'targetAction',
          each: false,
          input: { 
            userId: 0,
            userName: 'unknown',
            theme: 'default',
            language: 'unknown'
          },
          ref: {
            'userId': 'source.user.id',
            'userName': 'source.user.name',
            'theme': 'source.settings.theme',
            'language': 'source.settings.lang'
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      sourceAction: sourceAction.mockImplementation((input) => input),
      targetAction: targetAction.mockImplementation((input) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'source',
      entryOptions: { 
        user: { id: 999, name: 'admin' },
        settings: { theme: 'dark', lang: 'zh' }
      }
    });

    // Assert
    expect(sourceAction).toHaveBeenCalledWith({ 
      user: { id: 999, name: 'admin' },
      settings: { theme: 'dark', lang: 'zh' }
    });
    
    expect(targetAction).toHaveBeenCalledWith({ 
      userId: 999,
      userName: 'admin',
      theme: 'dark',
      language: 'zh'
    });
  });

  it('should not apply entryOptions to non-entry steps even with same action', async () => {
    // Arrange
    const sharedAction = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'entry', 
          action: 'sharedAction',
          each: false,
          input: { type: 'entry', value: 1 }
        },
        { 
          id: 'dependent', 
          action: 'sharedAction',  // 相同的 action
          each: false,
          input: { type: 'dependent', value: 2 },
          ref: {
            'trigger': 'entry'  // 依赖入口步骤
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      sharedAction: sharedAction.mockImplementation((input) => input)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'entry',
      entryOptions: { 
        type: 'overridden',
        value: 999
      }
    });

    // Assert
    expect(sharedAction).toHaveBeenCalledTimes(2);
    
    // 入口步骤应该使用 entryOptions
    expect(sharedAction).toHaveBeenNthCalledWith(1, { 
      type: 'overridden',
      value: 999
    });
    
    // 依赖步骤应该保持原始 input，加上注入的依赖
    expect(sharedAction).toHaveBeenNthCalledWith(2, { 
      type: 'dependent',
      value: 2,
      trigger: { type: 'overridden', value: 999 }
    });
  });

  it('should handle entryOptions with backup references', async () => {
    // Arrange
    const primaryAction = jest.fn();
    const backupAction = jest.fn();
    const consumerAction = jest.fn();
    
    const workflow = new Workflow2({
      steps: [
        { 
          id: 'primary', 
          action: 'primaryAction',
          each: false,
          input: { shouldFail: false, data: 'primary' }
        },
        { 
          id: 'backup', 
          action: 'backupAction',
          each: false,
          input: { data: 'backup' }
        },
        { 
          id: 'consumer', 
          action: 'consumerAction',
          each: false,
          input: { result: 'default' },
          ref: {
            'result': 'primary.data,backup.data'  // 备选引用
          }
        }
      ]
    }, LogLevel.ERROR);

    const actions = {
      primaryAction: primaryAction.mockImplementation((input) => {
        if (input.shouldFail) {
          throw new Error('Primary failed');
        }
        return { data: `processed_${input.data}` };
      }),
      backupAction: backupAction.mockImplementation((input) => ({ data: `processed_${input.data}` })),
      consumerAction: consumerAction.mockImplementation((input) => input)
    };

    // Act - 测试主要路径成功的情况
    await workflow.run({
      actions,
      entry: 'primary',
      entryOptions: { 
        shouldFail: false,
        data: 'dynamic_primary'
      }
    });

    // Assert
    expect(primaryAction).toHaveBeenCalledWith({ 
      shouldFail: false,
      data: 'dynamic_primary'
    });
    expect(backupAction).not.toHaveBeenCalled();
    expect(consumerAction).toHaveBeenCalledWith({ 
      result: 'processed_dynamic_primary'
    });
  });
}); 
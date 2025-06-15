import { Workflow } from '../src/workflow';

describe('Workflow with entryOptions', () => {
  it('should override entry step options with entryOptions', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow({
      steps: [
        { 
          id: 'entryStep', 
          action: 'testAction',
          options: { 
            defaultParam: 'default',
            shouldBeOverridden: 'original'
          } 
        }
      ]
    });

    const actions = {
      testAction: mockAction.mockImplementation((options: any) => {
        return options;
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
    
    // Original options should be preserved
    expect(calledWith.defaultParam).toBe('default');
    // entryOptions should override existing options
    expect(calledWith.shouldBeOverridden).toBe('new value');
    // New options from entryOptions should be added
    expect(calledWith.newParam).toBe('dynamic');
  });

  it('should work with empty entryOptions', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow({
      steps: [
        { 
          id: 'entryStep', 
          action: 'testAction',
          options: { 
            param1: 'value1',
            param2: 'value2'
          } 
        }
      ]
    });

    const actions = {
      testAction: mockAction.mockImplementation((options: any) => options)
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

  it('should work when entry step has no options', async () => {
    // Arrange
    const mockAction = jest.fn();
    const workflow = new Workflow({
      steps: [
        { 
          id: 'entryStep', 
          action: 'testAction'
        }
      ]
    });

    const actions = {
      testAction: mockAction.mockImplementation((options: any) => options)
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
    
    const workflow = new Workflow({
      steps: [
        { 
          id: 'entryStep', 
          action: 'action1',
          options: { param: 'value1' }
        },
        { 
          id: 'nextStep', 
          action: 'action2',
          options: { param: 'value2' , $depends: "$ref.entryStep"}
        }
      ]
    });

    const actions = {
      action1: mockAction1.mockImplementation((options: any) => options),
      action2: mockAction2.mockImplementation((options: any) => options)
    };

    // Act
    await workflow.run({
      actions,
      entry: 'entryStep',
      entryOptions: { param: 'overridden' }
    });

    // Assert
    // Entry step options should be overridden
    expect(mockAction1).toHaveBeenCalledWith({ param: 'overridden' });
    // Non-entry step should keep original options (including $depends)
    expect(mockAction2).toHaveBeenCalledWith({ param: 'value2', $depends: expect.anything() });
  });
});

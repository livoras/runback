import { Workflow } from '../src/work';
import { createDefaultLogger, LogLevel } from '../src/logger';

describe('Step Execution Records with Each', () => {
  // Mock Date.now() to return a fixed timestamp
  const originalDateNow = Date.now;
  const mockNow = new Date('2025-05-31T07:00:00.000Z').getTime();
  
  beforeAll(() => {
    // Mock Date.now() to return a fixed timestamp
    global.Date.now = jest.fn(() => mockNow);
  });

  afterAll(() => {
    // Restore original Date.now()
    global.Date.now = originalDateNow;
  });

  it('should track each step execution with multiple items', async () => {
    // Mock action that will be called for each item
    const mockAction = jest.fn()
      .mockResolvedValueOnce({ result: 'first item' })
      .mockResolvedValueOnce({ result: 'second item' });
    
    // Create a workflow with an 'each' step that processes an array of items
    const workflow = new Workflow({
      steps: [
        { 
          id: 'getItems',
          action: 'getItems',
        },
        { 
          id: 'processItems', 
          action: 'processItem',
          each: '$ref.getItems',  // Will iterate over the array returned by getItems
          options: { 
            item: '$ref.$item',    // Pass the current item from the array
            index: '$ref.$index',  // Pass the current index
            someValue: 'test'      // Some static value
          }
        }
      ]
    }, LogLevel.ERROR); // Set log level to ERROR to reduce test output

    // Mock data that will be returned by the getItems action
    const testItems = [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' }
    ];

    // Run the workflow
    const history = await workflow.run({
      actions: { 
        getItems: () => testItems,
        processItem: mockAction
      },
      entry: 'getItems'
    });

    // Get the step record for the processItems step
    const stepRecord = history[0]?.steps?.processItems;
    
    // Verify the step record exists
    expect(stepRecord).toBeDefined();
    expect(stepRecord?.status).toBe('success');
    
    // Verify the inputs array contains the correct items
    expect(Array.isArray(stepRecord?.inputs)).toBe(true);
    expect(stepRecord?.inputs).toHaveLength(2);
    
    // Verify the first input
    expect(stepRecord?.inputs[0]).toEqual({
      item: testItems[0],
      index: 0,
      someValue: 'test'
    });
    
    // Verify the second input
    expect(stepRecord?.inputs[1]).toEqual({
      item: testItems[1],
      index: 1,
      someValue: 'test'
    });
    
    // Verify the outputs array contains the results
    expect(Array.isArray(stepRecord?.outputs)).toBe(true);
    expect(stepRecord?.outputs).toHaveLength(2);
    expect(stepRecord?.outputs[0]).toEqual({ result: 'first item' });
    expect(stepRecord?.outputs[1]).toEqual({ result: 'second item' });
    
    // Verify the mock was called with the correct arguments
    expect(mockAction).toHaveBeenCalledTimes(2);
    expect(mockAction).toHaveBeenNthCalledWith(1, {
      item: testItems[0],
      index: 0,
      someValue: 'test'
    });
    expect(mockAction).toHaveBeenNthCalledWith(2, {
      item: testItems[1],
      index: 1,
      someValue: 'test'
    });
  });

  it('should handle empty arrays gracefully', async () => {
    const mockAction = jest.fn();
    
    const workflow = new Workflow({
      steps: [
        { 
          id: 'getEmptyList',
          action: 'getEmptyList',
        },
        { 
          id: 'processItems', 
          action: 'processItem',
          each: '$ref.getEmptyList',
          options: { item: '$ref.$item' }
        }
      ]
    }, LogLevel.ERROR);

    const history = await workflow.run({
      actions: { 
        getEmptyList: () => [],
        processItem: mockAction
      },
      entry: 'getEmptyList'
    });

    const stepRecord = history[0]?.steps?.processItems;
    
    expect(stepRecord).toBeDefined();
    expect(stepRecord?.status).toBe('success');
    expect(stepRecord?.inputs).toEqual([]);
    expect(stepRecord?.outputs).toEqual([]);
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('should handle errors in item processing', async () => {
    // Create a mock that will fail on the second item
    const mockAction = jest.fn()
      .mockImplementationOnce(async () => ({
        result: 'first item',
        status: 'success'
      }))
      .mockImplementationOnce(async () => {
        throw new Error('Item processing failed');
      });
    
    const workflow = new Workflow({
      steps: [
        { 
          id: 'getItems',
          action: 'getItems',
        },
        { 
          id: 'processItems', 
          action: 'processItem',
          each: '$ref.getItems',
          options: { item: '$ref.$item' }
        }
      ]
    }, LogLevel.ERROR);

    const testItems = [
      { id: 1, name: 'First' },
      { id: 2, name: 'Second' }
    ];

    // The workflow should complete even if a step fails
    const history = await workflow.run({
      actions: { 
        getItems: () => testItems,
        processItem: mockAction
      },
      entry: 'getItems'
    });
    
    // Get the step record for the processItems step
    const stepRecord = history[0]?.steps?.processItems;
    
    // Verify the step record exists and has the correct status
    expect(stepRecord).toBeDefined();
    expect(stepRecord?.status).toBe('failed');
    
    // Verify the error is recorded
    expect(stepRecord?.error).toBeDefined();
    expect(stepRecord?.error?.message).toBe('Item processing failed');
    
    // Verify the inputs and outputs are recorded correctly
    expect(stepRecord?.inputs).toEqual([
      { item: testItems[0] },
      { item: testItems[1] }
    ]);
    
    // Only the first item's output should be recorded
    expect(stepRecord?.outputs).toEqual([
      { result: 'first item', status: 'success' }
    ]);
    
    // Verify the mock was called with both items
    expect(mockAction).toHaveBeenCalledTimes(2);
    expect(mockAction).toHaveBeenNthCalledWith(1, { item: testItems[0] });
    expect(mockAction).toHaveBeenNthCalledWith(2, { item: testItems[1] });
  });
});

import { Workflow } from '../src/workflow';

describe('Workflow dependency validation', () => {
  // 测试有效的依赖关系
  it('should accept valid dependencies', () => {
    // 创建工作流不应抛出错误
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', options: { $depends: "$ref.step1" } },
          { id: 'step3', action: 'action3', options: { $depends: "$ref.step1,$ref.step2" } },
          { id: 'step4', action: 'action4', options: { param: '$ref.step1' } },
        ]
      });
    }).not.toThrow();
  });

  // 测试无效的直接依赖
  it('should throw error for invalid direct dependencies', () => {
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', options: { $depends: "$ref.nonExistentStep" } },
        ]
      });
    }).toThrow('Step step2 depends on non-existent step: nonExistentStep');
  });

  // 测试无效的选项依赖
  it('should throw error for invalid option dependencies', () => {
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', options: { param: '$ref.nonExistentStep' } },
        ]
      });
    }).toThrow('Step step2 depends on non-existent step: nonExistentStep');
  });

  // 测试无效的 each 依赖
  it('should throw error for invalid each dependencies', () => {
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', each: '$ref.nonExistentStep' },
        ]
      });
    }).toThrow('Step step2 depends on non-existent step: nonExistentStep');
  });

  // 测试特殊依赖 $item 和 $index
  it('should accept special dependencies $item and $index', () => {
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', each: '$ref.step1', options: { 
            item: '$ref.$item',
            index: '$ref.$index',
            nestedItem: '$ref.$item.property',
            complexPath: '$ref.$item.nested.path'
          } },
        ]
      });
    }).not.toThrow();
  });

  // 测试数组形式的依赖（或关系）
  it('should validate array form dependencies (OR relationship)', () => {
    // 有效的或关系依赖
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2' },
          { id: 'step3', action: 'action3', options: { 
            orDep: ['$ref.step1', '$ref.step2'] 
          } },
        ]
      });
    }).not.toThrow();

    // 无效的或关系依赖
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step3', action: 'action3', options: { 
            orDep: ['$ref.step1', '$ref.nonExistentStep'] 
          } },
        ]
      });
    }).toThrow('Step step3 depends on non-existent step: nonExistentStep');
  });

  // 测试嵌套路径依赖
  it('should validate nested path dependencies', () => {
    // 有效的嵌套路径
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', options: { 
            nestedPath: '$ref.step1.result.nested.property' 
          } },
        ]
      });
    }).not.toThrow();
  });

  // 测试依赖的根ID必须存在
  it('should only validate the root ID of the dependency path', () => {
    // 只要根ID存在，就算后续路径不存在也是有效的
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2', options: { 
            // step1存在，但step1.nonExistentProperty可能不存在
            // 这是有效的，因为只检查根ID
            deepPath: '$ref.step1.nonExistentProperty.deeperPath' 
          } },
        ]
      });
    }).not.toThrow();
  });

  // 测试多个无效依赖
  it('should throw error for the first invalid dependency encountered', () => {
    expect(() => {
      new Workflow({
        steps: [
          { id: 'step1', action: 'action1' },
          { id: 'step2', action: 'action2',
            options: { 
              $depends: "$ref.nonExistentStep1",
              param1: '$ref.nonExistentStep2',
              param2: '$ref.nonExistentStep3'
            } 
          },
        ]
      });
    }).toThrow('Step step2 depends on non-existent step: nonExistentStep1');
  });
});

import { Workflow, Step } from './work';

/**
 * 获取工作流的节点和边数据
 * @param workflow 工作流对象
 * @returns 包含节点和边的对象
 */
export function getNodesAndEdges(workflow: Workflow) {
  const nodes: any[] = [];
  const edges: any[] = [];
  const steps = workflow.options.steps;
  const deps = workflow.deps;

  // 创建节点数据
  steps.forEach(step => {
    // 为使用了 each 的步骤添加特殊标记
    const hasEach = step.each ? true : false;
    const label = hasEach ? 
      `${step.id}\n(${step.action})\n[⟳ each]` : 
      `${step.id}\n(${step.action})`;
    
    nodes.push({
      id: step.id,
      label: label,
      title: generateNodeTooltip(step),
      shape: getNodeShape(step),
      color: getNodeColor(step),
      font: hasEach ? { multi: true, bold: { each: true } } : undefined
    });
  });

  // 创建边数据
  Object.entries(deps).forEach(([stepId, dependencies]) => {
    dependencies.forEach(dep => {
      // 跳过特殊依赖 $item 和 $index
      if (dep.startsWith('$item') || dep.startsWith('$index')) {
        return;
      }

      // 找出依赖的源节点
      const sourceParts = dep.split('.');
      const sourceId = sourceParts[0];
      
      // 如果源节点存在于步骤中
      if (steps.some(s => s.id === sourceId)) {
        edges.push({
          from: sourceId,
          to: stepId,
          label: dep,
          arrows: 'to',
          font: { align: 'horizontal' }
        });
      }
    });

    // 处理显式依赖（depends 数组）
    const currentStep = steps.find(s => s.id === stepId);
    if (currentStep && currentStep.depends) {
      currentStep.depends.forEach(dep => {
        // 处理条件分支依赖，如 "checkUserName.true"
        const parts = dep.split('.');
        const sourceId = parts[0];
        
        edges.push({
          from: sourceId,
          to: stepId,
          label: dep,
          arrows: 'to',
          color: { color: '#FF9900' }, // 显式依赖使用不同颜色
          font: { align: 'horizontal' }
        });
      });
    }

    // 处理迭代依赖（each）
    if (currentStep && currentStep.each) {
      const eachValue = currentStep.each.replace('$ref.', '');
      const parts = eachValue.split('.');
      const sourceId = parts[0];
      
      if (steps.some(s => s.id === sourceId)) {
        edges.push({
          from: sourceId,
          to: stepId,
          label: `each: ${eachValue}`,
          arrows: 'to',
          color: { color: '#9900FF' }, // 迭代依赖使用不同颜色
          dashes: true,
          font: { align: 'horizontal' }
        });
      }
    }
  });

  return { nodes, edges };
}

/**
 * 将工作流转换为可视化数据结构
 * @param workflow 工作流对象
 * @returns 可视化数据对象，包含节点和边
 */
export function convertWorkflowToVisData(workflow: Workflow) {
  return getNodesAndEdges(workflow);
}

/**
 * 根据步骤类型获取节点形状
 * @param step 步骤对象
 * @returns 节点形状
 */
export function getNodeShape(step: Step): string {
  switch (step.type) {
    case 'trigger': return 'diamond';
    case 'if': return 'triangle';
    default: return 'box';
  }
}

/**
 * 根据步骤类型和属性获取节点颜色
 * @param step 步骤对象
 * @returns 节点颜色对象
 */
export function getNodeColor(step: Step): any {
  let color: any = {};
  
  // 根据类型设置基本颜色
  switch (step.type) {
    case 'trigger':
      color = { background: '#FFCC00', border: '#FF9900' };
      break;
    case 'if':
      color = { background: '#99CCFF', border: '#3399FF' };
      break;
    default:
      color = { background: '#99FF99', border: '#33CC33' };
      break;
  }
  
  // 如果是迭代步骤，修改边框样式
  if (step.each) {
    color.border = '#9900FF';
    color.borderWidth = 2;
    color.shapeProperties = { borderDashes: [5, 2] };
  }
  
  return color;
}

/**
 * 生成节点悬停提示内容
 * @param step 步骤对象
 * @returns HTML格式的提示内容
 */
export function generateNodeTooltip(step: Step): string {
  let tooltip = `<div style="padding: 10px;">
    <strong>ID:</strong> ${step.id}<br>
    <strong>Action:</strong> ${step.action}<br>`;
  
  if (step.type) {
    tooltip += `<strong>Type:</strong> ${step.type}<br>`;
  }
  
  if (step.name) {
    tooltip += `<strong>Name:</strong> ${step.name}<br>`;
  }
  
  if (step.depends && step.depends.length > 0) {
    tooltip += `<strong>Depends:</strong> ${step.depends.join(', ')}<br>`;
  }
  
  if (step.each) {
    tooltip += `<strong>Each:</strong> ${step.each}<br>`;
  }
  
  if (step.options) {
    tooltip += `<strong>Options:</strong> <pre>${JSON.stringify(step.options, null, 2)}</pre>`;
  }
  
  tooltip += '</div>';
  return tooltip;
} 
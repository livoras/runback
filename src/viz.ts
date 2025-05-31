import { Workflow, Step } from './work';
import * as fs from 'fs';
import * as path from 'path';
import open from 'open';

/**
 * 将工作流转换为可视化数据结构
 * @param workflow 工作流对象
 * @returns 可视化数据对象，包含节点和边
 */
function convertWorkflowToVisData(workflow: Workflow) {
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
 * 根据步骤类型获取节点形状
 * @param step 步骤对象
 * @returns 节点形状
 */
function getNodeShape(step: Step): string {
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
function getNodeColor(step: Step): any {
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
function generateNodeTooltip(step: Step): string {
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

/**
 * 生成可视化HTML内容
 * @param visData 可视化数据对象
 * @returns HTML字符串
 */
function generateHTML(visData: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Workflow Visualization</title>
  <meta charset="utf-8">
  <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
  <style type="text/css">
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    #visualization {
      width: 100%;
      height: 100%;
      border: 1px solid #ddd;
    }
    .controls {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 100;
      background: white;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .legend {
      position: absolute;
      bottom: 10px;
      left: 10px;
      z-index: 100;
      background: white;
      padding: 10px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 5px;
    }
    .legend-color {
      width: 20px;
      height: 10px;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <div class="controls">
    <button id="zoomIn">+</button>
    <button id="zoomOut">-</button>
    <button id="fit">Fit</button>
  </div>
  <div class="legend">
    <h3 style="margin-top: 0;">Legend</h3>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #99FF99; border: 1px solid #33CC33;"></div>
      <span>Regular Step</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #99CCFF; border: 1px solid #3399FF;"></div>
      <span>Conditional (if) Step</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #FFCC00; border: 1px solid #FF9900;"></div>
      <span>Trigger Step</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #99FF99; border: 2px dashed #9900FF;"></div>
      <span>Iteration (each) Step</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #FF9900;"></div>
      <span>Explicit Dependency</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background-color: #9900FF;"></div>
      <span>Each Dependency</span>
    </div>
  </div>
  <div id="visualization"></div>
  <script type="text/javascript">
    // 可视化数据
    const nodes = new vis.DataSet(${JSON.stringify(visData.nodes)});
    const edges = new vis.DataSet(${JSON.stringify(visData.edges)});

    // 创建网络
    const container = document.getElementById('visualization');
    const data = {
      nodes: nodes,
      edges: edges
    };
    const options = {
      layout: {
        hierarchical: {
          direction: 'LR',
          sortMethod: 'directed',
          levelSeparation: 150,
          nodeSpacing: 150
        }
      },
      physics: {
        hierarchicalRepulsion: {
          centralGravity: 0.0,
          springLength: 150,
          springConstant: 0.01,
          nodeDistance: 120,
          damping: 0.09
        },
        solver: 'hierarchicalRepulsion'
      },
      nodes: {
        font: {
          size: 14,
          face: 'arial',
          multi: 'html'
        },
        margin: 10,
        shape: 'box'
      },
      edges: {
        font: {
          size: 12,
          face: 'arial'
        },
        color: {
          color: '#2B7CE9',
          highlight: '#000000',
          hover: '#2B7CE9'
        },
        smooth: {
          type: 'curvedCW',
          roundness: 0.2
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 300,
        zoomView: true
      }
    };
    const network = new vis.Network(container, data, options);

    // 添加控件功能
    document.getElementById('zoomIn').addEventListener('click', function() {
      network.zoomIn(0.2);
    });
    document.getElementById('zoomOut').addEventListener('click', function() {
      network.zoomOut(0.2);
    });
    document.getElementById('fit').addEventListener('click', function() {
      network.fit();
    });
  </script>
</body>
</html>`;
}

/**
 * 将工作流可视化为HTML并保存到文件或打开浏览器
 * @param workflow 工作流对象
 * @param outputPath 输出文件路径，默认为当前目录下的workflow-viz.html
 * @returns 输出文件的完整路径
 */
export function visualize(workflow: Workflow, outputPath?: string): string {
  // 转换工作流数据为可视化格式
  const visData = convertWorkflowToVisData(workflow);
  
  // 生成HTML内容
  const html = generateHTML(visData);
  
  // 确定输出路径
  const finalPath = outputPath || path.join(process.cwd(), 'workflow-viz.html');
  
  // 写入文件
  fs.writeFileSync(finalPath, html, 'utf8');
  
  console.log(`工作流可视化已保存到: ${finalPath}`);
  return finalPath;
}

/**
 * 在浏览器中打开工作流可视化
 * @param workflow 工作流对象
 * @returns 临时文件路径
 */
export function visualizeInBrowser(workflow: Workflow): string {
  const visData = convertWorkflowToVisData(workflow);
  const html = generateHTML(visData);
  
  // 创建临时文件
  const tempDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'workflow-viz-'));
  const tempFile = path.join(tempDir, 'workflow-viz.html');
  
  fs.writeFileSync(tempFile, html, 'utf8');
  
  // 打开浏览器
  open(tempFile);
  
  console.log(`工作流可视化已在浏览器中打开`);
  return tempFile;
}

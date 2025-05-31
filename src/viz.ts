import { Workflow } from './work';
import * as fs from 'fs';
import * as path from 'path';
import open from 'open';
import { convertWorkflowToVisData } from './utils';

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

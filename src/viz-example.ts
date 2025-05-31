import { Workflow } from './workflow';
import { visualize, visualizeInBrowser } from './viz';
import { LogLevel } from './logger';

// 创建一个示例工作流
const workflow = new Workflow({
  steps: [
    { id: "getUserInfoId", action: "getUserInfo", options: { id: 123 } },
    { id: "checkUserName", action: "checkUserName", options: { name: "$ref.getUserInfoId.name" }, type: "if" },
    { id: "sayHiId", action: "sayHi", options: { input: { name: "$ref.getUserInfoId.name" } }, depends: ["checkUserName.true"] },
    { id: "logId", action: "log", options: { message: "$ref.sayHiId.result" } },
    { id: "logId2", action: "log", options: { message: "$ref.sayHiId.result" } },
    { id: "logId3", action: "log", options: { message: ["$ref.logId", "$ref.logId2"] } },
  ]
}, LogLevel.DEBUG);

// 创建一个带有迭代的工作流
const workflowWithEach = new Workflow({
  steps: [
    { id: "getUserListId", action: "getUserList" },
    { id: "logId", action: "log", options: { message: ["$ref.$item.name", "$ref.$index"] }, each: "$ref.getUserListId.list" },
    { id: "logItemId", action: "logItem", options: { message: "$ref.$item" }, each: "$ref.logId" },
  ]
}, LogLevel.DEBUG);

// 创建一个更复杂的工作流
const complexWorkflow = new Workflow({
  steps: [
    { id: "start", action: "start", type: "trigger" },
    { id: "getUserList", action: "getUserList", depends: ["start"] },
    { id: "processUser", action: "getUserInfo", options: { id: "$ref.$item.id" }, each: "$ref.getUserList.list" },
    { id: "checkEligibility", action: "checkUserName", options: { name: "$ref.processUser.name" }, type: "if" },
    { id: "notifyUser", action: "sayHi", options: { input: { name: "$ref.processUser.name" } }, depends: ["checkEligibility.true"] },
    { id: "logSuccess", action: "log", options: { message: "$ref.notifyUser.result" } },
    { id: "logFailure", action: "log", options: { message: "User not eligible" }, depends: ["checkEligibility.false"] },
    { id: "summarize", action: "log", options: { message: ["Total success:", "$ref.logSuccess.length", "Total failure:", "$ref.logFailure.length"] }, depends: ["logSuccess", "logFailure"] }
  ]
});

// 运行示例
if (require.main === module) {
  console.log('生成基本工作流可视化...');
  const path1 = visualize(workflow);
  
  console.log('生成带有迭代的工作流可视化...');
  const path2 = visualize(workflowWithEach, './workflow-with-each.html');
  
  console.log('生成复杂工作流可视化并在浏览器中打开...');
  visualizeInBrowser(complexWorkflow);
}

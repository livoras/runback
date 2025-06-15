# Ref 参数语法文档

## 概述

`ref` 参数用于追踪工具调用中输入数据的来源，建立步骤间的明确依赖关系。它支持精确指定某个输入参数来自哪个步骤的哪个结果字段，为数据血缘追踪、智能重试、缓存优化等高级功能提供基础。

**重要说明**：ref 是**可选的部分映射**，只有在 ref 中指定的字段才会被引用替换，其他字段保持原始值不变。

## 基础引用语法

### 引用表达式格式
```
{stepId}.{resultPath}
```

- `stepId`: 上游步骤的ID
- `resultPath`: 结果对象中的字段路径（支持嵌套）

### 示例
```javascript
step1.name                    // 引用步骤step1的name字段
step2.user.profile.email      // 引用步骤step2结果中的嵌套字段
step3.items[0].value          // 引用步骤step3结果数组的第一个元素
step4.data[2].user.id         // 引用深层嵌套数组中的字段
```

## 步骤的 ref 语法

### 基本结构
```javascript
{
  input: { /* 实际输入数据 */ },
  ref: {
    "inputField": "stepId.resultField"
  }
}
```

### 1. 简单字段引用
```javascript
{
  input: {
    userId: 12345,
    userName: "张三",
    apiKey: "abc123",        // 原始值，不映射
    timeout: 30000           // 原始值，不映射
  },
  ref: {
    "userId": "getUserStep.user.id",      // 只映射这两个字段
    "userName": "getUserStep.user.name"
    // apiKey 和 timeout 保持原始值
  }
}
```

**结果**：只有指定的字段被替换，其他字段保持不变：
```javascript
{
  input: {
    userId: 98765,           // 来自 getUserStep.user.id
    userName: "李四",         // 来自 getUserStep.user.name  
    apiKey: "abc123",        // 保持原始值
    timeout: 30000           // 保持原始值
  }
}
```

### 2. 嵌套对象引用
```javascript
{
  input: {
    user: {
      profile: {
        name: "张三",
        age: 30,
        email: "zhangsan@example.com"
      },
      settings: {
        theme: "dark",
        language: "zh"
      }
    }
  },
  ref: {
    "user.profile.name": "getUserData.result.userName",
    "user.profile.age": "getUserData.result.userAge",
    "user.profile.email": "getEmailStep.email",
    "user.settings.theme": "getPreferences.preferences.theme"
  }
}
```

### 3. 数组字段引用
```javascript
{
  input: {
    items: [
      { id: 1, name: "item1", status: "active" },
      { id: 2, name: "item2", status: "pending" }
    ],
    config: {
      options: ["a", "b", "c"]
    }
  },
  ref: {
    "items[0].name": "getFirstItem.firstItem.name",
    "items[1].status": "getSecondStatus.secondStatus",
    "items[*].status": "getDefaultStatus.defaultStatus",     // 通配符：所有项目统一设置
    "config.options[0]": "getFirstOption.firstOption",
    "config.options": "getAllOptions.allOptions"          // 整个数组引用
  }
}
```

### 4. 备选引用
```javascript
{
  input: {
    apiUrl: "https://api.example.com",
    fallbackUrl: "https://backup.example.com"
  },
  ref: {
    "apiUrl": "getPrimaryUrl.primaryUrl,getBackupUrl.backupUrl",  // 逗号分隔的备选引用
    "fallbackUrl": "getBackupUrl.backupUrl"
  }
}
```

## 数组步骤的 ref 语法

### 基本结构
```javascript
{
  inputs: [ /* 输入数组 */ ],
  ref: {
    "[]": "stepId.resultArray",           // 整体数组替换
    "[].field": "stepId.fieldArray[]",    // 字段数组映射（一对一）
    "[].field": "stepId.singleValue",     // 字段统一设置（所有元素相同值）
    "[*].field": "stepId.singleValue",    // 字段统一设置（等价写法）
    "[0].field": "stepId.specificValue"   // 特定索引设置
  }
}
```

### 数组操作语法规则

#### 目标端语法：
- `[].field` - 数组字段操作（支持一对一映射或统一设置）
- `[*].field` - 统一值设置（所有元素设置相同值）
- `[0].field` - 特定索引设置

#### 源端语法：
- **配合 `[].field` 使用时**：
  - `stepId.arrayField[]` - 分发数组元素（一对一映射）
  - `stepId.arrayField[].key` - 从数组元素中提取字段（一对一映射）
  - `stepId.singleValue` - 所有元素设置相同值
- **配合 `[*].field` 使用时**：
  - `stepId.singleValue` - 统一值设置

### 关键区别示例

假设上下文中有：
```javascript
context = {
  getUrls: {
    urls: ["http://url1.com", "http://url2.com", "http://url3.com"],
    defaultUrl: "http://default.com"
  }
}
```

**一对一映射**（源端有 `[]`）：
```javascript
ref: { "[].url": "getUrls.urls[]" }
// 结果：inputs[0].url = "http://url1.com", inputs[1].url = "http://url2.com", inputs[2].url = "http://url3.com"

// 或者从数组元素中提取字段
ref: { "[].url": "getUrls.urlObjects[].address" }
// 如果 urlObjects = [{address: "http://url1.com"}, {address: "http://url2.com"}]
// 结果：inputs[0].url = "http://url1.com", inputs[1].url = "http://url2.com"
```

**统一值设置**（源端无 `[]`）：
```javascript
ref: { "[].url": "getUrls.defaultUrl" }
// 或者
ref: { "[*].url": "getUrls.defaultUrl" }
// 结果：所有 inputs[i].url = "http://default.com"
```

### 1. 整体数组替换
```javascript
{
  inputs: [], // 原数组会被完全替换
  ref: {
    "[]": "getVideoList.result.videoList"  // 直接引用整个数组
  }
}
```

### 2. 数组字段映射（一对一）
```javascript
{
  inputs: [
    { url: "placeholder1", quality: "720p", format: "mp4", retryCount: 3 },
    { url: "placeholder2", quality: "1080p", format: "mp4", retryCount: 3 }
  ],
  ref: {
    "[].url": "getVideoUrls.result.videoUrls[]",      // 源端有[]：一对一映射
    "[].quality": "getQualities.result.qualities[]"   // 源端有[]：一对一映射
    // format 和 retryCount 保持原始值不变
  }
}
```

**结果**：数组元素一对一映射，url[0]→inputs[0].url，url[1]→inputs[1].url：
```javascript
{
  inputs: [
    { url: "https://video1.com", quality: "HD", format: "mp4", retryCount: 3 },
    { url: "https://video2.com", quality: "4K", format: "mp4", retryCount: 3 }
  ]
}
```

### 3. 统一值设置
```javascript
{
  inputs: [
    { url: "video1.com", format: "mp4" },
    { url: "video2.com", format: "mp4" }
  ],
  ref: {
    "[*].format": "getDefaultFormat.result.defaultFormat",  // 源端无[]：统一值设置
    "[].retryCount": "getMaxRetry.config.maxRetry"          // 等价写法：源端无[]
  }
}
```

**结果**：所有数组元素的指定字段都设置为相同值：
```javascript
{
  inputs: [
    { url: "video1.com", format: "newFormat", retryCount: 5 },
    { url: "video2.com", format: "newFormat", retryCount: 5 }
  ]
}
```

### 4. 特定索引设置
```javascript
{
  inputs: [
    { url: "video1.com", priority: "normal" },
    { url: "video2.com", priority: "high" },
    { url: "video3.com", priority: "normal" }
  ],
  ref: {
    "[0].priority": "getLowPriority.result.lowPriority",   // 第一个项目
    "[1].priority": "getHighPriority.result.highPriority",  // 第二个项目
    "[2].url": "getSpecialUrl.result.specialUrl"          // 第三个项目的特殊URL
  }
}
```

### 5. 多索引和范围设置
```javascript
{
  inputs: [/* 10个项目 */],
  ref: {
    "[0,2,4].category": "getOddCategory.result.oddCategory",     // 指定多个索引
    "[1,3,5].category": "getEvenCategory.result.evenCategory",
    "[6-9].status": "getLastGroupStatus.result.lastGroupStatus",     // 索引范围
    "[0-2].priority": "getTopPriority.result.topPriority"
  }
}
```

### 6. 嵌套对象数组（key 和 value 双向嵌套）
```javascript
{
  inputs: [
    {
      video: { url: "video1.com", meta: { title: "视频1" } },
      options: { quality: "720p", format: "mp4" }
    },
    {
      video: { url: "video2.com", meta: { title: "视频2" } },
      options: { quality: "1080p", format: "mp4" }
    }
  ],
  ref: {
    // key 和 value 都支持深层嵌套路径
    "[].video.url": "getVideoData.result.videoUrls[]",
    "[].video.meta.title": "getVideoData.result.videoTitles[]",
    "[].user.profile.name": "getUserData.data.users[].personalInfo.fullName",
    "[*].options.format": "getConfig.config.output.defaultFormat",  // 统一格式
    "[0].options.quality": "getVideoSettings.settings.video.hdQuality"     // 深层嵌套引用
  }
}
```

**语法说明**：
- **Key 侧**：支持任意深度的嵌套路径，如 `[].user.profile.address.city`
- **Value 侧**：同样支持任意深度的嵌套引用，如 `stepId.data.result.nested.field[]`
- **双向嵌套**：key 和 value 的嵌套深度可以完全不同

## 语法参考表

### 步骤路径语法
| 语法 | 说明 | 示例 |
|------|------|------|
| `field` | 简单字段 | `"userId": "getUserStep.id"` |
| `obj.field` | 嵌套对象 | `"user.name": "getUserStep.userName"` |
| `obj.arr[0]` | 数组索引 | `"items[0].name": "getItemsStep.firstName"` |
| `obj.arr[*]` | 数组通配符 | `"items[*].status": "getStatusStep.defaultStatus"` |
| `arr` | 整个数组 | `"items": "getItemsStep.itemArray"` |

### 数组步骤语法
| 目标语法 | 源端语法 | 说明 | 示例 |
|----------|----------|------|------|
| `[]` | `stepId.array` | 整体数组替换 | `"[]": "getVideoListStep.videoList"` |
| `[]` | `stepId.array[]` | 整体数组替换（等价写法） | `"[]": "getVideoListStep.videoList[]"` |
| `[].field` | `stepId.array[]` | 数组字段映射（一对一） | `"[].url": "getUrlsStep.urls[]"` |
| `[].field` | `stepId.array[].key` | 数组元素字段提取（一对一） | `"[].url": "getUrlsStep.objects[].url"` |
| `[].field` | `stepId.value` | 数组字段统一设置 | `"[].url": "getUrlsStep.defaultUrl"` |
| `[*].field` | `stepId.value` | 统一值设置（等价写法） | `"[*].format": "getFormatStep.format"` |
| `[0].field` | `stepId.value` | 特定索引 | `"[0].priority": "getPriorityStep.high"` |
| `[0,2,4].field` | `stepId.value` | 多个索引 | `"[0,2,4].type": "getTypeStep.typeA"` |
| `[1-3].field` | `stepId.value` | 索引范围 | `"[1-3].group": "getGroupStep.groupB"` |

## 引用解析优先级

当同一个字段有多个引用时，按以下优先级处理：

1. **特定索引** > 范围索引 > 通配符
2. **深层路径** > 浅层路径
3. **后定义** > 先定义

### 示例
```javascript
ref: {
  "[*].status": "getDefaultStatus.defaultStatus",     // 优先级：3
  "[0-2].status": "getGroupStatus.groupStatus",     // 优先级：2  
  "[1].status": "getSpecificStatus.specificStatus"     // 优先级：1（最高）
}
// 结果：索引1使用specificStatus，索引0和2使用groupStatus，其他使用defaultStatus
```

## 高级特性

### 1. 条件引用（备选方案）

使用逗号分隔多个引用源，系统会按顺序尝试，使用第一个可用的值：

```javascript
ref: {
  "fieldName": "stepId1.path1,stepId2.path2,stepId3.path3",
  "apiUrl": "getPrimaryUrl.primaryUrl,getBackupUrl.backupUrl",
  "result": "checkCondition.true,checkCondition.false"
}
```

数组中也支持条件引用：

```javascript
ref: {
  "[].url": "getPrimaryUrls.primaryUrls[],getBackupUrls.backupUrls[]",
  "[*].format": "getPreferredFormat.preferredFormat,getDefaultFormat.defaultFormat"
}
```

### 2. 数组长度动态调整
```javascript
ref: {
  "[]": "getItems.result.items",  // 根据引用数组的长度动态调整inputs数组
  "[*].commonField": "getCommonValue.commonValue"
}
```

## 最佳实践

- 使用有意义的字段路径
- 只映射需要从其他步骤获取的字段，静态配置保持原值
- 为关键字段提供备选引用
- 避免过深的嵌套路径和循环引用

## 常见错误

### 1. 路径错误
```javascript
// ❌ 错误：路径不存在
"user.name": "getUserStep.result.userName"  // 如果result中没有userName字段

// ✅ 正确：确保路径存在
"user.name": "getUserStep.user.name"
```

### 2. 数组索引越界
```javascript
// ❌ 错误：索引超出范围
"[5].url": "getUrlsStep.urls[0]"  // 如果inputs只有3个元素

// ✅ 正确：检查数组长度
"[2].url": "getUrlsStep.urls[2]"
```

### 3. 类型不匹配
```javascript
// ❌ 错误：类型不匹配
"userId": "getUserStep.user.name"  // name是字符串，userId需要数字

// ✅ 正确：确保类型匹配
"userId": "getUserStep.user.id"
```


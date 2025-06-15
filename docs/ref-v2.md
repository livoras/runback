# Ref 参数语法文档

## 概述

`ref` 参数用于追踪工具调用中输入数据的来源，建立任务间的明确依赖关系。它支持精确指定某个输入参数来自哪个任务的哪个结果字段，为数据血缘追踪、智能重试、缓存优化等高级功能提供基础。

**重要说明**：ref 是**可选的部分映射**，只有在 ref 中指定的字段才会被引用替换，其他字段保持原始值不变。

## 基础引用语法

### 引用表达式格式
```
{taskId}.{resultPath}
```

- `taskId`: 上游任务的ID
- `resultPath`: 结果对象中的字段路径（支持嵌套）

### 示例
```javascript
3031.name                    // 引用任务3031的name字段
2048.user.profile.email      // 引用任务2048结果中的嵌套字段
1024.items[0].value          // 引用任务1024结果数组的第一个元素
5678.data[2].user.id         // 引用深层嵌套数组中的字段
```

## createTask 的 ref 语法

### 基本结构
```javascript
{
  input: { /* 实际输入数据 */ },
  title: "任务标题",
  ref: {
    "inputField": "taskId.resultField"
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
    "userId": "3031.user.id",      // 只映射这两个字段
    "userName": "3031.user.name"
    // apiKey 和 timeout 保持原始值
  }
}
```

**结果**：只有指定的字段被替换，其他字段保持不变：
```javascript
{
  input: {
    userId: 98765,           // 来自 3031.user.id
    userName: "李四",         // 来自 3031.user.name  
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
    "user.profile.name": "3031.result.userName",
    "user.profile.age": "3031.result.userAge",
    "user.profile.email": "2048.email",
    "user.settings.theme": "4096.preferences.theme"
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
    "items[0].name": "3031.firstItem.name",
    "items[1].status": "4096.secondStatus",
    "items[*].status": "2048.defaultStatus",     // 通配符：所有项目统一设置
    "config.options[0]": "5678.firstOption",
    "config.options": "1024.allOptions"          // 整个数组引用
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
    "apiUrl": "3031.primaryUrl,2048.backupUrl",  // 逗号分隔的备选引用
    "fallbackUrl": "2048.backupUrl"
  }
}
```

## createBatch 的 ref 语法

### 基本结构
```javascript
{
  inputs: [ /* 输入数组 */ ],
  title: "批量任务标题",
  ref: {
    "[]": "taskId.resultArray",           // 整体数组替换
    "[].field": "taskId.fieldArray[]",    // 字段数组映射
    "[*].field": "taskId.singleValue",    // 统一值设置
    "[0].field": "taskId.specificValue"   // 特定索引设置
  }
}
```

### 1. 整体数组替换
```javascript
{
  inputs: [], // 原数组会被完全替换
  ref: {
    "[]": "3031.result.videoList"  // 直接引用整个数组
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
    "[].url": "3031.result.videoUrls[]",      // 只映射 url 字段
    "[].quality": "2048.result.qualities[]"   // 只映射 quality 字段
    // format 和 retryCount 保持原始值不变
  }
}
```

**结果**：映射后 url 和 quality 被替换，format 和 retryCount 保持原始值：
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
    "[*].format": "4096.result.defaultFormat",  // 所有项目使用相同值
    "[*].retryCount": "5678.config.maxRetry"
  }
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
    "[0].priority": "3031.result.lowPriority",   // 第一个项目
    "[1].priority": "4096.result.highPriority",  // 第二个项目
    "[2].url": "7890.result.specialUrl"          // 第三个项目的特殊URL
  }
}
```

### 5. 多索引和范围设置
```javascript
{
  inputs: [/* 10个项目 */],
  ref: {
    "[0,2,4].category": "3031.result.oddCategory",     // 指定多个索引
    "[1,3,5].category": "4096.result.evenCategory",
    "[6-9].status": "7890.result.lastGroupStatus",     // 索引范围
    "[0-2].priority": "2048.result.topPriority"
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
    "[].video.url": "3031.result.videoUrls[]",
    "[].video.meta.title": "3031.result.videoTitles[]",
    "[].user.profile.name": "2048.data.users[].personalInfo.fullName",
    "[*].options.format": "2048.config.output.defaultFormat",  // 统一格式
    "[0].options.quality": "4096.settings.video.hdQuality"     // 深层嵌套引用
  }
}
```

**语法说明**：
- **Key 侧**：支持任意深度的嵌套路径，如 `[].user.profile.address.city`
- **Value 侧**：同样支持任意深度的嵌套引用，如 `taskId.data.result.nested.field[]`
- **双向嵌套**：key 和 value 的嵌套深度可以完全不同

## 语法参考表

### createTask 路径语法
| 语法 | 说明 | 示例 |
|------|------|------|
| `field` | 简单字段 | `"userId": "3031.id"` |
| `obj.field` | 嵌套对象 | `"user.name": "3031.userName"` |
| `obj.arr[0]` | 数组索引 | `"items[0].name": "3031.firstName"` |
| `obj.arr[*]` | 数组通配符 | `"items[*].status": "3031.defaultStatus"` |
| `arr` | 整个数组 | `"items": "3031.itemArray"` |

### createBatch 数组语法
| 语法 | 说明 | 示例 |
|------|------|------|
| `[]` | 整体数组替换 | `"[]": "3031.videoList"` |
| `[].field` | 数组字段映射 | `"[].url": "3031.urls[]"` |
| `[].nested.field` | 嵌套字段映射 | `"[].user.name": "3031.data[].profile.name"` |
| `[*].field` | 统一值设置 | `"[*].format": "3031.format"` |
| `[*].nested.field` | 嵌套统一设置 | `"[*].config.timeout": "3031.settings.default.timeout"` |
| `[0].field` | 特定索引 | `"[0].priority": "3031.high"` |
| `[0,2,4].field` | 多个索引 | `"[0,2,4].type": "3031.typeA"` |
| `[1-3].field` | 索引范围 | `"[1-3].group": "3031.groupB"` |

## 引用解析优先级

当同一个字段有多个引用时，按以下优先级处理：

1. **特定索引** > 范围索引 > 通配符
2. **深层路径** > 浅层路径
3. **后定义** > 先定义

### 示例
```javascript
ref: {
  "[*].status": "3031.defaultStatus",     // 优先级：3
  "[0-2].status": "4096.groupStatus",     // 优先级：2  
  "[1].status": "7890.specificStatus"     // 优先级：1（最高）
}
// 结果：索引1使用specificStatus，索引0和2使用groupStatus，其他使用defaultStatus
```

## 高级特性

### 1. 条件引用（备选方案）

条件引用允许为单个字段指定多个备选的引用源，系统会按顺序尝试，使用第一个可用的值。这为系统提供了强大的容错能力和灵活性。

#### 基本语法
```javascript
ref: {
  "fieldName": "taskId1.path1,taskId2.path2,taskId3.path3"
}
```

#### 使用场景

**1. 容错处理**
```javascript
ref: {
  "apiUrl": "3031.primaryUrl,2048.backupUrl,4096.defaultUrl",
  "userId": "1024.user.id,2048.fallbackUserId"
}
// 如果任务3031失败，自动使用任务2048的备份URL
// 如果任务1024失败，使用任务2048的备份用户ID
```

**2. 数据源优先级**
```javascript
ref: {
  "userInfo": "5678.premiumUserData,3031.basicUserData,9999.guestUserData",
  "quality": "1024.hdSettings,2048.standardSettings,4096.defaultSettings"
}
// 优先使用高级用户数据，不可用时降级到基础数据
// 优先使用高清设置，不可用时使用标准设置
```

**3. 版本兼容性**
```javascript
ref: {
  "configData": "7890.v2Config,5678.v1Config,3031.legacyConfig"
}
// 优先使用最新版本配置，向下兼容旧版本
```

**4. 环境切换**
```javascript
ref: {
  "endpoint": "prod.2048.apiEndpoint,staging.1024.apiEndpoint,dev.3031.apiEndpoint",
  "credentials": "prod.5678.authToken,test.9999.testToken"
}
// 根据环境可用性自动选择合适的端点
```

**5. 分支汇聚（if-else 逻辑）**
```javascript
ref: {
  "result": "checkCondition.true,checkCondition.false",
  "userAction": "permissionCheck.admin,permissionCheck.user,permissionCheck.guest"
}
// 条件分支的优雅汇聚，无需复杂的 depends 配置
// 如果条件为真，使用 true 分支结果；否则使用 false 分支结果
```

**完整的分支汇聚示例**
```javascript
// 工作流步骤：
// 1. checkAge (if节点) → 检查年龄
//    ├─ true分支: processAdult
//    └─ false分支: processMinor  
// 2. finalStep → 汇聚结果

{
  inputs: [...],
  ref: {
    // 汇聚不同分支的处理结果
    "processedData": "processAdult.result,processMinor.result",
    
    // 汇聚不同的配置选择
    "ageConfig": "checkAge.adultConfig,checkAge.minorConfig",
    
    // 多重条件汇聚
    "permission": "roleCheck.admin,roleCheck.moderator,roleCheck.user,roleCheck.guest"
  }
}
```

#### 数组中的条件引用

**数组字段映射**
```javascript
ref: {
  "[].url": "3031.primaryUrls[],2048.backupUrls[],4096.defaultUrls[]",
  "[].title": "1024.titles[],5678.fallbackTitles[]"
}
// 数组映射也支持备选方案
```

**混合使用**
```javascript
ref: {
  "[].videoUrl": "3031.hdUrls[],2048.sdUrls[]",           // 视频URL备选
  "[*].format": "1024.preferredFormat,5678.defaultFormat", // 统一格式备选
  "[0].priority": "9999.highPriority,8888.normalPriority"  // 特定索引备选
}
```

#### 复杂嵌套的条件引用

**深层路径备选**
```javascript
ref: {
  "user.profile.avatar": "3031.user.profile.highResAvatar,2048.user.profile.avatar,4096.user.defaultAvatar",
  "config.settings.theme": "1024.personalSettings.theme,5678.defaultSettings.theme,9999.systemTheme"
}
```

**数组嵌套备选**
```javascript
ref: {
  "[].video.thumbnails": "3031.hdThumbnails[],2048.sdThumbnails[],4096.placeholderImages[]",
  "[].user.info": "1024.fullUserInfo[],5678.basicUserInfo[],9999.anonymousInfo[]"
}
```

#### 解析规则

1. **按顺序尝试**：从左到右逐个尝试引用
2. **第一个可用值**：使用第一个成功解析的值
3. **跳过失败项**：如果某个引用失败，自动尝试下一个
4. **全部失败处理**：如果所有引用都失败，根据配置决定是否抛出错误或使用默认值

#### 失败条件

以下情况会导致引用失败，触发备选机制：
- **任务不存在**：引用的任务ID不存在
- **任务未完成**：任务仍在执行中，结果不可用
- **任务失败**：任务执行失败，无结果
- **路径不存在**：任务结果中不存在指定路径
- **值为空**：引用路径存在但值为 null 或 undefined
- **类型不匹配**：引用值类型与期望类型不符

#### 高级用法

**条件 + 默认值**
```javascript
ref: {
  "retryCount": "3031.config.maxRetry,2048.config.defaultRetry,5", // 最后一个是字面量默认值
  "timeout": "1024.settings.timeout,30000"                          // 数字默认值
}
```

**跨类型备选**
```javascript
ref: {
  "dataSource": "3031.jsonData,2048.xmlData,4096.csvData", // 不同格式的数据源
  "imageUrl": "1024.webpImage,5678.jpgImage,9999.pngImage" // 不同格式的图片
}
```

**动态路径备选**
```javascript
ref: {
  "userData": "3031.users[0].data,2048.users[1].data,4096.defaultUser.data"
}
```

#### 性能考虑

1. **缓存机制**：已成功的引用会被缓存，避免重复解析
2. **并行检查**：可以并行检查多个引用的可用性
3. **短路机制**：一旦找到可用值，立即停止检查后续备选项
4. **预检查**：在执行前可以预检查引用的可用性

#### 调试和监控

**日志记录**
```javascript
// 系统会记录备选引用的使用情况
// 例如：
// [INFO] Field 'apiUrl' using fallback: 2048.backupUrl (primary 3031.primaryUrl failed)
// [WARN] All references failed for 'userId', using default value
```

**监控指标**
- 备选引用触发频率
- 不同引用源的成功率
- 全部失败的字段统计

#### 最佳实践

1. **合理排序**：将最可靠的引用放在前面
2. **适度备选**：避免过多备选项，通常2-3个即可
3. **类型一致**：确保所有备选项返回相同类型的数据
4. **监控告警**：当备选机制频繁触发时应该有告警
5. **文档记录**：清楚记录每个备选项的用途和预期场景
6. **分支汇聚优化**：使用条件引用替代复杂的 depends 配置，让分支汇聚更加直观

#### 与其他特性的结合

**与通配符结合**
```javascript
ref: {
  "[*].status": "3031.activeStatus,2048.defaultStatus,pending" // 字面量默认值
}
```

**与数组映射结合**
```javascript
ref: {
  "[].title": "3031.titles[],2048.fallbackTitles[],4096.placeholderTitles[]"
}
```

**与嵌套路径结合**
```javascript
ref: {
  "config.database.host": "prod.3031.db.primary,prod.2048.db.secondary,dev.4096.db.local"
}
```

**复杂分支汇聚场景**
```javascript
// 多层条件分支的汇聚
ref: {
  // 用户类型 → 权限检查 → 具体操作
  "finalResult": "vipUser.premiumAction,regularUser.standardAction,guestUser.limitedAction",
  
  // 设备类型 → 格式选择 → 处理结果  
  "output": "mobileDevice.mobileFormat,desktopDevice.desktopFormat,tabletDevice.tabletFormat",
  
  // 地区 → 语言 → 本地化内容
  "content": "cnRegion.zhContent,usRegion.enContent,euRegion.enContent,defaultRegion.enContent"
}
```

#### 分支汇聚 vs depends 字段

**传统方式（复杂）**
```javascript
// 使用 depends 字段的传统分支汇聚
{
  "id": "merge_results",
  "action": "mergeResults",
  "depends": ["condition.true", "condition.false"],  // 复杂的依赖声明
  "options": {
    "result": "..." // 需要额外的合并逻辑
  }
}
```

**条件引用方式（简洁）**
```javascript
// 使用条件引用的优雅分支汇聚
ref: {
  "result": "processA.output,processB.output"  // 自动选择可用的分支结果
}
```

**优势对比**：
- ✅ **更简洁**：无需显式的 depends 配置
- ✅ **更直观**：语义明确，一目了然
- ✅ **更灵活**：支持多分支汇聚（不仅仅是二分支）
- ✅ **更健壮**：自动处理分支失败的情况

### 2. 数组长度动态调整
```javascript
ref: {
  "[]": "3031.result.items",  // 根据引用数组的长度动态调整inputs数组
  "[*].commonField": "2048.commonValue"
}
```

## 最佳实践

### 1. 命名规范
- 使用有意义的字段路径
- 保持引用路径的可读性
- 避免过深的嵌套路径

### 2. 性能考虑
- 优先使用数组映射而非逐个索引引用
- 合理使用通配符减少重复配置
- 避免循环引用

### 3. 字段映射策略
- **按需映射**：只映射需要从其他任务获取的字段
- **保留原值**：静态配置、常量等字段无需映射
- **混合使用**：同一个对象中可以同时有映射字段和原始字段
- **清晰分离**：用注释区分哪些字段被映射，哪些保持原值

### 4. 错误处理
- 为关键字段提供备选引用
- 验证引用的任务ID是否存在
- 确保引用路径的正确性

### 5. 可维护性
- 保持ref配置的简洁性
- 使用注释说明复杂的引用逻辑
- 定期检查和清理无用的引用

## 常见错误

### 1. 路径错误
```javascript
// ❌ 错误：路径不存在
"user.name": "3031.result.userName"  // 如果result中没有userName字段

// ✅ 正确：确保路径存在
"user.name": "3031.user.name"
```

### 2. 数组索引越界
```javascript
// ❌ 错误：索引超出范围
"[5].url": "3031.urls[0]"  // 如果inputs只有3个元素

// ✅ 正确：检查数组长度
"[2].url": "3031.urls[2]"
```

### 3. 类型不匹配
```javascript
// ❌ 错误：类型不匹配
"userId": "3031.user.name"  // name是字符串，userId需要数字

// ✅ 正确：确保类型匹配
"userId": "3031.user.id"
```

## 调试技巧

1. **检查引用有效性**：确保被引用的任务已完成且结果可用
2. **验证路径正确性**：使用工具验证引用路径是否存在
3. **类型匹配检查**：确保引用值的类型与目标字段类型一致
4. **循环依赖检测**：避免任务间的循环引用
5. **日志跟踪**：记录引用解析过程便于调试 
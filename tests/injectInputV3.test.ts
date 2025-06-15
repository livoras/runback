import { injectInput } from '../src/injectInput';

describe('injectInput V2规范完整测试', () => {
  // ================== 第一部分：核心映射语义测试 ==================
  
  describe('核心映射语义', () => {
    it('应该只映射ref中指定的字段，其他字段完全保持不变', () => {
      const originalData = {
        system: { version: "1.0.0", env: "production" },
        database: { host: "localhost", port: 3306, ssl: true },
        cache: { redis: { host: "127.0.0.1", port: 6379 } },
        features: { analytics: true, monitoring: false }
      };
      
      const context = {
        configTask: { 
          newHost: "remote-db.com",
          newAnalytics: false 
        }
      };
      
      const ref = {
        "database.host": "configTask.newHost",
        "features.analytics": "configTask.newAnalytics"
      };

      const result = injectInput(originalData, ref, context);

      // 验证映射的字段被替换
      expect(result.database.host).toBe("remote-db.com");
      expect(result.features.analytics).toBe(false);
      
      // 验证其他字段完全不变
      expect(result.system).toEqual({ version: "1.0.0", env: "production" });
      expect(result.database.port).toBe(3306);
      expect(result.database.ssl).toBe(true);
      expect(result.cache.redis).toEqual({ host: "127.0.0.1", port: 6379 });
      expect(result.features.monitoring).toBe(false);
    });

    it('应该保持对象引用独立性，避免修改原始输入', () => {
      const originalConfig = {
        api: { endpoints: ["auth", "user", "data"] },
        settings: { timeout: 5000 }
      };
      
      const context = {
        serviceTask: { newEndpoints: ["auth", "user", "data", "analytics"] }
      };
      
      const ref = {
        "api.endpoints": "serviceTask.newEndpoints"
      };

      const result = injectInput(originalConfig, ref, context);
      
      // 修改结果不应影响原始数据
      result.api.endpoints.push("logs");
      expect(originalConfig.api.endpoints).toEqual(["auth", "user", "data"]);
      expect(result.api.endpoints).toEqual(["auth", "user", "data", "analytics", "logs"]);
    });
  });

  // ================== 第二部分：taskId.path引用语法测试 ==================
  
  describe('taskId.path引用语法', () => {
    it('应该支持简单任务结果引用', () => {
      const userInput = { userId: "", userName: "", email: "" };
      const context = {
        getUserTask: {
          id: "user_12345",
          name: "张三",
          emailAddress: "zhangsan@example.com"
        }
      };
      
      const ref = {
        "userId": "getUserTask.id",
        "userName": "getUserTask.name", 
        "email": "getUserTask.emailAddress"
      };

      const result = injectInput(userInput, ref, context);
      expect(result).toEqual({
        userId: "user_12345",
        userName: "张三",
        email: "zhangsan@example.com"
      });
    });

    it('应该支持多层嵌套结果引用', () => {
      const requestConfig = {
        headers: { authorization: "", userAgent: "" },
        body: { token: "", metadata: { source: "" } }
      };
      
      const context = {
        authService: {
          auth: { bearer: { token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9" } },
          client: { info: { agent: "MyApp/1.0" } }
        },
        trackingService: {
          meta: { request: { origin: "mobile-app" } }
        }
      };
      
      const ref = {
        "headers.authorization": "authService.auth.bearer.token",
        "headers.userAgent": "authService.client.info.agent",
        "body.metadata.source": "trackingService.meta.request.origin"
      };

      const result = injectInput(requestConfig, ref, context);
      expect(result.headers.authorization).toBe("eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9");
      expect(result.headers.userAgent).toBe("MyApp/1.0");
      expect(result.body.token).toBe(""); // 保持原值
      expect(result.body.metadata.source).toBe("mobile-app");
    });

    it('应该处理引用路径不存在的情况', () => {
      const config = { apiKey: "default-key", timeout: 30000 };
      const context = {
        secretTask: { otherData: "exists" }
        // 注意：secretTask中没有apiKey字段
      };
      
      const ref = {
        "apiKey": "secretTask.apiKey", // 不存在的路径
        "timeout": "secretTask.requestTimeout" // 不存在的路径
      };

      const result = injectInput(config, ref, context);
      // 引用失败时保持原值
      expect(result.apiKey).toBe("default-key");
      expect(result.timeout).toBe(30000);
    });
  });

  // ================== 第三部分：数组整体替换测试 ==================
  
  describe('数组整体替换 []', () => {
    it('应该完全替换数组内容', () => {
      const mediaList = [
        { id: 1, type: "image", url: "old1.jpg" },
        { id: 2, type: "video", url: "old2.mp4" }
      ];
      
      const context = {
        mediaProcessor: {
          processedMedia: [
            { id: 101, type: "image", url: "processed1.webp", optimized: true },
            { id: 102, type: "video", url: "processed2.webm", optimized: true },
            { id: 103, type: "image", url: "processed3.webp", optimized: true }
          ]
        }
      };
      
      const ref = {
        "[]": "mediaProcessor.processedMedia"
      };

      const result = injectInput(mediaList, ref, context);
      expect(result).toHaveLength(3);
      expect(result).toEqual([
        { id: 101, type: "image", url: "processed1.webp", optimized: true },
        { id: 102, type: "video", url: "processed2.webm", optimized: true },
        { id: 103, type: "image", url: "processed3.webp", optimized: true }
      ]);
    });

    it('应该处理空数组到非空数组的替换', () => {
      const emptyTasks: any[] = [];
      const context = {
        taskGenerator: {
          generatedTasks: [
            { taskId: "task1", action: "process", priority: "high" },
            { taskId: "task2", action: "analyze", priority: "medium" }
          ]
        }
      };
      
      const ref = { "[]": "taskGenerator.generatedTasks" };

      const result = injectInput(emptyTasks, ref, context);
      expect(result).toHaveLength(2);
      expect(result[0].taskId).toBe("task1");
      expect(result[1].taskId).toBe("task2");
    });
  });

  // ================== 第四部分：数组字段分发测试 ==================
  
  describe('数组字段分发 [].field', () => {
    it('应该分发数组字段到对应元素，保持其他字段不变', () => {
      const documents = [
        { docId: "doc1", title: "placeholder", status: "draft", version: 1 },
        { docId: "doc2", title: "placeholder", status: "review", version: 2 },
        { docId: "doc3", title: "placeholder", status: "published", version: 1 }
      ];
      
      const context = {
        titleService: {
          documentTitles: ["用户手册", "API文档", "发布说明"]
        },
        contentService: {
          wordCounts: [1250, 890, 450]
        }
      };
      
      const ref = {
        "[].title": "titleService.documentTitles",
        "[].wordCount": "contentService.wordCounts"
      };

      const result = injectInput(documents, ref, context);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        docId: "doc1", title: "用户手册", status: "draft", version: 1, wordCount: 1250
      });
      expect(result[1]).toEqual({
        docId: "doc2", title: "API文档", status: "review", version: 2, wordCount: 890
      });
      expect(result[2]).toEqual({
        docId: "doc3", title: "发布说明", status: "published", version: 1, wordCount: 450
      });
    });

    it('应该根据引用数组长度调整目标数组长度', () => {
      const products = [
        { sku: "P001", name: "产品1", price: 100 },
        { sku: "P002", name: "产品2", price: 200 },
        { sku: "P003", name: "产品3", price: 300 },
        { sku: "P004", name: "产品4", price: 400 }
      ];
      
      const context = {
        pricingService: {
          discountPrices: [80, 160] // 只有2个价格
        }
      };
      
      const ref = {
        "[].price": "pricingService.discountPrices"
      };

      const result = injectInput(products, ref, context);
      
      // 长度应该调整为引用数组的长度
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ sku: "P001", name: "产品1", price: 80 });
      expect(result[1]).toEqual({ sku: "P002", name: "产品2", price: 160 });
    });
  });

  // ================== 第五部分：数组通配符测试 ==================
  
  describe('数组通配符 [*].field', () => {
    it('应该对所有数组元素设置相同值', () => {
      const servers = [
        { name: "web-01", port: 3000, region: "us-east" },
        { name: "web-02", port: 3001, region: "us-west" },
        { name: "api-01", port: 8080, region: "eu-central" }
      ];
      
      const context = {
        deploymentConfig: {
          deploymentStatus: "active",
          healthCheck: true,
          monitoringEnabled: true
        }
      };
      
      const ref = {
        "[*].status": "deploymentConfig.deploymentStatus",
        "[*].monitoring": "deploymentConfig.monitoringEnabled"
      };

      const result = injectInput(servers, ref, context);
      
      result.forEach((server: any) => {
        expect(server.status).toBe("active");
        expect(server.monitoring).toBe(true);
        // 验证原有字段保持不变
        expect(server.name).toBeDefined();
        expect(server.port).toBeDefined();
        expect(server.region).toBeDefined();
      });
    });
  });

  // ================== 第六部分：特定索引和范围操作测试 ==================
  
  describe('特定索引和范围操作', () => {
    it('应该支持特定索引字段设置 [n].field', () => {
      const workflows = [
        { stepId: 1, action: "init", priority: "normal" },
        { stepId: 2, action: "process", priority: "normal" },
        { stepId: 3, action: "finalize", priority: "normal" },
        { stepId: 4, action: "cleanup", priority: "normal" }
      ];
      
      const context = {
        workflowConfig: {
          highPriority: "critical",
          lowPriority: "background"
        }
      };
      
      const ref = {
        "[0].priority": "workflowConfig.highPriority", // 第一步设为关键
        "[3].priority": "workflowConfig.lowPriority"   // 最后一步设为后台
      };

      const result = injectInput(workflows, ref, context);
      
      expect(result[0].priority).toBe("critical");
      expect(result[1].priority).toBe("normal"); // 保持原值
      expect(result[2].priority).toBe("normal"); // 保持原值  
      expect(result[3].priority).toBe("background");
    });

    it('应该支持多索引操作 [0,2,4].field', () => {
      const notifications = Array(6).fill(null).map((_, i) => ({
        id: `notif_${i}`,
        type: "info",
        urgency: "normal"
      }));
      
      const context = {
        alertConfig: {
          warningType: "warning",
          errorType: "error"
        }
      };
      
      const ref = {
        "[0,2,4].type": "alertConfig.warningType",
        "[1,3,5].type": "alertConfig.errorType"
      };

      const result = injectInput(notifications, ref, context);
      
      expect(result[0].type).toBe("warning");
      expect(result[1].type).toBe("error");
      expect(result[2].type).toBe("warning");
      expect(result[3].type).toBe("error");
      expect(result[4].type).toBe("warning");
      expect(result[5].type).toBe("error");
    });

    it('应该支持范围操作 [start-end].field', () => {
      const tasks = Array(8).fill(null).map((_, i) => ({
        taskId: `task_${i}`,
        stage: "pending",
        assignee: "unassigned"
      }));
      
      const context = {
        assignmentConfig: {
          devStage: "development",
          testStage: "testing",
          prodStage: "production",
          devTeam: "dev-team",
          qaTeam: "qa-team"
        }
      };
      
      const ref = {
        "[0-2].stage": "assignmentConfig.devStage",
        "[3-5].stage": "assignmentConfig.testStage", 
        "[6-7].stage": "assignmentConfig.prodStage",
        "[0-2].assignee": "assignmentConfig.devTeam",
        "[3-5].assignee": "assignmentConfig.qaTeam"
      };

      const result = injectInput(tasks, ref, context);
      
      // 验证前3个任务
      for (let i = 0; i <= 2; i++) {
        expect(result[i].stage).toBe("development");
        expect(result[i].assignee).toBe("dev-team");
      }
      
      // 验证中间3个任务
      for (let i = 3; i <= 5; i++) {
        expect(result[i].stage).toBe("testing");
        expect(result[i].assignee).toBe("qa-team");
      }
      
      // 验证最后2个任务
      for (let i = 6; i <= 7; i++) {
        expect(result[i].stage).toBe("production");
        expect(result[i].assignee).toBe("unassigned"); // 未映射，保持原值
      }
    });
  });

  // ================== 第七部分：条件引用（备选方案）测试 ==================
  
  describe('条件引用备选方案', () => {
    it('应该按顺序尝试备选引用直到成功', () => {
      const serviceConfig = {
        primaryEndpoint: "",
        fallbackEndpoint: "",
        authToken: ""
      };
      
      const context = {
        primaryService: { 
          // 注意：没有endpoint字段，引用会失败
          other: "data" 
        },
        backupService: {
          endpoint: "https://backup-api.com"
        },
        defaultService: {
          endpoint: "https://default-api.com"
        },
        authService: {
          token: "auth_token_123"
        }
      };
      
      const ref = {
        "primaryEndpoint": "primaryService.endpoint,backupService.endpoint,defaultService.endpoint",
        "authToken": "authService.token"
      };

      const result = injectInput(serviceConfig, ref, context);
      
      // primaryService.endpoint不存在，应该使用backupService.endpoint
      expect(result.primaryEndpoint).toBe("https://backup-api.com");
      expect(result.authToken).toBe("auth_token_123");
      expect(result.fallbackEndpoint).toBe(""); // 未映射，保持原值
    });

    it('应该支持环境切换的备选方案', () => {
      const deploymentConfig = {
        databaseUrl: "",
        cacheUrl: "",
        logLevel: ""
      };
      
      const context = {
        // production环境不可用
        staging: {
          database: { url: "staging-db.com" },
          cache: { url: "staging-cache.com" }
        },
        development: {
          database: { url: "dev-db.com" },
          cache: { url: "dev-cache.com" },
          logging: { level: "debug" }
        }
      };
      
      const ref = {
        "databaseUrl": "production.database.url,staging.database.url,development.database.url",
        "cacheUrl": "production.cache.url,staging.cache.url,development.cache.url",
        "logLevel": "production.logging.level,staging.logging.level,development.logging.level"
      };

      const result = injectInput(deploymentConfig, ref, context);
      
      // production不存在，使用staging
      expect(result.databaseUrl).toBe("staging-db.com");
      expect(result.cacheUrl).toBe("staging-cache.com");
      // staging.logging不存在，使用development
      expect(result.logLevel).toBe("debug");
    });

    it('应该支持分支汇聚场景', () => {
      const processResult = {
        finalData: null,
        processingMethod: null,
        status: null
      };
      
      const context = {
        // 条件分支结果
        userTypeCheck: {
          vip: "vip-data-processed",
          regular: "regular-data-processed"
        },
        // 处理方法分支
        dataProcessor: {
          batchMethod: "batch-processing",
          streamMethod: "stream-processing"
        },
        // 状态分支
        qualityCheck: {
          passed: "quality-passed",
          failed: "quality-failed"
        }
      };
      
      const ref = {
        "finalData": "userTypeCheck.vip,userTypeCheck.regular",
        "processingMethod": "dataProcessor.batchMethod,dataProcessor.streamMethod", 
        "status": "qualityCheck.passed,qualityCheck.failed"
      };

      const result = injectInput(processResult, ref, context);
      
      // 使用第一个可用的分支结果
      expect(result.finalData).toBe("vip-data-processed");
      expect(result.processingMethod).toBe("batch-processing");
      expect(result.status).toBe("quality-passed");
    });

    it('应该处理所有备选都失败的情况', () => {
      const config = { 
        setting1: "default-value1",
        setting2: "default-value2" 
      };
      
      const context = {
        // 所有引用的任务都不存在对应字段
        taskA: { otherField: "exists" },
        taskB: { anotherField: "exists" }
      };
      
      const ref = {
        "setting1": "taskA.nonExistent,taskB.nonExistent,taskC.nonExistent",
        "setting2": "missingTask.field"
      };

      const result = injectInput(config, ref, context);
      
      // 所有引用失败，保持原值
      expect(result.setting1).toBe("default-value1");
      expect(result.setting2).toBe("default-value2");
    });
  });

  // ================== 第八部分：深层嵌套组合测试 ==================
  
  describe('深层嵌套组合场景', () => {
    it('应该支持Key和Value双向深层嵌套', () => {
      const complexData = [
        {
          service: {
            api: { 
              endpoints: { primary: "", secondary: "" },
              config: { timeout: 5000, retries: 3 }
            },
            database: { 
              connection: { host: "", port: 5432 },
              pool: { min: 1, max: 10 }
            }
          },
          deployment: {
            infrastructure: { region: "", zone: "" }
          }
        },
        {
          service: {
            api: { 
              endpoints: { primary: "", secondary: "" },
              config: { timeout: 8000, retries: 5 }
            },
            database: { 
              connection: { host: "", port: 5433 },
              pool: { min: 2, max: 20 }
            }
          },
          deployment: {
            infrastructure: { region: "", zone: "" }
          }
        }
      ];
      
      const context = {
        infrastructureService: {
          regions: [
            { primary: { endpoint: "https://api1.example.com" } },
            { primary: { endpoint: "https://api2.example.com" } }
          ],
          zones: [
            { secondary: { endpoint: "https://backup1.example.com" } },
            { secondary: { endpoint: "https://backup2.example.com" } }
          ]
        },
        databaseService: {
          clusters: [
            { master: { connection: { hostname: "db-master-1.com" } } },
            { master: { connection: { hostname: "db-master-2.com" } } }
          ]
        },
        locationService: {
          datacenters: [
            { geo: { location: { region: "us-east-1", availability: "zone-a" } } },
            { geo: { location: { region: "us-west-2", availability: "zone-b" } } }
          ]
        }
      };
      
      const ref = {
        "[].service.api.endpoints.primary": "infrastructureService.regions[].primary.endpoint",
        "[].service.api.endpoints.secondary": "infrastructureService.zones[].secondary.endpoint",
        "[].service.database.connection.host": "databaseService.clusters[].master.connection.hostname",
        "[].deployment.infrastructure.region": "locationService.datacenters[].geo.location.region",
        "[].deployment.infrastructure.zone": "locationService.datacenters[].geo.location.availability"
      };

      const result = injectInput(complexData, ref, context);
      
      // 验证第一个元素的深层映射
      expect(result[0].service.api.endpoints.primary).toBe("https://api1.example.com");
      expect(result[0].service.api.endpoints.secondary).toBe("https://backup1.example.com");
      expect(result[0].service.database.connection.host).toBe("db-master-1.com");
      expect(result[0].deployment.infrastructure.region).toBe("us-east-1");
      expect(result[0].deployment.infrastructure.zone).toBe("zone-a");
      
      // 验证第二个元素的深层映射
      expect(result[1].service.api.endpoints.primary).toBe("https://api2.example.com");
      expect(result[1].service.api.endpoints.secondary).toBe("https://backup2.example.com");
      expect(result[1].service.database.connection.host).toBe("db-master-2.com");
      
      // 验证保持的原有字段
      expect(result[0].service.api.config.timeout).toBe(5000);
      expect(result[0].service.database.connection.port).toBe(5432);
      expect(result[1].service.api.config.timeout).toBe(8000);
    });
  });

  // ================== 第九部分：引用优先级测试 ==================
  
  describe('引用解析优先级', () => {
    it('应该按照特定索引 > 范围 > 通配符的优先级处理', () => {
      const priorityTest = [
        { level: "default" },
        { level: "default" },
        { level: "default" },
        { level: "default" },
        { level: "default" }
      ];
      
      const context = {
        config: {
          wildcardLevel: "wildcard-level",    // 优先级最低
          rangeLevel: "range-level",          // 优先级中等
          specificLevel: "specific-level"     // 优先级最高
        }
      };
      
      const ref = {
        "[*].level": "config.wildcardLevel",     // 优先级：3 (最低)
        "[1-3].level": "config.rangeLevel",      // 优先级：2
        "[2].level": "config.specificLevel"      // 优先级：1 (最高)
      };

      const result = injectInput(priorityTest, ref, context);
      
      // 索引0：只有通配符规则，使用通配符值
      expect(result[0].level).toBe("wildcard-level");
      
      // 索引1：通配符+范围规则，范围优先级更高
      expect(result[1].level).toBe("range-level");
      
      // 索引2：通配符+范围+特定索引规则，特定索引优先级最高
      expect(result[2].level).toBe("specific-level");
      
      // 索引3：通配符+范围规则，范围优先级更高
      expect(result[3].level).toBe("range-level");
      
      // 索引4：只有通配符规则，使用通配符值
      expect(result[4].level).toBe("wildcard-level");
    });
  });

  // ================== 第十部分：错误处理与边界情况测试 ==================
  
  describe('错误处理与边界情况', () => {
    it('应该处理原始类型输入转换为对象', () => {
      const primitiveInputs = [42, "hello", true];
      const context = {
        valueTask: { newField: "added-field" }
      };
      const ref = { "dynamicField": "valueTask.newField" };

      primitiveInputs.forEach(input => {
        const result = injectInput(input, ref, context);
        expect(result).toEqual({ dynamicField: "added-field" });
      });
      
      // 测试null输入的特殊处理
      expect(() => injectInput(null, ref, context)).toThrow();
    });

    it('应该抛出数组类型不匹配错误', () => {
      const arrayInput = [{ id: 1 }, { id: 2 }];
      const context = {
        wrongTask: { notAnArray: "string-value" }
      };
      const ref = { "[]": "wrongTask.notAnArray" };

      expect(() => injectInput(arrayInput, ref, context))
        .toThrow("数组替换操作类型不匹配");
    });

    it('应该验证context参数类型', () => {
      const input = { test: "value" };
      const ref = { "test": "task.field" };
      
      const invalidContexts = [null, undefined, "string", 123, true];
      
      invalidContexts.forEach(invalidContext => {
        expect(() => injectInput(input, ref, invalidContext as any))
          .toThrow("context 参数必须是一个包含任务执行结果的对象");
      });
    });

    it('应该处理引用路径中的null和undefined值', () => {
      const input = { result: "default" };
      const context = {
        taskWithNulls: {
          data: null,
          nested: {
            level1: undefined,
            level2: {
              validField: "should-not-be-used"
            }
          }
        }
      };
      
      const ref = {
        "result": "taskWithNulls.data.someField,taskWithNulls.nested.level1.field,taskWithNulls.missing.field"
      };

      const result = injectInput(input, ref, context);
      expect(result.result).toBe("default"); // 所有引用失败，保持原值
    });
  });

  // ================== 第十一部分：性能和规模测试 ==================
  
  describe('性能和规模测试', () => {
    it('应该高效处理大规模数据映射', () => {
      // 创建大规模测试数据
      const largeDataset = Array(2000).fill(null).map((_, i) => ({
        id: `item_${i}`,
        originalValue: i,
        category: "default",
        metadata: { processed: false }
      }));
      
      const context = {
        batchProcessor: {
          newValues: Array(2000).fill(null).map((_, i) => i * 2),
          categoryMap: Array(2000).fill(null).map((_, i) => 
            i % 3 === 0 ? "typeA" : i % 3 === 1 ? "typeB" : "typeC"
          ),
          processingStatus: true
        }
      };
      
      const ref = {
        "[].originalValue": "batchProcessor.newValues",
        "[].category": "batchProcessor.categoryMap",
        "[*].metadata.processed": "batchProcessor.processingStatus"
      };

      const startTime = Date.now();
      const result = injectInput(largeDataset, ref, context);
      const endTime = Date.now();
      
      // 验证结果正确性
      expect(result).toHaveLength(2000);
      expect(result[0].originalValue).toBe(0);
      expect(result[999].originalValue).toBe(1998);
      expect(result[1999].originalValue).toBe(3998);
      
      // 验证分类映射
      expect(result[0].category).toBe("typeA");  // 0 % 3 === 0
      expect(result[1].category).toBe("typeB");  // 1 % 3 === 1
      expect(result[2].category).toBe("typeC");  // 2 % 3 === 2
      
      // 验证通配符映射
      expect(result[500].metadata.processed).toBe(true);
      expect(result[1500].metadata.processed).toBe(true);
      
      // 验证保持的原有字段
      expect(result[100].id).toBe("item_100");
      expect(result[1000].id).toBe("item_1000");
      
      // 性能断言 - 应该在合理时间内完成
      const processingTime = endTime - startTime;
      console.log(`处理${largeDataset.length}个元素耗时: ${processingTime}ms`);
      expect(processingTime).toBeLessThan(2000); // 2秒内完成
    });
  });

  // ================== 第十二部分：真实业务场景测试 ==================
  
  describe('真实业务场景综合测试', () => {
    it('应该支持完整的电商订单处理工作流', () => {
      const orderItems = [
        {
          product: { 
            sku: "SKU001", 
            name: "商品名称待更新",
            pricing: { originalPrice: 0, discountPrice: 0 }
          },
          inventory: { 
            warehouse: "", 
            stock: { available: 0, reserved: 0 }
          },
          shipping: { 
            carrier: "", 
            estimatedDelivery: "",
            address: { region: "", zone: "" }
          },
          payment: { method: "", status: "pending" }
        },
        {
          product: { 
            sku: "SKU002", 
            name: "商品名称待更新",
            pricing: { originalPrice: 0, discountPrice: 0 }
          },
          inventory: { 
            warehouse: "", 
            stock: { available: 0, reserved: 0 }
          },
          shipping: { 
            carrier: "", 
            estimatedDelivery: "",
            address: { region: "", zone: "" }
          },
          payment: { method: "", status: "pending" }
        }
      ];
      
      const context = {
        // 商品信息服务
        productCatalog: {
          products: [
            { 
              name: "iPhone 15 Pro", 
              price: { list: 999, sale: 899 }
            },
            { 
              name: "MacBook Air M3", 
              price: { list: 1299, sale: 1199 }
            }
          ]
        },
        
        // 库存管理服务
        inventoryService: {
          warehouses: ["华东仓", "华南仓"],
          stockInfo: [
            { available: 150, reserved: 20 },
            { available: 80, reserved: 10 }
          ]
        },
        
        // 物流服务
        shippingService: {
          carriers: ["顺丰速运", "京东物流"],
          deliveryEstimates: ["2024-12-25", "2024-12-26"],
          regions: [
            { area: "华东", zone: "zone-1" },
            { area: "华南", zone: "zone-2" }
          ]
        },
        
        // 支付服务  
        paymentService: {
          defaultMethod: "微信支付",
          processedStatus: "completed"
        },
        
        // 备选服务
        fallbackInventory: {
          warehouse: "中央仓",
          defaultStock: { available: 999, reserved: 0 }
        }
      };
      
      const ref = {
        // 商品信息映射
        "[].product.name": "productCatalog.products[].name",
        "[].product.pricing.originalPrice": "productCatalog.products[].price.list",
        "[].product.pricing.discountPrice": "productCatalog.products[].price.sale",
        
        // 库存信息映射（带备选方案）
        "[].inventory.warehouse": "inventoryService.warehouses,fallbackInventory.warehouse",
        "[].inventory.stock": "inventoryService.stockInfo,fallbackInventory.defaultStock",
        
        // 物流信息映射
        "[].shipping.carrier": "shippingService.carriers",
        "[].shipping.estimatedDelivery": "shippingService.deliveryEstimates",
        "[].shipping.address.region": "shippingService.regions[].area",
        "[].shipping.address.zone": "shippingService.regions[].zone",
        
        // 支付信息统一设置
        "[*].payment.method": "paymentService.defaultMethod",
        "[*].payment.status": "paymentService.processedStatus"
      };

      const result = injectInput(orderItems, ref, context);
      
      // 验证第一个订单项
      expect(result[0].product.name).toBe("iPhone 15 Pro");
      expect(result[0].product.pricing.originalPrice).toBe(999);
      expect(result[0].product.pricing.discountPrice).toBe(899);
      expect(result[0].inventory.warehouse).toBe("华东仓");
      expect(result[0].inventory.stock).toEqual({ available: 150, reserved: 20 });
      expect(result[0].shipping.carrier).toBe("顺丰速运");
      expect(result[0].shipping.estimatedDelivery).toBe("2024-12-25");
      expect(result[0].shipping.address.region).toBe("华东");
      expect(result[0].shipping.address.zone).toBe("zone-1");
      expect(result[0].payment.method).toBe("微信支付");
      expect(result[0].payment.status).toBe("completed");
      
      // 验证第二个订单项
      expect(result[1].product.name).toBe("MacBook Air M3");
      expect(result[1].product.pricing.originalPrice).toBe(1299);
      expect(result[1].inventory.warehouse).toBe("华南仓");
      expect(result[1].shipping.carrier).toBe("京东物流");
      
      // 验证保持的原有字段
      expect(result[0].product.sku).toBe("SKU001");
      expect(result[1].product.sku).toBe("SKU002");
    });
  });
}); 
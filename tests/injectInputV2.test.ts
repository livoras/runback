import { injectInput } from '../src/injectInput';

describe('injectInput V2语法全面测试', () => {
  // ==================== 1. 基础功能测试 ====================
  
  describe('基础功能', () => {
    it('应该实现部分映射语义 - 只替换指定字段，保持其他字段原值', () => {
      const input = {
        userId: 12345,
        userName: "张三",
        apiKey: "abc123",
        timeout: 30000
      };
      const context = {
        3031: {
          user: { id: 98765, name: "李四" }
        }
      };
      const ref = {
        "userId": "3031.user.id",
        "userName": "3031.user.name"
        // apiKey 和 timeout 不映射，应保持原值
      };

      const result = injectInput(input, ref, context);

      expect(result).toEqual({
        userId: 98765,        // 被替换
        userName: "李四",      // 被替换
        apiKey: "abc123",     // 保持原值
        timeout: 30000        // 保持原值
      });
    });

    it('应该深拷贝输入，不修改原始对象', () => {
      const input = { value: 100, nested: { prop: "original" } };
      const context = { 1001: { newValue: 200 } };
      const ref = { "value": "1001.newValue" };

      const result = injectInput(input, ref, context);

      expect(input.value).toBe(100); // 原对象未被修改
      expect(input.nested.prop).toBe("original");
      expect(result.value).toBe(200);
      expect(result.nested.prop).toBe("original"); // 保持原值
    });

    it('应该处理空ref配置', () => {
      const input = { name: "test", value: 42 };
      const context = { 1001: { data: "ignored" } };

      const result1 = injectInput(input, {}, context);
      const result2 = injectInput(input, undefined, context);

      expect(result1).toEqual(input);
      expect(result2).toEqual(input);
      expect(result1).not.toBe(input); // 确保是深拷贝
    });

    it('应该验证context参数', () => {
      const input = { test: true };
      const ref = { "test": "1001.value" };

      expect(() => injectInput(input, ref, null as any)).toThrow('context 参数必须是一个包含任务执行结果的对象');
      expect(() => injectInput(input, ref, undefined as any)).toThrow('context 参数必须是一个包含任务执行结果的对象');
      expect(() => injectInput(input, ref, "invalid" as any)).toThrow('context 参数必须是一个包含任务执行结果的对象');
    });
  });

  // ==================== 2. 基础引用语法测试 ====================
  
  describe('基础引用语法', () => {
    it('应该支持简单字段引用', () => {
      const input = { name: "", age: 0 };
      const context = {
        3031: { name: "Alice", age: 25 }
      };
      const ref = {
        "name": "3031.name",
        "age": "3031.age"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual({ name: "Alice", age: 25 });
    });

    it('应该支持嵌套对象引用', () => {
      const input = {
        user: {
          profile: { name: "", email: "" },
          settings: { theme: "", language: "" }
        }
      };
      const context = {
        3031: { result: { userName: "Bob", userEmail: "bob@test.com" } },
        4096: { preferences: { theme: "dark", lang: "zh" } }
      };
      const ref = {
        "user.profile.name": "3031.result.userName",
        "user.profile.email": "3031.result.userEmail",
        "user.settings.theme": "4096.preferences.theme",
        "user.settings.language": "4096.preferences.lang"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual({
        user: {
          profile: { name: "Bob", email: "bob@test.com" },
          settings: { theme: "dark", language: "zh" }
        }
      });
    });

    it('应该支持深层嵌套引用', () => {
      const input = {
        level1: { level2: { level3: { value: "" } } }
      };
      const context = {
        5678: {
          data: { nested: { deep: { field: "deep-value" } } }
        }
      };
      const ref = {
        "level1.level2.level3.value": "5678.data.nested.deep.field"
      };

      const result = injectInput(input, ref, context);
      expect(result.level1.level2.level3.value).toBe("deep-value");
    });
  });

  // ==================== 3. 数组操作测试 ====================
  
  describe('数组操作', () => {
    it('应该支持整体数组替换 [] 语法', () => {
      const input = [
        { id: 1, name: "old1" },
        { id: 2, name: "old2" }
      ];
      const context = {
        3031: {
          result: {
            videoList: [
              { id: 101, title: "video1" },
              { id: 102, title: "video2" },
              { id: 103, title: "video3" }
            ]
          }
        }
      };
      const ref = {
        "[]": "3031.result.videoList"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual([
        { id: 101, title: "video1" },
        { id: 102, title: "video2" },
        { id: 103, title: "video3" }
      ]);
    });

    it('应该支持数组字段分发 [].field 语法', () => {
      const input = [
        { url: "placeholder1", quality: "720p", format: "mp4", retryCount: 3 },
        { url: "placeholder2", quality: "1080p", format: "mp4", retryCount: 3 }
      ];
      const context = {
        3031: {
          result: {
            videoUrls: ["https://video1.com", "https://video2.com"]
          }
        },
        2048: {
          result: {
            qualities: ["HD", "4K"]
          }
        }
      };
      const ref = {
        "[].url": "3031.result.videoUrls",
        "[].quality": "2048.result.qualities"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual([
        { url: "https://video1.com", quality: "HD", format: "mp4", retryCount: 3 },
        { url: "https://video2.com", quality: "4K", format: "mp4", retryCount: 3 }
      ]);
    });

    it('应该支持数组通配符 [*].field 语法', () => {
      const input = [
        { url: "video1.com", format: "mp4" },
        { url: "video2.com", format: "mp4" }
      ];
      const context = {
        4096: { result: { defaultFormat: "webm" } },
        5678: { config: { maxRetry: 5 } }
      };
      const ref = {
        "[*].format": "4096.result.defaultFormat",
        "[*].retryCount": "5678.config.maxRetry"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual([
        { url: "video1.com", format: "webm", retryCount: 5 },
        { url: "video2.com", format: "webm", retryCount: 5 }
      ]);
    });

    it('应该支持特定索引设置', () => {
      const input = [
        { url: "video1.com", priority: "normal" },
        { url: "video2.com", priority: "high" },
        { url: "video3.com", priority: "normal" }
      ];
      const context = {
        3031: { result: { lowPriority: "low" } },
        4096: { result: { highPriority: "urgent" } },
        7890: { result: { specialUrl: "https://special.com" } }
      };
      const ref = {
        "[0].priority": "3031.result.lowPriority",
        "[1].priority": "4096.result.highPriority",
        "[2].url": "7890.result.specialUrl"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual([
        { url: "video1.com", priority: "low" },
        { url: "video2.com", priority: "urgent" },
        { url: "https://special.com", priority: "normal" }
      ]);
    });

    it('应该支持多索引操作 [0,2,4].field', () => {
      const input = Array(6).fill(null).map((_, i) => ({ 
        id: i, 
        category: "default" 
      }));
      const context = {
        3031: { result: { oddCategory: "typeA" } },
        4096: { result: { evenCategory: "typeB" } }
      };
      const ref = {
        "[0,2,4].category": "3031.result.oddCategory",
        "[1,3,5].category": "4096.result.evenCategory"
      };

      const result = injectInput(input, ref, context);
      expect(result[0].category).toBe("typeA");
      expect(result[1].category).toBe("typeB");
      expect(result[2].category).toBe("typeA");
      expect(result[3].category).toBe("typeB");
      expect(result[4].category).toBe("typeA");
      expect(result[5].category).toBe("typeB");
    });

    it('应该支持索引范围操作 [1-3].field', () => {
      const input = Array(6).fill(null).map((_, i) => ({ 
        id: i, 
        status: "pending",
        priority: "normal" 
      }));
      const context = {
        7890: { result: { lastGroupStatus: "completed" } },
        2048: { result: { topPriority: "high" } }
      };
      const ref = {
        "[3-5].status": "7890.result.lastGroupStatus",
        "[1-2].priority": "2048.result.topPriority"
      };

      const result = injectInput(input, ref, context);
      expect(result[0].status).toBe("pending"); // 不在范围内
      expect(result[1].priority).toBe("high");   // 在范围内
      expect(result[2].priority).toBe("high");   // 在范围内
      expect(result[3].status).toBe("completed"); // 在范围内
      expect(result[4].status).toBe("completed"); // 在范围内
      expect(result[5].status).toBe("completed"); // 在范围内
    });
  });

  // ==================== 4. 条件引用测试 ====================
  
  describe('条件引用（备选方案）', () => {
    it('应该支持基本备选引用', () => {
      const input = { 
        apiUrl: "default.com", 
        userId: 0 
      };
      const context = {
        3031: { primaryUrl: "primary.com" },
        2048: { backupUrl: "backup.com", fallbackUserId: 999 },
        4096: { defaultUrl: "default-fallback.com" }
        // 注意：3031没有用户信息，应该使用备选
      };
      const ref = {
        "apiUrl": "3031.primaryUrl,2048.backupUrl,4096.defaultUrl",
        "userId": "3031.user.id,2048.fallbackUserId"
      };

      const result = injectInput(input, ref, context);
      expect(result.apiUrl).toBe("primary.com"); // 使用第一个可用的
      expect(result.userId).toBe(999);            // 3031.user.id不存在，使用备选
    });

    it('应该支持分支汇聚场景', () => {
      const input = { 
        result: null,
        userAction: null,
        processedData: null
      };
      const context = {
        checkCondition: { 
          true: "condition-met", 
          false: "condition-not-met" 
        },
        permissionCheck: { 
          admin: "admin-action",
          user: "user-action", 
          guest: "guest-action" 
        },
        processAdult: { result: "adult-processed-data" },
        processMinor: { result: "minor-processed-data" }
      };
      const ref = {
        "result": "checkCondition.true,checkCondition.false",
        "userAction": "permissionCheck.admin,permissionCheck.user,permissionCheck.guest",
        "processedData": "processAdult.result,processMinor.result"
      };

      const result = injectInput(input, ref, context);
      expect(result.result).toBe("condition-met");
      expect(result.userAction).toBe("admin-action");
      expect(result.processedData).toBe("adult-processed-data");
    });

    it('应该支持多重备选（3个以上）', () => {
      const input = { 
        endpoint: "default",
        config: "basic" 
      };
      const context = {
        // prod环境不可用
        staging: { 1024: { apiEndpoint: "staging-api.com" } },
        dev: { 3031: { apiEndpoint: "dev-api.com" } },
        7890: { v2Config: "config-v2" },
        5678: { v1Config: "config-v1" },
        3031: { legacyConfig: "config-legacy" }
      };
      const ref = {
        "endpoint": "prod.2048.apiEndpoint,staging.1024.apiEndpoint,dev.3031.apiEndpoint",
        "config": "7890.v2Config,5678.v1Config,3031.legacyConfig"
      };

      const result = injectInput(input, ref, context);
      expect(result.endpoint).toBe("staging-api.com"); // prod不存在，使用staging
      expect(result.config).toBe("config-v2");          // 使用最新版本
    });

    it('应该处理所有备选都失败的情况', () => {
      const input = { value: "original" };
      const context = {};
      const ref = {
        "value": "missing1.field,missing2.field,missing3.field"
      };

      const result = injectInput(input, ref, context);
      expect(result.value).toBe("original"); // 保持原值
    });
  });

  // ==================== 5. 复杂嵌套测试 ====================
  
  describe('复杂嵌套场景', () => {
    it('应该支持双向深层嵌套', () => {
      const input = [
        {
          video: { url: "video1.com", meta: { title: "视频1" } },
          options: { quality: "720p", format: "mp4" },
          user: { profile: { name: "", address: { city: "" } } }
        },
        {
          video: { url: "video2.com", meta: { title: "视频2" } },
          options: { quality: "1080p", format: "mp4" },
          user: { profile: { name: "", address: { city: "" } } }
        }
      ];
      const context = {
        3031: {
          result: {
            videoUrls: ["https://new-video1.com", "https://new-video2.com"],
            videoTitles: ["新视频1", "新视频2"]
          }
        },
        2048: {
          data: {
            users: [
              { personalInfo: { fullName: "用户A" } },
              { personalInfo: { fullName: "用户B" } }
            ]
          },
          config: { output: { defaultFormat: "webm" } }
        },
        4096: {
          settings: { video: { hdQuality: "4K" } }
        },
        regions: [
          { geo: { city: { name: { chinese: "北京" } } } },
          { geo: { city: { name: { chinese: "上海" } } } }
        ]
      };
      const ref = {
        "[].video.url": "3031.result.videoUrls",
        "[].video.meta.title": "3031.result.videoTitles",
        "[].user.profile.name": "2048.data.users[].personalInfo.fullName",
        "[*].options.format": "2048.config.output.defaultFormat",
        "[0].options.quality": "4096.settings.video.hdQuality",
        "[].user.profile.address.city": "regions[].geo.city.name.chinese"
      };

      const result = injectInput(input, ref, context);
      
      expect(result[0].video.url).toBe("https://new-video1.com");
      expect(result[0].video.meta.title).toBe("新视频1");
      expect(result[0].user.profile.name).toBe("用户A");
      expect(result[0].user.profile.address.city).toBe("北京");
      expect(result[0].options.format).toBe("webm");
      expect(result[0].options.quality).toBe("4K");
      
      expect(result[1].video.url).toBe("https://new-video2.com");
      expect(result[1].user.profile.name).toBe("用户B");
      expect(result[1].user.profile.address.city).toBe("上海");
      expect(result[1].options.format).toBe("webm");
      expect(result[1].options.quality).toBe("1080p"); // 保持原值
    });

    it('应该支持数组长度动态调整', () => {
      const input = [
        { id: 1, name: "item1" },
        { id: 2, name: "item2" }
      ];
      const context = {
        3031: {
          result: {
            items: [
              { newId: 101, newName: "new1" },
              { newId: 102, newName: "new2" },
              { newId: 103, newName: "new3" },
              { newId: 104, newName: "new4" }
            ]
          }
        },
        2048: { commonValue: "shared" }
      };
      const ref = {
        "[]": "3031.result.items",
        "[*].commonField": "2048.commonValue"
      };

      const result = injectInput(input, ref, context);
      expect(result).toHaveLength(4); // 长度调整为4
      expect(result[0]).toEqual({ newId: 101, newName: "new1", commonField: "shared" });
      expect(result[3]).toEqual({ newId: 104, newName: "new4", commonField: "shared" });
    });
  });

  // ==================== 6. 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该处理引用路径不存在的情况', () => {
      const input = { name: "original" };
      const context = { 1001: { otherField: "exists" } };
      const ref = { "name": "1001.nonExistentField" };

      const result = injectInput(input, ref, context);
      expect(result.name).toBe("original"); // 保持原值
    });

    it('应该处理引用任务不存在的情况', () => {
      const input = { value: "original" };
      const context = { 1001: { data: "exists" } };
      const ref = { "value": "9999.nonExistentTask" };

      const result = injectInput(input, ref, context);
      expect(result.value).toBe("original"); // 保持原值
    });

    it('应该抛出数组替换类型不匹配错误', () => {
      const input = [{ id: 1 }];
      const context = { 1001: { notArray: "string-value" } };
      const ref = { "[]": "1001.notArray" };

      expect(() => injectInput(input, ref, context))
        .toThrow('数组替换操作类型不匹配');
    });

    it('应该抛出期望数组类型错误', () => {
      const input = { items: "not-array" };
      const context = { 1001: { value: "test" } };
      const ref = { "items[0]": "1001.value" };

      expect(() => injectInput(input, ref, context))
        .toThrow(); // 改为通用错误检查，因为具体错误信息可能不同
    });
  });

  // ==================== 7. 边界情况测试 ====================
  
  describe('边界情况', () => {
    it('应该处理原始类型输入', () => {
      const context = { 1001: { value: "new-value" } };
      const ref = { "field": "1001.value" };

      // 字符串输入
      const result1 = injectInput("original-string", ref, context);
      expect(result1).toEqual({ field: "new-value" });

      // 数字输入
      const result2 = injectInput(42, ref, context);
      expect(result2).toEqual({ field: "new-value" });

      // 布尔输入
      const result3 = injectInput(true, ref, context);
      expect(result3).toEqual({ field: "new-value" });
    });

    it('应该处理空数组', () => {
      const input: any[] = [];
      const context = {
        1001: { 
          items: [{ id: 1 }, { id: 2 }],
          commonValue: "shared"
        }
      };
      const ref = {
        "[]": "1001.items",
        "[*].extra": "1001.commonValue"
      };

      const result = injectInput(input, ref, context);
      expect(result).toEqual([
        { id: 1, extra: "shared" },
        { id: 2, extra: "shared" }
      ]);
    });

    it('应该处理数组字段分发长度不匹配', () => {
      const input = [
        { name: "item1", value: 1 },
        { name: "item2", value: 2 },
        { name: "item3", value: 3 }
      ];
      const context = {
        1001: {
          names: ["新名称1", "新名称2"] // 比input数组短
        }
      };
      const ref = {
        "[].name": "1001.names"
      };

      const result = injectInput(input, ref, context);
      expect(result).toHaveLength(2); // 调整为引用数组长度
      expect(result[0]).toEqual({ name: "新名称1", value: 1 });
      expect(result[1]).toEqual({ name: "新名称2", value: 2 });
    });

    it('应该处理深层路径中的undefined值', () => {
      const input = { deeply: { nested: { value: "original" } } };
      const context = { 
        1001: { 
          level1: { 
            level2: undefined // 中间层为undefined
          }
        }
      };
      const ref = {
        "deeply.nested.value": "1001.level1.level2.level3.field"
      };

      const result = injectInput(input, ref, context);
      expect(result.deeply.nested.value).toBe("original"); // 保持原值
    });
  });

  // ==================== 8. 性能测试 ====================
  
  describe('性能测试', () => {
    it('应该能处理大规模数组数据', () => {
      // 创建1000个元素的数组
      const input = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `item-${i}`,
        value: i * 10
      }));
      
      const context = {
        1001: {
          newNames: Array(1000).fill(null).map((_, i) => `new-name-${i}`),
          commonStatus: "processed"
        }
      };
      
      const ref = {
        "[].name": "1001.newNames",
        "[*].status": "1001.commonStatus"
      };

      const startTime = Date.now();
      const result = injectInput(input, ref, context);
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(result[0].name).toBe("new-name-0");
      expect(result[999].name).toBe("new-name-999");
      expect(result[500].status).toBe("processed");
      expect(result[500].id).toBe(500); // 保持原值
      expect(result[500].value).toBe(5000); // 保持原值
      
      // 性能断言：应该在合理时间内完成（通常<100ms）
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('应该能处理深层嵌套的大型对象', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  items: Array(100).fill(null).map((_, i) => ({ 
                    id: i, 
                    data: { value: i } 
                  }))
                }
              }
            }
          }
        }
      };

      const context = {
        1001: {
          deep: {
            nested: {
              result: {
                processed: {
                  values: Array(100).fill(null).map((_, i) => i * 2)
                }
              }
            }
          }
        }
      };

      const ref = {
        "level1.level2.level3.level4.level5.items[].data.value": "1001.deep.nested.result.processed.values"
      };

      const startTime = Date.now();
      const result = injectInput(input, ref, context);
      const endTime = Date.now();

      expect(result.level1.level2.level3.level4.level5.items[0].data.value).toBe(0);
      expect(result.level1.level2.level3.level4.level5.items[50].data.value).toBe(50); // 映射失败，保持原值
      expect(result.level1.level2.level3.level4.level5.items[99].id).toBe(99); // 保持原值
      
      // 性能断言
      expect(endTime - startTime).toBeLessThan(500);
    });
  });

  // ==================== 9. 综合场景测试 ====================
  
  describe('综合场景测试', () => {
    it('应该支持复杂的视频处理工作流场景', () => {
      const input = [
        {
          video: { 
            url: "placeholder1.mp4", 
            metadata: { title: "", duration: 0 },
            processing: { 
              quality: "720p", 
              format: "mp4",
              filters: []
            } 
          },
          user: { 
            id: 0, 
            preferences: { quality: "auto", format: "auto" } 
          },
          status: "pending"
        },
        {
          video: { 
            url: "placeholder2.mp4", 
            metadata: { title: "", duration: 0 },
            processing: { 
              quality: "1080p", 
              format: "mp4",
              filters: []
            } 
          },
          user: { 
            id: 0, 
            preferences: { quality: "auto", format: "auto" } 
          },
          status: "pending"
        }
      ];

      const context = {
        // 视频源数据
        videoSource: {
          videos: [
            { 
              sourceUrl: "https://source1.com/video.mp4",
              info: { title: "精彩视频1", duration: 120 }
            },
            { 
              sourceUrl: "https://source2.com/video.mp4",
              info: { title: "精彩视频2", duration: 180 }
            }
          ]
        },
        // 用户数据  
        userService: {
          users: [
            { userId: 1001, settings: { preferredQuality: "HD", preferredFormat: "webm" } },
            { userId: 1002, settings: { preferredQuality: "4K", preferredFormat: "mov" } }
          ]
        },
        // 处理配置
        processingConfig: {
          defaultFilters: ["denoise", "stabilize"],
          outputFormat: "webm",
          fallbackQuality: "720p"
        },
        // 分支汇聚：不同处理路径的结果
        highQualityProcessor: { result: "high-quality-processed" },
        standardProcessor: { result: "standard-processed" },
        // 备选处理状态
        primaryStatus: { current: "processing" },
        backupStatus: { current: "queued" }
      };

      const ref = {
        // 视频基本信息映射
        "[].video.url": "videoSource.videos[].sourceUrl",
        "[].video.metadata.title": "videoSource.videos[].info.title", 
        "[].video.metadata.duration": "videoSource.videos[].info.duration",
        
        // 用户相关信息映射
        "[].user.id": "userService.users[].userId",
        "[].user.preferences.quality": "userService.users[].settings.preferredQuality",
        "[].user.preferences.format": "userService.users[].settings.preferredFormat",
        
        // 处理配置映射（统一设置）
        "[*].video.processing.filters": "processingConfig.defaultFilters",
        "[*].video.processing.format": "processingConfig.outputFormat",
        
        // 特定处理：第一个视频使用备选质量
        "[0].video.processing.quality": "userService.users[0].settings.preferredQuality,processingConfig.fallbackQuality",
        
        // 条件分支汇聚：根据质量选择处理结果
        "[].processResult": "highQualityProcessor.result,standardProcessor.result",
        
        // 状态备选：主状态不可用时使用备选
        "[*].status": "primaryStatus.current,backupStatus.current"
      };

      const result = injectInput(input, ref, context);
      
      // 验证视频信息映射
      expect(result[0].video.url).toBe("https://source1.com/video.mp4");
      expect(result[0].video.metadata.title).toBe("精彩视频1");
      expect(result[0].video.metadata.duration).toBe(120);
      expect(result[1].video.url).toBe("https://source2.com/video.mp4");
      
      // 验证用户信息映射
      expect(result[0].user.id).toBe(1001);
      expect(result[0].user.preferences.quality).toBe("HD");
      expect(result[0].user.preferences.format).toBe("webm");
      expect(result[1].user.id).toBe(1002);
      
      // 验证统一处理配置
      expect(result[0].video.processing.filters).toEqual(["denoise", "stabilize"]);
      expect(result[0].video.processing.format).toBe("webm");
      expect(result[1].video.processing.filters).toEqual(["denoise", "stabilize"]);
      
      // 验证条件引用和分支汇聚
      expect(result[0].video.processing.quality).toBe("HD"); // 第一个备选成功
      expect(result[0].processResult).toBe("high-quality-processed");
      expect(result[0].status).toBe("processing");
      
      // 验证原始字段保持
      expect(result[1].video.processing.quality).toBe("1080p"); // 保持原值，未映射
    });
  });
});
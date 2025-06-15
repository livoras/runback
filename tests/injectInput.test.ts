import { injectInput } from '../src/injectInput'

describe('injectInput', () => {
  // 模拟上下文数据
  const mockContext = {
    getUser: {
      id: 98765,
      name: "张三",
      role: "admin",
      profile: {
        email: "zhangsan@example.com",
        avatar: "avatar.jpg"
      }
    },
    getUsers: {
      list: [
        { id: 1, name: "用户1", email: "user1@example.com" },
        { id: 2, name: "用户2", email: "user2@example.com" },
        { id: 3, name: "用户3", email: "user3@example.com" }
      ]
    },
    getConfig: {
      apiUrl: "https://api.example.com",
      timeout: 5000,
      defaultStatus: "active",
      categories: ["tech", "business", "news"]
    },
    getVideos: {
      videos: [
        { url: "video1.mp4", title: "视频1", duration: 120 },
        { url: "video2.mp4", title: "视频2", duration: 180 },
        { url: "video3.mp4", title: "视频3", duration: 90 }
      ]
    },
    primary: { url: "https://primary.com" },
    backup: { url: "https://backup.com" }
  }

  describe('基础功能测试', () => {
    it('should return original input when ref is empty', () => {
      const input = { userId: 123, name: 'test' }
      const result = injectInput(input, {}, mockContext)
      expect(result).toEqual(input)
      expect(result).not.toBe(input) // 应该是新对象
    })

    it('should return original input when ref is null or undefined', () => {
      const input = { userId: 123, name: 'test' }
      expect(injectInput(input, null as any, mockContext)).toEqual(input)
      expect(injectInput(input, undefined as any, mockContext)).toEqual(input)
    })

    it('should throw error when context is invalid', () => {
      const input = { userId: 123 }
      const ref = { "userId": "getUser.id" }
      
      expect(() => injectInput(input, ref, null as any)).toThrow('context 参数必须是一个包含任务执行结果的对象')
      expect(() => injectInput(input, ref, undefined as any)).toThrow('context 参数必须是一个包含任务执行结果的对象')
    })
  })

  describe('单个任务注入 - createTask场景', () => {
    it('should inject simple fields and preserve original fields', () => {
      const input = {
        userId: 12345,
        userName: 'placeholder',
        apiKey: 'static-key',    // 保持原值
        timeout: 30000           // 保持原值
      }

      const ref = {
        "userId": "getUser.id",
        "userName": "getUser.name"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual({
        userId: 98765,           // 来自引用
        userName: "张三",         // 来自引用
        apiKey: 'static-key',    // 保持原值
        timeout: 30000           // 保持原值
      })
    })

    it('should inject nested fields', () => {
      const input = {
        user: {
          id: 0,
          profile: {
            email: 'placeholder@example.com',
            avatar: 'default.jpg'
          }
        },
        config: {
          apiUrl: 'placeholder',
          timeout: 30000  // 保持原值
        }
      }

      const ref = {
        "user.id": "getUser.id",
        "user.profile.email": "getUser.profile.email",
        "user.profile.avatar": "getUser.profile.avatar",
        "config.apiUrl": "getConfig.apiUrl"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual({
        user: {
          id: 98765,
          profile: {
            email: "zhangsan@example.com",
            avatar: "avatar.jpg"
          }
        },
        config: {
          apiUrl: "https://api.example.com",
          timeout: 30000  // 保持原值
        }
      })
    })

    it('should handle backup references', () => {
      const input = {
        apiUrl: 'placeholder',
        fallbackUrl: 'placeholder'
      }

      const ref = {
        "apiUrl": "primary.url,backup.url",
        "fallbackUrl": "nonexistent.url,backup.url"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual({
        apiUrl: "https://primary.com",
        fallbackUrl: "https://backup.com"
      })
    })

    it('should create nested paths when they do not exist', () => {
      const input = {}

      const ref = {
        "user.profile.name": "getUser.name",
        "config.api.endpoint": "getConfig.apiUrl"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual({
        user: {
          profile: {
            name: "张三"
          }
        },
        config: {
          api: {
            endpoint: "https://api.example.com"
          }
        }
      })
    })
  })

  describe('批量任务注入 - createBatch场景', () => {
    it('should handle array replacement with "[]"', () => {
      const input = [
        { userId: 0, name: 'placeholder', format: 'json' }
      ]

      const ref = {
        "[]": "getUsers.list"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual([
        { id: 1, name: "用户1", email: "user1@example.com" },
        { id: 2, name: "用户2", email: "user2@example.com" },
        { id: 3, name: "用户3", email: "user3@example.com" }
      ])
    })

    it('should handle array field mapping with length adjustment', () => {
      const input = [
        {
          userId: 0,
          userName: 'placeholder',
          format: 'json',      // 保持原值
          retryCount: 3        // 保持原值
        }
      ]

      const ref = {
        "[].userId": "getUsers.list[].id",
        "[].userName": "getUsers.list[].name"
      }

      const result = injectInput(input, ref, mockContext)

      // V2语法：部分映射，保留原始字段，数组长度根据引用调整
      expect(result).toEqual([
        { userId: 1, userName: "用户1", format: 'json', retryCount: 3 },
        { userId: 2, userName: "用户2", format: 'json', retryCount: 3 },
        { userId: 3, userName: "用户3", format: 'json', retryCount: 3 }
      ])
    })

    it('should handle array field mapping without array replacement', () => {
      const input = [
        { userId: 0, name: 'placeholder', status: 'pending' },
        { userId: 0, name: 'placeholder', status: 'pending' },
        { userId: 0, name: 'placeholder', status: 'pending' }
      ]

      const ref = {
        "[].userId": "getUsers.list[].id",
        "[].name": "getUsers.list[].name"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual([
        { userId: 1, name: "用户1", status: 'pending' },
        { userId: 2, name: "用户2", status: 'pending' },
        { userId: 3, name: "用户3", status: 'pending' }
      ])
    })

    it('should handle wildcard array operations ([*])', () => {
      const input = [
        { url: 'video1.mp4', quality: '720p', status: 'pending' },
        { url: 'video2.mp4', quality: '1080p', status: 'pending' },
        { url: 'video3.mp4', quality: '480p', status: 'pending' }
      ]

      const ref = {
        "[*].status": "getConfig.defaultStatus"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual([
        { url: 'video1.mp4', quality: '720p', status: 'active' },
        { url: 'video2.mp4', quality: '1080p', status: 'active' },
        { url: 'video3.mp4', quality: '480p', status: 'active' }
      ])
    })

    it('should handle specific index operations', () => {
      const input = [
        { url: 'placeholder', priority: 'normal' },
        { url: 'placeholder', priority: 'normal' },
        { url: 'placeholder', priority: 'normal' }
      ]

      const contextWithPriority = {
        ...mockContext,
        highPriority: { value: 'high' }
      }

      const ref = {
        "[0].url": "getVideos.videos[0].url",
        "[0].priority": "highPriority.value",
        "[1].url": "getVideos.videos[1].url",
        "[2].url": "getVideos.videos[2].url"
      }

      const result = injectInput(input, ref, contextWithPriority)

      expect(result).toEqual([
        { url: 'video1.mp4', priority: 'high' },
        { url: 'video2.mp4', priority: 'normal' },
        { url: 'video3.mp4', priority: 'normal' }
      ])
    })

    it('should handle multi-index operations', () => {
      const input = [
        { category: 'default', priority: 'normal' },
        { category: 'default', priority: 'normal' },
        { category: 'default', priority: 'normal' },
        { category: 'default', priority: 'normal' }
      ]

      const contextWithValues = {
        ...mockContext,
        typeA: { value: 'important' },
        typeB: { value: 'regular' }
      }

      const ref = {
        "[0,2].category": "typeA.value",  // 索引 0 和 2
        "[1,3].category": "typeB.value"   // 索引 1 和 3
      }

      const result = injectInput(input, ref, contextWithValues)

      expect(result).toEqual([
        { category: 'important', priority: 'normal' },
        { category: 'regular', priority: 'normal' },
        { category: 'important', priority: 'normal' },
        { category: 'regular', priority: 'normal' }
      ])
    })

    it('should handle range index operations', () => {
      const input = Array(5).fill(null).map(() => ({ 
        status: 'pending', 
        group: 'default' 
      }))

      const contextWithGroups = {
        ...mockContext,
        groupA: { name: 'alpha' },
        groupB: { name: 'beta' }
      }

      const ref = {
        "[0-2].group": "groupA.name",   // 索引 0,1,2
        "[3-4].group": "groupB.name"    // 索引 3,4
      }

      const result = injectInput(input, ref, contextWithGroups)

      expect(result).toEqual([
        { status: 'pending', group: 'alpha' },
        { status: 'pending', group: 'alpha' },
        { status: 'pending', group: 'alpha' },
        { status: 'pending', group: 'beta' },
        { status: 'pending', group: 'beta' }
      ])
    })
  })

  describe('复杂场景测试', () => {
    it('should handle nested object arrays with dual nesting', () => {
      const input = [
        {
          video: { url: 'placeholder', meta: { title: 'placeholder' } },
          options: { quality: '720p', format: 'mp4' }
        }
      ]

      const ref = {
        "[].video.url": "getVideos.videos[].url",
        "[].video.meta.title": "getVideos.videos[].title"
        // options 字段保持不变
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual([
        {
          video: { url: 'video1.mp4', meta: { title: '视频1' } },
          options: { quality: '720p', format: 'mp4' }
        },
        {
          video: { url: 'video2.mp4', meta: { title: '视频2' } },
          options: { quality: '720p', format: 'mp4' }
        },
        {
          video: { url: 'video3.mp4', meta: { title: '视频3' } },
          options: { quality: '720p', format: 'mp4' }
        }
      ])
    })

    it('should handle mixed array operations ([] + [*] + [index])', () => {
      const input = [
        { url: 'placeholder', quality: '720p', category: 'default', priority: 'normal' },
        { url: 'placeholder', quality: '720p', category: 'default', priority: 'normal' },
        { url: 'placeholder', quality: '720p', category: 'default', priority: 'normal' }
      ]

      const contextWithValues = {
        ...mockContext,
        highPriority: { value: 'high' },
        hdQuality: { value: '1080p' }
      }

      const ref = {
        "[].url": "getVideos.videos[].url",           // 数组映射
        "[*].category": "getConfig.categories[0]",    // 通配符设置
        "[0].priority": "highPriority.value",         // 特定索引
        "[1].quality": "hdQuality.value"              // 特定索引
      }

      const result = injectInput(input, ref, contextWithValues)

      expect(result).toEqual([
        { url: 'video1.mp4', quality: '720p', category: 'tech', priority: 'high' },
        { url: 'video2.mp4', quality: '1080p', category: 'tech', priority: 'normal' },
        { url: 'video3.mp4', quality: '720p', category: 'tech', priority: 'normal' }
      ])
    })

    it('should handle array replacement with additional field mappings', () => {
      const input = [
        {
          userId: 0,
          userName: 'placeholder',
          format: 'json',
          retryCount: 3
        }
      ]

      const ref = {
        "[]": "getUsers.list",                    // 整体数组替换
        "[].userId": "getUsers.list[].id",        // 额外字段映射
        "[].userName": "getUsers.list[].name"
      }

      const result = injectInput(input, ref, mockContext)

      // 整体替换后再进行字段映射（组合操作）
      expect(result).toEqual([
        { id: 1, name: "用户1", email: "user1@example.com", userId: 1, userName: "用户1" },
        { id: 2, name: "用户2", email: "user2@example.com", userId: 2, userName: "用户2" },
        { id: 3, name: "用户3", email: "user3@example.com", userId: 3, userName: "用户3" }
      ])
    })

    it('should handle conditional references in arrays', () => {
      const input = [
        { url: 'placeholder', title: 'placeholder' },
        { url: 'placeholder', title: 'placeholder' }
      ]

      const contextWithBackup = {
        ...mockContext,
        primaryUrls: { list: ["https://primary1.com", "https://primary2.com"] },
        backupUrls: { list: ["https://backup1.com", "https://backup2.com"] },
        primaryTitles: { list: ["主标题1", "主标题2"] },
        fallbackTitles: { list: ["备用标题1", "备用标题2"] }
      }

      const ref = {
        "[].url": "primaryUrls.list[],backupUrls.list[]",
        "[].title": "primaryTitles.list[],fallbackTitles.list[]"
      }

      const result = injectInput(input, ref, contextWithBackup)

      expect(result).toEqual([
        { url: "https://primary1.com", title: "主标题1" },
        { url: "https://primary2.com", title: "主标题2" }
      ])
    })
  })

  describe('边界情况测试', () => {
    it('should handle empty input array', () => {
      const input: any[] = []
      const ref = { "[]": "getUsers.list" }
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { id: 1, name: "用户1", email: "user1@example.com" },
        { id: 2, name: "用户2", email: "user2@example.com" },
        { id: 3, name: "用户3", email: "user3@example.com" }
      ])
    })

    it('should handle null/undefined input values', () => {
      const input = { userId: null, userName: undefined, apiKey: 'static' }
      const ref = { "userId": "getUser.id", "userName": "getUser.name" }
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual({
        userId: 98765,
        userName: "张三",
        apiKey: 'static'
      })
    })

    it('should handle primitive input values', () => {
      const stringInput = "test"
      const numberInput = 123
      const ref = { "value": "getUser.id" }
      
      expect(injectInput(stringInput, ref, mockContext)).toEqual({ value: 98765 })
      expect(injectInput(numberInput, ref, mockContext)).toEqual({ value: 98765 })
    })

    it('should handle deeply nested references', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              value: 'placeholder'
            }
          }
        }
      }

      const ref = {
        "level1.level2.level3.value": "getUser.profile.email"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: "zhangsan@example.com"
            }
          }
        }
      })
    })

    it('should handle arrays with mismatched lengths', () => {
      const input = [
        { id: 1, name: 'name1' },
        { id: 2, name: 'name2' },
        { id: 3, name: 'name3' },
        { id: 4, name: 'name4' },
        { id: 5, name: 'name5' }
      ]

      // 引用数组只有3个元素，input有5个元素
      const ref = {
        "[].id": "getUsers.list[].id"
      }

      const result = injectInput(input, ref, mockContext)

      // 结果数组长度应该匹配引用数组（3个元素）
      expect(result).toEqual([
        { id: 1, name: 'name1' },
        { id: 2, name: 'name2' },
        { id: 3, name: 'name3' }
      ])
    })
  })

  describe('错误处理测试', () => {
    it('should handle invalid references gracefully', () => {
      const input = { userId: 123 }
      const ref = { "userId": "nonexistent.field" }
      
      // 引用失败时应该保持原值或者抛出错误（根据实现策略）
      const result = injectInput(input, ref, mockContext)
      expect(result.userId).toBeDefined() // 应该有值（原值或默认值）
    })

    it('should handle array replacement type mismatch', () => {
      const input = [{ id: 1 }]
      const ref = { "[]": "getUser.name" } // name不是数组
      
      expect(() => injectInput(input, ref, mockContext)).toThrow()
    })

    it('should handle backup references when all fail', () => {
      const input = { value: 'placeholder' }
      const ref = { "value": "nonexistent1.field,nonexistent2.field" }
      
      // 所有备选都失败时的处理策略
      const result = injectInput(input, ref, mockContext)
      expect(result.value).toBe('placeholder') // 应该保持原值
    })

    it('should handle array index out of bounds', () => {
      const input = [
        { url: 'url1' },
        { url: 'url2' }
      ]

      const ref = {
        "[5].url": "getUser.name"  // 索引5超出范围
      }

      const result = injectInput(input, ref, mockContext)
      
      // 应该不会崩溃，可能扩展数组或忽略
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('性能和完整性测试', () => {
    it('should not modify original input object', () => {
      const originalInput = {
        userId: 12345,
        nested: { value: 'original' }
      }
      const inputCopy = JSON.parse(JSON.stringify(originalInput))
      
      const ref = { "userId": "getUser.id" }
      const result = injectInput(originalInput, ref, mockContext)
      
      // 原始输入不应被修改
      expect(originalInput).toEqual(inputCopy)
      
      // 结果应该是新对象
      expect(result).not.toBe(originalInput)
      expect(result.userId).toBe(98765)
    })

    it('should handle large arrays efficiently', () => {
      const largeInput = Array(100).fill(null).map((_, i) => ({
        id: i,
        name: `placeholder${i}`,
        status: 'pending'
      }))

      const ref = {
        "[*].status": "getConfig.defaultStatus"
      }

      const result = injectInput(largeInput, ref, mockContext)
      
      expect(result).toHaveLength(100)
      expect(result.every((item: any) => item.status === 'active')).toBe(true)
      expect(result[50].name).toBe('placeholder50') // 保持原值
    })

    it('should preserve type information', () => {
      const input = {
        stringField: 'test',
        numberField: 123,
        booleanField: true,
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' },
        dateField: new Date('2023-01-01')
      }

      const ref = {
        "newField": "getUser.id"
      }

      const result = injectInput(input, ref, mockContext)
      
      expect(typeof result.stringField).toBe('string')
      expect(typeof result.numberField).toBe('number')
      expect(typeof result.booleanField).toBe('boolean')
      expect(Array.isArray(result.arrayField)).toBe(true)
      expect(typeof result.objectField).toBe('object')
      expect(result.dateField instanceof Date).toBe(true)
      expect(typeof result.newField).toBe('number')
    })

    it('should handle complex dual nesting scenarios', () => {
      const input = [
        {
          user: { profile: { name: 'placeholder' } },
          task: { config: { priority: 'normal' } }
        }
      ]

      const contextWithComplex = {
        ...mockContext,
        userData: {
          profiles: [
            { personalInfo: { fullName: 'Alice Wang' } },
            { personalInfo: { fullName: 'Bob Chen' } }
          ]
        },
        taskConfig: {
          priorities: [
            { level: { importance: 'high' } },
            { level: { importance: 'medium' } }
          ]
        }
      }

      const ref = {
        "[].user.profile.name": "userData.profiles[].personalInfo.fullName",
        "[].task.config.priority": "taskConfig.priorities[].level.importance"
      }

      const result = injectInput(input, ref, contextWithComplex)

      expect(result).toEqual([
        {
          user: { profile: { name: 'Alice Wang' } },
          task: { config: { priority: 'high' } }
        },
        {
          user: { profile: { name: 'Bob Chen' } },
          task: { config: { priority: 'medium' } }
        }
      ])
    })
  })

  describe('优先级和覆盖测试', () => {
    it('should handle field override priority correctly', () => {
      const input = [
        { status: 'original', priority: 'normal' },
        { status: 'original', priority: 'normal' },
        { status: 'original', priority: 'normal' }
      ]

      const contextWithPriorities = {
        ...mockContext,
        groupStatus: { value: 'group' },
        specificStatus: { value: 'specific' },
        highPriority: { value: 'high' }
      }

      const ref = {
        "[*].status": "getConfig.defaultStatus",      // 优先级：3（最低）
        "[0-2].status": "groupStatus.value",          // 优先级：2
        "[1].status": "specificStatus.value",         // 优先级：1（最高）
        "[0].priority": "highPriority.value"
      }

      const result = injectInput(input, ref, contextWithPriorities)

      expect(result).toEqual([
        { status: 'group', priority: 'high' },      // 使用group（索引0不受特定覆盖）
        { status: 'specific', priority: 'normal' },  // 使用specific（最高优先级）
        { status: 'group', priority: 'normal' }      // 使用group
      ])
    })
  })

  describe('分发vs广播概念对比测试', () => {
    it('should demonstrate "distribute" ([]) vs "broadcast" ([*]) concepts', () => {
      const input = [
        { url: 'placeholder1', quality: 'original' },
        { url: 'placeholder2', quality: 'original' },
        { url: 'placeholder3', quality: 'original' }
      ]

      const contextWithUrls = {
        ...mockContext,
        videoUrls: { list: ["video1.mp4", "video2.mp4", "video3.mp4"] },
        defaultQuality: { value: "1080p" }
      }

      // 分发：一对一映射
      const refDistribute = {
        "[].url": "videoUrls.list[]"  // 分发：每个元素获得对应的URL
      }

      // 广播：统一值设置
      const refBroadcast = {
        "[*].quality": "defaultQuality.value"  // 广播：所有元素获得相同质量
      }

      // 组合：分发 + 广播
      const refCombined = {
        "[].url": "videoUrls.list[]",
        "[*].quality": "defaultQuality.value"
      }

      const resultDistribute = injectInput(input, refDistribute, contextWithUrls)
      const resultBroadcast = injectInput(input, refBroadcast, contextWithUrls)
      const resultCombined = injectInput(input, refCombined, contextWithUrls)

      // 验证分发：每个URL不同
      expect(resultDistribute[0].url).toBe("video1.mp4")
      expect(resultDistribute[1].url).toBe("video2.mp4")
      expect(resultDistribute[2].url).toBe("video3.mp4")

      // 验证广播：所有质量相同
      expect(resultBroadcast[0].quality).toBe("1080p")
      expect(resultBroadcast[1].quality).toBe("1080p")
      expect(resultBroadcast[2].quality).toBe("1080p")

      // 验证组合：既有分发又有广播
      expect(resultCombined).toEqual([
        { url: "video1.mp4", quality: "1080p" },
        { url: "video2.mp4", quality: "1080p" },
        { url: "video3.mp4", quality: "1080p" }
      ])
    })

    it('should handle array length mismatch in distribute mode', () => {
      // 输入数组长度 vs 引用数组长度不匹配的情况
      
      // 情况1：输入数组更长
      const longInput = [
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
      ]
      const shortRef = { "[].id": "getUsers.list[].id" } // 只有3个元素

      const result1 = injectInput(longInput, shortRef, mockContext)
      expect(result1).toHaveLength(3) // 应该被截断到引用数组长度

      // 情况2：输入数组更短
      const shortInput = [{ id: 1 }]
      const longRefContext = {
        ...mockContext,
        longList: { 
          items: [
            { value: 'a' }, { value: 'b' }, { value: 'c' }, 
            { value: 'd' }, { value: 'e' }
          ]
        }
      }
      const longRef = { "[].id": "longList.items[].value" }

      const result2 = injectInput(shortInput, longRef, longRefContext)
      expect(result2).toHaveLength(5) // 应该扩展到引用数组长度
    })
  })

  describe('极深层双向嵌套测试', () => {
    it('should handle extremely deep dual nesting', () => {
      const input = [
        {
          user: {
            profile: {
              address: {
                location: {
                  city: 'placeholder'
                }
              }
            }
          },
          task: {
            config: {
              processing: {
                options: {
                  quality: 'default'
                }
              }
            }
          }
        }
      ]

      const deepContext = {
        locationData: {
          regions: [
            {
              geo: {
                city: {
                  name: {
                    chinese: '北京市'
                  }
                }
              }
            },
            {
              geo: {
                city: {
                  name: {
                    chinese: '上海市'
                  }
                }
              }
            }
          ]
        },
        processingConfig: {
          templates: [
            {
              video: {
                output: {
                  format: {
                    settings: {
                      resolution: '4K'
                    }
                  }
                }
              }
            },
            {
              video: {
                output: {
                  format: {
                    settings: {
                      resolution: '8K'
                    }
                  }
                }
              }
            }
          ]
        }
      }

      const ref = {
        "[].user.profile.address.location.city": "locationData.regions[].geo.city.name.chinese",
        "[].task.config.processing.options.quality": "processingConfig.templates[].video.output.format.settings.resolution"
      }

      const result = injectInput(input, ref, deepContext)

      expect(result).toEqual([
        {
          user: {
            profile: {
              address: {
                location: {
                  city: '北京市'
                }
              }
            }
          },
          task: {
            config: {
              processing: {
                options: {
                  quality: '4K'
                }
              }
            }
          }
        },
        {
          user: {
            profile: {
              address: {
                location: {
                  city: '上海市'
                }
              }
            }
          },
          task: {
            config: {
              processing: {
                options: {
                  quality: '8K'
                }
              }
            }
          }
        }
      ])
    })
  })

  describe('复杂分支汇聚场景测试', () => {
    it('should handle complex branch convergence scenarios', () => {
      const input = {
        processedData: 'placeholder',
        ageConfig: 'placeholder',
        permission: 'placeholder',
        userAction: 'placeholder'
      }

      const branchContext = {
        // 年龄检查分支
        checkAge: {
          adult: { canVote: true, canDrink: true },
          minor: { canVote: false, canDrink: false },
          adultConfig: { ageLimit: 18 },
          minorConfig: { ageLimit: 0 }
        },
        // 处理结果分支
        processAdult: {
          result: { message: '成年人处理完成', permissions: ['all'] }
        },
        processMinor: {
          result: { message: '未成年人处理完成', permissions: ['limited'] }
        },
        // 角色检查分支
        roleCheck: {
          admin: { access: 'full', permissions: ['read', 'write', 'delete'] },
          moderator: { access: 'limited', permissions: ['read', 'write'] },
          user: { access: 'basic', permissions: ['read'] },
          guest: { access: 'none', permissions: [] }
        }
      }

      const ref = {
        // 分支汇聚：使用第一个可用的分支结果
        "processedData": "processAdult.result,processMinor.result",
        "ageConfig": "checkAge.adultConfig,checkAge.minorConfig",
        "permission": "roleCheck.admin,roleCheck.moderator,roleCheck.user,roleCheck.guest",
        "userAction": "roleCheck.admin.access,roleCheck.user.access"
      }

      const result = injectInput(input, ref, branchContext)

      expect(result).toEqual({
        processedData: { message: '成年人处理完成', permissions: ['all'] },
        ageConfig: { ageLimit: 18 },
        permission: { access: 'full', permissions: ['read', 'write', 'delete'] },
        userAction: 'full'
      })
    })

    it('should handle environment switching scenarios', () => {
      const input = {
        endpoint: 'placeholder',
        credentials: 'placeholder',
        config: 'placeholder'
      }

      const envContext = {
        prod: {
          api: { endpoint: 'https://api.prod.com' },
          auth: { token: 'prod_token_456' }
        },
        staging: {
          api: { endpoint: 'https://api.staging.com' }
        },
        dev: {
          api: { endpoint: 'https://api.dev.com' }
        },
        test: {
          auth: { token: 'test_token_123' }
        }
      }

      const ref = {
        "endpoint": "prod.api.endpoint,staging.api.endpoint,dev.api.endpoint",
        "credentials": "prod.auth.token,test.auth.token",
        "config": "prod.config,staging.config,defaultConfig"
      }

      const result = injectInput(input, ref, envContext)

      expect(result).toEqual({
        endpoint: 'https://api.prod.com',
        credentials: 'prod_token_456',
        config: 'placeholder'  // 所有备选都失败，保持原值
      })
    })
  })

  describe('语法表格边缘情况测试', () => {
    it('should handle obj.arr[*] syntax', () => {
      const input = {
        items: [
          { status: 'pending' },
          { status: 'pending' },
          { status: 'pending' }
        ]
      }

      const ref = {
        "items[*].status": "getConfig.defaultStatus"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result.items).toEqual([
        { status: 'active' },
        { status: 'active' },
        { status: 'active' }
      ])
    })

    it('should handle whole array reference', () => {
      const input = {
        items: ['placeholder'],
        config: { timeout: 5000 }
      }

      const ref = {
        "items": "getUsers.list"  // 整个数组引用
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual({
        items: [
          { id: 1, name: "用户1", email: "user1@example.com" },
          { id: 2, name: "用户2", email: "user2@example.com" },
          { id: 3, name: "用户3", email: "user3@example.com" }
        ],
        config: { timeout: 5000 }  // 保持原值
      })
    })

    it('should handle array index with wildcard combination', () => {
      const input = [
        { items: [{ status: 'pending' }, { status: 'pending' }] },
        { items: [{ status: 'pending' }, { status: 'pending' }] }
      ]

      const ref = {
        "[*].items[*].status": "getConfig.defaultStatus"
      }

      const result = injectInput(input, ref, mockContext)

      expect(result).toEqual([
        { items: [{ status: 'active' }, { status: 'active' }] },
        { items: [{ status: 'active' }, { status: 'active' }] }
      ])
    })
  })

  describe('错误处理策略统一测试', () => {
    it('should handle reference failures with consistent strategy', () => {
      const input = { 
        field1: 'original1',
        field2: 'original2',
        field3: 'original3'
      }

      const ref = {
        "field1": "nonexistent.path",                    // 完全不存在
        "field2": "getUser.nonexistentField",            // 任务存在，字段不存在
        "field3": "validTask.validField,getUser.name"    // 备选引用，第二个有效
      }

      const result = injectInput(input, ref, mockContext)

      // 统一策略：引用失败时保持原值，备选成功时使用引用值
      expect(result).toEqual({
        field1: 'original1',  // 保持原值
        field2: 'original2',  // 保持原值
        field3: '张三'        // 使用备选引用
      })
    })

    it('should handle array operations with consistent error strategy', () => {
      const input = [
        { url: 'original1' },
        { url: 'original2' }
      ]

      const ref = {
        "[].url": "nonexistent.urls[]",           // 数组引用失败
        "[*].status": "getConfig.defaultStatus"   // 通配符引用成功
      }

      const result = injectInput(input, ref, mockContext)

      // 统一策略：失败的引用保持原值，成功的引用正常替换
      expect(result).toEqual([
        { url: 'original1', status: 'active' },
        { url: 'original2', status: 'active' }
      ])
    })

    it('should handle type mismatch with clear error messages', () => {
      const input = [{ id: 1 }]

      // 类型不匹配：期望数组但给了字符串
      const ref = { "[]": "getUser.name" }

      expect(() => injectInput(input, ref, mockContext))
        .toThrow(/数组替换.*类型.*匹配/)
    })

    it('should handle index out of bounds gracefully', () => {
      const input = [{ id: 1 }, { id: 2 }]

      const ref = {
        "[0].id": "getUser.id",      // 正常
        "[5].id": "getUser.id",      // 越界
        "[100].name": "getUser.name" // 严重越界
      }

      const result = injectInput(input, ref, mockContext)

      // 越界索引应该扩展数组或忽略，不应该崩溃
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].id).toBe(98765)  // 正常索引应该工作
    })
  })

  describe('大规模性能测试', () => {
    it('should handle very large arrays efficiently', () => {
      const largeInput = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `item${i}`,
        status: 'pending',
        category: 'default'
      }))

      const largeContext = {
        ...mockContext,
        bulkUpdate: { status: 'processed' },
        bulkCategory: { type: 'batch' }
      }

      const ref = {
        "[*].status": "bulkUpdate.status",
        "[*].category": "bulkCategory.type"
      }

      const startTime = Date.now()
      const result = injectInput(largeInput, ref, largeContext)
      const endTime = Date.now()

      expect(result).toHaveLength(10000)
      expect(result[0]).toEqual({
        id: 0,
        name: 'item0',
        status: 'processed',
        category: 'batch'
      })
      expect(result[9999]).toEqual({
        id: 9999,
        name: 'item9999',
        status: 'processed',
        category: 'batch'
      })

      // 性能要求：10k元素处理应在1秒内完成
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should handle deeply nested large structures', () => {
      const deepLargeInput = Array(1000).fill(null).map((_, i) => ({
        level1: {
          level2: {
            level3: {
              level4: {
                id: i,
                value: `deep_value_${i}`
              }
            }
          }
        }
      }))

      const ref = {
        "[*].level1.level2.level3.level4.processed": "getConfig.defaultStatus"
      }

      const result = injectInput(deepLargeInput, ref, mockContext)

      expect(result).toHaveLength(1000)
      expect(result[0].level1.level2.level3.level4.processed).toBe('active')
      expect(result[999].level1.level2.level3.level4.value).toBe('deep_value_999')
    })
  })
}) 
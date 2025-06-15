import { injectInput, InjectInputError } from '../src/injectInput'

describe('injectInput V4 - 全面数组操作测试', () => {
  
  // 测试数据准备
  const mockContext = {
    getVideoList: {
      result: {
        videoList: ['video1.mp4', 'video2.mp4', 'video3.mp4']
      }
    },
    getVideoUrls: {
      result: {
        videoUrls: ['https://video1.com', 'https://video2.com', 'https://video3.com']
      }
    },
    getQualities: {
      result: {
        qualities: ['HD', '4K', 'SD']
      }
    },
    getDefaultFormat: {
      result: {
        defaultFormat: 'mp4'
      }
    },
    getMaxRetry: {
      config: {
        maxRetry: 5
      }
    },
    getUrls: {
      urls: ['http://url1.com', 'http://url2.com', 'http://url3.com'],
      defaultUrl: 'http://default.com',
      urlObjects: [
        { address: 'http://obj1.com', port: 80 },
        { address: 'http://obj2.com', port: 443 }
      ]
    },
    getLowPriority: {
      result: { lowPriority: 'low' }
    },
    getHighPriority: {
      result: { highPriority: 'high' }
    },
    getSpecialUrl: {
      result: { specialUrl: 'http://special.com' }
    },
    getOddCategory: {
      result: { oddCategory: 'odd' }
    },
    getEvenCategory: {
      result: { evenCategory: 'even' }
    },
    getLastGroupStatus: {
      result: { lastGroupStatus: 'last' }
    },
    getTopPriority: {
      result: { topPriority: 'top' }
    },
    getVideoData: {
      result: {
        videoUrls: ['https://v1.com', 'https://v2.com'],
        videoTitles: ['Title 1', 'Title 2']
      }
    },
    getUserData: {
      data: {
        users: [
          { personalInfo: { fullName: 'John Doe' } },
          { personalInfo: { fullName: 'Jane Smith' } }
        ]
      }
    },
    getConfig: {
      config: {
        output: {
          defaultFormat: 'webm'
        }
      }
    },
    getVideoSettings: {
      settings: {
        video: {
          hdQuality: '1080p'
        }
      }
    },
    getPrimaryUrls: {
      primaryUrls: ['http://primary1.com', 'http://primary2.com']
    },
    getBackupUrls: {
      backupUrls: ['http://backup1.com', 'http://backup2.com']
    },
    getPreferredFormat: {
      preferredFormat: 'preferred'
    },
    getDefaultFormatStep: {
      defaultFormat: 'default'
    }
  }

  describe('1. 整体数组替换', () => {
    test('标准写法：[] -> stepId.array', () => {
      const input = ['old1', 'old2']
      const ref = {
        '[]': 'getVideoList.result.videoList'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual(['video1.mp4', 'video2.mp4', 'video3.mp4'])
    })

    test('等价写法：[] -> stepId.array[]', () => {
      const input = ['old1', 'old2']
      const ref = {
        '[]': 'getVideoList.result.videoList[]'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual(['video1.mp4', 'video2.mp4', 'video3.mp4'])
    })

    test('空数组替换', () => {
      const input = ['old1', 'old2']
      const ref = {
        '[]': 'getVideoList.result.emptyArray'
      }
      
      const context = {
        getVideoList: { result: { emptyArray: [] } }
      }
      
      const result = injectInput(input, ref, context)
      
      expect(result).toEqual([])
    })
  })

  describe('2. 数组字段映射（一对一）', () => {
    test('[].field -> stepId.array[] - 基本一对一映射', () => {
      const input = [
        { url: 'placeholder1', quality: '720p', format: 'mp4', retryCount: 3 },
        { url: 'placeholder2', quality: '1080p', format: 'mp4', retryCount: 3 }
      ]
      const ref = {
        '[].url': 'getVideoUrls.result.videoUrls[]',
        '[].quality': 'getQualities.result.qualities[]'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      // 源数组有3个元素，目标数组会扩展到3个元素
      expect(result).toEqual([
        { url: 'https://video1.com', quality: 'HD', format: 'mp4', retryCount: 3 },
        { url: 'https://video2.com', quality: '4K', format: 'mp4', retryCount: 3 },
        { url: 'https://video3.com', quality: 'SD', format: 'mp4', retryCount: 3 }
      ])
    })

    test('[].field -> stepId.array[].key - 数组元素字段提取', () => {
      const input = [
        { url: 'placeholder1', port: 0 },
        { url: 'placeholder2', port: 0 }
      ]
      const ref = {
        '[].url': 'getUrls.urlObjects[].address',
        '[].port': 'getUrls.urlObjects[].port'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'http://obj1.com', port: 80 },
        { url: 'http://obj2.com', port: 443 }
      ])
    })

    test('数组长度不匹配 - 源数组更长', () => {
      const input = [
        { url: 'placeholder1' },
        { url: 'placeholder2' }
      ]
      const ref = {
        '[].url': 'getVideoUrls.result.videoUrls[]' // 3个元素
      }
      
      const result = injectInput(input, ref, mockContext)
      
      // 目标数组应该扩展到源数组长度
      expect(result).toEqual([
        { url: 'https://video1.com' },
        { url: 'https://video2.com' },
        { url: 'https://video3.com' }
      ])
    })

    test('数组长度不匹配 - 源数组更短', () => {
      const input = [
        { url: 'placeholder1' },
        { url: 'placeholder2' },
        { url: 'placeholder3' },
        { url: 'placeholder4' }
      ]
      const ref = {
        '[].url': 'getUrls.urlObjects[].address' // 2个元素
      }
      
      const result = injectInput(input, ref, mockContext)
      
      // 目标数组应该截断到源数组长度
      expect(result).toEqual([
        { url: 'http://obj1.com' },
        { url: 'http://obj2.com' }
      ])
    })
  })

  describe('3. 统一值设置', () => {
    test('[*].field -> stepId.value - 统一值设置', () => {
      const input = [
        { url: 'video1.com', format: 'mp4' },
        { url: 'video2.com', format: 'mp4' }
      ]
      const ref = {
        '[*].format': 'getDefaultFormat.result.defaultFormat',
        '[*].retryCount': 'getMaxRetry.config.maxRetry'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'video1.com', format: 'mp4', retryCount: 5 },
        { url: 'video2.com', format: 'mp4', retryCount: 5 }
      ])
    })

    test('[].field -> stepId.value - 等价写法', () => {
      const input = [
        { url: 'video1.com', format: 'mp4' },
        { url: 'video2.com', format: 'mp4' }
      ]
      const ref = {
        '[].retryCount': 'getMaxRetry.config.maxRetry'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'video1.com', format: 'mp4', retryCount: 5 },
        { url: 'video2.com', format: 'mp4', retryCount: 5 }
      ])
    })

    test('空数组统一设置', () => {
      const input: any[] = []
      const ref = {
        '[*].format': 'getDefaultFormat.result.defaultFormat'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([])
    })
  })

  describe('4. 特定索引设置', () => {
    test('[0].field, [1].field, [2].field - 特定索引', () => {
      const input = [
        { url: 'video1.com', priority: 'normal' },
        { url: 'video2.com', priority: 'high' },
        { url: 'video3.com', priority: 'normal' }
      ]
      const ref = {
        '[0].priority': 'getLowPriority.result.lowPriority',
        '[1].priority': 'getHighPriority.result.highPriority',
        '[2].url': 'getSpecialUrl.result.specialUrl'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'video1.com', priority: 'low' },
        { url: 'video2.com', priority: 'high' },
        { url: 'http://special.com', priority: 'normal' }
      ])
    })

    test('索引超出数组长度 - 自动扩展', () => {
      const input = [
        { url: 'video1.com' }
      ]
      const ref = {
        '[2].priority': 'getHighPriority.result.highPriority'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'video1.com' },
        {},
        { priority: 'high' }
      ])
    })
  })

  describe('5. 多索引和范围设置', () => {
    test('[0,2,4].field - 多个索引', () => {
      const input = Array(6).fill(null).map((_, i) => ({ id: i, category: 'default' }))
      const ref = {
        '[0,2,4].category': 'getOddCategory.result.oddCategory',
        '[1,3,5].category': 'getEvenCategory.result.evenCategory'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { id: 0, category: 'odd' },
        { id: 1, category: 'even' },
        { id: 2, category: 'odd' },
        { id: 3, category: 'even' },
        { id: 4, category: 'odd' },
        { id: 5, category: 'even' }
      ])
    })

    test('[6-9].field - 索引范围', () => {
      const input = Array(10).fill(null).map((_, i) => ({ id: i, status: 'default' }))
      const ref = {
        '[6-9].status': 'getLastGroupStatus.result.lastGroupStatus',
        '[0-2].priority': 'getTopPriority.result.topPriority'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result[0]).toEqual({ id: 0, status: 'default', priority: 'top' })
      expect(result[1]).toEqual({ id: 1, status: 'default', priority: 'top' })
      expect(result[2]).toEqual({ id: 2, status: 'default', priority: 'top' })
      expect(result[6]).toEqual({ id: 6, status: 'last' })
      expect(result[7]).toEqual({ id: 7, status: 'last' })
      expect(result[8]).toEqual({ id: 8, status: 'last' })
      expect(result[9]).toEqual({ id: 9, status: 'last' })
    })

    test('范围超出数组长度', () => {
      const input = [
        { id: 0 },
        { id: 1 },
        { id: 2 }
      ]
      const ref = {
        '[1-5].status': 'getLastGroupStatus.result.lastGroupStatus'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { id: 0 },
        { id: 1, status: 'last' },
        { id: 2, status: 'last' }
      ])
    })
  })

  describe('6. 嵌套对象数组', () => {
    test('深层嵌套路径映射', () => {
      const input = [
        {
          video: { url: 'video1.com', meta: { title: '视频1' } },
          options: { quality: '720p', format: 'mp4' }
        },
        {
          video: { url: 'video2.com', meta: { title: '视频2' } },
          options: { quality: '1080p', format: 'mp4' }
        }
      ]
      const ref = {
        '[].video.url': 'getVideoData.result.videoUrls[]',
        '[].video.meta.title': 'getVideoData.result.videoTitles[]',
        '[].user.profile.name': 'getUserData.data.users[].personalInfo.fullName',
        '[*].options.format': 'getConfig.config.output.defaultFormat',
        '[0].options.quality': 'getVideoSettings.settings.video.hdQuality'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        {
          video: { url: 'https://v1.com', meta: { title: 'Title 1' } },
          options: { quality: '1080p', format: 'webm' },
          user: { profile: { name: 'John Doe' } }
        },
        {
          video: { url: 'https://v2.com', meta: { title: 'Title 2' } },
          options: { quality: '1080p', format: 'webm' },
          user: { profile: { name: 'Jane Smith' } }
        }
      ])
    })
  })

  describe('7. 条件引用（备选方案）', () => {
    test('数组中的条件引用', () => {
      const input = [
        { url: 'placeholder1' },
        { url: 'placeholder2' }
      ]
      const ref = {
        '[].url': 'getPrimaryUrls.primaryUrls[],getBackupUrls.backupUrls[]',
        '[*].format': 'getPreferredFormat.preferredFormat,getDefaultFormatStep.defaultFormat'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'http://primary1.com', format: 'preferred' },
        { url: 'http://primary2.com', format: 'preferred' }
      ])
    })

    test('备选引用失败时使用后续选项', () => {
      const input = [
        { url: 'placeholder1' },
        { url: 'placeholder2' }
      ]
      const ref = {
        '[].url': 'nonexistent.urls[],getBackupUrls.backupUrls[]'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'http://backup1.com' },
        { url: 'http://backup2.com' }
      ])
    })
  })

  describe('8. 引用解析优先级', () => {
    test('特定索引 > 范围索引 > 通配符', () => {
      const input = Array(5).fill(null).map((_, i) => ({ id: i, status: 'default' }))
      const ref = {
        '[*].status': 'getLastGroupStatus.result.lastGroupStatus',      // 优先级：3
        '[0-2].status': 'getTopPriority.result.topPriority',           // 优先级：2
        '[1].status': 'getHighPriority.result.highPriority'            // 优先级：1（最高）
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { id: 0, status: 'top' },      // 范围索引
        { id: 1, status: 'high' },     // 特定索引（最高优先级）
        { id: 2, status: 'top' },      // 范围索引
        { id: 3, status: 'last' },     // 通配符
        { id: 4, status: 'last' }      // 通配符
      ])
    })
  })

  describe('9. 错误处理', () => {
    test('目标不是数组时抛出错误', () => {
      const input = { notArray: true }
      const ref = {
        '[].field': 'getVideoUrls.result.videoUrls[]'
      }
      
      expect(() => {
        injectInput(input, ref, mockContext)
      }).toThrow(InjectInputError)
    })

    test('数组替换时值不是数组', () => {
      const input = ['old1', 'old2']
      const ref = {
        '[]': 'getDefaultFormat.result.defaultFormat' // 返回字符串而不是数组
      }
      
      expect(() => {
        injectInput(input, ref, mockContext)
      }).toThrow(InjectInputError)
    })

    test('源路径不存在时保持原值', () => {
      const input = [
        { url: 'original1', format: 'mp4' },
        { url: 'original2', format: 'mp4' }
      ]
      const ref = {
        '[].url': 'nonexistent.urls[]',
        '[*].format': 'getDefaultFormat.result.defaultFormat'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'original1', format: 'mp4' },
        { url: 'original2', format: 'mp4' }
      ])
    })
  })

  describe('10. 边界情况', () => {
    test('空输入数组', () => {
      const input: any[] = []
      const ref = {
        '[].url': 'getVideoUrls.result.videoUrls[]'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'https://video1.com' },
        { url: 'https://video2.com' },
        { url: 'https://video3.com' }
      ])
    })

    test('空ref对象', () => {
      const input = [
        { url: 'original1' },
        { url: 'original2' }
      ]
      const ref = {}
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'original1' },
        { url: 'original2' }
      ])
    })

    test('null和undefined处理', () => {
      const input = [
        { url: 'original1', data: null },
        { url: 'original2', data: undefined }
      ]
      const ref = {
        '[*].format': 'getDefaultFormat.result.defaultFormat'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result).toEqual([
        { url: 'original1', data: null, format: 'mp4' },
        { url: 'original2', data: undefined, format: 'mp4' }
      ])
    })

    test('深度嵌套数组', () => {
      const input = [
        { 
          level1: { 
            level2: { 
              level3: [
                { value: 'old1' },
                { value: 'old2' }
              ] 
            } 
          } 
        }
      ]
      const ref = {
        '[0].level1.level2.level3[*].value': 'getDefaultFormat.result.defaultFormat'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      expect(result[0].level1.level2.level3).toEqual([
        { value: 'mp4' },
        { value: 'mp4' }
      ])
    })
  })

  describe('11. 性能和内存测试', () => {
    test('大数组处理', () => {
      const largeArray = Array(1000).fill(null).map((_, i) => ({ id: i, value: `item${i}` }))
      const ref = {
        '[*].format': 'getDefaultFormat.result.defaultFormat'
      }
      
      const result = injectInput(largeArray, ref, mockContext)
      
      expect(result).toHaveLength(1000)
      expect(result[0]).toEqual({ id: 0, value: 'item0', format: 'mp4' })
      expect(result[999]).toEqual({ id: 999, value: 'item999', format: 'mp4' })
    })

    test('深拷贝验证 - 修改结果不影响原数据', () => {
      const input = [
        { url: 'original1', nested: { value: 'nested1' } }
      ]
      const ref = {
        '[*].format': 'getDefaultFormat.result.defaultFormat'
      }
      
      const result = injectInput(input, ref, mockContext)
      
      // 修改结果
      result[0].url = 'modified'
      result[0].nested.value = 'modified'
      
      // 原数据应该不受影响
      expect(input[0].url).toBe('original1')
      expect(input[0].nested.value).toBe('nested1')
    })
  })
}) 
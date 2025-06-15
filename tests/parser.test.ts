import { parseRefToInput } from '../src/parser';

// @ts-nocheck
describe('parseRefToInput', () => {
  // 测试用的上下文数据
  const mockContext = {
    '3031': {
      user: {
        id: 123,
        name: '张三',
        profile: {
          email: 'zhangsan@example.com',
          age: 30,
          avatar: 'https://avatar.com/zhangsan.jpg',
          highResAvatar: 'https://avatar.com/zhangsan_hd.jpg'
        }
      },
      videos: ['video1.mp4', 'video2.mp4', 'video3.mp4'],
      videoUrls: ['https://v1.com', 'https://v2.com', 'https://v3.com'],
      videoTitles: ['视频1', '视频2', '视频3'],
      config: {
        format: 'mp4',
        quality: '1080p',
        maxRetry: 5
      },
      items: [
        { id: 1, name: 'item1', status: 'active' },
        { id: 2, name: 'item2', status: 'pending' },
        { id: 3, name: 'item3', status: 'inactive' }
      ],
      priorities: ['high', 'medium', 'low'],
      categories: ['important', 'normal', 'important'],
      groups: ['A', 'A', 'B'],
      primaryUrls: ['https://primary1.com', 'https://primary2.com'],
      hdUrls: ['https://hd1.com', 'https://hd2.com'],
      hdThumbnails: ['thumb1_hd.jpg', 'thumb2_hd.jpg'],
      jsonData: { type: 'json', data: 'test' },
      users: [
        { data: { name: 'user1', level: 'premium' } },
        { data: { name: 'user2', level: 'basic' } }
      ],
      activeStatus: 'active',
      personalSettings: { theme: 'dark', language: 'zh' }
    },
    '2048': {
      backup: {
        url: 'https://backup.com',
        format: 'avi'
      },
      fallbackUser: {
        id: 999,
        name: '默认用户'
      },
      defaultConfig: {
        timeout: 30000,
        retries: 3,
        defaultRetry: 3
      },
      backupUrls: ['https://backup1.com', 'https://backup2.com'],
      sdUrls: ['https://sd1.com', 'https://sd2.com'],
      sdThumbnails: ['thumb1_sd.jpg', 'thumb2_sd.jpg'],
      xmlData: { type: 'xml', data: '<root>test</root>' },
      fallbackTitles: ['备用标题1', '备用标题2'],
      defaultStatus: 'pending',
      defaultSettings: { theme: 'light', language: 'en' }
    },
    '4096': {
      system: {
        defaultFormat: 'webm',
        maxRetries: 5
      },
      defaultUrls: ['https://default1.com', 'https://default2.com'],
      placeholderImages: ['placeholder1.jpg', 'placeholder2.jpg'],
      csvData: { type: 'csv', data: 'col1,col2\nval1,val2' },
      placeholderTitles: ['默认标题1', '默认标题2'],
      systemTheme: 'auto',
      defaultUser: { data: { name: 'guest', level: 'guest' } }
    },
    '1024': {
      settings: { timeout: 60000 },
      hdSettings: { quality: 'hd', bitrate: '5000k' },
      titles: ['原始标题1', '原始标题2'],
      preferredFormat: 'webm',
      fullUserInfo: [
        { name: 'admin', role: 'admin', permissions: ['all'] as string[] },
        { name: 'user', role: 'user', permissions: ['read'] as string[] }
      ],
      webpImage: 'image.webp'
    },
    '5678': {
      fallbackUserId: 888,
      v1Config: { version: 1, features: ['basic'] },
      defaultFormat: 'mp4',
      basicUserInfo: [
        { name: 'admin', role: 'admin' },
        { name: 'user', role: 'user' }
      ],
      jpgImage: 'image.jpg',
      standardSettings: { quality: 'standard', bitrate: '2000k' }
    },
    '7890': {
      v2Config: { version: 2, features: ['basic', 'advanced'] as string[] },
      legacyConfig: { version: 0, features: [] as string[] }
    },
    '9999': {
      guestUserData: { name: 'guest', permissions: [] as string[] },
      highPriority: 'urgent',
      pngImage: 'image.png',
      anonymousInfo: [
        { name: 'anonymous', role: 'guest' },
        { name: 'visitor', role: 'guest' }
      ],
      testToken: 'test_token_123'
    },
    // 条件分支测试数据
    'checkAge': {
      adult: { canVote: true, canDrink: true },
      minor: { canVote: false, canDrink: false },
      adultConfig: { ageLimit: 18 },
      minorConfig: { ageLimit: 0 }
    },
    'processAdult': {
      result: { message: '成年人处理完成', permissions: ['all'] }
    },
    'processMinor': {
      result: { message: '未成年人处理完成', permissions: ['limited'] }
    },
    'roleCheck': {
      admin: { access: 'full', permissions: ['read', 'write', 'delete'] as string[] },
      moderator: { access: 'limited', permissions: ['read', 'write'] as string[] },
      user: { access: 'basic', permissions: ['read'] as string[] },
      guest: { access: 'none', permissions: [] as string[] }
    },
    'prod': {
      '2048': { apiEndpoint: 'https://api.prod.com' },
      '5678': { authToken: 'prod_token_456' }
    },
    'staging': {
      '1024': { apiEndpoint: 'https://api.staging.com' }
    },
    'dev': {
      '3031': { apiEndpoint: 'https://api.dev.com' }
    }
  };

  describe('基础引用解析', () => {
    test('简单字段引用', () => {
      const ref = {
        'userId': '3031.user.id',
        'userName': '3031.user.name'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        userId: 123,
        userName: '张三'
      });
    });

    test('嵌套对象引用', () => {
      const ref = {
        'user.id': '3031.user.id',
        'user.profile.email': '3031.user.profile.email',
        'user.profile.age': '3031.user.profile.age'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        user: {
          id: 123,
          profile: {
            email: 'zhangsan@example.com',
            age: 30
          }
        }
      });
    });

    test('数组索引引用', () => {
      const ref = {
        'firstVideo': '3031.videos[0]',
        'secondVideo': '3031.videos[1]',
        'firstItem.name': '3031.items[0].name',
        'firstItem.status': '3031.items[0].status'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        firstVideo: 'video1.mp4',
        secondVideo: 'video2.mp4',
        firstItem: {
          name: 'item1',
          status: 'active'
        }
      });
    });
  });

  describe('条件引用（备选方案）', () => {
    test('使用第一个可用的引用', () => {
      const ref = {
        'config.format': '3031.config.format,2048.backup.format,4096.system.defaultFormat'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        config: {
          format: 'mp4' // 使用第一个可用的值
        }
      });
    });

    test('第一个引用失败时使用备选', () => {
      const ref = {
        'config.format': '9999.nonexistent.format,2048.backup.format,4096.system.defaultFormat'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        config: {
          format: 'avi' // 使用第二个备选
        }
      });
    });

    test('多个备选都失败时抛出异常', () => {
      const ref = {
        'config.format': '9999.nonexistent.format,8888.also.nonexistent',
        'validField': '3031.user.name'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('备选引用失败: 所有引用备选项都解析失败');
    });

    test('容错处理场景 - 部分字段失败抛出异常', () => {
      const ref = {
        'apiUrl': '3031.primaryUrl,2048.backupUrl,4096.defaultUrl',
        'userId': '1024.user.id,5678.fallbackUserId'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('备选引用失败: 所有引用备选项都解析失败');
    });

    test('数据源优先级场景', () => {
      const ref = {
        'userInfo': '5678.premiumUserData,3031.basicUserData,9999.guestUserData',
        'quality': '1024.hdSettings,2048.standardSettings,4096.defaultSettings'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        userInfo: { name: 'guest', permissions: [] }, // 使用最后的 guestUserData
        quality: { quality: 'hd', bitrate: '5000k' }  // 使用第一个可用的 hdSettings
      });
    });

    test('版本兼容性场景', () => {
      const ref = {
        'configData': '7890.v2Config,5678.v1Config,3031.legacyConfig'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        configData: { version: 2, features: ['basic', 'advanced'] } // 使用最新版本
      });
    });

    test('环境切换场景', () => {
      const ref = {
        'endpoint': 'prod.2048.apiEndpoint,staging.1024.apiEndpoint,dev.3031.apiEndpoint',
        'credentials': 'prod.5678.authToken,9999.testToken'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        endpoint: 'https://api.prod.com',
        credentials: 'prod_token_456'
      });
    });

    test('分支汇聚（if-else逻辑）场景', () => {
      const ref = {
        'result': 'checkAge.adult,checkAge.minor',
        'userAction': 'roleCheck.admin,roleCheck.user,roleCheck.guest'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        result: { canVote: true, canDrink: true },
        userAction: { access: 'full', permissions: ['read', 'write', 'delete'] }
      });
    });

    test('完整的分支汇聚示例', () => {
      const ref = {
        'processedData': 'processAdult.result,processMinor.result',
        'ageConfig': 'checkAge.adultConfig,checkAge.minorConfig',
        'permission': 'roleCheck.admin,roleCheck.moderator,roleCheck.user,roleCheck.guest'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        processedData: { message: '成年人处理完成', permissions: ['all'] },
        ageConfig: { ageLimit: 18 },
        permission: { access: 'full', permissions: ['read', 'write', 'delete'] }
      });
    });
  });

  describe('数组操作', () => {
    test('整体数组替换', () => {
      const ref = {
        '[]': '3031.videos'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(['video1.mp4', 'video2.mp4', 'video3.mp4']);
    });

    test('数组字段映射（一对一）', () => {
      const ref = {
        '[].url': '3031.videoUrls[]',
        '[].title': '3031.videoTitles[]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({
        url: 'https://v1.com',
        title: '视频1'
      });
      expect(result[1]).toEqual({
        url: 'https://v2.com',
        title: '视频2'
      });
      expect(result[2]).toEqual({
        url: 'https://v3.com',
        title: '视频3'
      });
    });

    test('统一设置所有项目', () => {
      const ref = {
        '[].url': '3031.videoUrls[]',
        '[*].format': '3031.config.format',
        '[*].quality': '3031.config.quality'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result.length).toBe(3);
      result.forEach((item: any, index: number) => {
        expect(item).toEqual({
          url: mockContext['3031'].videoUrls[index],
          format: 'mp4',
          quality: '1080p'
        });
      });
    });

    test('特定索引设置', () => {
      const ref = {
        '[].url': '3031.videoUrls[]',
        '[0].priority': '3031.priorities[0]',
        '[1].priority': '3031.priorities[1]',
        '[2].priority': '3031.priorities[2]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result[0]).toEqual({
        url: 'https://v1.com',
        priority: 'high'
      });
      expect(result[1]).toEqual({
        url: 'https://v2.com',
        priority: 'medium'
      });
      expect(result[2]).toEqual({
        url: 'https://v3.com',
        priority: 'low'
      });
    });

    test('多索引设置', () => {
      const ref = {
        '[].url': '3031.videoUrls[]',
        '[0].category': '3031.categories[0]',
        '[1].category': '3031.categories[1]',
        '[2].category': '3031.categories[2]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result[0].category).toBe('important');
      expect(result[1].category).toBe('normal');
      expect(result[2].category).toBe('important');
    });

    test('索引范围设置', () => {
      const ref = {
        '[].url': '3031.videoUrls[]',
        '[0].group': '3031.groups[0]',
        '[1].group': '3031.groups[1]',
        '[2].group': '3031.groups[2]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result[0].group).toBe('A');
      expect(result[1].group).toBe('A');
      expect(result[2].group).toBe('B');
    });

    test('数组中的条件引用', () => {
      const ref = {
        '[].url': '3031.primaryUrls[],2048.backupUrls[],4096.defaultUrls[]',
        '[].title': '1024.titles[],2048.fallbackTitles[]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        url: 'https://primary1.com',
        title: '原始标题1'
      });
      expect(result[1]).toEqual({
        url: 'https://primary2.com',
        title: '原始标题2'
      });
    });

    test('数组混合使用条件引用', () => {
      const ref = {
        '[].videoUrl': '3031.hdUrls[],2048.sdUrls[]',
        '[*].format': '1024.preferredFormat,5678.defaultFormat',
        '[0].priority': '9999.highPriority,3031.priorities[0]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        videoUrl: 'https://hd1.com',
        format: 'webm',
        priority: 'urgent'
      });
      expect(result[1]).toEqual({
        videoUrl: 'https://hd2.com',
        format: 'webm'
      });
    });
  });

  describe('复杂嵌套场景', () => {
    test('嵌套对象数组映射', () => {
      const ref = {
        '[].video.url': '3031.videoUrls[]',
        '[].video.title': '3031.videoTitles[]',
        '[*].options.format': '3031.config.format',
        '[0].options.priority': '3031.priorities[0]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result[0]).toEqual({
        video: {
          url: 'https://v1.com',
          title: '视频1'
        },
        options: {
          format: 'mp4',
          priority: 'high'
        }
      });
    });

    test('数组中的条件引用', () => {
      const ref = {
        '[].url': '3031.videoUrls[]',
        '[*].format': '3031.config.format,2048.backup.format,4096.system.defaultFormat'
      };

      const result = parseRefToInput(mockContext, ref);

      result.forEach((item: any, index: number) => {
        expect(item).toEqual({
          url: mockContext['3031'].videoUrls[index],
          format: 'mp4' // 第一个可用的备选项
        });
      });
    });

    test('深层路径备选', () => {
      const ref = {
        'user.profile.avatar': '3031.user.profile.highResAvatar,2048.user.profile.avatar,4096.user.defaultAvatar',
        'config.settings.theme': '3031.personalSettings.theme,2048.defaultSettings.theme,4096.systemTheme'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        user: {
          profile: {
            avatar: 'https://avatar.com/zhangsan_hd.jpg'
          }
        },
        config: {
          settings: {
            theme: 'dark'
          }
        }
      });
    });

    test('数组嵌套备选', () => {
      const ref = {
        '[].video.thumbnails': '3031.hdThumbnails[],2048.sdThumbnails[],4096.placeholderImages[]',
        '[].user.info': '1024.fullUserInfo[],5678.basicUserInfo[],9999.anonymousInfo[]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        video: { thumbnails: 'thumb1_hd.jpg' },
        user: { info: { name: 'admin', role: 'admin', permissions: ['all'] } }
      });
      expect(result[1]).toEqual({
        video: { thumbnails: 'thumb2_hd.jpg' },
        user: { info: { name: 'user', role: 'user', permissions: ['read'] } }
      });
    });

    test('动态路径备选', () => {
      const ref = {
        'userData': '3031.users[0].data,2048.users[1].data,4096.defaultUser.data'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        userData: { name: 'user1', level: 'premium' }
      });
    });

    test('跨类型备选', () => {
      const ref = {
        'dataSource': '3031.jsonData,2048.xmlData,4096.csvData',
        'imageUrl': '1024.webpImage,5678.jpgImage,9999.pngImage'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        dataSource: { type: 'json', data: 'test' },
        imageUrl: 'image.webp'
      });
    });
  });

  describe('边界情况和错误处理', () => {
    test('引用不存在的任务ID', () => {
      const ref = {
        'userId': '9999.user.id'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('字段错误: 字段 \'user\' 不存在');
    });

    test('引用不存在的路径', () => {
      const ref = {
        'data': '3031.nonexistent.path'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('字段错误: 字段 \'nonexistent\' 不存在');
    });

    test('数组索引越界', () => {
      const ref = {
        'video': '3031.videos[10]'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('索引错误: 数组索引 10 超出范围');
    });

    test('空ref对象', () => {
      const ref = {};

      expect(() => parseRefToInput(mockContext, ref)).toThrow('参数错误: ref 参数为空对象');
    });

    test('无效的引用格式', () => {
      const ref = {
        'data': 'invalid_format'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('引用路径格式错误');
    });

    test('null和undefined值处理', () => {
      const contextWithNulls = {
        ...mockContext,
        '5555': {
          data: null as any,
          user: {
            name: undefined as any,
            id: 123
          }
        }
      };

      const ref = {
        'nullData': '5555.data',
        'undefinedName': '5555.user.name',
        'validId': '5555.user.id'
      };

      expect(() => parseRefToInput(contextWithNulls, ref)).toThrow('字段错误: 字段 \'name\' 不存在');
    });

    test('类型不匹配处理', () => {
      const ref = {
        'userId': '3031.user.name', // name是字符串，但通常userId期望数字
        'userName': '3031.user.id'   // id是数字，但userName期望字符串
      };

      const result = parseRefToInput(mockContext, ref);

      // 函数应该返回实际的值，不做类型转换
      expect(result).toEqual({
        userId: '张三',
        userName: 123
      });
    });

    test('深层路径中的null值', () => {
      const contextWithDeepNulls = {
        ...mockContext,
        '6666': {
          level1: {
            level2: null as any,
            level3: {
              value: 'deep_value'
            }
          }
        }
      };

      const ref = {
        'nullPath': '6666.level1.level2.value',
        'validPath': '6666.level1.level3.value'
      };

      expect(() => parseRefToInput(contextWithDeepNulls, ref)).toThrow('路径 \'6666.level1.level2\' 的值为 null，无法继续访问后续字段');
    });

    test('数组中的null元素', () => {
      const contextWithNullArray = {
        ...mockContext,
        '7777': {
          items: [null, { value: 'item2' }, null],
          values: [1, null, 3]
        }
      };

      const ref = {
        'firstItem': '7777.items[0]',
        'secondItem': '7777.items[1]',
        'nullValue': '7777.values[1]',
        'validValue': '7777.values[2]'
      };

      const result = parseRefToInput(contextWithNullArray, ref);

      expect(result).toEqual({
        secondItem: { value: 'item2' },
        validValue: 3
      });
    });
  });

  describe('性能和复杂场景', () => {
    test('大量字段映射', () => {
      const ref: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        ref[`field${i}`] = '3031.user.id';
      }

      const result = parseRefToInput(mockContext, ref);

      expect(Object.keys(result)).toHaveLength(100);
      Object.values(result).forEach(value => {
        expect(value).toBe(123);
      });
    });

    test('深层嵌套路径', () => {
      const deepContext = {
        '1111': {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'found'
                  }
                }
              }
            }
          }
        }
      };

      const ref = {
        'result': '1111.level1.level2.level3.level4.level5.deepValue'
      };

      const result = parseRefToInput(deepContext, ref);

      expect(result).toEqual({
        result: 'found'
      });
    });

    test('混合所有特性的综合测试', () => {
      const ref = {
        // 基础引用
        'userId': '3031.user.id',
        
        // 条件引用
        'format': '3031.config.format,2048.backup.format',
        
        // 数组操作
        '[].url': '3031.videoUrls[]',
        '[*].quality': '3031.config.quality',
        '[0].featured': '3031.priorities[0]',
        '[1].category': '3031.categories[1]',
        '[2].category': '3031.categories[2]',
        
        // 嵌套结构
        'config.timeout': '2048.defaultConfig.timeout',
        'config.retries': '2048.defaultConfig.retries'
      };

      const result = parseRefToInput(mockContext, ref);

      // 检查对象属性
      expect(result.userId).toBe(123);
      expect(result.format).toBe('mp4');
      expect(result.config).toEqual({
        timeout: 30000,
        retries: 3
      });
      
      // 检查数组部分
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toMatchObject({
        url: 'https://v1.com',
        quality: '1080p',
        featured: 'high'
      });
    });

    test('大型数组处理', () => {
      const largeArrayContext = {
        'large': {
          urls: Array.from({ length: 1000 }, (_, i) => `https://url${i}.com`),
          titles: Array.from({ length: 1000 }, (_, i) => `标题${i}`),
          format: 'mp4'
        }
      };

      const ref = {
        '[].url': 'large.urls[]',
        '[].title': 'large.titles[]',
        '[*].format': 'large.format'
      };

      const result = parseRefToInput(largeArrayContext, ref);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1000);
      expect(result[0]).toEqual({
        url: 'https://url0.com',
        title: '标题0',
        format: 'mp4'
      });
      expect(result[999]).toEqual({
        url: 'https://url999.com',
        title: '标题999',
        format: 'mp4'
      });
    });

    test('复杂条件引用链', () => {
      const ref = {
        'retryCount': '3031.config.maxRetry,2048.defaultConfig.defaultRetry,5',
        'timeout': '1024.settings.timeout,30000'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        retryCount: 5, // 使用第一个可用值
        timeout: 60000 // 使用第一个可用值
      });
    });

    test('多层分支汇聚场景', () => {
      const ref = {
        // 用户类型 → 权限检查 → 具体操作
        'finalResult': 'vipUser.premiumAction,regularUser.standardAction,roleCheck.user.access',
        
        // 设备类型 → 格式选择 → 处理结果  
        'output': 'mobileDevice.mobileFormat,desktopDevice.desktopFormat,3031.config.format',
        
        // 地区 → 语言 → 本地化内容
        'content': 'cnRegion.zhContent,usRegion.enContent,3031.user.name'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        finalResult: 'basic', // 使用 roleCheck.user.access
        output: 'mp4',        // 使用 3031.config.format
        content: '张三'       // 使用 3031.user.name
      });
    });
  });

  describe('数组长度动态调整', () => {
    test('根据引用数组长度动态调整', () => {
      const ref = {
        '[]': '3031.items',
        '[*].commonField': '2048.defaultStatus'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      result.forEach((item: any) => {
        expect(item.commonField).toBe('pending');
      });
    });

    test('不同长度数组的处理', () => {
      const contextWithDifferentLengths = {
        'short': { items: ['a', 'b'] as string[] },
        'long': { items: ['1', '2', '3', '4', '5'] as string[] },
        'empty': { items: [] as string[] }
      };

      const ref1 = { '[]': 'short.items', '[*].extra': 'test' };

      expect(() => parseRefToInput(contextWithDifferentLengths, ref1)).toThrow('引用路径格式错误');
    });
  });

  describe('与其他特性的结合', () => {
    test('与通配符结合', () => {
      const ref = {
        '[*].status': '3031.activeStatus,2048.defaultStatus,pending'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('通配符数组操作 [*] 的目标必须是数组');
    });

    test('与数组映射结合', () => {
      const ref = {
        '[].title': '1024.titles[],2048.fallbackTitles[],4096.placeholderTitles[]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ title: '原始标题1' });
      expect(result[1]).toEqual({ title: '原始标题2' });
    });

    test('与嵌套路径结合', () => {
      const ref = {
        'config.database.host': 'prod.3031.db.primary,prod.2048.db.secondary,dev.4096.db.local'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('备选引用失败: 所有引用备选项都解析失败');
    });
  });

  describe('调试场景测试', () => {
    test('用户实际场景：3994数组视频路径映射', () => {
      // 模拟用户调试日志中的 context 结构
      const debugContext = {
        '3994': [
          { video_path: '/path/to/video1.mp4', title: '视频1' },
          { video_path: '/path/to/video2.mp4', title: '视频2' }
        ],
        '3997': [
          { other_field: 'value1' },
          { other_field: 'value2' }
        ]
      };

      // 模拟用户调试日志中的 ref 语法
      const ref = {
        '[].video_path': '3994[].video_path'
      };

      console.log('Debug test context:', debugContext);
      console.log('Debug test ref:', ref);

      const result = parseRefToInput(debugContext, ref);

      console.log('Debug test result:', result);

      // 期望的结果应该是一个数组，包含两个对象，每个对象有 video_path 字段
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({ video_path: '/path/to/video1.mp4' });
      expect(result[1]).toEqual({ video_path: '/path/to/video2.mp4' });
      
      // 如果这个测试失败，说明 parseRefToInput 实现有问题
    });

    test('验证数组映射语法的各种情况', () => {
      const testContext = {
        '1001': [
          { url: 'http://1.com', name: 'item1' },
          { url: 'http://2.com', name: 'item2' },
          { url: 'http://3.com', name: 'item3' }
        ]
      };

      // 测试单字段映射
      const ref1 = {
        '[].url': '1001[].url'
      };
      const result1 = parseRefToInput(testContext, ref1);
      console.log('单字段映射结果:', result1);
      
      // 测试多字段映射
      const ref2 = {
        '[].url': '1001[].url',
        '[].name': '1001[].name'
      };
      const result2 = parseRefToInput(testContext, ref2);
      console.log('多字段映射结果:', result2);
      
      // 这些测试帮助我们理解当前实现的行为
    });

    test('复杂双向嵌套数组映射', () => {
      // 模拟复杂的嵌套数据结构
      const complexContext = {
        '2048': {
          data: {
            users: [
              {
                personalInfo: {
                  fullName: '张三',
                  age: 30,
                  email: 'zhangsan@example.com'
                },
                workInfo: {
                  department: '技术部',
                  position: '工程师'
                }
              },
              {
                personalInfo: {
                  fullName: '李四',
                  age: 28,
                  email: 'lisi@example.com'
                },
                workInfo: {
                  department: '产品部',
                  position: '产品经理'
                }
              },
              {
                personalInfo: {
                  fullName: '王五',
                  age: 32,
                  email: 'wangwu@example.com'
                },
                workInfo: {
                  department: '设计部',
                  position: '设计师'
                }
              }
            ]
          }
        },
        '3031': {
          departments: ['技术部', '产品部', '设计部'],
          defaultRole: 'employee'
        }
      };

      // 测试双向嵌套：key侧和value侧都有复杂路径
      const ref = {
        '[].user.profile.name': '2048.data.users[].personalInfo.fullName',
        '[].user.profile.email': '2048.data.users[].personalInfo.email',
        '[].user.work.department': '2048.data.users[].workInfo.department',
        '[].user.work.position': '2048.data.users[].workInfo.position',
        '[*].user.status': '3031.defaultRole'  // 统一设置
      };

      console.log('复杂嵌套测试 context:', JSON.stringify(complexContext, null, 2));
      console.log('复杂嵌套测试 ref:', JSON.stringify(ref, null, 2));

      const result = parseRefToInput(complexContext, ref);

      console.log('复杂嵌套测试 result:', JSON.stringify(result, null, 2));

      // 验证结果结构
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      
      // 验证第一个用户的数据
      expect(result[0]).toEqual({
        user: {
          profile: {
            name: '张三',
            email: 'zhangsan@example.com'
          },
          work: {
            department: '技术部',
            position: '工程师'
          },
          status: 'employee'
        }
      });

      // 验证第二个用户的数据
      expect(result[1]).toEqual({
        user: {
          profile: {
            name: '李四',
            email: 'lisi@example.com'
          },
          work: {
            department: '产品部',
            position: '产品经理'
          },
          status: 'employee'
        }
      });

      // 验证第三个用户的数据
      expect(result[2]).toEqual({
        user: {
          profile: {
            name: '王五',
            email: 'wangwu@example.com'
          },
          work: {
            department: '设计部',
            position: '设计师'
          },
          status: 'employee'
        }
      });
    });

    test('极深层嵌套数组映射', () => {
      const deepContext = {
        '5678': {
          company: {
            divisions: [
              {
                teams: {
                  development: {
                    members: [
                      {
                        personal: {
                          identity: {
                            name: 'Alice',
                            id: 'DEV001'
                          }
                        }
                      }
                    ]
                  }
                }
              },
              {
                teams: {
                  development: {
                    members: [
                      {
                        personal: {
                          identity: {
                            name: 'Bob',
                            id: 'DEV002'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      };

      // 测试极深层的双向嵌套
      const ref = {
        '[].employee.info.name': '5678.company.divisions[].teams.development.members[0].personal.identity.name',
        '[].employee.info.id': '5678.company.divisions[].teams.development.members[0].personal.identity.id'
      };

      console.log('极深层嵌套测试 context:', JSON.stringify(deepContext, null, 2));
      console.log('极深层嵌套测试 ref:', JSON.stringify(ref, null, 2));

      const result = parseRefToInput(deepContext, ref);

      console.log('极深层嵌套测试 result:', JSON.stringify(result, null, 2));

      // 验证结果
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        employee: {
          info: {
            name: 'Alice',
            id: 'DEV001'
          }
        }
      });
      expect(result[1]).toEqual({
        employee: {
          info: {
            name: 'Bob',
            id: 'DEV002'
          }
        }
      });
    });
  });

  describe('边界情况的健壮性测试', () => {
    test('空字符串路径', () => {
      const ref = {
        'data': '3031.'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('期望字段名，但遇到了输入结束');
    });

    test('只有任务ID没有路径', () => {
      const ref = {
        'data': '3031'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('引用路径格式错误');
    });

    test('多个连续点号', () => {
      const ref = {
        'data': '3031..user..name'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('期望字段名，但遇到了连续的点号');
    });

    test('数组引用中的空索引', () => {
      const ref = {
        'data': '3031.videos[]'
      };

      const result = parseRefToInput(mockContext, ref);

      expect(result).toEqual({
        data: ['video1.mp4', 'video2.mp4', 'video3.mp4']
      });
    });

    test('负数索引', () => {
      const contextWithNegativeTest = {
        '8888': {
          items: ['a', 'b', 'c']
        }
      };

      const ref = {
        'data': '8888.items[-1]'
      };

      expect(() => parseRefToInput(contextWithNegativeTest, ref)).toThrow('期望 IDENTIFIER，但收到 DASH');
    });

    test('非数字索引', () => {
      const ref = {
        'data': '3031.videos[abc]'
      };

      expect(() => parseRefToInput(mockContext, ref)).toThrow('无效的数组索引 "abc"');
    });
  });
}); 
// injectInput.ts - V2语法的核心实现
// 基于 ref-v2.md 规范的部分映射语义

export interface Context {
  [key: string]: any
}

export interface RefMapping {
  [path: string]: string
}

/**
 * 深拷贝函数，保持类型信息
 */
function deepClone(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item))
  }
  
  const cloned: any = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  
  return cloned
}

/**
 * V2语法核心函数：部分映射语义
 * @param input 输入数据（可选字段替换，不指定的字段保持原值）
 * @param ref 引用映射配置（可选的）
 * @param context 上下文数据
 */
export function injectInput(input: any, ref: RefMapping = {}, context: Context): any {
  // 验证context参数
  if (context === null || context === undefined || typeof context !== 'object') {
    throw new Error('context 参数必须是一个包含任务执行结果的对象')
  }

  if (!ref || Object.keys(ref).length === 0) {
    // 即使是空ref，也要深拷贝以确保不修改原对象
    return deepClone(input)
  }

  // 处理原始类型输入 - 转换为对象以支持字段设置
  let processedInput = input
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    processedInput = {}
  }

  // 深拷贝输入数据，确保不修改原数据
  const result = deepClone(processedInput)

  // 处理每个引用映射
  for (const [targetPath, sourcePath] of Object.entries(ref)) {
    try {
      const value = resolveReference(sourcePath, context)
      if (value !== undefined) {
        setValueByPath(result, targetPath, value, processedInput)
      }
    } catch (error) {
      // V2语义：引用失败时保持原值，但类型错误要抛出
      if (error instanceof TypeError || 
          (error instanceof Error && (
            error.message.includes('数组替换') || 
            error.message.includes('类型不匹配') ||
            error.message.includes('期望数组类型')
          ))) {
        throw error
      }
      // console.warn(`引用失败 ${targetPath}: ${sourcePath}`, error)
    }
  }

  return result
}

/**
 * 解析引用路径，支持条件引用（逗号分隔的备选）
 */
function resolveReference(sourcePath: string, context: Context): any {
  const alternatives = sourcePath.split(',').map(s => s.trim())
  
  for (const alt of alternatives) {
    try {
      const value = getValueByPath(context, alt)
      if (value !== undefined) {
        return value
      }
    } catch (error) {
      // 继续尝试下一个备选
      continue
    }
  }
  
  return undefined
}

/**
 * 根据路径获取值，支持数组索引和嵌套访问
 */
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined

  // 检查是否有数组分发语法 [].field
  const arrayDistributeMatch = path.match(/^(.+?)\[\]\.(.+)$/)
  if (arrayDistributeMatch) {
    const arrayPath = arrayDistributeMatch[1]
    const fieldPath = arrayDistributeMatch[2]
    
    const array = getValueByPath(obj, arrayPath)
    if (Array.isArray(array)) {
      // 从数组的每个元素中提取字段值
      return array.map(item => getValueByPath(item, fieldPath)).filter(v => v !== undefined)
    }
    return undefined
  }

  let current = obj
  const segments = path.split('.')
  
  for (const segment of segments) {
    if (segment.includes('[') && segment.includes(']')) {
      // 处理数组访问
      const propName = segment.split('[')[0]
      const bracketContent = segment.match(/\[(.*?)\]/)?.[1]
      
      if (propName) {
        current = current[propName]
      }
      
      if (!current) return undefined
      
      if (bracketContent === '' || bracketContent === undefined) {
        // [] 语法，返回整个数组
        return current
      } else if (bracketContent === '*') {
        // [*] 语法，返回当前数组（用于后续处理）
        continue
      } else if (/^\d+$/.test(bracketContent)) {
        // 数字索引
        const index = parseInt(bracketContent)
        current = Array.isArray(current) ? current[index] : undefined
      }
    } else {
      current = current?.[segment]
    }
    
    if (current === undefined) return undefined
  }

  return current
}

/**
 * 根据路径设置值，支持数组操作
 */
function setValueByPath(obj: any, path: string, value: any, originalInput: any): void {
  // 处理整个数组替换的情况
  if (path === '[]') {
    if (Array.isArray(obj)) {
      if (Array.isArray(value)) {
        handleArrayDistribute(obj, value, originalInput)
      } else {
        throw new Error(`数组替换操作类型不匹配，期望数组类型，但得到: ${typeof value}`)
      }
    }
    return
  }

  // 处理数组字段分发 [].field
  if (path.startsWith('[].')) {
    const fieldPath = path.substring('[].'.length) // 移除 [].
    if (Array.isArray(obj)) {
      // 支持两种情况：
      // 1. value是数组 - 分发不同值到不同元素
      // 2. value是单个值 - 使用相同值
      if (Array.isArray(value)) {
        handleArrayFieldDistribute(obj, fieldPath, value, originalInput)
      } else {
        // 对所有元素设置相同值
        obj.forEach((item, index) => {
          if (!item || typeof item !== 'object') {
            obj[index] = originalInput?.[index] && typeof originalInput[index] === 'object' 
              ? deepClone(originalInput[index]) 
              : {}
            item = obj[index]
          }
          setValueByPath(item, fieldPath, value, originalInput?.[index])
        })
      }
    }
    return
  }

  // 处理数组字段通配符 [*].field  
  if (path.startsWith('[*].')) {
    const fieldPath = path.substring('[*].'.length) // 移除 [*].
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        setValueByPath(item, fieldPath, value, originalInput?.[index])
      })
    }
    return
  }

  // 处理数组索引 [n].field
  const arrayIndexMatch = path.match(/^\[(\d+)\]\.(.+)/)
  if (arrayIndexMatch) {
    const index = parseInt(arrayIndexMatch[1])
    const fieldPath = arrayIndexMatch[2]
    if (Array.isArray(obj)) {
      while (obj.length <= index) {
        obj.push({})
      }
      setValueByPath(obj[index], fieldPath, value, originalInput?.[index])
    }
    return
  }

  // 处理数组范围 [start-end].field
  const rangeMatch = path.match(/^\[(\d+)-(\d+)\]\.(.+)/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1])
    const end = parseInt(rangeMatch[2])
    const fieldPath = rangeMatch[3]
    if (Array.isArray(obj)) {
      for (let i = start; i <= end && i < obj.length; i++) {
        setValueByPath(obj[i], fieldPath, value, originalInput?.[i])
      }
    }
    return
  }

  // 处理多索引 [0,2,4].field
  const multiIndexMatch = path.match(/^\[([0-9,]+)\]\.(.+)/)
  if (multiIndexMatch) {
    const indices = multiIndexMatch[1].split(',').map(s => parseInt(s.trim()))
    const fieldPath = multiIndexMatch[2]
    if (Array.isArray(obj)) {
      indices.forEach(index => {
        if (index < obj.length) {
          setValueByPath(obj[index], fieldPath, value, originalInput?.[index])
        }
      })
    }
    return
  }

  const segments = path.split('.')
  let current = obj
  
  // 导航到设置位置
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    
    if (segment.includes('[') && segment.includes(']')) {
      const propName = segment.split('[')[0]
      const bracketContent = segment.match(/\[(.*?)\]/)?.[1]
      
      if (propName) {
        if (!current[propName]) current[propName] = {}
        current = current[propName]
      }
      
      if (bracketContent === '*') {
        // 通配符操作：对所有元素执行
        const remainingPath = segments.slice(i + 1).join('.')
        if (Array.isArray(current)) {
          current.forEach((item, index) => {
            setValueByPath(item, remainingPath, value, originalInput?.[index])
          })
        }
        return
      } else if (bracketContent && /^\d+$/.test(bracketContent)) {
        const index = parseInt(bracketContent)
        if (!Array.isArray(current)) {
          throw new Error(`期望数组类型，但得到: ${typeof current}`)
        }
        while (current.length <= index) {
          current.push({})
        }
        current = current[index]
      }
    } else {
      if (!current[segment]) current[segment] = {}
      current = current[segment]
    }
  }
  
  // 设置最终值
  const lastSegment = segments[segments.length - 1]
  if (lastSegment.includes('[') && lastSegment.includes(']')) {
    const propName = lastSegment.split('[')[0]
    const bracketContent = lastSegment.match(/\[(.*?)\]/)?.[1]
    
    if (propName && !bracketContent) {
      // obj.prop[] 语法
      if (Array.isArray(value)) {
        current[propName] = value
      }
    } else if (propName && bracketContent === '*') {
      // obj.prop[*] 语法
      if (Array.isArray(current[propName])) {
        current[propName].forEach((_: any, index: number) => {
          current[propName][index] = value
        })
      }
    } else if (propName && bracketContent && /^\d+$/.test(bracketContent)) {
      // obj.prop[index] 语法
      const index = parseInt(bracketContent)
      if (!current[propName]) current[propName] = []
      while (current[propName].length <= index) {
        current[propName].push({})
      }
      current[propName][index] = value
    } else if (!propName && bracketContent === '*') {
      // [*] 语法（直接数组操作）
      if (Array.isArray(current)) {
        current.forEach((_, index) => {
          current[index] = value
        })
      }
    } else if (!propName && bracketContent && /^\d+$/.test(bracketContent)) {
      // [index] 语法
      const index = parseInt(bracketContent)
      if (Array.isArray(current)) {
        while (current.length <= index) {
          current.push({})
        }
        current[index] = value
      }
    } else if (!propName && bracketContent === '') {
      // [] 语法（数组分发）
      if (Array.isArray(value) && Array.isArray(current)) {
        handleArrayDistribute(current, value, originalInput)
      }
    }
  } else {
    // 简单属性设置
    current[lastSegment] = value
  }
}

/**
 * 处理数组分发操作 - 完全替换数组
 */
function handleArrayDistribute(target: any[], value: any[], originalInput: any[]): void {
  // 完全替换：清空原数组，用新值填充
  target.length = 0
  value.forEach((v) => {
    target.push(deepClone(v))  // 深拷贝避免引用问题
  })
}

/**
 * 获取模板对象用于数组扩展
 */
function getTemplateObject(originalInput: any[], index: number): any {
  if (originalInput?.[index] && typeof originalInput[index] === 'object') {
    return deepClone(originalInput[index])
  }
  
  // 寻找最近的有效对象模板
  for (let i = Math.min(index, originalInput?.length - 1); i >= 0; i--) {
    if (originalInput?.[i] && typeof originalInput[i] === 'object') {
      return deepClone(originalInput[i])
    }
  }
  
  return {}
}

/**
 * 处理数组字段分发操作 [].field
 */
function handleArrayFieldDistribute(target: any[], fieldPath: string, fieldValues: any[], originalInput: any[]): void {
  // 调整目标数组长度到引用数组长度
  const newLength = fieldValues.length
  
  // 如果目标数组更长，截断到新长度
  if (target.length > newLength) {
    target.length = newLength
  }
  
  // 确保目标数组有足够长度，填充带原始字段的对象
  while (target.length < newLength) {
    const index = target.length
    target.push(getTemplateObject(originalInput, index))
  }
  
  // 分发字段值，保持原有字段
  fieldValues.forEach((fieldValue, i) => {
    if (!target[i] || typeof target[i] !== 'object') {
      target[i] = getTemplateObject(originalInput, i)
    }
    
    // 直接设置字段值
    if (fieldValue !== undefined) {
      setValueByPath(target[i], fieldPath, fieldValue, getTemplateObject(originalInput, i))
    }
  })
}

// 注意：这些类型定义目前未被使用，保留用于将来可能的重构
// interface PathPart {
//   type: 'property' | 'array'
//   key?: string
// }

// interface ArrayPathPart extends PathPart {
//   type: 'array'
//   operation: 'distribute' | 'wildcard' | 'index' | 'range' | 'multi'
//   index?: number
//   start?: number
//   end?: number
//   indices?: number[]
// } 
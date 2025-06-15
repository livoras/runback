// injectInput.ts - V2语法的核心实现
// 基于 ref-v2.md 规范的部分映射语义

export interface Context {
  [key: string]: any
}

export interface RefMapping {
  [path: string]: string
}

// 错误类型定义
export class InjectInputError extends Error {
  constructor(message: string, public code: string, public context?: any) {
    super(message)
    this.name = 'InjectInputError'
  }
}

// 常量定义 - 只保留必要的循环引用检测

/**
 * 深拷贝函数，保持类型信息，包含循环引用检测
 */
function deepClone(obj: any, visited = new WeakMap()): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  // 循环引用检测
  if (visited.has(obj)) {
    throw new InjectInputError(
      '检测到循环引用，无法进行深拷贝',
      'CIRCULAR_REFERENCE',
      { object: obj }
    )
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime())
  }
  
  if (Array.isArray(obj)) {
    visited.set(obj, true)
    const result = obj.map(item => deepClone(item, visited))
    visited.delete(obj)
    return result
  }
  
  visited.set(obj, true)
  const cloned: any = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key], visited)
    }
  }
  visited.delete(obj)
  
  return cloned
}

/**
 * 验证上下文参数
 */
function validateContext(context: any): void {
  if (context === null || context === undefined || typeof context !== 'object' || Array.isArray(context)) {
    throw new InjectInputError(
      'context 参数必须是一个包含任务执行结果的对象',
      'INVALID_CONTEXT',
      { receivedType: context === null ? 'null' : context === undefined ? 'undefined' : typeof context, receivedValue: context }
    )
  }
}

/**
 * 验证ref参数格式
 */
function validateRefMapping(ref: any): void {
  // 允许ref为null、undefined或空对象
  if (ref === null || ref === undefined || Object.keys(ref || {}).length === 0) {
    return
  }
  
  if (typeof ref !== 'object' || Array.isArray(ref)) {
    throw new InjectInputError(
      `ref 参数必须是对象类型，但收到: ${typeof ref}`,
      'INVALID_REF_TYPE',
      { receivedType: typeof ref, receivedValue: ref }
    )
  }
  
  // 验证每个映射项
  for (const [targetPath, sourcePath] of Object.entries(ref)) {
    validatePath(targetPath, 'target')
    validatePath(sourcePath as string, 'source')
  }
}

/**
 * 验证路径格式
 */
function validatePath(path: string, pathType: 'target' | 'source'): void {
  if (typeof path !== 'string') {
    throw new InjectInputError(
      `${pathType} 路径必须是字符串类型，但收到: ${typeof path}`,
      'INVALID_PATH_TYPE',
      { pathType, receivedType: typeof path, receivedValue: path }
    )
  }
  
  if (path.length === 0) {
    throw new InjectInputError(
      `${pathType} 路径不能为空字符串`,
      'EMPTY_PATH',
      { pathType }
    )
  }
  

  
  // 检查路径格式 - 只禁止真正危险的字符
  const invalidChars = /[<>"|]/
  if (invalidChars.test(path)) {
    throw new InjectInputError(
      `${pathType} 路径包含非法字符: ${path}`,
      'INVALID_PATH_CHARACTERS',
      { pathType, path, invalidChars: path.match(invalidChars) }
    )
  }
  
  // 检查数组语法格式
  const bracketMatches = path.match(/\[([^\]]*)\]/g)
  if (bracketMatches) {
    for (const match of bracketMatches) {
      const content = match.slice(1, -1) // 移除 [ ]
      
      // 验证数组索引格式
      if (content !== '' && content !== '*') {
        // 检查数字索引
        if (/^\d+$/.test(content)) {
          // 基本的数字格式验证即可
        }
        // 检查范围格式 [start-end]
        else if (/^\d+-\d+$/.test(content)) {
          const [start, end] = content.split('-').map(n => parseInt(n))
          if (start > end) {
            throw new InjectInputError(
              `${pathType} 路径中的范围格式错误: 起始索引 ${start} 大于结束索引 ${end}`,
              'INVALID_RANGE_FORMAT',
              { pathType, path, start, end }
            )
          }
        }
        // 检查多索引格式 [0,2,4]
        else if (/^[\d,\s]+$/.test(content)) {
          const indices = content.split(',').map(s => parseInt(s.trim()))
          if (indices.some(idx => isNaN(idx) || idx < 0)) {
            throw new InjectInputError(
              `${pathType} 路径中的多索引格式包含无效索引: ${content}`,
              'INVALID_MULTI_INDEX_FORMAT',
              { pathType, path, content, indices }
            )
          }
        }
        // 其他无效格式
        else {
          throw new InjectInputError(
            `${pathType} 路径中的数组语法格式错误: ${match}`,
            'INVALID_ARRAY_SYNTAX',
            { pathType, path, invalidSyntax: match }
          )
        }
      }
    }
  }
  
  // 检查路径段格式
  const segments = path.split('.')
  for (const segment of segments) {
    if (segment.length === 0) {
      throw new InjectInputError(
        `${pathType} 路径包含空段: ${path}`,
        'EMPTY_PATH_SEGMENT',
        { pathType, path }
      )
    }
    
    // 移除数组语法后检查属性名 - 放宽限制，允许数字、逗号等
    const propName = segment.replace(/\[.*?\]/g, '')
    if (propName && /[<>"|\\]/.test(propName)) {
      throw new InjectInputError(
        `${pathType} 路径包含无效的属性名: ${propName}`,
        'INVALID_PROPERTY_NAME',
        { pathType, path, segment, propertyName: propName }
      )
    }
  }
}

/**
 * V2语法核心函数：部分映射语义
 * @param input 输入数据（可选字段替换，不指定的字段保持原值）
 * @param ref 引用映射配置（可选的）
 * @param context 上下文数据
 */
export function injectInput(input: any, ref: RefMapping = {}, context: Context): any {
  try {
    // 参数验证
    validateContext(context)
    validateRefMapping(ref)
    
    if (!ref || Object.keys(ref).length === 0) {
      // 即使是空ref，也要深拷贝以确保不修改原对象
      return deepClone(input)
    }

    // 处理原始类型输入 - 转换为对象以支持字段设置
    let processedInput = input
    if (input === null) {
      throw new InjectInputError(
        'input 参数不能为 null，如需空值请使用 undefined 或空对象 {}',
        'INPUT_NULL_NOT_ALLOWED'
      )
    }
    
    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
      processedInput = {}
    }

    // 深拷贝输入数据，确保不修改原数据
    const result = deepClone(processedInput)

    // 处理每个引用映射
    for (const [targetPath, sourcePath] of Object.entries(ref)) {
      try {
        const value = resolveReference(sourcePath, context, targetPath)
        if (value !== undefined) {
          setValueByPath(result, targetPath, value, processedInput, sourcePath)
        }
      } catch (error) {
        // V2语义：引用失败时保持原值，但严重错误要抛出
        if (error instanceof InjectInputError) {
          throw error
        }
        if (error instanceof TypeError || 
            (error instanceof Error && (
              error.message.includes('数组替换') || 
              error.message.includes('类型不匹配') ||
              error.message.includes('期望数组类型')
            ))) {
          throw new InjectInputError(
            `处理映射 "${targetPath}" -> "${sourcePath}" 时发生错误: ${error.message}`,
            'MAPPING_PROCESSING_ERROR',
            { targetPath, sourcePath, originalError: error.message }
          )
        }
        // 其他错误静默处理，保持原值
      }
    }

    return result
  } catch (error) {
    // 重新包装错误以提供更好的上下文
    if (error instanceof InjectInputError) {
      throw error
    }
    throw new InjectInputError(
      `injectInput 执行失败: ${error instanceof Error ? error.message : String(error)}`,
      'INJECT_INPUT_FAILED',
      { originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * 解析引用路径，支持条件引用（逗号分隔的备选）
 */
function resolveReference(sourcePath: string, context: Context, targetPath?: string): any {
  const alternatives = sourcePath.split(',').map(s => s.trim())
  const errors: Array<{alternative: string, error: string}> = []
  
  for (const alt of alternatives) {
    try {
      // 验证每个备选路径
      validatePath(alt, 'source')
      
      const value = getValueByPath(context, alt)
      if (value !== undefined) {
        return value
      }
      errors.push({ alternative: alt, error: '路径返回 undefined' })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push({ alternative: alt, error: errorMsg })
      continue
    }
  }
  
  // 如果所有备选都失败，记录详细信息但不抛出错误（V2语义）
  // console.warn(`所有引用备选都失败`, { targetPath, sourcePath, alternatives, errors })
  return undefined
}

/**
 * 根据路径获取值，支持数组索引和嵌套访问
 */
function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined

  try {
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
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      
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
          if (!Array.isArray(current)) {
            throw new InjectInputError(
              `路径 "${path}" 在段 "${segment}" 处期望数组类型，但得到: ${typeof current}`,
              'EXPECTED_ARRAY_TYPE',
              { path, segment, receivedType: typeof current }
            )
          }
          return current
        } else if (bracketContent === '*') {
          // [*] 语法，返回当前数组（用于后续处理）
          if (!Array.isArray(current)) {
            throw new InjectInputError(
              `路径 "${path}" 在段 "${segment}" 处期望数组类型，但得到: ${typeof current}`,
              'EXPECTED_ARRAY_TYPE',
              { path, segment, receivedType: typeof current }
            )
          }
          continue
        } else if (/^\d+$/.test(bracketContent)) {
          // 数字索引
          const index = parseInt(bracketContent)
          if (!Array.isArray(current)) {
            throw new InjectInputError(
              `路径 "${path}" 在段 "${segment}" 处期望数组类型，但得到: ${typeof current}`,
              'EXPECTED_ARRAY_TYPE',
              { path, segment, receivedType: typeof current }
            )
          }
          if (index >= current.length) {
            return undefined // 索引越界返回undefined而不是抛出错误
          }
          current = current[index]
        } else {
          throw new InjectInputError(
            `路径 "${path}" 中的数组语法无效: [${bracketContent}]`,
            'INVALID_ARRAY_SYNTAX_IN_PATH',
            { path, segment, bracketContent }
          )
        }
      } else {
        if (current === null || current === undefined) {
          return undefined
        }
        current = current[segment]
      }
      
      if (current === undefined) return undefined
    }

    return current
  } catch (error) {
    if (error instanceof InjectInputError) {
      throw error
    }
    throw new InjectInputError(
      `获取路径值时发生错误: ${path}`,
      'GET_VALUE_ERROR',
      { path, originalError: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * 根据路径设置值，支持数组操作
 */
function setValueByPath(obj: any, path: string, value: any, originalInput: any, sourcePath?: string): void {
  try {
    // 处理整个数组替换的情况
    if (path === '[]') {
      if (!Array.isArray(obj)) {
        throw new InjectInputError(
          `目标路径 "[]" 要求目标是数组类型，但得到: ${typeof obj}`,
          'TARGET_NOT_ARRAY',
          { path, targetType: typeof obj, sourcePath }
        )
      }
      if (!Array.isArray(value)) {
        throw new InjectInputError(
          `数组替换操作类型不匹配，期望数组类型，但得到: ${typeof value}`,
          'ARRAY_REPLACEMENT_TYPE_MISMATCH',
          { path, expectedType: 'array', receivedType: typeof value, sourcePath }
        )
      }
      handleArrayDistribute(obj, value, originalInput)
      return
    }

    // 处理数组字段分发 [].field
    if (path.startsWith('[].')) {
      const fieldPath = path.substring('[].'.length)
      if (!Array.isArray(obj)) {
        throw new InjectInputError(
          `目标路径 "${path}" 要求目标是数组类型，但得到: ${typeof obj}`,
          'TARGET_NOT_ARRAY',
          { path, targetType: typeof obj, sourcePath }
        )
      }
      
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
          setValueByPath(item, fieldPath, value, originalInput?.[index], sourcePath)
        })
      }
      return
    }

    // 处理数组字段通配符 [*].field  
    if (path.startsWith('[*].')) {
      const fieldPath = path.substring('[*].'.length)
      if (!Array.isArray(obj)) {
        throw new InjectInputError(
          `目标路径 "${path}" 要求目标是数组类型，但得到: ${typeof obj}`,
          'TARGET_NOT_ARRAY',
          { path, targetType: typeof obj, sourcePath }
        )
      }
      obj.forEach((item, index) => {
        setValueByPath(item, fieldPath, value, originalInput?.[index], sourcePath)
      })
      return
    }

    // 处理数组索引 [n].field
    const arrayIndexMatch = path.match(/^\[(\d+)\]\.(.+)/)
    if (arrayIndexMatch) {
      const index = parseInt(arrayIndexMatch[1])
      const fieldPath = arrayIndexMatch[2]
      if (!Array.isArray(obj)) {
        throw new InjectInputError(
          `目标路径 "${path}" 要求目标是数组类型，但得到: ${typeof obj}`,
          'TARGET_NOT_ARRAY',
          { path, targetType: typeof obj, sourcePath }
        )
      }
      
      // 扩展数组到足够长度
      while (obj.length <= index) {
        obj.push({})
      }
      setValueByPath(obj[index], fieldPath, value, originalInput?.[index], sourcePath)
      return
    }

    // 处理数组范围 [start-end].field
    const rangeMatch = path.match(/^\[(\d+)-(\d+)\]\.(.+)/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1])
      const end = parseInt(rangeMatch[2])
      const fieldPath = rangeMatch[3]
      
      if (!Array.isArray(obj)) {
        throw new InjectInputError(
          `目标路径 "${path}" 要求目标是数组类型，但得到: ${typeof obj}`,
          'TARGET_NOT_ARRAY',
          { path, targetType: typeof obj, sourcePath }
        )
      }
      
      for (let i = start; i <= end && i < obj.length; i++) {
        setValueByPath(obj[i], fieldPath, value, originalInput?.[i], sourcePath)
      }
      return
    }

    // 处理多索引 [0,2,4].field
    const multiIndexMatch = path.match(/^\[([0-9,]+)\]\.(.+)/)
    if (multiIndexMatch) {
      const indices = multiIndexMatch[1].split(',').map(s => parseInt(s.trim()))
      const fieldPath = multiIndexMatch[2]
      
      if (!Array.isArray(obj)) {
        throw new InjectInputError(
          `目标路径 "${path}" 要求目标是数组类型，但得到: ${typeof obj}`,
          'TARGET_NOT_ARRAY',
          { path, targetType: typeof obj, sourcePath }
        )
      }
      
      indices.forEach(index => {
        if (index >= 0 && index < obj.length) {
          setValueByPath(obj[index], fieldPath, value, originalInput?.[index], sourcePath)
        }
      })
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
          if (!Array.isArray(current)) {
            throw new InjectInputError(
              `路径 "${path}" 在段 "${segment}" 处期望数组类型，但得到: ${typeof current}`,
              'EXPECTED_ARRAY_TYPE',
              { path, segment, receivedType: typeof current, sourcePath }
            )
          }
          current.forEach((item, index) => {
            setValueByPath(item, remainingPath, value, originalInput?.[index], sourcePath)
          })
          return
        } else if (bracketContent && /^\d+$/.test(bracketContent)) {
          const index = parseInt(bracketContent)
          if (!Array.isArray(current)) {
            throw new InjectInputError(
              `路径 "${path}" 在段 "${segment}" 处期望数组类型，但得到: ${typeof current}`,
              'EXPECTED_ARRAY_TYPE',
              { path, segment, receivedType: typeof current, sourcePath }
            )
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
        if (!Array.isArray(value)) {
          throw new InjectInputError(
            `路径 "${path}" 要求设置数组值，但得到: ${typeof value}`,
            'EXPECTED_ARRAY_VALUE',
            { path, expectedType: 'array', receivedType: typeof value, sourcePath }
          )
        }
        current[propName] = value
      } else if (propName && bracketContent === '*') {
        // obj.prop[*] 语法
        if (!current[propName]) {
          throw new InjectInputError(
            `路径 "${path}" 中的属性 "${propName}" 不存在或不是数组`,
            'PROPERTY_NOT_ARRAY',
            { path, propertyName: propName, sourcePath }
          )
        }
        if (!Array.isArray(current[propName])) {
          throw new InjectInputError(
            `路径 "${path}" 中的属性 "${propName}" 不是数组类型`,
            'PROPERTY_NOT_ARRAY',
            { path, propertyName: propName, propertyType: typeof current[propName], sourcePath }
          )
        }
        current[propName].forEach((_: any, index: number) => {
          current[propName][index] = value
        })
      } else if (propName && bracketContent && /^\d+$/.test(bracketContent)) {
        // obj.prop[index] 语法
        const index = parseInt(bracketContent)
        if (!current[propName]) current[propName] = []
        if (!Array.isArray(current[propName])) {
          throw new InjectInputError(
            `路径 "${path}" 中的属性 "${propName}" 不是数组类型`,
            'PROPERTY_NOT_ARRAY',
            { path, propertyName: propName, propertyType: typeof current[propName], sourcePath }
          )
        }
        while (current[propName].length <= index) {
          current[propName].push({})
        }
        current[propName][index] = value
      } else if (!propName && bracketContent === '*') {
        // [*] 语法（直接数组操作）
        if (!Array.isArray(current)) {
          throw new InjectInputError(
            `路径 "${path}" 要求目标是数组类型，但得到: ${typeof current}`,
            'TARGET_NOT_ARRAY',
            { path, targetType: typeof current, sourcePath }
          )
        }
        current.forEach((_, index) => {
          current[index] = value
        })
      } else if (!propName && bracketContent && /^\d+$/.test(bracketContent)) {
        // [index] 语法
        const index = parseInt(bracketContent)
        if (!Array.isArray(current)) {
          throw new InjectInputError(
            `路径 "${path}" 要求目标是数组类型，但得到: ${typeof current}`,
            'TARGET_NOT_ARRAY',
            { path, targetType: typeof current, sourcePath }
          )
        }
        while (current.length <= index) {
          current.push({})
        }
        current[index] = value
      } else if (!propName && bracketContent === '') {
        // [] 语法（数组分发）
        if (!Array.isArray(value)) {
          throw new InjectInputError(
            `数组分发操作要求值是数组类型，但得到: ${typeof value}`,
            'ARRAY_DISTRIBUTE_VALUE_NOT_ARRAY',
            { path, expectedType: 'array', receivedType: typeof value, sourcePath }
          )
        }
        if (!Array.isArray(current)) {
          throw new InjectInputError(
            `路径 "${path}" 要求目标是数组类型，但得到: ${typeof current}`,
            'TARGET_NOT_ARRAY',
            { path, targetType: typeof current, sourcePath }
          )
        }
        handleArrayDistribute(current, value, originalInput)
      }
    } else {
      // 简单属性设置
      if (current === null) {
        throw new InjectInputError(
          `无法在 null 对象上设置属性 "${lastSegment}"`,
          'CANNOT_SET_PROPERTY_ON_NULL',
          { path, propertyName: lastSegment, sourcePath }
        )
      }
      current[lastSegment] = value
    }
  } catch (error) {
    if (error instanceof InjectInputError) {
      throw error
    }
    throw new InjectInputError(
      `设置路径值时发生错误: ${path}`,
      'SET_VALUE_ERROR',
      { path, sourcePath, originalError: error instanceof Error ? error.message : String(error) }
    )
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
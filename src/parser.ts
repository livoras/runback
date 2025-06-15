/**
 * Ref 参数解析器 - 使用编译原理方法实现
 * 支持 ref.md 中定义的所有语法特性
 */

// ============================================================================
// 词法分析器 (Lexer)
// ============================================================================

enum TokenType {
    // 标识符和字面量
    IDENTIFIER = 'IDENTIFIER',     // 任务ID、字段名
    NUMBER = 'NUMBER',             // 数字
    
    // 操作符
    DOT = 'DOT',                   // .
    COMMA = 'COMMA',               // ,
    DASH = 'DASH',                 // -
    
    // 括号
    LBRACKET = 'LBRACKET',         // [
    RBRACKET = 'RBRACKET',         // ]
    
    // 特殊符号
    WILDCARD = 'WILDCARD',         // *
    
    // 结束符
    EOF = 'EOF'
  }
  
  interface Token {
    type: TokenType;
    value: string;
    position: number;
  }
  
  class Lexer {
    private input: string;
    private position: number = 0;
    private current: string;
  
    constructor(input: string) {
      this.input = input.trim();
      this.current = this.input[0] || '';
    }
  
    private advance(): void {
      this.position++;
      this.current = this.input[this.position] || '';
    }
  
    private skipWhitespace(): void {
      while (this.current && /\s/.test(this.current)) {
        this.advance();
      }
    }
  
    private readIdentifier(): string {
      let result = '';
      while (this.current && /[a-zA-Z0-9_]/.test(this.current)) {
        result += this.current;
        this.advance();
      }
      return result;
    }
  
    private readNumber(): string {
      let result = '';
      while (this.current && /\d/.test(this.current)) {
        result += this.current;
        this.advance();
      }
      return result;
    }
  
    private getLexerContext(): string {
      return this.getErrorContext(this.input, this.position);
    }
  
    private getErrorContext(input: string, position: number): string {
      const start = Math.max(0, position - 10);
      const end = Math.min(input.length, position + 10);
      const before = input.substring(start, position);
      const after = input.substring(position, end);
      return `\n输入内容: "${input}"\n错误位置: "${before}[HERE]${after}"`;
    }
  
    tokenize(): Token[] {
      const tokens: Token[] = [];
  
      while (this.position < this.input.length) {
        this.skipWhitespace();
        
        if (!this.current) break;
  
        const pos = this.position;
  
        if (/[a-zA-Z0-9_]/.test(this.current)) {
          // 统一处理标识符（包括数字开头的任务ID）
          const value = this.readIdentifier();
          tokens.push({ type: TokenType.IDENTIFIER, value, position: pos });
        } else if (this.current === '.') {
          tokens.push({ type: TokenType.DOT, value: '.', position: pos });
          this.advance();
        } else if (this.current === ',') {
          tokens.push({ type: TokenType.COMMA, value: ',', position: pos });
          this.advance();
        } else if (this.current === '-') {
          tokens.push({ type: TokenType.DASH, value: '-', position: pos });
          this.advance();
        } else if (this.current === '[') {
          tokens.push({ type: TokenType.LBRACKET, value: '[', position: pos });
          this.advance();
        } else if (this.current === ']') {
          tokens.push({ type: TokenType.RBRACKET, value: ']', position: pos });
          this.advance();
        } else if (this.current === '*') {
          tokens.push({ type: TokenType.WILDCARD, value: '*', position: pos });
          this.advance();
        } else {
          const context = this.getLexerContext();
          throw new Error(`词法错误: 遇到意外字符 '${this.current}' (ASCII: ${this.current.charCodeAt(0)})。位置: ${this.position}${context}`);
        }
      }
  
      tokens.push({ type: TokenType.EOF, value: '', position: this.position });
      return tokens;
    }
  }
  
  // ============================================================================
  // 抽象语法树 (AST) 节点定义
  // ============================================================================
  
  interface ASTNode {
    type: string;
  }
  
  // 引用表达式节点
  interface ReferenceExpression extends ASTNode {
    type: 'ReferenceExpression';
    taskId: string;
    path: PathExpression[];
  }
  
  // 路径表达式节点
  interface PathExpression extends ASTNode {
    type: 'FieldAccess' | 'ArrayAccess' | 'IndexAccess';
    name?: string;
    indexSpec?: IndexSpecification;
  }
  
  // 索引规范节点
  interface IndexSpecification extends ASTNode {
    type: 'EmptyIndex' | 'WildcardIndex' | 'SingleIndex' | 'MultiIndex' | 'RangeIndex';
    indices?: number[];
    start?: number;
    end?: number;
  }
  
  // 条件引用节点
  interface ConditionalReference extends ASTNode {
    type: 'ConditionalReference';
    alternatives: ReferenceExpression[];
  }
  
  // 键路径表达式节点
  interface KeyPathExpression extends ASTNode {
    type: 'KeyPathExpression';
    segments: KeyPathSegment[];
  }
  
  interface KeyPathSegment extends ASTNode {
    type: 'FieldSegment' | 'ArraySegment';
    name?: string;
    indexSpec?: IndexSpecification;
  }
  
  // ============================================================================
  // 语法分析器 (Parser)
  // ============================================================================
  
  class Parser {
    private tokens: Token[];
    private position: number = 0;
  
    constructor(tokens: Token[]) {
      this.tokens = tokens;
    }
  
    private current(): Token {
      return this.tokens[this.position] || { type: TokenType.EOF, value: '', position: -1 };
    }
  
    private consume(expectedType: TokenType): Token {
      const token = this.current();
      if (token.type !== expectedType) {
        const context = this.getErrorContext();
        throw new Error(`语法错误: 期望 ${expectedType}，但收到 ${token.type}。位置: ${token.position}${context}`);
      }
      this.position++;
      return token;
    }
  
    private getErrorContext(): string {
      if (this.tokens.length === 0) return '';
      
      const input = this.tokens.map(t => t.value).join('');
      const currentPos = this.current().position;
      
      if (currentPos >= 0 && currentPos < input.length) {
        return this.getContextString(input, currentPos);
      }
      
      return `\n输入内容: "${input}"`;
    }
  
    private getContextString(input: string, position: number): string {
      const start = Math.max(0, position - 10);
      const end = Math.min(input.length, position + 10);
      const before = input.substring(start, position);
      const after = input.substring(position, end);
      return `\n输入内容: "${input}"\n错误位置: "${before}[HERE]${after}"`;
    }
  
    private match(type: TokenType): boolean {
      return this.current().type === type;
    }
  
    // 解析条件引用 (备选引用)
    parseConditionalReference(input: string): ConditionalReference {
      const alternatives = input.split(',').map(alt => alt.trim());
      const expressions: ReferenceExpression[] = [];
  
      for (const alternative of alternatives) {
        if (!alternative) continue;
        
        const lexer = new Lexer(alternative);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        expressions.push(parser.parseReferenceExpression());
      }
  
      return {
        type: 'ConditionalReference',
        alternatives: expressions
      };
    }
  
    // 解析引用表达式
    parseReferenceExpression(): ReferenceExpression {
      this.position = 0;
      
      // 必须以任务ID开始
      const taskIdToken = this.consume(TokenType.IDENTIFIER);
      
      // 检查是否只有任务ID没有路径
      if (this.match(TokenType.EOF)) {
        throw new Error(`引用路径格式错误 '${taskIdToken.value}'。正确格式应为 'taskId.field.subfield'，如 '3031.user.name'`);
      }
  
      const path: PathExpression[] = [];
  
      while (!this.match(TokenType.EOF)) {
        if (this.match(TokenType.DOT)) {
          this.consume(TokenType.DOT);
          
          if (this.match(TokenType.EOF)) {
            const context = this.getErrorContext();
            throw new Error(`语法错误: 期望字段名，但遇到了输入结束。${context}`);
          }
          
          if (this.match(TokenType.DOT)) {
            const context = this.getErrorContext();
            throw new Error(`语法错误: 期望字段名，但遇到了连续的点号。${context}`);
          }
          
          const fieldToken = this.consume(TokenType.IDENTIFIER);
          path.push({
            type: 'FieldAccess',
            name: fieldToken.value
          });
        } else if (this.match(TokenType.LBRACKET)) {
          const indexSpec = this.parseIndexSpecification();
          path.push({
            type: indexSpec.type === 'EmptyIndex' ? 'ArrayAccess' : 'IndexAccess',
            indexSpec
          });
        } else {
          const context = this.getErrorContext();
          const token = this.current();
          throw new Error(`语法错误: 遇到意外的标记 ${token.type} (值: "${token.value}")。位置: ${token.position}${context}`);
        }
      }
  
      return {
        type: 'ReferenceExpression',
        taskId: taskIdToken.value,
        path
      };
    }
  
    // 解析索引规范
    parseIndexSpecification(): IndexSpecification {
      this.consume(TokenType.LBRACKET);
  
      if (this.match(TokenType.RBRACKET)) {
        // 空索引 []
        this.consume(TokenType.RBRACKET);
        return { type: 'EmptyIndex' };
      }
  
      if (this.match(TokenType.WILDCARD)) {
        // 通配符索引 [*]
        this.consume(TokenType.WILDCARD);
        this.consume(TokenType.RBRACKET);
        return { type: 'WildcardIndex' };
      }
  
      // 数字索引
      const numbers: number[] = [];
      let hasRange = false;
  
      while (!this.match(TokenType.RBRACKET)) {
        const numToken = this.consume(TokenType.IDENTIFIER);
        const num = parseInt(numToken.value);
        
        if (isNaN(num) || num < 0) {
          const context = this.getErrorContext();
          throw new Error(`语法错误: 无效的数组索引 "${numToken.value}"。数组索引必须是非负整数。位置: ${numToken.position}${context}`);
        }
  
        numbers.push(num);
  
        if (this.match(TokenType.DASH)) {
          // 范围索引 [1-3]
          this.consume(TokenType.DASH);
          const endToken = this.consume(TokenType.IDENTIFIER);
          const end = parseInt(endToken.value);
          
          if (isNaN(end) || end < 0) {
            const context = this.getErrorContext();
            throw new Error(`语法错误: 无效的数组索引范围结束值 "${endToken.value}"。数组索引必须是非负整数。位置: ${endToken.position}${context}`);
          }
  
          this.consume(TokenType.RBRACKET);
          
          return {
            type: 'RangeIndex',
            start: num,
            end: end
          };
        } else if (this.match(TokenType.COMMA)) {
          // 多索引 [0,2,4]
          this.consume(TokenType.COMMA);
        } else if (this.match(TokenType.RBRACKET)) {
          break;
        } else {
          const context = this.getErrorContext();
          const token = this.current();
          throw new Error(`语法错误: 期望 ',' 或 ']'，但收到 ${token.type} (值: "${token.value}")。位置: ${token.position}${context}`);
        }
      }
  
      this.consume(TokenType.RBRACKET);
  
      if (numbers.length === 1) {
        return {
          type: 'SingleIndex',
          indices: numbers
        };
      } else {
        return {
          type: 'MultiIndex',
          indices: numbers
        };
      }
    }
  
    // 解析键路径表达式
    parseKeyPathExpression(keyPath: string): KeyPathExpression {
      const lexer = new Lexer(keyPath);
      const tokens = lexer.tokenize();
      this.tokens = tokens;
      this.position = 0;
  
      const segments: KeyPathSegment[] = [];
  
      while (!this.match(TokenType.EOF)) {
        if (this.match(TokenType.LBRACKET)) {
          // 数组段
          const indexSpec = this.parseIndexSpecification();
          segments.push({
            type: 'ArraySegment',
            indexSpec
          });
  
          // 检查是否有后续字段 - 支持多层嵌套
          while (this.match(TokenType.DOT)) {
            this.consume(TokenType.DOT);
            if (this.match(TokenType.IDENTIFIER)) {
              const fieldToken = this.consume(TokenType.IDENTIFIER);
              segments.push({
                type: 'FieldSegment',
                name: fieldToken.value
              });
            } else {
              break;
            }
          }
        } else if (this.match(TokenType.IDENTIFIER)) {
          // 字段段
          const fieldToken = this.consume(TokenType.IDENTIFIER);
          segments.push({
            type: 'FieldSegment',
            name: fieldToken.value
          });
  
          if (this.match(TokenType.DOT)) {
            this.consume(TokenType.DOT);
          }
        } else {
          const context = this.getErrorContext();
          const token = this.current();
          throw new Error(`语法错误: 键路径中遇到意外的标记 ${token.type} (值: "${token.value}")。位置: ${token.position}${context}`);
        }
      }
  
      return {
        type: 'KeyPathExpression',
        segments
      };
    }
  }
  
  // ============================================================================
  // 语义分析器 (Semantic Analyzer)
  // ============================================================================
  
  class SemanticAnalyzer {
    // 验证引用表达式的语义正确性
    validateReferenceExpression(ast: ReferenceExpression, context: Record<string, any>): void {
      // 检查任务ID是否存在
      if (!context[ast.taskId]) {
        const availableTaskIds = Object.keys(context);
        const suggestion = availableTaskIds.length > 0 
          ? `\n建议检查以下可用的任务ID: [${availableTaskIds.join(', ')}]`
          : '\n当前上下文中没有任何可用的任务结果';
        const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
        throw new Error(`引用错误: 任务 '${ast.taskId}' 的执行结果未找到。${suggestion}\n引用路径: ${refPath}`);
      }
  
      // 检查路径的语义正确性
      let current = context[ast.taskId];
      const pathTrace = [ast.taskId];
  
      for (const pathExpr of ast.path) {
        if (current === null || current === undefined) {
          const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
          throw new Error(`引用错误: 路径 '${pathTrace.join('.')}' 的值为 ${current}，无法继续访问后续字段。\n完整引用路径: ${refPath}\n建议: 检查数据结构或使用条件引用语法`);
        }
  
        if (pathExpr.type === 'FieldAccess') {
          if (typeof current !== 'object' || Array.isArray(current)) {
            const actualType = Array.isArray(current) ? 'array' : typeof current;
            const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
            throw new Error(`类型错误: 无法访问字段 '${pathExpr.name}'，因为当前值不是对象。\n实际类型: ${actualType}\n当前路径: ${pathTrace.join('.')}\n完整引用路径: ${refPath}\n建议: 检查数据结构，确保路径指向一个对象`);
          }
          
          if (current[pathExpr.name!] === undefined) {
            const availableFields = Object.keys(current);
            const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
            const suggestion = availableFields.length > 0 
              ? `\n可用字段: [${availableFields.join(', ')}]`
              : '\n当前对象没有任何字段';
            throw new Error(`字段错误: 字段 '${pathExpr.name}' 不存在。${suggestion}\n当前路径: ${pathTrace.join('.')}\n完整引用路径: ${refPath}\n建议: 检查字段名拼写或数据结构`);
          }
          
          current = current[pathExpr.name!];
          pathTrace.push(pathExpr.name!);
        } else if (pathExpr.type === 'ArrayAccess') {
          if (!Array.isArray(current)) {
            const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
            throw new Error(`类型错误: 无法进行数组映射，因为当前值不是数组。\n实际类型: ${typeof current}\n当前路径: ${pathTrace.join('.')}\n完整引用路径: ${refPath}\n建议: 确保路径指向一个数组，或使用字段访问语法`);
          }
          // 对于数组映射，我们不需要进一步验证，因为会在运行时处理
          pathTrace.push('[]');
          // 跳过数组映射后续的验证，因为元素结构可能不同
          return;
        } else if (pathExpr.type === 'IndexAccess') {
          if (!Array.isArray(current)) {
            const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
            throw new Error(`类型错误: 无法进行数组索引访问，因为当前值不是数组。\n实际类型: ${typeof current}\n当前路径: ${pathTrace.join('.')}\n完整引用路径: ${refPath}\n建议: 确保路径指向一个数组`);
          }
          
          const indexSpec = pathExpr.indexSpec!;
          if (indexSpec.type === 'SingleIndex' || indexSpec.type === 'MultiIndex') {
            for (const index of indexSpec.indices!) {
              if (index < 0 || index >= current.length) {
                const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
                throw new Error(`索引错误: 数组索引 ${index} 超出范围。\n数组长度: ${current.length}\n有效索引范围: 0-${current.length - 1}\n当前路径: ${pathTrace.join('.')}\n完整引用路径: ${refPath}`);
              }
            }
            // 对于单个索引，更新 current 为索引对应的值
            if (indexSpec.type === 'SingleIndex') {
              current = current[indexSpec.indices![0]];
            }
          } else if (indexSpec.type === 'RangeIndex') {
            if (indexSpec.start! < 0 || indexSpec.end! >= current.length) {
              const refPath = `${ast.taskId}.${ast.path.map(p => p.name || '[]').join('.')}`;
              throw new Error(`索引错误: 数组索引范围 ${indexSpec.start}-${indexSpec.end} 超出范围。\n数组长度: ${current.length}\n有效索引范围: 0-${current.length - 1}\n当前路径: ${pathTrace.join('.')}\n完整引用路径: ${refPath}`);
            }
          }
          
          pathTrace.push(`[${this.formatIndexSpec(indexSpec)}]`);
        }
      }
    }
  
    private formatIndexSpec(indexSpec: IndexSpecification): string {
      switch (indexSpec.type) {
        case 'EmptyIndex': return '';
        case 'WildcardIndex': return '*';
        case 'SingleIndex': return indexSpec.indices![0].toString();
        case 'MultiIndex': return indexSpec.indices!.join(',');
        case 'RangeIndex': return `${indexSpec.start}-${indexSpec.end}`;
        default: return '';
      }
    }
  
    // 格式化引用表达式为字符串
    formatReferenceExpression(ast: ReferenceExpression): string {
      const pathStr = ast.path.map(p => {
        if (p.type === 'FieldAccess') {
          return `.${p.name}`;
        } else if (p.type === 'ArrayAccess') {
          return '[]';
        } else if (p.type === 'IndexAccess') {
          return `[${this.formatIndexSpec(p.indexSpec!)}]`;
        }
        return '';
      }).join('');
      
      return ast.taskId + pathStr;
    }
  }
  
  // ============================================================================
  // 执行器 (Executor)
  // ============================================================================
  
  class Executor {
    private context: Record<string, any>;
    private semanticAnalyzer: SemanticAnalyzer;
  
    constructor(context: Record<string, any>) {
      this.context = context;
      this.semanticAnalyzer = new SemanticAnalyzer();
    }
  
    // 执行条件引用
    executeConditionalReference(ast: ConditionalReference): any {
      const errors: string[] = [];
      
      for (let i = 0; i < ast.alternatives.length; i++) {
        const alternative = ast.alternatives[i];
        try {
          const value = this.executeReferenceExpression(alternative);
          if (value !== undefined && value !== null) {
            return value;
          }
          errors.push(`备选项 ${i + 1} '${this.semanticAnalyzer.formatReferenceExpression(alternative)}': 返回值为空`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`备选项 ${i + 1} '${this.semanticAnalyzer.formatReferenceExpression(alternative)}': ${errorMessage}`);
        }
      }
  
      return undefined;
    }
  
    // 执行引用表达式
    executeReferenceExpression(ast: ReferenceExpression): any {
      // 语义验证
      this.semanticAnalyzer.validateReferenceExpression(ast, this.context);
  
      let current = this.context[ast.taskId];
      const pathTrace = [ast.taskId];
  
      // 检查是否包含数组映射
      const hasArrayMapping = ast.path.some(p => p.type === 'ArrayAccess');
      if (hasArrayMapping) {
        return this.executeArrayMapping(ast);
      }
  
      // 普通路径执行
      for (const pathExpr of ast.path) {
        current = this.executePathExpression(current, pathExpr, pathTrace);
      }
  
      return current;
    }
  
    // 执行路径表达式
    private executePathExpression(current: any, pathExpr: PathExpression, pathTrace: string[]): any {
      if (pathExpr.type === 'FieldAccess') {
        pathTrace.push(pathExpr.name!);
        return current[pathExpr.name!];
      } else if (pathExpr.type === 'ArrayAccess') {
        pathTrace.push('[]');
        return current; // 返回整个数组用于后续映射
      } else if (pathExpr.type === 'IndexAccess') {
        const indexSpec = pathExpr.indexSpec!;
        return this.executeIndexAccess(current, indexSpec, pathTrace);
      }
      
      throw new Error(`内部错误: 未知的路径表达式类型 "${(pathExpr as any).type}"。\n这可能是一个程序错误，请联系开发者。\n路径跟踪: ${pathTrace.join('.')}`);
    }
  
    // 执行索引访问
    private executeIndexAccess(current: any[], indexSpec: IndexSpecification, pathTrace: string[]): any {
      const indices = this.expandIndexSpec(indexSpec);
      
      if (indexSpec.type === 'SingleIndex') {
        pathTrace.push(`[${indices[0]}]`);
        return current[indices[0]];
      }
      
      return indices.map(i => current[i]);
    }
  
    // 执行数组映射
    private executeArrayMapping(ast: ReferenceExpression): any {
      const arrayAccessIndex = ast.path.findIndex(p => p.type === 'ArrayAccess');
      
      // 分割路径：前缀 + 数组访问 + 后缀
      const prefixPath = ast.path.slice(0, arrayAccessIndex);
      const suffixPath = ast.path.slice(arrayAccessIndex + 1);
      
      // 执行前缀路径，获取数组
      let current = this.context[ast.taskId];
      const pathTrace = [ast.taskId];
      
      for (const pathExpr of prefixPath) {
        current = this.executePathExpression(current, pathExpr, pathTrace);
      }
      
      if (!Array.isArray(current)) {
        const refPath = this.semanticAnalyzer.formatReferenceExpression(ast);
        throw new Error(`执行错误: 数组映射失败，期望数组但收到 ${typeof current}。\n引用路径: ${refPath}\n当前路径: ${pathTrace.join('.')}\n建议: 检查数据结构，确保路径指向一个数组`);
      }
      
      // 如果没有后缀路径，直接返回数组
      if (suffixPath.length === 0) {
        return current;
      }
      
      // 对数组中的每个元素执行后缀路径
      return current.map((item, index) => {
        let itemCurrent = item;
        const itemPathTrace = [...pathTrace, `[${index}]`];
        
        try {
          for (const pathExpr of suffixPath) {
            itemCurrent = this.executePathExpression(itemCurrent, pathExpr, itemPathTrace);
          }
          
          return itemCurrent;
        } catch (error) {
          // 如果某个数组元素处理失败，抛出异常
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`数组映射错误: 处理数组元素 [${index}] 时失败。\n错误详情: ${errorMessage}\n当前路径: ${itemPathTrace.join('.')}\n建议: 检查数组元素的数据结构是否一致`);
        }
      });
    }
  
    // 设置嵌套值
    setNestedValue(target: any, keyPathExpr: KeyPathExpression, value: any): any {
      if (keyPathExpr.segments.length === 0) {
        return value;
      }
  
      // 检查是否是数组操作
      const firstSegment = keyPathExpr.segments[0];
      if (firstSegment.type === 'ArraySegment') {
        return this.executeArrayOperation(target, keyPathExpr, value);
      }
  
      // 普通嵌套操作
      return this.executeNestedOperation(target, keyPathExpr, value);
    }
  
    // 执行数组操作
    private executeArrayOperation(target: any, keyPathExpr: KeyPathExpression, value: any): any {
      const arraySegment = keyPathExpr.segments[0] as KeyPathSegment;
      const indexSpec = arraySegment.indexSpec!;
  
      if (indexSpec.type === 'EmptyIndex') {
        // 整体数组替换 []
        if (keyPathExpr.segments.length === 1) {
          return Array.isArray(value) ? [...value] : value;
        }
  
        // 数组字段映射 [].field
        if (keyPathExpr.segments.length > 1 && Array.isArray(value)) {
          if (!Array.isArray(target)) {
            target = [];
          }
  
          // 确保目标数组有足够长度
          while (target.length < value.length) {
            target.push({});
          }
  
          // 设置字段值
          const fieldPath = keyPathExpr.segments.slice(1);
          value.forEach((item, index) => {
            if (!target[index]) target[index] = {};
            target[index] = this.setNestedFieldValue(target[index], fieldPath, item);
          });
  
          return target;
        }
      } else if (indexSpec.type === 'WildcardIndex') {
        // 通配符数组操作 [*].field
        if (!Array.isArray(target)) {
          throw new Error(`执行错误: 通配符数组操作 [*] 的目标必须是数组，但收到: ${typeof target}。\n建议: 确保目标是一个数组，或使用其他操作语法`);
        }
  
        const fieldPath = keyPathExpr.segments.slice(1);
        target.forEach((item, index) => {
          if (item && typeof item === 'object') {
            target[index] = this.setNestedFieldValue(item, fieldPath, value);
          }
        });
  
        return target;
      } else {
        // 特定索引操作 [0], [0,2,4], [1-3]
        if (!Array.isArray(target)) {
          target = [];
        }
  
        const indices = this.expandIndexSpec(indexSpec);
        const fieldPath = keyPathExpr.segments.slice(1);
  
        for (const index of indices) {
          // 确保数组长度足够
          while (target.length <= index) {
            target.push(fieldPath.length > 0 ? {} : null);
          }
  
          if (fieldPath.length > 0) {
            if (!target[index]) target[index] = {};
            target[index] = this.setNestedFieldValue(target[index], fieldPath, value);
          } else {
            target[index] = value;
          }
        }
  
        return target;
      }
  
      return target;
    }
  
    // 执行嵌套操作
    private executeNestedOperation(target: any, keyPathExpr: KeyPathExpression, value: any): any {
      if (!target) target = {};
  
      let current = target;
      const segments = keyPathExpr.segments;
  
      // 创建嵌套路径
      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        if (segment.type === 'FieldSegment') {
          if (!current[segment.name!] || typeof current[segment.name!] !== 'object') {
            current[segment.name!] = {};
          }
          current = current[segment.name!];
        }
      }
  
      // 设置最终值
      const lastSegment = segments[segments.length - 1];
      if (lastSegment.type === 'FieldSegment') {
        current[lastSegment.name!] = value;
      }
  
      return target;
    }
  
    // 设置嵌套字段值
    private setNestedFieldValue(target: any, fieldPath: KeyPathSegment[], value: any): any {
      if (fieldPath.length === 0) return value;
      if (!target) target = {};
  
      let current = target;
  
      // 创建中间路径
      for (let i = 0; i < fieldPath.length - 1; i++) {
        const segment = fieldPath[i];
        if (segment.type === 'FieldSegment') {
          if (!current[segment.name!]) {
            current[segment.name!] = {};
          }
          current = current[segment.name!];
        }
      }
  
      // 设置最终值
      const lastSegment = fieldPath[fieldPath.length - 1];
      if (lastSegment.type === 'FieldSegment') {
        current[lastSegment.name!] = value;
      }
  
      return target;
    }
  
    // 展开索引规范
    private expandIndexSpec(indexSpec: IndexSpecification): number[] {
      switch (indexSpec.type) {
        case 'SingleIndex':
        case 'MultiIndex':
          return indexSpec.indices!;
          
        case 'RangeIndex':
          const result = [];
          for (let i = indexSpec.start!; i <= indexSpec.end!; i++) {
            result.push(i);
          }
          return result;
          
        default:
          return [];
      }
    }
  
  
  }
  
  // ============================================================================
  // 主接口函数
  // ============================================================================
  
  /**
   * 解析 ref 参数，将引用表达式转换为实际的输入数据
   * @param context 之前的运行结果 {taskId: result, ...}
   * @param ref ref 引用定义
   * @returns 解析后的 input 数据
   */
  export function parseRefToInput(context: Record<string, any>, ref: Record<string, string>): any {
    // 输入参数验证
    if (!context || typeof context !== 'object') {
      throw new Error(`参数错误: context 参数无效。\n期望: 一个包含任务执行结果的对象\n实际收到: ${typeof context}\n示例: { "3031": { user: { name: "张三" } } }`);
    }
  
    if (!ref || typeof ref !== 'object') {
      throw new Error(`参数错误: ref 参数无效。\n期望: 一个包含引用映射的对象\n实际收到: ${typeof ref}\n示例: { "userName": "3031.user.name" }`);
    }
  
    if (Object.keys(ref).length === 0) {
      throw new Error(`参数错误: ref 参数为空对象。\n建议: 提供至少一个引用映射，如 { "field": "taskId.path" }`);
    }
  
        let result: any = {};
    const executor = new Executor(context);
    const parser = new Parser([]);

    // 检查是否使用了整体替换语法 "*"
    if (ref['*']) {
      try {
        const resolvedValue = resolveReference(context, ref['*']);
        // 整体替换允许返回任何值，包括 null、undefined、空对象等
        return resolvedValue;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`整体替换失败: 无法解析引用 '*: ${ref['*']}'。\n错误详情: ${errorMessage}\n建议: 检查引用表达式语法和数据结构是否正确`);
      }
    }

    // 先处理数组初始化相关的映射
    const arrayMappings: Array<[string, any]> = [];
    const objectMappings: Array<[string, any]> = [];
    
    for (const [keyPath, refExpression] of Object.entries(ref)) {
      if (!refExpression || typeof refExpression !== 'string') {
        throw new Error(`参数错误: 引用表达式无效 - 键 '${keyPath}' 对应的值必须是字符串，但收到: ${typeof refExpression}。\n建议: 确保所有引用表达式都是有效的字符串格式，如 "taskId.field.subfield"`);
      }

      try {
        const resolvedValue = resolveReference(context, refExpression);
        if (resolvedValue !== undefined) {
          if (keyPath.startsWith('[')) {
            arrayMappings.push([keyPath, resolvedValue]);
          } else {
            objectMappings.push([keyPath, resolvedValue]);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`引用解析失败: 无法解析引用 '${keyPath}: ${refExpression}'。\n错误详情: ${errorMessage}\n建议: 检查引用表达式语法和数据结构是否正确`);
      }
    }
  
    // 先处理数组映射
    for (const [keyPath, value] of arrayMappings) {
      try {
        const keyPathExpr = parser.parseKeyPathExpression(keyPath);
        result = executor.setNestedValue(result, keyPathExpr, value);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`数组映射失败: 无法设置数组映射 '${keyPath}'。\n错误详情: ${errorMessage}\n建议: 检查键路径语法和数据结构是否正确`);
      }
    }
  
    // 再处理对象映射
    for (const [keyPath, value] of objectMappings) {
      try {
        const keyPathExpr = parser.parseKeyPathExpression(keyPath);
        result = executor.setNestedValue(result, keyPathExpr, value);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`对象映射失败: 无法设置对象映射 '${keyPath}'。\n错误详情: ${errorMessage}\n建议: 检查键路径语法和数据结构是否正确`);
      }
    }
  
    return result;
  }
  
  /**
   * 解析单个引用表达式，支持备选引用
   * @param context 运行上下文
   * @param refExpression 引用表达式，如 "3031.user.name" 或 "3031.primary,2048.backup"
   * @returns 解析后的值
   */
  function resolveReference(context: Record<string, any>, refExpression: string): any {
    if (!refExpression) {
      throw new Error(`resolveReference: 引用表达式不能为空`);
    }
  
    // 处理备选引用（条件引用）
    if (refExpression.includes(',')) {
      const alternatives = refExpression.split(',').map(s => s.trim());
      const errors: string[] = [];
      
      for (let i = 0; i < alternatives.length; i++) {
        const alternative = alternatives[i];
        try {
          const value = resolveSingleReference(context, alternative);
          // 只要不是 undefined 就返回，包括 null、空字符串、0、false 等
          if (value !== undefined) {
            return value;
          }
          errors.push(`备选项 ${i + 1} '${alternative}': 返回值为 undefined`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`备选项 ${i + 1} '${alternative}': ${errorMessage}`);
          // 继续尝试下一个备选项，不要 return
        }
      }
  
      throw new Error(`备选引用失败: 所有引用备选项都解析失败 '${refExpression}'\n详细错误:\n${errors.map(e => `  - ${e}`).join('\n')}\n建议: 检查所有备选引用表达式的语法和数据结构`);
    }
  
    return resolveSingleReference(context, refExpression);
  }
  
  function resolveSingleReference(context: Record<string, any>, refPath: string): any {
    if (!refPath || typeof refPath !== 'string') {
      throw new Error(`参数错误: 引用路径无效。\n期望: 字符串格式的引用路径\n实际收到: ${typeof refPath}\n示例: "3031.user.name"`);
    }
  
    try {
      const lexer = new Lexer(refPath);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parseReferenceExpression();
      
      const executor = new Executor(context);
      return executor.executeReferenceExpression(ast);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`解析失败: 引用路径 '${refPath}' 解析时发生错误。\n错误详情: ${errorMessage}\n建议: 检查引用路径语法是否正确，格式应为 'taskId.field.subfield'`);
    }
  } 
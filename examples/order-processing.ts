import { Workflow } from '../src/work';
import { LogLevel } from '../src/logger';

/**
 * 电商订单处理业务流示例
 * 这个示例展示了一个复杂的电商订单处理流程，包含：
 * - 条件控制：订单验证、库存检查、支付方式选择
 * - 迭代处理：处理多个订单项、多个配送地址
 * - 不同长度的 fork/join：并行处理订单验证和用户信息、多路径支付处理
 */

// 模拟数据库和外部服务
export const mockDatabase = {
  products: {
    'p001': { id: 'p001', name: '智能手机', price: 4999, stock: 10 },
    'p002': { id: 'p002', name: '笔记本电脑', price: 8999, stock: 5 },
    'p003': { id: 'p003', name: '无线耳机', price: 999, stock: 20 },
    'p004': { id: 'p004', name: '智能手表', price: 1999, stock: 0 },
  },
  users: {
    'u001': { 
      id: 'u001', 
      name: '张三', 
      vip: true, 
      addresses: [
        { id: 'a001', province: '广东', city: '深圳', detail: '南山区科技园' },
        { id: 'a002', province: '广东', city: '广州', detail: '天河区体育西路' }
      ],
      paymentMethods: ['wechat', 'alipay', 'creditcard']
    }
  },
  logistics: {
    providers: [
      { id: 'l001', name: '顺丰速运', supportedProvinces: ['广东', '北京', '上海'] },
      { id: 'l002', name: '中通快递', supportedProvinces: ['全国'] },
      { id: 'l003', name: '京东物流', supportedProvinces: ['广东', '北京', '浙江'] }
    ]
  }
};

// 模拟外部服务API
// 支付网关
export const mockPaymentGateways = {
    wechat: async (amount: number) => ({ success: true, transactionId: `wx_${Date.now()}` }),
    alipay: async (amount: number) => ({ success: true, transactionId: `alipay_${Date.now()}` }),
    creditcard: async (amount: number) => {
      // 模拟信用卡偶尔失败
      const success = Math.random() > 0.3;
      return { 
        success, 
        transactionId: success ? `cc_${Date.now()}` : null,
        error: success ? null : '信用卡支付失败，请重试'
      };
    }
};

// 物流服务
export const mockLogistics = {
    createShipment: async (provider: string, address: any, items: any[]) => ({
      trackingNumber: `${provider}_${Date.now()}`,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3天后
    })
};

// 通知服务
export const mockNotification = {
    sendEmail: async (to: string, subject: string, content: string) => true,
    sendSMS: async (phone: string, content: string) => true
};

// 定义业务动作
export const orderProcessingActions = {
  // 获取订单信息
  getOrderInfo: async ({ orderId }) => {
    console.log(`获取订单信息: ${orderId}`);
    return {
      id: orderId,
      userId: 'u001',
      items: [
        { productId: 'p001', quantity: 1 },
        { productId: 'p002', quantity: 1 },
        { productId: 'p003', quantity: 2 }
      ],
      totalAmount: 0, // 将在后续步骤计算
      addressId: 'a001',
      paymentMethod: 'creditcard',
      createTime: new Date()
    };
  },
  
  // 获取用户信息
  getUserInfo: async ({ userId }) => {
    console.log(`获取用户信息: ${userId}`);
    return mockDatabase.users[userId];
  },
  
  // 验证订单
  validateOrder: async ({ order }) => {
    console.log(`验证订单: ${order.id}`);
    const isValid = order && order.items && order.items.length > 0;
    return isValid;
  },
  
  // 检查商品库存
  checkInventory: async ({ items }: { items: Array<{ productId: string; quantity: number }> }) => {
    console.log(`检查库存: ${items.length} 个商品`);
    let allInStock = true;
    for (const item of items) {
      const product = mockDatabase.products[item.productId];
      const inStock = product && product.stock >= item.quantity;
      if (!inStock) allInStock = false;
    }
    return allInStock;
  },
  
  // 计算订单金额
  calculateAmount: async ({ items, user }: { 
    items: Array<{ productId: string; quantity: number }>; 
    user: { vip: boolean } 
  }) => {
    console.log(`计算订单金额: ${items.length} 个商品`);
    let subtotal = 0;
    const itemDetails: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      itemTotal: number;
    }> = [];
    
    for (const item of items) {
      const product = mockDatabase.products[item.productId];
      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;
      
      itemDetails.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        itemTotal
      });
    }
    
    // VIP用户享受95折
    const discount = user.vip ? 0.05 : 0;
    const discountAmount = Math.round(subtotal * discount);
    const totalAmount = subtotal - discountAmount;
    
    return {
      subtotal,
      discount,
      discountAmount,
      totalAmount,
      itemDetails
    };
  },
  
  // 处理单个商品
  processItem: async ({ item, index }) => {
    console.log(`处理商品 #${index + 1}: ${item.name} x ${item.quantity}`);
    return {
      processed: true,
      itemId: item.productId,
      processingTime: new Date()
    };
  },
  
  // 获取用户地址
  getAddress: async ({ user, addressId }) => {
    console.log(`获取用户地址: ${addressId}`);
    return user.addresses.find(addr => addr.id === addressId);
  },
  
  // 选择物流提供商
  selectLogistics: async ({ address }) => {
    console.log(`为地址选择物流: ${address.province} ${address.city}`);
    // 根据地址选择合适的物流
    const availableProviders = mockDatabase.logistics.providers.filter(p => 
      p.supportedProvinces.includes('全国') || p.supportedProvinces.includes(address.province)
    );
    
    return {
      availableProviders,
      selectedProvider: availableProviders[0] // 简单起见，选择第一个
    };
  },
  
  // 处理支付
  processPayment: async ({ method, amount, user }) => {
    console.log(`处理支付: ${method}, 金额: ${amount}`);
    if (!user.paymentMethods.includes(method)) {
      return false;
    }
    const result = await mockPaymentGateways[method](amount);
    return !!result.success;
  },
  
  // 备选支付处理
  fallbackPayment: async ({ amount, user }) => {
    console.log(`尝试备选支付方式`);
    for (const method of user.paymentMethods) {
      if (method !== 'creditcard') {
        const result = await mockPaymentGateways[method](amount);
        if (result.success) {
          return true;
        }
      }
    }
    return false;
  },
  
  // 创建物流订单
  createShipment: async ({ provider, address, items }) => {
    console.log(`创建物流订单: ${provider.name}, 地址: ${address.province} ${address.city}`);
    return await mockLogistics.createShipment(provider.id, address, items);
  },
  
  // 更新库存
  updateInventory: async ({ items }: { items: Array<{ productId: string; quantity: number }> }) => {
    console.log(`更新库存: ${items.length} 个商品`);
    const updates: Array<{
      productId: string;
      newStock: number;
      updateTime: Date;
    }> = [];
    
    for (const item of items) {
      const product = mockDatabase.products[item.productId];
      product.stock -= item.quantity;
      
      updates.push({
        productId: item.productId,
        newStock: product.stock,
        updateTime: new Date()
      });
    }
    
    return { success: true, updates };
  },
  
  // 发送订单确认通知
  sendOrderConfirmation: async ({ order, user, payment, shipment }) => {
    console.log(`发送订单确认通知给用户: ${user.name}`);
    
    const emailContent = `
      尊敬的${user.name}，您的订单 ${order.id} 已确认。
      支付金额: ${payment.amount}
      支付方式: ${payment.method}
      物流信息: ${shipment.trackingNumber}
      预计送达: ${shipment.estimatedDelivery}
    `;
    
    await mockNotification.sendEmail(user.email || 'user@example.com', '订单确认', emailContent);
    return { notificationSent: true, time: new Date() };
  },
  
  // 记录订单完成
  finalizeOrder: async ({ order, payment, shipment, inventory }) => {
    console.log(`完成订单: ${order.id}`);
    
    return {
      orderId: order.id,
      status: 'COMPLETED',
      paymentId: payment.transactionId,
      shipmentTracking: shipment.trackingNumber,
      completionTime: new Date()
    };
  },
  
  // 处理订单失败
  handleOrderFailure: async ({ order, reason }) => {
    console.log(`订单失败: ${order.id}, 原因: ${reason}`);
    
    return {
      orderId: order.id,
      status: 'FAILED',
      reason,
      failureTime: new Date()
    };
  }
};

// 创建订单处理工作流
export const orderProcessingWorkflow = new Workflow({
  steps: [
    // 获取基础信息 - 并行执行 (fork)
    { id: "getOrder", action: "getOrderInfo", options: { orderId: "ORD12345" } },
    { id: "getUser", action: "getUserInfo", options: { userId: "$ref.getOrder.userId" } },
    
    // 订单验证 - 条件分支 (if)
    { 
      id: "validateOrder", 
      action: "validateOrder", 
      options: { order: "$ref.getOrder" },
      type: "if"
    },
    
    // 如果订单无效，处理失败
    { 
      id: "handleInvalidOrder", 
      action: "handleOrderFailure", 
      options: { 
        order: "$ref.getOrder", 
        reason: "$ref.validateOrder.reason" 
      },
      depends: ["validateOrder.false"]
    },
    
    // 检查库存 - 条件分支 (if)
    { 
      id: "checkInventory", 
      action: "checkInventory", 
      options: { items: "$ref.getOrder.items" },
      depends: ["validateOrder.true"],
      type: "if" 
    },
    
    // 如果库存不足，处理失败
    { 
      id: "handleInsufficientInventory", 
      action: "handleOrderFailure", 
      options: { 
        order: "$ref.getOrder", 
        reason: "库存不足" 
      },
      depends: ["checkInventory.false"]
    },
    
    // 计算订单金额
    { 
      id: "calculateAmount", 
      action: "calculateAmount", 
      options: { 
        items: "$ref.getOrder.items", 
        user: "$ref.getUser" 
      },
      depends: ["checkInventory.true"]
    },
    
    // 处理每个订单项 - 迭代处理 (each)
    { 
      id: "processItems", 
      action: "processItem", 
      options: { 
        item: "$ref.$item", 
        index: "$ref.$index" 
      },
      each: "$ref.calculateAmount.itemDetails",
      depends: ["calculateAmount"]
    },
    
    // 获取配送地址
    { 
      id: "getAddress", 
      action: "getAddress", 
      options: { 
        user: "$ref.getUser", 
        addressId: "$ref.getOrder.addressId" 
      },
      depends: ["getUser"]
    },
    
    // 选择物流
    { 
      id: "selectLogistics", 
      action: "selectLogistics", 
      options: { address: "$ref.getAddress" },
      depends: ["getAddress"]
    },
    
    // 处理支付 - 条件分支 (if)
    { 
      id: "processPayment", 
      action: "processPayment", 
      options: { 
        method: "$ref.getOrder.paymentMethod", 
        amount: "$ref.calculateAmount.totalAmount",
        user: "$ref.getUser"
      },
      depends: ["calculateAmount"],
      type: "if"
    },
    
    // 如果主要支付方式失败，尝试备选支付 - 条件分支 (if)
    { 
      id: "fallbackPayment", 
      action: "fallbackPayment", 
      options: { 
        amount: "$ref.calculateAmount.totalAmount",
        user: "$ref.getUser"
      },
      depends: ["processPayment.false"],
      type: "if"
    },
    
    // 如果所有支付方式都失败，处理订单失败
    { 
      id: "handlePaymentFailure", 
      action: "handleOrderFailure", 
      options: { 
        order: "$ref.getOrder", 
        reason: "支付失败" 
      },
      depends: ["fallbackPayment.false"]
    },
    
    // 创建物流订单 - 支付成功后的步骤 (join)
    { 
      id: "createShipment", 
      action: "createShipment", 
      options: { 
        provider: "$ref.selectLogistics.selectedProvider", 
        address: "$ref.getAddress", 
        items: "$ref.calculateAmount.itemDetails" 
      },
      depends: [
        "processPayment.true", // 主支付成功
        "fallbackPayment.true" // 或备选支付成功
      ]
    },
    
    // 更新库存 - 并行执行 (fork)
    { 
      id: "updateInventory", 
      action: "updateInventory", 
      options: { items: "$ref.getOrder.items" },
      depends: ["createShipment"]
    },
    
    // 发送订单确认 - 并行执行 (fork)
    { 
      id: "sendConfirmation", 
      action: "sendOrderConfirmation", 
      options: { 
        order: "$ref.getOrder", 
        user: "$ref.getUser", 
        payment: {
          amount: "$ref.calculateAmount.totalAmount",
          method: "$ref.processPayment.success ? $ref.getOrder.paymentMethod : $ref.fallbackPayment.method",
          transactionId: "$ref.processPayment.success ? $ref.processPayment.transactionId : $ref.fallbackPayment.transactionId"
        },
        shipment: "$ref.createShipment"
      },
      depends: ["createShipment"]
    },
    
    // 完成订单 - 最终步骤 (join)
    { 
      id: "finalizeOrder", 
      action: "finalizeOrder", 
      options: { 
        order: "$ref.getOrder", 
        payment: {
          transactionId: "$ref.processPayment.success ? $ref.processPayment.transactionId : $ref.fallbackPayment.transactionId"
        },
        shipment: "$ref.createShipment",
        inventory: "$ref.updateInventory"
      },
      depends: ["updateInventory", "sendConfirmation"]
    }
  ]
}, LogLevel.DEBUG); // 设置日志级别为 DEBUG

// 执行工作流
console.log("=== 开始处理订单 ===");
try {
  orderProcessingWorkflow.run({
    actions: orderProcessingActions,
    entry: "getOrder" // 从获取订单开始
  });
  console.log("=== 订单处理完成 ===");
} catch (error) {
  console.error("订单处理失败:", error);
}

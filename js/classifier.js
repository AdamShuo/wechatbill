/**
 * 微信账单分析器 - 智能分类模块（v2.0）
 * Version: 1.1.13
 * 
 * 双层分类策略：
 * 第1层：基于交易类型（transactionType）直接映射 → 使用 TypeManager 知识库
 * 第2层：对于"商户消费"/"扫二维码付款"等通用类型 → 根据交易对方关键词二次分类
 * 第3层：兜底 → 关键词匹配 + 收/支方向
 */

const Classifier = {
    // 自定义分类规则（用户添加的，用于第2/3层匹配）
    customRules: [],

    // ★ v1.1.2: 规则版本号，与app版本同步。当版本不匹配时强制重新同步。
    RULES_VERSION: '1.1.6',

    /**
     * 初始化：加载用户自定义分类规则
     * v1.1.2: 增加版本检查，旧版规则自动丢弃并重新从TypeManager同步
     */
    init() {
        try {
            const savedRules = Utils.loadFromStorage('classifier_rules');
            const savedVersion = Utils.loadRawFromStorage('classifier_rules_version');

            // ★ v1.1.2: 版本检查 —— 如果保存的规则版本与当前代码版本不一致，丢弃旧规则
            if (savedRules && Array.isArray(savedRules) && savedRules.length > 0
                && savedVersion === this.RULES_VERSION) {
                this.customRules = savedRules;
                console.log('分类器已加载用户规则 (' + savedRules.length + '条), 版本=' + savedVersion);
            } else {
                if (savedRules && savedVersion !== this.RULES_VERSION) {
                    console.warn('检测到旧版分类规则 (v' + savedVersion + ')，已自动升级为 v' + this.RULES_VERSION);
                } else {
                    console.log('未发现已保存的分类规则，从TypeManager同步初始化');
                }
                this.syncFromTypeManager();
            }
        } catch (e) {
            console.error('分类器初始化失败:', e);
            this.syncFromTypeManager();
        }
    },

    /**
     * 从 TypeManager 同步子分类关键词到 customRules
     */
    syncFromTypeManager() {
        const subKeywords = TypeManager.subCategoryKeywords;
        this.customRules = [];

        // ★ v1.1.1: 红包/转账规则优先置顶，带显式关键词，确保不会被餐饮等通用规则误判
        this.customRules.push({
            name: '红包收入',
            color: '#FF9999',
            icon: '🧧',
            keywords: ['微信红包', '红包', '企业微信红包', '群红包', '单发红包']
        });
        this.customRules.push({
            name: '红包支出',
            color: '#FF6B6B',
            icon: '🧧',
            keywords: ['微信红包', '红包', '发红包', '群红包', '单发红包']
        });
        this.customRules.push({
            name: '转账收入',
            color: '#98FB98',
            icon: '💳',
            keywords: ['转账']
        });
        this.customRules.push({
            name: '转账支出',
            color: '#FFA07A',
            icon: '💸',
            keywords: ['转账']
        });
        this.customRules.push({
            name: '退款',
            color: '#64B5F6',
            icon: '↩️',
            keywords: ['退款']
        });

        // 从 TypeManager 子类别关键词生成其他分类规则
        this.customRules.push(...Object.entries(subKeywords).map(([name, info]) => ({
            name,
            color: info.color,
            icon: info.icon,
            keywords: info.keywords
        })));

        // 兜底分类
        this.customRules.push({
            name: '收款收入',
            color: '#66BB6A',
            icon: '💰',
            keywords: []
        });
        this.customRules.push({
            name: '资金管理',
            color: '#78909C',
            icon: '🏦',
            keywords: []
        });
        this.customRules.push({
            name: '社交支出',
            color: '#FFB74D',
            icon: '👥',
            keywords: []
        });
        this.customRules.push({
            name: '其他收入',
            color: '#AED581',
            icon: '📥',
            keywords: []
        });
        this.customRules.push({
            name: '其他支出',
            color: '#BDC3C7',
            icon: '📤',
            keywords: []
        });
        this.saveRules();
        console.log('分类规则已从TypeManager同步初始化（v1.1.1: 红包/转账优先匹配）');
    },

    /**
     * 主分类函数：对单条交易进行分类
     * 返回 { category: string, method: string }
     */
    classify(transaction) {
        const typeName = String(transaction.transactionType || '').trim();
        const counterparty = String(transaction.counterparty || '');
        const description = String(transaction.description || '');

        // ===== ★ v1.1.2 前置守卫：红包类型必须按金额方向分类 =====
        const isRedPacket = typeName.includes('红包') || counterparty.includes('红包') || description.includes('红包');
        if (isRedPacket) {
            // 红包退款 → 退款
            if (typeName.includes('退款') || description.includes('退款')) {
                this._logClassify(transaction, '退款', '前置守卫-红包退款');
                return '退款';
            }
            const cat = transaction.amount >= 0 ? '红包收入' : '红包支出';
            this._logClassify(transaction, cat, '前置守卫-红包');
            return cat;
        }

        // ===== ★ v1.1.2 转账前置守卫 =====
        const isTransfer = typeName.includes('转账') || counterparty.includes('转账');
        if (isTransfer) {
            const cat = transaction.amount >= 0 ? '转账收入' : '转账支出';
            this._logClassify(transaction, cat, '前置守卫-转账');
            return cat;
        }

        // ===== 第1层：交易类型直接映射 =====
        if (typeName) {
            const typeInfo = TypeManager.getTypeInfo(typeName);

            if (typeInfo) {
                // 1a. subClassify
                if (typeInfo.subClassify) {
                    const subCat = TypeManager.classifyByCounterparty(transaction);
                    this._logClassify(transaction, subCat, 'L1-subClassify(' + typeName + ')');
                    return subCat;
                }

                // 1b. 直接映射
                if (typeInfo.category) {
                    if (typeInfo.direction === 'mixed') {
                        const cat = transaction.amount >= 0 ? '其他收入' : typeInfo.category;
                        this._logClassify(transaction, cat, 'L1-mixed(' + typeName + ')');
                        return cat;
                    }
                    this._logClassify(transaction, typeInfo.category, 'L1-direct(' + typeName + ')');
                    return typeInfo.category;
                }
            }
        }

        // ===== 第2层：关键词匹配 =====
        const text = `${counterparty} ${description}`.toLowerCase();
        if (!text.includes('红包') && !text.includes('转账')) {
            for (const rule of this.customRules) {
                if (rule.keywords && rule.keywords.length > 0 &&
                    rule.keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
                    this._logClassify(transaction, rule.name, 'L2-keyword(' + rule.name + ')');
                    return rule.name;
                }
            }
        }

        // ===== 第3层：兜底 =====
        if (transaction.amount > 0) {
            this._logClassify(transaction, '其他收入', 'L3-default-income');
            return '其他收入';
        } else if (transaction.amount < 0) {
            const subCat = TypeManager.classifyByCounterparty(transaction);
            this._logClassify(transaction, subCat, 'L3-counterparty(' + subCat + ')');
            return subCat;
        }

        this._logClassify(transaction, '其他', 'L3-default-other');
        return '其他';
    },

    /**
     * ★ v1.1.2: 分类调试日志（仅输出前50条，防止刷屏）
     */
    _classifyLogCount: 0,
    _logClassify(transaction, category, method) {
        if (this._classifyLogCount < 50) {
            this._classifyLogCount++;
            const amt = transaction.amount;
            const type = transaction.transactionType;
            const cp = (transaction.counterparty || '').substring(0, 20);
            console.log(`[分类] ${type} | ${cp} | ¥${amt} → ${category} (${method})`);
        }
    },

    /**
     * 批量分类
     */
    autoClassify(transactions) {
        if (!transactions || transactions.length === 0) return transactions;

        // ★ v1.1.2: 重置分类日志计数器
        this._classifyLogCount = 0;
        console.log('=== 开始自动分类 ' + transactions.length + ' 条交易 ===');
        console.log('当前规则数: ' + this.customRules.length + ', 规则版本: ' + this.RULES_VERSION);

        // 首先：检测并注册新的交易类型
        const detection = TypeManager.detectAndAddNewTypes(transactions);

        // 如果有新类型发现，通知上层
        if (detection.newTypes.length > 0) {
            this._lastNewTypes = detection.newTypes;
        }

        // 执行分类
        return transactions.map(transaction => ({
            ...transaction,
            category: this.classify(transaction)
        }));
    },

    /** 获取最后一次检测到的新类型 */
    getLastNewTypes() {
        const types = this._lastNewTypes || [];
        this._lastNewTypes = null;
        return types;
    },

    /**
     * 获取分类统计
     */
    getCategoryStats(transactions) {
        const stats = {};
        
        transactions.forEach(transaction => {
            const category = transaction.category || '未分类';
            if (!stats[category]) {
                stats[category] = {
                    name: category,
                    count: 0,
                    totalAmount: 0,
                    income: 0,
                    expense: 0
                };
            }
            
            stats[category].count++;
            stats[category].totalAmount += Math.abs(transaction.amount);
            
            if (transaction.amount > 0) {
                stats[category].income += transaction.amount;
            } else {
                stats[category].expense += Math.abs(transaction.amount);
            }
        });
        
        return Object.values(stats).sort((a, b) => b.totalAmount - a.totalAmount);
    },

    /**
     * 获取所有分类（合并TypeManager子类别 + 其他系统分类）
     */
    getAllCategories() {
        // 合并子类别 + 系统分类
        const categories = new Map();

        // 从子类别关键词获取
        Object.entries(TypeManager.subCategoryKeywords).forEach(([name, info]) => {
            categories.set(name, {
                name, color: info.color, icon: info.icon, keywords: info.keywords
            });
        });

        // 添加系统分类（从 customRules 中获取子类别中没有的）
        this.customRules.forEach(rule => {
            if (!categories.has(rule.name)) {
                categories.set(rule.name, {
                    name: rule.name,
                    color: rule.color,
                    icon: rule.icon,
                    keywords: rule.keywords || []
                });
            }
        });

        return Array.from(categories.values());
    },

    /**
     * 获取分类颜色
     */
    getCategoryColor(categoryName) {
        const cat = this.getAllCategories().find(c => c.name === categoryName);
        return cat ? cat.color : '#BDC3C7';
    },

    /**
     * 获取分类图标
     */
    getCategoryIcon(categoryName) {
        const cat = this.getAllCategories().find(c => c.name === categoryName);
        return cat ? cat.icon : '📦';
    },

    // ============ 用户自定义分类管理 ============

    addCategory(name, keywords, color, icon) {
        const newCategory = {
            name,
            color: color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            icon: icon || '📌',
            keywords: keywords || []
        };
        this.customRules.push(newCategory);
        this.saveRules();
        return newCategory;
    },

    deleteCategory(name) {
        const index = this.customRules.findIndex(rule => rule.name === name);
        if (index > -1) {
            this.customRules.splice(index, 1);
            this.saveRules();
        }
    },

    updateCategory(oldName, updates) {
        let target = this.customRules.find(rule => rule.name === oldName);
        if (target) {
            Object.assign(target, updates);
        } else {
            // 新建
            target = { name: oldName, color: '#BDC3C7', icon: '📌', keywords: [], ...updates };
            this.customRules.push(target);
        }
        this.saveRules();
    },

    saveRules() {
        Utils.saveToStorage('classifier_rules', this.customRules);
        // ★ v1.1.2: 同时保存规则版本号，用于版本升级时自动刷新
        Utils.saveRawToStorage('classifier_rules_version', this.RULES_VERSION);
    },

    // ============ 类型管理相关方法（用于UI交互） ============

    /**
     * 确认未知交易类型的分类映射
     */
    confirmTypeMapping(typeName, category, direction) {
        return TypeManager.confirmUnknownType(typeName, category, direction);
    },

    /**
     * 手动添加交易类型 → 分类映射
     */
    addTypeMapping(typeName, category, direction) {
        TypeManager.addCustomMapping(typeName, category, direction);
    },

    /**
     * 获取所有已确认的类型映射
     */
    getTypeMappings() {
        return [
            ...TypeManager.getUserMappings(),
            ...TypeManager.getUnknownTypes()
        ];
    },

    /**
     * 获取类型知识库完整报告
     */
    getTypeReport() {
        return TypeManager.getReport();
    }
};

// 初始化分类器
Classifier.init();

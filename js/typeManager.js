/**
 * 微信账单分析器 - 交易类型动态维护模块
 * Version: 1.1.13
 * 
 * 功能：
 * 1. 维护交易类型 → 分类的映射知识库
 * 2. 解析账单时自动检测新出现的交易类型
 * 3. 对未知类型自动推断分类并添加到知识库
 * 4. 支持用户手动确认/修改类型映射
 */

const TypeManager = {
    // ============ 内置交易类型知识库 ============
    // 基于7个账单文件（2014-2021年）、4836条记录的分析结果
    builtinTypeMap: {
        // ---- 社交红包（v1.1.1: direction改为mixed，由Classifier前置守卫按金额正负区分收入/支出） ----
        '微信红包':               { category: '红包支出', direction: 'mixed', note: '微信红包 → 按金额方向区分收入/支出' },
        '微信红包（单发）':         { category: '红包支出', direction: 'mixed', note: '单人红包 → 按金额方向区分收入/支出' },
        '微信红包（群红包）':       { category: '红包支出', direction: 'mixed', note: '群红包 → 按金额方向区分收入/支出' },
        '企业微信红包':            { category: '红包收入', direction: 'mixed', note: '企业红包 → 按金额方向区分收入/支出' },
        '微信红包-退款':           { category: '退款', direction: 'mixed', note: '红包未领退回' },

        // ---- 转账 ----
        '转账':                   { category: '转账支出', direction: 'mixed', note: '转账（含收发）' },

        // ---- 收款 ----
        '二维码收款':              { category: '收款收入', direction: 'income', note: '通过二维码收款' },
        '群收款':                  { category: '社交支出', direction: 'expense', note: '群收款付款' },

        // ---- 消费类（需二次分类，根据交易对方匹配子类别） ----
        '商户消费':                { category: null, direction: 'expense', note: '商户消费 → 根据对方名称二次分类',
                                    subClassify: true },
        '扫二维码付款':            { category: null, direction: 'expense', note: '扫码付款 → 根据对方名称二次分类',
                                    subClassify: true },

        // ---- 资金管理 ----
        '零钱提现':                { category: '资金管理', direction: 'expense', note: '零钱提现到银行卡' },
        '零钱充值':                { category: '资金管理', direction: 'expense', note: '银行卡充值到零钱' },
        '信用卡还款':              { category: '资金管理', direction: 'expense', note: '信用卡还款' },

        // ---- 零钱通相关（合并处理） ----
        // 转入类
        '转入零钱通-来自零钱':                   { category: '资金管理', direction: 'expense', note: '零钱→零钱通' },
        '转入零钱通-来自建设银行':                { category: '资金管理', direction: 'expense', note: '银行卡→零钱通' },
        '转入零钱通-来自上海农商银行':             { category: '资金管理', direction: 'expense', note: '银行卡→零钱通' },
        '转入零钱通-来自上海农商银行(0419)':       { category: '资金管理', direction: 'expense', note: '银行卡→零钱通' },
        '转入零钱通-来自交通银行':                { category: '资金管理', direction: 'expense', note: '银行卡→零钱通' },
        // 转出类
        '零钱通转出-到零钱':                      { category: '资金管理', direction: 'expense', note: '零钱通→零钱' },
        '零钱通转出-到建设银行(2480)':             { category: '资金管理', direction: 'expense', note: '零钱通→银行卡' },
        '零钱通转出-到上海农商银行(0419)':         { category: '资金管理', direction: 'expense', note: '零钱通→银行卡' },
        '零钱通转出-到交通银行(6748)':             { category: '资金管理', direction: 'expense', note: '零钱通→银行卡' },

        // ---- 退款类 ----
        '感动概念文化（东莞）有限公司-退款':        { category: '退款', direction: 'income', note: '商户退款' },
        '快团团-退款':                            { category: '退款', direction: 'income', note: '快团团退款' },
        '丰巢-退款':                               { category: '退款', direction: 'income', note: '丰巢退款' },
        '西云楼-退款':                             { category: '退款', direction: 'income', note: '商户退款' },
        '拼多多平台商户-退款':                     { category: '退款', direction: 'income', note: '拼多多退款' },

        // ---- 其他收入 ----
        '其他':                   { category: '其他收入', direction: 'income', note: '活动奖励/提现等小额收入' }
    },

    // ============ 通用类型模式匹配（用于自动识别新类型） ============
    // ★ v1.1.1: 红包/转账等高优先级模式放在数组开头，确保不会被后续宽泛模式误匹配
    typePatterns: [
        // 红包类（最高优先级，direction改为mixed由Classifier按金额方向区分）
        { pattern: /^微信红包(?!.*退款)/, category: '红包支出', direction: 'mixed' },
        { pattern: /企业微信红包/, category: '红包收入', direction: 'mixed' },
        { pattern: /红包.*退款/, category: '退款', direction: 'mixed' },
        // 退款类
        { pattern: /退款$/, category: '退款', direction: 'income' },
        { pattern: /退款/, category: '退款', direction: 'income' },
        // 转账类（排在资金管理之前，避免"零钱通转出"误匹配）
        { pattern: /转账/, category: '转账支出', direction: 'mixed' },
        // 资金管理类
        { pattern: /零钱提现/, category: '资金管理', direction: 'expense' },
        { pattern: /零钱充值/, category: '资金管理', direction: 'expense' },
        { pattern: /信用卡还款/, category: '资金管理', direction: 'expense' },
        { pattern: /零钱通/, category: '资金管理', direction: 'expense' },
        { pattern: /零钱通.*转入/, category: '资金管理', direction: 'expense' },
        { pattern: /零钱通.*转出/, category: '资金管理', direction: 'expense' },
        { pattern: /转入零钱通/, category: '资金管理', direction: 'expense' },
        // 消费类（需二次分类）
        { pattern: /扫二维码付款/, category: null, direction: 'expense', subClassify: true },
        { pattern: /商户消费/, category: null, direction: 'expense', subClassify: true },
        // 收款
        { pattern: /二维码收款/, category: '收款收入', direction: 'income' },
        // 兜底红包（最低优先级，但仍是mixed而非hardcoded expense）
        { pattern: /红包/, category: '红包支出', direction: 'mixed' }
    ],

    // ============ 消费类二次分类关键词 ============
    subCategoryKeywords: {
        '餐饮美食': {
            keywords: ['餐饮', '餐厅', '饭店', '火锅', '快餐', '麦当劳', '肯德基', 'KFC', '星巴克',
                      '必胜客', '奶茶', '饮品', '小吃', '美食', '食堂', '自助餐', '烧烤', '面食',
                      '饺子', '包子', '粥', '早餐', '午餐', '晚餐', '下午茶', '外卖', '美团外卖',
                      '饿了么', '滴滴外卖', '海底捞', '喜茶', '瑞幸', 'luckin', '菜', '饭', '粉',
                      '螺蛳粉', '米线', '黄焖鸡', '沙县', '兰州拉面', '麻辣烫', '串串'],
            color: '#FF6B6B',
            icon: '🍜'
        },
        '购物消费': {
            keywords: ['超市', '便利店', '商店', '商场', '百货', '网购', '淘宝', '京东', '拼多多',
                      '电商', '零售', '服装', '鞋包', '化妆品', '数码', '家电', '家具', '家居',
                      '日用品', '文具', '图书', '音像', '玩具', '珠宝', '手表', '首饰', '优衣库',
                      'ZARA', '沃尔玛', '家乐福', '大润发', '永辉', '华润万家', '天猫', '苏宁',
                      '唯品会', '闲鱼', '当当', 'Amazon', '苹果', '华为', '小米', 'OPPO',
                      'vivo', '屈臣氏', '名创优品', 'MINISO', '无印良品', 'MUIJI'],
            color: '#4ECDC4',
            icon: '🛒'
        },
        '交通出行': {
            keywords: ['打车', '网约车', '滴滴', '出租车', 'TAXI', '地铁', '公交', '高铁',
                      '火车', '飞机', '机票', '加油站', '停车费', '过路费', '共享单车',
                      '摩拜', '哈啰', '出行', '交通', '车票', '票', '铁路', '航空', '神州租车',
                      '滴滴出行', '首汽约车', '曹操出行', 'T3出行', '1号专车', '巴士'],
            color: '#45B7D1',
            icon: '🚗'
        },
        '生活缴费': {
            keywords: ['电费', '水费', '燃气费', '话费', '宽带', '物业', '房租', '房贷',
                      '保险', '社保', '公积金', '有线电视', '网络费', '通讯费', '充值',
                      '移动', '联通', '电信', '缴费'],
            color: '#96CEB4',
            icon: '💡'
        },
        '娱乐休闲': {
            keywords: ['电影', '影院', '游戏', '音乐', 'KTV', '酒吧', '网吧', '旅游',
                      '酒店', '民宿', '景点', '门票', '演出', '展览', '体育', '健身',
                      '游泳', '美容', '美发', '按摩', '休闲', '娱乐', '爱奇艺', '腾讯视频',
                      '优酷', 'Netflix', 'Spotify', '会员', '密室', '剧本杀', '台球',
                      '棋牌', '彩票', '游族游戏', '空中网', '掌阅科技', 'iReader',
                      '猫眼', '淘票票', '大麦', 'QQ音乐', '网易云音乐', 'B站', 'bilibili'],
            color: '#DDA0DD',
            icon: '🎮'
        },
        '医疗健康': {
            keywords: ['医院', '诊所', '药店', '医疗', '保健', '体检', '挂号', '门诊',
                      '住院', '药品', '医药', '牙科', '眼科', '皮肤科', '中医', '西医',
                      '健康', '药房', '卫生院'],
            color: '#98D8C8',
            icon: '🏥'
        },
        '教育培训': {
            keywords: ['教育', '培训', '学校', '课程', '学费', '教材', '考试', '报名',
                      '辅导', '补习', '幼儿园', '小学', '中学', '大学', '留学', '语言',
                      '编程', '设计', '艺术', '兴趣班', '驾校', '学车'],
            color: '#F7DC6F',
            icon: '📚'
        }
    },

    // ============ 运行时状态 ============
    userTypeMap: {},       // 用户自定义的类型映射（会合并到内置映射）
    unknownTypes: {},      // 新发现的未知类型 { typeName: { count, samples, ... } }
    isInitialized: false,

    /**
     * 初始化：加载用户自定义的类型映射
     */
    init() {
        try {
            const saved = Utils.loadFromStorage('typeManager_userMap');
            if (saved && typeof saved === 'object') {
                this.userTypeMap = saved;
            }
            this.isInitialized = true;
            console.log('交易类型管理器已初始化，已知类型数:', this.getAllKnownTypes().length);
        } catch (e) {
            console.error('TypeManager初始化失败:', e);
            this.isInitialized = true;
        }
    },

    /**
     * 获取所有已知类型名称（合并内置+用户自定义）
     */
    getAllKnownTypes() {
        const all = { ...this.builtinTypeMap, ...this.userTypeMap };
        return Object.keys(all);
    },

    /**
     * 获取类型信息
     */
    getTypeInfo(typeName) {
        return this.userTypeMap[typeName] || this.builtinTypeMap[typeName] || null;
    },

    /**
     * 获取类型的分类名称
     */
    getCategory(typeName) {
        const info = this.getTypeInfo(typeName);
        return info ? info.category : null;
    },

    /**
     * 判断类型是否需要二次分类（如商户消费、扫二维码付款）
     */
    needsSubClassify(typeName) {
        const info = this.getTypeInfo(typeName);
        return info ? !!info.subClassify : false;
    },

    /**
     * ============ 核心功能：检测并处理新交易类型 ============
     * 当上传新账单时调用，自动检测未知类型并添加到知识库
     * @param {Array} transactions - 解析后的交易数组
     * @returns {Object} { newTypes: [...], updatedCount: number }
     */
    detectAndAddNewTypes(transactions) {
        if (!transactions || transactions.length === 0) {
            return { newTypes: [], updatedCount: 0 };
        }

        // 统计所有出现的交易类型
        const typeStats = {};
        transactions.forEach(tx => {
            const typeName = String(tx.transactionType || '').trim();
            if (!typeName) return;

            if (!typeStats[typeName]) {
                typeStats[typeName] = { count: 0, samples: [], directions: {} };
            }
            typeStats[typeName].count++;
            typeStats[typeName].directions[tx.amount >= 0 ? 'income' : 'expense'] = 
                (typeStats[typeName].directions[tx.amount >= 0 ? 'income' : 'expense'] || 0) + 1;
            
            if (typeStats[typeName].samples.length < 5) {
                typeStats[typeName].samples.push(tx.counterparty);
            }
        });

        // 检查哪些类型是新的（不在内置映射也不在用户映射中）
        const newTypes = [];
        const allKnown = { ...this.builtinTypeMap, ...this.userTypeMap };

        Object.entries(typeStats).forEach(([typeName, stats]) => {
            if (!allKnown[typeName] && !this.unknownTypes[typeName]) {
                // 尝试自动推断分类
                const inferred = this.inferCategory(typeName, stats);
                
                this.unknownTypes[typeName] = {
                    typeName,
                    count: stats.count,
                    samples: [...new Set(stats.samples)],
                    directions: stats.directions,
                    inferredCategory: inferred.category,
                    inferredDirection: inferred.direction,
                    detectedAt: new Date().toISOString(),
                    confirmed: false
                };
                
                newTypes.push({ typeName, ...inferred, count: stats.count });
            }
        });

        if (newTypes.length > 0) {
            // 保存未知类型列表
            Utils.saveToStorage('typeManager_unknownTypes', this.unknownTypes);
            console.log(`发现 ${newTypes.length} 种新交易类型:`, newTypes.map(t => t.typeName));
        }

        return { newTypes, updatedCount: newTypes.length };
    },

    /**
     * 自动推断未知类型的分类
     * 使用模式匹配 + 方向推断
     */
    inferCategory(typeName, stats) {
        // 1. 先尝试模式匹配
        for (const patternRule of this.typePatterns) {
            if (patternRule.pattern.test(typeName)) {
                return {
                    category: patternRule.category || this.inferByDirection(stats),
                    direction: patternRule.direction,
                    subClassify: !!patternRule.subClassify,
                    matchMethod: 'pattern'
                };
            }
        }

        // 2. 检查是否是退款型（名称含"退款"但未匹配上面的模式）
        if (/退款/.test(typeName)) {
            return { category: '退款', direction: 'income', matchMethod: 'keyword_refund' };
        }

        // 3. 根据交易方向推断
        return {
            category: this.inferByDirection(stats),
            direction: this.inferDirection(stats),
            subClassify: false,
            matchMethod: 'direction'
        };
    },

    inferByDirection(stats) {
        const incomeCount = stats.directions.income || 0;
        const expenseCount = stats.directions.expense || 0;
        if (incomeCount > expenseCount) return '其他收入';
        return '其他支出';
    },

    inferDirection(stats) {
        const incomeCount = stats.directions.income || 0;
        const expenseCount = stats.directions.expense || 0;
        if (incomeCount > 0 && expenseCount === 0) return 'income';
        if (expenseCount > 0 && incomeCount === 0) return 'expense';
        return 'mixed';
    },

    /**
     * 对"商户消费"和"扫二维码付款"等通用类型进行二次分类
     * 根据交易对方名称和商品描述匹配子类别
     */
    classifyByCounterparty(transaction) {
        const text = `${transaction.counterparty} ${transaction.description || ''}`.toLowerCase();
        const typeName = String(transaction.transactionType || '');

        // ★ v1.1.1 防御：红包/转账交易绝对不能被餐饮等通用关键词误判
        // 如果交易类型含"红包"/"转账"/"退款"，直接按系统分类返回，不进行二次关键词匹配
        if (typeName.includes('红包') || typeName.includes('转账') || typeName.includes('退款')) {
            if (transaction.amount < 0) return '其他支出';
            return '其他收入';
        }

        for (const [catName, catInfo] of Object.entries(this.subCategoryKeywords)) {
            if (catInfo.keywords.some(kw => text.includes(kw.toLowerCase()))) {
                return catName;
            }
        }

        // 未匹配到 → 默认分类
        if (transaction.amount < 0) {
            return '其他支出';
        }
        return '其他收入';
    },

    /**
     * 获取二次分类的元信息
     */
    getSubCategoryMeta(categoryName) {
        return this.subCategoryKeywords[categoryName] || null;
    },

    /**
     * ============ 用户交互：确认未知类型 ============
     */
    confirmUnknownType(typeName, category, direction) {
        if (this.unknownTypes[typeName]) {
            this.userTypeMap[typeName] = {
                category: category,
                direction: direction || this.unknownTypes[typeName].inferredDirection,
                note: '用户确认',
                confirmedAt: new Date().toISOString()
            };
            delete this.unknownTypes[typeName];
            this.saveAll();
            return true;
        }
        return false;
    },

    /**
     * 用户自定义添加类型映射
     */
    addCustomMapping(typeName, category, direction) {
        this.userTypeMap[typeName] = {
            category: category,
            direction: direction || 'expense',
            note: '用户自定义',
            addedAt: new Date().toISOString()
        };
        this.saveAll();
    },

    /**
     * 删除用户自定义的类型映射
     */
    removeCustomMapping(typeName) {
        if (this.userTypeMap[typeName]) {
            delete this.userTypeMap[typeName];
            this.saveAll();
            return true;
        }
        return false;
    },

    /**
     * 获取所有未确认的未知类型
     */
    getUnknownTypes() {
        return Object.entries(this.unknownTypes).map(([name, info]) => ({
            typeName: name,
            ...info
        }));
    },

    /**
     * 获取所有用户自定义的类型映射
     */
    getUserMappings() {
        return Object.entries(this.userTypeMap).map(([name, info]) => ({
            typeName: name,
            ...info
        }));
    },

    /**
     * 获取完整的类型知识库报告
     */
    getReport() {
        const builtin = Object.entries(this.builtinTypeMap).map(([name, info]) => ({
            typeName: name, source: 'builtin', ...info
        }));
        const userMaps = Object.entries(this.userTypeMap).map(([name, info]) => ({
            typeName: name, source: 'user', ...info
        }));
        const unknown = Object.entries(this.unknownTypes).map(([name, info]) => ({
            typeName: name, source: 'unknown', ...info
        }));

        return {
            builtinCount: builtin.length,
            userCount: userMaps.length,
            unknownCount: unknown.length,
            allTypes: [...builtin, ...userMaps, ...unknown]
        };
    },

    /**
     * 持久化：保存用户映射和未知类型
     */
    saveAll() {
        Utils.saveToStorage('typeManager_userMap', this.userTypeMap);
        Utils.saveToStorage('typeManager_unknownTypes', this.unknownTypes);
    },

    /**
     * 从LocalStorage恢复未知类型列表
     */
    loadUnknownTypes() {
        const saved = Utils.loadFromStorage('typeManager_unknownTypes');
        if (saved && typeof saved === 'object') {
            this.unknownTypes = saved;
        }
    },

    /**
     * 重置所有用户数据（仅清除自定义映射）
     */
    resetUserData() {
        this.userTypeMap = {};
        this.unknownTypes = {};
        Utils.clearStorage('typeManager_userMap');
        Utils.clearStorage('typeManager_unknownTypes');
    }
};

// 自动初始化
TypeManager.init();
TypeManager.loadUnknownTypes();

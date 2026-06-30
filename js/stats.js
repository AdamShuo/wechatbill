/**
 * 微信账单分析器 - 统计分析模块
 * Version: 1.1.13
 */

const Stats = {
    /**
     * 按时间周期统计
     */
    calcByPeriod(transactions, period = 'month') {
        const grouped = Utils.groupBy(transactions, t => {
            const date = new Date(t.transactionTime);
            
            switch (period) {
                case 'day':
                    return date.toISOString().split('T')[0];
                case 'week':
                    const weekNum = this.getWeekNumber(date);
                    return `${date.getFullYear()}-W${weekNum}`;
                case 'month':
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                case 'year':
                    return String(date.getFullYear());
                default:
                    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }
        });
        
        const result = [];
        
        Object.entries(grouped).forEach(([periodKey, items]) => {
            const income = items.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
            const expense = items.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            result.push({
                period: periodKey,
                count: items.length,
                income: income,
                expense: expense,
                net: income - expense
            });
        });
        
        // 按时间排序
        result.sort((a, b) => a.period.localeCompare(b.period));
        
        return result;
    },

    /**
     * 获取周数
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    /**
     * 计算关键指标
     */
    calcKeyMetrics(transactions) {
        if (!transactions || transactions.length === 0) {
            return {
                avgDailyExpense: 0,
                avgMonthlyExpense: 0,
                maxTransaction: 0,
                transactionFrequency: 0,
                totalIncome: 0,
                totalExpense: 0,
                totalTransactions: 0,
                timeSpan: 0
            };
        }
        
        const expenses = transactions.filter(t => t.amount < 0);
        const incomes = transactions.filter(t => t.amount > 0);
        
        const totalIncome = Utils.sum(incomes, 'amount');
        const totalExpense = Utils.sum(expenses.map(t => ({...t, amount: Math.abs(t.amount)})), 'amount');
        
        // 计算时间跨度
        const dates = transactions.map(t => new Date(t.transactionTime)).sort((a, b) => a - b);
        const timeSpanDays = Utils.daysBetween(dates[0], dates[dates.length - 1]);
        const timeSpanMonths = Math.max(timeSpanDays / 30, 1);
        
        // 计算日均/月均消费
        const avgDailyExpense = totalExpense / Math.max(timeSpanDays, 1);
        const avgMonthlyExpense = totalExpense / timeSpanMonths;
        
        // 最大单笔交易
        const maxTransaction = Math.max(...expenses.map(t => Math.abs(t.amount)));
        
        // 交易频次（每月）
        const transactionFrequency = transactions.length / timeSpanMonths;
        
        return {
            avgDailyExpense: avgDailyExpense,
            avgMonthlyExpense: avgMonthlyExpense,
            maxTransaction: maxTransaction,
            transactionFrequency: transactionFrequency,
            totalIncome: totalIncome,
            totalExpense: totalExpense,
            totalTransactions: transactions.length,
            timeSpan: timeSpanDays,
            timeSpanMonths: timeSpanMonths
        };
    },

    /**
     * 计算分类统计
     */
    calcCategoryStats(transactions) {
        const categories = Utils.groupBy(transactions, 'category');
        
        return Object.entries(categories).map(([name, items]) => {
            const income = items.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
            const expense = items.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            return {
                name: name,
                count: items.length,
                income: income,
                expense: expense,
                total: income + expense,
                percentage: 0 // 后续计算
            };
        }).sort((a, b) => b.total - a.total);
    },

    /**
     * 计算占比百分比
     */
    calcPercentages(statsArray) {
        const total = statsArray.reduce((sum, item) => sum + item.total, 0);
        if (total === 0) return statsArray;
        
        return statsArray.map(item => ({
            ...item,
            percentage: (item.total / total * 100).toFixed(2)
        }));
    },

    /**
     * 获取Top N商户
     */
    getTopMerchants(transactions, n = 10) {
        const merchantStats = {};
        
        transactions.forEach(transaction => {
            const merchant = transaction.counterparty;
            if (!merchantStats[merchant]) {
                merchantStats[merchant] = {
                    name: merchant,
                    count: 0,
                    totalAmount: 0
                };
            }
            
            merchantStats[merchant].count++;
            merchantStats[merchant].totalAmount += Math.abs(transaction.amount);
        });
        
        return Object.values(merchantStats)
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, n);
    },

    /**
     * 检测异常交易
     */
    detectAnomalies(transactions, threshold = 2) {
        if (transactions.length === 0) return [];
        
        const amounts = transactions.map(t => Math.abs(t.amount));
        const mean = Utils.average(amounts);
        const variance = Utils.average(amounts.map(a => Math.pow(a - mean, 2)));
        const stdDev = Math.sqrt(variance);
        
        const anomalyThreshold = mean + (threshold * stdDev);
        
        return transactions.filter(t => Math.abs(t.amount) > anomalyThreshold);
    },

    /**
     * 计算月度增长率
     */
    calcGrowthRate(periodStats) {
        if (periodStats.length < 2) return 0;
        
        const sorted = [...periodStats].sort((a, b) => a.period.localeCompare(b.period));
        const latest = sorted[sorted.length - 1];
        const previous = sorted[sorted.length - 2];
        
        if (previous.expense === 0) return 0;
        
        return ((latest.expense - previous.expense) / previous.expense * 100).toFixed(2);
    },

    /**
     * 生成综合统计报告
     */
    generateReport(transactions) {
        const metrics = this.calcKeyMetrics(transactions);
        const monthlyStats = this.calcByPeriod(transactions, 'month');
        const categoryStats = this.calcPercentages(this.calcCategoryStats(transactions));
        const topMerchants = this.getTopMerchants(transactions, 10);
        const anomalies = this.detectAnomalies(transactions);
        const growthRate = this.calcGrowthRate(monthlyStats);
        
        return {
            metrics: metrics,
            monthlyStats: monthlyStats,
            categoryStats: categoryStats,
            topMerchants: topMerchants,
            anomalies: anomalies,
            growthRate: growthRate
        };
    }
};

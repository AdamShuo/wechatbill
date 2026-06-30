/**
 * 微信账单分析器 - 工具函数模块
 * Version: 1.1.13
 */

const Utils = {
    /**
     * 格式化金额显示
     */
    formatMoney(amount) {
        if (amount === null || amount === undefined) return '¥0.00';
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        const sign = num < 0 ? '-' : '';
        const absNum = Math.abs(num).toFixed(2);
        const parts = absNum.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return sign + '¥' + parts.join('.');
    },

    /**
     * 格式化日期显示
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        return dateStr.toString().substring(0, 10);
    },

    /**
     * 格式化日期时间显示
     */
    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        return dateStr.toString();
    },

    /**
     * 防抖函数
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 节流函数
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * 保存到LocalStorage
     */
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                data: data,
                timestamp: Date.now(),
                version: '1.0.0'
            }));
            return true;
        } catch (e) {
            console.error('LocalStorage保存失败:', e);
            return false;
        }
    },

    /**
     * 从LocalStorage读取
     */
    loadFromStorage(key) {
        try {
            const item = localStorage.getItem(key);
            if (!item) return null;
            const parsed = JSON.parse(item);
            return parsed.data;
        } catch (e) {
            console.error('LocalStorage读取失败:', e);
            return null;
        }
    },

    /**
     * 清除LocalStorage
     */
    clearStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('LocalStorage清除失败:', e);
        }
    },

    /**
     * ★ v1.1.2: 保存原始值到LocalStorage（不包装JSON结构）
     */
    saveRawToStorage(key, value) {
        try {
            localStorage.setItem(key, String(value));
            return true;
        } catch (e) {
            console.error('LocalStorage保存失败:', e);
            return false;
        }
    },

    /**
     * ★ v1.1.2: 从LocalStorage读取原始字符串值
     */
    loadRawFromStorage(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error('LocalStorage读取失败:', e);
            return null;
        }
    },

    /**
     * 验证邮箱格式
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * 验证手机号格式
     */
    isValidPhone(phone) {
        const re = /^1[3-9]\d{9}$/;
        return re.test(phone);
    },

    /**
     * 深拷贝对象
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * 数组去重
     */
    uniqueArray(arr, key) {
        if (key) {
            const seen = new Set();
            return arr.filter(item => {
                const k = key instanceof Function ? key(item) : item[key];
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        }
        return [...new Set(arr)];
    },

    /**
     * 数组分组
     */
    groupBy(arr, key) {
        return arr.reduce((groups, item) => {
            const group = key instanceof Function ? key(item) : item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    },

    /**
     * 计算数组平均值
     */
    average(arr, key) {
        if (!arr || arr.length === 0) return 0;
        const values = arr.map(item => key ? item[key] : item).filter(v => v !== null && v !== undefined);
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    },

    /**
     * 计算数组总和
     */
    sum(arr, key) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((total, item) => {
            const val = key ? item[key] : item;
            return total + (typeof val === 'number' ? val : 0);
        }, 0);
    },

    /**
     * 获取数组最大值
     */
    max(arr, key) {
        if (!arr || arr.length === 0) return null;
        const values = arr.map(item => key ? item[key] : item);
        return Math.max(...values.filter(v => v !== null && v !== undefined));
    },

    /**
     * 获取数组最小值
     */
    min(arr, key) {
        if (!arr || arr.length === 0) return null;
        const values = arr.map(item => key ? item[key] : item);
        return Math.min(...values.filter(v => v !== null && v !== undefined));
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 获取文件扩展名
     */
    getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    },

    /**
     * 判断是否为Excel文件
     */
    isExcelFile(filename) {
        const ext = this.getFileExtension(filename).toLowerCase();
        return ext === 'xlsx' || ext === 'xls';
    },

    /**
     * 解析URL参数
     */
    getUrlParams() {
        const params = {};
        const search = window.location.search.substring(1);
        const parts = search.split('&');
        parts.forEach(part => {
            const [key, value] = part.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        return params;
    },

    /**
     * 显示Toast提示
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 24px;
            padding: 12px 24px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#3B82F6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            font-size: 0.875rem;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * 确认对话框
     */
    async confirm(message) {
        return new Promise((resolve) => {
            if (confirm(message)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    },

    /**
     * 等待指定时间
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 获取当前日期字符串 YYYY-MM-DD
     */
    getCurrentDate() {
        const date = new Date();
        return date.toISOString().split('T')[0];
    },

    /**
     * 获取当前日期时间字符串
     */
    getCurrentDateTime() {
        const date = new Date();
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },

    /**
     * 计算两个日期之间的天数差
     */
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    /**
     * 格式化数字（添加千分位）
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * 计算百分比（用于分类统计）
     */
    calcPercentages(stats) {
        if (!stats || stats.length === 0) return [];
        const total = stats.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        if (total === 0) return stats.map(s => ({ ...s, percentage: 0 }));
        return stats.map(s => ({
            ...s,
            percentage: parseFloat(((s.totalAmount / total) * 100).toFixed(1))
        }));
    }
};

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

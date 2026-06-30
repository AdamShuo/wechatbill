/**
 * 微信账单分析器 - 图表渲染模块
 * Version: 1.1.13
 */

const ChartManager = {
    charts: {},

    /**
     * 生成一组色调不同的颜色（支持任意数量）
     */
    generateColors(count) {
        // 预定义35种颜色 + 动态生成
        const basePalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD',
            '#FFA07A', '#F7DC6F', '#98D8C8', '#BDC3C7', '#E74C3C',
            '#3498DB', '#2ECC71', '#9B59B6', '#F39C12', '#1ABC9C',
            '#E67E22', '#27AE60', '#8E44AD', '#D35400', '#16A085',
            '#C0392B', '#2980B9', '#7F8C8D', '#F1C40F', '#2C3E50',
            '#FF6B8A', '#5DADE2', '#48C9B0', '#F4D03F', '#AF7AC5',
            '#E59866', '#76D7C4', '#D7BDE2', '#AAB7B8', '#DC7633'
        ];
        if (count <= basePalette.length) {
            return basePalette.slice(0, count);
        }
        // 超出预定义则用HSL循环生成
        const result = [...basePalette];
        for (let i = basePalette.length; i < count; i++) {
            const hue = (i * 137.5) % 360;
            result.push(`hsl(${hue}, 65%, 60%)`);
        }
        return result;
    },

    /**
     * 销毁已有图表
     */
    destroy(chartKey) {
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
            delete this.charts[chartKey];
        }
    },

    /**
     * 获取主题色
     */
    getThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            textColor: isDark ? '#CBD5E1' : '#64748B',
            gridColor: isDark ? '#334155' : '#E2E8F0',
            primary: '#6366F1',
            secondary: '#818CF8',
            success: '#10B981',
            danger: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };
    },

    /**
     * 渲染趋势折线图
     */
    renderTrendChart(canvasId, data, options = {}) {
        this.destroy(canvasId);
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const colors = this.getThemeColors();
        
        const chartData = {
            labels: data.map(item => item.period),
            datasets: [
                {
                    label: '收入',
                    data: data.map(item => item.income),
                    borderColor: colors.success,
                    backgroundColor: colors.success + '20',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: '支出',
                    data: data.map(item => item.expense),
                    borderColor: colors.danger,
                    backgroundColor: colors.danger + '20',
                    tension: 0.4,
                    fill: false
                }
            ]
        };
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: colors.textColor }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor }
                    },
                    x: {
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor }
                    }
                },
                ...options
            }
        });
    },

    /**
     * 渲染收入支出对比柱状图
     */
    renderComparisonChart(canvasId, data) {
        this.destroy(canvasId);
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const colors = this.getThemeColors();
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.period),
                datasets: [
                    {
                        label: '收入',
                        data: data.map(item => item.income),
                        backgroundColor: colors.success + 'CC',
                        borderColor: colors.success,
                        borderWidth: 1
                    },
                    {
                        label: '支出',
                        data: data.map(item => item.expense),
                        backgroundColor: colors.danger + 'CC',
                        borderColor: colors.danger,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: colors.textColor }
                    }
                },
                scales: {
                    y: {
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor }
                    },
                    x: {
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor }
                    }
                }
            }
        });
    },

    /**
     * 渲染分类饼图
     */
    renderCategoryPieChart(canvasId, data) {
        this.destroy(canvasId);
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const colors = this.getThemeColors();
        const chartColors = this.generateColors(data.length);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(item => item.name),
                datasets: [{
                    data: data.map(item => Math.abs(item.totalAmount || item.total || 0)),
                    backgroundColor: chartColors.slice(0, data.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { 
                            color: colors.textColor,
                            padding: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ¥${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * 渲染分类柱状图
     */
    renderCategoryBarChart(canvasId, data) {
        this.destroy(canvasId);
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const colors = this.getThemeColors();
        
        // 数据预处理：超过15个分类时，将占比不足2%的小分类合并为"其他"
        const MAX_DISPLAY = 15;
        const MIN_PCT = 0.02;
        let chartData = data;
        if (data.length > MAX_DISPLAY) {
            const totalAmount = data.reduce((s, d) => s + (d.totalAmount || 0), 0);
            const major = [];
            const minor = [];
            data.forEach(d => {
                const pct = (d.totalAmount || 0) / (totalAmount || 1);
                if (pct >= MIN_PCT) {
                    major.push(d);
                } else {
                    minor.push(d);
                }
            });
            if (major.length > MAX_DISPLAY) {
                chartData = major.slice(0, MAX_DISPLAY);
                minor.push(...major.slice(MAX_DISPLAY));
            } else {
                chartData = major;
            }
            if (minor.length > 0) {
                const otherAmount = minor.reduce((s, d) => s + Math.abs(d.totalAmount || 0), 0);
                chartData.push({
                    name: `其他（${minor.length}类）`,
                    totalAmount: otherAmount,
                    count: minor.reduce((s, d) => s + (d.count || 0), 0),
                    income: 0,
                    expense: 0,
                    percentage: parseFloat(((otherAmount / (totalAmount || 1)) * 100).toFixed(1))
                });
            }
        }

        const chartColors = this.generateColors(chartData.length);
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.map(item => item.name),
                datasets: [{
                    label: '总金额',
                    data: chartData.map(item => Math.abs(item.totalAmount || item.total || 0)),
                    backgroundColor: chartColors.map(c => c + 'CC'),
                    borderColor: chartColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor }
                    },
                    y: {
                        ticks: { color: colors.textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    /**
     * 渲染雷达图
     */
    renderRadarChart(canvasId, data) {
        this.destroy(canvasId);
        
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        const colors = this.getThemeColors();
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: data.map(item => item.name),
                datasets: [{
                    label: '消费金额',
                    data: data.map(item => item.total),
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + '20',
                    pointBackgroundColor: colors.primary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: colors.primary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: colors.textColor }
                    }
                },
                scales: {
                    r: {
                        ticks: { color: colors.textColor },
                        grid: { color: colors.gridColor },
                        pointLabels: { color: colors.textColor }
                    }
                }
            }
        });
    },

    /**
     * 更新图表主题
     */
    updateTheme() {
        Object.entries(this.charts).forEach(([key, chart]) => {
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = this.getThemeColors().textColor;
            }
            if (chart.options.scales?.x) {
                chart.options.scales.x.ticks.color = this.getThemeColors().textColor;
                chart.options.scales.x.grid.color = this.getThemeColors().gridColor;
            }
            if (chart.options.scales?.y) {
                chart.options.scales.y.ticks.color = this.getThemeColors().textColor;
                chart.options.scales.y.grid.color = this.getThemeColors().gridColor;
            }
            chart.update();
        });
    }
};

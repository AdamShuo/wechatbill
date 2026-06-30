/**
 * 微信账单分析器 - 主应用入口
 * Version: 1.1.13
 */

const App = {
    transactions: [],
    filteredTransactions: [],
    currentPage: 'upload',
    pagination: {
        currentPage: 1,
        pageSize: 50
    },
    // ★ v1.1.3: 交叉查询页独立分页状态
    queryPagination: {
        currentPage: 1,
        pageSize: 50
    },
    currentPeriod: 'month',

    /**
     * 应用初始化
     */
    async init() {
        this.bindEvents();
        this.bindTutorialEvents();
        this.loadSavedData();
        this.updateStatusBar();
        console.log('微信账单分析器 v1.1.14 已启动');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 导航按钮
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                this.navigate(page);
            });
        });

        // 主题切换
        document.getElementById('themeToggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        // 移动端菜单
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
            document.querySelector('.nav-menu')?.classList.toggle('active');
        });

        // 上传相关
        this.bindUploadEvents();

        // 排序按钮
        document.querySelectorAll('[data-sort]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sortTransactions(btn.dataset.sort);
            });
        });

        // 分页
        document.getElementById('prevPage')?.addEventListener('click', () => {
            this.changePage(-1);
        });
        document.getElementById('nextPage')?.addEventListener('click', () => {
            this.changePage(1);
        });
        document.getElementById('pageSizeSelect')?.addEventListener('change', (e) => {
            this.pagination.pageSize = parseInt(e.target.value);
            this.pagination.currentPage = 1;
            this.renderTable();
        });

        // 搜索
        document.getElementById('searchInput')?.addEventListener('input', Utils.debounce((e) => {
            this.searchTransactions(e.target.value);
        }, 300));

        // 周期选择
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.renderStats();
            });
        });

        // 筛选
        document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
            this.applyFilters();
        });
        document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
            this.resetFilters();
        });

        // ★ v1.1.3: 交叉查询页分页控制
        document.getElementById('queryPrevPage')?.addEventListener('click', () => {
            this.changeQueryPage(-1);
        });
        document.getElementById('queryNextPage')?.addEventListener('click', () => {
            this.changeQueryPage(1);
        });
        document.getElementById('queryPageSizeSelect')?.addEventListener('change', (e) => {
            this.queryPagination.pageSize = parseInt(e.target.value);
            this.queryPagination.currentPage = 1;
            this.renderFilterTable();
        });

        // ★ v1.1.4: 交叉查询导出
        document.getElementById('exportQueryPDFBtn')?.addEventListener('click', () => {
            this.exportQueryPDF();
        });
        document.getElementById('exportQueryExcelBtn')?.addEventListener('click', () => {
            this.exportQueryExcel();
        });

        // 交易类型变更 → 实时同步其他下拉框 + 自动应用筛选
        document.getElementById('filterType')?.addEventListener('change', () => {
            this.onFilterTypeChange();
        });

        // 一键清除数据
        document.getElementById('clearAllDataBtn')?.addEventListener('click', () => {
            this.clearAllData();
        });

        // 报告
        document.getElementById('generateReportBtn')?.addEventListener('click', () => {
            Report.generateReport(this.transactions);
        });
        document.getElementById('exportPDFBtn')?.addEventListener('click', () => {
            Report.exportPDF();
        });
        document.getElementById('exportImageBtn')?.addEventListener('click', () => {
            Report.exportImage();
        });
        document.getElementById('printReportBtn')?.addEventListener('click', () => {
            Report.printReport();
        });

        // 分类管理
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
            this.showAddCategoryModal();
        });
        
        // 模态框关闭按钮
        document.getElementById('categoryModalClose')?.addEventListener('click', () => {
            this.hideCategoryModal();
        });
        document.getElementById('categoryModalCancel')?.addEventListener('click', () => {
            this.hideCategoryModal();
        });
        document.getElementById('categoryModalSave')?.addEventListener('click', () => {
            this.saveCategory();
        });
        
        // 点击遮罩关闭
        document.getElementById('categoryModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'categoryModal') {
                this.hideCategoryModal();
            }
        });
    },

    /**
     * 绑定上传事件
     */
    bindUploadEvents() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        const selectFileBtn = document.getElementById('selectFileBtn');

        // 点击选择文件
        selectFileBtn?.addEventListener('click', () => {
            fileInput?.click();
        });

        fileInput?.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // 拖拽上传
        uploadZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone?.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        uploadZone?.addEventListener('click', (e) => {
            if (e.target !== selectFileBtn) {
                fileInput?.click();
            }
        });
    },

    /**
     * ★ v1.1.11: 绑定教程悬浮提示交互（点击展开，点击外部关闭）
     */
    bindTutorialEvents() {
        const trigger = document.getElementById('tutorialTrigger');
        const popup = document.getElementById('tutorialPopup');
        const closeBtn = document.getElementById('tutorialPopupClose');
        const area = document.getElementById('tutorialArea');

        if (!trigger || !popup || !area) return;

        // 点击触发按钮 → 切换展开/收起
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            area.classList.toggle('active');
        });

        // 点击关闭按钮 → 关闭
        closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            area.classList.remove('active');
        });

        // 点击弹窗内部文字 → 不关闭（方便用户选择和滚动）
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // 点击页面任意其他位置 → 关闭
        document.addEventListener('click', (e) => {
            if (area.classList.contains('active') && !area.contains(e.target)) {
                area.classList.remove('active');
            }
        });

        // ★ 触屏支持：touchend 也触发关闭
        document.addEventListener('touchend', (e) => {
            if (area.classList.contains('active') && !area.contains(e.target)) {
                area.classList.remove('active');
            }
        });
    },

    /**
     * 处理上传的文件
     */
    async handleFiles(files) {
        const validFiles = Array.from(files).filter(file => Utils.isExcelFile(file.name));
        
        if (validFiles.length === 0) {
            Utils.showToast('请选择有效的Excel文件', 'error');
            return;
        }

        this.showUploadProgress();
        
        try {
            const result = await Parser.parseMultipleExcel(validFiles);
            this.hideUploadProgress();
            
            if (result.successFiles > 0) {
                this.transactions = [...this.transactions, ...result.transactions];
                this.transactions = Utils.uniqueArray(this.transactions, 'id');
                
                // 自动分类（含新交易类型检测）
                this.transactions = Classifier.autoClassify(this.transactions);
                
                // 检查是否发现了新的交易类型
                const newTypes = Classifier.getLastNewTypes();
                if (newTypes && newTypes.length > 0) {
                    console.log('发现新交易类型:', newTypes);
                    const typeNames = newTypes.map(t => `"${t.typeName}"`).join('、');
                    Utils.showToast(
                        `🔍 发现 ${newTypes.length} 种新交易类型：${typeNames}，已自动归类，可在「分类管理」中查看调整`,
                        'info', 6000
                    );
                }
                
                // 保存数据
                Utils.saveToStorage('transactions', this.transactions);
                
                // 更新UI
                this.renderUploadedFiles(result.results);
                this.updateDataSummary();
                this.updateStatusBar();
                
                Utils.showToast(`成功导入 ${result.totalTransactions} 条记录`, 'success');
            }
            
            if (result.results.some(r => r.status === 'error')) {
                console.warn('部分文件解析失败:', result.results.filter(r => r.status === 'error'));
            }
        } catch (error) {
            this.hideUploadProgress();
            Utils.showToast('文件解析失败: ' + error.message, 'error');
        }
    },

    /**
     * 显示上传进度
     */
    showUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            progress.style.display = 'block';
            document.getElementById('progressFill').style.width = '0%';
            document.getElementById('progressPercent').textContent = '0%';
        }
    },

    /**
     * 隐藏上传进度
     */
    hideUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            progress.style.display = 'none';
        }
    },

    /**
     * 渲染已上传文件列表
     */
    renderUploadedFiles(results) {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;
        
        const html = results.map(result => `
            <div class="file-item">
                <div class="file-item-info">
                    <span class="file-item-name">${result.fileName}</span>
                    <span class="file-item-size">${result.fileSize}</span>
                    <span class="file-item-size">${result.count} 条记录</span>
                </div>
                <div class="file-item-status">
                    <span class="status-badge ${result.status}">${result.status === 'success' ? '成功' : '失败'}</span>
                </div>
            </div>
        `).join('');
        
        fileList.innerHTML = html;
        document.getElementById('uploadedFiles').style.display = 'block';
    },

    /**
     * 更新数据摘要
     */
    updateDataSummary() {
        const summary = document.getElementById('dataSummary');
        const clearArea = document.getElementById('clearDataArea');
        
        if (this.transactions.length === 0) {
            if (summary) summary.style.display = 'none';
            if (clearArea) clearArea.style.display = 'none';
            return;
        }
        
        const dates = this.transactions.map(t => new Date(t.transactionTime)).sort((a, b) => a - b);
        
        document.getElementById('totalTransactions').textContent = Utils.formatNumber(this.transactions.length);
        document.getElementById('totalIncome').textContent = Utils.formatMoney(
            this.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
        );
        document.getElementById('totalExpense').textContent = Utils.formatMoney(
            this.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
        );
        document.getElementById('timeSpan').textContent = 
            dates.length > 0 ? `${dates[0].toLocaleDateString()} ~ ${dates[dates.length-1].toLocaleDateString()}` : '-';
        
        if (summary) summary.style.display = 'grid';
        
        // 显示清除区域
        if (clearArea) {
            clearArea.style.display = 'block';
            const countEl = document.getElementById('clearDataCount');
            if (countEl) countEl.textContent = Utils.formatNumber(this.transactions.length);
        }
    },

    /**
     * 导航到指定页面
     */
    navigate(page) {
        this.currentPage = page;
        
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });
        
        // 切换页面
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
        
        // 页面特定渲染
        if (page === 'list') {
            this.renderTable();
        } else if (page === 'stats') {
            this.renderStats();
        } else if (page === 'category') {
            this.renderCategoryPage();
        } else if (page === 'query') {
            this.renderQueryPage();
        }
        
        // 关闭移动端菜单
        document.querySelector('.nav-menu')?.classList.remove('active');
    },

    /**
     * 渲染表格
     */
    renderTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;
        
        const dataToRender = this.filteredTransactions.length > 0 
            ? this.filteredTransactions 
            : this.transactions;
        
        if (dataToRender.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">
                        <div class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
                                <rect x="8" y="12" width="32" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M8 20h32" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <p>暂无数据，请先上传账单文件</p>
                        </div>
                    </td>
                </tr>
            `;
            this.updatePagination();
            return;
        }
        
        const start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
        const end = start + this.pagination.pageSize;
        const pageData = dataToRender.slice(start, end);
        
        tbody.innerHTML = pageData.map(tx => `
            <tr>
                <td>${Utils.formatDateTime(tx.transactionTime)}</td>
                <td>${tx.transactionType}</td>
                <td>${tx.counterparty}</td>
                <td>${tx.description || '-'}</td>
                <td style="color: ${tx.amount >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                    ${Utils.formatMoney(tx.amount)}
                </td>
                <td>${tx.paymentMethod}</td>
                <td><span class="status-badge success">${tx.status}</span></td>
                <td>
                    <select onchange="App.updateCategory('${tx.id}', this.value)" style="border: none; background: transparent; color: var(--text-primary); cursor: pointer;">
                        ${Classifier.getAllCategories().map(cat => 
                            `<option value="${cat.name}" ${cat.name === tx.category ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
                        ).join('')}
                    </select>
                </td>
            </tr>
        `).join('');
        
        this.updatePagination();
    },

    /**
     * 更新分类
     */
    updateCategory(transactionId, category) {
        const tx = this.transactions.find(t => t.id === transactionId);
        if (tx) {
            tx.category = category;
            Classifier.updateCategory(transactionId, category);
            Utils.saveToStorage('transactions', this.transactions);
        }
    },

    /**
     * 更新分页控件
     */
    updatePagination() {
        const dataToRender = this.filteredTransactions.length > 0 
            ? this.filteredTransactions 
            : this.transactions;
        
        const totalPages = Math.ceil(dataToRender.length / this.pagination.pageSize);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (pageInfo) {
            pageInfo.textContent = `第 ${this.pagination.currentPage} / ${totalPages || 1} 页`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.pagination.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.pagination.currentPage >= totalPages;
        }
    },

    /**
     * 切换页码
     */
    changePage(delta) {
        const dataToRender = this.filteredTransactions.length > 0 
            ? this.filteredTransactions 
            : this.transactions;
        
        const totalPages = Math.ceil(dataToRender.length / this.pagination.pageSize);
        const newPage = this.pagination.currentPage + delta;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.pagination.currentPage = newPage;
            this.renderTable();
        }
    },

    /**
     * 搜索交易
     */
    searchTransactions(query) {
        if (!query || query.trim() === '') {
            this.filteredTransactions = [];
        } else {
            const q = query.toLowerCase();
            this.filteredTransactions = this.transactions.filter(tx => 
                tx.counterparty.toLowerCase().includes(q) ||
                tx.description.toLowerCase().includes(q)
            );
        }
        
        this.pagination.currentPage = 1;
        this.renderTable();
    },

    /**
     * 排序交易
     */
    sortTransactions(sortType) {
        const sortFns = {
            'time-desc': (a, b) => new Date(b.transactionTime) - new Date(a.transactionTime),
            'time-asc': (a, b) => new Date(a.transactionTime) - new Date(b.transactionTime),
            'amount-desc': (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
            'amount-asc': (a, b) => Math.abs(a.amount) - Math.abs(b.amount)
        };
        
        this.transactions.sort(sortFns[sortType] || sortFns['time-desc']);
        Utils.saveToStorage('transactions', this.transactions);
        this.renderTable();
        Utils.showToast('排序完成', 'success');
    },

    /**
     * 渲染统计页面
     */
    renderStats() {
        if (this.transactions.length === 0) return;
        
        const metrics = Stats.calcKeyMetrics(this.transactions);
        
        document.getElementById('avgDailyExpense').textContent = Utils.formatMoney(metrics.avgDailyExpense);
        document.getElementById('avgMonthlyExpense').textContent = Utils.formatMoney(metrics.avgMonthlyExpense);
        document.getElementById('maxTransaction').textContent = Utils.formatMoney(metrics.maxTransaction);
        document.getElementById('transactionFrequency').textContent = `${metrics.transactionFrequency.toFixed(1)}笔/月`;
        
        const periodStats = Stats.calcByPeriod(this.transactions, this.currentPeriod);
        ChartManager.renderTrendChart('trendChart', periodStats);
        ChartManager.renderComparisonChart('comparisonChart', periodStats);
    },

    /**
     * 渲染分类页面
     */
    renderCategoryPage() {
        const categoryStats = this.transactions.length > 0 
            ? Classifier.getCategoryStats(this.transactions) 
            : [];
        
        // 只有有数据时才渲染图表
        if (this.transactions.length > 0) {
            const categorizedStats = Utils.calcPercentages(categoryStats);
            ChartManager.renderCategoryPieChart('categoryPieChart', categorizedStats);
            ChartManager.renderCategoryBarChart('categoryBarChart', categorizedStats);
        }
        
        // 渲染分类规则列表
        this.renderCategoryRules(categoryStats);

        // 渲染交易类型管理面板
        this.renderTypeManagement();
    },

    /**
     * 渲染分类规则列表
     */
    renderCategoryRules(categoryStats) {
        const rulesContainer = document.getElementById('categoryRules');
        if (!rulesContainer) return;
        
        const allCategories = Classifier.getAllCategories();
        if (!allCategories || allCategories.length === 0) {
            rulesContainer.innerHTML = '<p class="text-muted" style="text-align:center;padding:24px;">暂无分类规则</p>';
            return;
        }
        
        rulesContainer.innerHTML = allCategories.map(cat => {
            const stat = categoryStats.find(s => s.name === cat.name);
            const count = stat ? stat.count : 0;
            const amount = stat ? Utils.formatMoney(stat.totalAmount) : '¥0.00';
            const kw = (cat.keywords || []).slice(0, 3).join(', ');
            const kwFull = (cat.keywords || []).join(', ');
            return `
                <div class="category-rule" data-category="${cat.name}">
                    <div class="category-rule-info">
                        <div class="category-rule-color" style="background: ${cat.color}"></div>
                        <span class="category-rule-name" title="${cat.name}">${cat.icon}&nbsp;${cat.name}</span>
                        <span class="category-rule-keywords" title="${kwFull}">${kw}${(cat.keywords || []).length > 3 ? '...' : ''}</span>
                    </div>
                    <div class="category-rule-right">
                        <span class="category-rule-count">${count}笔 / ${amount}</span>
                        <button class="btn btn-sm btn-danger delete-category-btn" data-category="${cat.name}" title="删除分类">✕</button>
                    </div>
                </div>
            `;
        }).join('');
        
        // 绑定删除按钮事件
        rulesContainer.querySelectorAll('.delete-category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const categoryName = btn.dataset.category;
                this.deleteCategory(categoryName);
            });
        });
        
        // 绑定规则行点击编辑
        rulesContainer.querySelectorAll('.category-rule').forEach(rule => {
            rule.addEventListener('click', () => {
                const categoryName = rule.dataset.category;
                this.showEditCategoryModal(categoryName);
            });
        });
    },

    /**
     * 应用筛选（v1.1.3: 分离筛选逻辑与表格渲染，支持分页）
     */
    applyFilters() {
        const startDate = document.getElementById('filterStartDate')?.value;
        const endDate = document.getElementById('filterEndDate')?.value;
        const minAmount = parseFloat(document.getElementById('filterMinAmount')?.value) || 0;
        const maxAmount = parseFloat(document.getElementById('filterMaxAmount')?.value) || 999999;
        const type = document.getElementById('filterType')?.value;
        const counterparty = document.getElementById('filterCounterparty')?.value?.toLowerCase();
        const payment = document.getElementById('filterPayment')?.value;
        const status = document.getElementById('filterStatus')?.value;
        
        this.filteredTransactions = this.transactions.filter(tx => {
            if (startDate && tx.transactionTime < startDate) return false;
            if (endDate && tx.transactionTime > endDate + 'T23:59:59') return false;
            if (Math.abs(tx.amount) < minAmount || Math.abs(tx.amount) > maxAmount) return false;
            if (type && tx.transactionType !== type) return false;
            if (counterparty && !tx.counterparty.toLowerCase().includes(counterparty)) return false;
            if (payment && tx.paymentMethod !== payment) return false;
            if (status && tx.status !== status) return false;
            
            return true;
        });
        
        // ★ v1.1.3: 筛选后重置分页到第1页
        this.queryPagination.currentPage = 1;

        // 更新汇总信息
        const totalExpense = this.filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalIncome = this.filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        
        document.getElementById('filteredCount').textContent = Utils.formatNumber(this.filteredTransactions.length);
        document.getElementById('filteredExpense').textContent = Utils.formatMoney(totalExpense);
        document.getElementById('filteredIncome').textContent = Utils.formatMoney(totalIncome);
        
        // ★ v1.1.3: 调用分页渲染（替代原来的硬编码 slice(0, 100)）
        this.renderFilterTable();
        
        // ★ v1.1.4: 有结果时显示导出按钮
        this.toggleQueryExportActions(this.filteredTransactions.length > 0);
        
        Utils.showToast(`找到 ${this.filteredTransactions.length} 条记录`, 'success');
    },

    /**
     * ★ v1.1.3: 渲染筛选结果表格（支持分页）
     */
    renderFilterTable() {
        const tbody = document.getElementById('filterTableBody');
        if (!tbody) return;

        if (this.filteredTransactions.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">
                        <div class="empty-state">
                            <p>暂无匹配记录</p>
                        </div>
                    </td>
                </tr>`;
            this.updateQueryPagination();
            return;
        }

        const start = (this.queryPagination.currentPage - 1) * this.queryPagination.pageSize;
        const end = start + this.queryPagination.pageSize;
        const pageData = this.filteredTransactions.slice(start, end);

        tbody.innerHTML = pageData.map(tx => `
            <tr>
                <td>${Utils.formatDateTime(tx.transactionTime)}</td>
                <td>${tx.transactionType}</td>
                <td>${tx.counterparty}</td>
                <td>${tx.description || '-'}</td>
                <td style="color: ${tx.amount >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.formatMoney(tx.amount)}</td>
                <td>${tx.paymentMethod}</td>
                <td>${tx.status}</td>
                <td>${tx.category}</td>
            </tr>
        `).join('');

        this.updateQueryPagination();
    },

    /**
     * ★ v1.1.3: 更新交叉查询分页控件
     */
    updateQueryPagination() {
        const totalPages = Math.max(1, Math.ceil(this.filteredTransactions.length / this.queryPagination.pageSize));
        const pageInfo = document.getElementById('queryPageInfo');
        const prevBtn = document.getElementById('queryPrevPage');
        const nextBtn = document.getElementById('queryNextPage');

        if (pageInfo) {
            pageInfo.textContent = `第 ${this.queryPagination.currentPage} / ${totalPages} 页（共 ${this.filteredTransactions.length} 条）`;
        }
        if (prevBtn) {
            prevBtn.disabled = this.queryPagination.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.queryPagination.currentPage >= totalPages;
        }
    },

    /**
     * ★ v1.1.3: 交叉查询页翻页
     */
    changeQueryPage(delta) {
        const totalPages = Math.max(1, Math.ceil(this.filteredTransactions.length / this.queryPagination.pageSize));
        const newPage = this.queryPagination.currentPage + delta;

        if (newPage >= 1 && newPage <= totalPages) {
            this.queryPagination.currentPage = newPage;
            this.renderFilterTable();
            // 滚动到表格顶部
            const tableContainer = document.querySelector('#page-query .table-container');
            if (tableContainer) {
                tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    },

    /**
     * 重置筛选（v1.1.3: 同时重置查询分页状态）
     */
    resetFilters() {
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        document.getElementById('filterMinAmount').value = '';
        document.getElementById('filterMaxAmount').value = '';
        document.getElementById('filterType').value = '';
        document.getElementById('filterCounterparty').value = '';
        document.getElementById('filterPayment').value = '';
        document.getElementById('filterStatus').value = '';
        
        this.filteredTransactions = [];
        this.queryPagination.currentPage = 1;
        document.getElementById('filteredCount').textContent = '0';
        document.getElementById('filteredExpense').textContent = '¥0.00';
        document.getElementById('filteredIncome').textContent = '¥0.00';
        document.getElementById('filterTableBody').innerHTML = '';
        this.updateQueryPagination();
        this.toggleQueryExportActions(false);
        
        Utils.showToast('筛选已重置', 'info');
    },

    /**
     * 更新状态栏（v1.1.0：底部固定栏已移除，此方法仅计算汇总数供其他模块使用）
     */
    updateStatusBar() {
        // v1.1.0: 底部固定状态栏已移除，汇总数据在各页面摘要卡片中展示
        // 保留此方法避免调用处报错
    },

    /**
     * 切换主题
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        Utils.saveToStorage('theme', newTheme);
        
        // 更新图表主题
        if (Object.keys(ChartManager.charts).length > 0) {
            ChartManager.updateTheme();
        }
    },

    /**
     * 加载保存的数据
     */
    loadSavedData() {
        // 加载主题
        const savedTheme = Utils.loadFromStorage('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        // 加载交易数据
        const savedTransactions = Utils.loadFromStorage('transactions');
        if (savedTransactions && savedTransactions.length > 0) {
            this.transactions = savedTransactions;
            this.transactions = Classifier.autoClassify(this.transactions);
            this.updateDataSummary();
            this.updateStatusBar();
            Utils.showToast('已恢复上次的数据', 'info');
        }
    },

    /**
     * 显示添加分类弹窗
     */
    showAddCategoryModal() {
        this.showCategoryModal('添加新分类', '', '', '#', '📌');
    },

    /**
     * 显示编辑分类弹窗
     */
    showEditCategoryModal(categoryName) {
        const cat = Classifier.getAllCategories().find(c => c.name === categoryName);
        if (!cat) return;
        this.showCategoryModal('编辑分类', cat.name, (cat.keywords || []).join('、'), cat.color, cat.icon);
    },

    /**
     * 显示分类弹窗
     */
    showCategoryModal(title, name, keywords, color, icon) {
        let modal = document.getElementById('categoryModal');
        if (!modal) {
            // 动态创建模态框
            modal = document.createElement('div');
            modal.id = 'categoryModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 id="categoryModalTitle">${title}</h3>
                        <button class="modal-close" id="categoryModalClose">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>分类名称 <span style="color:#EF4444">*</span></label>
                            <input type="text" id="categoryNameInput" placeholder="例如：医疗健康" maxlength="20"/>
                        </div>
                        <div class="form-group">
                            <label>关键词（用顿号、逗号或空格分隔）</label>
                            <textarea id="categoryKeywordsInput" rows="3" placeholder="例如：医院、诊所、药店、体检"></textarea>
                            <small style="color:var(--text-secondary)">系统会根据交易对方和商品说明自动匹配这些关键词</small>
                        </div>
                        <div class="form-row">
                            <div class="form-group" style="flex:1">
                                <label>颜色标识</label>
                                <input type="color" id="categoryColorInput" value="${color}"/>
                            </div>
                            <div class="form-group" style="flex:1">
                                <label>图标</label>
                                <input type="text" id="categoryIconInput" placeholder="📌" maxlength="2"/>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="categoryModalCancel">取消</button>
                        <button class="btn btn-primary" id="categoryModalSave">保存</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // 重新绑定模态框事件
            document.getElementById('categoryModalClose')?.addEventListener('click', () => {
                this.hideCategoryModal();
            });
            document.getElementById('categoryModalCancel')?.addEventListener('click', () => {
                this.hideCategoryModal();
            });
            document.getElementById('categoryModalSave')?.addEventListener('click', () => {
                this.saveCategory();
            });
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'categoryModal') {
                    this.hideCategoryModal();
                }
            });
        }
        
        document.getElementById('categoryModalTitle').textContent = title;
        document.getElementById('categoryNameInput').value = name;
        document.getElementById('categoryKeywordsInput').value = keywords;
        document.getElementById('categoryColorInput').value = color;
        document.getElementById('categoryIconInput').value = icon;
        
        // 存储编辑模式标记
        modal.dataset.editMode = name ? 'edit' : 'add';
        modal.dataset.originalName = name;
        
        modal.style.display = 'flex';
        setTimeout(() => {
            document.getElementById('categoryNameInput').focus();
        }, 100);
    },

    /**
     * 隐藏分类弹窗
     */
    hideCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    /**
     * 保存分类
     */
    saveCategory() {
        const name = document.getElementById('categoryNameInput').value.trim();
        const keywordsStr = document.getElementById('categoryKeywordsInput').value.trim();
        const color = document.getElementById('categoryColorInput').value;
        const icon = document.getElementById('categoryIconInput').value.trim() || '📌';
        
        // 验证
        if (!name) {
            Utils.showToast('请输入分类名称', 'error');
            return;
        }
        
        // 解析关键词
        const keywords = keywordsStr 
            ? keywordsStr.split(/[、,，\s]+/).filter(k => k.length > 0) 
            : [];
        
        const modal = document.getElementById('categoryModal');
        const editMode = modal.dataset.editMode;
        const originalName = modal.dataset.originalName;
        
        if (editMode === 'edit' && originalName) {
            // 编辑模式：更新现有分类
            Classifier.updateCategory(originalName, { name, keywords, color, icon });
            Utils.showToast('分类已更新', 'success');
        } else {
            // 添加模式：新增分类
            Classifier.addCategory(name, keywords, color, icon);
            Utils.showToast('分类已添加', 'success');
        }
        
        this.hideCategoryModal();
        
        // 重新渲染分类页面
        const categoryStats = this.transactions.length > 0 
            ? Classifier.getCategoryStats(this.transactions) 
            : [];
        this.renderCategoryRules(categoryStats);
    },

    /**
     * 删除分类
     */
    async deleteCategory(categoryName) {
        const confirmed = await Utils.confirm(`确定要删除「${categoryName}」分类吗？`);
        if (!confirmed) return;
        
        Classifier.deleteCategory(categoryName);
        Utils.showToast(`分类「${categoryName}」已删除`, 'success');
        
        // 重新渲染分类页面
        const categoryStats = this.transactions.length > 0 
            ? Classifier.getCategoryStats(this.transactions) 
            : [];
        this.renderCategoryRules(categoryStats);
    },

    /**
     * 渲染交叉查询页面（v1.1.3: 进入时重置分页状态）
     */
    renderQueryPage() {
        this.queryPagination.currentPage = 1;
        this.populateFilterDropdowns();
        // 如果已有筛选结果则重新渲染表格（支持分页）
        if (this.filteredTransactions.length > 0) {
            this.renderFilterTable();
        } else {
            this.updateQueryPagination();
        }
    },

    /**
     * 从当前交易数据中动态提取并填充所有筛选下拉框
     */
    populateFilterDropdowns() {
        // 提取所有唯一的交易类型（按出现次数排序）
        const typeCount = {};
        this.transactions.forEach(tx => {
            const t = tx.transactionType || '未知';
            typeCount[t] = (typeCount[t] || 0) + 1;
        });
        const types = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);

        const typeSelect = document.getElementById('filterType');
        if (typeSelect) {
            const currentVal = typeSelect.value;
            typeSelect.innerHTML = '<option value="">全部交易类型</option>';
            types.forEach(([name, count]) => {
                typeSelect.innerHTML += `<option value="${name}">${name}（${count}笔）</option>`;
            });
            // 恢复之前选中的值
            if (currentVal && [...typeSelect.options].some(o => o.value === currentVal)) {
                typeSelect.value = currentVal;
            }
        }

        // 提取所有唯一的支付方式
        const paymentSet = new Set();
        this.transactions.forEach(tx => {
            if (tx.paymentMethod) paymentSet.add(tx.paymentMethod);
        });
        const paymentSelect = document.getElementById('filterPayment');
        if (paymentSelect) {
            const currentVal = paymentSelect.value;
            paymentSelect.innerHTML = '<option value="">全部方式</option>';
            [...paymentSet].sort().forEach(p => {
                paymentSelect.innerHTML += `<option value="${p}">${p}</option>`;
            });
            if (currentVal && [...paymentSelect.options].some(o => o.value === currentVal)) {
                paymentSelect.value = currentVal;
            }
        }

        // 提取所有唯一的状态
        const statusSet = new Set();
        this.transactions.forEach(tx => {
            if (tx.status) statusSet.add(tx.status);
        });
        const statusSelect = document.getElementById('filterStatus');
        if (statusSelect) {
            const currentVal = statusSelect.value;
            statusSelect.innerHTML = '<option value="">全部状态</option>';
            [...statusSet].sort().forEach(s => {
                statusSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
            if (currentVal && [...statusSelect.options].some(o => o.value === currentVal)) {
                statusSelect.value = currentVal;
            }
        }
    },

    /**
     * 交易类型变更时：联动更新支付方式/状态下拉框，并自动应用筛选
     */
    onFilterTypeChange() {
        const selectedType = document.getElementById('filterType')?.value;

        // 根据选中的交易类型，获取子集数据
        const subset = selectedType
            ? this.transactions.filter(tx => tx.transactionType === selectedType)
            : this.transactions;

        // 更新支付方式下拉 → 仅显示子集中存在的支付方式
        const paymentSet = new Set();
        subset.forEach(tx => {
            if (tx.paymentMethod) paymentSet.add(tx.paymentMethod);
        });
        const paymentSelect = document.getElementById('filterPayment');
        if (paymentSelect) {
            const currentVal = paymentSelect.value;
            paymentSelect.innerHTML = '<option value="">全部方式</option>';
            [...paymentSet].sort().forEach(p => {
                paymentSelect.innerHTML += `<option value="${p}">${p}</option>`;
            });
            if (currentVal && [...paymentSelect.options].some(o => o.value === currentVal)) {
                paymentSelect.value = currentVal;
            } else {
                paymentSelect.value = '';
            }
        }

        // 更新状态下拉 → 仅显示子集中存在的状态
        const statusSet = new Set();
        subset.forEach(tx => {
            if (tx.status) statusSet.add(tx.status);
        });
        const statusSelect = document.getElementById('filterStatus');
        if (statusSelect) {
            const currentVal = statusSelect.value;
            statusSelect.innerHTML = '<option value="">全部状态</option>';
            [...statusSet].sort().forEach(s => {
                statusSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
            if (currentVal && [...statusSelect.options].some(o => o.value === currentVal)) {
                statusSelect.value = currentVal;
            } else {
                statusSelect.value = '';
            }
        }

        // 自动应用筛选（实时同步结果）
        this.applyFilters();
    },

    /**
     * 一键清除所有已上传数据（v1.1.2: 同时清除分类规则和类型映射，确保彻底重置）
     * 两次确认，防止误操作
     */
    async clearAllData() {
        // 第一次确认
        const firstConfirm = await Utils.confirm(
            '⚠️ 确认清空所有数据？\n\n此操作将删除所有已上传的账单数据（共 ' + 
            Utils.formatNumber(this.transactions.length) + ' 条记录），以及自定义分类规则、类型映射，无法恢复。'
        );
        if (!firstConfirm) return;

        // 第二次确认（加强）
        const secondConfirm = await Utils.confirm(
            '🔴 再次确认\n\n清空后所有分析结果、筛选状态、分类调整、自定义规则将全部丢失。\n建议先导出报告备份。\n\n确定要清空吗？'
        );
        if (!secondConfirm) return;

        // 执行清除 - 内存状态
        this.transactions = [];
        this.filteredTransactions = [];
        this.pagination.currentPage = 1;

        // ★ v1.1.2: 彻底清除所有 localStorage 数据
        Utils.clearStorage('transactions');
        Utils.clearStorage('classifier_rules');      // 清除旧版分类规则
        Utils.clearStorage('typeManager_userMap');    // 清除用户类型映射
        Utils.clearStorage('typeManager_unknownTypes'); // 清除未知类型记录

        // ★ v1.1.2: 重置 Classifier 和 TypeManager 内存状态，强制同步最新规则
        TypeManager.userTypeMap = {};
        TypeManager.unknownTypes = {};
        Classifier.customRules = [];
        Classifier.syncFromTypeManager();  // 用最新 v1.1.2 规则重新初始化

        // 重置上传页面UI
        const fileList = document.getElementById('fileList');
        if (fileList) fileList.innerHTML = '';
        const uploadedFiles = document.getElementById('uploadedFiles');
        if (uploadedFiles) uploadedFiles.style.display = 'none';
        const clearArea = document.getElementById('clearDataArea');
        if (clearArea) clearArea.style.display = 'none';

        // 重置数据摘要
        const summary = document.getElementById('dataSummary');
        if (summary) summary.style.display = 'none';

        // 重置筛选面板
        this.resetFilters();
        // 重置筛选下拉框为初始状态
        const typeSelect = document.getElementById('filterType');
        if (typeSelect) typeSelect.innerHTML = '<option value="">全部（暂无数据）</option>';

        // 更新状态栏
        this.updateStatusBar();

        // 清除所有图表
        Object.keys(ChartManager.charts).forEach(key => {
            ChartManager.destroy(key);
        });

        // 清空可能的表格显示
        const tbody = document.getElementById('tableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">
                        <div class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
                                <rect x="8" y="12" width="32" height="28" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M8 20h32" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            <p>暂无数据，请先上传账单文件</p>
                        </div>
                    </td>
                </tr>
            `;
        }

        Utils.showToast('所有数据已清空，状态已重置', 'success');
    },

    /**
     * 渲染交易类型管理面板
     * 展示：已知类型映射 + 未确认的新类型
     */
    renderTypeManagement() {
        const container = document.getElementById('typeManagementPanel');
        if (!container) return;

        const report = Classifier.getTypeReport();
        const unknownTypes = TypeManager.getUnknownTypes();

        let html = `
            <div class="type-mgmt-section">
                <h4 class="type-mgmt-title">
                    🔧 交易类型动态知识库
                    <span class="badge badge-builtin">内置 ${report.builtinCount} 种</span>
                    <span class="badge badge-user">自定义 ${report.userCount} 种</span>
                    ${unknownTypes.length > 0 ? `<span class="badge badge-new">新发现 ${unknownTypes.length} 种</span>` : ''}
                </h4>
        `;

        // 未确认的新类型
        if (unknownTypes.length > 0) {
            html += `<div class="type-mgmt-subsection">
                <h5>🆕 新发现的交易类型（待确认）</h5>`;

            // ★ v1.1.10: 当有多个未确认类型时显示「确认所有」按钮
            if (unknownTypes.length >= 1) {
                html += `<div style="margin-bottom:12px;">
                    <button class="btn btn-success btn-confirm-all-types" style="font-size:0.85rem;padding:8px 20px;">
                        ✅ 确认所有（${unknownTypes.length}项）
                    </button>
                    <span style="color:var(--text-muted);font-size:0.75rem;margin-left:8px;">
                        将全部使用推断分类一键确认
                    </span>
                </div>`;
            }

            html += `<div class="type-mgmt-list">`;
            
            unknownTypes.forEach(ut => {
                html += `
                <div class="type-mgmt-item unknown" data-type="${ut.typeName}">
                    <div class="type-item-info">
                        <span class="type-item-name">${ut.typeName}</span>
                        <span class="type-item-count">${ut.count} 笔</span>
                        <span class="type-item-inferred">推断为 → ${ut.inferredCategory}</span>
                    </div>
                    <div class="type-item-actions">
                        <select class="type-category-select" id="catSelect_${ut.typeName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}">
                            ${this.getAllCategoryOptions(ut.inferredCategory)}
                        </select>
                        <button class="btn btn-sm btn-primary confirm-type-btn" data-type="${ut.typeName}">确认</button>
                    </div>
                </div>`;
            });
            
            html += `</div></div>`;
        }

        // 已知类型映射表
        html += `<div class="type-mgmt-subsection">
            <h5>📋 已收录的交易类型映射</h5>
            <p class="text-muted" style="font-size:0.8rem;margin-bottom:12px;">系统内有${report.builtinCount}种内置类型 + ${report.userCount}种自定义类型，新发现的类型会自动添加到上方列表</p>
            <div class="type-mgmt-list">`;

        // 展示用户自定义的映射
        const userMappings = TypeManager.getUserMappings();
        if (userMappings.length > 0) {
            userMappings.forEach(mapping => {
                html += `
                <div class="type-mgmt-item user" data-type="${mapping.typeName}">
                    <div class="type-item-info">
                        <span class="type-item-name">${mapping.typeName}</span>
                        <span class="type-item-meta">→ ${mapping.category} | ${mapping.direction} | ${mapping.note || ''}</span>
                    </div>
                    <div class="type-item-actions">
                        <button class="btn btn-sm btn-danger remove-type-btn" data-type="${mapping.typeName}">删除</button>
                    </div>
                </div>`;
            });
        }

        // 展示部分内置类型（精简显示）
        const builtinTypes = Object.entries(TypeManager.builtinTypeMap).slice(0, 15);
        html += `<div class="type-mgmt-item builtin-header" style="cursor:pointer;" onclick="document.getElementById('builtinTypesFull').classList.toggle('hidden')">
            <div class="type-item-info">
                <span class="type-item-name">内置类型（共${report.builtinCount}种）</span>
                <span class="type-item-meta">点击展开/收起</span>
            </div>
        </div>`;
        html += `<div id="builtinTypesFull" class="hidden">`;
        Object.entries(TypeManager.builtinTypeMap).forEach(([name, info]) => {
            html += `
            <div class="type-mgmt-item builtin">
                <div class="type-item-info">
                    <span class="type-item-name">${name}</span>
                    <span class="type-item-meta">→ ${info.category || '（需二次分类）'} | ${info.note || ''}</span>
                </div>
            </div>`;
        });
        html += `</div>`;

        html += `</div></div></div>`;

        container.innerHTML = html;

        // ★ v1.1.10: 绑定「确认所有」按钮
        const confirmAllBtn = container.querySelector('.btn-confirm-all-types');
        if (confirmAllBtn) {
            confirmAllBtn.addEventListener('click', () => {
                this.confirmAllUnknownTypes();
            });
        }

        // 绑定确认按钮
        container.querySelectorAll('.confirm-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const typeName = btn.dataset.type;
                const select = container.querySelector(`#catSelect_${typeName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}`);
                const category = select ? select.value : '其他支出';
                TypeManager.confirmUnknownType(typeName, category, 'expense');
                Utils.showToast(`交易类型「${typeName}」已确认为「${category}」`, 'success');
                this.renderTypeManagement();
            });
        });

        // 绑定删除按钮
        container.querySelectorAll('.remove-type-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const typeName = btn.dataset.type;
                const confirmed = await Utils.confirm(`确定要删除「${typeName}」的自定义映射吗？`);
                if (confirmed) {
                    TypeManager.removeCustomMapping(typeName);
                    Utils.showToast(`已删除「${typeName}」的自定义映射`, 'success');
                    this.renderTypeManagement();
                }
            });
        });
    },

    /**
     * ★ v1.1.10: 一键确认所有未确认的新交易类型
     *   使用推断分类批量确认，确认后刷新分类页面并提示结果。
     */
    confirmAllUnknownTypes() {
        const unknownTypes = TypeManager.getUnknownTypes();
        if (unknownTypes.length === 0) {
            Utils.showToast('没有待确认的交易类型', 'info');
            return;
        }

        let confirmedCount = 0;
        unknownTypes.forEach(ut => {
            try {
                TypeManager.confirmUnknownType(ut.typeName, ut.inferredCategory, ut.inferredDirection);
                confirmedCount++;
            } catch (e) {
                console.warn(`确认类型「${ut.typeName}」失败:`, e);
            }
        });

        if (confirmedCount > 0) {
            Utils.showToast(`✅ 已批量确认 ${confirmedCount} 种新交易类型`, 'success');
            // 重新渲染分类页面以更新UI
            this.renderTypeManagement();
        } else {
            Utils.showToast('批量确认失败，请逐个手动确认', 'error');
        }
    },

    /**
     * 获取所有分类的 select option 列表
     */
    getAllCategoryOptions(selected) {
        const cats = Classifier.getAllCategories();
        return cats.map(cat => 
            `<option value="${cat.name}" ${cat.name === selected ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
        ).join('');
    },

    /**
     * ★ v1.1.4: 控制交叉查询导出按钮显隐
     */
    toggleQueryExportActions(visible) {
        const exportActions = document.getElementById('queryExportActions');
        if (exportActions) {
            exportActions.style.display = visible ? 'flex' : 'none';
        }
    },

    /**
     * ★ v1.1.7: 导出筛选结果为PDF — 优化排版 + 动态填充页面
     *   1. 容器加宽至1100px，文字10px，消除压扁问题
     *   2. 动态测量精确计算每页行数，最大化填充页面消除底部空白
     *   3. 保留总计行和竖版A4格式
     */
    async exportQueryPDF() {
        if (this.filteredTransactions.length === 0) {
            Utils.showToast('请先应用筛选条件', 'warning');
            return;
        }

        if (typeof html2canvas === 'undefined') {
            Utils.showToast('PDF导出组件正在加载中，请稍后再试...', 'warning');
            return;
        }
        if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
            Utils.showToast('PDF导出组件正在加载中，请稍后再试...', 'warning');
            return;
        }

        const totalRecords = this.filteredTransactions.length;

        // ★ 预先计算全体总计
        const totalExpense = this.filteredTransactions
            .filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const totalIncome = this.filteredTransactions
            .filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const totalNet = totalIncome - totalExpense;

        Utils.showToast(`正在生成PDF（共${totalRecords}条记录，优化排版中）...`, 'info');

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfW = pdf.internal.pageSize.getWidth();   // 210
            const pdfH = pdf.internal.pageSize.getHeight();  // 297
            const margin = 8;
            const contentW = pdfW - margin * 2;  // 194mm
            const contentH = pdfH - margin * 2;  // 281mm

            // ★ v1.1.7: 离屏容器加宽至1100px，消除8列文字压扁
            const offscreenW = 1100;
            const baseFontSize = 10;
            const offscreen = document.createElement('div');
            offscreen.style.cssText = `position:absolute;left:-9999px;top:0;width:${offscreenW}px;font-family:sans-serif;font-size:${baseFontSize}px;`;
            document.body.appendChild(offscreen);

            // ★ v1.1.7: 精确测量：先测全页模板（含标题+表头+总计行+汇总行）高度
            const pageOverheadH = await this._measurePageOverhead(offscreen, contentW);
            // 测量单行数据高度
            const sampleSize = Math.min(30, totalRecords);
            const sampleRows = this.filteredTransactions.slice(0, sampleSize);
            const rowH = await this._measureRowHeightV17(offscreen, sampleRows, sampleSize, contentW);

            // 可用于数据行的空间 = 总内容区 - 页面固定开销（使用92%填充率，留安全边距）
            const availForRows = (contentH - pageOverheadH) * 0.92;
            const rowsPerPage = Math.max(5, Math.floor(availForRows / Math.max(rowH, 0.1)));

            // ★ v1.1.7: 建立总计时行和汇总行的HTML模板
            const buildTotalRow = () => `
                <tr style="background:#EEF2FF;font-weight:bold;border-top:2px solid #4F46E5;">
                    <td colspan="4" style="text-align:right;font-size:11px;padding:5px 4px;">📊 全部总计（${this.filteredTransactions.length}条）</td>
                    <td style="font-size:11px;padding:5px 4px;">支出 ¥${totalExpense.toFixed(2)}</td>
                    <td style="font-size:11px;padding:5px 4px;">收入 ¥${totalIncome.toFixed(2)}</td>
                    <td style="font-size:11px;padding:5px 4px;">净额 ¥${totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}</td>
                    <td style="font-size:11px;padding:5px 4px;"></td>
                </tr>`;

            const buildPageSummary = (start, end, pageExp, pageInc) => `
                <tr style="background:#F8FAFC;font-weight:bold;border-top:1px solid #ccc;">
                    <td colspan="4" style="text-align:right;font-size:10px;padding:5px 4px;">本页：第${start}-${end}条</td>
                    <td style="font-size:10px;padding:5px 4px;">支出 ¥${pageExp.toFixed(2)}</td>
                    <td style="font-size:10px;padding:5px 4px;">收入 ¥${pageInc.toFixed(2)}</td>
                    <td style="font-size:10px;padding:5px 4px;">净额 ¥${(pageInc-pageExp)>=0?'+':''}${(pageInc-pageExp).toFixed(2)}</td>
                    <td style="font-size:10px;padding:5px 4px;"></td>
                </tr>`;

            // 表头HTML模板
            const tableHeaderHTML = `
                <thead>
                    <tr style="background:#F1F5F9;">
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">交易时间</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">交易类型</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">交易对方</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">商品说明</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:right;font-size:10px;">金额</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">支付方式</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">状态</th>
                        <th style="padding:6px 5px;border:1px solid #ddd;text-align:left;font-size:10px;">分类</th>
                    </tr>
                </thead>`;

            let pdfPageNum = 0;
            let recordIndex = 0;

            while (recordIndex < totalRecords) {
                const rowsForThisPage = Math.min(rowsPerPage, totalRecords - recordIndex);
                const isFirstPage = (pdfPageNum === 0);
                const isLastPage = (recordIndex + rowsForThisPage >= totalRecords);

                const pageData = this.filteredTransactions.slice(recordIndex, recordIndex + rowsForThisPage);
                const pageExpense = pageData.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
                const pageIncome = pageData.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

                const tableRowsHTML = pageData.map(tx => `
                    <tr>
                        <td style="font-size:10px;padding:5px 4px;">${Utils.formatDateTime(tx.transactionTime)}</td>
                        <td style="font-size:10px;padding:5px 4px;">${tx.transactionType}</td>
                        <td style="font-size:10px;padding:5px 4px;">${tx.counterparty}</td>
                        <td style="font-size:10px;padding:5px 4px;">${tx.description || '-'}</td>
                        <td style="font-size:10px;padding:5px 4px;color:${tx.amount >= 0 ? '#10B981' : '#EF4444'}">${Utils.formatMoney(tx.amount)}</td>
                        <td style="font-size:10px;padding:5px 4px;">${tx.paymentMethod}</td>
                        <td style="font-size:10px;padding:5px 4px;">${tx.status}</td>
                        <td style="font-size:10px;padding:5px 4px;">${tx.category}</td>
                    </tr>
                `).join('');

                const totalRowHTML = buildTotalRow();
                const summaryRowHTML = buildPageSummary(
                    recordIndex + 1, recordIndex + rowsForThisPage, pageExpense, pageIncome
                );

                offscreen.innerHTML = `
                    <div style="background:#ffffff;padding:14px;color:#333;width:${offscreenW}px;">
                        <div style="text-align:center;margin-bottom:10px;border-bottom:2px solid #4F46E5;padding-bottom:6px;">
                            <h2 style="margin:0;color:#4F46E5;font-size:16px;">微信账单交叉查询结果</h2>
                            <p style="margin:3px 0 0;color:#666;font-size:11px;">
                                第 ${recordIndex+1}-${recordIndex+rowsForThisPage} 条 | 共 ${totalRecords} 条 | 第 ${pdfPageNum+1} 页
                            </p>
                        </div>
                        ${isFirstPage ? `<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">${totalRowHTML}</table>` : ''}
                        <table style="width:100%;border-collapse:collapse;font-size:10px;">
                            ${tableHeaderHTML}
                            <tbody>${tableRowsHTML}</tbody>
                        </table>
                        <table style="width:100%;border-collapse:collapse;margin-top:6px;">${summaryRowHTML}${isLastPage ? totalRowHTML : ''}</table>
                    </div>
                `;

                const canvas = await html2canvas(offscreen.firstElementChild, {
                    scale: 1.5, useCORS: true, logging: false,
                    backgroundColor: '#ffffff', allowTaint: true
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.85);

                const imgH = (canvas.height * contentW) / canvas.width;

                if (pdfPageNum > 0) pdf.addPage();
                pdfPageNum++;

                // ★ v1.1.7: 直接使用图像全高，不再裁剪（因已精确计算行数）
                pdf.addImage(imgData, 'JPEG', margin, margin, contentW, Math.min(imgH, contentH));

                recordIndex += rowsForThisPage;
            }

            document.body.removeChild(offscreen);

            const fileName = `微信账单查询结果_${Utils.getCurrentDate()}.pdf`;
            pdf.save(fileName);

            Utils.showToast(`PDF导出成功！共 ${pdfPageNum} 页，${totalRecords} 条记录`, 'success');
        } catch (error) {
            console.error('导出查询PDF失败:', error);
            const offscreen = document.querySelector('body > div[style*="left:-9999px"]');
            if (offscreen) document.body.removeChild(offscreen);
            Utils.showToast('PDF导出失败，请重试', 'error');
        }
    },

    /**
     * ★ v1.1.7: 测量页面固定开销高度(mm) — 包含标题区 + 表头 + 总计行 + 汇总行
     *   容器宽1100px，字体10px，精确匹配实际渲染结构
     */
    async _measurePageOverhead(container, contentW) {
        const totalRowSample = `
            <tr style="background:#EEF2FF;font-weight:bold;border-top:2px solid #4F46E5;">
                <td colspan="4" style="text-align:right;font-size:11px;padding:5px 4px;">📊 全部总计（9999条）</td>
                <td style="font-size:11px;padding:5px 4px;">支出 ¥999.99</td>
                <td style="font-size:11px;padding:5px 4px;">收入 ¥999.99</td>
                <td style="font-size:11px;padding:5px 4px;">净额 ¥+0.00</td>
                <td style="font-size:11px;padding:5px 4px;"></td>
            </tr>`;
        const summaryRowSample = `
            <tr style="background:#F8FAFC;font-weight:bold;border-top:1px solid #ccc;">
                <td colspan="4" style="text-align:right;font-size:10px;padding:5px 4px;">本页：第1-99条</td>
                <td style="font-size:10px;padding:5px 4px;">支出 ¥99.99</td>
                <td style="font-size:10px;padding:5px 4px;">收入 ¥99.99</td>
                <td style="font-size:10px;padding:5px 4px;">净额 ¥+0.00</td>
                <td style="font-size:10px;padding:5px 4px;"></td>
            </tr>`;

        // 构建与正式渲染一致的完整模板（不含数据行）
        const templateHTML = `<div style="background:#ffffff;padding:14px;color:#333;width:1100px;">
            <div style="text-align:center;margin-bottom:10px;border-bottom:2px solid #4F46E5;padding-bottom:6px;">
                <h2 style="margin:0;color:#4F46E5;font-size:16px;">微信账单交叉查询结果</h2>
                <p style="margin:3px 0 0;color:#666;font-size:11px;">测量模板行</p>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">${totalRowSample}</table>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead><tr style="background:#F1F5F9;">
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">时间</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">类型</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">对方</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">说明</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">金额</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">方式</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">状态</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">分类</th>
                </tr></thead>
                <tbody><tr><td colspan="8" style="height:1px;padding:0;font-size:1px;">&nbsp;</td></tr></tbody>
            </table>
            <table style="width:100%;border-collapse:collapse;margin-top:6px;">${summaryRowSample}${totalRowSample}</table>
        </div>`;
        container.innerHTML = templateHTML;
        const canvas = await html2canvas(container.firstElementChild, {
            scale: 1.5, useCORS: true, logging: false,
            backgroundColor: '#ffffff', allowTaint: true
        });
        return (canvas.height * contentW) / canvas.width;
    },

    /**
     * ★ v1.1.7: 测量单行数据在PDF中的高度(mm) — 1100px容器 + 10px字体
     *   精确计算：总表高 - 表头高 / 行数
     */
    async _measureRowHeightV17(container, sampleData, count, contentW) {
        const rows = sampleData.map(tx => `
            <tr>
                <td style="font-size:10px;padding:5px 4px;">${Utils.formatDateTime(tx.transactionTime)}</td>
                <td style="font-size:10px;padding:5px 4px;">${tx.transactionType}</td>
                <td style="font-size:10px;padding:5px 4px;">${tx.counterparty}</td>
                <td style="font-size:10px;padding:5px 4px;">${tx.description || '-'}</td>
                <td style="font-size:10px;padding:5px 4px;">${Utils.formatMoney(tx.amount)}</td>
                <td style="font-size:10px;padding:5px 4px;">${tx.paymentMethod}</td>
                <td style="font-size:10px;padding:5px 4px;">${tx.status}</td>
                <td style="font-size:10px;padding:5px 4px;">${tx.category}</td>
            </tr>
        `).join('');

        const testHTML = `<div style="background:#ffffff;padding:14px;color:#333;width:1100px;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead><tr style="background:#F1F5F9;">
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">时间</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">类型</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">对方</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">说明</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">金额</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">方式</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">状态</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">分类</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
        container.innerHTML = testHTML;
        const canvas = await html2canvas(container.firstElementChild, {
            scale: 1.5, useCORS: true, logging: false,
            backgroundColor: '#ffffff', allowTaint: true
        });
        const totalH = (canvas.height * contentW) / canvas.width;

        // 测量仅表头的高度（无数据行）
        const headerOnlyHTML = `<div style="background:#ffffff;padding:14px;color:#333;width:1100px;">
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
                <thead><tr style="background:#F1F5F9;">
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">时间</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">类型</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">对方</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">说明</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">金额</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">方式</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">状态</th>
                    <th style="padding:6px 5px;border:1px solid #ddd;font-size:10px;">分类</th>
                </tr></thead>
            </table>
        </div>`;
        container.innerHTML = headerOnlyHTML;
        const headerCanvas = await html2canvas(container.firstElementChild, {
            scale: 1.5, useCORS: true, logging: false,
            backgroundColor: '#ffffff', allowTaint: true
        });
        const headerH = (headerCanvas.height * contentW) / headerCanvas.width;

        return Math.max(4.5, (totalH - headerH) / Math.max(1, count));
    },

    /**
     * ★ v1.1.4: 导出筛选结果为Excel（全量数据，不分页）
     * 使用 SheetJS (xlsx) 库
     */
    exportQueryExcel() {
        if (this.filteredTransactions.length === 0) {
            Utils.showToast('请先应用筛选条件', 'warning');
            return;
        }

        if (typeof XLSX === 'undefined') {
            Utils.showToast('Excel导出组件正在加载中，请稍后再试...', 'warning');
            return;
        }

        try {
            // 构建工作表数据
            const wsData = [
                ['交易时间', '交易类型', '交易对方', '商品说明', '金额', '支付方式', '状态', '分类'],
                ...this.filteredTransactions.map(tx => [
                    tx.transactionTime || '',
                    tx.transactionType || '',
                    tx.counterparty || '',
                    tx.description || '',
                    tx.amount != null ? tx.amount : 0,
                    tx.paymentMethod || '',
                    tx.status || '',
                    tx.category || ''
                ])
            ];

            // 添加汇总行
            const totalExpense = this.filteredTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
            const totalIncome = this.filteredTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
            wsData.push([]);
            wsData.push(['汇总', '', '', '', '', '', '', '']);
            wsData.push(['总条数', this.filteredTransactions.length, '', '', '', '', '', '']);
            wsData.push(['总支出', '', '', '', -totalExpense, '', '', '']);
            wsData.push(['总收入', '', '', '', totalIncome, '', '', '']);

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // 设置列宽
            ws['!cols'] = [
                { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
                { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '查询结果');

            const fileName = `微信账单查询结果_${Utils.getCurrentDate()}.xlsx`;
            XLSX.writeFile(wb, fileName);

            Utils.showToast(`Excel导出成功！共 ${this.filteredTransactions.length} 条记录`, 'success');
        } catch (error) {
            console.error('导出查询Excel失败:', error);
            Utils.showToast('Excel导出失败，请重试', 'error');
        }
    },
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// 暴露给全局供HTML内联事件调用
window.App = App;
window.Classifier = Classifier;

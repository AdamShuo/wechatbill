/**
 * 微信账单分析器 - 报告生成模块
 * Version: 1.1.13
 */

const Report = {
    /**
     * 生成完整分析报告
     */
    async generateReport(transactions) {
        const stats = Stats.generateReport(transactions);
        const now = Utils.getCurrentDateTime();
        
        // 计算时间跨度
        const dates = transactions.map(t => new Date(t.transactionTime)).sort((a, b) => a - b);
        const startDate = dates[0]?.toISOString().split('T')[0] || '-';
        const endDate = dates[dates.length - 1]?.toISOString().split('T')[0] || '-';
        
        // 更新报告头部
        document.getElementById('reportDate').textContent = now;
        document.getElementById('reportPeriod').textContent = `${startDate} 至 ${endDate}`;
        
        // 生成消费习惯总结
        this.renderConsumptionHabits(stats);
        
        // 生成高频消费场景
        this.renderTopMerchants(stats.topMerchants);
        
        // 生成趋势图表
        await this.renderReportTrendChart(stats.monthlyStats);
        
        // 生成异常交易提示
        this.renderAbnormalTransactions(stats.anomalies);
        
        // 生成优化建议
        this.renderRecommendations(stats, transactions);
    },

    /**
     * 渲染消费习惯总结
     */
    renderConsumptionHabits(stats) {
        const container = document.getElementById('consumptionHabits');
        const { metrics } = stats;
        
        const habits = [
            `分析期间共发生交易 <strong>${Utils.formatNumber(metrics.totalTransactions)}</strong> 笔，时间跨度 <strong>${metrics.timeSpan}</strong> 天`,
            `月均消费 <strong>¥${metrics.avgMonthlyExpense.toFixed(2)}</strong>，日均消费 <strong>¥${metrics.avgDailyExpense.toFixed(2)}</strong>`,
            `累计收入 <strong>¥${metrics.totalIncome.toFixed(2)}</strong>，累计支出 <strong>¥${metrics.totalExpense.toFixed(2)}</strong>`,
            `最大单笔支出 <strong>¥${metrics.maxTransaction.toFixed(2)}</strong>`,
            `交易频次 <strong>${metrics.transactionFrequency.toFixed(1)}笔/月</strong>`,
            `月度消费增长率 <strong>${stats.growthRate}%</strong> ${parseFloat(stats.growthRate) > 0 ? '📈' : '📉'}`
        ];
        
        container.innerHTML = `
            <ul style="margin-left: 20px; line-height: 2;">
                ${habits.map(habit => `<li>${habit}</li>`).join('')}
            </ul>
        `;
    },

    /**
     * 渲染高频消费场景
     */
    renderTopMerchants(topMerchants) {
        const container = document.getElementById('topMerchants');
        
        if (!topMerchants || topMerchants.length === 0) {
            container.innerHTML = '<p>暂无数据</p>';
            return;
        }
        
        const merchantList = topMerchants.map((merchant, index) => `
            <li>
                <strong>#${index + 1} ${merchant.name}</strong> - 消费 ¥${merchant.totalAmount.toFixed(2)} (${merchant.count}笔)
            </li>
        `).join('');
        
        container.innerHTML = `
            <ol style="margin-left: 20px; line-height: 2;">
                ${merchantList}
            </ol>
        `;
    },

    /**
     * 渲染报告趋势图表
     */
    async renderReportTrendChart(monthlyStats) {
        const canvas = document.getElementById('reportTrendChart');
        if (!canvas) return;
        
        // 延迟执行确保DOM就绪
        await Utils.wait(100);
        
        ChartManager.renderTrendChart('reportTrendChart', monthlyStats);
    },

    /**
     * 渲染异常交易提示
     */
    renderAbnormalTransactions(anomalies) {
        const container = document.getElementById('abnormalTransactions');
        
        if (!anomalies || anomalies.length === 0) {
            container.innerHTML = '<p>✅ 未发现异常大额交易</p>';
            return;
        }
        
        const anomalyList = anomalies.map(tx => `
            <div style="padding: 12px; margin: 8px 0; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid var(--warning);">
                <div><strong>时间:</strong> ${tx.transactionTime}</div>
                <div><strong>对方:</strong> ${tx.counterparty}</div>
                <div><strong>金额:</strong> <span style="color: var(--danger); font-weight: bold;">¥${Math.abs(tx.amount).toFixed(2)}</span></div>
                <div><strong>说明:</strong> ${tx.description || '无'}</div>
            </div>
        `).join('');
        
        container.innerHTML = `
            <p style="margin-bottom: 12px; color: var(--warning);">⚠️ 发现 <strong>${anomalies.length}</strong> 笔异常大额交易：</p>
            ${anomalyList}
        `;
    },

    /**
     * 渲染消费优化建议
     */
    renderRecommendations(stats, transactions) {
        const container = document.getElementById('recommendations');
        const { metrics } = stats;
        const suggestions = [];
        
        // 基于消费水平的建议
        if (metrics.avgMonthlyExpense > 10000) {
            suggestions.push('您的月均消费较高（超过1万元），建议制定详细的预算计划，控制非必要开支。');
        }
        
        // 基于增长率的建议
        const growthRate = parseFloat(stats.growthRate);
        if (growthRate > 10) {
            suggestions.push(`您的消费呈上升趋势（月增长率${growthRate}%），建议审视消费习惯，避免过度消费。`);
        } else if (growthRate < -10) {
            suggestions.push(`您的消费有所减少（月增长率${growthRate}%），继续保持理性的消费观念！`);
        }
        
        // 基于分类的建议
        const categoryStats = stats.categoryStats;
        if (categoryStats.length > 0) {
            const topCategory = categoryStats[0];
            suggestions.push(`您的主要消费集中在"${topCategory.name}"类别（占比${topCategory.percentage}%），可以考虑是否值得这么多投入。`);
            
            // 检查娱乐消费占比
            const entertainment = categoryStats.find(c => c.name === '娱乐休闲');
            if (entertainment && parseFloat(entertainment.percentage) > 30) {
                suggestions.push('娱乐休闲消费占比过高（超过30%），建议适当减少非必要的娱乐支出。');
            }
        }
        
        // 基于交易频次的建议
        if (metrics.transactionFrequency > 50) {
            suggestions.push('您的交易频次很高（月均50笔以上），建议使用记账软件实时记录，避免遗漏。');
        }
        
        // 通用建议
        suggestions.push('建议建立应急基金，储备3-6个月的生活费用，以应对突发情况。');
        suggestions.push('定期进行财务复盘，设定明确的储蓄目标，培养良好的理财习惯。');
        
        container.innerHTML = `
            <ul style="margin-left: 20px; line-height: 2;">
                ${suggestions.map(s => `<li>${s}</li>`).join('')}
            </ul>
        `;
    },

    /**
     * ★ v1.1.11: 导出为PDF — 彻底修复深色模式文字白化 + 异常交易智能分页 + 图表修复 + 容错
     *   1. v1.1.11彻底修复：暴力遍历clone全部DOM节点强制inline color/bg，根除CSS变量在html2canvas中的颜色解析问题
     *      问题根因：getComputedStyle返回rgb()格式，hex正则永远不匹配，导致深色模式白字白底不可读
     *   2. 智能分页：异常交易数据过多时拆分卡片到多页，消除纵向压缩
     *   3. 图表修复：导出前将Chart.js画布转为静态图片
     *   4. 乱码修复：页眉文字改用html2canvas渲染为JPEG图像
     *   5. 容错增强：所有DOM操作和渲染套try/catch，单区块失败不影响整体
     */
    async exportPDF() {
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) {
            Utils.showToast('请先生成报告', 'warning');
            return;
        }

        if (typeof html2canvas === 'undefined') {
            Utils.showToast('导出组件正在加载中，请稍后再试...', 'warning');
            return;
        }
        if (!window.jspdf || typeof window.jspdf.jsPDF === 'undefined') {
            Utils.showToast('导出组件正在加载中，请稍后再试...', 'warning');
            return;
        }

        Utils.showToast('正在生成PDF（智能分页中）...', 'info');

        // 导出前将Chart.js画布转为静态图片
        this._convertChartsToImages(reportContent);

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfW = pdf.internal.pageSize.getWidth();
            const pdfH = pdf.internal.pageSize.getHeight();
            const margin = 12;
            const contentW = pdfW - margin * 2;
            const contentH = pdfH - margin * 2;

            // 页眉：先预渲染一个样板，测量其PDF高度
            const offscreen = document.createElement('div');
            offscreen.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;';
            document.body.appendChild(offscreen);

            const headerH = await this._measureReportHeaderHeight(offscreen, contentW);

            // 收集需要渲染的 section DOM 节点
            const sections = [];
            const headerEl = reportContent.querySelector('.report-header');
            if (headerEl) sections.push(headerEl);
            reportContent.querySelectorAll('.report-section').forEach(el => sections.push(el));

            if (sections.length === 0) {
                document.body.removeChild(offscreen);
                Utils.showToast('报告内容为空', 'warning');
                return;
            }

            let currentY = margin;
            let pageNum = 0;
            let needsHeader = true;

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];

                if (needsHeader) {
                    const headerImgData = await this._renderReportHeaderImage(offscreen, ++pageNum);
                    const headerCanvas = await this._getCanvasFromImgData(offscreen, headerImgData);
                    const headerImgH = (headerCanvas.height * contentW) / headerCanvas.width;
                    pdf.addImage(headerImgData, 'JPEG', margin, margin, contentW, headerImgH);
                    currentY = margin + headerImgH + 4;
                    needsHeader = false;
                }

                try {
                    const clone = section.cloneNode(true);
                    clone.style.cssText = 'background:#ffffff;color:#1a1a1a;padding:0;margin:0;width:794px;';
                    // ★ v1.1.11: 暴力强制白底深色文字，彻底解决CSS变量(RGB格式)颜色解析问题
                    try { this._applyExportDarkStyles(clone); } catch (e) { console.warn('暗色样式注入失败（非致命）:', e); }
                    offscreen.appendChild(clone);

                    const canvas = await html2canvas(clone, {
                        scale: 1.5, useCORS: true, logging: false,
                        backgroundColor: '#ffffff', allowTaint: true
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.85);

                    const imgH = (canvas.height * contentW) / canvas.width;
                    const remainingH = pdfH - margin - currentY;

                    try { offscreen.removeChild(clone); } catch (e) { /* clone可能已被移除 */ }

                    if (imgH <= remainingH) {
                        pdf.addImage(imgData, 'JPEG', margin, currentY, contentW, imgH);
                        currentY += imgH + 2;
                    } else if (imgH <= (contentH - headerH)) {
                        pdf.addPage();
                        const hdrImg = await this._renderReportHeaderImage(offscreen, ++pageNum);
                        const hdrCanvas = await this._getCanvasFromImgData(offscreen, hdrImg);
                        const hdrH = (hdrCanvas.height * contentW) / hdrCanvas.width;
                        pdf.addImage(hdrImg, 'JPEG', margin, margin, contentW, hdrH);
                        const topY = margin + hdrH + 4;
                        pdf.addImage(imgData, 'JPEG', margin, topY, contentW, imgH);
                        currentY = topY + imgH + 2;
                    } else {
                        // ★ v1.1.8: 检测异常交易板块 — 按卡片拆分多页，消除纵向压缩
                        if (section.querySelector('#abnormalTransactions')) {
                            const result = await this._renderSplitAbnormalSection(
                                pdf, offscreen, section, contentW, currentY,
                                margin, pdfH, contentH, headerH, pageNum
                            );
                            pageNum = result.pageNum;
                            currentY = result.currentY;
                        } else {
                            // 其他过长大区块默认缩放适配
                            pdf.addPage();
                            const hdrImg = await this._renderReportHeaderImage(offscreen, ++pageNum);
                            const hdrCanvas = await this._getCanvasFromImgData(offscreen, hdrImg);
                            const hdrH = (hdrCanvas.height * contentW) / hdrCanvas.width;
                            pdf.addImage(hdrImg, 'JPEG', margin, margin, contentW, hdrH);
                            const topY = margin + hdrH + 4;
                            const maxH = contentH - hdrH - 4;
                            pdf.addImage(imgData, 'JPEG', margin, topY, contentW, maxH);
                            currentY = topY + maxH + 2;
                        }
                    }
                } catch (sectionErr) {
                    console.warn('导出报告区块失败（已跳过）:', sectionErr);
                }
            }

            document.body.removeChild(offscreen);

            const fileName = `微信账单分析报告_${Utils.getCurrentDate()}.pdf`;
            pdf.save(fileName);

            Utils.showToast(`PDF导出成功！共 ${pageNum} 页`, 'success');
        } catch (error) {
            console.error('导出PDF失败:', error);
            const offscreen = document.querySelector('body > div[style*="left:-9999px"]');
            if (offscreen) document.body.removeChild(offscreen);
            Utils.showToast('导出失败，请重试', 'error');
        }
    },

    /**
     * ★ v1.1.7: 将报告中的Chart.js画布转为静态img标签
     *   解决cloneNode(true)无法复制canvas像素数据导致html2canvas渲染空白的问题
     */
    _convertChartsToImages(reportContent) {
        const canvases = reportContent.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                if (!dataUrl || dataUrl === 'data:,') return; // 空画布跳过
                
                const img = document.createElement('img');
                img.src = dataUrl;
                // 保留原始canvas的显示尺寸
                const cs = window.getComputedStyle(canvas);
                img.style.cssText = canvas.style.cssText;
                if (!img.style.width) img.style.width = cs.width;
                if (!img.style.height) img.style.height = cs.height;
                if (!img.style.maxHeight) img.style.maxHeight = cs.maxHeight || '400px';
                img.setAttribute('data-converted-from-canvas', 'true');
                
                canvas.parentNode.replaceChild(img, canvas);
            } catch (e) {
                console.warn('画布转图片失败（已跳过）:', e);
            }
        });
    },

    /**
     * ★ v1.1.11: 将异常交易板块拆分为多页渲染（暴力inline暗色文字，根除CSS变量颜色问题）
     *   当异常交易卡片数过多导致整页容纳不下时，按页面容量逐页拆分，
     *   每页保留标题+说明行+能放下的一组卡片，确保行高正常不被压缩。
     *   @returns {{ pageNum: number, currentY: number }} 最终页码和Y坐标
     */
    async _renderSplitAbnormalSection(pdf, offscreen, sectionEl, contentW, startY, margin, pdfH, contentH, headerH, pageNum) {
        const abnormalDiv = sectionEl.querySelector('#abnormalTransactions');
        if (!abnormalDiv) return { pageNum, currentY: startY };

        // 提取板块标题 <h2> 和说明段落 <p> 的HTML
        const titleEl = sectionEl.querySelector('h2');
        const introP = abnormalDiv.querySelector('p');
        // 提取所有异常卡片（border-left的div）
        const allCards = Array.from(abnormalDiv.querySelectorAll('div[style*="border-left"]'));
        if (allCards.length === 0) return { pageNum, currentY: startY };

        const titleHTML = titleEl ? titleEl.outerHTML : '';
        const introHTML = introP
            ? `<p style="margin-bottom:12px;color:#d97706;font-size:14px;">${introP.innerHTML}</p>`
            : '';

        // ---------- 步骤1：测量板块头部高度（标题 + 说明行） ----------
        const headerBlockHTML = `<div style="background:#ffffff;color:#1a1a1a;padding:0;margin:0;width:794px;">
            ${titleHTML}
            ${introHTML}
        </div>`;
        offscreen.innerHTML = headerBlockHTML;
        this._applyExportDarkStyles(offscreen.firstElementChild);
        const hdrCanvas = await html2canvas(offscreen.firstElementChild, {
            scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true
        });
        const sectionHeaderH = (hdrCanvas.height * contentW) / hdrCanvas.width;

        // ---------- 步骤2：测量单张卡片高度 ----------
        const sampleCard = allCards[0].cloneNode(true);
        const cardBlockHTML = `<div style="background:#ffffff;color:#1a1a1a;padding:0;margin:0;width:794px;">${sampleCard.outerHTML}</div>`;
        offscreen.innerHTML = cardBlockHTML;
        this._applyExportDarkStyles(offscreen.firstElementChild);
        const cardCanvas = await html2canvas(offscreen.firstElementChild, {
            scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true
        });
        const singleCardH = (cardCanvas.height * contentW) / cardCanvas.width;

        // ---------- 步骤3：计算每页能放多少张卡片 ----------
        // 页面顶部：页眉(headerH) + 间距(4mm) + 板块头部(sectionHeaderH) + 安全边距(4mm)
        const pageTopOverhead = headerH + 4 + sectionHeaderH + 4;
        const availForCards = contentH - pageTopOverhead;
        const cardsPerPage = Math.max(1, Math.floor(availForCards / Math.max(singleCardH, 0.1)));

        // ---------- 步骤4：逐页渲染 ----------
        let cardIdx = 0;
        let currentPageNum = pageNum;

        while (cardIdx < allCards.length) {
            // 计算本页卡片数
            const cardsForThisPage = Math.min(cardsPerPage, allCards.length - cardIdx);
            const chunkCards = allCards.slice(cardIdx, cardIdx + cardsForThisPage);

            // 添加新页 + 渲染报告页眉
            pdf.addPage();
            currentPageNum++;
            const hdrImg = await this._renderReportHeaderImage(offscreen, currentPageNum);
            const hdrCanv = await this._getCanvasFromImgData(offscreen, hdrImg);
            const hdrImgH = (hdrCanv.height * contentW) / hdrCanv.width;
            pdf.addImage(hdrImg, 'JPEG', margin, margin, contentW, hdrImgH);
            const contentTop = margin + hdrImgH + 4;

            // 构建本页HTML：板块标题 + 说明行 + 一组卡片
            const chunkHTML = `<div style="background:#ffffff;color:#1a1a1a;padding:0;margin:0;width:794px;">
                ${titleHTML}
                ${introHTML}
                ${chunkCards.map(c => c.outerHTML).join('')}
            </div>`;
            offscreen.innerHTML = chunkHTML;
            this._applyExportDarkStyles(offscreen.firstElementChild);

            const chunkCanvas = await html2canvas(offscreen.firstElementChild, {
                scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true
            });
            const chunkImgData = chunkCanvas.toDataURL('image/jpeg', 0.85);
            const chunkImgH = (chunkCanvas.height * contentW) / chunkCanvas.width;

            // 内容区可用高度
            const availH = pdfH - margin - contentTop;
            const placedH = Math.min(chunkImgH, availH);
            pdf.addImage(chunkImgData, 'JPEG', margin, contentTop, contentW, placedH);

            cardIdx += cardsForThisPage;

            if (cardIdx >= allCards.length) {
                // 最后一页：记录当前Y位置供后续区块使用
                startY = contentTop + placedH + 2;
            }
        }

        return { pageNum: currentPageNum, currentY: startY };
    },

    /**
     * ★ v1.1.6: 渲染报告页眉为 JPEG DataURL（图像化消除中文乱码）
     */
    async _renderReportHeaderImage(offscreen, pageNum) {
        const headerHTML = `<div style="background:#ffffff;width:770px;padding:8px 12px;border-bottom:2px solid #4F46E5;display:flex;justify-content:space-between;align-items:flex-end;">
            <span style="font-size:15px;font-weight:bold;color:#4F46E5;">微信账单消费分析报告</span>
            <span style="font-size:11px;color:#999;">第 ${pageNum} 页</span>
        </div>`;
        offscreen.innerHTML = headerHTML;
        const canvas = await html2canvas(offscreen.firstElementChild, {
            scale: 1.5, useCORS: true, logging: false,
            backgroundColor: '#ffffff', allowTaint: true
        });
        return canvas.toDataURL('image/jpeg', 0.85);
    },

    /**
     * ★ v1.1.6: 测量报告页眉在PDF中的渲染高度(mm)
     */
    async _measureReportHeaderHeight(offscreen, contentW) {
        const imgData = await this._renderReportHeaderImage(offscreen, 1);
        const canvas = await this._getCanvasFromImgData(offscreen, imgData);
        return (canvas.height * contentW) / canvas.width;
    },

    /**
     * ★ v1.1.6: 从 DataURL 加载为 Canvas（获取实际像素尺寸）
     */
    _getCanvasFromImgData(offscreen, dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.width;
                c.height = img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(c);
            };
            img.src = dataUrl;
        });
    },

    /**
     * ★ v1.1.11: 暴力强制白底深色文字（彻底修复深色模式文字白化）
     *   v1.1.10的bug：getComputedStyle(el).color 在深色模式下返回 rgb(241,245,249) 格式，
     *   而正则 /#[89aAbBcCdD]/ 只能匹配hex颜色，对rgb()格式永远匹配失败 → 无覆写 → 白字白底。
     *   v1.1.11修复：放弃全部条件判断，暴力遍历所有元素强制inline style，保证html2canvas正确拾取。
     *   @param {HTMLElement} root - 待处理的根节点
     */
    _applyExportDarkStyles(root) {
        if (!root) return;
        try {
            // ★ 策略：收集所有元素，按优先级批量覆写color和background
            const all = root.querySelectorAll('*');
            // 第一轮：根节点自身及直接子元素
            root.style.setProperty('color', '#1a1a1a', 'important');
            root.style.setProperty('background-color', '#ffffff', 'important');

            for (const el of all) {
                // ★ 背景强制白底（所有容器）
                el.style.setProperty('background-color', '#ffffff', 'important');
                // 清除可能的渐变背景
                if (el.style.background) el.style.setProperty('background', 'none', 'important');
                // 清除 text-fill-color（h1的渐变文字）
                el.style.setProperty('-webkit-text-fill-color', '', 'important');

                const tag = el.tagName.toUpperCase();

                // ★ 板块主标题（h2）→ 深靛蓝（品牌色加深）
                if (tag === 'H2') {
                    el.style.setProperty('color', '#312e81', 'important');
                    continue;
                }
                // ★ 报告大标题（h1）→ 纯黑
                if (tag === 'H1') {
                    el.style.setProperty('color', '#1a1a1a', 'important');
                    el.style.setProperty('background', 'none', 'important');
                    continue;
                }
                // ★ 日期/周期文字 → 中等灰度
                if (el.classList.contains('report-date') || el.classList.contains('report-period')) {
                    el.style.setProperty('color', '#4b5563', 'important');
                    continue;
                }
                // ★ 辅助小字 → 浅灰
                if (tag === 'SMALL') {
                    el.style.setProperty('color', '#6b7280', 'important');
                    continue;
                }
                // ★ 收入金额 → 深绿
                if (el.classList.contains('income-color') || el.classList.contains('income-value')) {
                    el.style.setProperty('color', '#059669', 'important');
                    continue;
                }
                // ★ 支出金额 → 深红
                if (el.classList.contains('expense-color') || el.classList.contains('expense-value')) {
                    el.style.setProperty('color', '#dc2626', 'important');
                    continue;
                }
                // ★ 警告/异常提示 → 深橙
                if (el.style.color && (el.style.color.includes('var(--warning)') || el.style.color.includes('var(--danger)'))) {
                    el.style.setProperty('color', '#b45309', 'important');
                    continue;
                }
                // ★ 页眉品牌文字 → 靛蓝
                if (el.style.color && el.style.color.includes('var(--primary')) {
                    el.style.setProperty('color', '#4338ca', 'important');
                    continue;
                }
                // ★ 所有其他有文本内容的元素 → 纯黑正文
                if (el.textContent.trim() && el.children.length === 0) {
                    el.style.setProperty('color', '#1a1a1a', 'important');
                }
            }

            // 第二轮：补刀——所有剩余元素强制深色文字
            for (const el of all) {
                if (!el.style.color || el.style.color === '') {
                    el.style.setProperty('color', '#1a1a1a', 'important');
                }
                // 清除所有CSS变量引用（残留的background等）
                if (el.getAttribute('style') && el.getAttribute('style').includes('var(--')) {
                    const cleaned = el.getAttribute('style').replace(/var\(--[^)]+\)/g, '#ffffff');
                    el.setAttribute('style', cleaned);
                }
            }
        } catch (e) {
            console.warn('_applyExportDarkStyles 暴力遍历失败:', e);
        }
    },

    /**
     * ★ v1.1.5: 导出为图片 — 降低精度减少体积
     */
    async exportImage() {
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) {
            Utils.showToast('请先生成报告', 'warning');
            return;
        }

        if (typeof html2canvas === 'undefined') {
            Utils.showToast('导出组件正在加载中，请稍后再试...', 'warning');
            return;
        }
        
        Utils.showToast('正在生成图片...', 'info');
        
        try {
            // ★ v1.1.11: 导出前将图表canvas转为静态图片 + 暴力白底深色文字
            this._convertChartsToImages(reportContent);
            
            const clone = reportContent.cloneNode(true);
            clone.style.cssText = 'background:#ffffff;color:#1a1a1a;';
            this._applyExportDarkStyles(clone);
            
            // 创建离屏容器
            const offscreen = document.createElement('div');
            offscreen.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;';
            offscreen.appendChild(clone);
            document.body.appendChild(offscreen);
            
            const canvas = await html2canvas(clone, {
                scale: 1.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            document.body.removeChild(offscreen);
            
            // ★ JPEG压缩减少体积
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            
            const link = document.createElement('a');
            link.download = `微信账单分析报告_${Utils.getCurrentDate()}.jpg`;
            link.href = imgData;
            link.click();
            
            Utils.showToast('图片导出成功！', 'success');
        } catch (error) {
            console.error('导出图片失败:', error);
            Utils.showToast('导出失败，请重试', 'error');
        }
    },

    /**
     * 打印报告
     */
    printReport() {
        window.print();
    }
};

/**
 * 微信账单分析器 - Excel解析模块
 * Version: 1.1.13
 */

const Parser = {
    // 微信账单列头关键词映射
    headerKeywords: {
        transactionTime: ['交易时间'],
        transactionType: ['交易类型'],
        counterparty: ['交易对方', '收/付款方信息'],
        description: ['商品', '商品说明', '交易说明'],
        direction: ['收/支'],
        amount: ['金额(元)', '收/支金额', '金额'],
        paymentMethod: ['支付方式', '付款方式'],
        status: ['当前状态', '交易状态', '状态']
    },

    /**
     * 解析Excel文件
     */
    async parseExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    // 关键修复：raw: false 使日期以格式化字符串输出，而非Excel序列号
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
                    
                    if (!jsonData || jsonData.length === 0) {
                        reject(new Error('Excel文件为空'));
                        return;
                    }
                    
                    console.log('=== Excel文件解析 ===');
                    console.log('文件名称:', file.name);
                    console.log('总行数:', jsonData.length);
                    
                    // 调试：输出前20行的数据摘要
                    console.log('\n--- 前20行数据摘要 ---');
                    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
                        const row = jsonData[i];
                        if (row && row.length > 0) {
                            const firstThreeCells = row.slice(0, 3).map(c => String(c || '').trim().substring(0, 30));
                            console.log(`第${i}行: [${firstThreeCells.join(' | ')}]`);
                        }
                    }

                    // 动态检测列头（同时记录列头所在行）
                    const headerResult = this.detectHeaders(jsonData);
                    
                    // 清洗数据
                    const cleanedData = this.cleanData(jsonData, headerResult);
                    
                    console.log('\n=== 解析完成 ===');
                    console.log('成功解析记录数:', cleanedData.length);
                    
                    // 输出前3条和后3条记录供验证
                    if (cleanedData.length > 0) {
                        console.log('\n前3条记录:');
                        cleanedData.slice(0, 3).forEach((tx, i) => {
                            console.log(`  [${i}] ${tx.transactionTime} | ${tx.counterparty} | ${tx.amount}`);
                        });
                    }
                    
                    resolve(cleanedData);
                } catch (error) {
                    console.error('解析Excel失败:', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 动态检测列头位置 - 返回 { headerMap, headerRow }
     * 在微信账单中，列头位于第18行(0-based row 17)
     */
    detectHeaders(worksheetData) {
        const headerMap = {};
        let headerRow = -1;
        let bestMatchCount = 0;
        
        // 搜索范围：前40行（微信账单列头在第17行）
        const searchLimit = Math.min(40, worksheetData.length);
        
        for (let rowIdx = 0; rowIdx < searchLimit; rowIdx++) {
            const row = worksheetData[rowIdx];
            if (!row || !Array.isArray(row)) continue;
            
            const rowMatchCount = {};
            
            for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cellValue = String(row[colIdx] || '').trim();
                
                for (const [type, keywords] of Object.entries(this.headerKeywords)) {
                    if (keywords.some(keyword => cellValue.includes(keyword))) {
                        // 只取第一个匹配（避免重复列）
                        if (!(type in rowMatchCount)) {
                            rowMatchCount[type] = colIdx;
                        }
                    }
                }
            }
            
            const matchCount = Object.keys(rowMatchCount).length;
            
            // 如果这一行匹配的关键词比之前多，更新列头映射
            if (matchCount > bestMatchCount) {
                bestMatchCount = matchCount;
                headerRow = rowIdx;
                // 将当前行的匹配结果覆盖到headerMap
                Object.assign(headerMap, rowMatchCount);
            }
        }
        
        console.log('\n列头检测结果:');
        console.log('  列头行: 第' + headerRow + '行 (Excel第' + (headerRow + 1) + '行)');
        console.log('  匹配列数: ' + bestMatchCount + '/' + Object.keys(this.headerKeywords).length);
        console.log('  列映射:', JSON.stringify(headerMap, null, 2));
        
        // 如果没找到足够的列头匹配，使用硬编码的行17作为后备
        if (bestMatchCount < 4) {
            console.warn('  列头匹配不足，使用硬编码后备：第17行');
            headerRow = 17;
            // 尝试从硬编码行重新映射
            if (headerRow < worksheetData.length) {
                const row = worksheetData[headerRow];
                if (row && Array.isArray(row)) {
                    for (let colIdx = 0; colIdx < row.length; colIdx++) {
                        const cellValue = String(row[colIdx] || '').trim();
                        for (const [type, keywords] of Object.entries(this.headerKeywords)) {
                            if (keywords.some(keyword => cellValue.includes(keyword))) {
                                headerMap[type] = colIdx;
                            }
                        }
                    }
                }
            }
            console.log('  硬编码列映射:', JSON.stringify(headerMap, null, 2));
        }
        
        return { headerMap, headerRow };
    },

    /**
     * 获取列值（修复columnIndex为0的问题）
     */
    getColumnValue(row, columnIndex) {
        if (columnIndex === undefined || columnIndex === null || columnIndex === '') {
            return '';
        }
        
        if (!Array.isArray(row)) {
            return '';
        }
        
        if (columnIndex < 0 || columnIndex >= row.length) {
            return '';
        }
        
        return row[columnIndex];
    },

    /**
     * 清洗和处理数据
     */
    cleanData(rawData, headerResult) {
        if (!rawData || rawData.length < 2) {
            return [];
        }
        
        const { headerMap, headerRow } = headerResult;
        const transactions = [];
        const seenIds = new Set();
        
        // 数据起始行 = 列头行的下一行
        // 如果headerRow为-1（未找到），则回退到原有的查找逻辑
        const dataStart = this.findDataStartRow(rawData, headerRow);
        
        if (dataStart === -1) {
            console.warn('无法找到数据起始行，请检查Excel文件格式');
            return [];
        }
        
        console.log('数据起始行: 第' + dataStart + '行 (Excel第' + (dataStart + 1) + '行)');
        console.log('开始解析数据行...');
        
        let skippedCount = 0;
        let emptyCount = 0;
        let invalidCount = 0;
        
        for (let i = dataStart; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || !Array.isArray(row)) {
                skippedCount++;
                continue;
            }
            
            // 检查是否为空行
            if (this.isEmptyRow(row)) {
                emptyCount++;
                continue;
            }
            
            // 检查是否是列头行（安全措施：跳过包含列头关键词的行）
            const firstCell = String(row[0] || '').trim();
            if (firstCell.includes('交易时间') || firstCell.includes('交易类型')) {
                console.log('  跳过列头行: 第' + i + '行');
                skippedCount++;
                continue;
            }
            
            const transaction = this.parseRow(row, headerMap, i);
            
            if (transaction && this.isValidTransaction(transaction)) {
                const id = this.generateTransactionId(transaction);
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    transactions.push(transaction);
                }
            } else {
                invalidCount++;
                // 调试：输出前几条无效记录的原因
                if (invalidCount <= 5) {
                    console.log('  无效行' + i + ': 时间="' + this.getColumnValue(row, headerMap.transactionTime) + 
                        '" 对方="' + this.getColumnValue(row, headerMap.counterparty) + '"');
                }
            }
        }
        
        console.log(`数据行总计: ${rawData.length - dataStart}`);
        console.log(`有效记录: ${transactions.length}, 跳过: ${skippedCount}, 空行: ${emptyCount}, 无效: ${invalidCount}`);
        
        return transactions;
    },

    /**
     * 查找数据起始行
     * @param {Array} rawData - 原始数据
     * @param {number} knownHeaderRow - 已知的列头行号（来自detectHeaders）
     */
    findDataStartRow(rawData, knownHeaderRow) {
        console.log('\n--- 确定数据起始行 ---');
        
        // 优先使用已知的列头行
        if (knownHeaderRow >= 0 && knownHeaderRow < rawData.length) {
            const dataStart = knownHeaderRow + 1;
            
            // 验证数据起始行的第一列是否为有效数据（日期或有效内容）
            if (dataStart < rawData.length) {
                const firstRow = rawData[dataStart];
                const firstCell = firstRow && firstRow.length > 0 ? String(firstRow[0] || '').trim() : '';
                
                if (firstCell && !firstCell.includes('交易时间')) {
                    console.log('使用列头行+1作为数据起始: 第' + dataStart + '行');
                    console.log('  首行第一列内容: "' + firstCell + '"');
                    return dataStart;
                }
                
                // 如果dataStart行恰好又是另一个列头行，继续往后找
                if (firstCell.includes('交易时间')) {
                    console.log('  数据起始行又是列头，继续往后查找...');
                    for (let i = dataStart + 1; i < Math.min(dataStart + 5, rawData.length); i++) {
                        const row = rawData[i];
                        if (row && row.length > 0) {
                            const cell = String(row[0] || '').trim();
                            if (cell && !cell.includes('交易时间') && !cell.includes('交易类型')) {
                                console.log('  找到真正的数据起始行: 第' + i + '行');
                                return i;
                            }
                        }
                    }
                }
            }
        }
        
        // 后备：扫描查找第一个日期格式的行
        console.log('后备策略：扫描日期格式...');
        for (let i = 0; i < Math.min(50, rawData.length); i++) {
            const row = rawData[i];
            if (!row || !Array.isArray(row)) continue;
            
            const firstCell = String(row[0] || '').trim();
            
            // 检查是否为日期格式
            if (this.isDateLike(firstCell)) {
                // 确认这不是列头行（列头行第一列是"交易时间"）
                if (!firstCell.includes('交易时间') && !firstCell.includes('交易类型')) {
                    console.log('找到日期格式的数据起始行: 第' + i + '行');
                    return i;
                }
            }
        }
        
        console.warn('无法确定数据起始行');
        return -1;
    },

    /**
     * 判断字符串是否像日期
     * 支持：
     * - 标准日期字符串: 2014-09-09, 2014/09/09
     * - Excel序列号: 41891 (对应2014-09-09)
     */
    isDateLike(value) {
        if (!value || value === '') return false;
        
        const str = String(value).trim();
        
        // 1. 标准日期格式 YYYY-MM-DD 或 YYYY/MM/DD
        if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(str)) {
            return true;
        }
        
        // 2. Excel序列号日期（范围40000-60000对应2009-2064年）
        if (/^\d+$/.test(str)) {
            const num = parseInt(str);
            if (num >= 40000 && num <= 60000) {
                return true;
            }
        }
        
        return false;
    },

    /**
     * 判断是否为空行
     */
    isEmptyRow(row) {
        return row.every(cell => 
            cell === null || cell === undefined || cell === '' || 
            String(cell).trim() === ''
        );
    },

    /**
     * 解析单行数据
     */
    parseRow(row, headerMap, rowIndex) {
        try {
            const transactionTime = this.getColumnValue(row, headerMap.transactionTime);
            const transactionType = this.getColumnValue(row, headerMap.transactionType);
            const counterparty = this.getColumnValue(row, headerMap.counterparty);
            const description = this.getColumnValue(row, headerMap.description);
            const direction = this.getColumnValue(row, headerMap.direction);
            const amount = this.getColumnValue(row, headerMap.amount);
            const paymentMethod = this.getColumnValue(row, headerMap.paymentMethod);
            const status = this.getColumnValue(row, headerMap.status);
            
            // 处理金额
            let amountValue = 0;
            if (amount !== undefined && amount !== null && amount !== '') {
                amountValue = this.parseAmount(String(amount));
                
                // 根据"收/支"列判断正负
                if (direction !== undefined && direction !== null && direction !== '') {
                    const dirStr = String(direction).trim();
                    if (dirStr === '支出') {
                        amountValue = Math.abs(amountValue) * -1;
                    } else if (dirStr === '收入') {
                        amountValue = Math.abs(amountValue);
                    }
                }
            }
            
            return {
                id: this.generateTransactionId({
                    transactionTime,
                    transactionType,
                    counterparty,
                    amount: amountValue
                }),
                transactionTime: this.formatTime(String(transactionTime || '')),
                transactionType: String(transactionType || '其他'),
                counterparty: String(counterparty || '未知'),
                description: String(description || ''),
                amount: amountValue,
                paymentMethod: String(paymentMethod || '微信支付'),
                status: String(status || '成功'),
                category: '未分类',
                rawRow: row,
                rowIndex: rowIndex
            };
        } catch (error) {
            console.error(`解析第${rowIndex}行失败:`, error);
            return null;
        }
    },

    /**
     * 解析金额字符串
     */
    parseAmount(amountStr) {
        if (!amountStr || amountStr === '') return 0;
        
        let cleaned = String(amountStr)
            .replace(/¥/g, '')
            .replace(/,/g, '')
            .trim();
        
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
            cleaned = '-' + cleaned.substring(1, cleaned.length - 1);
        }
        
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    },

    /**
     * 格式化时间 - 支持多种格式
     */
    formatTime(timeStr) {
        if (!timeStr || timeStr === '') return '';
        
        const trimmed = String(timeStr).trim();
        
        // 已经是标准格式 YYYY-MM-DD HH:MM:SS
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
            return trimmed;
        }
        
        // 标准日期格式 YYYY-MM-DD 或 YYYY/MM/DD
        if (/^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(trimmed)) {
            return trimmed;
        }
        
        // Excel序列号日期
        if (/^\d+$/.test(trimmed)) {
            const serialNum = parseInt(trimmed);
            if (serialNum >= 40000 && serialNum <= 60000) {
                const date = this.excelSerialToDate(serialNum);
                return date.toISOString().replace('T', ' ').substring(0, 19);
            }
        }
        
        return trimmed;
    },

    /**
     * Excel序列号转Date对象
     * Excel日期序列号从1900-01-01开始计数（注意1900年闰年bug）
     */
    excelSerialToDate(serial) {
        // Excel的日期序列号：1 = 1900-01-01
        // 但Excel认为1900是闰年（实际不是），所以从1900-03-01开始序号少1
        const excelEpoch = Date.UTC(1899, 11, 30); // 1899-12-30
        const daysMs = serial * 86400000;
        return new Date(excelEpoch + daysMs);
    },

    /**
     * 验证交易记录是否有效
     */
    isValidTransaction(transaction) {
        return transaction.transactionTime !== '' && 
               transaction.counterparty !== '未知' &&
               transaction.amount !== 0;
    },

    /**
     * 生成交易唯一ID
     */
    generateTransactionId(transaction) {
        return `${transaction.transactionTime}_${transaction.counterparty}_${transaction.amount}`.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
    },

    /**
     * 批量解析多个Excel文件
     */
    async parseMultipleExcel(files) {
        const allTransactions = [];
        const results = [];
        
        for (const file of files) {
            try {
                const transactions = await this.parseExcel(file);
                results.push({
                    fileName: file.name,
                    fileSize: Utils.formatFileSize(file.size),
                    count: transactions.length,
                    status: 'success'
                });
                allTransactions.push(...transactions);
            } catch (error) {
                results.push({
                    fileName: file.name,
                    fileSize: Utils.formatFileSize(file.size),
                    count: 0,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        return {
            transactions: allTransactions,
            results: results,
            totalFiles: files.length,
            successFiles: results.filter(r => r.status === 'success').length,
            totalTransactions: allTransactions.length
        };
    }
};

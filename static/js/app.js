document.addEventListener('DOMContentLoaded', function () {
    // Check if fullData exists and is an array
    if (typeof fullData === 'undefined' || !Array.isArray(fullData)) {
        console.error("Data is not available or invalid. Aborting script.");
        const tableBody = document.getElementById('data-table-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-5"><h3>ไม่สามารถโหลดข้อมูลได้</h3><p>โปรดตรวจสอบการเชื่อมต่อและลองรีเฟรชหน้าเว็บอีกครั้ง</p></td></tr>';
        }
        return; // Stop script execution if data is missing
    }

    const tableBody = document.getElementById('data-table-body');
    const filterPanel = document.getElementById('filter-panel');
    const filterPanelTitle = document.getElementById('filter-panel-title');
    const filterPanelBody = document.getElementById('filter-panel-body');
    
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const clearFilterBtn = document.getElementById('clear-filter-btn');
    const sortAscBtn = document.getElementById('sort-asc-btn'); 
    const sortDescBtn = document.getElementById('sort-desc-btn');
    const clearSortBtn = document.getElementById('clear-sort-btn');
    const downloadBtn = document.getElementById('download-report-btn');

    let activeFilters = {};
    let sortState = { field: null, direction: 'none' };
    let currentField = null;

    // --- ฟังก์ชันสำหรับแปลงข้อความวันที่เป็น Date Object (คงเดิม) ---
    function parseDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        dateString = dateString.trim(); // ลบช่องว่างหน้าหลัง

        const dateTimeParts = dateString.split(' ');
        let dateParts = dateTimeParts[0].split('/');
        let timeParts = (dateTimeParts.length > 1) ? dateTimeParts[1].split(':') : ['00', '00', '00'];

        if (dateParts.length !== 3 || timeParts.length !== 3) {
            if (timeParts.length === 3 && dateParts.length === 1 && !dateParts[0].includes('/')) {
                const today = new Date();
                return new Date(today.getFullYear(), today.getMonth(), today.getDate(), timeParts[0], timeParts[1], timeParts[2]);
            }
            return null;
        }
        
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
    }

    // --- ประมวลผลข้อมูลล่วงหน้าเพื่อกำหนดค่า Remark (ปรับปรุง logic เพื่อคง Remark เดิม) ---
    fullData.forEach(row => {
        const originalRemark = row['Remark']; // เก็บ Remark ดั้งเดิมไว้

        const appointDateStr = row['Appoint Date'];
        const preferDateStr = row['Prefer Date'];

        const appointDate = parseDate(appointDateStr);
        const preferDate = parseDate(preferDateStr);
        
        row['Remark'] = ''; // รีเซ็ต Remark เพื่อคำนวณใหม่ หรือใช้ Remark เดิมที่เก็บไว้

        let remarkSetByLogic = false; // Flag เพื่อตรวจสอบว่า Remark ถูกกำหนดโดย logic แล้วหรือยัง

        // 1. ลองคำนวณ Remark จากวันที่ก่อน (ลำดับความสำคัญสูง)
        if (preferDate instanceof Date && !isNaN(preferDate) && 
            appointDate instanceof Date && !isNaN(appointDate)) {

            const diffMs = appointDate.getTime() - preferDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours >= 0 && diffHours <= 4) {
                row['Remark'] = 'เลื่อนนัดเปลี่ยน PF หรือปิดงานหลัง PF ไม่เกิน 4 ชม.';
                remarkSetByLogic = true;
            } else if (diffHours > 4) {
                row['Remark'] = 'เลื่อนนัดเปลี่ยน PF';
                remarkSetByLogic = true;
            } else if (diffHours < 0) {
                row['Remark'] = 'ปิดงานได้ตามปกติ'; 
                remarkSetByLogic = true;
            }
        } 

        // 2. หาก Remark ยังไม่ได้ถูกกำหนดด้วย logic วันที่ ให้ลองใช้ Remark ดั้งเดิม
        if (!remarkSetByLogic && originalRemark) {
            // เพิ่มเงื่อนไข Remark ดั้งเดิมที่คุณต้องการคงไว้
            if (originalRemark.includes('ปิดงานใน 24 ชม. จาก Create') ||
                originalRemark.includes('ปิดงานก่อน ')) { // ตรวจสอบคำว่า 'ปิดงานก่อน'
                row['Remark'] = originalRemark; // ใช้ Remark ดั้งเดิม
                remarkSetByLogic = true;
            }
            // หากมี Remark ดั้งเดิมอื่นๆ ที่ต้องการคงไว้ ให้เพิ่มเงื่อนไขที่นี่
        }

        // 3. Fallback: หากยังไม่มี Remark และมีข้อมูลวันที่ต้นฉบับแต่ parse ไม่ได้ (ลำดับความสำคัญต่ำสุด)
        if (!remarkSetByLogic && (appointDateStr || preferDateStr)) { 
            // ถ้ามี string วันที่แต่ parse ไม่ได้ หรือมีแค่บางส่วน
             row['Remark'] = 'วันที่ไม่ถูกต้อง/ไม่ครบถ้วน';
             remarkSetByLogic = true;
        }
        // หาก Remark ยังว่างอยู่หลังจากทุกเงื่อนไข (เช่น ไม่มีข้อมูลวันที่ทั้งคู่) จะยังคงเป็น ''
    });

    // **** แก้ไขตรงนี้: เพิ่มเงื่อนไขการกรองแถวที่ไม่ต้องการแสดงผลออกไป (รวม Solution "544", "559" และคำว่า "Proactive") ****
    const processedData = fullData.filter(row => {
        // เงื่อนไข 1: ต้องมี Ack. By
        if (!row['Ack. By']) {
            return false;
        }
        // ตรวจสอบ Solution เพื่อกรองแถวที่ไม่ต้องการ
        if (row['Solution']) {
            const solutionText = row['Solution'].toLowerCase(); // แปลงเป็นตัวพิมพ์เล็กเพื่อเปรียบเทียบ
            
            // กรอง Solution "559 : ย้ายจุด/เดินสายภายในบ้าน ประเภทเดินสายลอยตีกิ๊บ จุดละ1000 บาท 20เมตร (รวม VAT)"
            if (solutionText.includes('559 : ย้ายจุด/เดินสายภายในบ้าน ประเภทเดินสายลอยตีกิ๊บ จุดละ1000 บาท 20เมตร (รวม vat)')) {
                return false;
            }
            // กรอง Solution "544 : Proactive ensure Fault ค่าสัญญาณดี"
            if (solutionText.includes('544 : proactive ensure fault ค่าสัญญาณดี')) {
                return false;
            }
            // กรอง Solution ที่มีคำว่า "Proactive" (ไม่ว่าจะอยู่ตรงไหน)
            if (solutionText.includes('proactive')) {
                return false;
            }
        }
        
        return true; // เก็บแถวที่ผ่านเงื่อนไขทั้งหมด
    });

    // --- ฟังก์ชันสำหรับกำหนดสีให้คอลัมน์ Remark (ปรับให้รองรับ Remark แบบใหม่) ---
    function getRemarkClass(remarkText) {
        if (!remarkText) return '';

        if (remarkText.includes('เลื่อนนัดเปลี่ยน PF หรือปิดงานหลัง PF ไม่เกิน 4 ชม.')) {
            return 'bg-warning text-dark';
        }
        
        if (remarkText.includes('ปิดงานได้ตามปกติ')) {
            return 'bg-success-subtle text-success-emphasis';
        }
        if (remarkText.includes('เลื่อนนัดเปลี่ยน PF')) {
            return 'bg-danger-subtle text-danger-emphasis';
        }
        // **** เพิ่ม Remark ใหม่จากภาพตัวอย่าง (ปิดงานใน 24 ชม., ปิดงานก่อน) ****
        if (remarkText.includes('ปิดงานใน 24 ชม. จาก Create')) {
            return 'bg-info-subtle text-info-emphasis'; // สีฟ้าอ่อน
        }
        if (remarkText.includes('ปิดงานก่อน')) { // ใช้ .includes เพื่อจับ 'ปิดงานก่อน [วันที่]'
            return 'bg-warning-subtle text-warning-emphasis'; // สีเหลือง/ส้มอ่อน (ตามภาพ)
        }
        if (remarkText.includes('วันที่ไม่ถูกต้อง/ไม่ครบถ้วน')) { 
            return 'bg-secondary-subtle text-secondary-emphasis'; // สีเทาอ่อนสำหรับข้อผิดพลาด
        }
        return '';
    }

    // --- ฟังก์ชัน renderTable (คงเดิมจากเวอร์ชันล่าสุด) ---
    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5"><h4>No data found.</h4></td></tr>`;
            return;
        }

        let tempTableBody = document.createDocumentFragment();
        let isEvenRow = false; // ใช้สำหรับสลับสีพื้นหลังแถว

        data.forEach((row) => {
            const tr = document.createElement('tr');
            
            // เพิ่ม class สีพื้นหลังแถวสลับกันที่นี่
            if (isEvenRow) {
                tr.classList.add('row-dark-gray');
            } else {
                tr.classList.add('row-light-gray');
            }
            isEvenRow = !isEvenRow; // สลับค่าสำหรับแถวถัดไป
            
            const remarkText = row['Remark'] || '';
            const remarkClass = getRemarkClass(remarkText);
            
            tr.innerHTML = `
                <td>${row['Product Id']||''}</td>
                <td>${row['Queue']||''}</td>
                <td>${row['Create Date']||''}</td>
                <td>${row['Action Type']||''}</td>
                <td>${row['Solution']||''}</td>
                <td>${row['Ack. By']||''}</td>
                <td>${row['Appoint Date']||''}</td>
                <td>${row['Prefer Date']||''}</td>
                <td class="${remarkClass}">${remarkText}</td>
            `;
            tempTableBody.appendChild(tr);
        });
        
        tableBody.appendChild(tempTableBody);
    }

    function getCorrectDataField(field) {
        return field;
    }

    function updateTableDisplay() {
        let resultData = processedData.filter(row => {
            return Object.keys(activeFilters).every(stateField => {
                const dataField = getCorrectDataField(stateField);
                const filterValue = activeFilters[stateField];
                if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
                return Array.isArray(filterValue) ? filterValue.includes(row[dataField]) : row[dataField] === filterValue;
            });
        });

        if (sortState.field && sortState.direction !== 'none') {
            resultData.sort((a, b) => {
                const dataField = getCorrectDataField(sortState.field);
                const valA = a[dataField] || '';
                const valB = b[dataField] || '';
                if (sortState.direction === 'asc') {
                    return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                } else {
                    return valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
                }
            });
        }
        
        renderTable(resultData);
        updateHeaderStyles();
    }

    function showFilterPanel(headerElement) {
        currentField = headerElement.dataset.field;
        const dataField = getCorrectDataField(currentField);
        const filterType = headerElement.dataset.filterType || 'single';
        const allValues = processedData.map(item => item[dataField]);
        
        let uniqueValues = [...new Set(allValues)].filter(item => item != null && item !== '');
        
        if (dataField === 'Solution') {
            uniqueValues = uniqueValues.filter(item => {
                const itemLower = item.toLowerCase();
                // กรอง Solution ที่ไม่ต้องการแสดงใน Filter Panel (อัปเดตให้กรอง Solution ใหม่ด้วย)
                return !itemLower.includes('439 :') && 
                       !itemLower.includes('544 : proactive ensure fault ค่าสัญญาณดี') && 
                       !itemLower.includes('370 :') && 
                       !itemLower.includes('559 : ย้ายจุด/เดินสายภายในบ้าน ประเภทเดินสายลอยตีกิ๊บ จุดละ1000 บาท 20เมตร (รวม vat)') &&
                       !itemLower.includes('proactive'); // กรองคำว่า 'proactive' ด้วย
            });
        }
        
        uniqueValues.sort();

        filterPanelTitle.textContent = `Actions for ${currentField}`;
        filterPanelBody.innerHTML = ''; 

        if (filterType === 'multi') {
            uniqueValues.forEach(val => {
                const isChecked = activeFilters[currentField]?.includes(val) ? 'checked' : '';
                filterPanelBody.innerHTML += `<div class="form-check"><input class="form-check-input" type="checkbox" value="${val}" id="check-${val}" ${isChecked}><label class="form-check-label" for="check-${val}">${val}</label></div>`;
            });
        } else {
            const selectEl = document.createElement('select');
            selectEl.className = 'form-select';
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = '-- All --';
            selectEl.appendChild(defaultOption);
            const currentFilterValue = activeFilters[currentField] || '';
            uniqueValues.forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                if (val === currentFilterValue) option.selected = true;
                selectEl.appendChild(option);
            });
            filterPanelBody.appendChild(selectEl);
        }

        const rect = headerElement.getBoundingClientRect();
        filterPanel.style.left = `${rect.left}px`;
        filterPanel.style.top = `${rect.bottom + window.scrollY}px`;
        filterPanel.style.display = 'block';
    }

    function hideFilterPanel() {
        filterPanel.style.display = 'none';
        currentField = null;
    }

    function updateHeaderStyles() {
        document.querySelectorAll('.filterable-header').forEach(h => {
            const field = h.dataset.field;
            h.classList.toggle('active-filter', !!(activeFilters[field] && (!Array.isArray(activeFilters[field]) || activeFilters[field].length > 0)));
            h.classList.toggle('active-sort', sortState.field === field && sortState.direction !== 'none');
            
            const icon = h.querySelector('.sort-icon');
            if (icon) {
                if (sortState.field === field && sortState.direction !== 'none') {
                    icon.className = sortState.direction === 'asc' ? 'sort-icon fas fa-arrow-up' : 'sort-icon fas fa-arrow-down';
                } else {
                    icon.className = 'sort-icon fas fa-sort';
                }
            }
        });
    }

    document.querySelectorAll('.filterable-header').forEach(header => {
        header.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentField === e.currentTarget.dataset.field) {
                hideFilterPanel();
            } else {
                showFilterPanel(e.currentTarget);
            }
        });
    });

    applyFilterBtn.addEventListener('click', () => {
        const filterType = document.querySelector(`th[data-field="${currentField}"]`).dataset.filterType || 'single';
        if (filterType === 'multi') {
            const checked = Array.from(filterPanelBody.querySelectorAll('input:checked')).map(cb => cb.value);
            activeFilters[currentField] = checked;
        } else {
            activeFilters[currentField] = filterPanelBody.querySelector('select').value;
        }
        updateTableDisplay();
        hideFilterPanel();
    });

    clearFilterBtn.addEventListener('click', () => {
        delete activeFilters[currentField];
        updateTableDisplay();
        hideFilterPanel();
    });

    sortAscBtn.addEventListener('click', () => {
        sortState = { field: currentField, direction: 'asc' };
        updateTableDisplay();
        hideFilterPanel();
    });

    sortDescBtn.addEventListener('click', () => {
        sortState = { field: currentField, direction: 'desc' };
        updateTableDisplay();
        hideFilterPanel();
    });

    clearSortBtn.addEventListener('click', () => {
        sortState = { field: null, direction: 'none' };
        updateTableDisplay();
        hideFilterPanel();
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const reportContainer = document.getElementById('report-to-capture');
            if (!reportContainer) {
                console.error('Report container not found!');
                return;
            }

            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...`;
            downloadBtn.disabled = true;

            html2canvas(reportContainer, {
                scale: 2, 
                useCORS: true,
                backgroundColor: '#FFFFFF', // กำหนดสีพื้นหลังเป็นสีขาวอย่างชัดเจน
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'Job_Report.png';
                link.href = canvas.toDataURL('image/png');
                link.click();

                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            }).catch(err => {
                console.error('oops, something went wrong!', err);
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
            });
        });
    }

    document.addEventListener('click', (e) => {
        if (!filterPanel.contains(e.target) && !e.target.classList.contains('filterable-header')) {
            hideFilterPanel();
        }
    });

    updateTableDisplay();
});

document.addEventListener('DOMContentLoaded', function () {
    // Check if fullData exists and is an array
    if (typeof fullData === 'undefined' || !Array.isArray(fullData)) {
        console.error("Data is not available or invalid. Aborting script.");
        const tableBody = document.getElementById('data-table-body');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-5"><h3>ไม่สามารถโหลดข้อมูลได้</h3><p>โปรดตรวจสอบการเชื่อมต่อและลองรีเฟรฟหน้าเว็บอีกครั้ง</p></td></tr>';
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

    // --- ฟังก์ชันสำหรับแปลงข้อความวันที่เป็น Date Object ---
    function parseDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        dateString = dateString.trim();

        const dateTimeParts = dateString.split(' ');
        let datePartStr = dateTimeParts[0];
        let timePartStr = dateTimeParts.length > 1 ? dateTimeParts[1] : '00:00:00'; 

        let year, month, day, hours, minutes, seconds;

        const dateParts = datePartStr.split('/');
        if (dateParts.length === 3) {
            year = parseInt(dateParts[2], 10);
            month = parseInt(dateParts[1], 10) - 1; 
            day = parseInt(dateParts[0], 10);
        } else {
            if (datePartStr.includes(':')) { 
                timePartStr = datePartStr; 
                const today = new Date();
                year = today.getFullYear();
                month = today.getMonth();
                day = today.getDate();
            } else {
                return null; 
            }
        }

        const timeParts = timePartStr.split(':');
        hours = parseInt(timeParts[0] || '0', 10);
        minutes = parseInt(timeParts[1] || '0', 10);
        seconds = parseInt(timeParts[2] || '0', 10); 

        const date = new Date(year, month, day, hours, minutes, seconds);
        return isNaN(date.getTime()) ? null : date;
    }

    // --- ประมวลผลข้อมูลล่วงหน้าเพื่อกำหนดค่า Remark ---
    fullData.forEach(row => {
        const originalRemark = row['Remark']; 

        const appointDateStr = row['Appoint Date'];
        const preferDateStr = row['Prefer Date'];

        const appointDate = parseDate(appointDateStr);
        const preferDate = parseDate(preferDateStr);
        
        let calculatedRemark = '';
        let remarkSetByLogic = false;

        const preferDateOnly = preferDate ? new Date(preferDate.getFullYear(), preferDate.getMonth(), preferDate.getDate()) : null;
        const appointDateOnly = appointDate ? new Date(appointDate.getFullYear(), appointDate.getMonth(), appointDate.getDate()) : null;

        if (preferDateOnly instanceof Date && !isNaN(preferDateOnly.getTime()) && 
            appointDateOnly instanceof Date && !isNaN(appointDateOnly.getTime())) {
            
            if (preferDateOnly.getTime() < appointDateOnly.getTime()) {
                calculatedRemark = 'เลื่อนนัดเปลี่ยน PF';
                remarkSetByLogic = true;
            }
        }

        if (!remarkSetByLogic) {
            if (!appointDateStr || appointDate === null || isNaN(appointDate.getTime())) {
                calculatedRemark = 'ปิดงานใน 24 ชม. จาก Create';
                remarkSetByLogic = true;
            } 
            else if (!preferDateStr || preferDate === null || isNaN(preferDate.getTime())) {
                if (appointDate instanceof Date && !isNaN(appointDate.getTime())) {
                    const futureAppointDate = new Date(appointDate.getTime() + (4 * 60 * 60 * 1000));
                    const formattedFutureAppointDate = 
                        `${futureAppointDate.getDate().toString().padStart(2, '0')}/` +
                        `${(futureAppointDate.getMonth() + 1).toString().padStart(2, '0')}/` +
                        `${futureAppointDate.getFullYear()} ` +
                        `${futureAppointDate.getHours().toString().padStart(2, '0')}:` +
                        `${futureAppointDate.getMinutes().toString().padStart(2, '0')}`;
                    calculatedRemark = `ปิดงานก่อน ${formattedFutureAppointDate}`;
                    remarkSetByLogic = true;
                } else {
                    calculatedRemark = 'วันที่ไม่ถูกต้อง/ไม่ครบถ้วน'; 
                    remarkSetByLogic = true;
                }
            } 
            else if (preferDate instanceof Date && !isNaN(preferDate.getTime()) && 
                     appointDate instanceof Date && !isNaN(appointDate.getTime())) {
                
                if (preferDate.getTime() === appointDate.getTime()) {
                    calculatedRemark = 'ปิดงานได้ตามปกติ';
                    remarkSetByLogic = true;
                } 
                else {
                    calculatedRemark = 'เลื่อนนัดเปลี่ยน PF หรือปิดงานหลัง PF ไม่เกิน 4 ชม.';
                    remarkSetByLogic = true;
                }
            }
            else if (appointDateStr || preferDateStr) { 
                calculatedRemark = 'วันที่ไม่ถูกต้อง/ไม่ครบถ้วน';
                remarkSetByLogic = true;
            }
        }

        if (remarkSetByLogic) {
            row['Remark'] = calculatedRemark;
        } else {
            if (originalRemark && (originalRemark.includes('ปิดงานใน 24 ชม. จาก Create') || originalRemark.includes('ปิดงานก่อน ') || originalRemark.includes('วันที่ไม่ถูกต้อง/ไม่ครบถ้วน'))) {
                row['Remark'] = originalRemark;
            } else {
                row['Remark'] = ''; 
            }
        }
    });

    processedData = fullData.filter(row => {
        if (!row['Ack. By']) {
            return false;
        }
        if (row['Solution']) {
            const solutionText = row['Solution'].toLowerCase();
            
            if (solutionText.includes('559 : ย้ายจุด/เดินสายภายในบ้าน ประเภทเดินสายลอยตีกิ๊บ จุดละ1000 บาท 20เมตร (รวม vat)')) {
                return false;
            }
            if (solutionText.includes('544 : proactive ensure fault ค่าสัญญาณดี')) {
                return false;
            }
            if (solutionText.includes('proactive')) {
                return false;
            }
        }
        return true;
    });

    // --- ฟังก์ชันสำหรับกำหนดสีให้คอลัมน์ Remark ---
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
        if (remarkText.includes('ปิดงานใน 24 ชม. จาก Create')) {
            return 'bg-info-subtle text-info-emphasis';
        }
        if (remarkText.includes('ปิดงานก่อน')) {
            return 'bg-warning-subtle text-warning-emphasis';
        }
        if (remarkText.includes('วันที่ไม่ถูกต้อง/ไม่ครบถ้วน')) { 
            return 'bg-secondary-subtle text-secondary-emphasis';
        }
        return '';
    }

    // --- ฟังก์ชัน renderTable (นำส่วนสีของช่างออกแล้ว) ---
    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5"><h4>No data found.</h4></td></tr>`;
            return;
        }

        let tempTableBody = document.createDocumentFragment();
        
        data.sort((a, b) => {
            const techA = a['Ack. By'] || '';
            const techB = b['Ack. By'] || '';
            return techA.localeCompare(techB, undefined, { numeric: true, sensitivity: 'base' });
        });

        data.forEach((row) => {
            const tr = document.createElement('tr');
            
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
    
    // ========== CODE ที่เพิ่มเข้ามา ==========
    // ฟังก์ชันสำหรับอัปเดตการ์ดสรุปข้อมูล
    function updateDashboardCards(data) {
        // 1. คำนวณค่าต่างๆ
        const totalJobs = data.length;

        const postponedJobs = data.filter(row => 
            (row['Remark'] || '').includes('เลื่อนนัด')
        ).length;
        
        const acceptedJobs = data.filter(row =>
            (row['Action Type'] || '').toLowerCase() === 'accepted'
        ).length;

        // การคำนวณงานของวันนี้ต้องเปรียบเทียบเฉพาะ "วันที่" ไม่รวม "เวลา"
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ตั้งเวลาเป็นเที่ยงคืนเพื่อเปรียบเทียบแค่วัน

        const todayJobs = data.filter(row => {
            const appointDate = parseDate(row['Appoint Date']); // ใช้ฟังก์ชัน parseDate ที่คุณมีอยู่แล้ว
            if (!appointDate) return false;
            
            appointDate.setHours(0, 0, 0, 0); // ตั้งเวลาของวันนัดหมายเป็นเที่ยงคืนเช่นกัน
            return appointDate.getTime() === today.getTime();
        }).length;

        // 2. นำค่าที่คำนวณได้ไปแสดงผลบนหน้าเว็บ
        document.getElementById('total-jobs-value').textContent = totalJobs;
        document.getElementById('today-jobs-value').textContent = todayJobs;
        document.getElementById('postponed-jobs-value').textContent = postponedJobs;
        document.getElementById('accepted-jobs-value').textContent = acceptedJobs;
    }
    // ======================================


    function getCorrectDataField(field) {
        return field;
    }

    function updateTableDisplay() {
        let resultData = processedData.filter(row => {
            return Object.keys(activeFilters).every(stateField => {
                const dataField = getCorrectDataField(stateField);
                const filterValue = activeFilters[stateField];
                if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
                
                const rowValue = row[dataField];
                if (Array.isArray(filterValue)) {
                    return filterValue.includes(rowValue);
                } else {
                    return rowValue === filterValue;
                }
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
        
        // ** เพิ่มการเรียกใช้ฟังก์ชันอัปเดตการ์ดที่นี่ **
        // เพื่อให้ตัวเลขบนการ์ดเปลี่ยนตามข้อมูลที่กรองแล้ว
        updateDashboardCards(resultData);
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
                return !itemLower.includes('439 :') && 
                       !itemLower.includes('544 : proactive ensure fault ค่าสัญญาณดี') && 
                       !itemLower.includes('370 :') && 
                       !itemLower.includes('559 : ย้ายจุด/เดินสายภายในบ้าน ประเภทเดินสายลอยตีกิ๊บ จุดละ1000 บาท 20เมตร (รวม vat)') &&
                       !itemLower.includes('proactive');
            });
        }
        
        uniqueValues.sort();

        filterPanelTitle.textContent = `Actions for ${currentField}`;
        filterPanelBody.innerHTML = '';

        const sortButtonsHtml = `
            <div class="filter-panel-sort">
                <div class="btn-group w-100" role="group">
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="sort-asc-btn"><i class="fas fa-arrow-up-a-z"></i> A-Z</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="sort-desc-btn"><i class="fas fa-arrow-down-z-a"></i> Z-A</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" id="clear-sort-btn"><i class="fas fa-times"></i> Clear</button>
                </div>
            </div>
        `;
        const filterPanelHeader = filterPanel.querySelector('.filter-panel-header');
        if (filterPanelHeader) {
            const existingSortPanel = filterPanel.querySelector('.filter-panel-sort');
            if (existingSortPanel) {
                existingSortPanel.remove();
            }
            filterPanelHeader.insertAdjacentHTML('afterend', sortButtonsHtml); 
        }
        
        const newSortAscBtn = document.getElementById('sort-asc-btn');
        const newSortDescBtn = document.getElementById('sort-desc-btn');
        const newClearSortBtn = document.getElementById('clear-sort-btn');

        if (newSortAscBtn) {
            newSortAscBtn.addEventListener('click', () => { 
                sortState = { field: currentField, direction: 'asc' }; 
                updateTableDisplay(); 
                hideFilterPanel(); 
            });
        }
        if (newSortDescBtn) {
            newSortDescBtn.addEventListener('click', () => { 
                sortState = { field: currentField, direction: 'desc' }; 
                updateTableDisplay(); 
                hideFilterPanel(); 
            });
        }
        if (newClearSortBtn) {
            newClearSortBtn.addEventListener('click', () => { 
                sortState = { field: null, direction: 'none' }; 
                updateTableDisplay(); 
                hideFilterPanel(); 
            });
        }

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

        const headerRect = headerElement.getBoundingClientRect();
        const contentRect = document.querySelector('.content').getBoundingClientRect(); 

        filterPanel.style.position = 'absolute'; 
        filterPanel.style.left = `${headerRect.left - contentRect.left}px`;
        filterPanel.style.top = `${headerRect.bottom - contentRect.top + window.scrollY}px`; 
        filterPanel.style.display = 'block';
    }

    function hideFilterPanel() { 
        if (filterPanel) { 
            filterPanel.style.display = 'none';
        }
        currentField = null;
    }

    function updateHeaderStyles() {
        document.querySelectorAll('.filterable-header').forEach(h => {
            const field = h.dataset.field;
            h.classList.toggle('active-filter', !!(activeFilters[field] && (!Array.isArray(activeFilters[field]) || activeFilters[field].length > 0)));
            h.classList.toggle('active-sort', sortState.field === field && sortState.direction !== 'none');
            
            const icon = h.querySelector('.sort-icon');
            if (icon) {
                if (sortState.field === field && sortState.direction === 'asc') { 
                    icon.className = 'sort-icon fas fa-arrow-up';
                } else if (sortState.field === field && sortState.direction === 'desc') { 
                    icon.className = 'sort-icon fas fa-arrow-down';
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

    document.addEventListener('click', (e) => {
        if (filterPanel && filterPanel.style.display === 'block' && !filterPanel.contains(e.target) && !e.target.closest('.filterable-header')) {
            hideFilterPanel();
        }
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
                backgroundColor: '#FFFFFF',
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

    // เรียกใช้ฟังก์ชันแสดงผลหลักครั้งแรก
    updateTableDisplay();
});

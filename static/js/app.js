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

        // --- Logic based on Google Sheet Formula and User's explicit request ---

        // Case 1: User's explicit request: Prefer Date < Appoint Date
        if (preferDate instanceof Date && !isNaN(preferDate.getTime()) && 
            appointDate instanceof Date && !isNaN(appointDate.getTime())) {
            
            if (preferDate.getTime() < appointDate.getTime()) {
                calculatedRemark = 'เลื่อนนัดเปลี่ยน PF';
                remarkSetByLogic = true;
            }
        }

        if (!remarkSetByLogic) {
            // Case 2: Appoint Date is blank (from GS formula)
            if (!appointDateStr || appointDate === null || isNaN(appointDate.getTime())) {
                calculatedRemark = 'ปิดงานใน 24 ชม. จาก Create';
                remarkSetByLogic = true;
            } 
            // Case 3: Prefer Date is blank (from GS formula)
            else if (!preferDateStr || preferDate === null || isNaN(preferDate.getTime())) {
                if (appointDate instanceof Date && !isNaN(appointDate.getTime())) {
                    const futureAppointDate = new Date(appointDate.getTime() + (4 * 60 * 60 * 1000));
                    const formattedFutureAppointDate = `${futureAppointDate.getDate().toString().padStart(2, '0')}/${(futureAppointDate.getMonth() + 1).toString().padStart(2, '0')}/${futureAppointDate.getFullYear()} ${futureAppointDate.getHours().toString().padStart(2, '0')}:${futureAppointDate.getMinutes().toString().padStart(2, '0')}`;
                    calculatedRemark = `ปิดงานก่อน ${formattedFutureAppointDate}`;
                    remarkSetByLogic = true;
                } else {
                    calculatedRemark = 'วันที่ไม่ถูกต้อง/ไม่ครบถ้วน'; 
                    remarkSetByLogic = true;
                }
            } 
            // Case 4: Both dates are valid and not covered by Case 1 (i.e., PreferDate >= AppointDate)
            else if (preferDate instanceof Date && !isNaN(preferDate.getTime()) && 
                     appointDate instanceof Date && !isNaN(appointDate.getTime())) {
                
                if (preferDate.getTime() === appointDate.getTime()) {
                    calculatedRemark = 'ปิดงานได้ตามปกติ';
                    remarkSetByLogic = true;
                } else {
                    calculatedRemark = 'เลื่อนนัดเปลี่ยน PF หรือปิดงานหลัง PF ไม่เกิน 4 ชม.';
                    remarkSetByLogic = true;
                }
            }
            // Case 5: Fallback for invalid/missing date strings not covered by specific blank checks
            else if (appointDateStr || preferDateStr) { 
                calculatedRemark = 'วันที่ไม่ถูกต้อง/ไม่ครบถ้วน';
                remarkSetByLogic = true;
            }
        }

        // --- Final assignment to row['Remark'] ---
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

    // **** นำเงื่อนไขการกรองข้อมูลเริ่มต้นกลับมา ****
    const processedData = fullData.filter(row => {
        // เงื่อนไข 1: ต้องมี Ack. By
        if (!row['Ack. By']) {
            return false;
        }
        // ตรวจสอบ Solution เพื่อกรองแถวที่ไม่ต้องการ
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
    console.log('Processed Data (after initial filtering):', processedData); // Debugging log

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

    // --- ฟังก์ชัน renderTable ---
    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5"><h4>No data found.</h4></td></tr>`;
            return;
        }

        let tempTableBody = document.createDocumentFragment();
        let isEvenRow = false;

        data.forEach((row) => {
            const tr = document.createElement('tr');
            
            if (isEvenRow) {
                tr.classList.add('row-dark-gray');
            } else {
                tr.classList.add('row-light-gray');
            }
            isEvenRow = !isEvenRow;
            
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
        
        console.log('Active Filters:', activeFilters); 
        console.log('Result Data (after filtering and sorting):', resultData); 
        renderTable(resultData);
        updateHeaderStyles();
    }

    // **** นำ showFilterPanel กลับมาใช้งานและแก้ไขการสร้างปุ่ม Sort ****
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
        console.log(`Unique Values for ${currentField}:`, uniqueValues); 

        filterPanelTitle.textContent = `Actions for ${currentField}`;
        filterPanelBody.innerHTML = ''; // **** สำคัญ: ล้างเนื้อหาเดิมก่อนเพิ่มใหม่ ****

        // **** สร้างปุ่ม Sort ภายใน Filter Panel ****
        const sortButtonsHtml = `
            <div class="filter-panel-sort">
                <div class="btn-group w-100" role="group">
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="sort-asc-btn"><i class="fas fa-arrow-up-a-z"></i> A-Z</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="sort-desc-btn"><i class="fas fa-arrow-down-z-a"></i> Z-A</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" id="clear-sort-btn"><i class="fas fa-times"></i> Clear</button>
                </div>
            </div>
        `;
        // เพิ่มปุ่ม Sort หลัง header
        // **** แก้ไขตรงนี้: ตรวจสอบว่า filterPanel.querySelector('.filter-panel-header') มีอยู่ก่อนที่จะเพิ่ม HTML ****
        const filterPanelHeader = filterPanel.querySelector('.filter-panel-header');
        if (filterPanelHeader) {
            // **** แก้ไขตรงนี้: ลบองค์ประกอบ sort-panel-sort ที่มีอยู่เดิมออกไปก่อนที่จะเพิ่มใหม่ ****
            const existingSortPanel = filterPanel.querySelector('.filter-panel-sort');
            if (existingSortPanel) {
                existingSortPanel.remove();
            }
            filterPanelHeader.insertAdjacentHTML('afterend', sortButtonsHtml); 
        }
        
        // **** Re-attach event listeners for sort buttons (ต้องทำหลังจาก HTML ถูกเพิ่ม) ****
        // ตรวจสอบว่าปุ่มมีอยู่ก่อนที่จะ attach event listener
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

        // **** คำนวณตำแหน่ง Filter Panel ให้สัมพันธ์กับ headerElement ****
        const headerRect = headerElement.getBoundingClientRect();
        const contentRect = document.querySelector('.content').getBoundingClientRect(); 

        filterPanel.style.position = 'absolute'; 
        filterPanel.style.left = `${headerRect.left - contentRect.left}px`;
        filterPanel.style.top = `${headerRect.bottom - contentRect.top + window.scrollY}px`; 
        filterPanel.style.display = 'block';
    }

    // **** นำ hideFilterPanel กลับมาใช้งาน ****
    function hideFilterPanel() { 
        if (filterPanel) { // ตรวจสอบว่า filterPanel มีอยู่ก่อนซ่อน
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

    // **** นำ Event Listeners สำหรับปุ่ม Apply/Clear Filter กลับมาใช้งาน ****
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

    // **** นำ Event Listener สำหรับคลิกนอก Filter Panel กลับมาใช้งาน ****
    document.addEventListener('click', (e) => {
        // ตรวจสอบว่า filterPanel มีอยู่ก่อนที่จะเรียกใช้ .contains
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

    updateTableDisplay();
});

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

    // --- ฟังก์ชันสำหรับแปลงข้อความวันที่เป็น Date Object ---
    function parseDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split(' ');
        if (parts.length < 1) return null;
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return null;
        // รูปแบบวันที่คือ DD/MM/YYYY, ต้องเรียงใหม่เป็น YYYY, MM-1, DD สำหรับ JavaScript
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
    }

    // --- ประมวลผลข้อมูลล่วงหน้าเพื่อกำหนดค่า Remark ---
    fullData.forEach(row => {
        const appointDate = parseDate(row['Appoint Date']);
        const preferDate = parseDate(row['Prefer Date']);

        // ตรวจสอบว่าวันที่ถูกต้องและ Prefer Date มาก่อน Appoint Date หรือไม่
        if (preferDate && appointDate && preferDate < appointDate) {
            row['Remark'] = 'เลื่อนนัดเปลี่ยน PF';
        }
    });


    const processedData = fullData.filter(row => row['Ack. By']);

    // --- ฟังก์ชันสำหรับกำหนดสีให้คอลัมน์ Remark ---
    function getRemarkClass(remarkText) {
        if (!remarkText) return '';

        // ตรวจสอบเงื่อนไขที่เฉพาะเจาะจงที่สุดก่อน
        if (remarkText.includes('เลื่อนนัดเปลี่ยน PF หรือปิดงานหลัง PF ไม่เกิน 4 ชม.')) {
            return 'bg-warning text-dark'; // สีส้มเข้ม (ใช้สี warning ของ Bootstrap)
        }
        
        // เงื่อนไขอื่นๆ
        if (remarkText.includes('ปิดงานได้ตามปกติ')) {
            return 'bg-success-subtle text-success-emphasis'; // สีเขียวอ่อน
        }
        if (remarkText.includes('เลื่อนนัดเปลี่ยน PF')) {
            return 'bg-danger-subtle text-danger-emphasis'; // สีแดงอ่อน (สำหรับกรณีทั่วไป)
        }
        if (remarkText.includes('ปิดงานก่อน')) {
            return 'bg-warning-subtle text-warning-emphasis'; // สีเหลืองอ่อน
        }
        if (remarkText.includes('ปิดงานใน')) {
            return 'bg-info-subtle text-info-emphasis'; // สีฟ้าอ่อน
        }
        return '';
    }

    // --- เพิ่มตรรกะการสลับสีพื้นหลังแบบกลุ่ม ---
    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5"><h4>No data found.</h4></td></tr>`;
            return;
        }

        let lastTech = null;
        let isOddGroup = false;

        data.forEach(row => {
            const tr = document.createElement('tr');

            // --- จุดที่แก้ไข: ตรวจสอบว่ากำลังจัดเรียงตามชื่อช่างหรือไม่ ---
            if (sortState.field === 'Ack. By') {
                const currentTech = row['Ack. By'];
                if (currentTech !== lastTech) {
                    isOddGroup = !isOddGroup; // สลับสีสำหรับกลุ่มใหม่
                    lastTech = currentTech;
                }
                // เพิ่ม class สลับสีถ้าเป็นกลุ่มคี่
                if (isOddGroup) {
                    tr.classList.add('table-group-striped');
                }
            }

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
            tableBody.appendChild(tr);
        });
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
                return !item.startsWith('439 :') && !item.startsWith('544 :') && !item.startsWith('370 :') && !item.startsWith('559 :');
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
                // Removed backgroundColor: '#ffffff' to allow html2canvas to capture the rendered CSS background colors (e.g., striped table rows).
                // If a specific background color is needed for transparent areas not covered by content,
                // consider setting it to 'transparent' or the desired fallback color based on your CSS.
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

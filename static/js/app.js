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

    const processedData = fullData.filter(row => row['Ack. By']);

    function getRemarkClass(remarkText) {
        if (!remarkText) return '';
        if (remarkText.includes('ปิดงานได้ตามปกติ')) return 'bg-success-subtle text-success-emphasis';
        if (remarkText.includes('เลื่อนนัดเปลี่ยน PF')) return 'bg-danger-subtle text-danger-emphasis';
        if (remarkText.includes('ปิดงานก่อน')) return 'bg-warning-subtle text-warning-emphasis';
        if (remarkText.includes('ปิดงานใน')) return 'bg-info-subtle text-info-emphasis';
        return '';
    }

    function renderTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-5"><h4>No data found.</h4></td></tr>`;
            return;
        }
        data.forEach(row => {
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
        
        // --- จุดที่แก้ไข: เพิ่มการกรองค่าที่ไม่ต้องการออก ---
        if (dataField === 'Solution') {
            uniqueValues = uniqueValues.filter(item => {
                return !item.startsWith('439 :') && !item.startsWith('544 :') && !item.startsWith('370 :');
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
                backgroundColor: '#ffffff'
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

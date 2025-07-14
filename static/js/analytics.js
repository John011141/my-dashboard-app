document.addEventListener('DOMContentLoaded', function () {
    if (typeof fullData === 'undefined' || !Array.isArray(fullData) || fullData.length === 0) {
        console.log("No data available for analytics.");
        return;
    }

    // --- 1. Calculate KPIs ---
    const totalJobs = fullData.length;
    const uniqueTechs = new Set(fullData.map(job => job['Ack. By']).filter(Boolean)).size;
    const completedJobs = fullData.filter(job => job['Remark'] && job['Remark'].includes('ปิดงานได้ตามปกติ')).length;

    document.getElementById('total-jobs').textContent = totalJobs;
    document.getElementById('unique-techs').textContent = uniqueTechs;
    document.getElementById('completed-jobs').textContent = completedJobs;

    // --- 2. Jobs by Technician Chart (Bar Chart) ---
    const jobsByTechCtx = document.getElementById('jobsByTechChart');
    if (jobsByTechCtx) {
        const techCounts = fullData.reduce((acc, job) => {
            const tech = job['Ack. By'];
            if (tech) {
                acc[tech] = (acc[tech] || 0) + 1;
            }
            return acc;
        }, {});

        const sortedTechs = Object.entries(techCounts).sort(([,a],[,b]) => b-a).slice(0, 10); // Top 10

        new Chart(jobsByTechCtx, {
            type: 'bar',
            data: {
                labels: sortedTechs.map(entry => entry[0]),
                datasets: [{
                    label: 'จำนวนงาน',
                    data: sortedTechs.map(entry => entry[1]),
                    backgroundColor: 'rgba(74, 144, 226, 0.6)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'จำนวนงานต่อช่าง (Top 10)',
                        font: { size: 16, family: 'Sarabun' }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // --- 3. Solution Distribution (Pie Chart) ---
    const solutionPieCtx = document.getElementById('solutionPieChart');
    if (solutionPieCtx) {
        const solutionCounts = fullData.reduce((acc, job) => {
            const solution = job['Solution'];
            if (solution) {
                acc[solution] = (acc[solution] || 0) + 1;
            }
            return acc;
        }, {});

        const sortedSolutions = Object.entries(solutionCounts).sort(([,a],[,b]) => b-a).slice(0, 7);
        const labels = sortedSolutions.map(entry => entry[0]);
        const data = sortedSolutions.map(entry => entry[1]);

        new Chart(solutionPieCtx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Solutions',
                    data: data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(99, 255, 132, 0.7)'
                    ],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'สัดส่วนประเภทของปัญหา (Top 7)',
                        font: { size: 16, family: 'Sarabun' }
                    },
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }
});

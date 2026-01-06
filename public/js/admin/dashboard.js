
    let revenueChart, orderChart;

    function initCharts(data) {
      if (revenueChart) revenueChart.destroy();
      if (orderChart) orderChart.destroy();

      const revCtx = document.getElementById('revenueChart');
      if (revCtx) {
        revenueChart = new Chart(revCtx, { type: 'line', data: { labels: data.labels, datasets: [{ label: 'Revenue (₹)', data: data.revenue, borderColor: 'rgb(34,197,94)', backgroundColor: 'rgba(34,197,94,0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: v => '₹' + v } } } } });
      }

      const ordCtx = document.getElementById('orderChart');
      if (ordCtx) {
        orderChart = new Chart(ordCtx, { type: 'bar', data: { labels: data.labels, datasets: [{ label: 'Orders', data: data.orderCount, backgroundColor: 'rgba(59,130,246,0.8)' }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } });
      }
    }

    function attachAllListeners() {
      const form = document.getElementById('salesFilterForm');
      if (form) form.onsubmit = e => { e.preventDefault(); loadReport(buildQuery()); };

      document.querySelector('a[href="/admin/dashboard"]')?.addEventListener('click', e => { e.preventDefault(); loadReport(''); });

      document.addEventListener('click', e => {
        const link = e.target.closest('a[href^="/admin/dashboard"]');
        if (link && link.href.includes('page=')) { e.preventDefault(); loadReport(new URL(link.href).searchParams.toString()); }
      });

      const chartScript = document.getElementById('chart-data');
      if (chartScript) initCharts(JSON.parse(chartScript.textContent));
    }

    function buildQuery() {
      const p = document.getElementById('period').value;
      const params = new URLSearchParams();
      if (p) params.set('period', p);
      if (p === 'custom') {
        const s = document.getElementById('startDate').value;
        const e = document.getElementById('endDate').value;
        if (s && e) { params.set('startDate', s); params.set('endDate', e); }
      }
      return params.toString();
    }

    async function loadReport(query) {
      const url = `/admin/dashboard${query ? '?' + query : ''}`;
      try {
        const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newMain = doc.querySelector('main');
        if (newMain) {
          if (revenueChart) revenueChart.destroy();
          if (orderChart) orderChart.destroy();
          document.querySelector('main').innerHTML = newMain.innerHTML;
          attachAllListeners();
          history.replaceState(null, '', url);
        }
      } catch (err) { alert('Error: ' + err.message); }
    }

    document.addEventListener('DOMContentLoaded', () => {
      attachAllListeners();
      document.getElementById('period').addEventListener('change', () => {
        document.getElementById('customDateRange').classList.toggle('hidden', document.getElementById('period').value !== 'custom');
      });
    });
 
/**
 * QuoteNudge Commercial Reports & Lost Sales Insights (js/reports.js)
 * Multi-dimensional filtering, conversion & cycle-time KPIs, Lost Sale Reasons breakdown,
 * responsive SVG charts, and CSV export.
 */
window.QN = window.QN || {};

window.QN.Reports = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  let filters = {
    startDate: Utils.addDaysISO(Utils.todayISO(), -90),
    endDate: Utils.todayISO(),
    status: 'All',
    customerId: 'All',
    serviceCategory: 'All'
  };

  function getFilteredQuotes() {
    return Storage.getQuotes().filter((q) => {
      const d = q.createdDate || Utils.todayISO();
      if (filters.startDate && d < filters.startDate) return false;
      if (filters.endDate && d > filters.endDate) return false;
      if (filters.status !== 'All' && q.status !== filters.status) return false;
      if (filters.customerId !== 'All' && q.customerId !== filters.customerId) return false;
      if (filters.serviceCategory !== 'All' && (q.serviceCategory || 'Other') !== filters.serviceCategory) return false;
      return true;
    });
  }

  function render(container) {
    const settings = Storage.getSettings();
    const customers = Storage.getCustomers();
    const quotes = getFilteredQuotes();
    const quoteIds = new Set(quotes.map((q) => q.id));
    const activities = Storage.getActivities().filter((a) => quoteIds.has(a.quoteId));

    const sentQuotes = quotes.filter((q) => q.status !== 'Draft');
    const wonQuotes = quotes.filter((q) => q.status === 'Won');
    const lostQuotes = quotes.filter((q) => q.status === 'Lost');
    const negotiatingQuotes = quotes.filter((q) => q.status === 'Negotiating');
    const atRiskQuotes = quotes.filter((q) => {
      const h = Utils.computeQuoteHealth(q, settings);
      return h.code === 'overdue' || h.code === 'at_risk';
    });

    const totalApprovedVal = wonQuotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
    const totalLostVal = lostQuotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
    const negotiatingVal = negotiatingQuotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
    const atRiskVal = atRiskQuotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
    const avgQuoteVal = quotes.length > 0 ? quotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0) / quotes.length : 0;

    const closedCount = wonQuotes.length + lostQuotes.length;
    const conversionRate = closedCount > 0 ? Math.round((wonQuotes.length / closedCount) * 100) : 0;

    // Average days to approval
    let avgDaysToWin = 0;
    if (wonQuotes.length > 0) {
      const totalDays = wonQuotes.reduce((sum, q) => {
        const end = q.wonDate || q.lastContactDate || q.createdDate;
        return sum + Math.max(1, Utils.daysBetween(q.createdDate, end));
      }, 0);
      avgDaysToWin = Math.round(totalDays / wonQuotes.length);
    }

    const followUpsDone = activities.filter((a) => ['followup', 'whatsapp', 'email'].includes(a.type)).length;

    const serviceCategories = [
      'All',
      'Consulting',
      'Design & Branding',
      'Web & Software',
      'Marketing & Growth',
      'Maintenance & Support',
      'Other'
    ];

    container.innerHTML = `
      <!-- Report Filters & CSV Export -->
      <div class="card mb-3">
        <div class="toolbar-bar" style="margin-bottom:0;">
          <div class="toolbar-group">
            <div>
              <label class="text-xs text-muted" style="display:block;">From</label>
              <input type="date" id="repStartDate" class="form-control" value="${filters.startDate}" />
            </div>
            <div>
              <label class="text-xs text-muted" style="display:block;">To</label>
              <input type="date" id="repEndDate" class="form-control" value="${filters.endDate}" />
            </div>
            <div>
              <label class="text-xs text-muted" style="display:block;">Status</label>
              <select id="repStatusFilter" class="form-control">
                <option value="All">All Statuses</option>
                ${['Draft', 'Sent', 'Awaiting Response', 'Negotiating', 'Won', 'Lost']
                  .map((s) => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${s}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-muted" style="display:block;">Customer</label>
              <select id="repCustomerFilter" class="form-control">
                <option value="All">All Customers</option>
                ${customers
                  .map((c) => `<option value="${c.id}" ${filters.customerId === c.id ? 'selected' : ''}>${Utils.escapeHTML(c.name)}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="text-xs text-muted" style="display:block;">Service Category</label>
              <select id="repServiceFilter" class="form-control">
                ${serviceCategories
                  .map((cat) => `<option value="${cat}" ${filters.serviceCategory === cat ? 'selected' : ''}>${cat}</option>`)
                  .join('')}
              </select>
            </div>
          </div>

          <button type="button" id="btnExportCsv" class="btn btn-primary">Export Report (CSV)</button>
        </div>
      </div>

      <!-- 9 Report Metrics -->
      <section class="kpi-grid" style="grid-template-columns:repeat(auto-fit, minmax(195px, 1fr));">
        <div class="kpi-card">
          <span class="kpi-label">Quotes Sent</span>
          <span class="kpi-value">${sentQuotes.length}</span>
          <span class="kpi-sub">Total proposals sent</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Total Approved</span>
          <span class="kpi-value text-success">${Utils.formatCurrency(totalApprovedVal)}</span>
          <span class="kpi-sub">${wonQuotes.length} won quote(s)</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Total Lost</span>
          <span class="kpi-value text-danger">${Utils.formatCurrency(totalLostVal)}</span>
          <span class="kpi-sub">${lostQuotes.length} lost quote(s)</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Conversion Rate</span>
          <span class="kpi-value">${conversionRate}%</span>
          <span class="kpi-sub">Won vs. closed deals</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Average Quote Value</span>
          <span class="kpi-value">${Utils.formatCurrency(avgQuoteVal)}</span>
          <span class="kpi-sub">Across ${quotes.length} quote(s)</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Avg. Time to Approval</span>
          <span class="kpi-value">${avgDaysToWin}d</span>
          <span class="kpi-sub">From creation to Won</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">In Negotiation</span>
          <span class="kpi-value" style="color:var(--color-purple);">${Utils.formatCurrency(negotiatingVal)}</span>
          <span class="kpi-sub">${negotiatingQuotes.length} active negotiation(s)</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">At-Risk Value</span>
          <span class="kpi-value text-warning">${Utils.formatCurrency(atRiskVal)}</span>
          <span class="kpi-sub">${atRiskQuotes.length} stalled/overdue</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Follow-ups Logged</span>
          <span class="kpi-value">${followUpsDone}</span>
          <span class="kpi-sub">Recorded touchpoints</span>
        </div>
      </section>

      <!-- Charts & Lost Sales Insights -->
      <section class="charts-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Value by Service Category</h3>
            <span class="text-xs text-muted">Total quoted volume</span>
          </div>
          <div id="repCategoryChart" class="chart-box"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Lost Sales Insights</h3>
            <span class="text-xs text-muted">Why deals were not closed</span>
          </div>
          ${renderLostInsights(lostQuotes)}
        </div>
      </section>
    `;

    renderCategoryChart(quotes);
    bindEvents(container, quotes);
  }

  function renderLostInsights(lostQuotes) {
    if (lostQuotes.length === 0) {
      return `<div class="empty-state"><p class="text-muted text-sm">No lost quotes in the selected filter range.</p></div>`;
    }

    const reasons = ['Too Expensive', 'Chose a Competitor', 'No Response', 'Project Cancelled', 'Other'];
    const total = lostQuotes.length;

    return `
      <div style="display:flex;flex-direction:column;gap:0.85rem;">
        ${reasons
          .map((r) => {
            const count = lostQuotes.filter((q) => (q.lostReason || 'Other') === r).length;
            const pct = Math.round((count / total) * 100);
            return `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:0.83rem;margin-bottom:0.25rem;">
                  <span class="font-semibold">${r}</span>
                  <span><strong>${count}</strong> (${pct}%)</span>
                </div>
                <div style="height:10px;background:var(--bg-subtle);border-radius:999px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:var(--color-danger);border-radius:999px;"></div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function renderCategoryChart(quotes) {
    const map = {};
    quotes.forEach((q) => {
      const cat = q.serviceCategory || 'Other';
      map[cat] = (map[cat] || 0) + (Number(q.totalAmount) || 0);
    });
    const labels = Object.keys(map);
    Utils.renderBarChart(document.getElementById('repCategoryChart'), {
      labels,
      seriesA: labels.map((l) => map[l]),
      labelA: 'Quoted Value',
      formatVal: (v) => Utils.formatCurrency(v)
    });
  }

  function exportCSV(quotes) {
    if (quotes.length === 0) {
      Utils.toast('No records to export for the current filters.', 'warning');
      return;
    }

    const headers = [
      'Quote Number',
      'Title',
      'Customer',
      'Service Category',
      'Status',
      'Priority',
      'Currency',
      'Total Amount',
      'Created Date',
      'Follow-up Date',
      'Expiration Date',
      'Lost Reason'
    ];

    const rows = quotes.map((q) => {
      const cust = Storage.getCustomerById(q.customerId);
      return [
        q.quoteNumber,
        q.title,
        cust ? cust.name : '',
        q.serviceCategory || '',
        q.status,
        q.priority,
        q.currency,
        q.totalAmount,
        q.createdDate,
        q.followUpDate || '',
        q.expirationDate || '',
        q.lostReason || ''
      ]
        .map((val) => `"${String(val == null ? '' : val).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotenudge-report-${Utils.todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Utils.toast('CSV report downloaded!');
  }

  function bindEvents(container, quotes) {
    container.querySelector('#repStartDate').addEventListener('change', (e) => {
      filters.startDate = e.target.value;
      render(container);
    });
    container.querySelector('#repEndDate').addEventListener('change', (e) => {
      filters.endDate = e.target.value;
      render(container);
    });
    container.querySelector('#repStatusFilter').addEventListener('change', (e) => {
      filters.status = e.target.value;
      render(container);
    });
    container.querySelector('#repCustomerFilter').addEventListener('change', (e) => {
      filters.customerId = e.target.value;
      render(container);
    });
    container.querySelector('#repServiceFilter').addEventListener('change', (e) => {
      filters.serviceCategory = e.target.value;
      render(container);
    });
    container.querySelector('#btnExportCsv').addEventListener('click', () => exportCSV(quotes));
  }

  return { render };
})();
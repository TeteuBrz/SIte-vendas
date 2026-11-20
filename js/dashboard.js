/**
 * QuoteNudge Overview Dashboard (js/dashboard.js)
 * Renders Today's Focus, 6 real-time commercial KPIs, "Your Next Actions" engine,
 * Quote Health watch list, and 4 interactive SVG charts.
 */
window.QN = window.QN || {};

window.QN.Dashboard = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  let periodState = {
    preset: '30d',
    startDate: Utils.addDaysISO(Utils.todayISO(), -30),
    endDate: Utils.todayISO()
  };

  function getPeriodRange() {
    const today = Utils.todayISO();
    if (periodState.preset === 'today') {
      return { start: today, end: today };
    }
    if (periodState.preset === '7d') {
      return { start: Utils.addDaysISO(today, -7), end: today };
    }
    if (periodState.preset === '30d') {
      return { start: Utils.addDaysISO(today, -30), end: today };
    }
    if (periodState.preset === '90d') {
      return { start: Utils.addDaysISO(today, -90), end: today };
    }
    return {
      start: periodState.startDate || Utils.addDaysISO(today, -30),
      end: periodState.endDate || today
    };
  }

  /**
   * Builds prioritized recommendations for "Your Next Actions" using transparent rules.
   */
  function buildNextActions(quotes, settings) {
    const today = Utils.todayISO();
    const actions = [];

    quotes.forEach((q) => {
      if (q.status === 'Won' || q.status === 'Lost') return;
      const customer = Storage.getCustomerById(q.customerId);
      const clientName = customer ? customer.name : 'Unknown Client';
      const health = Utils.computeQuoteHealth(q, settings);
      const formattedVal = Utils.formatCurrency(q.totalAmount, q.currency);

      if (q.status === 'Draft') {
        actions.push({
          quote: q,
          customer,
          urgency: 'medium',
          badge: 'Unsent Draft',
          badgeClass: 'badge-neutral',
          daysNoReply: health.daysSinceContact,
          sentence: `Draft quote "${q.title}" (${formattedVal}) for ${clientName} hasn't been sent yet.`
        });
        return;
      }

      if (health.code === 'overdue') {
        actions.push({
          quote: q,
          customer,
          urgency: 'high',
          badge: health.reason,
          badgeClass: 'badge-red',
          daysNoReply: health.daysSinceContact,
          sentence: `${clientName} has not responded to your quote of ${formattedVal} for ${health.daysSinceContact} day${health.daysSinceContact === 1 ? '' : 's'}. It's a good time to follow up.`
        });
        return;
      }

      if (q.followUpDate === today) {
        actions.push({
          quote: q,
          customer,
          urgency: 'high',
          badge: 'Follow-up Due Today',
          badgeClass: 'badge-green',
          daysNoReply: health.daysSinceContact,
          sentence: `Scheduled follow-up today with ${clientName} regarding "${q.title}" (${formattedVal}).`
        });
        return;
      }

      if (health.code === 'expiring') {
        actions.push({
          quote: q,
          customer,
          urgency: 'medium',
          badge: health.reason,
          badgeClass: 'badge-yellow',
          daysNoReply: health.daysSinceContact,
          sentence: `Quote "${q.title}" (${formattedVal}) for ${clientName} ${health.reason.toLowerCase()}. Reach out before it expires.`
        });
        return;
      }

      if (health.code === 'at_risk') {
        actions.push({
          quote: q,
          customer,
          urgency: 'medium',
          badge: 'At Risk',
          badgeClass: 'badge-yellow',
          daysNoReply: health.daysSinceContact,
          sentence: `${clientName} has been awaiting a follow-up on "${q.title}" (${formattedVal}) for ${health.daysSinceContact} days.`
        });
      }
    });

    const rank = { high: 0, medium: 1, low: 2 };
    actions.sort((a, b) => rank[a.urgency] - rank[b.urgency] || b.daysNoReply - a.daysNoReply);
    return actions;
  }

  function render(container) {
    const allQuotes = Storage.getQuotes();
    const settings = Storage.getSettings();
    const today = Utils.todayISO();
    const range = getPeriodRange();

    // Filter quotes inside selected period for period KPIs
    const periodQuotes = allQuotes.filter((q) => {
      const d = q.createdDate || today;
      return d >= range.start && d <= range.end;
    });

    // 1. Total Quoted (non-draft quotes sent in period)
    const sentInPeriod = periodQuotes.filter((q) => q.status !== 'Draft');
    const totalQuotedVal = sentInPeriod.reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);

    // 2. Awaiting Response (active pipeline awaiting reply or negotiating)
    const awaitingQuotes = allQuotes.filter((q) => ['Sent', 'Awaiting Response', 'Negotiating'].includes(q.status));
    const awaitingVal = awaitingQuotes.reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);

    // 3. Follow-ups Due (today or overdue)
    const dueFollowups = allQuotes.filter(
      (q) => !['Won', 'Lost', 'Draft'].includes(q.status) && q.followUpDate && q.followUpDate <= today
    );

    // 4. Conversion Rate (Won / (Won + Lost) in period, fallback to all-time if none closed in period)
    const closedPeriod = periodQuotes.filter((q) => q.status === 'Won' || q.status === 'Lost');
    const closedPool = closedPeriod.length > 0 ? closedPeriod : allQuotes.filter((q) => q.status === 'Won' || q.status === 'Lost');
    const wonInPool = closedPool.filter((q) => q.status === 'Won').length;
    const conversionRate = closedPool.length > 0 ? Math.round((wonInPool / closedPool.length) * 100) : 0;

    // 5. Revenue Won (in period)
    const wonQuotesPeriod = periodQuotes.filter((q) => q.status === 'Won');
    const revenueWonVal = wonQuotesPeriod.reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);

    // 6. At-Risk Value (overdue or at_risk open quotes)
    const atRiskQuotes = allQuotes.filter((q) => {
      const h = Utils.computeQuoteHealth(q, settings);
      return h.code === 'overdue' || h.code === 'at_risk';
    });
    const atRiskVal = atRiskQuotes.reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);

    // Today's Focus highlights
    const overdueOnly = allQuotes.filter((q) => Utils.computeQuoteHealth(q, settings).code === 'overdue');
    const overdueVal = overdueOnly.reduce((sum, q) => sum + (Number(q.totalAmount) || 0), 0);
    const highestOpen = [...awaitingQuotes].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))[0];

    const nextActions = buildNextActions(allQuotes, settings);

    container.innerHTML = `
      <!-- Today's Focus Banner -->
      <section class="focus-banner" aria-label="Today's Focus">
        <div>
          <div class="focus-banner-title">
            <span>●</span>
            <span>Today's Focus</span>
          </div>
          <h2>${
            dueFollowups.length > 0
              ? `You have ${dueFollowups.length} client${dueFollowups.length === 1 ? '' : 's'} waiting for follow-up today.`
              : 'All scheduled follow-ups are up to date!'
          }</h2>
          <p class="text-xs" style="color:#CBD5E1;margin-top:0.25rem;">
            ${
              highestOpen
                ? `Top open opportunity: ${Utils.escapeHTML(highestOpen.title)} (${Utils.formatCurrency(highestOpen.totalAmount, highestOpen.currency)})`
                : 'Create a quote to start tracking opportunities.'
            }
          </p>
        </div>

        <div class="focus-metrics">
          <div class="focus-stat">
            <span class="focus-stat-value">${dueFollowups.length}</span>
            <span class="focus-stat-label">Clients to contact</span>
          </div>
          <div class="focus-stat">
            <span class="focus-stat-value" style="color:#FCA5A5;">${Utils.formatCurrency(overdueVal)}</span>
            <span class="focus-stat-label">Overdue quote value</span>
          </div>
          <div class="focus-stat">
            <span class="focus-stat-value" style="color:#FDE68A;">${atRiskQuotes.length}</span>
            <span class="focus-stat-label">Quotes at risk</span>
          </div>
        </div>
      </section>

      <!-- Period Filter Bar -->
      <div class="toolbar-bar">
        <div class="toolbar-group">
          <span class="text-sm font-semibold text-muted">Period:</span>
          <button type="button" class="btn btn-sm ${periodState.preset === 'today' ? 'btn-primary' : 'btn-secondary'}" data-period="today">Today</button>
          <button type="button" class="btn btn-sm ${periodState.preset === '7d' ? 'btn-primary' : 'btn-secondary'}" data-period="7d">Last 7 days</button>
          <button type="button" class="btn btn-sm ${periodState.preset === '30d' ? 'btn-primary' : 'btn-secondary'}" data-period="30d">Last 30 days</button>
          <button type="button" class="btn btn-sm ${periodState.preset === '90d' ? 'btn-primary' : 'btn-secondary'}" data-period="90d">Last 90 days</button>
          <button type="button" class="btn btn-sm ${periodState.preset === 'custom' ? 'btn-primary' : 'btn-secondary'}" data-period="custom">Custom</button>
        </div>

        ${
          periodState.preset === 'custom'
            ? `<div class="toolbar-group">
                <input type="date" id="dashStartDate" class="form-control" style="width:auto;" value="${range.start}" />
                <span class="text-muted text-sm">to</span>
                <input type="date" id="dashEndDate" class="form-control" style="width:auto;" value="${range.end}" />
              </div>`
            : `<span class="text-xs text-muted">Showing ${Utils.formatDate(range.start)} — ${Utils.formatDate(range.end)}</span>`
        }
      </div>

      <!-- 6 Commercial KPIs -->
      <section class="kpi-grid" aria-label="Key Commercial Metrics">
        <div class="kpi-card">
          <div class="kpi-label"><span>Total Quoted</span><span class="badge badge-blue">${sentInPeriod.length}</span></div>
          <div class="kpi-value">${Utils.formatCurrency(totalQuotedVal)}</div>
          <div class="kpi-sub">Proposals sent in period</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label"><span>Awaiting Response</span><span class="badge badge-yellow">${awaitingQuotes.length}</span></div>
          <div class="kpi-value">${Utils.formatCurrency(awaitingVal)}</div>
          <div class="kpi-sub">Active open pipeline</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label"><span>Follow-ups Due</span></div>
          <div class="kpi-value ${dueFollowups.length > 0 ? 'text-warning' : 'text-success'}">${dueFollowups.length}</div>
          <div class="kpi-sub">Clients needing contact</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label"><span>Conversion Rate</span></div>
          <div class="kpi-value">${conversionRate}%</div>
          <div class="kpi-sub">${wonInPool} won of ${closedPool.length} closed</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label"><span>Revenue Won</span><span class="badge badge-green">${wonQuotesPeriod.length}</span></div>
          <div class="kpi-value text-success">${Utils.formatCurrency(revenueWonVal)}</div>
          <div class="kpi-sub">Approved deals in period</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label"><span>At-Risk Value</span><span class="badge badge-red">${atRiskQuotes.length}</span></div>
          <div class="kpi-value text-danger">${Utils.formatCurrency(atRiskVal)}</div>
          <div class="kpi-sub">Overdue or stalled replies</div>
        </div>
      </section>

      <!-- Your Next Actions + Quote Health Watch -->
      <section class="dashboard-split">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Your Next Actions</h3>
              <p class="text-xs text-muted">Prioritized commercial recommendations based on response time &amp; deadlines</p>
            </div>
            <span class="badge badge-green">${nextActions.length} recommended</span>
          </div>

          ${
            nextActions.length === 0
              ? `<div class="empty-state">
                  <h3>No urgent actions right now</h3>
                  <p class="text-muted text-sm mb-2">All active quotes are within their healthy follow-up window.</p>
                  <button type="button" class="btn btn-primary btn-sm" id="btnDashEmptyQuote">+ New Quote</button>
                </div>`
              : `<div class="action-list">
                  ${nextActions
                    .slice(0, 6)
                    .map(
                      (act) => `
                    <div class="action-card-item urgency-${act.urgency}">
                      <div class="action-card-main">
                        <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
                          <span class="badge ${act.badgeClass}">${Utils.escapeHTML(act.badge)}</span>
                          <span class="text-xs text-muted">${Utils.escapeHTML(act.quote.quoteNumber)} • ${Utils.formatCurrency(act.quote.totalAmount, act.quote.currency)}</span>
                        </div>
                        <p class="action-card-sentence">${Utils.escapeHTML(act.sentence)}</p>
                      </div>
                      <div class="action-card-btns">
                        <button type="button" class="btn btn-secondary btn-sm" data-open-quote="${act.quote.id}">Open Quote</button>
                        <button type="button" class="btn btn-whatsapp btn-sm" data-contact-quote="${act.quote.id}">Contact</button>
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>

        <!-- Quote Health Monitor -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Quote Health Monitor</h3>
              <p class="text-xs text-muted">Transparent rules (At-risk after ${settings.atRiskDays}d without reply)</p>
            </div>
            <button type="button" class="link-btn text-xs" data-nav="quotes">View all &rarr;</button>
          </div>

          ${renderQuoteHealthList(allQuotes, settings)}
        </div>
      </section>

      <!-- 4 Responsive SVG Charts -->
      <section class="charts-grid" aria-label="Commercial Analytics">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quotes Sent vs. Won</h3>
            <span class="text-xs text-muted">Gray: Sent • Green: Won</span>
          </div>
          <div id="chartSentVsWon" class="chart-box"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quotes by Status</h3>
            <span class="text-xs text-muted">Current pipeline breakdown</span>
          </div>
          <div id="chartStatusDonut" class="chart-box"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Won Revenue Evolution</h3>
            <span class="text-xs text-muted">Approved deal value trend</span>
          </div>
          <div id="chartWonTrend" class="chart-box"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Commercial Conversion Funnel</h3>
            <span class="text-xs text-muted">Stage progression</span>
          </div>
          <div id="chartFunnel" class="chart-box"></div>
        </div>
      </section>
    `;

    bindEvents(container, allQuotes, periodQuotes);
    renderCharts(allQuotes, periodQuotes);
  }

  function renderQuoteHealthList(allQuotes, settings) {
    const active = allQuotes.filter((q) => !['Won', 'Lost'].includes(q.status));
    if (active.length === 0) {
      return `<div class="empty-state"><p class="text-muted text-sm">No open quotes to evaluate yet.</p></div>`;
    }

    const enriched = active
      .map((q) => ({ quote: q, health: Utils.computeQuoteHealth(q, settings) }))
      .sort((a, b) => {
        const weight = { overdue: 0, at_risk: 1, expiring: 2, draft: 3, healthy: 4 };
        return (weight[a.health.code] ?? 5) - (weight[b.health.code] ?? 5);
      });

    return `
      <div class="action-list">
        ${enriched
          .slice(0, 6)
          .map(({ quote, health }) => {
            const cust = Storage.getCustomerById(quote.customerId);
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.65rem 0.75rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                <div style="min-width:0;">
                  <div class="font-semibold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${Utils.escapeHTML(quote.title)}
                  </div>
                  <div class="text-xs text-muted">
                    ${Utils.escapeHTML(cust ? cust.name : 'Client')} • ${Utils.escapeHTML(health.reason)}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
                  <span class="badge ${health.badgeClass}">${Utils.escapeHTML(health.label)}</span>
                  <button type="button" class="btn btn-ghost btn-sm" data-open-quote="${quote.id}" title="Inspect quote">&rarr;</button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function renderCharts(allQuotes, periodQuotes) {
    // 1. Sent vs Won grouped by date bucket (last 6 active dates or weekly buckets)
    const buckets = {};
    periodQuotes.forEach((q) => {
      const key = (q.createdDate || Utils.todayISO()).slice(5); // MM-DD
      if (!buckets[key]) buckets[key] = { sent: 0, won: 0 };
      if (q.status !== 'Draft') buckets[key].sent += Number(q.totalAmount) || 0;
      if (q.status === 'Won') buckets[key].won += Number(q.totalAmount) || 0;
    });

    const sortedKeys = Object.keys(buckets).sort().slice(-7);
    Utils.renderBarChart(document.getElementById('chartSentVsWon'), {
      labels: sortedKeys,
      seriesA: sortedKeys.map((k) => buckets[k].sent),
      seriesB: sortedKeys.map((k) => buckets[k].won),
      labelA: 'Quoted',
      labelB: 'Won',
      formatVal: (v) => Utils.formatCurrency(v)
    });

    // 2. Status Donut
    const statuses = [
      { label: 'Draft', color: '#94A3B8', value: allQuotes.filter((q) => q.status === 'Draft').length },
      { label: 'Sent', color: '#2563EB', value: allQuotes.filter((q) => q.status === 'Sent').length },
      { label: 'Awaiting', color: '#E9A23B', value: allQuotes.filter((q) => q.status === 'Awaiting Response').length },
      { label: 'Negotiating', color: '#7C3AED', value: allQuotes.filter((q) => q.status === 'Negotiating').length },
      { label: 'Won', color: '#16A36A', value: allQuotes.filter((q) => q.status === 'Won').length },
      { label: 'Lost', color: '#E45858', value: allQuotes.filter((q) => q.status === 'Lost').length }
    ];
    Utils.renderDonutChart(document.getElementById('chartStatusDonut'), statuses);

    // 3. Won Revenue Evolution
    const wonQuotes = allQuotes
      .filter((q) => q.status === 'Won')
      .sort((a, b) => (a.wonDate || a.createdDate).localeCompare(b.wonDate || b.createdDate));
    let runningTotal = 0;
    const trendLabels = [];
    const trendValues = [];
    wonQuotes.forEach((q) => {
      runningTotal += Number(q.totalAmount) || 0;
      trendLabels.push((q.wonDate || q.createdDate).slice(5));
      trendValues.push(runningTotal);
    });
    Utils.renderLineChart(document.getElementById('chartWonTrend'), {
      labels: trendLabels,
      values: trendValues,
      formatVal: (v) => Utils.formatCurrency(v)
    });

    // 4. Conversion Funnel
    const totalCreated = allQuotes.length;
    const totalSent = allQuotes.filter((q) => q.status !== 'Draft').length;
    const totalEngaged = allQuotes.filter((q) => ['Negotiating', 'Won'].includes(q.status)).length;
    const totalWon = allQuotes.filter((q) => q.status === 'Won').length;

    const funnelEl = document.getElementById('chartFunnel');
    if (funnelEl) {
      const stages = [
        { label: 'Created Quotes', count: totalCreated, color: '#64748B' },
        { label: 'Sent to Client', count: totalSent, color: '#2563EB' },
        { label: 'Negotiating / Engaged', count: totalEngaged, color: '#7C3AED' },
        { label: 'Approved (Won)', count: totalWon, color: '#16A36A' }
      ];
      const maxC = Math.max(1, totalCreated);
      funnelEl.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:0.85rem;padding-top:0.35rem;">
          ${stages
            .map((st) => {
              const pct = Math.round((st.count / maxC) * 100);
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.25rem;">
                    <span class="font-semibold">${st.label}</span>
                    <span><strong>${st.count}</strong> (${pct}%)</span>
                  </div>
                  <div style="height:12px;background:var(--bg-subtle);border-radius:999px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${st.color};border-radius:999px;transition:width 0.3s ease;"></div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }
  }

  function bindEvents(container) {
    container.querySelectorAll('[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        periodState.preset = btn.dataset.period;
        render(container);
      });
    });

    const startInput = container.querySelector('#dashStartDate');
    const endInput = container.querySelector('#dashEndDate');
    if (startInput) {
      startInput.addEventListener('change', (e) => {
        periodState.startDate = e.target.value;
        render(container);
      });
    }
    if (endInput) {
      endInput.addEventListener('change', (e) => {
        periodState.endDate = e.target.value;
        render(container);
      });
    }

    container.querySelectorAll('[data-open-quote]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.QN.Quotes.openDetailModal(btn.dataset.openQuote);
      });
    });

    container.querySelectorAll('[data-contact-quote]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.QN.Quotes.openDetailModal(btn.dataset.contactQuote, true);
      });
    });

    container.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.QN.App.navigate(btn.dataset.nav);
      });
    });

    const emptyBtn = container.querySelector('#btnDashEmptyQuote');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => window.QN.Quotes.openFormModal());
    }
  }

  return { render };
})();
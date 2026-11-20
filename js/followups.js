/**
 * QuoteNudge Follow-up Hub (js/followups.js)
 * Overdue, Today, and Upcoming queues, "Mark as Contacted" outcome modal,
 * interactive monthly Follow-up Calendar, and configurable cadence suggestions.
 */
window.QN = window.QN || {};

window.QN.FollowUps = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  let calendarMonthOffset = 0;
  let selectedCalendarDate = Utils.todayISO();

  function getCadenceSuggestion(daysWithoutReply, rules) {
    const sorted = [...rules].sort((a, b) => b.days - a.days);
    const match = sorted.find((r) => daysWithoutReply >= r.days);
    return match ? match.label : 'Send a polite check-in message to confirm they received the proposal.';
  }

  function render(container) {
    const today = Utils.todayISO();
    const settings = Storage.getSettings();
    const rules = settings.cadenceRules || [];

    const openQuotes = Storage.getQuotes().filter((q) => !['Won', 'Lost', 'Draft'].includes(q.status));

    const overdue = openQuotes
      .filter((q) => q.followUpDate && q.followUpDate < today)
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

    const dueToday = openQuotes
      .filter((q) => q.followUpDate === today)
      .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));

    const upcoming = openQuotes
      .filter((q) => q.followUpDate && q.followUpDate > today)
      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));

    container.innerHTML = `
      <!-- Top Summary -->
      <section class="kpi-grid kpi-grid-4">
        <div class="kpi-card">
          <div class="kpi-label"><span>Overdue Follow-ups</span><span class="badge badge-red">Urgent</span></div>
          <div class="kpi-value text-danger">${overdue.length}</div>
          <div class="kpi-sub">Missed scheduled contact date</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label"><span>Due Today</span><span class="badge badge-green">Focus</span></div>
          <div class="kpi-value text-success">${dueToday.length}</div>
          <div class="kpi-sub">Scheduled for ${Utils.formatDate(today)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label"><span>Upcoming</span><span class="badge badge-blue">Planned</span></div>
          <div class="kpi-value">${upcoming.length}</div>
          <div class="kpi-sub">Future scheduled touchpoints</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label"><span>Open Pipeline Value</span></div>
          <div class="kpi-value">${Utils.formatCurrency(openQuotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0))}</div>
          <div class="kpi-sub">Across ${openQuotes.length} active proposals</div>
        </div>
      </section>

      <!-- Three Priority Columns -->
      <section class="followup-sections" aria-label="Follow-up Queues">
        ${renderQueueColumn('Overdue', 'badge-red', overdue, rules, 'No overdue follow-ups!')}
        ${renderQueueColumn('Today', 'badge-green', dueToday, rules, 'No follow-ups due today.')}
        ${renderQueueColumn('Upcoming', 'badge-blue', upcoming, rules, 'No upcoming follow-ups scheduled.')}
      </section>

      <!-- Follow-up Calendar + Configurable Cadence Suggestions -->
      <section class="dashboard-split">
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Follow-up Calendar</h3>
              <p class="text-xs text-muted">Click any date to inspect scheduled client contacts</p>
            </div>
            <div class="toolbar-group">
              <button type="button" class="btn btn-secondary btn-sm" id="btnCalPrev">&larr;</button>
              <strong id="calMonthLabel" class="text-sm"></strong>
              <button type="button" class="btn btn-secondary btn-sm" id="btnCalNext">&rarr;</button>
            </div>
          </div>
          <div id="calendarGridContainer"></div>
          <div id="calendarDayAgenda" class="mt-3"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Follow-up Suggestions (Guidance Rules)</h3>
              <p class="text-xs text-muted">Recommended touchpoints by days without response (manual confirmation always required)</p>
            </div>
          </div>

          <div class="action-list">
            ${rules
              .map(
                (r, idx) => `
                <div style="display:flex;align-items:center;gap:0.65rem;padding:0.65rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                  <span class="badge badge-green">${r.days}d</span>
                  <input
                    type="text"
                    class="form-control"
                    style="min-height:34px;font-size:0.83rem;"
                    data-rule-idx="${idx}"
                    value="${Utils.escapeHTML(r.label)}"
                    aria-label="Follow-up guidance for day ${r.days}"
                  />
                </div>
              `
              )
              .join('')}
          </div>
          <div class="mt-2" style="text-align:right;">
            <button type="button" id="btnSaveCadenceRules" class="btn btn-primary btn-sm">Save Guidance Rules</button>
          </div>
        </div>
      </section>
    `;

    renderCalendar(openQuotes);
    bindEvents(container, rules);
  }

  function renderQueueColumn(title, badgeClass, list, rules, emptyMsg) {
    const today = Utils.todayISO();
    return `
      <div class="followup-column">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <h3 class="card-title">${title}</h3>
          <span class="badge ${badgeClass}">${list.length}</span>
        </div>

        ${
          list.length === 0
            ? `<div class="empty-state" style="padding:1.75rem 0.75rem;"><p class="text-muted text-xs">${emptyMsg}</p></div>`
            : list
                .map((q) => {
                  const cust = Storage.getCustomerById(q.customerId);
                  const lastContact = q.lastContactDate || q.createdDate || today;
                  const daysNoReply = Math.max(0, Utils.daysBetween(lastContact, today));
                  const tip = getCadenceSuggestion(daysNoReply, rules);

                  return `
                    <article class="followup-task-card">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                        <span class="font-bold text-sm">${Utils.escapeHTML(cust ? cust.name : 'Client')}</span>
                        <span class="badge ${Utils.getPriorityBadgeClass(q.priority)}">${q.priority}</span>
                      </div>

                      <div class="text-xs font-semibold">${Utils.escapeHTML(q.title)} • <span class="text-success">${Utils.formatCurrency(q.totalAmount, q.currency)}</span></div>

                      <div class="text-xs text-muted">
                        Last contact: ${Utils.formatDate(lastContact)} (${daysNoReply}d ago)<br/>
                        Scheduled: <strong>${Utils.formatDate(q.followUpDate)}</strong>
                      </div>

                      <div style="background:var(--brand-green-light);color:var(--brand-green);padding:0.45rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:500;">
                        💡 ${Utils.escapeHTML(tip)}
                      </div>

                      <div class="followup-actions-grid">
                        <button type="button" class="btn btn-primary btn-sm" data-fu-action="contacted" data-id="${q.id}">Mark as Contacted</button>
                        <button type="button" class="btn btn-whatsapp btn-sm" data-fu-action="message" data-id="${q.id}">Send Message</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-fu-action="snooze" data-id="${q.id}" title="Snooze +2 days">Snooze +2d</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-fu-action="date" data-id="${q.id}">Change Date</button>
                        <button type="button" class="btn btn-ghost btn-sm" data-fu-action="open" data-id="${q.id}">Open Quote</button>
                      </div>
                    </article>
                  `;
                })
                .join('')
        }
      </div>
    `;
  }

  function renderCalendar(openQuotes) {
    const gridEl = document.getElementById('calendarGridContainer');
    const labelEl = document.getElementById('calMonthLabel');
    if (!gridEl || !labelEl) return;

    const baseDate = new Date();
    baseDate.setDate(1);
    baseDate.setMonth(baseDate.getMonth() + calendarMonthOffset);

    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const monthName = baseDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    labelEl.textContent = monthName;

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = Utils.todayISO();

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let cells = weekdays.map((d) => `<div class="calendar-day-header">${d}</div>`).join('');

    for (let i = 0; i < firstWeekday; i++) {
      cells += `<div class="calendar-cell is-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const count = openQuotes.filter((q) => q.followUpDate === iso).length;
      const isToday = iso === today;
      const isSelected = iso === selectedCalendarDate;

      cells += `
        <div class="calendar-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-cal-date="${iso}">
          <span class="text-xs font-bold">${day}</span>
          ${count > 0 ? `<span class="badge badge-green" style="font-size:0.68rem;padding:0.1rem 0.4rem;">${count} due</span>` : ''}
        </div>
      `;
    }

    gridEl.innerHTML = `<div class="calendar-grid">${cells}</div>`;

    gridEl.querySelectorAll('[data-cal-date]').forEach((cell) => {
      cell.addEventListener('click', () => {
        selectedCalendarDate = cell.dataset.calDate;
        renderCalendar(openQuotes);
      });
    });

    renderCalendarDayAgenda(openQuotes);
  }

  function renderCalendarDayAgenda(openQuotes) {
    const agendaEl = document.getElementById('calendarDayAgenda');
    if (!agendaEl) return;

    const matches = openQuotes.filter((q) => q.followUpDate === selectedCalendarDate);
    agendaEl.innerHTML = `
      <div style="padding-top:0.75rem;border-top:1px solid var(--border-color);">
        <div class="font-semibold text-sm mb-2">Agenda for ${Utils.formatDate(selectedCalendarDate)} (${matches.length})</div>
        ${
          matches.length === 0
            ? `<p class="text-xs text-muted">No follow-ups scheduled on this date.</p>`
            : `<div class="action-list">
                ${matches
                  .map((q) => {
                    const c = Storage.getCustomerById(q.customerId);
                    return `
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.55rem 0.75rem;background:var(--bg-subtle);border-radius:var(--radius-sm);">
                        <div>
                          <strong class="text-sm">${Utils.escapeHTML(c ? c.name : 'Client')}</strong> — <span class="text-xs">${Utils.escapeHTML(q.title)}</span>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" data-open-quote-cal="${q.id}">Open</button>
                      </div>
                    `;
                  })
                  .join('')}
              </div>`
        }
      </div>
    `;

    agendaEl.querySelectorAll('[data-open-quote-cal]').forEach((btn) => {
      btn.addEventListener('click', () => window.QN.Quotes.openDetailModal(btn.dataset.openQuoteCal));
    });
  }

  function bindEvents(container, rules) {
    container.querySelectorAll('[data-fu-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.fuAction;
        if (action === 'contacted') openContactedModal(id);
        if (action === 'message') window.QN.Quotes.openDetailModal(id, true);
        if (action === 'open') window.QN.Quotes.openDetailModal(id);
        if (action === 'snooze') {
          const q = Storage.getQuoteById(id);
          if (!q) return;
          const base = q.followUpDate && q.followUpDate > Utils.todayISO() ? q.followUpDate : Utils.todayISO();
          const newDate = Utils.addDaysISO(base, 2);
          Storage.saveQuote({ ...q, followUpDate: newDate });
          Storage.addActivity({ quoteId: id, type: 'snooze', title: `Follow-up snoozed to ${Utils.formatDate(newDate)}` });
          Utils.toast(`Snoozed to ${Utils.formatDate(newDate)}.`);
          window.QN.App.refreshCurrentView();
        }
        if (action === 'date') {
          openContactedModal(id, true);
        }
      });
    });

    const prevBtn = container.querySelector('#btnCalPrev');
    const nextBtn = container.querySelector('#btnCalNext');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        calendarMonthOffset -= 1;
        render(container);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        calendarMonthOffset += 1;
        render(container);
      });
    }

    const saveRulesBtn = container.querySelector('#btnSaveCadenceRules');
    if (saveRulesBtn) {
      saveRulesBtn.addEventListener('click', () => {
        const updated = rules.map((r, idx) => {
          const input = container.querySelector(`[data-rule-idx="${idx}"]`);
          return { ...r, label: input ? input.value.trim() || r.label : r.label };
        });
        Storage.saveSettings({ cadenceRules: updated });
        Utils.toast('Follow-up guidance rules saved!');
      });
    }
  }

  // ==========================================================================
  // "Mark as Contacted" Modal
  // ==========================================================================
  function openContactedModal(quoteId, rescheduleOnly = false) {
    const q = Storage.getQuoteById(quoteId);
    if (!q) return;
    const cust = Storage.getCustomerById(q.customerId);

    document.getElementById('contactQuoteId').value = q.id;
    document.getElementById('contactedModalTitle').textContent = rescheduleOnly
      ? 'Reschedule Next Follow-up'
      : 'How did the customer respond?';
    document.getElementById('contactedSubtitle').textContent = `${q.quoteNumber} • ${q.title} (${cust ? cust.name : 'Client'})`;
    document.getElementById('contactOutcome').value = 'No response';
    document.getElementById('contactNextDate').value = Utils.addDaysISO(Utils.todayISO(), 3);
    document.getElementById('contactNote').value = '';
    document.getElementById('nextFollowupGroup').hidden = false;

    document.getElementById('contactedModal').hidden = false;
  }

  function handleContactedSubmit(e) {
    e.preventDefault();
    const quoteId = document.getElementById('contactQuoteId').value;
    const outcome = document.getElementById('contactOutcome').value;
    const nextDate = document.getElementById('contactNextDate').value;
    const note = document.getElementById('contactNote').value.trim();

    const q = Storage.getQuoteById(quoteId);
    if (!q) return;

    const today = Utils.todayISO();
    let newStatus = q.status;
    if (outcome === 'Approved') newStatus = 'Won';
    else if (outcome === 'Rejected') newStatus = 'Lost';
    else if (outcome === 'Negotiating' || outcome === 'Requested changes') newStatus = 'Negotiating';
    else if (outcome === 'Interested' || outcome === 'No response') newStatus = 'Awaiting Response';

    Storage.saveQuote({
      ...q,
      status: newStatus,
      lastContactDate: today,
      followUpDate: ['Won', 'Lost'].includes(newStatus) ? q.followUpDate : nextDate || Utils.addDaysISO(today, 3),
      wonDate: newStatus === 'Won' ? today : q.wonDate
    });

    Storage.addActivity({
      quoteId: q.id,
      type: 'followup',
      title: `Contact logged (${outcome})${note ? `: ${note}` : ''}`
    });

    document.getElementById('contactedModal').hidden = true;
    Utils.toast('Customer contact recorded!');

    if (newStatus === 'Lost') {
      window.QN.Quotes.openLostReasonModal(q.id);
    }

    window.QN.App.refreshCurrentView();
  }

  function initListeners() {
    const form = document.getElementById('contactedForm');
    if (form) form.addEventListener('submit', handleContactedSubmit);

    const outcomeSel = document.getElementById('contactOutcome');
    if (outcomeSel) {
      outcomeSel.addEventListener('change', () => {
        const hideDate = outcomeSel.value === 'Approved' || outcomeSel.value === 'Rejected';
        document.getElementById('nextFollowupGroup').hidden = hideDate;
      });
    }

    document.querySelectorAll('[data-days-offset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const offset = Number(btn.dataset.daysOffset);
        document.getElementById('contactNextDate').value = Utils.addDaysISO(Utils.todayISO(), offset);
      });
    });
  }

  return {
    render,
    openContactedModal,
    initListeners
  };
})();
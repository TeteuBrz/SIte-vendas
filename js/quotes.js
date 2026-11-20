/**
 * QuoteNudge Quotes Management (js/quotes.js)
 * Table & Kanban views, multi-section Quote Form, Quote Details with Activity Timeline,
 * Quick Message Generator (WhatsApp & Email), and Lost Sale Insights.
 */
window.QN = window.QN || {};

window.QN.Quotes = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  const STATUSES = ['Draft', 'Sent', 'Awaiting Response', 'Negotiating', 'Won', 'Lost'];

  let viewMode = 'table'; // 'table' | 'kanban'
  let filterState = {
    search: '',
    status: 'All',
    health: 'All',
    sortBy: 'followUpAsc'
  };

  function getFilteredQuotes() {
    const settings = Storage.getSettings();
    const qStr = filterState.search.trim().toLowerCase();

    let list = Storage.getQuotes().filter((q) => {
      const customer = Storage.getCustomerById(q.customerId);
      const custName = customer ? customer.name.toLowerCase() : '';
      const custCompany = customer && customer.company ? customer.company.toLowerCase() : '';

      if (qStr) {
        const match =
          q.title.toLowerCase().includes(qStr) ||
          (q.quoteNumber || '').toLowerCase().includes(qStr) ||
          custName.includes(qStr) ||
          custCompany.includes(qStr) ||
          String(q.totalAmount).includes(qStr);
        if (!match) return false;
      }

      if (filterState.status !== 'All' && q.status !== filterState.status) {
        return false;
      }

      if (filterState.health !== 'All') {
        const h = Utils.computeQuoteHealth(q, settings);
        if (h.code !== filterState.health) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (filterState.sortBy === 'followUpAsc') {
        return (a.followUpDate || '9999-99-99').localeCompare(b.followUpDate || '9999-99-99');
      }
      if (filterState.sortBy === 'newest') {
        return (b.createdDate || '').localeCompare(a.createdDate || '');
      }
      if (filterState.sortBy === 'amountDesc') {
        return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
      }
      return 0;
    });

    return list;
  }

  function render(container) {
    const quotes = getFilteredQuotes();
    const settings = Storage.getSettings();

    container.innerHTML = `
      <div class="toolbar-bar">
        <div class="toolbar-group" style="flex:1;">
          <input
            type="search"
            id="quotesSearchInput"
            class="form-control"
            style="max-width:270px;"
            placeholder="Search quote, #number, client..."
            value="${Utils.escapeHTML(filterState.search)}"
          />

          <select id="quotesStatusFilter" class="form-control" style="width:auto;">
            <option value="All">All Statuses</option>
            ${STATUSES.map((s) => `<option value="${s}" ${filterState.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>

          <select id="quotesHealthFilter" class="form-control" style="width:auto;">
            <option value="All">All Quote Health</option>
            <option value="overdue" ${filterState.health === 'overdue' ? 'selected' : ''}>Overdue</option>
            <option value="at_risk" ${filterState.health === 'at_risk' ? 'selected' : ''}>At Risk</option>
            <option value="expiring" ${filterState.health === 'expiring' ? 'selected' : ''}>Expiring</option>
            <option value="healthy" ${filterState.health === 'healthy' ? 'selected' : ''}>Healthy</option>
          </select>

          <select id="quotesSortSelect" class="form-control" style="width:auto;">
            <option value="followUpAsc" ${filterState.sortBy === 'followUpAsc' ? 'selected' : ''}>Next Follow-up</option>
            <option value="newest" ${filterState.sortBy === 'newest' ? 'selected' : ''}>Newest Created</option>
            <option value="amountDesc" ${filterState.sortBy === 'amountDesc' ? 'selected' : ''}>Highest Value</option>
          </select>
        </div>

        <div class="toolbar-group">
          <div class="btn-group" style="display:inline-flex;border:1px solid var(--border-color);border-radius:var(--radius-sm);overflow:hidden;">
            <button type="button" class="btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}" style="border-radius:0;" data-view-mode="table">Table View</button>
            <button type="button" class="btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}" style="border-radius:0;" data-view-mode="kanban">Kanban View</button>
          </div>
          <button type="button" id="btnQuotesNew" class="btn btn-primary">+ New Quote</button>
        </div>
      </div>

      ${
        quotes.length === 0
          ? `<div class="empty-state">
              <h3>No quotes found</h3>
              <p class="text-muted text-sm mb-2">Create a commercial quote or adjust your active filters.</p>
              <button type="button" id="btnEmptyCreateQuote" class="btn btn-primary">+ Create Quote</button>
            </div>`
          : viewMode === 'table'
          ? renderTableView(quotes, settings)
          : renderKanbanView(quotes, settings)
      }
    `;

    bindViewEvents(container);
  }

  function renderTableView(quotes, settings) {
    return `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Quote Title</th>
                <th>Amount</th>
                <th>Created</th>
                <th>Last Contact</th>
                <th>Next Follow-up</th>
                <th>Status &amp; Health</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${quotes
                .map((q) => {
                  const cust = Storage.getCustomerById(q.customerId);
                  const health = Utils.computeQuoteHealth(q, settings);
                  return `
                    <tr>
                      <td>
                        <div class="font-semibold">${Utils.escapeHTML(cust ? cust.name : 'Unknown')}</div>
                        <div class="text-xs text-muted">${Utils.escapeHTML(cust && cust.company ? cust.company : q.quoteNumber)}</div>
                      </td>
                      <td>
                        <button type="button" class="link-btn" style="text-align:left;" data-action="detail" data-id="${q.id}">
                          ${Utils.escapeHTML(q.title)}
                        </button>
                        <div class="text-xs text-muted">${Utils.escapeHTML(q.quoteNumber)} • ${Utils.escapeHTML(q.priority)} priority</div>
                      </td>
                      <td class="font-bold">${Utils.formatCurrency(q.totalAmount, q.currency)}</td>
                      <td class="text-xs text-muted">${Utils.formatDate(q.createdDate)}</td>
                      <td class="text-xs text-muted">${Utils.formatDate(q.lastContactDate || q.createdDate)}</td>
                      <td>
                        <span class="font-semibold text-xs ${health.code === 'overdue' ? 'text-danger' : ''}">
                          ${Utils.formatDate(q.followUpDate)}
                        </span>
                      </td>
                      <td>
                        <div style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                          <span class="badge ${Utils.getStatusBadgeClass(q.status)}">${Utils.escapeHTML(q.status)}</span>
                          ${
                            !['closed_won', 'closed_lost', 'draft'].includes(health.code)
                              ? `<span class="badge ${health.badgeClass}" title="${Utils.escapeHTML(health.reason)}">${Utils.escapeHTML(health.label)}</span>`
                              : ''
                          }
                        </div>
                      </td>
                      <td>
                        <div class="table-actions">
                          <button type="button" class="btn btn-whatsapp btn-sm" data-action="whatsapp" data-id="${q.id}" title="Send WhatsApp Message">WhatsApp</button>
                          <button type="button" class="btn btn-secondary btn-sm" data-action="detail" data-id="${q.id}" title="Open Details">Details</button>
                          <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${q.id}" title="Edit Quote">Edit</button>
                          <button type="button" class="btn btn-ghost btn-sm" data-action="duplicate" data-id="${q.id}" title="Duplicate Quote">Copy</button>
                          <button type="button" class="btn btn-ghost btn-sm text-danger" data-action="delete" data-id="${q.id}" title="Delete Quote">&times;</button>
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderKanbanView(quotes, settings) {
    return `
      <div class="kanban-board">
        ${STATUSES.map((status) => {
          const colQuotes = quotes.filter((q) => q.status === status);
          const colTotal = colQuotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
          return `
            <div class="kanban-col">
              <div class="kanban-col-header">
                <div>
                  <span class="badge ${Utils.getStatusBadgeClass(status)}">${status}</span>
                  <div class="text-xs text-muted mt-1">${Utils.formatCurrency(colTotal)}</div>
                </div>
                <strong>${colQuotes.length}</strong>
              </div>

              ${
                colQuotes.length === 0
                  ? `<p class="text-xs text-muted" style="text-align:center;padding:1.5rem 0;">No quotes</p>`
                  : colQuotes
                      .map((q) => {
                        const cust = Storage.getCustomerById(q.customerId);
                        const health = Utils.computeQuoteHealth(q, settings);
                        return `
                          <div class="kanban-card">
                            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.35rem;">
                              <span class="text-xs text-muted">${Utils.escapeHTML(q.quoteNumber)}</span>
                              <span class="badge ${health.badgeClass}">${Utils.escapeHTML(health.label)}</span>
                            </div>
                            <button type="button" class="link-btn text-sm" style="text-align:left;" data-action="detail" data-id="${q.id}">
                              ${Utils.escapeHTML(q.title)}
                            </button>
                            <div class="text-xs text-muted">${Utils.escapeHTML(cust ? cust.name : 'Client')}</div>
                            <div class="font-bold text-sm">${Utils.formatCurrency(q.totalAmount, q.currency)}</div>
                            <div class="text-xs text-muted">Follow-up: ${Utils.formatDate(q.followUpDate)}</div>
                            <div style="display:flex;gap:0.35rem;margin-top:0.35rem;">
                              <select class="form-control" style="min-height:30px;padding:0.15rem 0.4rem;font-size:0.76rem;" data-kanban-status="${q.id}" aria-label="Change status">
                                ${STATUSES.map((st) => `<option value="${st}" ${st === q.status ? 'selected' : ''}>${st}</option>`).join('')}
                              </select>
                              <button type="button" class="btn btn-whatsapp btn-sm" data-action="whatsapp" data-id="${q.id}">WA</button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
              }
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function bindViewEvents(container) {
    const searchEl = container.querySelector('#quotesSearchInput');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        filterState.search = e.target.value;
        render(container);
      });
    }

    const statusEl = container.querySelector('#quotesStatusFilter');
    if (statusEl) {
      statusEl.addEventListener('change', (e) => {
        filterState.status = e.target.value;
        render(container);
      });
    }

    const healthEl = container.querySelector('#quotesHealthFilter');
    if (healthEl) {
      healthEl.addEventListener('change', (e) => {
        filterState.health = e.target.value;
        render(container);
      });
    }

    const sortEl = container.querySelector('#quotesSortSelect');
    if (sortEl) {
      sortEl.addEventListener('change', (e) => {
        filterState.sortBy = e.target.value;
        render(container);
      });
    }

    container.querySelectorAll('[data-view-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        viewMode = btn.dataset.viewMode;
        render(container);
      });
    });

    const newBtn = container.querySelector('#btnQuotesNew');
    if (newBtn) newBtn.addEventListener('click', () => openFormModal());

    const emptyNewBtn = container.querySelector('#btnEmptyCreateQuote');
    if (emptyNewBtn) emptyNewBtn.addEventListener('click', () => openFormModal());

    container.querySelectorAll('[data-kanban-status]').forEach((sel) => {
      sel.addEventListener('change', () => {
        changeQuoteStatus(sel.dataset.kanbanStatus, sel.value);
      });
    });

    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'detail') openDetailModal(id);
        if (action === 'edit') openFormModal(id);
        if (action === 'duplicate') duplicateQuote(id);
        if (action === 'whatsapp') quickWhatsAppShare(id);
        if (action === 'delete') confirmDeleteQuote(id);
      });
    });
  }

  // ==========================================================================
  // Quote Create / Edit Modal
  // ==========================================================================
  function populateCustomerDropdown(selectedId = '') {
    const select = document.getElementById('qCustomerId');
    const customers = Storage.getCustomers();
    if (!select) return;

    if (customers.length === 0) {
      select.innerHTML = `<option value="">-- Add a customer first --</option>`;
      return;
    }

    select.innerHTML =
      `<option value="">Select a customer...</option>` +
      customers
        .map(
          (c) =>
            `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${Utils.escapeHTML(c.name)}${
              c.company ? ` (${Utils.escapeHTML(c.company)})` : ''
            }</option>`
        )
        .join('');
  }

  function updateLiveTotal() {
    const amount = parseFloat(document.getElementById('qAmount').value) || 0;
    const discount = parseFloat(document.getElementById('qDiscount').value) || 0;
    const currency = document.getElementById('qCurrency').value || 'USD';
    const total = Math.max(0, amount - discount);
    document.getElementById('qTotalDisplay').value = Utils.formatCurrency(total, currency);
  }

  function openFormModal(quoteId = null, preselectedCustomerId = '') {
    const modal = document.getElementById('quoteModal');
    const settings = Storage.getSettings();
    const today = Utils.todayISO();

    document.querySelectorAll('#quoteForm .field-error').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('#quoteForm .is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    if (quoteId) {
      const q = Storage.getQuoteById(quoteId);
      if (!q) return;
      document.getElementById('quoteModalTitle').textContent = `Edit Quote • ${q.quoteNumber}`;
      document.getElementById('qId').value = q.id;
      document.getElementById('qTitle').value = q.title;
      document.getElementById('qNumber').value = q.quoteNumber;
      populateCustomerDropdown(q.customerId);
      document.getElementById('qServiceCategory').value = q.serviceCategory || 'Consulting';
      document.getElementById('qDescription').value = q.description;
      document.getElementById('qCurrency').value = q.currency || settings.defaultCurrency;
      document.getElementById('qAmount').value = q.amount;
      document.getElementById('qDiscount').value = q.discount || 0;
      document.getElementById('qCreatedDate').value = q.createdDate || today;
      document.getElementById('qExpirationDate').value = q.expirationDate || '';
      document.getElementById('qFollowUpDate').value = q.followUpDate || Utils.addDaysISO(today, 3);
      document.getElementById('qStatus').value = q.status;
      document.getElementById('qPriority').value = q.priority || 'Medium';
      document.getElementById('qNotes').value = q.notes || '';
    } else {
      document.getElementById('quoteModalTitle').textContent = 'New Quote';
      document.getElementById('qId').value = '';
      document.getElementById('qTitle').value = '';
      document.getElementById('qNumber').value = Storage.getNextQuoteNumber();
      populateCustomerDropdown(preselectedCustomerId);
      document.getElementById('qServiceCategory').value = 'Consulting';
      document.getElementById('qDescription').value = '';
      document.getElementById('qCurrency').value = settings.defaultCurrency || 'USD';
      document.getElementById('qAmount').value = '';
      document.getElementById('qDiscount').value = '0';
      document.getElementById('qCreatedDate').value = today;
      document.getElementById('qExpirationDate').value = Utils.addDaysISO(today, 14);
      document.getElementById('qFollowUpDate').value = Utils.addDaysISO(today, settings.defaultFollowUpInterval || 3);
      document.getElementById('qStatus').value = 'Sent';
      document.getElementById('qPriority').value = 'Medium';
      document.getElementById('qNotes').value = '';
    }

    updateLiveTotal();
    modal.hidden = false;
    setTimeout(() => document.getElementById('qTitle').focus(), 40);
  }

  function handleQuoteFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('qId').value;
    const title = document.getElementById('qTitle').value.trim();
    const quoteNumber = document.getElementById('qNumber').value.trim();
    const customerId = document.getElementById('qCustomerId').value;
    const serviceCategory = document.getElementById('qServiceCategory').value;
    const description = document.getElementById('qDescription').value.trim();
    const currency = document.getElementById('qCurrency').value;
    const amount = parseFloat(document.getElementById('qAmount').value);
    const discount = Math.max(0, parseFloat(document.getElementById('qDiscount').value) || 0);
    const createdDate = document.getElementById('qCreatedDate').value;
    const expirationDate = document.getElementById('qExpirationDate').value;
    const followUpDate = document.getElementById('qFollowUpDate').value;
    const status = document.getElementById('qStatus').value;
    const priority = document.getElementById('qPriority').value;
    const notes = document.getElementById('qNotes').value.trim();

    let valid = true;
    const setErr = (fieldId, msg) => {
      document.getElementById(fieldId).classList.add('is-invalid');
      document.getElementById(`err_${fieldId}`).textContent = msg;
      valid = false;
    };

    document.querySelectorAll('#quoteForm .field-error').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('#quoteForm .is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    if (!title) setErr('qTitle', 'Please enter a quote title.');
    if (!customerId) setErr('qCustomerId', 'Please select or create a customer.');
    if (!description) setErr('qDescription', 'Please describe the proposal scope.');
    if (isNaN(amount) || amount <= 0) setErr('qAmount', 'Enter a valid positive amount.');
    if (!createdDate) setErr('qCreatedDate', 'Select creation date.');
    if (!followUpDate) setErr('qFollowUpDate', 'Select next follow-up date.');

    if (!valid) return;

    const totalAmount = Math.max(0, amount - discount);
    const existing = id ? Storage.getQuoteById(id) : null;

    const quoteObj = {
      id: id || Utils.uid('qt'),
      quoteNumber,
      title,
      customerId,
      serviceCategory,
      description,
      currency,
      amount,
      discount,
      totalAmount,
      createdDate,
      lastContactDate: existing ? existing.lastContactDate : createdDate,
      expirationDate,
      followUpDate,
      status,
      priority,
      notes,
      wonDate: status === 'Won' ? (existing && existing.wonDate ? existing.wonDate : Utils.todayISO()) : existing ? existing.wonDate : null
    };

    Storage.saveQuote(quoteObj);

    if (!existing) {
      Storage.addActivity({
        quoteId: quoteObj.id,
        type: 'created',
        title: `Quote ${quoteObj.quoteNumber} created (${Utils.formatCurrency(totalAmount, currency)})`
      });
      Utils.toast('Quote created and scheduled for follow-up!');
    } else {
      if (existing.status !== status) {
        Storage.addActivity({
          quoteId: quoteObj.id,
          type: 'status',
          title: `Status updated from ${existing.status} to ${status}`
        });
      } else {
        Storage.addActivity({
          quoteId: quoteObj.id,
          type: 'edited',
          title: 'Quote details updated'
        });
      }
      Utils.toast('Quote updated successfully.');
    }

    document.getElementById('quoteModal').hidden = true;

    if (status === 'Lost' && (!existing || existing.status !== 'Lost')) {
      openLostReasonModal(quoteObj.id);
    }

    window.QN.App.refreshCurrentView();
  }

  // ==========================================================================
  // Quote Details Modal + Quick Message Generator + Activity Timeline
  // ==========================================================================
  function openDetailModal(quoteId, focusMessage = false) {
    const q = Storage.getQuoteById(quoteId);
    if (!q) return;

    const customer = Storage.getCustomerById(q.customerId);
    const settings = Storage.getSettings();
    const health = Utils.computeQuoteHealth(q, settings);
    const activities = Storage.getActivities(q.id);
    const templates = Storage.getTemplates();

    document.getElementById('detailQuoteTitle').textContent = `${q.quoteNumber} — ${q.title}`;
    document.getElementById('detailHeaderBadges').innerHTML = `
      <span class="badge ${Utils.getStatusBadgeClass(q.status)}">${q.status}</span>
      <span class="badge ${health.badgeClass}">${health.label}: ${Utils.escapeHTML(health.reason)}</span>
      <span class="badge ${Utils.getPriorityBadgeClass(q.priority)}">${q.priority} Priority</span>
    `;

    const defaultTpl = templates[0] || {
      subject: `Follow-up: ${q.title}`,
      body: `Hi {{customer_name}}, checking in on our quote for {{quote_title}} ({{quote_amount}}).`
    };
    const initialMsg = Utils.interpolateTemplate(defaultTpl.body, q, customer);

    const bodyEl = document.getElementById('quoteDetailBody');
    bodyEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.1rem;padding-bottom:0.9rem;border-bottom:1px solid var(--border-color);">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary btn-sm" id="dtlLogContact">Mark as Contacted</button>
          <button type="button" class="btn btn-secondary btn-sm" id="dtlEditQuote">Edit Quote</button>
          <button type="button" class="btn btn-secondary btn-sm" id="dtlDuplicateQuote">Duplicate</button>
          <select id="dtlQuickStatus" class="form-control" style="width:auto;min-height:32px;padding:0.15rem 0.5rem;font-size:0.8rem;">
            ${STATUSES.map((st) => `<option value="${st}" ${st === q.status ? 'selected' : ''}>Status: ${st}</option>`).join('')}
          </select>
        </div>
        <button type="button" class="btn btn-danger btn-sm" id="dtlDeleteQuote">Delete</button>
      </div>

      <div class="form-grid-2">
        <!-- Left Column: Proposal Info + Timeline -->
        <div>
          <div class="card mb-3" style="box-shadow:none;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;">
              <div>
                <div class="text-xs text-muted">Customer</div>
                <div class="font-bold">${Utils.escapeHTML(customer ? customer.name : 'Unknown')}</div>
                <div class="text-xs text-muted">${Utils.escapeHTML(customer && customer.company ? customer.company : '')} ${customer && customer.phone ? `• ${Utils.escapeHTML(customer.phone)}` : ''}</div>
              </div>
              <div style="text-align:right;">
                <div class="text-xs text-muted">Total Amount</div>
                <div class="font-bold text-success" style="font-size:1.25rem;">${Utils.formatCurrency(q.totalAmount, q.currency)}</div>
                ${q.discount > 0 ? `<div class="text-xs text-muted">Discount: -${Utils.formatCurrency(q.discount, q.currency)}</div>` : ''}
              </div>
            </div>

            <div class="form-grid-3" style="background:var(--bg-subtle);padding:0.65rem;border-radius:var(--radius-sm);margin-bottom:0.75rem;">
              <div>
                <div class="text-xs text-muted">Created</div>
                <div class="font-semibold text-xs">${Utils.formatDate(q.createdDate)}</div>
              </div>
              <div>
                <div class="text-xs text-muted">Next Follow-up</div>
                <div class="font-semibold text-xs">${Utils.formatDate(q.followUpDate)}</div>
              </div>
              <div>
                <div class="text-xs text-muted">Expires</div>
                <div class="font-semibold text-xs">${Utils.formatDate(q.expirationDate)}</div>
              </div>
            </div>

            <div class="text-xs font-semibold text-muted">Scope &amp; Description</div>
            <p class="text-sm mt-1" style="white-space:pre-wrap;">${Utils.escapeHTML(q.description)}</p>
            ${
              q.notes
                ? `<div class="mt-2" style="padding:0.6rem;background:var(--color-warning-bg);border-radius:var(--radius-sm);font-size:0.82rem;">
                    <strong>Strategy Note:</strong> ${Utils.escapeHTML(q.notes)}
                  </div>`
                : ''
            }
          </div>

          <!-- Activity Timeline -->
          <div class="card" style="box-shadow:none;">
            <h4 class="card-title mb-2">Activity Timeline</h4>
            ${
              activities.length === 0
                ? `<p class="text-xs text-muted">No activities logged yet.</p>`
                : `<div class="timeline">
                    ${activities
                      .map(
                        (act) => `
                        <div class="timeline-item">
                          <span class="timeline-dot"></span>
                          <div class="text-sm font-semibold">${Utils.escapeHTML(act.title)}</div>
                          <div class="text-xs text-muted">${new Date(act.timestamp).toLocaleString()}</div>
                        </div>
                      `
                      )
                      .join('')}
                  </div>`
            }
          </div>
        </div>

        <!-- Right Column: Quick Message Generator & Sharing -->
        <div class="card" style="box-shadow:none;">
          <h4 class="card-title">Quick Message Generator</h4>
          <p class="text-xs text-muted mb-2">Personalize a follow-up message and send via WhatsApp or Email.</p>

          <div class="form-group">
            <label for="dtlTemplateSelect">Choose Message Template</label>
            <select id="dtlTemplateSelect" class="form-control">
              ${templates
                .map(
                  (t) =>
                    `<option value="${t.id}">[${t.language}] ${Utils.escapeHTML(t.category)} — ${Utils.escapeHTML(t.name)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="dtlMessageText">Generated Message (Editable)</label>
            <textarea id="dtlMessageText" class="form-control" rows="6">${Utils.escapeHTML(initialMsg)}</textarea>
          </div>

          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" id="dtlSendWhatsApp" class="btn btn-whatsapp" style="flex:1;">Send WhatsApp Message</button>
            <button type="button" id="dtlSendEmail" class="btn btn-secondary">Send Email</button>
            <button type="button" id="dtlCopyMsg" class="btn btn-secondary">Copy</button>
          </div>

          <p class="help-text mt-2">
            WhatsApp Web/App or your default email client will open with the message pre-filled so you can review and confirm sending manually.
          </p>
        </div>
      </div>
    `;

    document.getElementById('quoteDetailModal').hidden = false;

    // Bind detail actions
    const tplSelect = document.getElementById('dtlTemplateSelect');
    const msgArea = document.getElementById('dtlMessageText');

    tplSelect.addEventListener('change', () => {
      const chosen = templates.find((t) => t.id === tplSelect.value);
      if (chosen) {
        msgArea.value = Utils.interpolateTemplate(chosen.body, q, customer);
      }
    });

    document.getElementById('dtlSendWhatsApp').addEventListener('click', () => {
      const text = msgArea.value.trim();
      if (!text) return;
      const wa = Utils.buildWhatsAppURL(customer ? customer.phone : '', text);
      if (!wa.hasPhone) {
        Utils.toast('Customer has no phone saved — opening WhatsApp contact picker.', 'warning');
      } else if (!wa.hasCountryCode) {
        Utils.toast('Tip: Add international country code (e.g., +1, +55) if WhatsApp asks.', 'warning');
      }
      Storage.addActivity({
        quoteId: q.id,
        type: 'whatsapp',
        title: `Opened WhatsApp follow-up for ${customer ? customer.name : 'client'}`
      });
      window.open(wa.url, '_blank', 'noopener,noreferrer');
      openDetailModal(q.id);
    });

    document.getElementById('dtlSendEmail').addEventListener('click', () => {
      const text = msgArea.value.trim();
      const chosen = templates.find((t) => t.id === tplSelect.value);
      const subject = Utils.interpolateTemplate(chosen ? chosen.subject : `Proposal ${q.quoteNumber}: ${q.title}`, q, customer);
      const mailUrl = Utils.buildMailtoURL(customer ? customer.email : '', subject, text);
      Storage.addActivity({
        quoteId: q.id,
        type: 'email',
        title: `Opened Email draft for ${customer ? customer.email || customer.name : 'client'}`
      });
      window.location.href = mailUrl;
      openDetailModal(q.id);
    });

    document.getElementById('dtlCopyMsg').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(msgArea.value);
        Utils.toast('Message copied to clipboard!');
      } catch (_) {
        msgArea.select();
        document.execCommand('copy');
        Utils.toast('Message copied!');
      }
    });

    document.getElementById('dtlLogContact').addEventListener('click', () => {
      document.getElementById('quoteDetailModal').hidden = true;
      window.QN.FollowUps.openContactedModal(q.id);
    });

    document.getElementById('dtlEditQuote').addEventListener('click', () => {
      document.getElementById('quoteDetailModal').hidden = true;
      openFormModal(q.id);
    });

    document.getElementById('dtlDuplicateQuote').addEventListener('click', () => {
      document.getElementById('quoteDetailModal').hidden = true;
      duplicateQuote(q.id);
    });

    document.getElementById('dtlQuickStatus').addEventListener('change', (e) => {
      document.getElementById('quoteDetailModal').hidden = true;
      changeQuoteStatus(q.id, e.target.value);
    });

    document.getElementById('dtlDeleteQuote').addEventListener('click', () => {
      document.getElementById('quoteDetailModal').hidden = true;
      confirmDeleteQuote(q.id);
    });

    if (focusMessage) {
      setTimeout(() => msgArea.focus(), 50);
    }
  }

  function quickWhatsAppShare(quoteId) {
    const q = Storage.getQuoteById(quoteId);
    if (!q) return;
    const customer = Storage.getCustomerById(q.customerId);
    const templates = Storage.getTemplates();
    const msg = Utils.interpolateTemplate(
      templates[0]
        ? templates[0].body
        : `Hi {{customer_name}}, following up on {{quote_title}} ({{quote_amount}}).`,
      q,
      customer
    );
    const wa = Utils.buildWhatsAppURL(customer ? customer.phone : '', msg);
    Storage.addActivity({
      quoteId: q.id,
      type: 'whatsapp',
      title: `Shared quote via WhatsApp to ${customer ? customer.name : 'client'}`
    });
    window.open(wa.url, '_blank', 'noopener,noreferrer');
    window.QN.App.refreshCurrentView();
  }

  function duplicateQuote(quoteId) {
    const orig = Storage.getQuoteById(quoteId);
    if (!orig) return;
    const today = Utils.todayISO();
    const copy = {
      ...orig,
      id: Utils.uid('qt'),
      quoteNumber: Storage.getNextQuoteNumber(),
      title: `${orig.title} (Copy)`,
      status: 'Draft',
      createdDate: today,
      lastContactDate: today,
      followUpDate: Utils.addDaysISO(today, 3),
      wonDate: null,
      lostReason: null,
      lostNote: null
    };
    Storage.saveQuote(copy);
    Storage.addActivity({
      quoteId: copy.id,
      type: 'created',
      title: `Duplicated from ${orig.quoteNumber}`
    });
    Utils.toast(`Quote duplicated as ${copy.quoteNumber}.`);
    window.QN.App.refreshCurrentView();
  }

  function changeQuoteStatus(quoteId, newStatus) {
    const q = Storage.getQuoteById(quoteId);
    if (!q || q.status === newStatus) return;

    const updated = {
      ...q,
      status: newStatus,
      wonDate: newStatus === 'Won' ? Utils.todayISO() : q.wonDate
    };
    Storage.saveQuote(updated);
    Storage.addActivity({
      quoteId: q.id,
      type: 'status',
      title: `Status changed from ${q.status} to ${newStatus}`
    });
    Utils.toast(`Quote marked as ${newStatus}.`);

    if (newStatus === 'Lost') {
      openLostReasonModal(q.id);
    }

    window.QN.App.refreshCurrentView();
  }

  function openLostReasonModal(quoteId) {
    document.getElementById('lostQuoteId').value = quoteId;
    document.getElementById('lostReasonSelect').value = 'Too Expensive';
    document.getElementById('lostReasonNote').value = '';
    document.getElementById('lostReasonModal').hidden = false;
  }

  function handleLostReasonSubmit(e) {
    e.preventDefault();
    const quoteId = document.getElementById('lostQuoteId').value;
    const reason = document.getElementById('lostReasonSelect').value;
    const note = document.getElementById('lostReasonNote').value.trim();

    const q = Storage.getQuoteById(quoteId);
    if (q) {
      Storage.saveQuote({
        ...q,
        status: 'Lost',
        lostReason: reason,
        lostNote: note
      });
      Storage.addActivity({
        quoteId: q.id,
        type: 'lost',
        title: `Lost reason recorded: ${reason}${note ? ` — ${note}` : ''}`
      });
      Utils.toast('Lost sale insight recorded.');
    }
    document.getElementById('lostReasonModal').hidden = true;
    window.QN.App.refreshCurrentView();
  }

  function confirmDeleteQuote(quoteId) {
    const q = Storage.getQuoteById(quoteId);
    if (!q) return;
    window.QN.App.openConfirmDialog(
      `Are you sure you want to delete quote "${q.quoteNumber} — ${q.title}"? This will also remove its activity timeline.`,
      () => {
        Storage.deleteQuote(quoteId);
        Utils.toast('Quote deleted.');
        window.QN.App.refreshCurrentView();
      }
    );
  }

  // Bind global form listeners once
  function initListeners() {
    const form = document.getElementById('quoteForm');
    if (form) form.addEventListener('submit', handleQuoteFormSubmit);

    ['qAmount', 'qDiscount', 'qCurrency'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateLiveTotal);
    });

    const inlineCustBtn = document.getElementById('btnInlineNewCustomer');
    if (inlineCustBtn) {
      inlineCustBtn.addEventListener('click', () => {
        window.QN.Customers.openFormModal(null, (newCustId) => {
          populateCustomerDropdown(newCustId);
        });
      });
    }

    const lostForm = document.getElementById('lostReasonForm');
    if (lostForm) lostForm.addEventListener('submit', handleLostReasonSubmit);
  }

  return {
    render,
    openFormModal,
    openDetailModal,
    openLostReasonModal,
    initListeners
  };
})();
/**
 * QuoteNudge Customers Management (js/customers.js)
 * Client directory, duplicate email prevention, and full customer commercial profile.
 */
window.QN = window.QN || {};

window.QN.Customers = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  let searchQuery = '';
  let onCreatedCallback = null;

  function render(container) {
    const allCustomers = Storage.getCustomers();
    const quotes = Storage.getQuotes();
    const qStr = searchQuery.trim().toLowerCase();

    const filtered = allCustomers.filter((c) => {
      if (!qStr) return true;
      return (
        c.name.toLowerCase().includes(qStr) ||
        (c.company || '').toLowerCase().includes(qStr) ||
        (c.email || '').toLowerCase().includes(qStr) ||
        (c.phone || '').toLowerCase().includes(qStr) ||
        (c.country || '').toLowerCase().includes(qStr)
      );
    });

    container.innerHTML = `
      <div class="toolbar-bar">
        <div class="toolbar-group" style="flex:1;">
          <input
            type="search"
            id="customersSearchInput"
            class="form-control"
            style="max-width:320px;"
            placeholder="Search customer, company, email, phone..."
            value="${Utils.escapeHTML(searchQuery)}"
          />
          <span class="text-xs text-muted">${filtered.length} customer${filtered.length === 1 ? '' : 's'}</span>
        </div>

        <button type="button" id="btnNewCustomer" class="btn btn-primary">+ New Customer</button>
      </div>

      ${
        filtered.length === 0
          ? `<div class="empty-state">
              <h3>No customers found</h3>
              <p class="text-muted text-sm mb-2">Add your clients to link quotes and send 1-click WhatsApp follow-ups.</p>
              <button type="button" id="btnEmptyAddCustomer" class="btn btn-primary">+ Add First Customer</button>
            </div>`
          : `<div class="card" style="padding:0;overflow:hidden;">
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Country</th>
                      <th>Quotes</th>
                      <th>Won Revenue</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map((c) => {
                        const custQuotes = quotes.filter((q) => q.customerId === c.id);
                        const wonTotal = custQuotes
                          .filter((q) => q.status === 'Won')
                          .reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);

                        return `
                          <tr>
                            <td>
                              <button type="button" class="link-btn" data-cust-action="detail" data-id="${c.id}">
                                ${Utils.escapeHTML(c.name)}
                              </button>
                              <div class="text-xs text-muted">${Utils.escapeHTML(c.company || 'Individual')}</div>
                            </td>
                            <td>
                              <div class="text-xs">${Utils.escapeHTML(c.email || '—')}</div>
                              <div class="text-xs text-muted">${Utils.escapeHTML(c.phone || 'No phone')}</div>
                            </td>
                            <td class="text-xs text-muted">${Utils.escapeHTML(c.country || '—')}</td>
                            <td><span class="badge badge-neutral">${custQuotes.length}</span></td>
                            <td class="font-bold text-success">${Utils.formatCurrency(wonTotal)}</td>
                            <td>
                              <div class="table-actions">
                                <button type="button" class="btn btn-secondary btn-sm" data-cust-action="detail" data-id="${c.id}">Profile</button>
                                <button type="button" class="btn btn-primary btn-sm" data-cust-action="quote" data-id="${c.id}">+ Quote</button>
                                <button type="button" class="btn btn-secondary btn-sm" data-cust-action="edit" data-id="${c.id}">Edit</button>
                                <button type="button" class="btn btn-ghost btn-sm text-danger" data-cust-action="delete" data-id="${c.id}">&times;</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>`
      }
    `;

    const searchInput = container.querySelector('#customersSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        render(container);
      });
    }

    const newBtn = container.querySelector('#btnNewCustomer');
    if (newBtn) newBtn.addEventListener('click', () => openFormModal());

    const emptyBtn = container.querySelector('#btnEmptyAddCustomer');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openFormModal());

    container.querySelectorAll('[data-cust-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.custAction;
        if (action === 'detail') openDetailModal(id);
        if (action === 'quote') window.QN.Quotes.openFormModal(null, id);
        if (action === 'edit') openFormModal(id);
        if (action === 'delete') confirmDeleteCustomer(id);
      });
    });
  }

  function openFormModal(customerId = null, callback = null) {
    onCreatedCallback = callback;
    document.querySelectorAll('#customerForm .field-error').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('#customerForm .is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    if (customerId) {
      const c = Storage.getCustomerById(customerId);
      if (!c) return;
      document.getElementById('customerModalTitle').textContent = 'Edit Customer';
      document.getElementById('cId').value = c.id;
      document.getElementById('cName').value = c.name;
      document.getElementById('cCompany').value = c.company || '';
      document.getElementById('cEmail').value = c.email || '';
      document.getElementById('cPhone').value = c.phone || '';
      document.getElementById('cCountry').value = c.country || '';
      document.getElementById('cNotes').value = c.notes || '';
    } else {
      document.getElementById('customerModalTitle').textContent = 'New Customer';
      document.getElementById('cId').value = '';
      document.getElementById('customerForm').reset();
    }

    document.getElementById('customerModal').hidden = false;
    setTimeout(() => document.getElementById('cName').focus(), 40);
  }

  function handleCustomerSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cId').value;
    const name = document.getElementById('cName').value.trim();
    const company = document.getElementById('cCompany').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const country = document.getElementById('cCountry').value.trim();
    const notes = document.getElementById('cNotes').value.trim();

    document.querySelectorAll('#customerForm .field-error').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('#customerForm .is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    let valid = true;
    if (!name) {
      document.getElementById('cName').classList.add('is-invalid');
      document.getElementById('err_cName').textContent = 'Customer name is required.';
      valid = false;
    }

    // Prevent duplicate customers by email when provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        document.getElementById('cEmail').classList.add('is-invalid');
        document.getElementById('err_cEmail').textContent = 'Enter a valid email address.';
        valid = false;
      } else {
        const duplicate = Storage.getCustomers().find(
          (c) => c.email && c.email.toLowerCase() === email.toLowerCase() && c.id !== id
        );
        if (duplicate) {
          document.getElementById('cEmail').classList.add('is-invalid');
          document.getElementById('err_cEmail').textContent = `A customer (${duplicate.name}) already uses this email.`;
          valid = false;
        }
      }
    }

    if (!valid) return;

    const newId = id || Utils.uid('cust');
    Storage.saveCustomer({
      id: newId,
      name,
      company,
      email,
      phone,
      country,
      notes
    });

    document.getElementById('customerModal').hidden = true;
    Utils.toast(id ? 'Customer updated!' : 'Customer added!');

    if (typeof onCreatedCallback === 'function') {
      const cb = onCreatedCallback;
      onCreatedCallback = null;
      cb(newId);
    }

    window.QN.App.refreshCurrentView();
  }

  function openDetailModal(customerId) {
    const c = Storage.getCustomerById(customerId);
    if (!c) return;

    const quotes = Storage.getQuotes().filter((q) => q.customerId === c.id);
    const totalNegotiated = quotes.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
    const totalWon = quotes.filter((q) => q.status === 'Won').reduce((s, q) => s + (Number(q.totalAmount) || 0), 0);
    const lostCount = quotes.filter((q) => q.status === 'Lost').length;
    const upcomingFollowUps = quotes.filter((q) => !['Won', 'Lost', 'Draft'].includes(q.status) && q.followUpDate);

    const quoteIds = new Set(quotes.map((q) => q.id));
    const history = Storage.getActivities().filter((a) => quoteIds.has(a.quoteId));

    document.getElementById('customerDetailTitle').textContent = `${c.name}${c.company ? ` • ${c.company}` : ''}`;

    document.getElementById('customerDetailBody').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem;">
        <div class="text-xs text-muted">
          Email: <strong>${Utils.escapeHTML(c.email || '—')}</strong> •
          Phone: <strong>${Utils.escapeHTML(c.phone || '—')}</strong> •
          Country: <strong>${Utils.escapeHTML(c.country || '—')}</strong>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnCustDetailNewQuote">+ New Quote for ${Utils.escapeHTML(c.name)}</button>
      </div>

      <div class="kpi-grid kpi-grid-4 mb-3">
        <div class="kpi-card">
          <span class="kpi-label">Total Quoted</span>
          <span class="kpi-value" style="font-size:1.2rem;">${Utils.formatCurrency(totalNegotiated)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Total Won</span>
          <span class="kpi-value text-success" style="font-size:1.2rem;">${Utils.formatCurrency(totalWon)}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Quotes Count</span>
          <span class="kpi-value" style="font-size:1.2rem;">${quotes.length}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Lost Quotes</span>
          <span class="kpi-value text-danger" style="font-size:1.2rem;">${lostCount}</span>
        </div>
      </div>

      ${c.notes ? `<div class="card mb-3" style="box-shadow:none;background:var(--bg-subtle);"><strong>Notes:</strong> <span class="text-sm">${Utils.escapeHTML(c.notes)}</span></div>` : ''}

      <h4 class="card-title mb-2">Customer Quotes (${quotes.length})</h4>
      ${
        quotes.length === 0
          ? `<p class="text-xs text-muted mb-3">No quotes registered for this customer yet.</p>`
          : `<div class="action-list mb-3">
              ${quotes
                .map(
                  (q) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.85rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);">
                    <div>
                      <div class="font-semibold text-sm">${Utils.escapeHTML(q.quoteNumber)} — ${Utils.escapeHTML(q.title)}</div>
                      <div class="text-xs text-muted">Follow-up: ${Utils.formatDate(q.followUpDate)}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                      <strong>${Utils.formatCurrency(q.totalAmount, q.currency)}</strong>
                      <span class="badge ${Utils.getStatusBadgeClass(q.status)}">${q.status}</span>
                      <button type="button" class="btn btn-secondary btn-sm" data-open-cust-quote="${q.id}">Open</button>
                    </div>
                  </div>
                `
                )
                .join('')}
            </div>`
      }

      <div class="form-grid-2">
        <div>
          <h4 class="card-title mb-2">Upcoming Follow-ups (${upcomingFollowUps.length})</h4>
          ${
            upcomingFollowUps.length === 0
              ? `<p class="text-xs text-muted">No pending follow-ups.</p>`
              : upcomingFollowUps
                  .map(
                    (q) =>
                      `<div class="text-xs" style="padding:0.4rem 0;border-bottom:1px solid var(--border-color);">
                        <strong>${Utils.formatDate(q.followUpDate)}</strong> — ${Utils.escapeHTML(q.title)}
                      </div>`
                  )
                  .join('')
          }
        </div>
        <div>
          <h4 class="card-title mb-2">Contact &amp; Quote History</h4>
          ${
            history.length === 0
              ? `<p class="text-xs text-muted">No recorded history yet.</p>`
              : history
                  .slice(0, 6)
                  .map(
                    (h) =>
                      `<div class="text-xs" style="padding:0.4rem 0;border-bottom:1px solid var(--border-color);">
                        <div>${Utils.escapeHTML(h.title)}</div>
                        <span class="text-muted">${new Date(h.timestamp).toLocaleDateString()}</span>
                      </div>`
                  )
                  .join('')
          }
        </div>
      </div>
    `;

    document.getElementById('customerDetailModal').hidden = false;

    document.getElementById('btnCustDetailNewQuote').addEventListener('click', () => {
      document.getElementById('customerDetailModal').hidden = true;
      window.QN.Quotes.openFormModal(null, c.id);
    });

    document.querySelectorAll('[data-open-cust-quote]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('customerDetailModal').hidden = true;
        window.QN.Quotes.openDetailModal(btn.dataset.openCustQuote);
      });
    });
  }

  function confirmDeleteCustomer(customerId) {
    const c = Storage.getCustomerById(customerId);
    if (!c) return;
    const relatedCount = Storage.getQuotes().filter((q) => q.customerId === customerId).length;
    const msg =
      relatedCount > 0
        ? `Delete customer "${c.name}"? Note: ${relatedCount} existing quote(s) linked to this customer will remain in your records.`
        : `Are you sure you want to delete customer "${c.name}"?`;

    window.QN.App.openConfirmDialog(msg, () => {
      Storage.deleteCustomer(customerId);
      Utils.toast('Customer removed.');
      window.QN.App.refreshCurrentView();
    });
  }

  function initListeners() {
    const form = document.getElementById('customerForm');
    if (form) form.addEventListener('submit', handleCustomerSubmit);
  }

  return {
    render,
    openFormModal,
    openDetailModal,
    initListeners
  };
})();
/**
 * QuoteNudge Message Templates Library (js/templates.js)
 * Categorized EN/PT templates with dynamic variable interpolation and live quote preview.
 */
window.QN = window.QN || {};

window.QN.Templates = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  const CATEGORIES = [
    'All',
    'First Follow-up',
    'Friendly Reminder',
    'Checking the Proposal',
    'Price Negotiation',
    'Last Follow-up',
    'Thank You',
    'Quote Approved'
  ];

  let selectedCategory = 'All';
  let selectedLang = 'All';
  let previewQuoteId = '';
  let previewTemplateId = '';

  function render(container) {
    const allTemplates = Storage.getTemplates();
    const quotes = Storage.getQuotes();

    if (!previewQuoteId && quotes.length > 0) {
      previewQuoteId = quotes[0].id;
    }

    const filtered = allTemplates.filter((t) => {
      if (selectedCategory !== 'All' && t.category !== selectedCategory) return false;
      if (selectedLang !== 'All' && t.language !== selectedLang) return false;
      return true;
    });

    if ((!previewTemplateId || !filtered.some((t) => t.id === previewTemplateId)) && filtered.length > 0) {
      previewTemplateId = filtered[0].id;
    }

    const activeQuote = quotes.find((q) => q.id === previewQuoteId) || null;
    const activeCustomer = activeQuote ? Storage.getCustomerById(activeQuote.customerId) : null;
    const activeTemplate = allTemplates.find((t) => t.id === previewTemplateId) || filtered[0] || null;
    const resolvedMessage = activeTemplate
      ? Utils.interpolateTemplate(activeTemplate.body, activeQuote, activeCustomer)
      : '';

    container.innerHTML = `
      <div class="toolbar-bar">
        <div class="toolbar-group">
          <select id="tplCategoryFilter" class="form-control" style="width:auto;">
            ${CATEGORIES.map((c) => `<option value="${c}" ${selectedCategory === c ? 'selected' : ''}>Category: ${c}</option>`).join('')}
          </select>

          <select id="tplLangFilter" class="form-control" style="width:auto;">
            <option value="All" ${selectedLang === 'All' ? 'selected' : ''}>All Languages</option>
            <option value="EN" ${selectedLang === 'EN' ? 'selected' : ''}>English (EN)</option>
            <option value="PT" ${selectedLang === 'PT' ? 'selected' : ''}>Português (PT)</option>
          </select>
        </div>

        <button type="button" id="btnNewTemplate" class="btn btn-primary">+ New Template</button>
      </div>

      <div class="templates-layout">
        <!-- Template Cards -->
        <div class="template-cards-grid">
          ${
            filtered.length === 0
              ? `<div class="empty-state" style="grid-column:1/-1;">
                  <h3>No templates match this filter</h3>
                  <p class="text-muted text-sm">Create a custom script or reset your category filter.</p>
                </div>`
              : filtered
                  .map(
                    (t) => `
                    <article class="template-card" style="${t.id === previewTemplateId ? 'border-color:var(--brand-green);' : ''}">
                      <div>
                        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;margin-bottom:0.4rem;">
                          <span class="badge badge-green">${Utils.escapeHTML(t.category)}</span>
                          <span class="badge badge-neutral">${Utils.escapeHTML(t.language)}</span>
                        </div>
                        <h3 class="font-bold text-sm">${Utils.escapeHTML(t.name)}</h3>
                        <p class="text-xs text-muted mt-1" style="white-space:pre-wrap;">${Utils.escapeHTML(t.body)}</p>
                      </div>

                      <div style="display:flex;gap:0.35rem;flex-wrap:wrap;padding-top:0.6rem;border-top:1px solid var(--border-color);">
                        <button type="button" class="btn btn-primary btn-sm" data-tpl-action="preview" data-id="${t.id}">Use &amp; Preview</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-tpl-action="edit" data-id="${t.id}">Edit</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-tpl-action="duplicate" data-id="${t.id}">Duplicate</button>
                        <button type="button" class="btn btn-ghost btn-sm text-danger" data-tpl-action="delete" data-id="${t.id}">&times;</button>
                      </div>
                    </article>
                  `
                  )
                  .join('')
          }
        </div>

        <!-- Live Dynamic Preview & Sharing Panel -->
        <aside class="card">
          <h3 class="card-title">Live Message Personalizer</h3>
          <p class="text-xs text-muted mb-3">Select a quote to automatically replace variables like <code>{{customer_name}}</code> and <code>{{quote_amount}}</code>.</p>

          <div class="form-group">
            <label for="tplPreviewQuoteSelect">Target Quote</label>
            <select id="tplPreviewQuoteSelect" class="form-control">
              ${
                quotes.length === 0
                  ? `<option value="">No quotes available (using sample placeholders)</option>`
                  : quotes
                      .map((q) => {
                        const c = Storage.getCustomerById(q.customerId);
                        return `<option value="${q.id}" ${q.id === previewQuoteId ? 'selected' : ''}>${Utils.escapeHTML(q.quoteNumber)} — ${Utils.escapeHTML(c ? c.name : 'Client')} (${Utils.formatCurrency(q.totalAmount, q.currency)})</option>`;
                      })
                      .join('')
              }
            </select>
          </div>

          <div class="form-group">
            <label for="tplPreviewTextarea">Personalized Output</label>
            <textarea id="tplPreviewTextarea" class="form-control" rows="6">${Utils.escapeHTML(resolvedMessage)}</textarea>
          </div>

          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button type="button" id="btnTplSendWhatsApp" class="btn btn-whatsapp" style="flex:1;">Send via WhatsApp</button>
            <button type="button" id="btnTplSendEmail" class="btn btn-secondary">Send Email</button>
            <button type="button" id="btnTplCopy" class="btn btn-secondary">Copy</button>
          </div>
          <p class="help-text mt-2">Opens WhatsApp or Email with your message pre-filled so you can review and send manually.</p>
        </aside>
      </div>
    `;

    bindEvents(container, activeQuote, activeCustomer, activeTemplate);
  }

  function bindEvents(container, activeQuote, activeCustomer, activeTemplate) {
    container.querySelector('#tplCategoryFilter').addEventListener('change', (e) => {
      selectedCategory = e.target.value;
      render(container);
    });

    container.querySelector('#tplLangFilter').addEventListener('change', (e) => {
      selectedLang = e.target.value;
      render(container);
    });

    container.querySelector('#btnNewTemplate').addEventListener('click', () => openFormModal());

    container.querySelectorAll('[data-tpl-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.tplAction;
        if (action === 'preview') {
          previewTemplateId = id;
          render(container);
        }
        if (action === 'edit') openFormModal(id);
        if (action === 'duplicate') {
          const orig = Storage.getTemplates().find((t) => t.id === id);
          if (!orig) return;
          Storage.saveTemplate({
            ...orig,
            id: Utils.uid('tpl'),
            name: `${orig.name} (Copy)`
          });
          Utils.toast('Template duplicated.');
          render(container);
        }
        if (action === 'delete') {
          window.QN.App.openConfirmDialog('Delete this message template?', () => {
            Storage.deleteTemplate(id);
            Utils.toast('Template deleted.');
            render(container);
          });
        }
      });
    });

    const quoteSel = container.querySelector('#tplPreviewQuoteSelect');
    if (quoteSel) {
      quoteSel.addEventListener('change', (e) => {
        previewQuoteId = e.target.value;
        render(container);
      });
    }

    const outArea = container.querySelector('#tplPreviewTextarea');

    container.querySelector('#btnTplCopy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(outArea.value);
        Utils.toast('Message copied to clipboard!');
      } catch (_) {
        outArea.select();
        document.execCommand('copy');
        Utils.toast('Message copied!');
      }
    });

    container.querySelector('#btnTplSendWhatsApp').addEventListener('click', () => {
      const wa = Utils.buildWhatsAppURL(activeCustomer ? activeCustomer.phone : '', outArea.value);
      if (activeQuote) {
        Storage.addActivity({
          quoteId: activeQuote.id,
          type: 'whatsapp',
          title: `Opened WhatsApp with template "${activeTemplate ? activeTemplate.name : 'Custom'}"`
        });
      }
      window.open(wa.url, '_blank', 'noopener,noreferrer');
    });

    container.querySelector('#btnTplSendEmail').addEventListener('click', () => {
      const subject = activeTemplate
        ? Utils.interpolateTemplate(activeTemplate.subject, activeQuote, activeCustomer)
        : 'Follow-up on our proposal';
      const mailUrl = Utils.buildMailtoURL(activeCustomer ? activeCustomer.email : '', subject, outArea.value);
      if (activeQuote) {
        Storage.addActivity({
          quoteId: activeQuote.id,
          type: 'email',
          title: `Opened Email draft with template "${activeTemplate ? activeTemplate.name : 'Custom'}"`
        });
      }
      window.location.href = mailUrl;
    });
  }

  function openFormModal(templateId = null) {
    document.querySelectorAll('#templateForm .field-error').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('#templateForm .is-invalid').forEach((el) => el.classList.remove('is-invalid'));

    if (templateId) {
      const t = Storage.getTemplates().find((item) => item.id === templateId);
      if (!t) return;
      document.getElementById('templateModalTitle').textContent = 'Edit Template';
      document.getElementById('tId').value = t.id;
      document.getElementById('tName').value = t.name;
      document.getElementById('tCategory').value = t.category;
      document.getElementById('tLanguage').value = t.language;
      document.getElementById('tSubject').value = t.subject || '';
      document.getElementById('tBody').value = t.body;
    } else {
      document.getElementById('templateModalTitle').textContent = 'New Message Template';
      document.getElementById('tId').value = '';
      document.getElementById('templateForm').reset();
    }

    document.getElementById('templateModal').hidden = false;
  }

  function handleTemplateSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('tId').value;
    const name = document.getElementById('tName').value.trim();
    const category = document.getElementById('tCategory').value;
    const language = document.getElementById('tLanguage').value;
    const subject = document.getElementById('tSubject').value.trim();
    const body = document.getElementById('tBody').value.trim();

    let valid = true;
    if (!name) {
      document.getElementById('tName').classList.add('is-invalid');
      document.getElementById('err_tName').textContent = 'Template name is required.';
      valid = false;
    }
    if (!body) {
      document.getElementById('tBody').classList.add('is-invalid');
      document.getElementById('err_tBody').textContent = 'Message body cannot be empty.';
      valid = false;
    }
    if (!valid) return;

    Storage.saveTemplate({
      id: id || Utils.uid('tpl'),
      name,
      category,
      language,
      subject,
      body
    });

    document.getElementById('templateModal').hidden = true;
    Utils.toast(id ? 'Template updated!' : 'Template created!');
    window.QN.App.refreshCurrentView();
  }

  function initListeners() {
    const form = document.getElementById('templateForm');
    if (form) form.addEventListener('submit', handleTemplateSubmit);

    document.querySelectorAll('#templateVariableChips [data-var]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const textarea = document.getElementById('tBody');
        const token = chip.dataset.var;
        const start = textarea.selectionStart || textarea.value.length;
        const end = textarea.selectionEnd || textarea.value.length;
        textarea.value = textarea.value.slice(0, start) + token + textarea.value.slice(end);
        textarea.focus();
      });
    });
  }

  return {
    render,
    initListeners
  };
})();
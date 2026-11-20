/**
 * QuoteNudge Main Application Controller (js/app.js)
 * Coordinates SPA routing, Settings view, Smart Global Search, Notification Center,
 * Theme switching, Onboarding wizard, and global modals.
 */
window.QN = window.QN || {};

window.QN.App = (() => {
  'use strict';

  const { Storage, Utils } = window.QN;

  const ROUTES = {
    overview: {
      title: 'Overview',
      subtitle: 'Your commercial command center',
      render: (el) => window.QN.Dashboard.render(el)
    },
    followups: {
      title: 'Follow-ups',
      subtitle: 'Never lose a sale because you forgot to follow up',
      render: (el) => window.QN.FollowUps.render(el)
    },
    quotes: {
      title: 'Quotes',
      subtitle: 'Track proposals, negotiations, and closing status',
      render: (el) => window.QN.Quotes.render(el)
    },
    customers: {
      title: 'Customers',
      subtitle: 'Client directory and commercial deal history',
      render: (el) => window.QN.Customers.render(el)
    },
    templates: {
      title: 'Templates',
      subtitle: 'High-converting follow-up scripts with dynamic variables',
      render: (el) => window.QN.Templates.render(el)
    },
    reports: {
      title: 'Reports',
      subtitle: 'Conversion analytics, cycle times, and lost sale insights',
      render: (el) => window.QN.Reports.render(el)
    },
    settings: {
      title: 'Settings',
      subtitle: 'Workspace profile, preferences, reminders, and data backup',
      render: (el) => renderSettingsView(el)
    }
  };

  let currentRoute = 'overview';
  let confirmCallback = null;

  function applyTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    const moon = document.getElementById('iconMoon');
    const sun = document.getElementById('iconSun');
    if (moon && sun) {
      moon.hidden = t === 'dark';
      sun.hidden = t === 'light';
    }
  }

  function updateHeaderIdentity() {
    const profile = Storage.getProfile();
    const initials = (profile.userName || 'QN')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    document.getElementById('headerAvatar').textContent = initials || 'QN';
    document.getElementById('headerUserName').textContent = profile.userName;
    document.getElementById('headerCompanyName').textContent = profile.companyName;
    document.getElementById('menuUserName').textContent = profile.userName;
    document.getElementById('menuUserEmail').textContent = profile.email;
  }

  function updateAlertsAndBadges() {
    const quotes = Storage.getQuotes();
    const settings = Storage.getSettings();
    const today = Utils.todayISO();

    const alerts = [];
    quotes.forEach((q) => {
      if (['Won', 'Lost', 'Draft'].includes(q.status)) return;
      const health = Utils.computeQuoteHealth(q, settings);
      const cust = Storage.getCustomerById(q.customerId);
      if (health.code === 'overdue' || q.followUpDate === today || health.code === 'at_risk' || health.code === 'expiring') {
        alerts.push({
          quote: q,
          customerName: cust ? cust.name : 'Client',
          label: q.followUpDate === today && health.code === 'healthy' ? 'Due Today' : health.label,
          badgeClass: q.followUpDate === today && health.code === 'healthy' ? 'badge-green' : health.badgeClass,
          reason: q.followUpDate === today && health.code === 'healthy' ? 'Scheduled follow-up today' : health.reason
        });
      }
    });

    // Sidebar Follow-up count badge
    const dueCount = quotes.filter(
      (q) => !['Won', 'Lost', 'Draft'].includes(q.status) && q.followUpDate && q.followUpDate <= today
    ).length;
    const navBadge = document.getElementById('navFollowupBadge');
    if (navBadge) {
      navBadge.hidden = dueCount === 0;
      navBadge.textContent = String(dueCount);
    }

    // Header Notification Bell
    const notifDot = document.getElementById('notifDot');
    const notifSummary = document.getElementById('notifSummaryText');
    const notifList = document.getElementById('notifList');

    if (notifDot) {
      notifDot.hidden = alerts.length === 0;
      notifDot.textContent = String(alerts.length);
    }
    if (notifSummary) {
      notifSummary.textContent = `${alerts.length} alert${alerts.length === 1 ? '' : 's'}`;
    }
    if (notifList) {
      if (alerts.length === 0) {
        notifList.innerHTML = `<p class="text-xs text-muted" style="padding:1.2rem;text-align:center;">No pending alerts. Great job!</p>`;
      } else {
        notifList.innerHTML = alerts
          .slice(0, 10)
          .map(
            (al) => `
            <div class="notif-item" data-notif-quote="${al.quote.id}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                <strong class="text-xs">${Utils.escapeHTML(al.customerName)}</strong>
                <span class="badge ${al.badgeClass}">${Utils.escapeHTML(al.label)}</span>
              </div>
              <div class="text-xs mt-1">${Utils.escapeHTML(al.quote.title)}</div>
              <div class="text-xs text-muted">${Utils.escapeHTML(al.reason)}</div>
            </div>
          `
          )
          .join('');

        notifList.querySelectorAll('[data-notif-quote]').forEach((item) => {
          item.addEventListener('click', () => {
            document.getElementById('notifDropdown').hidden = true;
            window.QN.Quotes.openDetailModal(item.dataset.notifQuote);
          });
        });
      }
    }
  }

  function navigate(route) {
    const target = ROUTES[route] ? route : 'overview';
    currentRoute = target;

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.route === target);
    });

    document.getElementById('currentPageTitle').textContent = ROUTES[target].title;
    document.getElementById('currentPageSubtitle').textContent = ROUTES[target].subtitle;

    // Close mobile drawer if open
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebarBackdrop').hidden = true;

    refreshCurrentView();
  }

  function refreshCurrentView() {
    updateHeaderIdentity();
    updateAlertsAndBadges();
    const container = document.getElementById('viewContainer');
    if (container && ROUTES[currentRoute]) {
      ROUTES[currentRoute].render(container);
    }
  }

  // ==========================================================================
  // Settings View (Profile, Preferences, Reminders, Data Management)
  // ==========================================================================
  function renderSettingsView(container) {
    const profile = Storage.getProfile();
    const settings = Storage.getSettings();

    container.innerHTML = `
      <div class="form-grid-2">
        <!-- Profile -->
        <form id="settingsProfileForm" class="card">
          <h3 class="card-title mb-2">Profile &amp; Workspace</h3>
          <div class="form-group">
            <label for="setUserName">Your Name</label>
            <input type="text" id="setUserName" class="form-control" value="${Utils.escapeHTML(profile.userName)}" required />
          </div>
          <div class="form-group">
            <label for="setCompanyName">Company / Brand Name</label>
            <input type="text" id="setCompanyName" class="form-control" value="${Utils.escapeHTML(profile.companyName)}" />
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label for="setEmail">Email</label>
              <input type="email" id="setEmail" class="form-control" value="${Utils.escapeHTML(profile.email)}" />
            </div>
            <div class="form-group">
              <label for="setPhone">Phone</label>
              <input type="tel" id="setPhone" class="form-control" value="${Utils.escapeHTML(profile.phone)}" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Save Profile</button>
        </form>

        <!-- Preferences & Quote Health Thresholds -->
        <form id="settingsPrefsForm" class="card">
          <h3 class="card-title mb-2">Preferences &amp; Quote Health Rules</h3>
          <div class="form-grid-2">
            <div class="form-group">
              <label for="setLanguage">Language</label>
              <select id="setLanguage" class="form-control">
                <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English (International)</option>
                <option value="pt" ${settings.language === 'pt' ? 'selected' : ''}>Português (Brasil)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="setCurrency">Default Currency</label>
              <select id="setCurrency" class="form-control">
                <option value="USD" ${settings.defaultCurrency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="BRL" ${settings.defaultCurrency === 'BRL' ? 'selected' : ''}>BRL (R$)</option>
                <option value="EUR" ${settings.defaultCurrency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="GBP" ${settings.defaultCurrency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label for="setDateFormat">Date Format</label>
              <select id="setDateFormat" class="form-control">
                <option value="YYYY-MM-DD" ${settings.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
                <option value="DD/MM/YYYY" ${settings.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
                <option value="MM/DD/YYYY" ${settings.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
              </select>
            </div>
            <div class="form-group">
              <label for="setTheme">Appearance Theme</label>
              <select id="setTheme" class="form-control">
                <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Mode</option>
                <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Mode</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label for="setAtRiskDays">At-Risk Threshold (days without reply)</label>
              <input type="number" id="setAtRiskDays" class="form-control" min="1" max="60" value="${settings.atRiskDays}" />
            </div>
            <div class="form-group">
              <label for="setExpiringDays">Expiring Warning (days before expiry)</label>
              <input type="number" id="setExpiringDays" class="form-control" min="1" max="30" value="${settings.expiringDays}" />
            </div>
          </div>

          <button type="submit" class="btn btn-primary">Save Preferences</button>
        </form>

        <!-- Reminders -->
        <form id="settingsRemindersForm" class="card">
          <h3 class="card-title mb-2">Reminders &amp; Notifications</h3>
          <div class="form-grid-2">
            <div class="form-group">
              <label for="setPreferredTime">Preferred Follow-up Time</label>
              <input type="time" id="setPreferredTime" class="form-control" value="${settings.preferredFollowUpTime || '09:30'}" />
            </div>
            <div class="form-group">
              <label for="setDefaultInterval">Default Follow-up Interval (days)</label>
              <input type="number" id="setDefaultInterval" class="form-control" min="1" max="30" value="${settings.defaultFollowUpInterval || 3}" />
            </div>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
              <input type="checkbox" id="setBrowserNotif" ${settings.browserNotifications ? 'checked' : ''} />
              <span>Enable in-session browser notifications when supported</span>
            </label>
            <small class="help-text">
              Note: Local prototype stores data in this browser. Browser notifications work while QuoteNudge is open and permitted.
            </small>
          </div>

          <button type="submit" class="btn btn-primary">Save Reminder Settings</button>
        </form>

        <!-- Data Management -->
        <div class="card">
          <h3 class="card-title mb-2">Data Management &amp; Backup</h3>
          <p class="text-xs text-muted mb-3">
            Your workspace is stored locally in your browser (localStorage). Export regular JSON backups or load sample SaaS data.
          </p>

          <div style="display:flex;flex-direction:column;gap:0.65rem;">
            <button type="button" id="btnSetExportJson" class="btn btn-secondary">Export All Data (JSON Backup)</button>
            <button type="button" id="btnSetImportJson" class="btn btn-secondary">Import Backup (JSON)</button>
            <input type="file" id="inputSetImportFile" accept=".json,application/json" hidden />
            <button type="button" id="btnSetLoadDemo" class="btn btn-primary">Load Realistic Demo Data</button>
            <button type="button" id="btnSetResetAll" class="btn btn-danger">Erase All Workspace Data</button>
          </div>
        </div>
      </div>
    `;

    // Bind Settings Forms
    container.querySelector('#settingsProfileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      Storage.saveProfile({
        userName: container.querySelector('#setUserName').value.trim() || 'Alex Morgan',
        companyName: container.querySelector('#setCompanyName').value.trim() || 'Studio Craft',
        email: container.querySelector('#setEmail').value.trim(),
        phone: container.querySelector('#setPhone').value.trim()
      });
      Utils.toast('Profile updated!');
      updateHeaderIdentity();
    });

    container.querySelector('#settingsPrefsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const newTheme = container.querySelector('#setTheme').value;
      Storage.saveSettings({
        language: container.querySelector('#setLanguage').value,
        defaultCurrency: container.querySelector('#setCurrency').value,
        dateFormat: container.querySelector('#setDateFormat').value,
        theme: newTheme,
        atRiskDays: Math.max(1, parseInt(container.querySelector('#setAtRiskDays').value, 10) || 3),
        expiringDays: Math.max(1, parseInt(container.querySelector('#setExpiringDays').value, 10) || 3)
      });
      applyTheme(newTheme);
      Utils.toast('Preferences saved!');
      refreshCurrentView();
    });

    container.querySelector('#settingsRemindersForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const wantsNotif = container.querySelector('#setBrowserNotif').checked;
      if (wantsNotif && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      Storage.saveSettings({
        preferredFollowUpTime: container.querySelector('#setPreferredTime').value,
        defaultFollowUpInterval: Math.max(1, parseInt(container.querySelector('#setDefaultInterval').value, 10) || 3),
        browserNotifications: wantsNotif
      });
      Utils.toast('Reminder preferences updated!');
    });

    container.querySelector('#btnSetExportJson').addEventListener('click', downloadJSONBackup);

    const fileInput = container.querySelector('#inputSetImportFile');
    container.querySelector('#btnSetImportJson').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          Storage.importAllJSON(ev.target.result);
          applyTheme(Storage.getSettings().theme);
          Utils.toast('Backup imported successfully!');
          refreshCurrentView();
        } catch (err) {
          Utils.toast(err.message || 'Invalid backup file.', 'error');
        }
      };
      reader.readAsText(file, 'UTF-8');
    });

    container.querySelector('#btnSetLoadDemo').addEventListener('click', () => {
      openConfirmDialog('Load sample customers, quotes, and follow-up tasks into your workspace?', () => {
        Storage.seedDemoData();
        Utils.toast('Demo data loaded!');
        navigate('overview');
      });
    });

    container.querySelector('#btnSetResetAll').addEventListener('click', () => {
      openConfirmDialog('Erase ALL quotes, customers, and settings permanently? This cannot be undone.', () => {
        Storage.clearAll();
        applyTheme('light');
        Utils.toast('Workspace reset to clean state.');
        navigate('overview');
      });
    });
  }

  function downloadJSONBackup() {
    const content = Storage.exportAllJSON();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quotenudge-backup-${Utils.todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Utils.toast('JSON backup downloaded!');
  }

  // ==========================================================================
  // Smart Global Search
  // ==========================================================================
  function setupSmartSearch() {
    const input = document.getElementById('globalSearchInput');
    const dropdown = document.getElementById('smartSearchResults');
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
      const term = input.value.trim().toLowerCase();
      if (!term) {
        dropdown.hidden = true;
        return;
      }

      const quotes = Storage.getQuotes().filter((q) => {
        const c = Storage.getCustomerById(q.customerId);
        return (
          q.title.toLowerCase().includes(term) ||
          (q.quoteNumber || '').toLowerCase().includes(term) ||
          q.status.toLowerCase().includes(term) ||
          String(q.totalAmount).includes(term) ||
          (c && c.name.toLowerCase().includes(term))
        );
      });

      const customers = Storage.getCustomers().filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.company || '').toLowerCase().includes(term) ||
          (c.email || '').toLowerCase().includes(term)
      );

      if (quotes.length === 0 && customers.length === 0) {
        dropdown.innerHTML = `<div style="padding:0.9rem;text-align:center;" class="text-xs text-muted">No matching quotes or customers.</div>`;
        dropdown.hidden = false;
        return;
      }

      dropdown.innerHTML = [
        ...quotes.slice(0, 5).map((q) => {
          const c = Storage.getCustomerById(q.customerId);
          return `
            <div class="search-result-item" data-search-quote="${q.id}">
              <div>
                <div class="font-semibold text-xs">${Utils.escapeHTML(q.quoteNumber)} • ${Utils.escapeHTML(q.title)}</div>
                <div class="text-xs text-muted">${Utils.escapeHTML(c ? c.name : 'Client')} • ${Utils.formatCurrency(q.totalAmount, q.currency)}</div>
              </div>
              <span class="badge ${Utils.getStatusBadgeClass(q.status)}">${q.status}</span>
            </div>
          `;
        }),
        ...customers.slice(0, 4).map(
          (c) => `
          <div class="search-result-item" data-search-cust="${c.id}">
            <div>
              <div class="font-semibold text-xs">${Utils.escapeHTML(c.name)}</div>
              <div class="text-xs text-muted">${Utils.escapeHTML(c.company || c.email || 'Customer')}</div>
            </div>
            <span class="badge badge-neutral">Customer</span>
          </div>
        `
        )
      ].join('');

      dropdown.hidden = false;

      dropdown.querySelectorAll('[data-search-quote]').forEach((el) => {
        el.addEventListener('click', () => {
          dropdown.hidden = true;
          input.value = '';
          window.QN.Quotes.openDetailModal(el.dataset.searchQuote);
        });
      });

      dropdown.querySelectorAll('[data-search-cust]').forEach((el) => {
        el.addEventListener('click', () => {
          dropdown.hidden = true;
          input.value = '';
          window.QN.Customers.openDetailModal(el.dataset.searchCust);
        });
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // ==========================================================================
  // Confirmation Dialog & First-Time Onboarding
  // ==========================================================================
  function openConfirmDialog(message, onConfirm) {
    confirmCallback = onConfirm;
    document.getElementById('confirmDialogMessage').textContent = message;
    document.getElementById('confirmDialogModal').hidden = false;
  }

  function setupOnboarding() {
    const quotes = Storage.getQuotes();
    const customers = Storage.getCustomers();
    if (!Storage.isOnboardingDone() && quotes.length === 0 && customers.length === 0) {
      document.getElementById('onboardingModal').hidden = false;
    }

    document.getElementById('btnObSaveCompany').addEventListener('click', () => {
      const val = document.getElementById('obCompanyInput').value.trim();
      if (!val) {
        Utils.toast('Enter your company name first.', 'warning');
        return;
      }
      Storage.saveProfile({ companyName: val });
      updateHeaderIdentity();
      Utils.toast('Company name saved!');
    });

    document.getElementById('btnObAddCustomer').addEventListener('click', () => {
      Storage.setOnboardingDone(true);
      document.getElementById('onboardingModal').hidden = true;
      window.QN.Customers.openFormModal();
    });

    document.getElementById('btnObAddQuote').addEventListener('click', () => {
      Storage.setOnboardingDone(true);
      document.getElementById('onboardingModal').hidden = true;
      window.QN.Quotes.openFormModal();
    });

    document.getElementById('btnObLoadDemo').addEventListener('click', () => {
      Storage.seedDemoData();
      document.getElementById('onboardingModal').hidden = true;
      Utils.toast('Demo workspace loaded!');
      navigate('overview');
    });
  }

  function bindGlobalUI() {
    // Sidebar route navigation
    document.querySelectorAll('[data-route]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(btn.dataset.route);
      });
    });

    // Desktop collapse sidebar
    document.getElementById('btnCollapseSidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Mobile drawer
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    document.getElementById('btnMobileMenu').addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      backdrop.hidden = false;
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.hidden = true;
    });

    // Header & Floating Quick Add Quote buttons
    document.getElementById('btnHeaderNewQuote').addEventListener('click', () => window.QN.Quotes.openFormModal());
    document.getElementById('btnFloatingQuickAdd').addEventListener('click', () => window.QN.Quotes.openFormModal());

    // Theme toggle
    document.getElementById('btnThemeToggle').addEventListener('click', () => {
      const current = Storage.getSettings().theme;
      const next = current === 'dark' ? 'light' : 'dark';
      Storage.saveSettings({ theme: next });
      applyTheme(next);
    });

    // Popovers (Notifications & Profile)
    const notifBtn = document.getElementById('btnNotifications');
    const notifDrop = document.getElementById('notifDropdown');
    const profBtn = document.getElementById('btnProfileMenu');
    const profDrop = document.getElementById('profileDropdown');

    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profDrop.hidden = true;
      notifDrop.hidden = !notifDrop.hidden;
    });

    profBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDrop.hidden = true;
      profDrop.hidden = !profDrop.hidden;
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        profDrop.hidden = true;
        navigate(btn.dataset.goto);
      });
    });

    document.getElementById('btnMenuLoadDemo').addEventListener('click', () => {
      profDrop.hidden = true;
      Storage.seedDemoData();
      Utils.toast('Demo data loaded!');
      refreshCurrentView();
    });

    document.getElementById('btnMenuExportJson').addEventListener('click', () => {
      profDrop.hidden = true;
      downloadJSONBackup();
    });

    // Close modals via data-close-modal
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        if (modalId === 'onboardingModal') Storage.setOnboardingDone(true);
        document.getElementById(modalId).hidden = true;
      });
    });

    // Confirm dialog button
    document.getElementById('btnConfirmDialogYes').addEventListener('click', () => {
      document.getElementById('confirmDialogModal').hidden = true;
      if (typeof confirmCallback === 'function') {
        const cb = confirmCallback;
        confirmCallback = null;
        cb();
      }
    });

    // Global click outside popovers & Escape key
    document.addEventListener('click', (e) => {
      if (!notifDrop.contains(e.target) && e.target !== notifBtn) notifDrop.hidden = true;
      if (!profDrop.contains(e.target) && e.target !== profBtn) profDrop.hidden = true;
      const searchWrap = document.querySelector('.smart-search-wrap');
      if (searchWrap && !searchWrap.contains(e.target)) {
        document.getElementById('smartSearchResults').hidden = true;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach((m) => {
          if (!m.hidden) {
            if (m.id === 'onboardingModal') Storage.setOnboardingDone(true);
            m.hidden = true;
          }
        });
        notifDrop.hidden = true;
        profDrop.hidden = true;
      }
    });
  }

  function bootstrap() {
    Storage.init();
    applyTheme(Storage.getSettings().theme);

    window.QN.Quotes.initListeners();
    window.QN.Customers.initListeners();
    window.QN.FollowUps.initListeners();
    window.QN.Templates.initListeners();

    bindGlobalUI();
    setupSmartSearch();
    setupOnboarding();
    navigate('overview');
  }

  document.addEventListener('DOMContentLoaded', bootstrap);

  return {
    navigate,
    refreshCurrentView,
    openConfirmDialog
  };
})();
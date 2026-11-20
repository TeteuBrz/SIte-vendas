/**
 * QuoteNudge Utilities & Rule Engines (js/utils.js)
 * Pure helper functions for formatting, Quote Health scoring, message interpolation,
 * WhatsApp/Email link builders, and responsive interactive SVG charts.
 */
window.QN = window.QN || {};

window.QN.Utils = (() => {
  'use strict';

  function uid(prefix = 'id') {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDaysISO(isoDate, days) {
    const base = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
    base.setDate(base.getDate() + Number(days || 0));
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const day = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Returns whole days difference (isoEnd - isoStart).
   */
  function daysBetween(isoStart, isoEnd) {
    if (!isoStart || !isoEnd) return 0;
    const a = new Date(`${isoStart}T00:00:00`);
    const b = new Date(`${isoEnd}T00:00:00`);
    return Math.round((b - a) / 86400000);
  }

  function formatDate(iso, formatPref = null) {
    if (!iso) return '—';
    const settings = formatPref || (window.QN.Storage ? window.QN.Storage.getSettings().dateFormat : 'YYYY-MM-DD');
    const parts = String(iso).slice(0, 10).split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    if (settings === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
    if (settings === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
    return `${y}-${m}-${d}`;
  }

  function formatCurrency(value, currency = null) {
    const cur = currency || (window.QN.Storage ? window.QN.Storage.getSettings().defaultCurrency : 'USD');
    const num = Number(value) || 0;
    const localeMap = { USD: 'en-US', BRL: 'pt-BR', EUR: 'de-DE', GBP: 'en-GB' };
    try {
      return new Intl.NumberFormat(localeMap[cur] || 'en-US', {
        style: 'currency',
        currency: cur,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num);
    } catch (_) {
      return `${cur} ${num.toFixed(2)}`;
    }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function getStatusBadgeClass(status) {
    const map = {
      Draft: 'badge-neutral',
      Sent: 'badge-blue',
      'Awaiting Response': 'badge-yellow',
      Negotiating: 'badge-purple',
      Won: 'badge-green',
      Lost: 'badge-red'
    };
    return map[status] || 'badge-neutral';
  }

  function getPriorityBadgeClass(priority) {
    const map = {
      High: 'badge-red',
      Medium: 'badge-yellow',
      Low: 'badge-neutral'
    };
    return map[priority] || 'badge-neutral';
  }

  /**
   * Transparent rule-based Quote Health evaluation (No black-box AI).
   */
  function computeQuoteHealth(quote, settingsObj = null) {
    const settings = settingsObj || window.QN.Storage.getSettings();
    const today = todayISO();
    const referenceContact = quote.lastContactDate || quote.createdDate || today;
    const daysSinceContact = Math.max(0, daysBetween(referenceContact, today));

    if (quote.status === 'Won') {
      return {
        code: 'closed_won',
        label: 'Won',
        badgeClass: 'badge-green',
        reason: 'Deal approved',
        daysSinceContact
      };
    }
    if (quote.status === 'Lost') {
      return {
        code: 'closed_lost',
        label: 'Lost',
        badgeClass: 'badge-neutral',
        reason: quote.lostReason || 'Deal closed as lost',
        daysSinceContact
      };
    }
    if (quote.status === 'Draft') {
      return {
        code: 'draft',
        label: 'Draft',
        badgeClass: 'badge-neutral',
        reason: 'Not sent to client yet',
        daysSinceContact
      };
    }

    const atRiskThreshold = Number(settings.atRiskDays) || 3;
    const expiringThreshold = Number(settings.expiringDays) || 3;

    // 1. Overdue follow-up date
    if (quote.followUpDate && quote.followUpDate < today) {
      const overdueDays = daysBetween(quote.followUpDate, today);
      return {
        code: 'overdue',
        label: 'Overdue',
        badgeClass: 'badge-red',
        reason: `Follow-up overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
        daysSinceContact
      };
    }

    // 2. Expiring soon
    if (quote.expirationDate) {
      const daysUntilExp = daysBetween(today, quote.expirationDate);
      if (daysUntilExp >= 0 && daysUntilExp <= expiringThreshold) {
        return {
          code: 'expiring',
          label: 'Expiring',
          badgeClass: 'badge-yellow',
          reason: daysUntilExp === 0 ? 'Expires today' : `Expires in ${daysUntilExp} day${daysUntilExp === 1 ? '' : 's'}`,
          daysSinceContact
        };
      }
    }

    // 3. At Risk (awaiting response beyond configured threshold)
    if ((quote.status === 'Awaiting Response' || quote.status === 'Sent') && daysSinceContact >= atRiskThreshold) {
      return {
        code: 'at_risk',
        label: 'At Risk',
        badgeClass: 'badge-yellow',
        reason: `No response for ${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'}`,
        daysSinceContact
      };
    }

    return {
      code: 'healthy',
      label: 'Healthy',
      badgeClass: 'badge-green',
      reason: 'Follow-up schedule on track',
      daysSinceContact
    };
  }

  /**
   * Resolves dynamic {{variables}} inside message templates.
   */
  function interpolateTemplate(text, quote, customer, profile = null) {
    const prof = profile || window.QN.Storage.getProfile();
    const cust = customer || (quote ? window.QN.Storage.getCustomerById(quote.customerId) : null);

    const vars = {
      '{{customer_name}}': cust ? cust.name : 'Client',
      '{{company}}': cust && cust.company ? cust.company : '',
      '{{quote_title}}': quote ? quote.title : 'Proposal',
      '{{quote_number}}': quote ? quote.quoteNumber : '',
      '{{quote_amount}}': quote ? formatCurrency(quote.totalAmount, quote.currency) : '',
      '{{expiration_date}}': quote && quote.expirationDate ? formatDate(quote.expirationDate) : 'soon',
      '{{sender_name}}': prof.userName || '',
      '{{sender_company}}': prof.companyName || ''
    };

    let output = String(text || '');
    Object.entries(vars).forEach(([token, val]) => {
      output = output.split(token).join(val);
    });
    return output;
  }

  /**
   * Normalizes phone number and constructs official https://wa.me/ URL.
   */
  function buildWhatsAppURL(rawPhone, message) {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    const encoded = encodeURIComponent(message || '');
    if (!digits) {
      return {
        url: `https://wa.me/?text=${encoded}`,
        hasPhone: false,
        hasCountryCode: false
      };
    }
    const hasCountryCode = digits.length >= 11;
    return {
      url: `https://wa.me/${digits}?text=${encoded}`,
      hasPhone: true,
      hasCountryCode
    };
  }

  function buildMailtoURL(email, subject, body) {
    const to = encodeURIComponent(String(email || '').trim());
    const sub = encodeURIComponent(subject || '');
    const msg = encodeURIComponent(body || '');
    return `mailto:${to}?subject=${sub}&body=${msg}`;
  }

  function toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type !== 'success' ? `toast-${type}` : ''}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s ease';
      setTimeout(() => el.remove(), 220);
    }, 3400);
  }

  // ==========================================================================
  // Interactive Pure SVG Charts (Responsive + Hover Tooltips)
  // ==========================================================================
  let sharedTooltip = null;

  function ensureTooltip() {
    if (!sharedTooltip) {
      sharedTooltip = document.createElement('div');
      sharedTooltip.className = 'chart-tooltip';
      sharedTooltip.hidden = true;
      document.body.appendChild(sharedTooltip);
    }
    return sharedTooltip;
  }

  function bindChartTooltips(svgEl) {
    const tip = ensureTooltip();
    svgEl.querySelectorAll('[data-tip]').forEach((node) => {
      node.addEventListener('mouseenter', (e) => {
        tip.textContent = node.getAttribute('data-tip');
        tip.hidden = false;
        tip.style.left = `${e.clientX + 12}px`;
        tip.style.top = `${e.clientY - 28}px`;
      });
      node.addEventListener('mousemove', (e) => {
        tip.style.left = `${e.clientX + 12}px`;
        tip.style.top = `${e.clientY - 28}px`;
      });
      node.addEventListener('mouseleave', () => {
        tip.hidden = true;
      });
    });
  }

  /**
   * Renders a grouped or single vertical bar chart in pure SVG.
   */
  function renderBarChart(container, { labels, seriesA, seriesB = null, labelA = 'Quoted', labelB = 'Won', formatVal = (v) => v }) {
    if (!container) return;
    if (!labels || labels.length === 0) {
      container.innerHTML = `<div class="empty-state"><p class="text-muted text-sm">No data for selected period.</p></div>`;
      return;
    }

    const width = 520;
    const height = 220;
    const padL = 44;
    const padR = 16;
    const padT = 20;
    const padB = 34;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const allVals = [...seriesA, ...(seriesB || [])];
    const maxVal = Math.max(10, ...allVals) * 1.12;
    const groupW = plotW / labels.length;

    let gridLines = '';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      const val = Math.round(maxVal * (1 - i / 4));
      gridLines += `
        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-secondary)">${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}</text>
      `;
    }

    let bars = '';
    labels.forEach((lbl, idx) => {
      const cx = padL + idx * groupW + groupW / 2;
      const valA = seriesA[idx] || 0;
      const hA = (valA / maxVal) * plotH;
      const yA = padT + plotH - hA;

      if (seriesB) {
        const bw = Math.min(20, groupW * 0.32);
        const valB = seriesB[idx] || 0;
        const hB = (valB / maxVal) * plotH;
        const yB = padT + plotH - hB;

        bars += `
          <rect x="${cx - bw - 2}" y="${yA}" width="${bw}" height="${Math.max(2, hA)}" rx="4" fill="#94A3B8" data-tip="${escapeHTML(lbl)} • ${escapeHTML(labelA)}: ${escapeHTML(String(formatVal(valA)))}"></rect>
          <rect x="${cx + 2}" y="${yB}" width="${bw}" height="${Math.max(2, hB)}" rx="4" fill="#16A36A" data-tip="${escapeHTML(lbl)} • ${escapeHTML(labelB)}: ${escapeHTML(String(formatVal(valB)))}"></rect>
        `;
      } else {
        const bw = Math.min(32, groupW * 0.5);
        bars += `
          <rect x="${cx - bw / 2}" y="${yA}" width="${bw}" height="${Math.max(2, hA)}" rx="5" fill="#16A36A" data-tip="${escapeHTML(lbl)} • ${escapeHTML(labelA)}: ${escapeHTML(String(formatVal(valA)))}"></rect>
        `;
      }

      bars += `<text x="${cx}" y="${height - 10}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">${escapeHTML(lbl)}</text>`;
    });

    container.innerHTML = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(labelA)} chart">
        ${gridLines}
        ${bars}
      </svg>
    `;
    bindChartTooltips(container.querySelector('svg'));
  }

  /**
   * Renders a responsive SVG Donut Chart with legend.
   */
  function renderDonutChart(container, items) {
    if (!container) return;
    const total = items.reduce((acc, it) => acc + (Number(it.value) || 0), 0);
    if (total === 0) {
      container.innerHTML = `<div class="empty-state"><p class="text-muted text-sm">No quotes recorded yet.</p></div>`;
      return;
    }

    const size = 180;
    const r = 62;
    const cx = 95;
    const cy = 95;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    const segments = items
      .filter((it) => it.value > 0)
      .map((it) => {
        const pct = it.value / total;
        const dash = pct * circumference;
        const seg = `
          <circle
            cx="${cx}" cy="${cy}" r="${r}"
            fill="transparent"
            stroke="${it.color}"
            stroke-width="24"
            stroke-dasharray="${dash} ${circumference - dash}"
            stroke-dashoffset="${-offset}"
            transform="rotate(-90 ${cx} ${cy})"
            data-tip="${escapeHTML(it.label)}: ${it.value} (${Math.round(pct * 100)}%)"
          ></circle>
        `;
        offset += dash;
        return seg;
      })
      .join('');

    const legend = items
      .map(
        (it) => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;font-size:0.8rem;padding:0.2rem 0;">
          <span style="display:flex;align-items:center;gap:0.45rem;">
            <span style="width:10px;height:10px;border-radius:50%;background:${it.color};display:inline-block;"></span>
            <span>${escapeHTML(it.label)}</span>
          </span>
          <strong>${it.value}</strong>
        </div>
      `
      )
      .join('');

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-around;gap:1rem;flex-wrap:wrap;">
        <svg width="190" height="190" viewBox="0 0 190 190" role="img" aria-label="Status distribution">
          ${segments}
          <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="20" font-weight="800" fill="var(--text-primary)">${total}</text>
          <text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">Total Quotes</text>
        </svg>
        <div style="flex:1;min-width:150px;">${legend}</div>
      </div>
    `;
    bindChartTooltips(container.querySelector('svg'));
  }

  /**
   * Renders a smooth SVG Area/Line Chart for revenue progression.
   */
  function renderLineChart(container, { labels, values, formatVal = (v) => v }) {
    if (!container) return;
    if (!labels || labels.length === 0) {
      container.innerHTML = `<div class="empty-state"><p class="text-muted text-sm">No won deals in this period.</p></div>`;
      return;
    }

    const width = 520;
    const height = 220;
    const padL = 48;
    const padR = 20;
    const padT = 20;
    const padB = 34;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxVal = Math.max(10, ...values) * 1.15;

    const coords = values.map((v, i) => {
      const x = labels.length === 1 ? padL + plotW / 2 : padL + (i / (labels.length - 1)) * plotW;
      const y = padT + plotH - (v / maxVal) * plotH;
      return { x, y, v, label: labels[i] };
    });

    const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
    const areaPoints = `${coords[0].x},${padT + plotH} ${polylinePoints} ${coords[coords.length - 1].x},${padT + plotH}`;

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      const val = Math.round(maxVal * (1 - i / 4));
      grid += `
        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="3,3" />
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-secondary)">${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}</text>
      `;
    }

    const dots = coords
      .map(
        (c) => `
        <circle cx="${c.x}" cy="${c.y}" r="5" fill="#16A36A" stroke="#FFFFFF" stroke-width="2"
          data-tip="${escapeHTML(c.label)}: ${escapeHTML(String(formatVal(c.v)))}"></circle>
        <text x="${c.x}" y="${height - 10}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">${escapeHTML(c.label)}</text>
      `
      )
      .join('');

    container.innerHTML = `
      <svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Revenue trend">
        ${grid}
        <polygon points="${areaPoints}" fill="rgba(22, 163, 106, 0.14)"></polygon>
        <polyline fill="none" stroke="#16A36A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" points="${polylinePoints}"></polyline>
        ${dots}
      </svg>
    `;
    bindChartTooltips(container.querySelector('svg'));
  }

  return {
    uid,
    todayISO,
    addDaysISO,
    daysBetween,
    formatDate,
    formatCurrency,
    escapeHTML,
    getStatusBadgeClass,
    getPriorityBadgeClass,
    computeQuoteHealth,
    interpolateTemplate,
    buildWhatsAppURL,
    buildMailtoURL,
    toast,
    renderBarChart,
    renderDonutChart,
    renderLineChart
  };
})();
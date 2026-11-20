/**
 * QuoteNudge Storage Layer (js/storage.js)
 * Encapsulates all localStorage persistence with structured schemas ready
 * for future migration to Supabase / cloud backend.
 */
window.QN = window.QN || {};

window.QN.Storage = (() => {
  'use strict';

  const KEYS = {
    PROFILE: 'qn_v1_profile',
    SETTINGS: 'qn_v1_settings',
    CUSTOMERS: 'qn_v1_customers',
    QUOTES: 'qn_v1_quotes',
    TEMPLATES: 'qn_v1_templates',
    ACTIVITIES: 'qn_v1_activities',
    ONBOARDING: 'qn_v1_onboarding_done'
  };

  const DEFAULT_PROFILE = {
    userName: 'Alex Morgan',
    companyName: 'Studio Craft',
    email: 'alex@studiocraft.io',
    phone: '+1 555 019 2834'
  };

  const DEFAULT_SETTINGS = {
    language: 'en',
    defaultCurrency: 'USD',
    dateFormat: 'YYYY-MM-DD',
    theme: 'light',
    atRiskDays: 3,
    expiringDays: 3,
    preferredFollowUpTime: '09:30',
    defaultFollowUpInterval: 3,
    browserNotifications: false,
    cadenceRules: [
      { days: 1, label: 'Day 1 — Friendly check-in to confirm quote receipt.' },
      { days: 3, label: 'Day 3 — Ask if the client reviewed the proposal and clarify doubts.' },
      { days: 7, label: 'Day 7 — Reinforce service value, ROI, and timeline availability.' },
      { days: 14, label: 'Day 14 — Final polite follow-up before closing the proposal.' }
    ]
  };

  const DEFAULT_TEMPLATES = [
    {
      id: 'tpl_en_1',
      name: 'First Follow-up (Check Receipt)',
      category: 'First Follow-up',
      language: 'EN',
      subject: 'Proposal {{quote_number}}: {{quote_title}}',
      body: "Hi {{customer_name}}, I hope you're doing well! I wanted to make sure you received our proposal for {{quote_title}} ({{quote_amount}}). Let me know if you have any questions!"
    },
    {
      id: 'tpl_en_2',
      name: 'Checking the Proposal (3 Days)',
      category: 'Checking the Proposal',
      language: 'EN',
      subject: 'Quick check-in on {{quote_title}}',
      body: "Hi {{customer_name}}, I hope your week is going smoothly! I wanted to check if you had a chance to review the proposal for {{quote_title}}. Happy to walk through any details whenever convenient."
    },
    {
      id: 'tpl_en_3',
      name: 'Friendly Expiration Reminder',
      category: 'Friendly Reminder',
      language: 'EN',
      subject: 'Reminder: {{quote_title}} valid until {{expiration_date}}',
      body: "Hi {{customer_name}}, just a quick heads-up that our quote {{quote_number}} for {{quote_title}} ({{quote_amount}}) remains valid until {{expiration_date}}. Would you like to lock in our schedule?"
    },
    {
      id: 'tpl_en_4',
      name: 'Price & Scope Negotiation',
      category: 'Price Negotiation',
      language: 'EN',
      subject: 'Flexible options for {{quote_title}}',
      body: "Hi {{customer_name}}, we'd love to partner with you on {{quote_title}}. If budget or scope adjustments would help move things forward, let me know and I can tailor an option for you."
    },
    {
      id: 'tpl_en_5',
      name: 'Final Polite Follow-up',
      category: 'Last Follow-up',
      language: 'EN',
      subject: 'Closing the loop on {{quote_title}}',
      body: "Hi {{customer_name}}, I haven't heard back regarding {{quote_title}}, so I assume priorities may have shifted. Should I keep this proposal open or close it for now?"
    },
    {
      id: 'tpl_en_6',
      name: 'Quote Approved — Kickoff',
      category: 'Quote Approved',
      language: 'EN',
      subject: 'Excited to get started on {{quote_title}}!',
      body: "Thank you, {{customer_name}}! We're thrilled to have {{quote_title}} approved. Here are our immediate next steps to kick off the project."
    },
    {
      id: 'tpl_pt_1',
      name: 'Primeiro Acompanhamento (Recebimento)',
      category: 'First Follow-up',
      language: 'PT',
      subject: 'Proposta {{quote_number}}: {{quote_title}}',
      body: 'Olá {{customer_name}}, tudo bem? Passando para confirmar se você recebeu o orçamento de {{quote_title}} no valor de {{quote_amount}}. Fico à disposição para tirar qualquer dúvida!'
    },
    {
      id: 'tpl_pt_2',
      name: 'Análise da Proposta (3 Dias)',
      category: 'Checking the Proposal',
      language: 'PT',
      subject: 'Retorno sobre o orçamento {{quote_title}}',
      body: 'Olá {{customer_name}}, espero que esteja tudo ótimo! Você conseguiu analisar nossa proposta para {{quote_title}}? Se quiser, podemos ajustar algum ponto para atender melhor sua necessidade.'
    },
    {
      id: 'tpl_pt_3',
      name: 'Lembrete Amigável de Validade',
      category: 'Friendly Reminder',
      language: 'PT',
      subject: 'Validade da proposta {{quote_title}} ({{expiration_date}})',
      body: 'Olá {{customer_name}}, tudo bem? Só um lembrete rápido de que a proposta {{quote_number}} ({{quote_title}}) está válida até {{expiration_date}}. Podemos reservar sua vaga na agenda?'
    },
    {
      id: 'tpl_pt_4',
      name: 'Agradecimento por Aprovação',
      category: 'Thank You',
      language: 'PT',
      subject: 'Obrigado pela confiança — {{quote_title}}',
      body: 'Muito obrigado pela aprovação, {{customer_name}}! Já estamos preparando tudo para iniciar {{quote_title}} com excelência.'
    }
  ];

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Storage read error for ${key}:`, err);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Storage write error for ${key}:`, err);
      if (window.QN.Utils && window.QN.Utils.toast) {
        window.QN.Utils.toast('Storage error: unable to save changes locally.', 'error');
      }
      return false;
    }
  }

  function init() {
    if (!localStorage.getItem(KEYS.PROFILE)) {
      writeJSON(KEYS.PROFILE, DEFAULT_PROFILE);
    }
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      writeJSON(KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(KEYS.TEMPLATES)) {
      writeJSON(KEYS.TEMPLATES, DEFAULT_TEMPLATES);
    }
    if (!localStorage.getItem(KEYS.CUSTOMERS)) {
      writeJSON(KEYS.CUSTOMERS, []);
    }
    if (!localStorage.getItem(KEYS.QUOTES)) {
      writeJSON(KEYS.QUOTES, []);
    }
    if (!localStorage.getItem(KEYS.ACTIVITIES)) {
      writeJSON(KEYS.ACTIVITIES, []);
    }
  }

  // Profile & Settings
  function getProfile() {
    return { ...DEFAULT_PROFILE, ...readJSON(KEYS.PROFILE, {}) };
  }

  function saveProfile(profile) {
    return writeJSON(KEYS.PROFILE, { ...getProfile(), ...profile });
  }

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...readJSON(KEYS.SETTINGS, {}) };
  }

  function saveSettings(settings) {
    return writeJSON(KEYS.SETTINGS, { ...getSettings(), ...settings });
  }

  function isOnboardingDone() {
    return localStorage.getItem(KEYS.ONBOARDING) === 'true';
  }

  function setOnboardingDone(val = true) {
    localStorage.setItem(KEYS.ONBOARDING, val ? 'true' : 'false');
  }

  // Customers
  function getCustomers() {
    return readJSON(KEYS.CUSTOMERS, []);
  }

  function getCustomerById(id) {
    return getCustomers().find((c) => c.id === id) || null;
  }

  function saveCustomer(customer) {
    const list = getCustomers();
    const idx = list.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...customer, updatedAt: Date.now() };
    } else {
      list.unshift({ ...customer, createdAt: customer.createdAt || new Date().toISOString().slice(0, 10) });
    }
    return writeJSON(KEYS.CUSTOMERS, list);
  }

  function deleteCustomer(id) {
    const list = getCustomers().filter((c) => c.id !== id);
    return writeJSON(KEYS.CUSTOMERS, list);
  }

  // Quotes
  function getQuotes() {
    return readJSON(KEYS.QUOTES, []);
  }

  function getQuoteById(id) {
    return getQuotes().find((q) => q.id === id) || null;
  }

  function saveQuote(quote) {
    const list = getQuotes();
    const idx = list.findIndex((q) => q.id === quote.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...quote, updatedAt: Date.now() };
    } else {
      list.unshift({ ...quote, updatedAt: Date.now() });
    }
    return writeJSON(KEYS.QUOTES, list);
  }

  function deleteQuote(id) {
    const list = getQuotes().filter((q) => q.id !== id);
    const acts = getActivities().filter((a) => a.quoteId !== id);
    writeJSON(KEYS.ACTIVITIES, acts);
    return writeJSON(KEYS.QUOTES, list);
  }

  function getNextQuoteNumber() {
    const quotes = getQuotes();
    const year = new Date().getFullYear();
    let maxNum = 100;
    quotes.forEach((q) => {
      const match = String(q.quoteNumber || '').match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `QN-${year}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  // Activities
  function getActivities(quoteId = null) {
    const all = readJSON(KEYS.ACTIVITIES, []);
    if (!quoteId) return all;
    return all.filter((a) => a.quoteId === quoteId);
  }

  function addActivity(activity) {
    const list = getActivities();
    list.unshift({
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...activity
    });
    return writeJSON(KEYS.ACTIVITIES, list);
  }

  // Templates
  function getTemplates() {
    return readJSON(KEYS.TEMPLATES, DEFAULT_TEMPLATES);
  }

  function saveTemplate(tpl) {
    const list = getTemplates();
    const idx = list.findIndex((t) => t.id === tpl.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...tpl };
    } else {
      list.unshift(tpl);
    }
    return writeJSON(KEYS.TEMPLATES, list);
  }

  function deleteTemplate(id) {
    const list = getTemplates().filter((t) => t.id !== id);
    return writeJSON(KEYS.TEMPLATES, list);
  }

  // Backup Export / Import / Clear
  function exportAllJSON() {
    return JSON.stringify(
      {
        app: 'QuoteNudge',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        data: {
          profile: getProfile(),
          settings: getSettings(),
          customers: getCustomers(),
          quotes: getQuotes(),
          templates: getTemplates(),
          activities: getActivities()
        }
      },
      null,
      2
    );
  }

  function importAllJSON(rawText) {
    const parsed = JSON.parse(rawText);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || !Array.isArray(data.quotes) || !Array.isArray(data.customers)) {
      throw new Error('Invalid QuoteNudge backup file structure.');
    }
    if (data.profile) writeJSON(KEYS.PROFILE, { ...DEFAULT_PROFILE, ...data.profile });
    if (data.settings) writeJSON(KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...data.settings });
    writeJSON(KEYS.CUSTOMERS, data.customers);
    writeJSON(KEYS.QUOTES, data.quotes);
    if (Array.isArray(data.templates)) writeJSON(KEYS.TEMPLATES, data.templates);
    if (Array.isArray(data.activities)) writeJSON(KEYS.ACTIVITIES, data.activities);
    setOnboardingDone(true);
    return true;
  }

  function clearAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    init();
  }

  // Realistic Demo Data Generator (Dates anchored relative to today)
  function seedDemoData() {
    const shift = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const customers = [
      {
        id: 'cust_demo_1',
        name: 'John Smith',
        company: 'Northstar Logistics',
        email: 'john.smith@northstarlog.com',
        phone: '+1 555 234 8810',
        country: 'United States',
        notes: 'Prefers WhatsApp updates in the morning. Decides fast once ROI is clear.',
        createdAt: shift(-28)
      },
      {
        id: 'cust_demo_2',
        name: 'Camila Ferreira',
        company: 'VerdeVivo Arquitetura',
        email: 'camila@verdevivo.com.br',
        phone: '+55 11 98765 4321',
        country: 'Brazil',
        notes: 'Interested in complete brand refresh + institutional website.',
        createdAt: shift(-22)
      },
      {
        id: 'cust_demo_3',
        name: 'Marcus Vance',
        company: 'Vance Advisory Group',
        email: 'mvance@vanceadvisory.co.uk',
        phone: '+44 7700 900412',
        country: 'United Kingdom',
        notes: 'Needs quarterly retainer proposal breakdown.',
        createdAt: shift(-19)
      },
      {
        id: 'cust_demo_4',
        name: 'Elena Rostova',
        company: 'Lumina HealthTech',
        email: 'elena@luminahealth.io',
        phone: '+1 555 892 3319',
        country: 'Canada',
        notes: 'Requested two pricing tiers for MVP mobile dashboard.',
        createdAt: shift(-15)
      },
      {
        id: 'cust_demo_5',
        name: 'Rafael Mendes',
        company: 'Café Serra Alta',
        email: 'rafael@cafeserraalta.com.br',
        phone: '+55 19 99123 7788',
        country: 'Brazil',
        notes: 'E-commerce subscription store for specialty coffee.',
        createdAt: shift(-12)
      },
      {
        id: 'cust_demo_6',
        name: 'Sophie Laurent',
        company: 'Atelier Lumière',
        email: 'sophie@atelierlumiere.fr',
        phone: '+33 6 12 34 56 78',
        country: 'France',
        notes: 'Looking for Q4 digital campaign strategy.',
        createdAt: shift(-8)
      }
    ];

    const quotes = [
      {
        id: 'qt_demo_1',
        quoteNumber: 'QN-2026-0101',
        title: 'Fleet Tracking Portal UI/UX',
        customerId: 'cust_demo_1',
        serviceCategory: 'Design & Branding',
        description: 'Complete web portal redesign, driver mobile screens, and interactive prototype.',
        currency: 'USD',
        amount: 2650,
        discount: 150,
        totalAmount: 2500,
        createdDate: shift(-6),
        lastContactDate: shift(-5),
        expirationDate: shift(5),
        followUpDate: shift(-2),
        status: 'Awaiting Response',
        priority: 'High',
        notes: 'Sent PDF proposal on Monday. Follow up on timeline questions.'
      },
      {
        id: 'qt_demo_2',
        quoteNumber: 'QN-2026-0102',
        title: 'Institutional Website & Portfolio',
        customerId: 'cust_demo_2',
        serviceCategory: 'Web & Software',
        description: 'Responsive architecture showcase with CMS, SEO optimization, and WhatsApp lead capture.',
        currency: 'USD',
        amount: 3400,
        discount: 0,
        totalAmount: 3400,
        createdDate: shift(-4),
        lastContactDate: shift(-4),
        expirationDate: shift(2),
        followUpDate: shift(0),
        status: 'Awaiting Response',
        priority: 'High',
        notes: 'Proposal expires in 2 days — great moment to offer priority kickoff slot.'
      },
      {
        id: 'qt_demo_3',
        quoteNumber: 'QN-2026-0103',
        title: 'B2B Growth Funnel & Landing Pages',
        customerId: 'cust_demo_3',
        serviceCategory: 'Marketing & Growth',
        description: 'Three high-converting landing pages, copywriting, and CRM webhook integration.',
        currency: 'USD',
        amount: 4200,
        discount: 200,
        totalAmount: 4000,
        createdDate: shift(-10),
        lastContactDate: shift(-2),
        expirationDate: shift(8),
        followUpDate: shift(0),
        status: 'Negotiating',
        priority: 'High',
        notes: 'Client asked for split payment milestone (50/50).'
      },
      {
        id: 'qt_demo_4',
        quoteNumber: 'QN-2026-0104',
        title: 'Patient Analytics Dashboard MVP',
        customerId: 'cust_demo_4',
        serviceCategory: 'Web & Software',
        description: 'Interactive front-end analytics module with CSV export and role permissions.',
        currency: 'USD',
        amount: 5800,
        discount: 300,
        totalAmount: 5500,
        createdDate: shift(-18),
        lastContactDate: shift(-12),
        expirationDate: shift(12),
        followUpDate: shift(4),
        status: 'Won',
        wonDate: shift(-12),
        priority: 'High',
        notes: 'Approved! Kickoff completed.'
      },
      {
        id: 'qt_demo_5',
        quoteNumber: 'QN-2026-0105',
        title: 'Specialty Coffee Subscription Store',
        customerId: 'cust_demo_5',
        serviceCategory: 'Web & Software',
        description: 'Recurring box checkout flow, brand packaging mockups, and email automation.',
        currency: 'USD',
        amount: 2900,
        discount: 100,
        totalAmount: 2800,
        createdDate: shift(-14),
        lastContactDate: shift(-9),
        expirationDate: shift(10),
        followUpDate: shift(5),
        status: 'Won',
        wonDate: shift(-9),
        priority: 'Medium',
        notes: 'Closed after 2nd WhatsApp follow-up.'
      },
      {
        id: 'qt_demo_6',
        quoteNumber: 'QN-2026-0106',
        title: 'Brand Identity & Lookbook Design',
        customerId: 'cust_demo_6',
        serviceCategory: 'Design & Branding',
        description: 'Visual identity system, typography guidelines, and seasonal digital lookbook.',
        currency: 'USD',
        amount: 1950,
        discount: 0,
        totalAmount: 1950,
        createdDate: shift(-2),
        lastContactDate: shift(-2),
        expirationDate: shift(12),
        followUpDate: shift(2),
        status: 'Sent',
        priority: 'Medium',
        notes: 'Sent via email and WhatsApp.'
      },
      {
        id: 'qt_demo_7',
        quoteNumber: 'QN-2026-0107',
        title: 'Monthly Cloud & Security Retainer',
        customerId: 'cust_demo_1',
        serviceCategory: 'Maintenance & Support',
        description: '24/7 uptime monitoring, monthly security patches, and performance audits.',
        currency: 'USD',
        amount: 1200,
        discount: 0,
        totalAmount: 1200,
        createdDate: shift(-8),
        lastContactDate: shift(-7),
        expirationDate: shift(4),
        followUpDate: shift(-1),
        status: 'Awaiting Response',
        priority: 'Medium',
        notes: 'Bundle opportunity alongside the Fleet Portal project.'
      },
      {
        id: 'qt_demo_8',
        quoteNumber: 'QN-2026-0108',
        title: 'Executive Pitch Deck & Financial Model',
        customerId: 'cust_demo_3',
        serviceCategory: 'Consulting',
        description: 'Series A investor deck narrative, visual slides, and 3-year revenue model.',
        currency: 'USD',
        amount: 2100,
        discount: 0,
        totalAmount: 2100,
        createdDate: shift(-21),
        lastContactDate: shift(-15),
        expirationDate: shift(-5),
        followUpDate: shift(-5),
        status: 'Lost',
        lostReason: 'Chose a Competitor',
        lostNote: 'Went with an internal agency.',
        priority: 'Low',
        notes: ''
      },
      {
        id: 'qt_demo_9',
        quoteNumber: 'QN-2026-0109',
        title: 'SEO Content & Technical Audit',
        customerId: 'cust_demo_5',
        serviceCategory: 'Consulting',
        description: 'Full site crawl, Core Web Vitals optimization plan, and 90-day content roadmap.',
        currency: 'USD',
        amount: 1450,
        discount: 50,
        totalAmount: 1400,
        createdDate: shift(-1),
        lastContactDate: shift(-1),
        expirationDate: shift(14),
        followUpDate: shift(3),
        status: 'Draft',
        priority: 'Low',
        notes: 'Finalize keyword appendix before sending.'
      },
      {
        id: 'qt_demo_10',
        quoteNumber: 'QN-2026-0110',
        title: 'E-commerce Checkout Conversion Sprint',
        customerId: 'cust_demo_4',
        serviceCategory: 'Marketing & Growth',
        description: 'A/B testing checkout steps and mobile speed improvements.',
        currency: 'USD',
        amount: 3100,
        discount: 0,
        totalAmount: 3100,
        createdDate: shift(-25),
        lastContactDate: shift(-19),
        expirationDate: shift(-10),
        followUpDate: shift(-10),
        status: 'Lost',
        lostReason: 'Too Expensive',
        lostNote: 'Budget frozen until next quarter.',
        priority: 'Medium',
        notes: ''
      }
    ];

    const activities = [
      { id: 'act_d1', quoteId: 'qt_demo_1', type: 'created', title: 'Quote QN-2026-0101 created ($2,500.00)', timestamp: new Date(Date.now() - 6 * 86400000).toISOString() },
      { id: 'act_d2', quoteId: 'qt_demo_1', type: 'sent', title: 'Sent proposal to John Smith via WhatsApp', timestamp: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: 'act_d3', quoteId: 'qt_demo_2', type: 'created', title: 'Quote QN-2026-0102 created ($3,400.00)', timestamp: new Date(Date.now() - 4 * 86400000).toISOString() },
      { id: 'act_d4', quoteId: 'qt_demo_3', type: 'followup', title: 'Follow-up logged: Marcus Vance requested 50/50 milestone terms', timestamp: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'act_d5', quoteId: 'qt_demo_4', type: 'status', title: 'Status changed to Won ($5,500.00)', timestamp: new Date(Date.now() - 12 * 86400000).toISOString() },
      { id: 'act_d6', quoteId: 'qt_demo_5', type: 'status', title: 'Status changed to Won ($2,800.00)', timestamp: new Date(Date.now() - 9 * 86400000).toISOString() }
    ];

    writeJSON(KEYS.CUSTOMERS, customers);
    writeJSON(KEYS.QUOTES, quotes);
    writeJSON(KEYS.ACTIVITIES, activities);
    if (!localStorage.getItem(KEYS.TEMPLATES)) {
      writeJSON(KEYS.TEMPLATES, DEFAULT_TEMPLATES);
    }
    setOnboardingDone(true);
  }

  return {
    init,
    getProfile,
    saveProfile,
    getSettings,
    saveSettings,
    isOnboardingDone,
    setOnboardingDone,
    getCustomers,
    getCustomerById,
    saveCustomer,
    deleteCustomer,
    getQuotes,
    getQuoteById,
    saveQuote,
    deleteQuote,
    getNextQuoteNumber,
    getActivities,
    addActivity,
    getTemplates,
    saveTemplate,
    deleteTemplate,
    exportAllJSON,
    importAllJSON,
    clearAll,
    seedDemoData
  };
})();
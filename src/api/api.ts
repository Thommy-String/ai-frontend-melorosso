/* ------------------------------------------------------------------ */
/* BASE URL                                                          */
/* ------------------------------------------------------------------ */

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!BASE_URL) {
  throw new Error("VITE_API_BASE_URL non è definito. Controlla i tuoi file .env (.development o .production)");
}

function url(path: string): string {
  const formattedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${formattedPath}`;
}

/* ------------------------------------------------------------------ */
/* TIPI                                                              */
/* ------------------------------------------------------------------ */

export interface SendOpts {
  client_slug: string;
  message: string;
  session_id: string;
  pageContent?: string;
  stream?: boolean;
}

export interface NewClient {
  name: string;
  partner_id: string | null;
  plan_id: string;
  contact_email: string;
  billing_email: string;
  password?: string;
  phone?: string;
}

export type ClientPatch = Partial<{
  name: string;
  partner_id: string | null;
  plan_id: string;
  contact_email: string;
  billing_email: string;
  phone?: string;
  password?: string;
}>;

export type NewPartner = {
  name: string;
  contact_email: string;
  password: string; // richiesto in creazione: il backend genererà password_hash
  phone_number?: string;
  iban?: string;
  vat_number?: string;
  default_commission_rate?: number; // 0..1 (es: 0.2 per 20%)
};

export type PartnerPatch = Partial<{
  name: string;
  contact_email: string;
  phone_number: string;
  iban: string;
  vat_number: string;
  default_commission_rate: number; // 0..1
  password: string; // opzionale: se presente, aggiorna la password
}>;

export type Invoice = {
  id: string;
  client_slug: string;
  client_name?: string;
  billing_email?: string;
  contact_email?: string;
  invoice_type: 'proforma' | 'invoice';
  status: 'issued' | 'paid' | 'cancelled';
  issue_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  plan_id: string;
  unit_price_net: string;
  vat_rate: number;
  quantity: number;
  subtotal_net: string;
  vat_amount: string;
  total_gross: string;
  reminder_step?: number | null;
  last_reminder_at?: string | null;
};

export type InvoiceListItem = Invoice & {
  paid_total?: string;     // "0.00"
  remaining_due?: string;  // "145.18"
};

export type PaymentRow = {
  id: string;
  type: 'payment' | 'refund' | 'chargeback';
  amount: string;     // numeric as string
  status: string;     // 'settled' | ...
  method?: string;
  reference?: string | null;
  received_at: string; // ISO
  created_at: string;  // ISO
};

// opzionale: struttura per i crediti cliente
export type ClientCredit = {
  id: string;
  client_slug: string;
  currency: string;
  amount: string;
  remaining: string;
  reason?: string | null;
  granted_at: string;
  expires_at?: string | null;
};

/* ------------------------------------------------------------------ */
/* API per Chat (Funzioni Originali Mantenute Intatte)               */
/* ------------------------------------------------------------------ */

type DataCB = (chunk: string) => void;
type ErrorCB = () => void;

export function sendMessageStream(opts: SendOpts) {
  const body = JSON.stringify(opts);
  const ctrl = new AbortController();

  let onData: DataCB = () => { };
  let onError: ErrorCB = () => { };

  let onSid: (sid: string) => void = () => { };

  // facciamo in modo che chi usa la funzione possa registrarsi
  const es = {
    onmessage(cb: DataCB) { onData = cb },
    onsid(cb: (sid: string) => void) { onSid = cb },   // 👈 nuovo
    onerror(cb: ErrorCB) { onError = cb },
    close() { ctrl.abort() }
  } as const;

  fetch(url('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body,
    signal: ctrl.signal
  })
    .then(res => {
      if (!res.ok || !res.body) throw new Error('Bad response');
      const rd = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      const pump = (): void => {
        rd.read().then(({ done, value }) => {
          if (done) {
            onData('[END]');
            return;
          }

          buf += dec.decode(value, { stream: true });

          let endOfMessageIdx;
          // Processa ogni "blocco" di messaggio completo (terminato da \n\n)
          while ((endOfMessageIdx = buf.indexOf('\n\n')) > -1) {
            const messageBlock = buf.slice(0, endOfMessageIdx);
            buf = buf.slice(endOfMessageIdx + 2); // Sposta il buffer in avanti

            let eventName = 'message';
            let dataPayload = '';

            // Analizza ogni riga all'interno del blocco
            const lines = messageBlock.split('\n');
            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataPayload += line.slice(5).trim();
              }
            }

            // Se abbiamo trovato dei dati, inviamoli al gestore corretto
            if (dataPayload) {
              console.log(`[API PUMP] Rilevato evento '${eventName}' con dati:`, dataPayload);
              if (eventName === 'sid') {
                onSid(dataPayload);    // 🔔 Chiama il callback del nuovo SID
              } else {
                onData(dataPayload);   // ✍️ Chiama il callback dei dati normale
              }
            }
          }
          pump(); // Continua a leggere dallo stream
        })
          .catch(err => {
            if (err?.name !== 'AbortError' && !ctrl.signal.aborted) onError();
          });
      };
      pump();
    })

  return es;
}

export function getHistory(sessionId: string, token: MaybeToken) {
  // Ora usa il nostro helper che aggiunge automaticamente il token
  return fetchWithAuth(`/chat/${sessionId}`, token);
}


/* ------------------------------------------------------------------ */
/* HELPER API                    */
/* ------------------------------------------------------------------ */

// accetta anche oggetti tipo { token }, { access_token }
export type MaybeToken = string | null | undefined | { token?: string } | { access_token?: string };
async function fetchWithAuth<T = any>(path: string, token: MaybeToken, options: RequestInit = {}): Promise<T | null> {
  const bearer =
    typeof token === 'string'
      ? token
      : (token && typeof token === 'object' && ('token' in token || 'access_token' in token))
        ? (('token' in token ? (token as any).token : (token as any).access_token) as string | undefined)
        : undefined;

  if (!bearer) throw new Error('Token di autenticazione non fornito.');
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bearer}`, ...options.headers };
  const res = await fetch(url(path), { ...options, headers });
  if (res.status === 401 || res.status === 403) throw new Error('Non autorizzato o accesso negato.');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'La richiesta API è fallita' }));
    throw new Error(err.error || `La richiesta è fallita con stato ${res.status}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}



/* ------------------------------------------------------------------ */
/* API di Autenticazione (Pubbliche)                                 */
/* ------------------------------------------------------------------ */

export async function loginUser(email: string, password: string) {
  const res = await fetch(url('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Credenziali non valide');
  }
  return data;
}

export async function loginPartner(email: string, password: string) {
  const res = await fetch(url('/partners/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Credenziali non valide');
  }
  return data;
}


/* ------------------------------------------------------------------ */
/* API per Amministrazione                                           */
/* ------------------------------------------------------------------ */

export function getAdminMetrics(token: MaybeToken) {
  return fetchWithAuth('/admin/metrics', token);
}

export function getAllClients(token: MaybeToken) {
  return fetchWithAuth('/admin/clients', token);
}

export function getClient(slug: string, token: MaybeToken) {
  return fetchWithAuth(`/admin/clients/${slug}`, token);
}

// Funzione per la lista semplice (usata in ClientManager)
export function getPartners(token: MaybeToken) {
  return fetchWithAuth('/admin/partners', token);
}

// Funzione per i dati aggregati (usata in PartnerManager)
export function getPartnersSummary(token: MaybeToken) {
  return fetchWithAuth('/admin/partners/summary', token);
}

export function createPartner(data: NewPartner, token: MaybeToken) {
  return fetchWithAuth('/admin/partners', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deletePartner(id: string, opts: { orphan?: boolean } | undefined, token: MaybeToken) {
  const q = opts?.orphan ? '?orphan=true' : '';
  return fetchWithAuth(`/admin/partners/${id}${q}`, token, { method: 'DELETE' });
}

export function updatePartner(
  id: string,
  data: {
    name?: string;
    contact_email?: string;
    phone_number?: string;
    iban?: string;
    vat_number?: string;
    default_commission_rate?: number;
    password?: string;
  },
  token: MaybeToken
) {
  return fetchWithAuth(`/admin/partners/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function assignPartnerToClient(slug: string, partner_id: string | null, token: MaybeToken) {
  return fetchWithAuth(`/admin/clients/${slug}/partner`, token, {
    method: 'PUT',
    body: JSON.stringify({ partner_id }),
  });
}

export function getCommissionReport(month: string, token: MaybeToken) {
  return fetchWithAuth(`/admin/reports/commissions?month=${month}`, token);
}

export function getAdminAlerts(token: MaybeToken) {
  return fetchWithAuth('/admin/alerts', token);
}

export function impersonateClient(slug: string, token: MaybeToken) {
  return fetchWithAuth('/admin/impersonate', token, {
    method: 'POST',
    body: JSON.stringify({ client_slug: slug }),
  });
}

export function createClient(data: NewClient, token: MaybeToken) {
  return fetchWithAuth('/admin/clients', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteClient(slug: string, token: MaybeToken, opts?: { force?: boolean }) {
  const q = opts?.force ? '?force=true' : '';
  return fetchWithAuth(`/admin/clients/${slug}${q}`, token, { method: 'DELETE' });
}

export function updateClient(slug: string, data: Partial<ClientPatch>, token: MaybeToken) {
  return fetchWithAuth(`/admin/clients/${slug}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getPlans(token: MaybeToken) {
  // Rotta backend: GET /admin/plans
  return fetchWithAuth('/admin/plans', token);
}


/* ------------------------------------------------------------------ */
/* API per Dashboard Cliente                                         */
/* ------------------------------------------------------------------ */
export function getSubscriptionData(slug: string, token: MaybeToken) {
  return fetchWithAuth(`/stats/subscription/${slug}`, token);
}

export function getHistoricalSubscriptionData(
  periodId: string,
  token: MaybeToken
) {
  return fetchWithAuth(`/stats/subscription/historical-entry/${periodId}`, token);
}

export function getDashboardStats(slug: string, token: MaybeToken, dates: { start_date: string, end_date: string }) {
  return fetchWithAuth(`/stats/${slug}?start_date=${dates.start_date}&end_date=${dates.end_date}`, token);
}

export function getRecentSessions(slug: string, token: MaybeToken) {
  return fetchWithAuth(`/stats/sessions/${slug}`, token);
}

export function getFaqs(slug: string, token: MaybeToken) {
  return fetchWithAuth(`/stats/faq/${slug}?days=30`, token);
}

export function getInsights(slug: string, token: MaybeToken) {
  return fetchWithAuth(`/stats/insights/${slug}?days=30`, token);
}

export function getContactRequests(slug: string, offset: number, token: MaybeToken) {
  return fetchWithAuth(`/stats/contact-requests/${slug}?offset=${offset}&limit=5`, token);
}

export function getSubscriptionHistory(slug: string, token: MaybeToken) {
  return fetchWithAuth(`/stats/subscription/history/${slug}`, token);
}

export function getChatHistory(sessionId: string, token: MaybeToken) {
  return fetchWithAuth(`/chat/${sessionId}`, token);
}


//per dashboard dei partner
export function getPartnerDashboard(token: MaybeToken) {
  return fetchWithAuth('/partners/dashboard', token);
}

export type InvoiceStatusFilter = 'issued' | 'paid' | 'cancelled' | 'all';
export type WindowFilter = 'upcoming' | 'overdue' | 'all';

// LISTA fatture
export function listInvoices(
  p: { status?: InvoiceStatusFilter; window?: WindowFilter } = {},
  token: MaybeToken
) {
  const q = new URLSearchParams({
    status: p.status ?? 'issued',
    window: p.window ?? 'upcoming',
  }).toString();
  return fetchWithAuth<InvoiceListItem[]>(`/admin/billing/invoices?${q}`, token);
}

export function cancelInvoice(id: string, token: MaybeToken) {
  return fetchWithAuth(`/admin/billing/invoices/${id}/cancel`, token, { method: 'POST' });
}

// opzionale: tipo riutilizzabile
export type PayInvoicePayload = {
  amount?: number;
  received_at?: string; // ISO string
  method?: 'bank_transfer' | 'card' | 'other';
  reference?: string;   // CRO/causale
};

export function payInvoice(
  id: string,
  payload: PayInvoicePayload = {},
  token: MaybeToken
) {
  return fetchWithAuth(`/admin/billing/invoices/${id}/pay`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type MovementPayload = {
  amount: number;
  received_at?: string; // ISO string
  method?: 'bank_transfer' | 'card' | 'other';
  reference?: string;   // CRO/causale
};

export function refundInvoice(
  id: string,
  payload: MovementPayload,
  token: MaybeToken
) {
  return fetchWithAuth(`/admin/billing/invoices/${id}/refund`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function chargebackInvoice(
  id: string,
  payload: MovementPayload,
  token: MaybeToken
) {
  return fetchWithAuth(`/admin/billing/invoices/${id}/chargeback`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------- Crediti cliente ----------
export function getClientCredits(slug: string, token: MaybeToken) {
  return fetchWithAuth<{ balance: string; credits: ClientCredit[] }>(
    `/admin/billing/credits/${slug}`, token
  );
}

export function grantClientCredit(
  slug: string,
  payload: { amount: number; reason?: string; expires_at?: string | null },
  token: MaybeToken
) {
  return fetchWithAuth(`/admin/billing/credits/${slug}/grant`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------- Trigger cron amministrativi ----------
export function triggerGenerateProformas(token: MaybeToken) {
  return fetchWithAuth(`/admin/billing/cron/generate-proformas`, token, { method: 'POST' });
}
export function triggerDunning(token: MaybeToken) {
  return fetchWithAuth(`/admin/billing/cron/dunning`, token, { method: 'POST' });
}


export function upgradeSubscription(
  slug: string,
  payload: { new_plan_id: string; paid_at?: string; method?: 'bank_transfer' | 'card' | 'other'; reference?: string },
  token: MaybeToken
) {
  return fetchWithAuth(`/admin/billing/subscriptions/${slug}/upgrade`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getInvoicePayments(id: string, token: MaybeToken) {
  return fetchWithAuth<PaymentRow[]>(`/admin/billing/invoices/${id}/payments`, token);
}

// Alias per compatibilità con l'import esistente
export function listInvoicePayments(id: string, token: MaybeToken) {
  return getInvoicePayments(id, token);
}


export type DowngradeOptions = {
  new_plan_id: string;
  effective?: 'next_renew' | 'immediate_with_credit' | 'revert_recent_upgrade';
  preview?: boolean;
};

// Downgrade: backward-compatible overload (accetta string o opzioni)
export function downgradeSubscription(
  slug: string,
  new_plan_id: string,
  token: MaybeToken
): Promise<any>;
export function downgradeSubscription(
  slug: string,
  payload: DowngradeOptions,
  token: MaybeToken
): Promise<any>;
export function downgradeSubscription(
  slug: string,
  arg: string | DowngradeOptions,
  token: MaybeToken
) {
  const body = typeof arg === 'string' ? { new_plan_id: arg } : arg;
  return fetchWithAuth(`/admin/billing/subscriptions/${slug}/downgrade`, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
export function previewDowngrade(
  slug: string,
  new_plan_id: string,
  token: MaybeToken
) {
  return downgradeSubscription(slug, { new_plan_id, preview: true }, token);
}
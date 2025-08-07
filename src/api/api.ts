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
  phone?: string;
}

export type ClientPatch = Partial<{
  name: string;
  partner_id: string | null;
  plan_id: string;
  contact_email: string;
  billing_email: string;
  phone?: string;
}>;

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

export async function getHistory(sessionId: string) {
  const r = await fetch(url(`/chat/${sessionId}`));
  if (!r.ok) {
    if (r.status === 404) {
      return [];
    }
    throw new Error('Failed to fetch history');
  }
  return (await r.json()).chatLogs as { role: 'user' | 'assistant'; content: string }[];
}


/* ------------------------------------------------------------------ */
/* HELPER API                    */
/* ------------------------------------------------------------------ */

async function fetchWithAuth(path: string, token: string | null, options: RequestInit = {}) {
  if (!token) throw new Error('Token di autenticazione non fornito.');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  }

  const response = await fetch(url(path), { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Non autorizzato o accesso negato.');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'La richiesta API è fallita' }));
    throw new Error(errorData.error || `La richiesta è fallita con stato ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}


/* ------------------------------------------------------------------ */
/* API di Autenticazione (Pubbliche)                                 */
/* ------------------------------------------------------------------ */

export async function loginUser(email, password) {
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

export async function loginPartner(email, password) {
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

export function getAdminMetrics(token: string | null) {
  return fetchWithAuth('/admin/metrics', token);
}

export function getAllClients(token: string | null) {
  return fetchWithAuth('/admin/clients', token);
}

export function getPartners(token: string | null) {
  return fetchWithAuth('/admin/partners', token);
}

export function updatePartner(id: string, data: { default_commission_rate: number }, token: string | null) {
  return fetchWithAuth(`/admin/partners/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function assignPartnerToClient(slug: string, partner_id: string | null, token: string | null) {
  return fetchWithAuth(`/admin/clients/${slug}/partner`, token, {
    method: 'PUT',
    body: JSON.stringify({ partner_id }),
  });
}

export function getCommissionReport(month: string, token: string | null) {
  return fetchWithAuth(`/admin/reports/commissions?month=${month}`, token);
}

export function getAdminAlerts(token: string | null) {
  return fetchWithAuth('/admin/alerts', token);
}

export function impersonateClient(slug: string, token: string | null) {
  return fetchWithAuth('/admin/impersonate', token, {
    method: 'POST',
    body: JSON.stringify({ client_slug: slug }),
  });
}

export function createClient(data: NewClient, token: string | null) {
  return fetchWithAuth('/admin/clients', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateClient(slug: string, data: Partial<ClientPatch>, token: string | null) {
  return fetchWithAuth(`/admin/clients/${slug}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getPlans(token: string | null) {
  // Dovrai creare questa semplice rotta GET /admin/plans nel backend
  return fetchWithAuth('/admin/plans', token);
}


/* ------------------------------------------------------------------ */
/* API per Dashboard Cliente                                         */
/* ------------------------------------------------------------------ */
export function getSubscriptionData(slug: string, token: string | null) {
  return fetchWithAuth(`/stats/subscription/${slug}`, token);
}

export function getHistoricalSubscriptionData(
  periodId: string,
  token: string | null
) {
  return fetchWithAuth(`/stats/subscription/historical-entry/${periodId}`, token);
}

export function getDashboardStats(slug: string, token: string | null, dates: { start_date: string, end_date: string }) {
  return fetchWithAuth(`/stats/${slug}?start_date=${dates.start_date}&end_date=${dates.end_date}`, token);
}

export function getRecentSessions(slug: string, token: string | null) {
  return fetchWithAuth(`/stats/sessions/${slug}`, token);
}

export function getFaqs(slug: string, token: string | null) {
  return fetchWithAuth(`/stats/faq/${slug}?days=30`, token);
}

export function getInsights(slug: string, token: string | null) {
  return fetchWithAuth(`/stats/insights/${slug}?days=30`, token);
}

export function getContactRequests(slug: string, offset: number, token: string | null) {
  return fetchWithAuth(`/stats/contact-requests/${slug}?offset=${offset}&limit=5`, token);
}

export function getSubscriptionHistory(slug: string, token: string | null) {
  return fetchWithAuth(`/stats/subscription/history/${slug}`, token);
}

export function getChatHistory(sessionId: string, token: string | null) {
  return fetchWithAuth(`/chat/${sessionId}`, token);
}

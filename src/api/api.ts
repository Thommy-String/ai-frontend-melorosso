
/* ------------------------------------------------------------------ */
/*  BASE URL                                                          */
/* ------------------------------------------------------------------ */
let BASE: string | null = import.meta.env.VITE_API ?? null;

export function setApiBase(u: string) {
  BASE = u.replace(/\/+$/, '');
}

function url(path: string) {
  if (!BASE) throw new Error('API base URL not set – call setApiBase() first');
  return `${BASE}${path}`;
}

/* ------------------------------------------------------------------ */
/*  TIPI                                                              */
/* ------------------------------------------------------------------ */
export interface SendOpts {
  client_slug: string;
  message: string;
  session_id : string;
  pageContent?: string;
  stream?: boolean;            // (per ora ignorato: usiamo sempre SSE)
}

/* ------------------------------------------------------------------ */
/*  sendMessageStream                                                 */
/* ------------------------------------------------------------------ */
type DataCB  = (chunk: string) => void;
type ErrorCB = () => void;

export function sendMessageStream(opts: SendOpts) {
  
  const body = JSON.stringify(opts);
  const ctrl = new AbortController();

  let onData:  DataCB  = () => {};
  let onError: ErrorCB = () => {};

  const es = {
    onmessage(cb: DataCB) { onData = cb; },
    onerror  (cb: ErrorCB) { onError = cb; },
    close() { ctrl.abort(); }
  } as const;

  fetch(url('/chat'), {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept'      : 'text/event-stream'
    },
    body,
    signal: ctrl.signal
  })
    .then(res => {
      if (!res.ok || !res.body) throw new Error('Bad response');
      const rd  = res.body.getReader();
      const dec = new TextDecoder();
      let buf   = '';

      const pump = (): void => {
        rd.read().then(({ done, value }) => {
          if (done) { onData('[END]'); return; }

          buf += dec.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf('\n\n')) > -1) {
            const raw = buf.slice(0, idx).trimEnd();
            buf = buf.slice(idx + 2);
            if (raw.startsWith('data:')) onData(raw.slice(5));
          }
          pump();
        })
        .catch(err => {
          if (err?.name !== 'AbortError' && !ctrl.signal.aborted) onError();
        });
      };
      pump();
    })
    .catch(err => {
      if (err?.name !== 'AbortError' && !ctrl.signal.aborted) onError();
    });

  return es;
}

/* ------------------------------------------------------------------ */
/*  GET /chat/:session – ricarica history                             */
/* ------------------------------------------------------------------ */
export async function getHistory(sessionId: string) {
  const r = await fetch(url(`/chat/${sessionId}`));
  if (!r.ok) { 
  // SE la risposta non è OK, ma lo status è 404...
  if (r.status === 404) {
    
    return []; 
  }
  throw new Error('Failed to fetch history'); 
}
  return (await r.json()).chatLogs as { role: 'user' | 'assistant'; content: string }[];
}
// src/pages/ClientModal.tsx
import React from "react"

/* ------------------------------------------------------------------ */
/* TYPES                                                              */
/* ------------------------------------------------------------------ */

interface Plan { id: string; name: string }
interface Partner { id: string; name: string }

type ClientFormValues = Partial<{
  name: string
  contact_email: string
  billing_email: string
  password: string
  plan_id: string
  partner_id: string
}>

type ClientInitialValues = Partial<{
  name: string
  contact_email: string | null
  billing_email: string | null
  plan_id: string | null
  partner_id: string | null
}>

interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (formData: ClientFormValues) => void
  plans: Plan[]
  partners: Partner[]
  initialValues?: ClientInitialValues
}

/* ------------------------------------------------------------------ */
/* COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function ClientModal({
  isOpen,
  initialValues,
  onClose,
  onSave,
  plans,
  partners,
}: ClientModalProps) {
  if (!isOpen) return null

  // È edit se c’è un nome nei valori iniziali
  const isEdit = Boolean(initialValues?.name)

  // Normalizzo i default per evitare "possibly undefined"
  const iv = {
    name: initialValues?.name ?? "",
    contact_email: initialValues?.contact_email ?? "",
    // se billing mancante, fallback alla contact
    billing_email: initialValues?.billing_email ?? (initialValues?.contact_email ?? ""),
    plan_id: initialValues?.plan_id ?? "",
    partner_id: initialValues?.partner_id ?? "",
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>

    // Converto in stringhe pulite e rendo vuoti -> undefined
    const toStr = (v: FormDataEntryValue | undefined) =>
      (typeof v === "string" ? v.trim() : "") || undefined

    const values: ClientFormValues = {
      name: toStr(raw.name),
      contact_email: toStr(raw.contact_email),
      billing_email: toStr(raw.billing_email),
      password: toStr(raw.password),
      plan_id: toStr(raw.plan_id),
      partner_id: toStr(raw.partner_id), // opzionale: rimane undefined se non selezionato
    }

    // Se la password è vuota in edit, non inviarla
    if (isEdit && !values.password) {
      delete values.password
    }

    onSave(values)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{isEdit ? "Modifica Cliente" : "Aggiungi Nuovo Cliente"}</h2>

        <form onSubmit={handleSubmit}>
          {/* ---- Nome ---- */}
          <div className="form-group">
            <label htmlFor="name">Nome Cliente</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={iv.name}
            />
          </div>

          {/* ---- Email contatto ---- */}
          <div className="form-group">
            <label htmlFor="contact_email">Email contatto</label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              required={!isEdit}
              defaultValue={iv.contact_email}
            />
          </div>

          {/* ---- Email fatturazione ---- */}
          <div className="form-group">
            <label htmlFor="billing_email">Email fatturazione</label>
            <input
              id="billing_email"
              name="billing_email"
              type="email"
              required={!isEdit}
              defaultValue={iv.billing_email}
            />
          </div>

          {/* ---- Password (solo creazione) ---- */}
          <div className="form-group">
            <label htmlFor="password">Password iniziale</label>
            <input
              id="password"
              name="password"
              type="password"
              required={!isEdit}
            />
          </div>

          {/* ---- Piano ---- */}
          <div className="form-group">
            <label htmlFor="plan_id">Piano</label>
            <select
              id="plan_id"
              name="plan_id"
              required
              defaultValue={iv.plan_id}
            >
              <option value="" disabled>Seleziona piano…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* ---- Partner (opzionale) ---- */}
          <div className="form-group">
            <label htmlFor="partner_id">Partner</label>
            <select
              id="partner_id"
              name="partner_id"
              // opzionale: niente required
              defaultValue={iv.partner_id}
            >
              <option value="">— Nessun Partner —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* ---- AZIONI ---- */}
          <div className="modal-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
            >
              Annulla
            </button>
            <button type="submit" className="button-primary">
              Salva Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
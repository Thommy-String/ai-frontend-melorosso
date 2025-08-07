// src/pages/ClientModal.tsx

/* ------------------------------------------------------------------ */
/* TYPES                                                             */
/* ------------------------------------------------------------------ */

interface Plan { id: string; name: string }
interface Partner { id: string; name: string }


/* valori ammessi nel form (tutti opzionali) */
type ClientFormValues = Partial<{
  name: string;
  contact_email: string;
  billing_email: string;
  password: string;
  plan_id: string;
  partner_id: string;
}>

interface ClientModalProps {
    isOpen: boolean;
    /** valori pre-compilati in edit */
    initialValues?: ClientFormValues;
    onClose: () => void;
    /** riceve qualunque oggetto generato dal form */
    onSave: (formData: Record<string, FormDataEntryValue>) => void;
    plans: Plan[];
    partners: Partner[];
}

/* ------------------------------------------------------------------ */
/* COMPONENT                                                         */
/* ------------------------------------------------------------------ */

export default function ClientModal({
    isOpen,
    initialValues = {},
    onClose,
    onSave,
    plans,
    partners,
}: ClientModalProps) {
    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        onSave(Object.fromEntries(formData.entries()))
    }

    const isEdit = Boolean(initialValues.name)

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>{isEdit ? 'Modifica Cliente' : 'Aggiungi Nuovo Cliente'}</h2>

                <form onSubmit={handleSubmit}>
                    {/* ---- Nome ---- */}
                    <div className="form-group">
                        <label htmlFor="name">Nome Cliente</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            defaultValue={initialValues.name ?? ''}
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
                            defaultValue={initialValues.contact_email ?? ''}
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
                            defaultValue={
                                initialValues.billing_email ?? initialValues.contact_email ?? ''
                            }
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
                            defaultValue={initialValues?.plan_id ?? ''}
                        >
                            <option value="" disabled>Seleziona piano…</option>
                            {plans.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* ---- Partner ---- */}
                    <div className="form-group">
                        <label htmlFor="partner_id">Partner</label>
                        <select
                            id="partner_id"
                            name="partner_id"
                            required
                            defaultValue={initialValues.partner_id ?? ''}
                        >
                            <option value="" disabled>— Nessun Partner —</option>
                            {partners.map(p => (
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
// src/pages/ClientModal.tsx

// Definisci qui i tipi Plan e Partner se non li hai già in un file globale
interface Plan { id: string; name: string; }
interface Partner { id: string; name: string; }

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: any) => void; // Semplificato, puoi creare un tipo per i dati del form
  plans: Plan[];
  partners: Partner[];
}

export default function ClientModal({ isOpen, onClose, onSave, plans, partners }: ClientModalProps) {
  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    onSave(data);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Aggiungi Nuovo Cliente</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Nome Cliente</label>
            <input type="text" id="name" name="name" required />
          </div>
          <div className="form-group">
            <label htmlFor="contact_email">Email</label>
            <input type="email" id="contact_email" name="contact_email" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password Iniziale</label>
            <input type="password" id="password" name="password" required />
          </div>
          <div className="form-group">
            <label htmlFor="plan_id">Piano</label>
            <select id="plan_id" name="plan_id" required>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="partner_id">Partner</label>
            <select id="partner_id" name="partner_id" required>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="button-secondary">Annulla</button>
            <button type="submit" className="button-primary">Salva Cliente</button>
          </div>
        </form>
      </div>
    </div>
  );
}
// src/MetricCard.tsx
export default function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col justify-center items-center p-6 bg-[var(--card-bg)] rounded-2xl shadow-md">
      <div className="text-[var(--text-secondary)] text-sm font-medium mb-1">
        {label}
      </div>
      <div className="text-3xl font-semibold" style={{ color: 'var(--accent)' }}>
        {value}
      </div>
    </div>
  );
}
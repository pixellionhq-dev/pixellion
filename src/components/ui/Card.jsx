export default function Card({ children, className = "" }) {
    return (
        <div
            className={`bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-[var(--color-border-subtle)] ${className}`}
        >
            {children}
        </div>
    );
}

export default function Button({ children, className = "", ...props }) {
    return (
        <button
            className={`px-4 py-2.5 rounded-xl bg-[var(--color-accent)] text-white font-medium hover:-translate-y-[1px] hover:shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:opacity-95 transition-all duration-200 ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

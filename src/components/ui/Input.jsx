export default function Input({ className = "", ...props }) {
    return (
        <input
            className={`px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${className}`}
            {...props}
        />
    );
}

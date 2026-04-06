'use client';

interface UndoToastProps {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ label, onUndo, onDismiss }: UndoToastProps) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
        bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg
        animate-[slideUp_0.25s_ease-out]"
      role="status"
    >
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={onUndo}
        className="text-sm font-semibold text-accent hover:text-accent-light
          px-2 py-0.5 rounded transition-colors cursor-pointer"
      >
        Undo
      </button>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-white ml-1 text-lg leading-none cursor-pointer"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

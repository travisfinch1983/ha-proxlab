interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "error" | "primary" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  confirmVariant = "error",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const btnClass =
    confirmVariant === "primary"
      ? "btn btn-primary"
      : confirmVariant === "success"
        ? "btn btn-success"
        : "btn btn-error";

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={btnClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCancel}>close</button>
      </form>
    </dialog>
  );
}

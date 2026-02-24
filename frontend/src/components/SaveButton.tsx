import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk } from "@fortawesome/free-solid-svg-icons";

interface Props {
  saving: boolean;
  onClick: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function SaveButton({
  saving,
  onClick,
  label = "Save",
  className = "btn-primary",
  disabled = false,
}: Props) {
  return (
    <button
      className={`btn btn-sm ${className}`}
      onClick={onClick}
      disabled={saving || disabled}
    >
      {saving ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <FontAwesomeIcon icon={faFloppyDisk} />
      )}
      {label}
    </button>
  );
}

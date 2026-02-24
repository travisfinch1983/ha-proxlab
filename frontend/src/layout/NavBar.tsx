import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../store";
import { fetchConfig } from "../api";

interface Props {
  title: string;
  actions?: React.ReactNode;
}

export default function NavBar({ title, actions }: Props) {
  const loading = useStore((s) => s.loading);

  const handleRefresh = () => {
    useStore.getState().setLoading(true);
    fetchConfig()
      .then((cfg) => useStore.getState().setConfig(cfg))
      .catch((err) =>
        useStore.getState().setError(err?.message || "Failed to refresh")
      );
  };

  return (
    <div className="navbar bg-base-100 border-b border-base-300 px-6">
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex-none flex items-center gap-2">
        {actions}
        <button
          className="btn btn-ghost btn-sm btn-square"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh data"
        >
          <FontAwesomeIcon
            icon={faArrowsRotate}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>
    </div>
  );
}

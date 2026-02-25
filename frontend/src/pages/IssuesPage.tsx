import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faTrash,
  faPlus,
  faBug,
  faLightbulb,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import {
  listIssues,
  createIssue,
  updateIssue,
  deleteIssue,
  type IssueItem,
} from "../api";

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Section — renders one category (Bugs or Features)                  */
/* ------------------------------------------------------------------ */

function IssueSection({
  title,
  icon,
  category,
  items,
  onToggle,
  onDelete,
  onAdd,
}: {
  title: string;
  icon: typeof faBug;
  category: "bug" | "feature";
  items: IssueItem[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAdd: (category: "bug" | "feature", text: string) => void;
}) {
  const [newText, setNewText] = useState("");

  const pending = items
    .filter((i) => !i.completed)
    .sort((a, b) => b.created_at - a.created_at);
  const completed = items
    .filter((i) => i.completed)
    .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0));
  const sorted = [...pending, ...completed];

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(category, trimmed);
    setNewText("");
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4">
        <h3 className="card-title text-base gap-2">
          <FontAwesomeIcon
            icon={icon}
            className={category === "bug" ? "text-error" : "text-info"}
          />
          {title}
          <span className="badge badge-ghost badge-sm">
            {pending.length} open
          </span>
        </h3>

        {/* Add input */}
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            className="input input-bordered input-sm flex-1"
            placeholder={
              category === "bug"
                ? "Describe the bug..."
                : "Describe the feature..."
            }
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={!newText.trim()}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add
          </button>
        </div>

        {/* Items */}
        <div className="mt-2 space-y-1">
          {sorted.length === 0 && (
            <p className="text-base-content/40 text-sm italic py-2">
              No {category === "bug" ? "bugs" : "features"} yet
            </p>
          )}
          {sorted.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-base-200 group"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={item.completed}
                onChange={() => onToggle(item.id, !item.completed)}
              />
              <span
                className={`flex-1 text-sm ${
                  item.completed
                    ? "line-through text-base-content/40"
                    : "text-base-content"
                }`}
              >
                {item.text}
              </span>
              <span className="text-xs text-base-content/40 shrink-0">
                {timeAgo(item.created_at)}
              </span>
              <button
                className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(item.id)}
                title="Delete"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  IssuesPage                                                         */
/* ------------------------------------------------------------------ */

export default function IssuesPage() {
  const [items, setItems] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listIssues();
      setItems(data);
    } catch (err) {
      console.error("Failed to load issues:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (id: string, completed: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              completed,
              completed_at: completed ? Date.now() / 1000 : null,
            }
          : i
      )
    );
    try {
      await updateIssue(id, { completed });
    } catch {
      load(); // Revert on failure
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteIssue(id);
    } catch {
      load();
    }
  };

  const handleAdd = async (category: "bug" | "feature", text: string) => {
    try {
      const { id } = await createIssue(category, text);
      setItems((prev) => [
        ...prev,
        {
          id,
          category,
          text,
          completed: false,
          created_at: Date.now() / 1000,
          completed_at: null,
        },
      ]);
    } catch (err) {
      console.error("Failed to create issue:", err);
    }
  };

  const bugs = items.filter((i) => i.category === "bug");
  const features = items.filter((i) => i.category === "feature");

  return (
    <>
      <NavBar
        title="Issues"
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={load}
            disabled={loading}
          >
            <FontAwesomeIcon
              icon={faArrowsRotate}
              spin={loading}
            />
            Refresh
          </button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">
        <IssueSection
          title="Bugs"
          icon={faBug}
          category="bug"
          items={bugs}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={handleAdd}
        />
        <IssueSection
          title="Features & Tweaks"
          icon={faLightbulb}
          category="feature"
          items={features}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAdd={handleAdd}
        />
      </div>
    </>
  );
}

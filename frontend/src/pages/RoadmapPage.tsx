import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faTrash,
  faPlus,
  faChevronDown,
  faChevronRight,
  faArrowUp,
  faArrowDown,
  faPen,
  faCheck,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import {
  listRoadmap,
  updateRoadmap,
  type RoadmapHeader,
} from "../api";

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  HeaderCard                                                         */
/* ------------------------------------------------------------------ */

function HeaderCard({
  header,
  index,
  total,
  onToggleCollapse,
  onRenameHeader,
  onDeleteHeader,
  onMoveHeader,
  onAddItem,
  onToggleItem,
  onDeleteItem,
}: {
  header: RoadmapHeader;
  index: number;
  total: number;
  onToggleCollapse: (id: string, collapsed: boolean) => void;
  onRenameHeader: (id: string, title: string) => void;
  onDeleteHeader: (id: string) => void;
  onMoveHeader: (id: string, direction: "up" | "down") => void;
  onAddItem: (headerId: string, text: string) => void;
  onToggleItem: (headerId: string, itemId: string, completed: boolean) => void;
  onDeleteItem: (headerId: string, itemId: string) => void;
}) {
  const [newItemText, setNewItemText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(header.title);

  const pendingCount = header.items.filter((i) => !i.completed).length;
  const doneCount = header.items.filter((i) => i.completed).length;

  const handleAddItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    onAddItem(header.id, trimmed);
    setNewItemText("");
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== header.title) {
      onRenameHeader(header.id, trimmed);
    }
    setEditing(false);
  };

  const pending = header.items
    .filter((i) => !i.completed)
    .sort((a, b) => a.created_at - b.created_at);
  const completed = header.items
    .filter((i) => i.completed)
    .sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0));
  const sorted = [...pending, ...completed];

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onToggleCollapse(header.id, !header.collapsed)}
            title={header.collapsed ? "Expand" : "Collapse"}
          >
            <FontAwesomeIcon
              icon={header.collapsed ? faChevronRight : faChevronDown}
            />
          </button>

          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                className="input input-bordered input-sm flex-1"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
              />
              <button
                className="btn btn-ghost btn-xs text-success"
                onClick={handleSaveTitle}
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={() => setEditing(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          ) : (
            <h3
              className="card-title text-base flex-1 cursor-pointer"
              onDoubleClick={() => {
                setEditTitle(header.title);
                setEditing(true);
              }}
            >
              {header.title}
            </h3>
          )}

          <span className="badge badge-ghost badge-sm">
            {doneCount}/{header.items.length}
          </span>

          {/* Reorder buttons */}
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onMoveHeader(header.id, "up")}
            disabled={index === 0}
            title="Move up"
          >
            <FontAwesomeIcon icon={faArrowUp} />
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => onMoveHeader(header.id, "down")}
            disabled={index === total - 1}
            title="Move down"
          >
            <FontAwesomeIcon icon={faArrowDown} />
          </button>

          {!editing && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setEditTitle(header.title);
                setEditing(true);
              }}
              title="Rename"
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
          )}

          <button
            className="btn btn-ghost btn-xs text-error"
            onClick={() => onDeleteHeader(header.id)}
            title="Delete phase"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>

        {/* Collapsible content */}
        {!header.collapsed && (
          <>
            {/* Add step input */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                className="input input-bordered input-sm flex-1"
                placeholder="Add a step..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddItem}
                disabled={!newItemText.trim()}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add
              </button>
            </div>

            {/* Items */}
            <div className="mt-2 space-y-1">
              {sorted.length === 0 && (
                <p className="text-base-content/40 text-sm italic py-2">
                  No steps yet
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
                    onChange={() =>
                      onToggleItem(header.id, item.id, !item.completed)
                    }
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
                    onClick={() => onDeleteItem(header.id, item.id)}
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {header.items.length > 0 && (
              <progress
                className="progress progress-primary w-full mt-2"
                value={doneCount}
                max={header.items.length}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RoadmapPage                                                        */
/* ------------------------------------------------------------------ */

export default function RoadmapPage() {
  const [headers, setHeaders] = useState<RoadmapHeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRoadmap();
      setHeaders(data);
    } catch (err) {
      console.error("Failed to load roadmap:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddPhase = async () => {
    const trimmed = newPhaseTitle.trim();
    if (!trimmed) return;
    try {
      const res = await updateRoadmap("create_header", { title: trimmed });
      const headerId = res.header_id as string;
      setHeaders((prev) => [
        ...prev,
        {
          id: headerId,
          title: trimmed,
          position: prev.length,
          collapsed: false,
          created_at: Date.now() / 1000,
          items: [],
        },
      ]);
      setNewPhaseTitle("");
    } catch (err) {
      console.error("Failed to create phase:", err);
    }
  };

  const handleToggleCollapse = async (id: string, collapsed: boolean) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, collapsed } : h))
    );
    try {
      await updateRoadmap("update_header", { header_id: id, collapsed });
    } catch {
      load();
    }
  };

  const handleRenameHeader = async (id: string, title: string) => {
    setHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, title } : h))
    );
    try {
      await updateRoadmap("update_header", { header_id: id, title });
    } catch {
      load();
    }
  };

  const handleDeleteHeader = async (id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
    try {
      await updateRoadmap("delete_header", { header_id: id });
    } catch {
      load();
    }
  };

  const handleMoveHeader = async (id: string, direction: "up" | "down") => {
    setHeaders((prev) => {
      const idx = prev.findIndex((h) => h.id === id);
      if (idx < 0) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      // Fire reorder in background
      const orderedIds = next.map((h) => h.id);
      updateRoadmap("reorder_headers", { header_ids: orderedIds }).catch(() =>
        load()
      );
      return next;
    });
  };

  const handleAddItem = async (headerId: string, text: string) => {
    try {
      const res = await updateRoadmap("create_item", {
        header_id: headerId,
        text,
      });
      const itemId = res.item_id as string;
      setHeaders((prev) =>
        prev.map((h) =>
          h.id === headerId
            ? {
                ...h,
                items: [
                  ...h.items,
                  {
                    id: itemId,
                    text,
                    completed: false,
                    created_at: Date.now() / 1000,
                    completed_at: null,
                  },
                ],
              }
            : h
        )
      );
    } catch (err) {
      console.error("Failed to add item:", err);
    }
  };

  const handleToggleItem = async (
    headerId: string,
    itemId: string,
    completed: boolean
  ) => {
    setHeaders((prev) =>
      prev.map((h) =>
        h.id === headerId
          ? {
              ...h,
              items: h.items.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      completed,
                      completed_at: completed ? Date.now() / 1000 : null,
                    }
                  : i
              ),
            }
          : h
      )
    );
    try {
      await updateRoadmap("update_item", {
        header_id: headerId,
        item_id: itemId,
        completed,
      });
    } catch {
      load();
    }
  };

  const handleDeleteItem = async (headerId: string, itemId: string) => {
    setHeaders((prev) =>
      prev.map((h) =>
        h.id === headerId
          ? { ...h, items: h.items.filter((i) => i.id !== itemId) }
          : h
      )
    );
    try {
      await updateRoadmap("delete_item", {
        header_id: headerId,
        item_id: itemId,
      });
    } catch {
      load();
    }
  };

  // Summary stats
  const totalItems = headers.reduce((s, h) => s + h.items.length, 0);
  const doneItems = headers.reduce(
    (s, h) => s + h.items.filter((i) => i.completed).length,
    0
  );

  return (
    <>
      <NavBar
        title="Roadmap"
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={load}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowsRotate} spin={loading} />
            Refresh
          </button>
        }
      />

      <div className="p-4 space-y-4 max-w-3xl">
        {/* Summary + Add Phase */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            className="input input-bordered input-sm flex-1 min-w-[200px]"
            placeholder="New phase title..."
            value={newPhaseTitle}
            onChange={(e) => setNewPhaseTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddPhase()}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAddPhase}
            disabled={!newPhaseTitle.trim()}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add Phase
          </button>
          {totalItems > 0 && (
            <span className="badge badge-outline badge-sm">
              {doneItems}/{totalItems} completed
            </span>
          )}
        </div>

        {/* Headers */}
        {headers.length === 0 && !loading && (
          <p className="text-base-content/40 text-sm italic py-4">
            No roadmap phases yet. Add one above to get started.
          </p>
        )}
        {headers.map((header, i) => (
          <HeaderCard
            key={header.id}
            header={header}
            index={i}
            total={headers.length}
            onToggleCollapse={handleToggleCollapse}
            onRenameHeader={handleRenameHeader}
            onDeleteHeader={handleDeleteHeader}
            onMoveHeader={handleMoveHeader}
            onAddItem={handleAddItem}
            onToggleItem={handleToggleItem}
            onDeleteItem={handleDeleteItem}
          />
        ))}
      </div>
    </>
  );
}

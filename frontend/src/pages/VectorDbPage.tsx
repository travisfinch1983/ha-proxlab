import { useState } from "react";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import ConfirmDialog from "../components/ConfirmDialog";
import { updateVectorDb, deleteVectorDb, fetchConfig } from "../api";

export default function VectorDbPage() {
  const config = useStore((s) => s.config)!;
  const vdb = config.vector_db;

  const [backend, setBackend] = useState(vdb?.vector_db_backend ?? "chromadb");
  const [host, setHost] = useState(vdb?.vector_db_host ?? "localhost");
  const [port, setPort] = useState(vdb?.vector_db_port ?? 8000);
  const [collection, setCollection] = useState(
    vdb?.vector_db_collection ?? "home_entities"
  );
  const [topK, setTopK] = useState(vdb?.vector_db_top_k ?? 5);
  const [threshold, setThreshold] = useState(
    vdb?.vector_db_similarity_threshold ?? 250.0
  );
  // Milvus fields
  const [milvusHost, setMilvusHost] = useState(
    vdb?.milvus_host ?? "localhost"
  );
  const [milvusPort, setMilvusPort] = useState(vdb?.milvus_port ?? 19530);
  const [milvusCollection, setMilvusCollection] = useState(
    vdb?.milvus_collection ?? "proxlab_entities"
  );
  // Weaviate fields
  const [weaviateUrl, setWeaviateUrl] = useState(
    vdb?.weaviate_url ?? "http://localhost:8080"
  );
  const [weaviateApiKey, setWeaviateApiKey] = useState(
    vdb?.weaviate_api_key ?? ""
  );
  const [weaviateCollection, setWeaviateCollection] = useState(
    vdb?.weaviate_collection ?? "ProxlabEntities"
  );

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      let fields: Record<string, unknown>;
      if (backend === "milvus") {
        fields = {
          vector_db_backend: backend,
          milvus_host: milvusHost,
          milvus_port: milvusPort,
          milvus_collection: milvusCollection,
          vector_db_top_k: topK,
          vector_db_similarity_threshold: threshold,
        };
      } else if (backend === "weaviate") {
        fields = {
          vector_db_backend: backend,
          weaviate_url: weaviateUrl,
          weaviate_api_key: weaviateApiKey,
          weaviate_collection: weaviateCollection,
          vector_db_top_k: topK,
          vector_db_similarity_threshold: threshold,
        };
      } else {
        fields = {
          vector_db_backend: backend,
          vector_db_host: host,
          vector_db_port: port,
          vector_db_collection: collection,
          vector_db_top_k: topK,
          vector_db_similarity_threshold: threshold,
        };
      }
      await updateVectorDb(fields);
      const cfg = await fetchConfig();
      useStore.getState().setConfig(cfg);
      setToast("Saved");
      setTimeout(() => setToast(null), 2000);
    } catch (err: unknown) {
      setToast(`Error: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteVectorDb();
      const cfg = await fetchConfig();
      useStore.getState().setConfig(cfg);
      setDeleteConfirm(false);
      setToast("Vector DB config removed");
      setTimeout(() => setToast(null), 2000);
    } catch (err: unknown) {
      setToast(`Error: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const renderBackendFields = () => {
    switch (backend) {
      case "milvus":
        return (
          <div className="grid grid-cols-2 gap-4">
            <label className="form-control">
              <div className="label">
                <span className="label-text text-sm">Milvus Host</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={milvusHost}
                onChange={(e) => setMilvusHost(e.target.value)}
              />
            </label>
            <label className="form-control">
              <div className="label">
                <span className="label-text text-sm">Milvus Port</span>
              </div>
              <input
                type="number"
                className="input input-bordered input-sm"
                value={milvusPort}
                onChange={(e) => setMilvusPort(parseInt(e.target.value))}
              />
            </label>
            <label className="form-control col-span-2">
              <div className="label">
                <span className="label-text text-sm">Collection</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm w-64"
                value={milvusCollection}
                onChange={(e) => setMilvusCollection(e.target.value)}
              />
            </label>
          </div>
        );

      case "weaviate":
        return (
          <div className="grid grid-cols-2 gap-4">
            <label className="form-control col-span-2">
              <div className="label">
                <span className="label-text text-sm">Weaviate URL</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={weaviateUrl}
                onChange={(e) => setWeaviateUrl(e.target.value)}
                placeholder="http://localhost:8080"
              />
            </label>
            <label className="form-control col-span-2">
              <div className="label">
                <span className="label-text text-sm">
                  API Key{" "}
                  <span className="text-base-content/50">(optional)</span>
                </span>
              </div>
              <input
                type="password"
                className="input input-bordered input-sm"
                value={weaviateApiKey}
                onChange={(e) => setWeaviateApiKey(e.target.value)}
                placeholder="Leave empty for local instances"
              />
            </label>
            <label className="form-control col-span-2">
              <div className="label">
                <span className="label-text text-sm">Collection (Class)</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm w-64"
                value={weaviateCollection}
                onChange={(e) => setWeaviateCollection(e.target.value)}
              />
            </label>
          </div>
        );

      default:
        return (
          <div className="grid grid-cols-2 gap-4">
            <label className="form-control">
              <div className="label">
                <span className="label-text text-sm">Host</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </label>
            <label className="form-control">
              <div className="label">
                <span className="label-text text-sm">Port</span>
              </div>
              <input
                type="number"
                className="input input-bordered input-sm"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value))}
              />
            </label>
            <label className="form-control col-span-2">
              <div className="label">
                <span className="label-text text-sm">Collection</span>
              </div>
              <input
                type="text"
                className="input input-bordered input-sm w-64"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              />
            </label>
          </div>
        );
    }
  };

  return (
    <>
      <NavBar title="Vector DB Settings" />
      <div className="p-6 max-w-2xl">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <label className="form-control">
              <div className="label">
                <span className="label-text">Backend</span>
              </div>
              <select
                className="select select-bordered select-sm w-48"
                value={backend}
                onChange={(e) => setBackend(e.target.value)}
              >
                <option value="chromadb">ChromaDB</option>
                <option value="milvus">Milvus</option>
                <option value="weaviate">Weaviate</option>
              </select>
            </label>

            {renderBackendFields()}

            <div className="grid grid-cols-2 gap-4">
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-sm">Top K Results</span>
                </div>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                />
              </label>
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-sm">
                    Similarity Threshold
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  className="input input-bordered input-sm"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                />
              </label>
            </div>

            <div className="flex justify-between pt-2">
              <button
                className="btn btn-error btn-sm btn-outline"
                onClick={() => setDeleteConfirm(true)}
              >
                Remove Vector DB
              </button>
              <div className="flex gap-2">
                {toast && (
                  <span className="text-xs text-success self-center">
                    {toast}
                  </span>
                )}
                <SaveButton saving={saving} onClick={handleSave} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Remove Vector DB"
        message="This will remove all Vector DB configuration. The context mode will revert to direct."
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </>
  );
}

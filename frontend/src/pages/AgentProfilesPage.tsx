import { useState, useEffect, useCallback } from "react";
import {
  faPlus,
  faArrowsRotate,
  faPen,
  faTrash,
  faAddressCard,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import NavBar from "../layout/NavBar";
import ConfirmDialog from "../components/ConfirmDialog";
import { listProfiles, saveProfile, deleteProfile, callWS } from "../api";
import type { AgentProfile } from "../types";

interface AvailableAgent {
  id: string;
  name: string;
  description: string;
  group: string;
  has_connection: boolean;
}

interface TtsVoice {
  id: string;
  name: string;
  language: string;
}

interface FormData {
  name: string;
  agent_id: string;
  avatar: string;
  prompt_override: string;
  personality_enabled: boolean;
  personality_name: string;
  personality_description: string;
  personality_personality: string;
  personality_scenario: string;
  personality_first_mes: string;
  personality_mes_example: string;
  personality_system_prompt: string;
  personality_post_history: string;
  tts_normal: string;
  tts_narration: string;
  tts_speech: string;
  tts_thoughts: string;
  auto_tts: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  agent_id: "conversation_agent",
  avatar: "",
  prompt_override: "",
  personality_enabled: false,
  personality_name: "",
  personality_description: "",
  personality_personality: "",
  personality_scenario: "",
  personality_first_mes: "",
  personality_mes_example: "",
  personality_system_prompt: "",
  personality_post_history: "",
  tts_normal: "",
  tts_narration: "",
  tts_speech: "",
  tts_thoughts: "",
  auto_tts: false,
};

function profileToForm(p: AgentProfile): FormData {
  return {
    name: p.name,
    agent_id: p.agent_id,
    avatar: p.avatar,
    prompt_override: p.prompt_override,
    personality_enabled: p.personality_enabled,
    personality_name: p.personality?.name ?? "",
    personality_description: p.personality?.description ?? "",
    personality_personality: p.personality?.personality ?? "",
    personality_scenario: p.personality?.scenario ?? "",
    personality_first_mes: p.personality?.first_mes ?? "",
    personality_mes_example: p.personality?.mes_example ?? "",
    personality_system_prompt: p.personality?.system_prompt ?? "",
    personality_post_history: p.personality?.post_history_instructions ?? "",
    tts_normal: p.tts_voices?.normal ?? "",
    tts_narration: p.tts_voices?.narration ?? "",
    tts_speech: p.tts_voices?.speech ?? "",
    tts_thoughts: p.tts_voices?.thoughts ?? "",
    auto_tts: p.auto_tts,
  };
}

function formToProfile(form: FormData): Omit<AgentProfile, "profile_id"> {
  return {
    name: form.name,
    agent_id: form.agent_id,
    avatar: form.avatar,
    prompt_override: form.prompt_override,
    personality_enabled: form.personality_enabled,
    personality: {
      name: form.personality_name,
      description: form.personality_description,
      personality: form.personality_personality,
      scenario: form.personality_scenario,
      first_mes: form.personality_first_mes,
      mes_example: form.personality_mes_example,
      system_prompt: form.personality_system_prompt,
      post_history_instructions: form.personality_post_history,
      alternate_greetings: [],
      tags: [],
      creator_notes: "",
    },
    tts_voices: {
      normal: form.tts_normal,
      narration: form.tts_narration,
      speech: form.tts_speech,
      thoughts: form.tts_thoughts,
    },
    auto_tts: form.auto_tts,
    portrait_width: "auto",
  };
}

export default function AgentProfilesPage() {
  const [items, setItems] = useState<AgentProfile[]>([]);
  const [agents, setAgents] = useState<AvailableAgent[]>([]);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<"general" | "personality" | "voice">(
    "general"
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profs, agts, vcs] = await Promise.all([
        listProfiles(),
        callWS<AvailableAgent[]>("proxlab/agent/available"),
        callWS<TtsVoice[]>("proxlab/card/voices"),
      ]);
      setItems(profs);
      setAgents(agts);
      setVoices(vcs);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalTab("general");
    setModalOpen(true);
  };

  const openEdit = (p: AgentProfile) => {
    setEditingId(p.profile_id);
    setForm(profileToForm(p));
    setModalTab("general");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("Profile name is required");
      return;
    }

    // Check for duplicate name (only when creating new or renaming)
    const trimmedName = form.name.trim();
    const duplicate = items.find(
      (p) =>
        p.name.toLowerCase() === trimmedName.toLowerCase() &&
        p.profile_id !== editingId
    );
    if (duplicate) {
      const overwrite = confirm(
        `A profile named "${duplicate.name}" already exists.\n\nClick OK to overwrite it, or Cancel to go back and rename.`
      );
      if (!overwrite) return;
      // Overwrite: use the existing profile's ID
      setSaving(true);
      try {
        const profile = formToProfile(form);
        const saved = await saveProfile(duplicate.profile_id, profile);
        setItems((prev) =>
          prev.map((i) => (i.profile_id === duplicate.profile_id ? saved : i))
        );
        setModalOpen(false);
      } catch (err) {
        console.error("Failed to overwrite profile:", err);
        load();
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const id =
        editingId ?? Math.random().toString(36).substring(2, 10);
      const profile = formToProfile(form);
      const saved = await saveProfile(id, profile);
      if (editingId) {
        setItems((prev) =>
          prev.map((i) => (i.profile_id === editingId ? saved : i))
        );
      } else {
        setItems((prev) => [...prev, saved]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setItems((prev) => prev.filter((i) => i.profile_id !== deleteTarget));
    setDeleteTarget(null);
    try {
      await deleteProfile(deleteTarget);
    } catch {
      load();
    }
  };

  const agentName = (id: string) =>
    agents.find((a) => a.id === id)?.name ?? id;

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await callWS<{ url: string }>(
          "proxlab/card/avatar/upload",
          { data: base64, filename: file.name }
        );
        setForm((f) => ({ ...f, avatar: result.url }));
      } catch (err) {
        console.error("Avatar upload failed:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <NavBar
        title="Agent Profiles"
        actions={
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} /> New Profile
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={load}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faArrowsRotate} spin={loading} />
            </button>
          </div>
        }
      />

      <div className="p-4 max-w-5xl">
        {loading && items.length === 0 && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <FontAwesomeIcon
              icon={faAddressCard}
              className="text-4xl text-base-content/20 mb-4"
            />
            <p className="text-base-content/50 mb-4">No profiles yet</p>
            <p className="text-base-content/40 text-sm mb-4">
              Create reusable agent profiles for group chat cards
            </p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} /> Create Profile
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p) => (
              <div
                key={p.profile_id}
                className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="card-body p-4">
                  <div className="flex items-center gap-3">
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-16 h-16 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center shrink-0">
                        <FontAwesomeIcon
                          icon={faAddressCard}
                          className="text-xl text-base-content/30"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      <p className="text-sm text-base-content/60 truncate">
                        {agentName(p.agent_id)}
                      </p>
                      {p.personality_enabled && p.personality?.name && (
                        <span className="badge badge-sm badge-ghost mt-1">
                          {p.personality.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => openEdit(p)}
                      title="Edit"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => setDeleteTarget(p.profile_id)}
                      title="Delete"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-lg mb-3">
              {editingId ? "Edit Profile" : "New Profile"}
            </h3>

            {/* Modal tabs */}
            <div className="tabs tabs-bordered mb-4">
              {(
                [
                  ["general", "General"],
                  ["personality", "Personality"],
                  ["voice", "Voice"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={`tab ${modalTab === id ? "tab-active" : ""}`}
                  onClick={() => setModalTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {/* General tab */}
              {modalTab === "general" && (
                <>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Name</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="e.g. Friendly Assistant"
                    />
                  </label>

                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Agent</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={form.agent_id}
                      onChange={(e) =>
                        setForm({ ...form, agent_id: e.target.value })
                      }
                    >
                      {agents
                        .filter((a) => a.has_connection)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Avatar</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {form.avatar && (
                        <img
                          src={form.avatar}
                          alt="avatar"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      )}
                      <input
                        type="file"
                        className="file-input file-input-bordered file-input-sm flex-1"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                  </label>

                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Prompt Override</span>
                    </div>
                    <textarea
                      className="textarea textarea-bordered textarea-sm h-24"
                      value={form.prompt_override}
                      onChange={(e) =>
                        setForm({ ...form, prompt_override: e.target.value })
                      }
                      placeholder="Additional instructions for this profile..."
                    />
                  </label>
                </>
              )}

              {/* Personality tab */}
              {modalTab === "personality" && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={form.personality_enabled}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          personality_enabled: e.target.checked,
                        })
                      }
                    />
                    <span className="label-text">
                      Enable Character Personality
                    </span>
                  </label>

                  {form.personality_enabled && (
                    <>
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">
                            Import Character Card PNG
                          </span>
                        </div>
                        <input
                          type="file"
                          className="file-input file-input-bordered file-input-sm"
                          accept=".png"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const { parseCharacterCardPNG } = await import(
                                "../card/character-card-parser"
                              );
                              const card = await parseCharacterCardPNG(file);
                              if (card) {
                                setForm((f) => ({
                                  ...f,
                                  personality_name: card.name || f.personality_name,
                                  personality_description: card.description || f.personality_description,
                                  personality_personality: card.personality || f.personality_personality,
                                  personality_scenario: card.scenario || f.personality_scenario,
                                  personality_first_mes: card.first_mes || f.personality_first_mes,
                                  personality_mes_example: card.mes_example || f.personality_mes_example,
                                  personality_system_prompt: card.system_prompt || f.personality_system_prompt,
                                  personality_post_history: card.post_history_instructions || f.personality_post_history,
                                  name: f.name || card.name || f.name,
                                }));
                              }
                            } catch (err) {
                              console.error("Failed to parse character card:", err);
                            }
                            // Also upload the PNG as avatar
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = (reader.result as string).split(",")[1];
                              try {
                                const result = await callWS<{ url: string }>(
                                  "proxlab/card/avatar/upload",
                                  { data: base64, filename: file.name }
                                );
                                setForm((f) => ({ ...f, avatar: result.url }));
                              } catch {
                                // Avatar upload failed
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <div className="label">
                          <span className="label-text-alt text-base-content/40">
                            SillyTavern-compatible PNG with embedded character data
                          </span>
                        </div>
                      </label>
                    </>
                  )}

                  {form.personality_enabled && (
                    <>
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">Character Name</span>
                        </div>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
                          value={form.personality_name}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_name: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">Description</span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-20"
                          value={form.personality_description}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_description: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">Personality</span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-20"
                          value={form.personality_personality}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_personality: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">Scenario</span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-16"
                          value={form.personality_scenario}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_scenario: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">System Prompt</span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-20"
                          value={form.personality_system_prompt}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_system_prompt: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">First Message</span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-16"
                          value={form.personality_first_mes}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_first_mes: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">
                            Example Messages
                          </span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-16"
                          value={form.personality_mes_example}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_mes_example: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="form-control">
                        <div className="label">
                          <span className="label-text">
                            Post-History Instructions
                          </span>
                        </div>
                        <textarea
                          className="textarea textarea-bordered textarea-sm h-16"
                          value={form.personality_post_history}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              personality_post_history: e.target.value,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                </>
              )}

              {/* Voice tab */}
              {modalTab === "voice" && (
                <>
                  {(
                    [
                      ["tts_normal", "Normal Voice"],
                      ["tts_narration", "Narration Voice"],
                      ["tts_speech", "Speech Voice"],
                      ["tts_thoughts", "Thoughts Voice"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="form-control">
                      <div className="label">
                        <span className="label-text">{label}</span>
                      </div>
                      <select
                        className="select select-bordered select-sm"
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      >
                        <option value="">None</option>
                        {voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.language})
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}

                  <label className="flex items-center gap-3 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={form.auto_tts}
                      onChange={(e) =>
                        setForm({ ...form, auto_tts: e.target.checked })
                      }
                    />
                    <span className="label-text">
                      Auto-play TTS on response
                    </span>
                  </label>
                </>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                {editingId ? "Save" : "Create"}
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setModalOpen(false)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Profile"
        message="Are you sure you want to delete this profile? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

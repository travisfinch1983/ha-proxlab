import { useState, useEffect, useCallback, useRef } from "react";
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
import {
  listProfiles,
  saveProfile,
  deleteProfile,
  listConnections,
  callWS,
  fetchModels,
  fetchAvailableTools,
  listAgents,
  getDefaultPrompt,
  type ToolCatalogEntry,
} from "../api";
import type { AgentProfile, AgentInfo, Connection, ConnectionHealth } from "../types";

interface TtsVoice {
  id: string;
  name: string;
  language: string;
}

interface FormData {
  name: string;
  agent_template: string;
  connection_id: string;
  model_override: string;
  enabled_tools: string[];
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
  per_card_memory: boolean;
  memory_universal_access: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  agent_template: "",
  connection_id: "",
  model_override: "",
  enabled_tools: [],
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
  per_card_memory: false,
  memory_universal_access: false,
};

function profileToForm(p: AgentProfile): FormData {
  return {
    name: p.name,
    agent_template: p.agent_id === "conversation_agent" ? "" : p.agent_id,
    connection_id: p.connection_id || "",
    model_override: p.model_override || "",
    enabled_tools: p.enabled_tools ?? [],
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
    per_card_memory: p.per_card_memory ?? false,
    memory_universal_access: p.memory_universal_access ?? false,
  };
}

function formToProfile(form: FormData): Omit<AgentProfile, "profile_id"> {
  return {
    name: form.name,
    agent_id: form.agent_template || "conversation_agent",
    connection_id: form.connection_id,
    model_override: form.model_override || undefined,
    enabled_tools: form.enabled_tools,
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
    portrait_width: "auto",
    per_card_memory: form.per_card_memory,
    memory_universal_access: form.memory_universal_access,
  };
}

/** Auto-expand a textarea to fit its content */
function autoExpand(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.max(el.scrollHeight, el.offsetHeight) + "px";
}

type ModalTab = "general" | "personality" | "voice" | "memory";

export default function AgentProfilesPage() {
  const [items, setItems] = useState<AgentProfile[]>([]);
  const [connections, setConnections] = useState<
    Record<string, Connection & { health?: ConnectionHealth }>
  >({});
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("general");
  // Model override state
  const [connModels, setConnModels] = useState<string[]>([]);

  // Tool catalog for profile tool toggles
  const [profileTools, setProfileTools] = useState<ToolCatalogEntry[]>([]);

  // Agent template dropdown state
  const [agentTemplates, setAgentTemplates] = useState<AgentInfo[]>([]);
  const [toolDefaults, setToolDefaults] = useState<Record<string, string[]>>({});

  // Character card detection state
  const [ccDetected, setCcDetected] = useState(false);
  const [pendingCcData, setPendingCcData] = useState<Record<string, string> | null>(null);
  // Track refs for auto-expand on tab switch
  const textareaContainerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profs, conns, vcs] = await Promise.all([
        listProfiles(),
        listConnections(),
        callWS<TtsVoice[]>("proxlab/card/voices"),
      ]);
      setItems(profs);
      setConnections(conns);
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

  // Fetch available models only for universal (multi-model) connections
  useEffect(() => {
    if (!form.connection_id) {
      setConnModels([]);
      return;
    }
    const conn = connections[form.connection_id];
    if (!conn?.is_universal) {
      setConnModels([]);
      return;
    }
    const healthModels = conn.health?.available_models;
    if (healthModels && healthModels.length > 0) {
      setConnModels(healthModels);
    } else {
      fetchModels(form.connection_id)
        .then((models) => setConnModels(models))
        .catch(() => setConnModels([]));
    }
  }, [form.connection_id, connections]);

  // Load available tools and agent templates when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    Promise.all([fetchAvailableTools(), listAgents()])
      .then(([toolsRes, agents]) => {
        setProfileTools(toolsRes.tools);
        setToolDefaults(toolsRes.defaults);
        setAgentTemplates(agents.filter((a) => a.has_prompt && a.group !== "system"));
      })
      .catch(() => {
        setProfileTools([]);
        setAgentTemplates([]);
      });
  }, [modalOpen]);

  // Auto-expand textareas when switching to a tab with content
  useEffect(() => {
    if (!modalOpen) return;
    requestAnimationFrame(() => {
      const container = textareaContainerRef.current;
      if (!container) return;
      container.querySelectorAll("textarea").forEach((ta) => {
        if (ta.value) autoExpand(ta);
      });
    });
  }, [modalTab, modalOpen]);

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

  const connectionName = (id: string) => {
    if (!id) return "No connection";
    const conn = connections[id];
    return conn?.name ?? id;
  };

  /** LLM-capable connections (conversation or tool_use) */
  const llmConnections = Object.entries(connections).filter(([, c]) =>
    c.capabilities?.some((cap) => cap === "conversation" || cap === "tool_use")
  );

  const handleTemplateChange = async (templateId: string) => {
    if (!templateId) {
      setForm((prev) => ({ ...prev, agent_template: "", prompt_override: "", enabled_tools: [] }));
      return;
    }
    const prompt = await getDefaultPrompt(templateId);
    const tools = toolDefaults[templateId] || [];
    setForm((prev) => ({ ...prev, agent_template: templateId, prompt_override: prompt, enabled_tools: [...tools] }));
  };

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload the image as avatar
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

    // Issue #18: Auto-detect character card data in PNG uploads
    if (file.name.toLowerCase().endsWith(".png")) {
      try {
        const { parseCharacterCardPNG } = await import(
          "../card/character-card-parser"
        );
        const card = await parseCharacterCardPNG(file);
        if (card && (card.name || card.description || card.personality)) {
          // Store detected data and show confirmation
          setPendingCcData({
            name: card.name || "",
            description: card.description || "",
            personality: card.personality || "",
            scenario: card.scenario || "",
            first_mes: card.first_mes || "",
            mes_example: card.mes_example || "",
            system_prompt: card.system_prompt || "",
            post_history_instructions: card.post_history_instructions || "",
          });
          setCcDetected(true);
        }
      } catch {
        // Not a character card PNG, that's fine
      }
    }
  };

  const handleAcceptCharacterCard = () => {
    if (!pendingCcData) return;
    setForm((f) => ({
      ...f,
      personality_enabled: true,
      personality_name: pendingCcData.name || f.personality_name,
      personality_description: pendingCcData.description || f.personality_description,
      personality_personality: pendingCcData.personality || f.personality_personality,
      personality_scenario: pendingCcData.scenario || f.personality_scenario,
      personality_first_mes: pendingCcData.first_mes || f.personality_first_mes,
      personality_mes_example: pendingCcData.mes_example || f.personality_mes_example,
      personality_system_prompt: pendingCcData.system_prompt || f.personality_system_prompt,
      personality_post_history: pendingCcData.post_history_instructions || f.personality_post_history,
      name: f.name || pendingCcData.name || f.name,
    }));
    setCcDetected(false);
    setPendingCcData(null);
  };

  const handleDeclineCharacterCard = () => {
    setCcDetected(false);
    setPendingCcData(null);
  };

  /** Render an auto-expanding textarea with label + description */
  const renderTextarea = (
    label: string,
    description: string,
    formKey: keyof FormData,
    minRows: number = 4
  ) => (
    <div className="w-full">
      <div className="text-sm font-medium mb-0.5">{label}</div>
      <div className="text-xs text-base-content/40 mb-1.5">{description}</div>
      <textarea
        className="textarea textarea-bordered w-full text-sm leading-relaxed"
        style={{ minHeight: `${minRows * 1.75}rem` }}
        value={form[formKey] as string}
        onInput={(e) => autoExpand(e.currentTarget)}
        onChange={(e) => setForm({ ...form, [formKey]: e.target.value })}
      />
    </div>
  );

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
              Create reusable agent profiles for chat and group chat cards
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
                        {connectionName(p.connection_id)}
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

      {/* Create/Edit Modal — #13: wider (max-w-3xl) */}
      {modalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-lg mb-3">
              {editingId ? "Edit Profile" : "New Profile"}
            </h3>

            {/* Modal tabs — #19: added Memory tab */}
            <div className="tabs tabs-bordered mb-4">
              {(
                [
                  ["general", "General"],
                  ["personality", "Personality"],
                  ["voice", "Voice"],
                  ["memory", "Memory"],
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

            <div
              className="flex-1 overflow-y-auto space-y-4 pr-1"
              ref={textareaContainerRef}
            >
              {/* ═══════ General tab — #14, #17 ═══════ */}
              {modalTab === "general" && (
                <>
                  {/* Name */}
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Name</span>
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
                    <div className="label pt-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Display name for this agent profile
                      </span>
                    </div>
                  </div>

                  {/* Connection — #14: replaced agent dropdown with connection dropdown */}
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Connection</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={form.connection_id}
                      onChange={(e) =>
                        setForm({ ...form, connection_id: e.target.value, model_override: "" })
                      }
                    >
                      <option value="">Select a connection...</option>
                      {llmConnections.map(([id, c]) => (
                        <option key={id} value={id}>
                          {c.name}{c.model ? ` (${c.model})` : ""}
                        </option>
                      ))}
                    </select>
                    <div className="label pt-0.5">
                      <span className="label-text-alt text-base-content/40">
                        LLM connection this profile uses for responses
                      </span>
                    </div>
                  </div>

                  {/* Agent Template */}
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Agent Template</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={form.agent_template}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                    >
                      <option value="">Custom</option>
                      {agentTemplates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <div className="label pt-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Pre-fill prompt and tools from a built-in agent, or choose Custom to start blank
                      </span>
                    </div>
                  </div>

                  {/* Model Override */}
                  {form.connection_id && connModels.length > 0 && (
                    <div className="form-control">
                      <div className="label">
                        <span className="label-text font-medium">Model</span>
                      </div>
                      <select
                        className="select select-bordered select-sm"
                        value={form.model_override}
                        onChange={(e) =>
                          setForm({ ...form, model_override: e.target.value })
                        }
                      >
                        <option value="">Connection default</option>
                        {connModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <div className="label pt-0.5">
                        <span className="label-text-alt text-base-content/40">
                          Override the connection's default model for this profile
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tool Access */}
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">
                        Tool Access
                        {form.enabled_tools.length > 0 && (
                          <span className="badge badge-xs badge-primary ml-2">
                            {form.enabled_tools.length}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="border border-base-300 rounded-lg p-2 max-h-48 overflow-y-auto space-y-0.5">
                      {profileTools.length === 0 ? (
                        <p className="text-xs text-base-content/50 py-2 text-center">
                          Loading tools...
                        </p>
                      ) : (
                        <>
                          {profileTools
                            .filter((t) => t.category === "builtin")
                            .map((tool) => (
                              <label
                                key={tool.name}
                                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-base-200 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-xs checkbox-primary"
                                  checked={form.enabled_tools.includes(tool.name)}
                                  onChange={() => {
                                    const cur = form.enabled_tools;
                                    setForm({
                                      ...form,
                                      enabled_tools: cur.includes(tool.name)
                                        ? cur.filter((t) => t !== tool.name)
                                        : [...cur, tool.name],
                                    });
                                  }}
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-medium">{tool.name}</span>
                                  {tool.description && (
                                    <p className="text-[10px] text-base-content/40 truncate">
                                      {tool.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            ))}
                          {profileTools.filter((t) => t.category === "mcp").length > 0 && (
                            <>
                              <div className="divider my-1 text-[10px]">MCP</div>
                              {profileTools
                                .filter((t) => t.category === "mcp")
                                .map((tool) => (
                                  <label
                                    key={tool.name}
                                    className="flex items-center gap-2 py-1 px-1 rounded hover:bg-base-200 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-xs checkbox-primary"
                                      checked={form.enabled_tools.includes(tool.name)}
                                      onChange={() => {
                                        const cur = form.enabled_tools;
                                        setForm({
                                          ...form,
                                          enabled_tools: cur.includes(tool.name)
                                            ? cur.filter((t) => t !== tool.name)
                                            : [...cur, tool.name],
                                        });
                                      }}
                                    />
                                    <div className="min-w-0">
                                      <span className="text-xs font-medium">{tool.name}</span>
                                      {tool.server_name && (
                                        <span className="badge badge-ghost ml-1" style={{ fontSize: "9px", padding: "0 4px", height: "14px" }}>
                                          {tool.server_name}
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div className="label pt-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Toggle which tools this profile can use
                      </span>
                    </div>
                  </div>

                  {/* Avatar — #17: "Select Profile Photo" label */}
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">
                        Select Profile Photo
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {form.avatar ? (
                        <img
                          src={form.avatar}
                          alt="avatar"
                          className="w-14 h-14 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-base-300 flex items-center justify-center shrink-0">
                          <FontAwesomeIcon
                            icon={faAddressCard}
                            className="text-base-content/30"
                          />
                        </div>
                      )}
                      <input
                        type="file"
                        className="file-input file-input-bordered file-input-sm flex-1"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                    <div className="label pt-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Upload a portrait image. PNG files with embedded character card data will be auto-detected.
                      </span>
                    </div>
                  </div>

                  {/* Prompt Override — #15: bigger, #16: description, #17: layout */}
                  <div className="form-control">
                    <div className="label">
                      <span className="label-text font-medium">Prompt Override</span>
                    </div>
                    <textarea
                      className="textarea textarea-bordered text-sm leading-relaxed"
                      style={{ minHeight: "7rem" }}
                      value={form.prompt_override}
                      onInput={(e) => autoExpand(e.currentTarget)}
                      onChange={(e) =>
                        setForm({ ...form, prompt_override: e.target.value })
                      }
                      placeholder="Additional instructions for this profile..."
                    />
                    <div className="label pt-0.5">
                      <span className="label-text-alt text-base-content/40">
                        Custom system prompt to instruct this agent on its basic
                        functions. Replaces the default agent prompt when set.
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ═══════ Personality tab — #15, #16 ═══════ */}
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
                    <div>
                      <span className="label-text font-medium">
                        Enable Character Personality
                      </span>
                      <p className="text-xs text-base-content/40 mt-0.5">
                        Adds SillyTavern-compatible character fields on top of
                        the system prompt
                      </p>
                    </div>
                  </label>

                  {form.personality_enabled && (
                    <>
                      {/* Character card PNG import */}
                      <div className="form-control">
                        <div className="label">
                          <span className="label-text font-medium">
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
                                  personality_description:
                                    card.description || f.personality_description,
                                  personality_personality:
                                    card.personality || f.personality_personality,
                                  personality_scenario:
                                    card.scenario || f.personality_scenario,
                                  personality_first_mes:
                                    card.first_mes || f.personality_first_mes,
                                  personality_mes_example:
                                    card.mes_example || f.personality_mes_example,
                                  personality_system_prompt:
                                    card.system_prompt || f.personality_system_prompt,
                                  personality_post_history:
                                    card.post_history_instructions ||
                                    f.personality_post_history,
                                  name: f.name || card.name || f.name,
                                }));
                              }
                            } catch (err) {
                              console.error("Failed to parse character card:", err);
                            }
                            // Also upload as avatar
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = (reader.result as string).split(
                                ","
                              )[1];
                              try {
                                const result = await callWS<{ url: string }>(
                                  "proxlab/card/avatar/upload",
                                  { data: base64, filename: file.name }
                                );
                                setForm((f) => ({ ...f, avatar: result.url }));
                              } catch {
                                // Avatar upload failed silently
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        <div className="label pt-0.5">
                          <span className="label-text-alt text-base-content/40">
                            Loading a new character card will overwrite existing
                            personality fields below
                          </span>
                        </div>
                      </div>

                      {/* Character Name */}
                      <div className="form-control">
                        <div className="label">
                          <span className="label-text font-medium">
                            Character Name
                          </span>
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
                        <div className="label pt-0.5">
                          <span className="label-text-alt text-base-content/40">
                            The character's display name used in conversation
                          </span>
                        </div>
                      </div>

                      {/* #15: doubled textarea heights, #16: descriptions */}
                      {renderTextarea(
                        "Description",
                        "Physical appearance, background, and key traits of the character",
                        "personality_description",
                        5
                      )}

                      {renderTextarea(
                        "Personality",
                        "Behavioral traits, mannerisms, speech patterns, and temperament",
                        "personality_personality",
                        5
                      )}

                      {renderTextarea(
                        "Scenario",
                        "The setting and situation for the conversation (location, time, circumstances)",
                        "personality_scenario",
                        4
                      )}

                      {renderTextarea(
                        "System Prompt",
                        "Core instructions that define how the character behaves and responds",
                        "personality_system_prompt",
                        5
                      )}

                      {renderTextarea(
                        "First Message",
                        "The opening message the character sends to start a new conversation",
                        "personality_first_mes",
                        4
                      )}

                      {renderTextarea(
                        "Example Messages",
                        "Sample dialogue exchanges showing the character's voice and style",
                        "personality_mes_example",
                        4
                      )}

                      {renderTextarea(
                        "Post-History Instructions",
                        "Additional instructions appended after conversation history (jailbreak/author's note)",
                        "personality_post_history",
                        4
                      )}
                    </>
                  )}
                </>
              )}

              {/* ═══════ Voice tab — #13: fixed alignment ═══════ */}
              {modalTab === "voice" && (
                <>
                  <p className="text-sm text-base-content/50 mb-2">
                    Assign different TTS voices for different types of text in
                    the agent's responses.
                  </p>

                  {(
                    [
                      [
                        "tts_normal",
                        "Normal Voice",
                        "Default voice for regular response text",
                      ],
                      [
                        "tts_narration",
                        "Narration Voice",
                        "Voice used for narration text (asterisk-wrapped *text*)",
                      ],
                      [
                        "tts_speech",
                        "Speech Voice",
                        'Voice used for quoted speech ("dialogue")',
                      ],
                      [
                        "tts_thoughts",
                        "Thoughts Voice",
                        "Voice used for internal thoughts",
                      ],
                    ] as const
                  ).map(([key, label, desc]) => (
                    <div key={key} className="form-control">
                      <div className="label">
                        <span className="label-text font-medium">{label}</span>
                      </div>
                      <select
                        className="select select-bordered select-sm w-full"
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
                      <div className="label pt-0.5">
                        <span className="label-text-alt text-base-content/40">
                          {desc}
                        </span>
                      </div>
                    </div>
                  ))}

                </>
              )}

              {/* ═══════ Memory tab — #19 ═══════ */}
              {modalTab === "memory" && (
                <>
                  <p className="text-sm text-base-content/50 mb-3">
                    Configure persistent memory for this agent profile.
                  </p>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-base-200/50">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm mt-0.5"
                      checked={form.per_card_memory}
                      onChange={(e) =>
                        setForm({ ...form, per_card_memory: e.target.checked })
                      }
                    />
                    <div>
                      <span className="label-text font-medium">
                        Per-Profile Memory
                      </span>
                      <p className="text-xs text-base-content/40 mt-1">
                        Gives this agent profile its own RAG collection,
                        allowing persistent memory between conversations.
                        Memories are extracted and embedded by the memory agent.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-base-200/50">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm mt-0.5"
                      checked={form.memory_universal_access}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          memory_universal_access: e.target.checked,
                        })
                      }
                    />
                    <div>
                      <span className="label-text font-medium">
                        Universal Memory Access
                      </span>
                      <p className="text-xs text-base-content/40 mt-1">
                        Allow this agent to access memories from all users,
                        regardless of which user is currently chatting. When
                        disabled, the agent only sees memories from the current
                        user's conversations.
                      </p>
                    </div>
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

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Profile"
        message="Are you sure you want to delete this profile? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Character card auto-detection confirmation — #18 */}
      <ConfirmDialog
        open={ccDetected}
        title="Character Card Detected"
        message={`The uploaded image contains embedded character card data${
          pendingCcData?.name ? ` for "${pendingCcData.name}"` : ""
        }. Would you like to import the character data and enable the personality?`}
        confirmLabel="Import"
        confirmVariant="primary"
        onConfirm={handleAcceptCharacterCard}
        onCancel={handleDeclineCharacterCard}
      />
    </>
  );
}

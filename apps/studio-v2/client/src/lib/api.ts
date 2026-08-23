import type {
  Draft,
  Folder,
  GeneratedIdea,
  Idea,
  Material,
  MaterialKind,
  MaterialLength,
  MaterialStatus,
  Overview,
  SortKey,
} from "@shared/types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте интернет.", 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(payload?.error ?? "Что-то пошло не так.", response.status);
  }
  return payload as T;
}

export const api = {
  session: () => request<{ authorized: boolean; configured: boolean }>("/session"),

  login: (passphrase: string) =>
    request<{ authorized: boolean }>("/session", {
      method: "POST",
      body: JSON.stringify({ passphrase }),
    }),

  logout: () => request<{ authorized: boolean }>("/session", { method: "DELETE" }),

  overview: () => request<Overview>("/overview"),

  ideas: (params: {
    folderId: number | "all" | "none";
    sort: SortKey;
    search: string;
    favoritesOnly?: boolean;
  }) => {
    const query = new URLSearchParams({
      folderId: String(params.folderId),
      sort: params.sort,
      search: params.search,
    });
    if (params.favoritesOnly) query.set("favoritesOnly", "true");
    return request<{ ideas: Idea[] }>(`/ideas?${query.toString()}`);
  },

  updateIdea: (id: number, data: Partial<Idea>) =>
    request<{ ok: true }>(`/ideas/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteIdea: (id: number) => request<{ ok: true }>(`/ideas/${id}`, { method: "DELETE" }),

  createFolder: (name: string, color: string) =>
    request<{ id: number }>("/folders", { method: "POST", body: JSON.stringify({ name, color }) }),

  updateFolder: (id: number, data: Partial<Pick<Folder, "name" | "color">>) =>
    request<{ ok: true }>(`/folders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteFolder: (id: number) => request<{ ok: true }>(`/folders/${id}`, { method: "DELETE" }),

  generate: (body: {
    segmentCode: string;
    channel: string;
    count: number;
    focus: string;
    folderId: number | null;
  }) =>
    request<{ draftId: number; ideas: GeneratedIdea[] }>("/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  saveDraft: (draftId: number, indexes: number[], folderId: number | null) =>
    request<{ saved: number; folderId: number | null }>("/drafts/save", {
      method: "POST",
      body: JSON.stringify({ draftId, indexes, folderId }),
    }),

  discardDraft: (draftId: number) =>
    request<{ ok: true }>(`/drafts/${draftId}`, { method: "DELETE" }),

  materials: (params: {
    kind: MaterialKind | "all";
    status: MaterialStatus | "all";
    search: string;
    favoritesOnly?: boolean;
  }) => {
    const query = new URLSearchParams({
      kind: params.kind,
      status: params.status,
      search: params.search,
    });
    if (params.favoritesOnly) query.set("favoritesOnly", "true");
    return request<Material[]>(`/materials?${query.toString()}`);
  },

  material: (id: number) => request<Material>(`/materials/${id}`),

  generateMaterial: (body: {
    kind: MaterialKind;
    ideaId: number | null;
    topic: string;
    segmentCode: string;
    length: MaterialLength;
    goal: string;
  }) => request<Material>("/materials/generate", { method: "POST", body: JSON.stringify(body) }),

  updateMaterial: (id: number, data: Partial<Material>) =>
    request<{ ok: true }>(`/materials/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteMaterial: (id: number) =>
    request<{ ok: true }>(`/materials/${id}`, { method: "DELETE" }),

  exportAll: () => request<Record<string, unknown>>("/export"),

  importAll: (payload: unknown) =>
    request<{ addedFolders: number; addedIdeas: number; skipped: number }>("/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type { Draft, Folder, Idea, Material, Overview };

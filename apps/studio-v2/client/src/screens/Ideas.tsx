import { useEffect, useMemo, useState } from "react";
import type { Folder, Idea, SortKey } from "@shared/types";
import { sortLabels } from "@shared/seed";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { IdeaCard, ideaToText } from "../components/IdeaCard";
import { EmptyState, SkeletonList, Toast } from "../components/ui";
import { IconBulb, IconSearch, IconSort } from "../components/icons";

const SORT_CYCLE: SortKey[] = ["new", "old", "priority", "alpha"];

export function Ideas({
  folders,
  favoritesOnly,
  onEdit,
  onChanged,
}: {
  folders: Folder[];
  favoritesOnly: boolean;
  onEdit: (idea: Idea) => void;
  onChanged: () => void;
}) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [folderId, setFolderId] = useState<number | "all" | "none">("all");
  const [sort, setSort] = useState<SortKey>("new");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  useEffect(() => {
    let cancelled = false;
    // Debounced so typing in search does not fire a request per keystroke.
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.ideas({ folderId, sort, search, favoritesOnly });
        if (!cancelled) setIdeas(result.ideas);
      } catch (cause) {
        if (!cancelled) {
          setIdeas([]);
          setNotice({
            kind: "error",
            text: cause instanceof ApiError ? cause.message : "Не удалось загрузить идеи.",
          });
        }
      }
    }, search ? 220 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [folderId, sort, search, favoritesOnly]);

  const reload = () => {
    setIdeas(null);
    setSearch((value) => value);
    onChanged();
    void api.ideas({ folderId, sort, search, favoritesOnly }).then((result) => setIdeas(result.ideas));
  };

  const toggleFavorite = async (idea: Idea) => {
    setIdeas((current) =>
      current?.map((item) =>
        item.id === idea.id ? { ...item, isFavorite: !item.isFavorite } : item,
      ) ?? null,
    );
    try {
      await api.updateIdea(idea.id, { isFavorite: !idea.isFavorite });
      onChanged();
    } catch {
      reload();
    }
  };

  const remove = async (idea: Idea) => {
    setIdeas((current) => current?.filter((item) => item.id !== idea.id) ?? null);
    triggerHaptic("warning");
    try {
      await api.deleteIdea(idea.id);
      setNotice({ kind: "ok", text: "Идея в корзине — вернуть можно 30 дней." });
      onChanged();
    } catch {
      reload();
    }
  };

  const copy = async (idea: Idea) => {
    try {
      await navigator.clipboard.writeText(ideaToText(idea));
      triggerHaptic("success");
      setNotice({ kind: "ok", text: "Скопировано." });
    } catch {
      setNotice({ kind: "error", text: "Браузер не дал доступ к буферу обмена." });
    }
  };

  const cycleSort = () => {
    const next = SORT_CYCLE[(SORT_CYCLE.indexOf(sort) + 1) % SORT_CYCLE.length] ?? "new";
    triggerHaptic("navigation");
    setSort(next);
  };

  const unfiled = folders.reduce((total, folder) => total + folder.count, 0);

  return (
    <>
      {!favoritesOnly ? (
        <div className="chips" role="group" aria-label="Фильтр по папкам">
          <button
            className="chip"
            aria-pressed={folderId === "all"}
            onClick={() => setFolderId("all")}
          >
            Все
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              className="chip"
              aria-pressed={folderId === folder.id}
              onClick={() => setFolderId(folder.id)}
            >
              <span className="dot" style={{ background: folder.color }} />
              {folder.name}
              <span className="count">{folder.count}</span>
            </button>
          ))}
          <button
            className="chip"
            aria-pressed={folderId === "none"}
            onClick={() => setFolderId("none")}
          >
            Без папки
          </button>
        </div>
      ) : null}

      <div className="searchrow">
        <div className="search">
          <IconSearch />
          <input
            type="search"
            placeholder="Поиск по темам"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Поиск по темам"
          />
        </div>
        <button className="sortbtn" onClick={cycleSort} aria-label={`Сортировка: ${sortLabels[sort]}`}>
          <IconSort />
          {sortLabels[sort]}
        </button>
      </div>

      {notice ? <Toast kind={notice.kind}>{notice.text}</Toast> : null}

      {ideas === null ? (
        <SkeletonList />
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={<IconBulb size={24} />}
          title={favoritesOnly ? "Избранное пустое" : search ? "Ничего не нашлось" : "Банк тем пуст"}
          text={
            favoritesOnly
              ? "Отмечай сердечком идеи, к которым захочешь вернуться."
              : search
                ? "Попробуй другое слово или сбрось фильтр по папке."
                : unfiled === 0
                  ? "Сгенерируй первую партию идей — они сразу лягут в выбранную папку."
                  : "В этой папке пока пусто."
          }
          // No action here: the docked button below already offers it.
        />
      ) : (
        ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            folder={idea.folderId === null ? undefined : folderById.get(idea.folderId)}
            onFavorite={toggleFavorite}
            onEdit={onEdit}
            onDelete={remove}
            onCopy={copy}
          />
        ))
      )}
    </>
  );
}

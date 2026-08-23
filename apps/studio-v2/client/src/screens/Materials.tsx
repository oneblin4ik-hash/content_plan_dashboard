import { useEffect, useState } from "react";
import type { Material, MaterialKind, MaterialStatus } from "@shared/types";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { MaterialCard, materialToText } from "../components/MaterialCard";
import { EmptyState, SkeletonList, Toast } from "../components/ui";
import { IconLayers, IconSearch } from "../components/icons";

const KINDS: Array<{ value: MaterialKind | "all"; label: string }> = [
  { value: "all", label: "Все" },
  { value: "reel", label: "Сценарии" },
  { value: "post", label: "Посты" },
];

const STATUSES: Array<{ value: MaterialStatus | "all"; label: string }> = [
  { value: "all", label: "Любой" },
  { value: "draft", label: "Черновик" },
  { value: "ready", label: "Готов" },
  { value: "published", label: "Опубликован" },
];

export function Materials({
  onOpen,
  onChanged,
}: {
  onOpen: (material: Material) => void;
  onChanged: () => void;
}) {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [kind, setKind] = useState<MaterialKind | "all">("all");
  const [status, setStatus] = useState<MaterialStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Same debounce as the idea list: typing must not fire a request a letter.
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.materials({ kind, status, search });
        if (!cancelled) setMaterials(result);
      } catch (cause) {
        if (!cancelled) {
          setMaterials([]);
          setNotice({
            kind: "error",
            text: cause instanceof ApiError ? cause.message : "Не удалось загрузить материалы.",
          });
        }
      }
    }, search ? 220 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, status, search]);

  const reload = () => {
    setMaterials(null);
    onChanged();
    void api.materials({ kind, status, search }).then(setMaterials);
  };

  const toggleFavorite = async (material: Material) => {
    setMaterials((current) =>
      current?.map((item) =>
        item.id === material.id ? { ...item, isFavorite: !item.isFavorite } : item,
      ) ?? null,
    );
    try {
      await api.updateMaterial(material.id, { isFavorite: !material.isFavorite });
    } catch {
      reload();
    }
  };

  const remove = async (material: Material) => {
    setMaterials((current) => current?.filter((item) => item.id !== material.id) ?? null);
    triggerHaptic("warning");
    try {
      await api.deleteMaterial(material.id);
      setNotice({ kind: "ok", text: "Материал в корзине — вернуть можно 30 дней." });
      onChanged();
    } catch {
      reload();
    }
  };

  const copy = async (material: Material) => {
    try {
      await navigator.clipboard.writeText(materialToText(material));
      triggerHaptic("success");
      setNotice({ kind: "ok", text: "Скопировано целиком." });
    } catch {
      setNotice({ kind: "error", text: "Браузер не дал доступ к буферу обмена." });
    }
  };

  return (
    <>
      <div className="chips" role="group" aria-label="Фильтр по виду">
        {KINDS.map((option) => (
          <button
            key={option.value}
            className="chip"
            aria-pressed={kind === option.value}
            onClick={() => setKind(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Фильтр по статусу">
        {STATUSES.map((option) => (
          <button
            key={option.value}
            className="chip"
            aria-pressed={status === option.value}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="searchrow">
        <div className="search">
          <IconSearch />
          <input
            type="search"
            placeholder="Поиск по материалам"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Поиск по материалам"
          />
        </div>
      </div>

      {notice ? <Toast kind={notice.kind}>{notice.text}</Toast> : null}

      {materials === null ? (
        <SkeletonList />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={<IconLayers size={24} />}
          title={search ? "Ничего не нашлось" : "Материалов пока нет"}
          text={
            search
              ? "Попробуй другое слово или сбрось фильтры."
              : "Открой идею и нажми «Сделать материал» — она превратится в сценарий или пост."
          }
        />
      ) : (
        materials.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            onFavorite={toggleFavorite}
            onOpen={onOpen}
            onDelete={remove}
            onCopy={copy}
          />
        ))
      )}
    </>
  );
}

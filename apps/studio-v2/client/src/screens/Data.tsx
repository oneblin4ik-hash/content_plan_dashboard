import { useEffect, useRef, useState } from "react";
import type { Overview } from "@shared/types";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, Toast } from "../components/ui";
import { IconDownload, IconFilm, IconMessage, IconUpload } from "../components/icons";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Data({
  overview,
  onChanged,
  onLogout,
}: {
  overview: Overview;
  onChanged: () => void;
  onLogout: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [bin, setBin] = useState<Awaited<ReturnType<typeof api.bin>> | null>(null);
  const [binOpen, setBinOpen] = useState(false);

  useEffect(() => {
    if (!binOpen) return;
    let cancelled = false;
    void api.bin().then((result) => {
      if (!cancelled) setBin(result);
    });
    return () => {
      cancelled = true;
    };
  }, [binOpen, overview.totals.bin]);

  const restore = async (kind: "idea" | "material", id: number, title: string) => {
    try {
      if (kind === "idea") await api.restoreIdea(id);
      else await api.restoreMaterial(id);
      triggerHaptic("success");
      setBin((current) =>
        current === null
          ? null
          : kind === "idea"
            ? { ...current, ideas: current.ideas.filter((item) => item.id !== id) }
            : { ...current, materials: current.materials.filter((item) => item.id !== id) },
      );
      setNotice({ kind: "ok", text: `«${title}» вернулась на место.` });
      onChanged();
    } catch (cause) {
      setNotice({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Не удалось восстановить.",
      });
    }
  };

  const exportAll = async () => {
    setBusy("export");
    setNotice(null);
    try {
      const payload = await api.exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `studio-${todayStamp()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      triggerHaptic("success");
      setNotice({ kind: "ok", text: "Файл выгружен. Сохрани его в «Файлы» на телефоне." });
    } catch (cause) {
      setNotice({
        kind: "error",
        text: cause instanceof ApiError ? cause.message : "Не удалось выгрузить данные.",
      });
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (file: File) => {
    setBusy("import");
    setNotice(null);
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const result = await api.importAll(payload);
      triggerHaptic("success");
      setNotice({
        kind: "ok",
        text: `Добавлено идей: ${result.addedIdeas}, материалов: ${result.addedMaterials}, папок: ${result.addedFolders}. Пропущено дублей: ${result.skipped}.`,
      });
      onChanged();
    } catch (cause) {
      triggerHaptic("warning");
      setNotice({
        kind: "error",
        text:
          cause instanceof ApiError
            ? cause.message
            : "Файл не читается. Нужен JSON, выгруженный этой же студией.",
      });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      {notice ? <Toast kind={notice.kind}>{notice.text}</Toast> : null}

      <div className="glass card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(180deg,rgba(255,82,90,.3),rgba(180,21,28,.18))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.26)",
              color: "#FF8B84",
              flex: "none",
            }}
          >
            <IconDownload />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ font: "800 13.5px/1.2 var(--body)", letterSpacing: "-0.35px" }}>
              Выгрузить всё в файл
            </div>
            <div style={{ font: "500 11.5px/1.4 var(--body)", color: "var(--g-3)", marginTop: 3 }}>
              {overview.totals.all} идей, {overview.folders.length} папок
            </div>
          </div>
        </div>
        <Button variant="ghost" full loading={busy === "export"} onClick={exportAll}>
          studio-{todayStamp()}.json
        </Button>
      </div>

      <div className="glass card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(180deg,rgba(76,175,80,.28),rgba(76,175,80,.12))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.22)",
              color: "#7BD98A",
              flex: "none",
            }}
          >
            <IconUpload />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ font: "800 13.5px/1.2 var(--body)", letterSpacing: "-0.35px" }}>
              Загрузить из файла
            </div>
            <div style={{ font: "500 11.5px/1.4 var(--body)", color: "var(--g-3)", marginTop: 3 }}>
              Добавит новое, ничего не затрёт
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <Button
          variant="ghost"
          full
          loading={busy === "import"}
          onClick={() => fileRef.current?.click()}
        >
          Выбрать файл
        </Button>
      </div>

      <div className="glass card tight">
        <div className="label">Генератор</div>
        <Row label="Сегодня" value={`${overview.usage.used} из ${overview.usage.limit}`} />
        <Row label="В избранном" value={String(overview.totals.favorites)} />
      </div>

      {/*
        The delete toast promises a return within 30 days. Until this list
        existed that promise had nowhere to land: the API could restore, but
        nothing in the app ever called it.
      */}
      <div className="glass card tight">
        <div className="label">Корзина · хранится 30 дней</div>
        <Row label="Внутри" value={String(overview.totals.bin)} />
        {overview.totals.bin > 0 ? (
          <Button variant="ghost" full onClick={() => setBinOpen((open) => !open)}>
            {binOpen ? "Свернуть" : "Показать и вернуть"}
          </Button>
        ) : null}

        {binOpen && bin !== null
          ? [
              ...bin.ideas.map((item) => ({ ...item, kind: "idea" as const })),
              ...bin.materials.map((item) => ({ ...item, kind: "material" as const, sub: item.kind })),
            ]
              .sort((a, b) => b.deletedAt - a.deletedAt)
              .map((item) => (
                <div className="bin-row" key={`${item.kind}-${item.id}`}>
                  <span className="bin-ic">
                    {item.kind === "material" ? (
                      "sub" in item && item.sub === "reel" ? (
                        <IconFilm size={14} />
                      ) : (
                        <IconMessage size={14} />
                      )
                    ) : null}
                  </span>
                  <span className="bin-title">{item.title}</span>
                  <button
                    className="bin-back"
                    onClick={() => void restore(item.kind, item.id, item.title)}
                  >
                    Вернуть
                  </button>
                </div>
              ))
          : null}
      </div>

      <div className="glass card tight">
        <div className="label">Доступ</div>
        <Button variant="ghost" full onClick={onLogout}>
          Выйти на этом устройстве
        </Button>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ font: "600 13px/1 var(--body)", color: "var(--w-2)" }}>{label}</span>
      <span
        style={{
          font: "700 12.5px/1 var(--body)",
          color: "var(--g-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

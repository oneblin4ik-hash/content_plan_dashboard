import { useCallback, useEffect, useState } from "react";
import type { GeneratedIdea, Idea, Overview } from "@shared/types";
import { api } from "./lib/api";
import { installHaptics, triggerHaptic } from "./lib/haptics";
import { useParallaxField, useSwipeNavigation } from "./lib/motion";
import { Login } from "./screens/Login";
import { Ideas } from "./screens/Ideas";
import { Generator } from "./screens/Generator";
import { Results } from "./screens/Results";
import { Folders } from "./screens/Folders";
import { Data } from "./screens/Data";
import { IdeaEditor } from "./screens/IdeaEditor";
import { Toast } from "./components/ui";
import {
  IconBack,
  IconBulb,
  IconFolder,
  IconHeart,
  IconSettings,
  IconSpinner,
} from "./components/icons";

type Tab = "ideas" | "folders" | "favorites" | "data";
type Mode = { kind: "tabs" } | { kind: "generate" } | { kind: "results"; draftId: number; ideas: GeneratedIdea[]; folderId: number | null };

const TABS: Array<{ id: Tab; label: string; icon: typeof IconBulb }> = [
  { id: "ideas", label: "Идеи", icon: IconBulb },
  { id: "folders", label: "Папки", icon: IconFolder },
  { id: "favorites", label: "Избранное", icon: IconHeart },
  { id: "data", label: "Данные", icon: IconSettings },
];

const TAB_TITLES: Record<Tab, { kicker: string; title: string }> = {
  ideas: { kicker: "Банк тем", title: "Идеи" },
  folders: { kicker: "Разбор банка", title: "Папки" },
  favorites: { kicker: "Отложено", title: "Избранное" },
  data: { kicker: "Настройки", title: "Данные" },
};

export default function App() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>("ideas");
  const [mode, setMode] = useState<Mode>({ kind: "tabs" });
  const [editing, setEditing] = useState<Idea | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useParallaxField();

  useEffect(() => installHaptics(), []);

  useEffect(() => {
    void api
      .session()
      .then((session) => {
        setAuthorized(session.authorized);
        setConfigured(session.configured);
      })
      .catch(() => setAuthorized(false));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.overview();
      setOverview(next);
      // A generation that was never saved is restored on the next open.
      if (next.draft) {
        setMode({
          kind: "results",
          draftId: next.draft.id,
          ideas: next.draft.ideas,
          folderId: next.draft.folderId,
        });
      }
    } catch {
      setAuthorized(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) void refresh();
  }, [authorized, refresh]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 4000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const swipe = useSwipeNavigation((direction) => {
    if (mode.kind !== "tabs") return;
    const index = TABS.findIndex((entry) => entry.id === tab);
    const next = Math.min(TABS.length - 1, Math.max(0, index + (direction === "left" ? 1 : -1)));
    const target = TABS[next];
    if (!target || target.id === tab) return;
    triggerHaptic("navigation");
    setTab(target.id);
  });

  if (authorized === null) {
    return (
      <>
        <Field />
        <div className="login">
          <IconSpinner size={26} />
        </div>
      </>
    );
  }

  if (!authorized) {
    return (
      <>
        <Field />
        {!configured ? (
          <div className="login">
            <h1>Студия ещё не настроена</h1>
            <p className="lede">
              На сервере не задана код-фраза. Добавьте секрет STUDIO_PASSPHRASE и обновите страницу.
            </p>
          </div>
        ) : (
          <Login onAuthorized={() => setAuthorized(true)} />
        )}
      </>
    );
  }

  if (!overview) {
    return (
      <>
        <Field />
        <div className="login">
          <IconSpinner size={26} />
        </div>
      </>
    );
  }

  const heading =
    mode.kind === "generate"
      ? { kicker: "Генератор", title: "Новые темы" }
      : mode.kind === "results"
        ? { kicker: "Проверь и сохрани", title: `${mode.ideas.length} свежих идей` }
        : TAB_TITLES[tab];

  const backToTabs = () => {
    triggerHaptic("navigation");
    setMode({ kind: "tabs" });
  };

  return (
    <>
      <Field />
      <div className="shell" {...swipe}>
        <header className="appbar">
          {mode.kind !== "tabs" ? (
            <button className="icon-btn" aria-label="Назад" onClick={backToTabs}>
              <IconBack />
            </button>
          ) : null}
          <div className="appbar-txt">
            <span className="kicker">{heading.kicker}</span>
            <h1>{heading.title}</h1>
          </div>
          {mode.kind === "tabs" && tab === "ideas" ? (
            <span className="pill-status">
              <i />
              {overview.totals.all} сохранено
            </span>
          ) : null}
          {mode.kind === "generate" ? (
            <span
              className={
                overview.usage.used >= overview.usage.limit ? "pill-status warn" : "pill-status"
              }
            >
              <i />
              {overview.usage.used} из {overview.usage.limit}
            </span>
          ) : null}
        </header>

        <main className="scroll">
          {flash ? <Toast kind="ok">{flash}</Toast> : null}

          {mode.kind === "generate" ? (
            <Generator
              folders={overview.folders}
              usage={overview.usage}
              onDraft={(draftId, ideas, folderId) => {
                setMode({ kind: "results", draftId, ideas, folderId });
                void refresh();
              }}
            />
          ) : mode.kind === "results" ? (
            <Results
              draftId={mode.draftId}
              ideas={mode.ideas}
              folders={overview.folders}
              folderId={mode.folderId}
              onSaved={(saved, folderName) => {
                setMode({ kind: "tabs" });
                setTab("ideas");
                setFlash(`Сохранено идей: ${saved} — в «${folderName}».`);
                void refresh();
              }}
              onDiscard={() => {
                void api.discardDraft(mode.draftId).then(refresh);
                setMode({ kind: "tabs" });
              }}
            />
          ) : tab === "ideas" || tab === "favorites" ? (
            <Ideas
              folders={overview.folders}
              favoritesOnly={tab === "favorites"}
              onEdit={setEditing}
              onChanged={() => void refresh()}
            />
          ) : tab === "folders" ? (
            <Folders
              folders={overview.folders}
              totals={overview.totals}
              onChanged={() => void refresh()}
            />
          ) : (
            <Data
              overview={overview}
              onChanged={() => void refresh()}
              onLogout={() => {
                void api.logout();
                setAuthorized(false);
              }}
            />
          )}
        </main>

        {mode.kind === "tabs" && (tab === "ideas" || tab === "favorites") ? (
          <div className="dock">
            <button
              className="btn btn-primary btn-full"
              onClick={() => {
                triggerHaptic("navigation");
                setMode({ kind: "generate" });
              }}
            >
              <i className="gloss" />
              <span className="btn-label">Сгенерировать идеи</span>
            </button>
          </div>
        ) : null}

        <nav className="bottomnav" aria-label="Основная навигация">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            const active = mode.kind === "tabs" && tab === entry.id;
            return (
              <button
                key={entry.id}
                className="nav-i"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  triggerHaptic("navigation");
                  setMode({ kind: "tabs" });
                  setTab(entry.id);
                }}
              >
                <span className="ic">
                  <Icon size={20} filled={active && entry.id === "favorites"} />
                </span>
                {entry.label}
              </button>
            );
          })}
        </nav>
      </div>

      {editing ? (
        <IdeaEditor
          idea={editing}
          folders={overview.folders}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setFlash("Идея обновлена.");
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}

/** Ambient glows and the kit's diagonal slash, driven by useParallaxField. */
function Field() {
  return (
    <div className="field" aria-hidden="true">
      <div className="slash" data-par="0.05" />
      <div className="glow glow-a" data-par="0.16" />
      <div className="glow glow-b" data-par="-0.11" />
      <div className="glow glow-c" data-par="0.08" />
    </div>
  );
}

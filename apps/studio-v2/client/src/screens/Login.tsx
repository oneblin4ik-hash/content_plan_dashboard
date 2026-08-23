import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api";
import { triggerHaptic } from "../lib/haptics";
import { Button, Toast } from "../components/ui";
import { IconStar } from "../components/icons";

export function Login({ onAuthorized }: { onAuthorized: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passphrase.trim() || busy) return;

    setBusy(true);
    setError(null);
    try {
      await api.login(passphrase);
      triggerHaptic("success");
      onAuthorized();
    } catch (cause) {
      triggerHaptic("warning");
      setError(cause instanceof ApiError ? cause.message : "Не удалось войти.");
      setPassphrase("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <div className="mark-lg">
        <IconStar size={30} />
      </div>
      <span className="kicker" style={{ marginTop: 6 }}>
        Content Studio
      </span>
      <h1>Только для тебя</h1>
      <p className="lede">Введи код-фразу — телефон запомнит её и больше спрашивать не будет.</p>

      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="passphrase">
          Код-фраза
        </label>
        <input
          id="passphrase"
          className="code-in"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          placeholder="••••••••"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          autoFocus
        />
        {error ? <Toast kind="error">{error}</Toast> : null}
        <Button type="submit" full loading={busy} disabled={!passphrase.trim()}>
          Войти
        </Button>
      </form>

      <p className="hint">
        Ссылка открыта в интернете, поэтому доступ закрыт фразой. Квота генераций тратится только
        тобой.
      </p>
    </main>
  );
}

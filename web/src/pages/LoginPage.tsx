import { type FormEvent, useState } from "react";
import { ApiError, logIn, saveSession } from "../api/client";
import type { UserAuth } from "../api/types";

export function LoginPage({ onSignedIn }: { onSignedIn: (auth: UserAuth) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const auth = await logIn(username.trim(), password);
      saveSession(auth);
      onSignedIn(auth);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand">
          <strong>Cloudy</strong>
          <span>Server library for Soul Searching</span>
        </div>
        <h1>Manage your music</h1>
        <label className="field">
          <span>Username</span>
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <p className="error">{error}</p>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

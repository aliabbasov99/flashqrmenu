import { useState } from "react";
import { api, setAuth, AUTH_PANEL } from "../lib/api";

const inputClass =
  "border border-[#cac2a7]/60 rounded-md px-3 py-2 bg-white text-[#3a513e] " +
  "focus:outline-none focus:border-[#3a513e] w-full";
const btnPrimary =
  "bg-[#3a513e] text-white rounded-md py-2 px-5 font-medium cursor-pointer text-sm";

export default function PanelLogin({ title = "Restoran paneli", onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username, password }
      });
      if (data.role !== "restaurant") {
        throw new Error("Bu giriş restoran paneli üçündür.");
      }
      const next = { token: data.token, role: data.role, restaurant: data.restaurant };
      setAuth(next, AUTH_PANEL);
      setPassword("");
      onSuccess?.(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-sm bg-white rounded-md shadow-sm p-6 flex flex-col gap-4"
    >
      <h1 className="text-xl font-extrabold">{title}</h1>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Giriş"
        className={inputClass}
        autoComplete="username"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Parol"
        className={inputClass}
        autoComplete="current-password"
      />
      <button type="submit" disabled={busy} className={btnPrimary}>
        {busy ? "..." : "Daxil ol"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

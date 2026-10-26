import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getAuth, setAuth, clearAuth, AUTH_SUPER } from "../lib/api";

const inputClass =
  "border border-[#cac2a7]/60 rounded-md px-3 py-2 bg-white text-[#3a513e] " +
  "focus:outline-none focus:border-[#3a513e] w-full";

const labelClass = "flex flex-col gap-1 text-sm";

function slugify(text) {
  const map = { ə: "e", ü: "u", ö: "o", ğ: "g", ş: "s", ç: "c", ı: "i", İ: "i" };
  return String(text || "")
    .toLowerCase()
    .replace(/[əüöğşıçİ]/g, (c) => map[c] || c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Admin() {
  const [session, setSession] = useState(() => getAuth(AUTH_SUPER));
  const [loading, setLoading] = useState(() => !!getAuth(AUTH_SUPER));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [restaurants, setRestaurants] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState(null);

  const [form, setForm] = useState({ name: "", slug: "", username: "", password: "" });
  const [status, setStatus] = useState({ type: "", text: "" });

  const token = session?.token;

  const loadRestaurants = async (tok = token) => {
    const data = await api("/super/restaurants", { token: tok });
    setRestaurants(data.restaurants || []);
  };

  useEffect(() => {
    if (!session) return;
    api("/super/restaurants", { token })
      .then((data) => setRestaurants(data.restaurants || []))
      .catch(() => {
        clearAuth(AUTH_SUPER);
        setSession(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username, password }
      });
      if (data.role !== "super") {
        throw new Error("Bu giriş restoran paneli üçündür. /panel səhifəsindən daxil olun.");
      }
      const next = { token: data.token, role: data.role };
      setAuth(next, AUTH_SUPER);
      setSession(next);
      setPassword("");
      await loadRestaurants(data.token);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });
    try {
      await api("/super/restaurants", { method: "POST", token, body: form });
      setForm({ name: "", slug: "", username: "", password: "" });
      setStatus({ type: "success", text: "Restoran yaradıldı ✅" });
      await loadRestaurants();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const openEdit = (r) => {
    setExpanded(r._id);
    setDraft({
      name: r.name,
      slug: r.slug,
      username: r.username,
      password: "",
      active: r.active,
      subscriptionUntil: r.subscriptionUntil || ""
    });
    setStatus({ type: "", text: "" });
  };

  const handleSave = async (id) => {
    setStatus({ type: "", text: "" });
    try {
      const body = { ...draft };
      if (!body.password) delete body.password;
      await api(`/super/restaurants/${id}`, { method: "PUT", token, body });
      setStatus({ type: "success", text: "Yadda saxlanıldı ✅" });
      setExpanded(null);
      setDraft(null);
      await loadRestaurants();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const handleDelete = async (r) => {
    if (!confirm(`"${r.name}" restoranı və bütün menyusu silinsin?`)) return;
    setStatus({ type: "", text: "" });
    try {
      await api(`/super/restaurants/${r._id}`, { method: "DELETE", token });
      setStatus({ type: "success", text: "Restoran silindi ✅" });
      await loadRestaurants();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  };

  const handleLogout = () => {
    clearAuth(AUTH_SUPER);
    setSession(null);
    setRestaurants([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#3a513e]">
        Yüklənir...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-[#3a513e] bg-[#f9f3e7]">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-3xl font-extrabold">QR Menyu</span>
          <span className="text-sm text-black/60">Super Admin girişi</span>
        </div>
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-md shadow-sm p-6 flex flex-col gap-4"
        >
          <h1 className="text-xl font-extrabold">Super Admin girişi</h1>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Login"
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
          <button
            type="submit"
            className="bg-[#3a513e] text-white rounded-md py-2 font-medium cursor-pointer"
          >
            Daxil ol
          </button>
          {status.text && (
            <p className={`text-sm ${status.type === "error" ? "text-red-600" : "text-[#3a513e]"}`}>
              {status.text}
            </p>
          )}
        </form>
        <div className="flex gap-4 text-sm">
          <Link to="/" className="underline">Ana səhifə</Link>
          <Link to="/panel" className="underline">Restoran paneli</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f3e7] text-[#3a513e] pb-16">
      <div className="container mx-auto py-4 px-4 max-w-3xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3a513e] text-white flex items-center justify-center font-bold shrink-0">
            A
          </div>
          <span className="text-lg font-extrabold">Super Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm underline cursor-pointer">Səhifə</Link>
          <button
            onClick={handleLogout}
            className="bg-[#3a513e] text-white text-sm rounded-md px-4 py-1.5 cursor-pointer"
          >
            Çıxış
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl flex flex-col gap-6">
        {/* Restoran əlavə et */}
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-md shadow-sm p-6 flex flex-col gap-4"
        >
          <h2 className="text-xl font-semibold">Yeni restoran</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className={labelClass}>
              <span>Restoran adı *</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: f.slug || slugify(e.target.value)
                  }))
                }
                placeholder="Məs: Jaguar Lounge"
                className={inputClass}
                required
              />
            </label>
            <label className={labelClass}>
              <span>URL ünvanı (slug)</span>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                placeholder="jaguar-lounge"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              <span>Panel girişi *</span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                placeholder="jaguar"
                className={inputClass}
                required
              />
            </label>
            <label className={labelClass}>
              <span>Panel parolu *</span>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••"
                className={inputClass}
                required
              />
            </label>
          </div>
          <button
            type="submit"
            className="bg-[#3a513e] text-white rounded-md py-2 font-medium cursor-pointer self-start px-6"
          >
            Əlavə et
          </button>
        </form>

        {/* Restoranlar */}
        <div className="bg-white rounded-md shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Restoranlar ({restaurants.length})</h2>

          {restaurants.length === 0 && (
            <p className="text-sm text-black/60">Hələlik restoran yoxdur.</p>
          )}

          {restaurants.map((r) => (
            <div key={r._id} className="border border-[#cac2a7]/40 rounded-md p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex flex-col">
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-xs text-black/50">
                    /r/{r.slug} · giriş: {r.username}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs rounded-md px-2 py-1 ${
                      r.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}
                  >
                    {r.active ? "Aktiv" : "Deaktiv"}
                  </span>
                  {r.subscriptionExpired ? (
                    <span className="text-xs rounded-md px-2 py-1 bg-red-100 text-red-600">
                      Abunelik bitib
                    </span>
                  ) : r.subscriptionUntil ? (
                    <span className="text-xs rounded-md px-2 py-1 bg-[#f9f3e7] text-[#3a513e] border border-[#cac2a7]/50">
                      Abunelik: {r.subscriptionUntil}
                    </span>
                  ) : null}
                  <Link
                    to={`/r/${r.slug}`}
                    className="text-sm underline cursor-pointer"
                    target="_blank"
                  >
                    Menyu
                  </Link>
                  <button
                    onClick={() => (expanded === r._id ? setExpanded(null) : openEdit(r))}
                    className="text-sm bg-[#f9f3e7] border border-[#cac2a7]/50 rounded-md px-3 py-1 cursor-pointer"
                  >
                    {expanded === r._id ? "Bağla" : "Redaktə"}
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="text-sm bg-red-600/90 text-white rounded-md px-3 py-1 cursor-pointer"
                  >
                    Sil
                  </button>
                </div>
              </div>

              {expanded === r._id && draft && (
                <div className="grid sm:grid-cols-2 gap-4 bg-[#f9f3e7] rounded-sm p-4">
                  <label className={labelClass}>
                    <span>Ad</span>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    <span>URL (slug)</span>
                    <input
                      value={draft.slug}
                      onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    <span>Panel girişi</span>
                    <input
                      value={draft.username}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, username: e.target.value.toLowerCase() }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    <span>Yeni parol (boşdursa dəyişmə)</span>
                    <input
                      type="text"
                      value={draft.password}
                      onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
                      className={inputClass}
                      placeholder="••••••"
                    />
                  </label>
                  <label className={labelClass}>
                    <span>Abunelik bitmə tarixi</span>
                    <input
                      type="date"
                      value={draft.subscriptionUntil}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, subscriptionUntil: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <span className="text-xs text-black/50">
                      Bu tarixə qədər menyu açıq olacaq. Boş = limitsiz.
                    </span>
                  </label>

                  <div className="flex items-center justify-between bg-white rounded-md px-4 py-3 sm:col-span-2">
                    <span className="text-sm font-medium">
                      {draft.active ? "Restoran aktivdir (menyu açıqdır)" : "Restoran deaktivdir"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, active: !d.active }))}
                      className={`relative w-14 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                        draft.active ? "bg-[#3a513e]" : "bg-black/20"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                          draft.active ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    onClick={() => handleSave(r._id)}
                    className="bg-[#3a513e] text-white rounded-md py-2 font-medium cursor-pointer sm:col-span-2"
                  >
                    Yadda saxla
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {status.text && (
          <p
            className={`text-sm ${
              status.type === "error" ? "text-red-600" : "text-[#3a513e]"
            }`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}

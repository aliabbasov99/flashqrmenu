import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import noPhoto from "../assets/img/no_photo.jpeg";
import { api, getAuth, setAuth, clearAuth, AUTH_PANEL, resizeImage } from "../lib/api";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const inputClass =
  "border border-[#cac2a7]/60 rounded-xl px-3 py-2 bg-white text-[#3a513e] " +
  "focus:outline-none focus:border-[#3a513e] w-full";
const selectClass =
  "border border-[#cac2a7]/60 rounded-xl px-3 py-2 bg-white text-[#3a513e] " +
  "focus:outline-none focus:border-[#3a513e] cursor-pointer w-full";
const labelClass = "flex flex-col gap-1 text-sm";
const btnPrimary =
  "bg-[#3a513e] text-white rounded-xl py-2 px-5 font-medium cursor-pointer text-sm";
const btnGhost =
  "bg-[#f9f3e7] border border-[#cac2a7]/50 text-[#3a513e] rounded-xl py-2 px-4 text-sm cursor-pointer";

function TimeSelect({ label, value, onChange }) {
  const safe = /^\d{2}:\d{2}$/.test(value || "") ? value : "00:00";
  const hour = safe.slice(0, 2);
  const minute = safe.slice(3, 5);

  const pick = (h, m) => onChange(`${h}:${m}`);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <select value={hour} onChange={(e) => pick(e.target.value, minute)} className={selectClass}>
          {HOURS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span className="font-medium">:</span>
        <select value={minute} onChange={(e) => pick(hour, e.target.value)} className={selectClass}>
          {(MINUTES.includes(minute) ? MINUTES : [minute, ...MINUTES]).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

const emptyProduct = { name: "", subName: "", price: "", categoryId: "" };

export default function Panel() {
  const [session, setSession] = useState(() => getAuth(AUTH_PANEL));
  const [loading, setLoading] = useState(() => !!getAuth(AUTH_PANEL));
  const [tab, setTab] = useState("settings");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [hours, setHours] = useState({ start: "15:00", end: "02:00", label: "", format: "24" });
  const [newPass, setNewPass] = useState("");
  const [heroPreview, setHeroPreview] = useState("");
  const heroFileRef = useRef(null);

  const [catDraft, setCatDraft] = useState("");
  const [editingCat, setEditingCat] = useState(null);
  const [catName, setCatName] = useState("");

  const [prodForm, setProdForm] = useState(emptyProduct);
  const [editingProd, setEditingProd] = useState(null);
  const [prodDraft, setProdDraft] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  const [status, setStatus] = useState({ type: "", text: "" });

  const token = session?.token;
  const notify = (type, text) => setStatus({ type, text });

  const loadAll = async (tok = token) => {
    const [info, cats, prods] = await Promise.all([
      api("/panel/restaurant", { token: tok }),
      api("/panel/categories", { token: tok }),
      api("/panel/products", { token: tok })
    ]);
    setRestaurant(info.restaurant);
    setCategories(cats.categories || []);
    setProducts(prods.products || []);
    setHours(
      info.restaurant.hours || { start: "15:00", end: "02:00", label: "", format: "24" }
    );
    setHeroPreview(info.restaurant.heroImage || "");
  };

  useEffect(() => {
    if (!session) return;
    Promise.all([
      api("/panel/restaurant", { token }),
      api("/panel/categories", { token }),
      api("/panel/products", { token })
    ])
      .then(([info, cats, prods]) => {
        setRestaurant(info.restaurant);
        setCategories(cats.categories || []);
        setProducts(prods.products || []);
        setHours(
          info.restaurant.hours || { start: "15:00", end: "02:00", label: "", format: "24" }
        );
        setHeroPreview(info.restaurant.heroImage || "");
      })
      .catch(() => {
        clearAuth(AUTH_PANEL);
        setSession(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    notify("", "");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username, password }
      });
      if (data.role !== "restaurant") {
        throw new Error("Bu giriş admin paneli üçündür. /admin səhifəsindən daxil olun.");
      }
      const next = { token: data.token, role: data.role, restaurant: data.restaurant };
      setAuth(next, AUTH_PANEL);
      setSession(next);
      setPassword("");
      setLoading(true);
      try {
        await loadAll(next.token);
      } finally {
        setLoading(false);
      }
    } catch (err) {
      notify("error", err.message);
    }
  };

  const handleLogout = () => {
    clearAuth(AUTH_PANEL);
    setSession(null);
    setRestaurant(null);
    setCategories([]);
    setProducts([]);
  };

  // ---------- Tənzimlər ----------
  const saveSettings = async (e) => {
    e.preventDefault();
    notify("", "");
    try {
      const body = { hours };
      if (newPass.trim()) body.password = newPass.trim();
      const data = await api("/panel/restaurant", { method: "PUT", token, body });
      setRestaurant(data.restaurant);
      setNewPass("");
      notify("success", "Tənzimləmlər saxlanıldı ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const uploadHero = async () => {
    const file = heroFileRef.current?.files?.[0];
    if (!file) return notify("error", "Əvvəlcə şəkil seçin");
    notify("", "Yüklənir...");
    try {
      const resized = await resizeImage(file, 1920, 0.85);
      const fd = new FormData();
      fd.append("file", resized);
      const data = await api("/panel/hero", { method: "POST", formData: fd, token });
      setHeroPreview(data.url);
      setRestaurant((r) => ({ ...r, heroImage: data.url }));
      if (heroFileRef.current) heroFileRef.current.value = "";
      notify("success", "Hero şəkli yükləndi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const removeHero = async () => {
    notify("", "Silinir...");
    try {
      await api("/panel/hero", { method: "DELETE", token });
      setHeroPreview("");
      setRestaurant((r) => ({ ...r, heroImage: "" }));
      notify("success", "Şəkil silindi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    notify("", "Yüklənir...");
    try {
      const resized = await resizeImage(file, 1024, 0.9);
      const fd = new FormData();
      fd.append("file", resized);
      const data = await api("/panel/logo", { method: "POST", formData: fd, token });
      setRestaurant((r) => ({ ...r, logo: data.url || r?.logo }));
      notify("success", "Logo yükləndi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const removeLogo = async () => {
    notify("", "Silinir...");
    try {
      await api("/panel/logo", { method: "DELETE", token });
      setRestaurant((r) => ({ ...r, logo: "" }));
      notify("success", "Logo silindi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  // ---------- Kateqoriyalar ----------
  const addCategory = async (e) => {
    e.preventDefault();
    if (!catDraft.trim()) return;
    try {
      await api("/panel/categories", { method: "POST", token, body: { name: catDraft.trim() } });
      setCatDraft("");
      const cats = await api("/panel/categories", { token });
      setCategories(cats.categories || []);
      notify("success", "Kateqoriya əlavə olundu ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const saveCategory = async (id) => {
    try {
      await api(`/panel/categories/${id}`, { method: "PUT", token, body: { name: catName.trim() } });
      const cats = await api("/panel/categories", { token });
      setCategories(cats.categories || []);
      setEditingCat(null);
      notify("success", "Kateqoriya yeniləndi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const moveCategory = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const list = [...categories];
    const a = list[index];
    const b = list[target];
    try {
      await Promise.all([
        api(`/panel/categories/${a._id}`, { method: "PUT", token, body: { order: target + 1 } }),
        api(`/panel/categories/${b._id}`, { method: "PUT", token, body: { order: index + 1 } })
      ]);
      const cats = await api("/panel/categories", { token });
      setCategories(cats.categories || []);
    } catch (err) {
      notify("error", err.message);
    }
  };

  const deleteCategory = async (c) => {
    if (!confirm(`"${c.name}" kateqoriyası silinsin? Məhsullar silinməyəcək, sadəcə qrupsuz qalacaq.`))
      return;
    try {
      await api(`/panel/categories/${c._id}`, { method: "DELETE", token });
      const [cats, prods] = await Promise.all([
        api("/panel/categories", { token }),
        api("/panel/products", { token })
      ]);
      setCategories(cats.categories || []);
      setProducts(prods.products || []);
      notify("success", "Kateqoriya silindi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  // ---------- Məhsullar ----------
  const categoryNameOf = (id) => categories.find((c) => c._id === id)?.name || "";

  const addProduct = async (e) => {
    e.preventDefault();
    if (!prodForm.name.trim()) return notify("error", "Məhsul adı lazımdır");
    try {
      const data = await api("/panel/products", {
        method: "POST",
        token,
        body: { ...prodForm, price: Number(prodForm.price) || 0 }
      });
      setProducts((p) => [...p, { ...data.product, image: "" }]);
      setProdForm(emptyProduct);
      notify("success", "Məhsul əlavə olundu ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const openProdEdit = (p) => {
    setEditingProd(p._id);
    setProdDraft({
      name: p.name,
      subName: p.subName,
      price: p.price,
      categoryId: p.categoryId
    });
  };

  const saveProduct = async (id) => {
    try {
      await api(`/panel/products/${id}`, {
        method: "PUT",
        token,
        body: { ...prodDraft, price: Number(prodDraft.price) || 0 }
      });
      setProducts((list) =>
        list.map((p) =>
          p._id === id
            ? {
                ...p,
                ...prodDraft,
                price: Number(prodDraft.price) || 0,
                categoryName: categoryNameOf(prodDraft.categoryId)
              }
            : p
        )
      );
      setEditingProd(null);
      setProdDraft(null);
      notify("success", "Məhsul yeniləndi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const savePrice = async (p, price) => {
    const value = Number(price);
    if (value === Number(p.price)) return;
    try {
      await api(`/panel/products/${p._id}`, { method: "PUT", token, body: { price: value || 0 } });
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, price: value || 0 } : x)));
      notify("success", "Qiymət yeniləndi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const deleteProduct = async (p) => {
    if (!confirm(`"${p.name}" məhsulu silinsin?`)) return;
    try {
      await api(`/panel/products/${p._id}`, { method: "DELETE", token });
      setProducts((list) => list.filter((x) => x._id !== p._id));
      notify("success", "Məhsul silindi ✅");
    } catch (err) {
      notify("error", err.message);
    }
  };

  const uploadProductImage = async (p, file) => {
    if (!file) return;
    setUploadingId(p._id);
    notify("", "Şəkil yüklənir...");
    try {
      const resized = await resizeImage(file, 1400, 0.85);
      const fd = new FormData();
      fd.append("file", resized);
      const data = await api(`/panel/products/${p._id}/image`, {
        method: "POST",
        formData: fd,
        token
      });
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, image: data.url } : x)));
      notify("success", "Şəkil yükləndi ✅");
    } catch (err) {
      notify("error", err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const removeProductImage = async (p) => {
    try {
      await api(`/panel/products/${p._id}/image`, { method: "DELETE", token });
      setProducts((list) => list.map((x) => (x._id === p._id ? { ...x, image: "" } : x)));
      notify("success", "Şəkil silindi ✅");
    } catch (err) {
      notify("error", err.message);
    }
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
          <span className="text-sm text-black/60">Restoran paneli</span>
        </div>
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4"
        >
          <h1 className="text-xl font-extrabold">Restoran paneli</h1>
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
          <button type="submit" className={btnPrimary}>
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
          <Link to="/admin" className="underline">Admin</Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "settings", label: "Tənzimlər" },
    { id: "categories", label: `Kateqoriyalar (${categories.length})` },
    { id: "products", label: `Məhsullar (${products.length})` }
  ];

  return (
    <div className="min-h-screen bg-[#f9f3e7] text-[#3a513e] pb-16">
      <div className="container mx-auto py-4 px-4 max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3a513e] text-white flex items-center justify-center font-bold shrink-0">
            {(restaurant?.name || "R").trim().charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold leading-tight">{restaurant?.name}</span>
            <span className="text-xs text-black/50">Restoran paneli</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/r/${restaurant?.slug}`} className="text-sm underline" target="_blank">
            Menyu
          </Link>
          <button onClick={handleLogout} className="bg-[#3a513e] text-white text-sm rounded-full px-4 py-1.5 cursor-pointer">
            Çıxış
          </button>
        </div>
      </div>

      {/* Tab-lar */}
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-full text-sm shrink-0 cursor-pointer transition-all ${
                tab === t.id
                  ? "bg-[#3a513e] text-white"
                  : "bg-white text-[#3a513e] border border-[#cac2a7]/40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {status.text && (
          <p
            className={`text-sm mb-4 ${
              status.type === "error" ? "text-red-600" : "text-[#3a513e]"
            }`}
          >
            {status.text}
          </p>
        )}

        {/* ============ TƏNZİMLƏR ============ */}
        {tab === "settings" && (
          <div className="flex flex-col gap-6">
            <form onSubmit={saveSettings} className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4">
              <h2 className="text-xl font-semibold">İş saatları</h2>

              <div className="grid grid-cols-2 gap-4">
                <TimeSelect label="Başlama" value={hours.start} onChange={(v) => setHours((h) => ({ ...h, start: v }))} />
                <TimeSelect label="Bitmə" value={hours.end} onChange={(v) => setHours((h) => ({ ...h, end: v }))} />
              </div>

              <label className={labelClass}>
                <span>Xüsusi yazı (boşdursa avtomatik "başlama—bitmə")</span>
                <input
                  value={hours.label}
                  onChange={(e) => setHours((h) => ({ ...h, label: e.target.value }))}
                  placeholder="Məs: Hər gün 15:00—02:00"
                  className={inputClass}
                />
              </label>



              <div className="text-sm text-black/60">
                Səhifədə göstəriləcək yazı:{" "}
                <span className="font-medium text-[#3a513e]">
                  {hours.start || "--:--"}—{hours.end || "--:--"}
                </span>
              </div>

              <label className={labelClass}>
                <span>Yeni panel parolu (boşdursa dəyişmə)</span>
                <input
                  type="text"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="••••••"
                  className={inputClass}
                />
              </label>

              <button type="submit" className={btnPrimary + " self-start"}>
                Yadda saxla
              </button>
            </form>

            {/* Logo */}
            <div className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Restoran loqosu</h2>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-[#f0ece1] border border-[#cac2a7]/40 flex items-center justify-center overflow-hidden shrink-0">
                  {restaurant?.logo ? (
                    <img src={restaurant.logo} alt={restaurant?.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-[#3a513e]/50">
                      {(restaurant?.name || "R").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm bg-[#f9f3e7] border border-[#cac2a7]/50 rounded-xl px-3 py-2 cursor-pointer self-start">
                    {restaurant?.logo ? "Loqonu dəyiş" : "Loqon yüklə"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => uploadLogo(e.target.files?.[0])}
                    />
                  </label>
                  {restaurant?.logo && (
                    <button
                      onClick={removeLogo}
                      className="bg-red-600/90 text-white rounded-xl py-2 px-5 text-sm cursor-pointer self-start"
                    >
                      Loqonu sil
                    </button>
                  )}
                  <span className="text-xs text-black/50">Kompüterdən şəkil seçin (preview burada görünəcək)</span>
                </div>
              </div>
            </div>

            {/* Hero şəkli */}
            <div className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Hero şəkli</h2>
              <div
                className="w-full aspect-video rounded-[25px] bg-cover bg-center bg-[#f0ece1]"
                style={heroPreview ? { backgroundImage: `url(${heroPreview})` } : undefined}
              >
                {!heroPreview && (
                  <div className="w-full h-full flex items-center justify-center text-sm text-black/40">
                    Şəkil yoxdur
                  </div>
                )}
              </div>
              <input ref={heroFileRef} type="file" accept="image/*" className="text-sm" />
              <div className="flex gap-3">
                <button onClick={uploadHero} className={btnPrimary}>
                  Yüklə
                </button>
                {heroPreview && (
                  <button
                    onClick={removeHero}
                    className="bg-red-600/90 text-white rounded-xl py-2 px-6 font-medium cursor-pointer text-sm"
                  >
                    Sil
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============ KATEQORİYALAR ============ */}
        {tab === "categories" && (
          <div className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Kateqoriyalar</h2>

            <form onSubmit={addCategory} className="flex gap-2 items-end">
              <label className={labelClass + " flex-1"}>
                <span>Yeni kateqoriya</span>
                <input
                  value={catDraft}
                  onChange={(e) => setCatDraft(e.target.value)}
                  placeholder="Məs: Qutablar"
                  className={inputClass}
                />
              </label>
              <button type="submit" className={btnPrimary}>
                Əlavə et
              </button>
            </form>

            <div className="flex flex-col gap-2">
              {categories.length === 0 && (
                <p className="text-sm text-black/60">Hələlik kateqoriya yoxdur.</p>
              )}
              {categories.map((c, i) => (
                <div
                  key={c._id}
                  className="border border-[#cac2a7]/40 rounded-[16px] px-4 py-3 flex items-center gap-2 flex-wrap"
                >
                  {editingCat === c._id ? (
                    <>
                      <input
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className={inputClass + " flex-1 min-w-[160px]"}
                      />
                      <button onClick={() => saveCategory(c._id)} className={btnPrimary}>
                        Saxla
                      </button>
                      <button onClick={() => setEditingCat(null)} className={btnGhost}>
                        Ləğv
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium flex-1 min-w-[160px]">{c.name}</span>
                      <button
                        onClick={() => moveCategory(i, -1)}
                        className="w-8 h-8 rounded-full bg-[#f9f3e7] border border-[#cac2a7]/50 cursor-pointer"
                        title="Yuxarı"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveCategory(i, 1)}
                        className="w-8 h-8 rounded-full bg-[#f9f3e7] border border-[#cac2a7]/50 cursor-pointer"
                        title="Aşağı"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => {
                          setEditingCat(c._id);
                          setCatName(c.name);
                        }}
                        className={btnGhost}
                      >
                        Redaktə
                      </button>
                      <button
                        onClick={() => deleteCategory(c)}
                        className="text-sm bg-red-600/90 text-white rounded-xl px-3 py-2 cursor-pointer"
                      >
                        Sil
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ MƏHSULLAR ============ */}
        {tab === "products" && (
          <div className="flex flex-col gap-6">
            <form onSubmit={addProduct} className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Yeni məhsul</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className={labelClass}>
                  <span>Ad *</span>
                  <input
                    value={prodForm.name}
                    onChange={(e) => setProdForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </label>
                <label className={labelClass}>
                  <span>Alt yazı</span>
                  <input
                    value={prodForm.subName}
                    onChange={(e) => setProdForm((f) => ({ ...f, subName: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  <span>Qiymət (₼)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={prodForm.price}
                    onChange={(e) => setProdForm((f) => ({ ...f, price: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  <span>Kateqoriya</span>
                  <select
                    value={prodForm.categoryId}
                    onChange={(e) => setProdForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">— kateqoriyasız —</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="submit" className={btnPrimary + " self-start"}>
                Əlavə et
              </button>
            </form>

            <div className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-3">
              <h2 className="text-xl font-semibold">Məhsullar</h2>
              {products.length === 0 && (
                <p className="text-sm text-black/60">Hələlik məhsul yoxdur.</p>
              )}

              {products.map((p) => (
                <div key={p._id} className="border border-[#cac2a7]/40 rounded-[20px] p-3 flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <img
                      src={p.image || noPhoto}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = noPhoto;
                      }}
                      alt={p.name}
                      className="w-14 h-14 rounded-xl object-cover bg-[#f0ece1] shrink-0"
                    />

                    <div className="flex flex-col flex-1 min-w-[140px]">
                      <span className="font-medium leading-tight">{p.name}</span>
                      <span className="text-xs text-black/50">
                        {p.categoryId ? categoryNameOf(p.categoryId) : "kateqoriyasız"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={p.price}
                        key={`${p._id}-${p.price}`}
                        onBlur={(e) => savePrice(p, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="w-24 border border-[#cac2a7]/60 rounded-xl px-2 py-2 text-right bg-white focus:outline-none focus:border-[#3a513e]"
                        title="Qiymət (dəyişdirmək üçün daxil edib Enter bas)"
                      />
                      <span className="font-medium">₼</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm bg-[#f9f3e7] border border-[#cac2a7]/50 rounded-xl px-3 py-2 cursor-pointer">
                        {uploadingId === p._id ? "Yüklənir..." : p.image ? "Şəkli dəyiş" : "Şəkil"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => uploadProductImage(p, e.target.files?.[0])}
                        />
                      </label>
                      <button
                        onClick={() => (editingProd === p._id ? setEditingProd(null) : openProdEdit(p))}
                        className={btnGhost}
                      >
                        {editingProd === p._id ? "Bağla" : "Redaktə"}
                      </button>
                      <button
                        onClick={() => deleteProduct(p)}
                        className="text-sm bg-red-600/90 text-white rounded-xl px-3 py-2 cursor-pointer"
                      >
                        Sil
                      </button>
                    </div>
                  </div>

                  {editingProd === p._id && prodDraft && (
                    <div className="bg-[#f9f3e7] rounded-[16px] p-4 grid sm:grid-cols-2 gap-4">
                      <label className={labelClass}>
                        <span>Ad</span>
                        <input
                          value={prodDraft.name}
                          onChange={(e) => setProdDraft((d) => ({ ...d, name: e.target.value }))}
                          className={inputClass}
                        />
                      </label>
                      <label className={labelClass}>
                        <span>Alt yazı</span>
                        <input
                          value={prodDraft.subName}
                          onChange={(e) => setProdDraft((d) => ({ ...d, subName: e.target.value }))}
                          className={inputClass}
                        />
                      </label>
                      <label className={labelClass}>
                        <span>Qiymət (₼)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={prodDraft.price}
                          onChange={(e) => setProdDraft((d) => ({ ...d, price: e.target.value }))}
                          className={inputClass}
                        />
                      </label>
                      <label className={labelClass}>
                        <span>Kateqoriya</span>
                        <select
                          value={prodDraft.categoryId}
                          onChange={(e) => setProdDraft((d) => ({ ...d, categoryId: e.target.value }))}
                          className={selectClass}
                        >
                          <option value="">— kateqoriyasız —</option>
                          {categories.map((c) => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                      <div className="sm:col-span-2 flex items-center gap-4 bg-white rounded-[16px] p-3">
                        <img
                          src={p.image || noPhoto}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = noPhoto;
                          }}
                          alt={prodDraft.name}
                          className="w-24 h-24 rounded-xl object-cover bg-[#f0ece1] shrink-0 border border-[#cac2a7]/40"
                        />
                        <div className="flex flex-col gap-1">
                          <label className="text-sm bg-[#f9f3e7] border border-[#cac2a7]/50 rounded-xl px-3 py-2 cursor-pointer self-start">
                            {uploadingId === p._id ? "Yüklənir..." : p.image ? "Şəkli dəyiş" : "Şəkil yüklə"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => uploadProductImage(p, e.target.files?.[0])}
                            />
                          </label>
                          <span className="text-xs text-black/50">
                            Kompüterdən şəkil seçin, preview burada görünəcək
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 sm:col-span-2">
                        <button onClick={() => saveProduct(p._id)} className={btnPrimary}>
                          Yadda saxla
                        </button>
                        {p.image && (
                          <button
                            onClick={() => removeProductImage(p)}
                            className="bg-red-600/90 text-white rounded-xl py-2 px-5 text-sm cursor-pointer"
                          >
                            Şəkli sil
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

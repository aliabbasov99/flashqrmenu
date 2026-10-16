import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/img/logo.svg";

const API_BASE_URL = "https://api.promar.workers.dev";
const PASS_KEY = "jaguar_admin_pass";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [passInput, setPassInput] = useState(
    () => localStorage.getItem(PASS_KEY) || ""
  );
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [workHoursStart, setWorkHoursStart] = useState("15:00");
  const [workHoursEnd, setWorkHoursEnd] = useState("02:00");
  const [newPassword, setNewPassword] = useState("");

  const [heroUrl, setHeroUrl] = useState("");
  const [preview, setPreview] = useState("");
  const fileRef = useRef(null);

  const [status, setStatus] = useState({ type: "", text: "" });

  const authHeaders = (pass = password) => ({
    "Content-Type": "application/json",
    "x-admin-pass": pass
  });

  const loadSettings = async (pass) => {
    const res = await fetch(`${API_BASE_URL}/api/admin-settings`, {
      headers: { "x-admin-pass": pass }
    });
    const body = await res.json();
    if (!res.ok || body.msg !== "success") {
      throw new Error(body.msg || "Xəta baş verdi");
    }
    setWorkHoursStart(body.settings.workHoursStart || "");
    setWorkHoursEnd(body.settings.workHoursEnd || "");
    
    setHeroUrl(body.settings.heroImageUrl || "");
    setPreview(body.settings.heroImageUrl || "");
  };

  useEffect(() => {
    const saved = localStorage.getItem(PASS_KEY);
    if (!saved) {
      setLoading(false);
      return;
    }
    loadSettings(saved)
      .then(() => {
        setPassword(saved);
        setAuthed(true);
      })
      .catch(() => {
        localStorage.removeItem(PASS_KEY);
        setPassInput("");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });
    try {
      await loadSettings(passInput);
      localStorage.setItem(PASS_KEY, passInput);
      setPassword(passInput);
      setAuthed(true);
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Parol yanlışdır" });
    }
  };

  const handleSaveHours = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin-settings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          workHoursStart,
          workHoursEnd,
          password: newPassword
        })
      });
      const body = await res.json();
      if (!res.ok || body.msg !== "success") throw new Error(body.msg);
      setNewPassword("");
      setStatus({ type: "success", text: "İş saatları saxlanıldı ✅" });
      if (newPassword) {
        localStorage.setItem(PASS_KEY, newPassword);
        setPassword(newPassword);
      }
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Xəta baş verdi" });
    }
  };

  const handleHeroUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus({ type: "error", text: "Əvvəlcə şəkil seçin" });
      return;
    }
    setStatus({ type: "", text: "Yüklənir..." });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pass", password);

      const res = await fetch(`${API_BASE_URL}/api/hero-img`, {
        method: "POST",
        headers: { "x-admin-pass": password },
        body: formData
      });
      const body = await res.json();
      if (!res.ok || body.msg !== "success") throw new Error(body.msg);
      setHeroUrl(body.settings.heroImageUrl);
      setPreview(body.settings.heroImageUrl);
      setStatus({ type: "success", text: "Şəkil yükləndi ✅" });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Yükləmə xətası" });
    }
  };

  const handleHeroRemove = async () => {
    setStatus({ type: "", text: "Silinir..." });
    try {
      const formData = new FormData();
      formData.append("remove", "true");
      formData.append("pass", password);

      const res = await fetch(`${API_BASE_URL}/api/hero-img`, {
        method: "POST",
        headers: { "x-admin-pass": password },
        body: formData
      });
      const body = await res.json();
      if (!res.ok || body.msg !== "success") throw new Error(body.msg);
      setHeroUrl("");
      setPreview("");
      if (fileRef.current) fileRef.current.value = "";
      setStatus({ type: "success", text: "Şəkil silindi ✅" });
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Xəta baş verdi" });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(PASS_KEY);
    setAuthed(false);
    setPassword("");
    setPassInput("");
    setPreview("");
    setHeroUrl("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#3a513e]">
        Yüklənir...
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-[#3a513e] bg-[#f9f3e7]">
        <img src={logo} alt="Jaguar Lounge" className="max-h-16" />
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4"
        >
          <h1 className="text-xl font-extrabold">Admin girişi</h1>
          <input
            type="password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            placeholder="Parol"
            className="border border-[#cac2a7]/60 rounded-xl px-4 py-2 focus:outline-none focus:border-[#3a513e]"
          />
          <button
            type="submit"
            className="bg-[#3a513e] text-white rounded-xl py-2 font-medium cursor-pointer"
          >
            Daxil ol
          </button>
          {status.text && (
            <p
              className={`text-sm ${
                status.type === "error" ? "text-red-600" : "text-[#3a513e]"
              }`}
            >
              {status.text}
            </p>
          )}
        </form>
        <Link to="/" className="text-sm underline">
          Ana səhifə
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f3e7] text-[#3a513e] pb-16">
      <div className="container mx-auto py-4 px-4 max-w-3xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Jaguar Lounge" className="max-h-12" />
          <span className="text-lg font-extrabold">Admin Panel</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-sm underline cursor-pointer"
          >
            Səhifə
          </Link>
          <button
            onClick={handleLogout}
            className="bg-[#3a513e] text-white text-sm rounded-full px-4 py-1.5 cursor-pointer"
          >
            Çıxış
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl flex flex-col gap-6">
        {/* İş saatları */}
        <form
          onSubmit={handleSaveHours}
          className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4"
        >
          <h2 className="text-xl font-semibold">İş saatları</h2>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span>Başlama</span>
              <input
                type="time"
                value={workHoursStart}
                onChange={(e) => setWorkHoursStart(e.target.value)}
                className="border border-[#cac2a7]/60 rounded-xl px-4 py-2 focus:outline-none focus:border-[#3a513e]"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>Bitmə</span>
              <input
                type="time"
                value={workHoursEnd}
                onChange={(e) => setWorkHoursEnd(e.target.value)}
                className="border border-[#cac2a7]/60 rounded-xl px-4 py-2 focus:outline-none focus:border-[#3a513e]"
              />
            </label>
          </div>

          <div className="text-sm text-black/60">
            Səhifədə göstəriləcək yazı:{" "}
            <span className="font-medium text-[#3a513e]">
              {workHoursStart || "--:--"}—{workHoursEnd || "--:--"}
            </span>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span>Yeni admin parolu (boşdursa dəyişmə)</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••"
              className="border border-[#cac2a7]/60 rounded-xl px-4 py-2 focus:outline-none focus:border-[#3a513e]"
            />
          </label>

          <button
            type="submit"
            className="bg-[#3a513e] text-white rounded-xl py-2 font-medium cursor-pointer self-start px-6"
          >
            Yadda saxla
          </button>
        </form>

        {/* Hero şəkli */}
        <div className="bg-white rounded-[25px] shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Hero şəkli</h2>

          <div
            className="w-full aspect-video rounded-[25px] bg-cover bg-center bg-[#f0ece1]"
            style={preview ? { backgroundImage: `url(${preview})` } : undefined}
          >
            {!preview && (
              <div className="w-full h-full flex items-center justify-center text-sm text-black/40">
                Şəkil yoxdur
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="text-sm"
          />

          <div className="flex gap-3">
            <button
              onClick={handleHeroUpload}
              className="bg-[#3a513e] text-white rounded-xl py-2 px-6 font-medium cursor-pointer"
            >
              Yüklə
            </button>
            {heroUrl && (
              <button
                onClick={handleHeroRemove}
                className="bg-red-600/90 text-white rounded-xl py-2 px-6 font-medium cursor-pointer"
              >
                Sil
              </button>
            )}
          </div>
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
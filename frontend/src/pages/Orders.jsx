import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getAuth, clearAuth, AUTH_PANEL } from "../lib/api";
import { themeStyle } from "../lib/themes";
import PanelLogin from "../components/PanelLogin";
import InstallButton from "../components/InstallButton";

const STATUS_LABELS = {
  new: "Yeni",
  processing: "Hazırlanır",
  done: "Tamamlandı",
  cancelled: "Ləğv edildi"
};

const STATUS_BADGES = {
  new: "bg-amber-100 text-amber-800 border-amber-300",
  processing: "bg-blue-100 text-blue-800 border-blue-300",
  done: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-100 text-red-700 border-red-300"
};

const STATUS_BORDERS = {
  new: "#e0a800",
  processing: "#2563eb",
  done: "#059669",
  cancelled: "#dc2626"
};

const money = (value) => (Number(value) || 0).toFixed(2);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const timeOf = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" });
};

const btnPrimary =
  "bg-[#3a513e] text-white rounded-md py-2 px-4 text-sm font-medium cursor-pointer " +
  "disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhost =
  "bg-[#f9f3e7] border border-[#cac2a7]/50 text-[#3a513e] rounded-md py-2 px-4 text-sm cursor-pointer";
const btnDanger =
  "bg-red-600/90 text-white rounded-md py-2 px-4 text-sm cursor-pointer";

const FILTERS = [
  { id: "active", label: "Aktiv" },
  { id: "new", label: "Yeni" },
  { id: "processing", label: "Hazırlanır" },
  { id: "done", label: "Tamamlanmış" },
  { id: "cancelled", label: "Ləğv" },
  { id: "all", label: "Hamısı" }
];

export default function Orders() {
  const [session, setSession] = useState(() => getAuth(AUTH_PANEL));
  const [loading, setLoading] = useState(() => !!getAuth(AUTH_PANEL));
  const [error, setError] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("active");
  const [busyId, setBusyId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("qr_orders_sound") !== "0"
  );
  const [audioReady, setAudioReady] = useState(false);
  const [flash, setFlash] = useState("");

  const token = session?.token;
  const knownIdsRef = useRef(null);
  const audioRef = useRef(null);
  const soundRef = useRef(soundEnabled);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    soundRef.current = soundEnabled;
    localStorage.setItem("qr_orders_sound", soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  const getAudio = useCallback(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioRef.current) audioRef.current = new Ctx();
    return audioRef.current;
  }, []);

  const playChime = useCallback(() => {
    if (!soundRef.current) return;
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [
      [880, 0],
      [1174.66, 0.18]
    ].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.42);
    });
  }, [getAudio]);

  const unlockAudio = useCallback(async () => {
    const ctx = getAudio();
    if (ctx?.state === "suspended") await ctx.resume().catch(() => {});
    setAudioReady(true);
  }, [getAudio]);

  useEffect(() => {
    const unlock = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [unlockAudio]);

  const showNewOrder = useCallback((order) => {
    const label = `Yeni sifariş #${order.order}${order.table ? ` • ${order.table}` : ""}`;
    setFlash(label);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(""), 12000);

    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try {
        new Notification(label, {
          body: `${money(order.total)} ₼ • ${order.items?.length || 0} növ məhsul`
        });
      } catch {
        // bəzi mobil brauzerlər Notification konstruktorunu dəstəkləmir
      }
    }
  }, []);

  const loadOrders = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) return;
      try {
        const data = await api("/panel/orders", { token });
        const list = data.orders || [];

        if (knownIdsRef.current) {
          const fresh = list
            .filter((o) => o.status === "new" && !knownIdsRef.current.has(o._id))
            .reverse();
          fresh.forEach((order, index) => {
            setTimeout(() => playChime(), index * 500);
          });
          if (fresh.length) showNewOrder(fresh[fresh.length - 1]);
        }

        knownIdsRef.current = new Set(list.map((o) => o._id));
        setOrders(list);
        setError("");
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          clearAuth(AUTH_PANEL);
          setSession(null);
        } else if (!silent) {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [token, playChime, showNewOrder]
  );

  useEffect(() => {
    if (!token) return;

    api("/panel/restaurant", { token })
      .then((data) => setRestaurant(data.restaurant))
      .catch(() => {});

    loadOrders();
    const timer = setInterval(() => loadOrders({ silent: true }), 3000);
    return () => clearInterval(timer);
  }, [token, loadOrders]);

  useEffect(() => {
    if (restaurant?.name) document.title = `${restaurant.name} — Sifarişlər`;
  }, [restaurant]);

  useEffect(
    () => () => {
      clearTimeout(flashTimerRef.current);
    },
    []
  );

  const updateStatus = async (order, status) => {
    setBusyId(order._id);
    setError("");
    try {
      const data = await api(`/panel/orders/${order._id}`, {
        method: "PUT",
        token,
        body: { status }
      });
      setOrders((list) => list.map((o) => (o._id === order._id ? data.order : o)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const removeOrder = async (order) => {
    if (!confirm(`#${order.order} sifarişi silinsin?`)) return;
    setBusyId(order._id);
    try {
      await api(`/panel/orders/${order._id}`, { method: "DELETE", token });
      setOrders((list) => list.filter((o) => o._id !== order._id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleSound = async () => {
    const next = !soundEnabled;
    soundRef.current = next;
    setSoundEnabled(next);
    if (next) {
      await unlockAudio();
      playChime();
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  };

  const printReceipt = (order) => {
    const win = window.open("", "_blank", "width=380,height=680");
    if (!win) {
      setError("Çek pəncərəsi bloklandı. Brauzerdə popup icazəsi verin.");
      return;
    }

    const rows = (order.items || [])
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.name)}</td>` +
          `<td align="center">${item.qty}</td>` +
          `<td align="right">${money(item.price * item.qty)}</td></tr>`
      )
      .join("");

    const created = order.createdAt
      ? new Date(order.createdAt).toLocaleString("az-AZ")
      : "";

    win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Çek #${escapeHtml(order.order)}</title>
<style>
  @page { size: 58mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 0; color: #111; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
  .muted { text-align: center; font-size: 10px; color: #444; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .line { border-top: 1px dashed #999; margin: 6px 0; }
  .total { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; margin-top: 4px; }
  .note { margin-top: 6px; font-size: 11px; }
  .foot { text-align: center; margin-top: 10px; font-size: 10px; }
</style>
</head>
<body>
  <h1>${escapeHtml(restaurant?.name || "QR Menyu")}</h1>
  <div class="muted">Sifariş #${escapeHtml(order.order)}${
      order.table ? ` • ${escapeHtml(order.table)}` : ""
    }<br />${escapeHtml(created)}</div>
  <table><tbody>${rows}</tbody></table>
  <div class="line"></div>
  <div class="total"><span>Cəm</span><span>${money(order.total)} ₼</span></div>
  ${order.note ? `<div class="note">Qeyd: ${escapeHtml(order.note)}</div>` : ""}
  <div class="foot">Bizi seçdiyiniz üçün təşəkkür edirik!</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
    win.document.close();
  };

  const counts = orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      if (order.status === "new" || order.status === "processing") acc.active += 1;
      return acc;
    },
    { active: 0 }
  );

  const visibleOrders = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "active") return order.status === "new" || order.status === "processing";
    return order.status === filter;
  });

  if (!session) {
    return (
      <div
        style={themeStyle()}
        className="min-h-screen bg-[var(--qr-bg)] text-[var(--qr-primary)] flex flex-col items-center justify-center gap-4 px-4 py-10"
      >
        <PanelLogin
          title="Kassa girişi"
          onSuccess={(next) => {
            setLoading(true);
            setSession(next);
          }}
        />
        <div className="flex gap-4 text-sm">
          <Link to="/panel" className="underline">Restoran paneli</Link>
          <Link to="/order" className="underline">Ofisiant sifarişi</Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={themeStyle(restaurant?.theme)}
      className="min-h-screen bg-[var(--qr-bg)] text-[var(--qr-primary)] pb-16"
    >
      <header className="sticky top-0 z-20 bg-[var(--qr-primary)] text-white shadow-sm">
        <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center font-bold shrink-0">
              {(restaurant?.name || "K").trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-extrabold leading-tight truncate">
                {restaurant?.name || "Sifarişlər"}
              </span>
              <span className="text-xs text-white/70">
                Kassa / sifariş izləmə{counts.active ? ` • ${counts.active} aktiv` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <InstallButton className="bg-white/15 hover:bg-white/25 text-white rounded-md py-1.5 px-3 text-xs font-medium cursor-pointer" />
            <button
              type="button"
              onClick={toggleSound}
              className={`rounded-md py-1.5 px-3 text-xs font-medium cursor-pointer ${
                soundEnabled ? "bg-white text-[#3a513e]" : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {soundEnabled ? "Səs aktiv" : "Səsi yandır"}
            </button>
            <Link
              to="/order"
              className="bg-white/15 hover:bg-white/25 text-white rounded-md py-1.5 px-3 text-xs font-medium"
            >
              Sifariş ver
            </Link>
            <Link
              to="/panel"
              className="bg-white/15 hover:bg-white/25 text-white rounded-md py-1.5 px-3 text-xs font-medium"
            >
              Panel
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-4">
        {flash && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm font-semibold shadow-sm">
            {flash}
          </div>
        )}

        {soundEnabled && !audioReady && (
          <div className="mb-4 rounded-md border border-[#cac2a7]/60 bg-white px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <span>Yeni sifariş səsini eşitmək üçün səsi aktivləşdirin.</span>
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                playChime();
              }}
              className={btnPrimary + " shrink-0"}
            >
              Səsi aktivləşdir
            </button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {FILTERS.map((item) => {
            const count =
              item.id === "all" ? orders.length : item.id === "active" ? counts.active : counts[item.id] || 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`px-3 py-1.5 rounded-full text-xs shrink-0 cursor-pointer border ${
                  filter === item.id
                    ? "bg-[#3a513e] text-white border-[#3a513e]"
                    : "bg-white text-[#3a513e] border-[#cac2a7]/60"
                }`}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-md shadow-sm p-6 text-sm">Yüklənir...</div>
        ) : visibleOrders.length === 0 ? (
          <div className="bg-white rounded-md shadow-sm p-6 text-sm text-black/60">
            Bu bölmədə sifariş yoxdur. Yeni sifariş gələndə burada avtomatik görünəcək.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleOrders.map((order) => {
              const itemCount = (order.items || []).reduce((sum, i) => sum + i.qty, 0);
              return (
                <div
                  key={order._id}
                  className="bg-white rounded-md shadow-sm overflow-hidden"
                  style={{ borderLeft: `4px solid ${STATUS_BORDERS[order.status] || "#888"}` }}
                >
                  <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-extrabold">#{order.order}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            STATUS_BADGES[order.status] || STATUS_BADGES.new
                          }`}
                        >
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <div className="text-xs text-black/60 mt-1">
                        {timeOf(order.createdAt)}
                        {order.table ? ` • ${order.table}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold">{money(order.total)} ₼</div>
                      <div className="text-xs text-black/50">{itemCount} məhsul</div>
                    </div>
                  </div>

                  <div className="px-4 pb-3 flex flex-col gap-1">
                    {(order.items || []).map((item, index) => (
                      <div
                        key={`${order._id}-${item.productId}-${index}`}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {item.qty} × {item.name}
                        </span>
                        <span className="shrink-0 font-medium">{money(item.price * item.qty)} ₼</span>
                      </div>
                    ))}
                  </div>

                  {order.note && (
                    <div className="mx-4 mb-3 rounded-md bg-[#f9f3e7] border border-[#cac2a7]/40 px-3 py-2 text-xs">
                      Qeyd: {order.note}
                    </div>
                  )}

                  <div className="px-4 py-3 border-t border-[#cac2a7]/30 flex flex-wrap items-center gap-2">
                    {order.status === "new" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(order, "processing")}
                        disabled={busyId === order._id}
                        className={btnPrimary}
                      >
                        Qəbul et
                      </button>
                    )}
                    {order.status === "processing" && (
                      <button
                        type="button"
                        onClick={() => updateStatus(order, "done")}
                        disabled={busyId === order._id}
                        className={btnPrimary}
                      >
                        Tamamla
                      </button>
                    )}
                    {(order.status === "new" || order.status === "processing") && (
                      <button
                        type="button"
                        onClick={() => updateStatus(order, "cancelled")}
                        disabled={busyId === order._id}
                        className={btnGhost}
                      >
                        Ləğv et
                      </button>
                    )}
                    <button type="button" onClick={() => printReceipt(order)} className={btnGhost}>
                      Çek çap et
                    </button>
                    {(order.status === "done" || order.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() => removeOrder(order)}
                        disabled={busyId === order._id}
                        className={btnDanger}
                      >
                        Sil
                      </button>
                    )}
                    {busyId === order._id && (
                      <span className="text-xs text-black/50">Yenilənir...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

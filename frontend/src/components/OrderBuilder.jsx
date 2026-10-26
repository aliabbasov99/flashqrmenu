import { useMemo, useState } from "react";
import { api } from "../lib/api";

const inputClass =
  "border border-[#cac2a7]/60 rounded-md px-3 py-2 bg-white text-[#3a513e] " +
  "focus:outline-none focus:border-[#3a513e] w-full";
const btnPrimary =
  "bg-[#3a513e] text-white rounded-md py-2.5 px-5 font-medium cursor-pointer text-sm " +
  "disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhost =
  "bg-[#f9f3e7] border border-[#cac2a7]/50 text-[#3a513e] rounded-md py-2 px-3 text-sm cursor-pointer";
const qtyBtn =
  "w-8 h-8 rounded-md border border-[#cac2a7]/60 bg-white text-[#3a513e] text-lg leading-none " +
  "flex items-center justify-center cursor-pointer active:scale-95 transition-transform";

const money = (value) => (Number(value) || 0).toFixed(2);

export default function OrderBuilder({ token, categories = [], products = [], onSubmitted }) {
  const [cart, setCart] = useState([]);
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const setQty = (product, qty) => {
    const id = product._id || product.productId;
    if (!id) return;
    const next = Math.max(0, Math.min(999, Math.floor(Number(qty) || 0)));
    setCart((list) => {
      if (next === 0) return list.filter((line) => line.productId !== id);
      const exists = list.some((line) => line.productId === id);
      if (exists) {
        return list.map((line) =>
          line.productId === id ? { ...line, qty: next } : line
        );
      }
      return [
        ...list,
        {
          productId: id,
          name: product.name,
          price: Number(product.price) || 0,
          qty: next
        }
      ];
    });
  };

  const qtyOf = (id) => cart.find((line) => line.productId === id)?.qty || 0;
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const total = cart.reduce((sum, line) => sum + line.price * line.qty, 0);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat) {
        const matchCat = String(p.categoryId || "") === activeCat || p.categoryName === activeCat;
        if (!matchCat) return false;
      }
      if (!term) return true;
      return (
        String(p.name || "").toLowerCase().includes(term) ||
        String(p.subName || "").toLowerCase().includes(term) ||
        String(p.categoryName || "").toLowerCase().includes(term)
      );
    });
  }, [products, activeCat, search]);

  const submit = async () => {
    if (!cart.length) {
      setStatus({ type: "error", text: "Səbət boşdur" });
      return;
    }
    setBusy(true);
    setStatus({ type: "", text: "" });
    try {
      const data = await api("/panel/orders", {
        method: "POST",
        token,
        body: {
          table,
          note,
          items: cart.map((line) => ({ productId: line.productId, qty: line.qty }))
        }
      });
      setCart([]);
      setNote("");
      setStatus({
        type: "success",
        text: `Sifariş #${data.order?.order || ""} göndərildi ✅`
      });
      onSubmitted?.(data.order);
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-md shadow-sm p-4 sm:p-6 flex flex-col gap-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Masa / yer</span>
            <input
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder="Məs: Masa 5"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Qeyd</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Məs: az duz, tez hazırlansın"
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Səbət ({itemCount})</span>
          <span className="text-xl font-extrabold">{money(total)} ₼</span>
        </div>

        {cart.length === 0 ? (
          <p className="text-sm text-black/60">
            Səbət boşdur. Aşağıdan məhsul əlavə edin.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-[#cac2a7]/40 border border-[#cac2a7]/40 rounded-md px-3">
            {cart.map((line) => (
              <div key={line.productId} className="flex items-center gap-2 py-2.5">
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{line.name}</span>
                  <span className="text-xs text-black/50">
                    {money(line.price)} ₼ × {line.qty} ={" "}
                    <span className="font-semibold text-[#3a513e]">
                      {money(line.price * line.qty)} ₼
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQty(line, line.qty - 1)}
                    className={qtyBtn}
                    aria-label="Azalt"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm font-semibold">{line.qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(line, line.qty + 1)}
                    className={qtyBtn}
                    aria-label="Artır"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setQty(line, 0)}
                  className="text-xs text-red-600 px-1 cursor-pointer"
                >
                  Sil
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!cart.length || busy}
          className={btnPrimary + " w-full py-3 text-base"}
        >
          {busy ? "Göndərilir..." : `Sifarişi göndər • ${money(total)} ₼`}
        </button>

        {status.text && (
          <p className={`text-sm ${status.type === "error" ? "text-red-600" : "text-[#3a513e]"}`}>
            {status.text}
          </p>
        )}
      </div>

      <div className="bg-white rounded-md shadow-sm p-4 sm:p-6 flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Məhsullar</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Məhsul axtar"
          className={inputClass}
        />

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setActiveCat("")}
              className={`px-3 py-1.5 rounded-full text-xs shrink-0 cursor-pointer border ${
                activeCat === ""
                  ? "bg-[#3a513e] text-white border-[#3a513e]"
                  : "bg-white text-[#3a513e] border-[#cac2a7]/60"
              }`}
            >
              Hamısı
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c._id}
                onClick={() => setActiveCat(activeCat === c._id ? "" : c._id)}
                className={`px-3 py-1.5 rounded-full text-xs shrink-0 cursor-pointer border ${
                  activeCat === c._id
                    ? "bg-[#3a513e] text-white border-[#3a513e]"
                    : "bg-white text-[#3a513e] border-[#cac2a7]/60"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="text-sm text-black/60">Məhsul tapılmadı.</p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((p) => {
            const qty = qtyOf(p._id);
            return (
              <div
                key={p._id}
                className="border border-[#cac2a7]/40 rounded-md p-3 flex items-center gap-3"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium text-sm leading-tight">{p.name}</span>
                  <span className="text-xs text-black/50 truncate">
                    {[p.categoryName, p.subName].filter(Boolean).join(" • ")}
                  </span>
                  <span className="text-sm font-semibold mt-1">{money(p.price)} ₼</span>
                </div>

                {qty > 0 ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty(p, qty - 1)}
                      className={qtyBtn}
                      aria-label="Azalt"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(p, qty + 1)}
                      className={qtyBtn}
                      aria-label="Artır"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQty(p, 1)}
                    className={btnGhost + " shrink-0"}
                  >
                    + Əlavə et
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

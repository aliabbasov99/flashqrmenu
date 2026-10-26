import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  getAuth,
  clearAuth,
  AUTH_PANEL
} from "../lib/api";
import { themeStyle } from "../lib/themes";
import OrderBuilder from "../components/OrderBuilder";
import PanelLogin from "../components/PanelLogin";
import InstallButton from "../components/InstallButton";

export default function Order() {
  const [session, setSession] = useState(() => getAuth(AUTH_PANEL));
  const [loading, setLoading] = useState(() => !!getAuth(AUTH_PANEL));
  const [error, setError] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const token = session?.token;

  useEffect(() => {
    if (!token) return;

    let alive = true;

    Promise.all([
      api("/panel/restaurant", { token }),
      api("/panel/categories", { token }),
      api("/panel/products", { token })
    ])
      .then(([info, cats, prods]) => {
        if (!alive) return;
        setRestaurant(info.restaurant);
        setCategories(cats.categories || []);
        setProducts(prods.products || []);
      })
      .catch((err) => {
        if (!alive) return;
        if (err.status === 401 || err.status === 403) {
          clearAuth(AUTH_PANEL);
          setSession(null);
          setRestaurant(null);
        } else {
          setError(err.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (restaurant?.name) document.title = `${restaurant.name} — Sifariş`;
  }, [restaurant]);

  const handleLogin = (next) => {
    setSession(next);
    setLoading(true);
  };

  return (
    <div
      style={themeStyle(restaurant?.theme)}
      className="min-h-screen bg-[var(--qr-bg)] text-[var(--qr-primary)] pb-10"
    >
      <header className="bg-[var(--qr-primary)] text-white shadow-sm">
        <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant?.logo ? (
              <img
                src={restaurant.logo}
                alt={restaurant.name}
                className="w-10 h-10 rounded-full object-cover bg-white/15 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center font-bold shrink-0">
                {(restaurant?.name || "S").trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-extrabold leading-tight truncate">
                {restaurant?.name || "Sifariş"}
              </span>
              <span className="text-xs text-white/70">Ofisiant sifarişi</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <InstallButton className="bg-white/15 hover:bg-white/25 text-white rounded-md py-1.5 px-3 text-xs font-medium cursor-pointer" />
            <Link
              to="/orders"
              className="bg-white/15 hover:bg-white/25 text-white rounded-md py-1.5 px-3 text-xs font-medium"
            >
              Sifarişlər
            </Link>
            {restaurant?.slug && (
              <Link
                to={`/r/${restaurant.slug}`}
                className="bg-white/15 hover:bg-white/25 text-white rounded-md py-1.5 px-3 text-xs font-medium"
              >
                Menyu
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-4">
        {!session ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <PanelLogin title="Ofisiant girişi" onSuccess={handleLogin} />
            <Link to="/panel" className="text-sm underline">
              Restoran panelinə keç
            </Link>
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-sm">Yüklənir...</div>
        ) : error ? (
          <div className="bg-white rounded-md shadow-sm p-6 text-sm text-red-600">{error}</div>
        ) : (
          <OrderBuilder
            token={token}
            categories={categories}
            products={products}
            restaurant={restaurant}
          />
        )}
      </main>
    </div>
  );
}

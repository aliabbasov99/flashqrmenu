import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import noPhoto from "../assets/img/no_photo.jpeg";

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/restaurants")
      .then((res) => res.json())
      .then((data) => {
        if (data.msg === "success") setRestaurants(data.restaurants);
        else setError("Restoranlar yüklənmədi");
      })
      .catch(() => setError("Serverlə əlaqə qurula bilmədi"));
  }, []);

  return (
    <div className="min-h-screen bg-[#fbf7ee] text-[#3a513e] pb-16">
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#3a513e] text-white flex items-center justify-center font-bold shrink-0">
            QR
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-extrabold">QR Menyu</span>
            <span className="text-sm text-black/60">Restoranı seçin</span>
          </div>
        </div>

        {error && (
          <div className="bg-white rounded-[25px] shadow-sm p-6 text-sm text-red-600">{error}</div>
        )}

        {!restaurants && !error && (
          <div className="bg-white rounded-[25px] shadow-sm p-6 text-sm">Yüklənir...</div>
        )}

        {restaurants && restaurants.length === 0 && (
          <div className="bg-white rounded-[25px] shadow-sm p-6 text-sm text-black/60">
            Hələlik restoran əlavə olunmayıb.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {restaurants?.map((r) => (
            <Link
              key={r._id}
              to={`/r/${r.slug}`}
              className="group bg-white rounded-[25px] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="w-full aspect-video bg-cover bg-center bg-[#f0ece1]"
                style={{
                  backgroundImage: r.heroImage
                    ? `url(${r.heroImage})`
                    : `url(${noPhoto})`
                }}
              />
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-semibold text-lg">{r.name}</span>
                  <span className="text-xs text-black/50">Menyuya bax →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex justify-center gap-4 mt-10 text-sm">
          <Link to="/admin" className="underline text-black/60">
            Admin
          </Link>
          <Link to="/panel" className="underline text-black/60">
            Restoran paneli
          </Link>
        </div>
      </div>
    </div>
  );
}

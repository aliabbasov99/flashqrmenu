import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import noPhoto from "../assets/img/no_photo.jpeg";
import { API_BASE } from "../lib/api";

const translations = {
  az: {
    notFound: "Məhsul tapılmadı",
    waiterInfo: "Məhsul haqqında sualınız varsa, ofisianta müraciət edin.",
    backToMenu: "Menyuya qayıt"
  },
  en: {
    notFound: "Product not found",
    waiterInfo: "If you have questions about the item, please ask the waiter.",
    backToMenu: "Back to menu"
  },
  ru: {
    notFound: "Блюдо не найдено",
    waiterInfo: "Если у вас есть вопросы о блюде, обратитесь к официанту.",
    backToMenu: "Вернуться в меню"
  }
};

const Detail = () => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem("appLang") || "az";
  });

  const t = translations[lang] || translations.az;

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLang(selectedLang);
    localStorage.setItem("appLang", selectedLang);
  };

  const { slug, id } = useParams();
  const [product, setProduct] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch(`${API_BASE}/restaurants/${encodeURIComponent(slug)}/menu`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.msg !== "success") throw new Error("not found");
        setRestaurant(data.restaurant);
        const found = (data.products || []).find((p) => String(p._id) === String(id));
        if (!found) {
          setStatus("error");
          return;
        }
        setProduct(found);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [slug, id]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#3a513e]">
        Yüklənir...
      </div>
    );
  }

  if (status === "error" || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#fbf7ee] text-[#3a513e] px-4">
        <p className="text-lg font-semibold">{t.notFound}</p>
        <Link to={`/r/${slug}`} className="underline text-sm">
          {t.backToMenu}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Navbar */}
      <div className="container flex flex-row justify-between mx-auto py-4 max-w-[550px] px-2 lg:px-0 md:max-w-[720px] lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl items-center text-[#3a513e]">
        <Link to={`/r/${slug}`}>
          <button className="w-10 h-10 bg-[#f9f3e7] text-[#3a513e] border border-[#cac2a7]/40 rounded-full flex items-center justify-center hover:bg-[#f2e7d3] transition-colors duration-200 focus:outline-none cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </button>
        </Link>
        <span className="text-[20px] md:text-[24px] lg:text-[28px] font-extrabold whitespace-nowrap">
          {restaurant?.name}
        </span>

        {/* Language Choice */}
        <div className="relative inline-flex items-center">
          <div className="pointer-events-none absolute left-3 z-10 flex items-center justify-center text-[#3a513e]">
            <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
          </div>

          <select
            value={lang}
            onChange={handleLanguageChange}
            className="appearance-none bg-[#f9f3e7] text-[#3a513e] font-medium text-sm pl-9 pr-8 py-2 rounded-full border border-[#cac2a7]/40 focus:outline-none cursor-pointer relative z-0"
          >
            <option value="az">AZ</option>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>

          <div className="pointer-events-none absolute right-3 z-10 flex items-center justify-center text-[#3a513e]">
            <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>
      </div>

      {/* Məhsul şəkli */}
      <div className="container mx-auto pb-2 max-w-[550px] px-2 lg:px-0 md:max-w-[720px] lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl">
        <div className="w-full aspect-video rounded-[25px] overflow-hidden bg-[#f0ece1]">
          <img
            src={product.image || noPhoto}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = noPhoto;
            }}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Product Details */}
      <div className="container mx-auto px-2 lg:px-0 max-w-[550px] md:max-w-[720px] lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl text-[#3a513e]">
        <div className="flex flex-col justify-between md:justify-start gap-1">
          <h2 className="text-lg md:text-3xl font-semibold font-serif">
            {product.name}
          </h2>

          {product.subName && <p className="text-sm">{product.subName}</p>}

          <div className="text-[30px] md:text-[28px] lg:text-[34px] my-2 font-semibold text-[#3a513e]">
            {product.price} <span>₼</span>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex mt-6 my-2 justify-between border-2 border-[#ece6dd] flex-row gap-2 items-center bg-[#f0ede3] rounded-[20px] p-3 sm:p-4">
          <div className="flex flex-row items-center gap-2">
            <i className="fa-solid fa-circle-info bg-[#f0ede3] text-[#374427] rounded-full text-[24px] sm:text-[28px] md:text-[30px] lg:text-[36px]" />
            <span className="font-serif text-base">{t.waiterInfo}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Detail;

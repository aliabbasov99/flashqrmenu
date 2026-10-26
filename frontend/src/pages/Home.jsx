import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import defaultHero from "../assets/img/hero.jpg";
import divider from "../assets/img/divider.svg";
import noPhoto from "../assets/img/no_photo.jpeg";
import { API_BASE } from "../lib/api";
import { themeStyle } from "../lib/themes";

const translations = {
  az: {
    all: "HAMISI",
    fresh: "Təzə",
    local: "Yerli",
    seasonal: "Mövsumi",
    everyday: "Hər gün",
    selectedForYou: "Sizin üçün seçdik",
  },
  en: {
    all: "All",
    fresh: "Fresh",
    local: "Local",
    seasonal: "Seasonal",
    everyday: "Every day",
    selectedForYou: "Selected for you",
  },
  ru: {
    all: "Все",
    fresh: "Свежий",
    local: "Местный",
    seasonal: "Сезонный",
    everyday: "Каждый день",
    selectedForYou: "Выбрано для вас",
  }
};

export default function Home() {
  const { slug } = useParams();
  const [activeGroup, setActiveGroup] = useState("ALL");
  const [spyGroup, setSpyGroup] = useState("ALL");
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [error, setError] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [heroBackground, setHeroBackground] = useState(defaultHero);
  const [notFound, setNotFound] = useState(false);

  const stickyRef = useRef(null);
  const stripRef = useRef(null);
  const productsRef = useRef(null);
  const chipRefs = useRef({});
  const pendingScrollRef = useRef(false);
  const lastChipScrollRef = useRef(0);

  const [lang, setLang] = useState(() => {
    return localStorage.getItem("appLang") || "az";
  });

  const t = translations[lang] || translations.az;

  const handleLanguageChange = (e) => {
    const selectedLang = e.target.value;
    setLang(selectedLang);
    localStorage.setItem("appLang", selectedLang);
  };

  useEffect(() => {
    if (restaurant?.name) document.title = `${restaurant.name} — Menyu`;
  }, [restaurant]);

  useEffect(() => {
    fetch(`${API_BASE}/restaurants/${encodeURIComponent(slug)}/menu`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.msg !== "success") throw new Error("not found");
        setRestaurant(data.restaurant);
        setCategories(data.categories || []);
        setItems(data.products || []);
        if (data.restaurant?.workHours) setWorkHours(data.restaurant.workHours);
        if (data.restaurant?.heroImage) setHeroBackground(data.restaurant.heroImage);
        else setHeroBackground(defaultHero);
      })
      .catch((e) => {
        if (e.message === "not found") setNotFound(true);
        else setError("Menyu yüklənmədi, yenidən yoxlayın");
      });
  }, [slug]);

  const availableGroups = useMemo(() => {
    const present = new Set(items.map((p) => p.categoryName).filter(Boolean));
    return ["ALL", ...categories.map((c) => c.name).filter((n) => present.has(n))];
  }, [items, categories]);

  // Kateqoriya başlıqlarını süzgəcdən keçirib yalnız həqiqi məhsulları saxlayırıq
  const products = useMemo(() => items.filter((p) => p.name), [items]);

  // "HAMISI" görünüşündə məhsullar kateqoriya üzrə bitişik bloklara yığılır,
  // seçilmiş kateqoriya olduqda yalnız onun məhsulları qalır
  const displayedProducts = useMemo(() => {
    if (activeGroup !== "ALL") {
      return products.filter((p) => p.categoryName === activeGroup);
    }

    const byGroup = new Map();
    const loose = [];
    products.forEach((p) => {
      if (!p.categoryName) {
        loose.push(p);
        return;
      }
      if (!byGroup.has(p.categoryName)) byGroup.set(p.categoryName, []);
      byGroup.get(p.categoryName).push(p);
    });

    const orderedGroups = categories.map((c) => c.name).filter((n) => byGroup.has(n));
    return [...orderedGroups.flatMap((g) => byGroup.get(g)), ...loose];
  }, [products, activeGroup, categories]);

  // Scroll spy yalnız "HAMISI" rejimində işləyir, filtr rejimində seçilmiş kateqoriya aktivdir
  const highlightedGroup = activeGroup !== "ALL" ? activeGroup : spyGroup;

  // Scroll edilən zaman görünən kateqoriyanı müəyyən edirik
  useEffect(() => {
    let ticking = false;

    const update = () => {
      ticking = false;
      const container = productsRef.current;
      if (!container) return;

      const baseLine =
        (stickyRef.current ? stickyRef.current.getBoundingClientRect().bottom : 0) + 8;

      if (container.getBoundingClientRect().top > baseLine) {
        setSpyGroup("ALL");
        return;
      }

      const cards = container.querySelectorAll("[data-group]");
      const marker = baseLine + 12;
      let next = "";

      // Menyunun ən aşağısına gəlib çatdıqda həmişə ən sonuncu kateqoriya aktiv
      // qalsın (qısa son bloklar belə aktiv olsun).
      const remaining =
        document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (remaining <= 2) {
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].dataset.group) {
            setSpyGroup(cards[i].dataset.group);
            return;
          }
        }
      }

      // İstinad xətti sabitdir: sticky zolağın altındakı ilk məhsulun kateqoriyası
      // aktiv sayılır. Beləcə aşağı sürüşdükcə aktiv kateqoriya dəyişir; ən sona
      // çatanda isə sonuncu kateqoriya görünür qalır.
      for (const card of cards) {
        const group = card.dataset.group;
        if (!group) continue;
        if (card.getBoundingClientRect().bottom > marker) {
          next = group;
          break;
        }
      }

      if (!next) {
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].dataset.group) {
            next = cards[i].dataset.group;
            break;
          }
        }
      }

      if (next) setSpyGroup(next);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [displayedProducts]);

  // Aktiv kateqoriya dəyişəndə onun düyməsi sürüşdürmə zolağında görünən yerə gəlir
  useEffect(() => {
    const strip = stripRef.current;
    const chip = chipRefs.current[highlightedGroup];
    if (!strip || !chip) return;

    const target = Math.max(0, chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2);
    const now = performance.now();
    const behavior = now - lastChipScrollRef.current < 220 ? "auto" : "smooth";
    lastChipScrollRef.current = now;

    strip.scrollTo({ left: target, behavior });
  }, [highlightedGroup, availableGroups.length]);

  const scrollToProducts = () => {
    const el = productsRef.current;
    if (!el) return;

    const offset = (stickyRef.current ? stickyRef.current.offsetHeight : 0) + 8;
    const top = window.scrollY + el.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  // Kateqoriyaya klik olunduqda məhsullar sırası yenilənir, mövqe ona uyğunlaşır
  useEffect(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    scrollToProducts();
  }, [activeGroup, displayedProducts]);

  const handleGroupClick = (group) => {
    if (group === activeGroup) {
      if (group !== "ALL") scrollToProducts();
      return;
    }

    setActiveGroup(group);
    if (group !== "ALL") pendingScrollRef.current = true;
  };

  // Scroll spy hər dəyişiklikdə yenidən render olmasın deyə siyahı yadda saxlanılır
  const productsGrid = useMemo(
    () => (
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-stretch">
        {displayedProducts.map((product) => {
          const imgSrc = product.image || noPhoto;

          return (
            <div key={product._id} data-group={product.categoryName || ""} className="h-full flex flex-col">
              <div
                className="bg-white rounded-[25px] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full"
              >
                {/* Şəkil konteyneri */}
                <div className="w-full aspect-[4/3] relative overflow-hidden shrink-0 bg-gray-50 border-b border-[var(--qr-primary)]">
                  <img
                    src={imgSrc}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = noPhoto;
                    }}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-fill"
                  />
                </div>

                <div className="px-4 py-3 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-sm sm:text-base text-[var(--qr-primary)] font-semibold leading-tight line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-black/60 text-xs sm:text-sm line-clamp-1 mt-1">
                      {product.subName}
                    </p>
                  </div>
                  <div className="text-[18px] sm:text-[20px] md:text-[22px] font-medium text-[var(--qr-primary)] mt-auto pt-2">
                    {product.price} <span>₼</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ),
    [displayedProducts]
  );

  if (notFound) {
    return (
      <div
        style={themeStyle()}
        className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[var(--qr-bg)] text-[var(--qr-primary)] px-4"
      >
        <p className="text-lg font-semibold">404 — Restoran tapılmadı</p>
        <Link to="/" className="underline text-sm">
          Restoranlar siyahısı
        </Link>
      </div>
    );
  }

  return (
    <div style={themeStyle(restaurant?.theme)} className="min-h-screen bg-[var(--qr-bg)]">
      {/* Header / Logo / Language Selection */}
      <div className="container flex flex-row justify-between mx-auto py-4 max-w-[550px] px-2 lg:px-0 md:max-w-[720px] lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl items-center text-[var(--qr-primary)]">
        <div className="flex flex-row items-center gap-3">
          {restaurant?.logo && (
            <img src={restaurant.logo} className="max-h-10 sm:max-h-12 md:max-h-16 lg:max-h-20 shrink" alt={restaurant?.name || "Logo"} />
          )}
          <div className="flex flex-col justify-evenly">
            <span className="text-[18px] sm:text-[20px] md:text-[24px] lg:text-[28px] font-extrabold">
              {restaurant?.name || "Yüklənir..."}
            </span>
            <div className="flex text-[12px] md:text-[16px] items-center tracking-tight lg:text-[20px] gap-1">
              <span>{t.fresh}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--qr-primary)]" />
              <span>{t.local}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--qr-primary)]" />
              <span>{t.seasonal}</span>
            </div>
          </div>
        </div>

        <div className="relative inline-flex items-center">
          <div className="pointer-events-none absolute left-3 z-10 flex items-center justify-center text-[var(--qr-primary)]">
            <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
          </div>
          <select value={lang} onChange={handleLanguageChange} className="appearance-none bg-[var(--qr-soft)] text-[var(--qr-primary)] font-medium text-sm pl-9 pr-8 py-2 rounded-full border border-[var(--qr-border)] focus:outline-none cursor-pointer relative z-0">
            <option value="az">AZ</option>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
          <div className="pointer-events-none absolute right-3 z-10 flex items-center justify-center text-[var(--qr-primary)]">
            <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="container flex flex-row justify-between mx-auto py-2 max-w-137.5 px-2 lg:px-0 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl items-center text-[var(--qr-primary)]">
        <div style={{ backgroundImage: `url(${heroBackground})` }} className="w-full aspect-video rounded-[25px] bg-cover bg-center relative overflow-hidden p-6 lg:p-8 flex items-end">
          <div className="bg-white/80 xl:text-[34px] backdrop-blur-md gap-2 px-3 py-2 items-center justify-between rounded-xl text-[var(--qr-primary)] flex flex-row">
            <i className="fa-regular fa-clock text-[24px] xl:text-[45px]" />
            <span className="flex flex-col gap-0">
              <span className="font-light">{t.everyday}</span>
              <span className="font-medium">{workHours}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Kateqoriya Düymələri Slider/Tab */}
      <div ref={stickyRef} className="sticky top-0 z-30 bg-white/95 backdrop-blur-md py-2 shadow-xs transition-all">
        <div className="container mx-auto px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl">
          <div ref={stripRef} className="flex items-center justify-start overflow-x-auto gap-2 whitespace-nowrap no-scrollbar">
            {availableGroups.map((group) => (
              <button
                key={group}
                ref={(el) => {
                  chipRefs.current[group] = el;
                }}
                onClick={() => handleGroupClick(group)}
                className={`flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full text-sm shrink-0 transition-all ${
                  highlightedGroup === group
                    ? "bg-[var(--qr-primary)] text-white shadow-sm"
                    : "bg-[var(--qr-soft)] text-[var(--qr-primary)] border border-[var(--qr-border)] hover:bg-[var(--qr-soft-hover)]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                  <path d="M7 2v20"/>
                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                </svg>
                <span>{group === "ALL" ? t.all : group}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Başlıq Bölməsi */}
      <div className="container mx-auto px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl text-[var(--qr-primary)] mt-4">
        <div className="flex flex-row items-center justify-between md:justify-start gap-1">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif whitespace-nowrap">
            {t.selectedForYou}
          </h2>
          <div className="h-5 md:h-full lg:h-11.25 md:flex-1 overflow-hidden">
            <img src={divider} className="w-full h-full object-right object-cover mask-[linear-gradient(to_right,transparent_0%,black_100%)]" alt="divider" />
          </div>
        </div>
      </div>

      {/* Məhsullar Siyahısı */}
      <div
        ref={productsRef}
        className="container mx-auto py-4 px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl text-[var(--qr-primary)]"
      >
        {error && <div className="bg-white rounded-[25px] p-6 text-sm text-red-600">{error}</div>}
        {!error && displayedProducts.length === 0 && (
          <div className="bg-white rounded-[25px] p-6 text-sm text-black/60">Məhsul tapılmadı</div>
        )}
        {productsGrid}
      </div>
    </div>
  );
}

import logo from "../assets/img/logo.svg";
import { useEffect, useMemo, useRef, useState } from "react";
import heroImg from "../assets/img/hero.jpg";
import divider from "../assets/img/divider.svg";
import noPhoto from "../assets/img/no_photo.jpeg";

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
    groups: {
      MENYU: "Popular",
      QUTABLAR: "Qutabs",
      "SOYUQ İÇKİLƏR": "Cold Drinks",
      SERVİSLƏR: "Services"
    }
  },
  ru: {
    all: "Все",
    fresh: "Свежий",
    local: "Местный",
    seasonal: "Сезонный",
    everyday: "Каждый день",
    selectedForYou: "Выбрано для вас",
    groups: {
      MENYU: "Популярное",
      QUTABLAR: "Кутабы",
      "SOYUQ İÇKİLƏR": "Холодные напитки",
      SERVİSLƏR: "Услуги"
    }
  }
};

const R2_PUBLIC_URL = "https://pub-28aba3035f5e4b4b9d2246f55c816246.r2.dev";
const API_BASE_URL = "https://api.promar.workers.dev";

export default function Home() {
  const [activeGroup, setActiveGroup] = useState("ALL");
  const [spyGroup, setSpyGroup] = useState("ALL");
  const [data, setData] = useState(null);
  const [imagesMap, setImagesMap] = useState({});
  const [workHours, setWorkHours] = useState("15:00—02:00");
  const [heroBackground, setHeroBackground] = useState(heroImg);

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
    // Məlumatları və şəkillərin siyahısını paralel olaraq çəkirik
    Promise.all([
      fetch(`${API_BASE_URL}/api/data`).then((res) => res.json()),
      fetch(`${API_BASE_URL}/api/get-img`).then((res) => res.json())
    ])
      .then(([menuData, imgData]) => {
        setData(menuData);

        // API-dən gələn faylları mID -> URL xəritəsinə çeviririk
        if (imgData && imgData.files) {
          const map = {};
          imgData.files.forEach((fileKey) => {
            const fileName = fileKey.replace("images/", "");
            const lastDotIndex = fileName.lastIndexOf(".");
            const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

            map[baseName] = `${R2_PUBLIC_URL}/${fileKey}`;
          });
          setImagesMap(map);
        }
      })
      .catch((error) => console.error("Məlumat çəkilərkən xəta:", error));

    // İş saatları və hero şəkli (admin panelindən idarə olunur)
    fetch(`${API_BASE_URL}/api/settings`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.settings) {
          if (res.settings.workHours) setWorkHours(res.settings.workHours);
          if (res.settings.heroImageUrl) setHeroBackground(res.settings.heroImageUrl);
        }
      })
      .catch((error) => console.error("Tənzimlər çəkilərkən xəta:", error));
  }, []);

  const availableGroups = useMemo(
    () =>
      data ? ["ALL", ...Array.from(new Set(data.map((item) => item.mGroup))).filter(Boolean)] : [],
    [data]
  );

  // Kateqoriya başlıqlarını süzgəcdən keçirib yalnız həqiqi məhsulları saxlayırıq
  const products = useMemo(() => {
    if (!data) return [];
    return data.filter((product) => {
      const isGroupHeader =
        product.isGroup === true ||
        product.isGroup === "true" ||
        (product.mName === product.mGroup && (!product.mPrice || Number(product.mPrice) === 0));

      return !isGroupHeader;
    });
  }, [data]);

  // "HAMISI" görünüşündə məhsullar kateqoriya üzrə bitişik bloklara yığılır,
  // seçilmiş kateqoriya olduqda yalnız onun məhsulları qalır
  const displayedProducts = useMemo(() => {
    if (activeGroup !== "ALL") {
      return products.filter((product) => product.mGroup === activeGroup);
    }

    const order = [];
    const byGroup = new Map();
    const loose = [];

    products.forEach((product) => {
      const group = product.mGroup;
      if (!group) {
        loose.push(product);
        return;
      }
      if (!byGroup.has(group)) {
        byGroup.set(group, []);
        order.push(group);
      }
      byGroup.get(group).push(product);
    });

    return [...order.flatMap((group) => byGroup.get(group)), ...loose];
  }, [products, activeGroup]);

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

      // Məhsullar hələ görünməyibsə (hero bölməsi) "HAMISI" aktivdir
      if (container.getBoundingClientRect().top > baseLine) {
        setSpyGroup("ALL");
        return;
      }

      const cards = container.querySelectorAll("[data-group]");
      let next = "";

      const viewportH = window.innerHeight;
      const remaining =
        document.documentElement.scrollHeight - viewportH - window.scrollY;

      if (remaining <= 2) {
        // Tam sona çatılıb: yalnız ən son kateqoriya aktivdir
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].dataset.group) {
            next = cards[i].dataset.group;
            break;
          }
        }
      } else {
        // Sonuna yaxın istinad xətti yavaş-yavaş ekranın altına enir.
        // Beləcə qısa son bloklar (məsələn 4 salat) də növbə ilə aktiv olur,
        // tam sona çatanda isə ən son kateqoriya qalır, əlavə boşluq lazım deyil.
        const zone = Math.max(1, viewportH - baseLine);
        const progress = Math.min(1, Math.max(0, 1 - remaining / zone));
        const refLine = baseLine + (viewportH - baseLine) * progress;

        // Sətirin üstündən keçən ilk görünən məhsulun kateqoriyası aktiv sayılır
        for (const card of cards) {
          const group = card.dataset.group;
          if (!group) continue;
          if (card.getBoundingClientRect().bottom > refLine) {
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
    // Sürətli scroll zamanı ardıcıl animasiyalar bir-birini kəsib gecikmə yaradır,
    // ona görə qısa aralıqla dəyişiklikdə dəqiq mövqeyə ani keçirik
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
          const imgSrc = imagesMap[product.mID] || noPhoto;

          return (
            <div key={product.mID} data-group={product.mGroup || ""} className="h-full flex flex-col">
              <div className="bg-white rounded-[25px] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
                {/* Şəkil konteyneri */}
                <div className="w-full aspect-[4/3] relative overflow-hidden shrink-0 bg-gray-50 border-b border-[#3a513e]">
                  <img
                    src={imgSrc}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = noPhoto;
                    }}
                    alt={product.mName}
                    className="absolute inset-0 w-full h-full object-fill"
                  />
                </div>

                <div className="px-4 py-3 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-sm sm:text-base font-[#3a513e] font-semibold leading-tight line-clamp-2">
                      {product.mName}
                    </h3>
                    <p className="text-black/60 text-xs sm:text-sm line-clamp-1 mt-1">
                      {product.mSubName}
                    </p>
                  </div>
                  <div className="text-[18px] sm:text-[20px] md:text-[22px] font-medium text-[#3a513e] mt-auto pt-2">
                    {product.mPrice} <span>₼</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ),
    [displayedProducts, imagesMap]
  );

  return (
    <>
      {/* Header / Logo / Language Selection */}
      <div className="container flex flex-row justify-between mx-auto py-4 max-w-[550px] px-2 lg:px-0 md:max-w-[720px] lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl items-center text-[#3a513e]">
        <div className="flex flex-row items-center gap-3">
          <img src={logo} className="max-h-10 sm:max-h-12 md:max-h-16 lg:max-h-20 shrink" alt="Jaguar Lounge Logo" />
          <div className="flex flex-col justify-evenly">
            <span className="text-[18px] sm:text-[20px] md:text-[24px] lg:text-[28px] font-extrabold">JAGUAR LOUNGE</span>
            <div className="flex text-[12px] md:text-[16px] items-center tracking-tight lg:text-[20px] gap-1">
              <span>{t.fresh}</span>
              <span className="w-1 h-1 rounded-full bg-[#3a513e]" />
              <span>{t.local}</span>
              <span className="w-1 h-1 rounded-full bg-[#3a513e]" />
              <span>{t.seasonal}</span>
            </div>
          </div>
        </div>

        <div className="relative inline-flex items-center">
          <div className="pointer-events-none absolute left-3 z-10 flex items-center justify-center text-[#3a513e]">
            <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
          </div>
          <select value={lang} onChange={handleLanguageChange} className="appearance-none bg-[#f9f3e7] text-[#3a513e] font-medium text-sm pl-9 pr-8 py-2 rounded-full border border-[#cac2a7]/40 focus:outline-none cursor-pointer relative z-0">
            <option value="az">AZ</option>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
          <div className="pointer-events-none absolute right-3 z-10 flex items-center justify-center text-[#3a513e]">
            <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="container flex flex-row justify-between mx-auto py-2 max-w-137.5 px-2 lg:px-0 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl items-center text-[#3a513e]">
        <div style={{ backgroundImage: `url(${heroBackground})` }} className="w-full aspect-video rounded-[25px] bg-cover bg-center relative overflow-hidden p-6 lg:p-8 flex items-end">
          <div className="bg-white/80 xl:text-[34px] backdrop-blur-md gap-2 px-3 py-2 items-center justify-between rounded-xl text-[#3a513e] flex flex-row">
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
                    ? "bg-[#3a513e] text-white shadow-sm"
                    : "bg-[#f9f3e7] text-[#3a513e] border border-[#cac2a7]/40 hover:bg-[#f5ebd7]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                  <path d="M7 2v20"/>
                  <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                </svg>
                <span>{group === "ALL" ? t.all : (t.groups?.[group] || group)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Başlıq Bölməsi */}
      <div className="container mx-auto px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl text-[#3a513e] mt-4">
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
        className="container mx-auto py-4 px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl text-[#3a513e]"
      >
        {productsGrid}
      </div>
    </>
  );
}
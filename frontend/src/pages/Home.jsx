import logo from "../assets/img/logo.svg";
import { useEffect, useState } from "react";
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
  const [data, setData] = useState(null);
  const [imagesMap, setImagesMap] = useState({});
  const [workHours, setWorkHours] = useState("15:00—02:00");
  const [heroBackground, setHeroBackground] = useState(heroImg);

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

  const availableGroups = data
    ? ["ALL", ...Array.from(new Set(data.map((item) => item.mGroup))).filter(Boolean)]
    : [];

  // Kateqoriya başlıqlarını süzgəcdən keçirib yalnız həqiqi məhsulları saxlayırıq
  const filteredProducts = data
    ? data.filter((product) => {
        // Kateqoriya başlığı olub-olmadığını yoxlayırıq:
        const isGroupHeader =
          product.isGroup === true ||
          product.isGroup === "true" ||
          (product.mName === product.mGroup && (!product.mPrice || Number(product.mPrice) === 0));

        if (isGroupHeader) return false;

        return activeGroup === "ALL" || product.mGroup === activeGroup;
      })
    : [];

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
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md py-2 shadow-xs transition-all">
        <div className="container mx-auto px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl">
          <div className="flex items-center justify-start overflow-x-auto gap-2 whitespace-nowrap no-scrollbar">
            {availableGroups.map((group) => (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                className={`flex items-center cursor-pointer gap-2 px-4 py-2 rounded-full text-sm shrink-0 transition-all ${
                  activeGroup === group
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
      <div className="container mx-auto py-4 px-2 lg:px-0 max-w-137.5 md:max-w-180 lg:max-w-4xl xl:max-w-6xl 2xl:max-w-7xl text-[#3a513e]">
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 items-stretch">
          {filteredProducts.map((product) => {
            const imgSrc = imagesMap[product.mID] || noPhoto;

            return (
              <div key={product.mID} className="h-full flex flex-col">
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
      </div>
    </>
  );
}

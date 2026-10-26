import { useEffect, useState } from "react";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator.standalone === true;

export default function InstallButton({ className = "" }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  if (!deferred && !ios) return null;

  const install = async () => {
    if (!deferred) {
      alert(
        "iPhone/iPad-də quraşdırmaq üçün Safari-də Paylaş düyməsinə basın, sonra \"Ana ekrana əlavə et\" seçin."
      );
      return;
    }
    deferred.prompt();
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === "accepted") setInstalled(true);
  };

  return (
    <button
      type="button"
      onClick={install}
      className={
        className ||
        "bg-[#3a513e] text-white rounded-md py-2 px-4 text-sm font-medium cursor-pointer"
      }
    >
      Tətbiqi quraşdır
    </button>
  );
}

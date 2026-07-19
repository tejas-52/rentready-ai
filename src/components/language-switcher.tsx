import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setAppLanguage, SUPPORTED_LANGS, type Lang } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = (i18n.language?.split("-")[0] ?? "en") as Lang;
  return (
    <label
      className={
        "inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur " +
        className
      }
    >
      <Globe className="h-3.5 w-3.5 text-primary" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        value={current}
        onChange={(e) => void setAppLanguage(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
        aria-label={t("language.label")}
      >
        {SUPPORTED_LANGS.map((l) => (
          <option key={l} value={l}>
            {l === "en" ? "🇬🇧 English" : l === "de" ? "🇩🇪 Deutsch" : "🇮🇳 हिन्दी"}
          </option>
        ))}
      </select>
    </label>
  );
}

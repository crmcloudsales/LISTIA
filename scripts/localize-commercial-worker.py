#!/usr/bin/env python3
"""Idempotently add LISTIA global locales to the existing commercial Worker.

The script intentionally performs exact, narrowly scoped replacements. It never
prints the Worker source and refuses to continue if the expected legacy or final
markers are not present.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


FINAL_MARKER = "const LISTIA_COMMERCIAL_I18N_VERSION = '1.0.0';"

LEGACY_OPTIONS = """        <option value="es">ES</option>
        <option value="en">EN</option>
        <option value="fr">FR</option>"""

GLOBAL_OPTIONS = """        <option value="es">Español</option>
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="it">Italiano</option>
        <option value="pt-BR">Português</option>
        <option value="de">Deutsch</option>
        <option value="ar-AE">العربية</option>"""

LEGACY_CONFIG = """  const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'];
  const FALLBACK_LANGUAGE = 'en';"""

GLOBAL_CONFIG = """  const LISTIA_COMMERCIAL_I18N_VERSION = '1.0.0';
  const LANGUAGE_CONFIG = {
    es: { htmlLang: 'es-MX', dir: 'ltr', aliases: ['es', 'es-mx'] },
    en: { htmlLang: 'en-US', dir: 'ltr', aliases: ['en', 'en-us', 'en-gb'] },
    fr: { htmlLang: 'fr-FR', dir: 'ltr', aliases: ['fr', 'fr-fr', 'fr-ca'] },
    it: { htmlLang: 'it-IT', dir: 'ltr', aliases: ['it', 'it-it'] },
    'pt-BR': { htmlLang: 'pt-BR', dir: 'ltr', aliases: ['pt', 'pt-br', 'pt-pt'] },
    de: { htmlLang: 'de-DE', dir: 'ltr', aliases: ['de', 'de-de', 'de-at', 'de-ch'] },
    'ar-AE': { htmlLang: 'ar-AE', dir: 'rtl', aliases: ['ar', 'ar-ae'] }
  };
  const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG);
  const LANGUAGE_ALIASES = Object.fromEntries(
    Object.entries(LANGUAGE_CONFIG).flatMap(([language, config]) =>
      config.aliases.map((alias) => [alias.toLowerCase(), language])
    )
  );
  const FALLBACK_LANGUAGE = 'en';"""

LEGACY_NORMALIZE = """  function normalizeLanguage(value) {
    if (!value) return null;
    const base = String(value).trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LANGUAGES.includes(base) ? base : null;
  }"""

GLOBAL_NORMALIZE = """  function normalizeLanguage(value) {
    if (!value) return null;
    const code = String(value).trim().toLowerCase().replaceAll('_', '-');
    return LANGUAGE_ALIASES[code] || LANGUAGE_ALIASES[code.split('-')[0]] || null;
  }"""

LEGACY_FRENCH_END = """      devicesAlt: 'Listia sur ordinateur portable, tablette et mobile',
      footerTagline: 'IA pour l’immobilier'
    }
  };"""

GLOBAL_TRANSLATIONS_END = """      devicesAlt: 'Listia sur ordinateur portable, tablette et mobile',
      footerTagline: 'IA pour l’immobilier'
    },
    it: {
      htmlLang: 'it-IT',
      title: 'Listia — IA per il settore immobiliare',
      description: 'Accedi a Listia o scaricala per iPhone, Android o desktop.',
      languageLabel: 'Seleziona lingua',
      heroEyebrow: 'IA per il settore immobiliare',
      heroTitle: 'Accedi a <span class="accent">Listia</span><br>o scaricala sul tuo dispositivo',
      heroLede: 'La piattaforma immobiliare potenziata dall’IA. Disponibile per iPhone, Android e desktop.',
      access: 'Accedi a Listia',
      freeTag: 'Scarica gratuitamente l’app',
      desktop: 'Scarica per desktop',
      brandTitle: 'La piattaforma <span class="accent">immobiliare</span> potenziata dall’IA',
      brandLede: 'Risparmia tempo, genera più lead, automatizza i processi e <strong>concludi più vendite</strong>, tutto in un unico posto.',
      devicesEyebrow: 'Una sola Listia, su ogni schermo',
      devicesTitle: 'Scopri Listia su laptop, tablet e smartphone',
      devicesAlt: 'Listia su laptop, tablet e smartphone',
      footerTagline: 'IA per il settore immobiliare'
    },
    'pt-BR': {
      htmlLang: 'pt-BR',
      title: 'Listia — IA para o mercado imobiliário',
      description: 'Acesse a Listia ou baixe para iPhone, Android ou desktop.',
      languageLabel: 'Selecionar idioma',
      heroEyebrow: 'IA para o mercado imobiliário',
      heroTitle: 'Acesse a <span class="accent">Listia</span><br>ou baixe no seu dispositivo',
      heroLede: 'A plataforma imobiliária com inteligência artificial. Disponível para iPhone, Android e desktop.',
      access: 'Acessar a Listia',
      freeTag: 'Baixe o aplicativo gratuitamente',
      desktop: 'Baixar para desktop',
      brandTitle: 'A plataforma <span class="accent">imobiliária</span> com inteligência artificial',
      brandLede: 'Economize tempo, gere mais leads, automatize processos e <strong>feche mais vendas</strong>, tudo em um só lugar.',
      devicesEyebrow: 'Uma só Listia, em qualquer tela',
      devicesTitle: 'Veja a Listia no laptop, tablet e celular',
      devicesAlt: 'Listia no laptop, tablet e celular',
      footerTagline: 'IA para o mercado imobiliário'
    },
    de: {
      htmlLang: 'de-DE',
      title: 'Listia — KI für Immobilien',
      description: 'Öffnen Sie Listia oder laden Sie die App für iPhone, Android oder Desktop herunter.',
      languageLabel: 'Sprache auswählen',
      heroEyebrow: 'KI für Immobilien',
      heroTitle: 'Öffnen Sie <span class="accent">Listia</span><br>oder laden Sie die App auf Ihr Gerät',
      heroLede: 'Die KI-gestützte Immobilienplattform. Verfügbar für iPhone, Android und Desktop.',
      access: 'Listia öffnen',
      freeTag: 'App kostenlos herunterladen',
      desktop: 'Für Desktop herunterladen',
      brandTitle: 'Die KI-gestützte <span class="accent">Immobilienplattform</span>',
      brandLede: 'Sparen Sie Zeit, gewinnen Sie mehr Leads, automatisieren Sie Abläufe und <strong>schließen Sie mehr Verkäufe ab</strong> – alles an einem Ort.',
      devicesEyebrow: 'Ein Listia, auf jedem Bildschirm',
      devicesTitle: 'Listia auf Laptop, Tablet und Smartphone',
      devicesAlt: 'Listia auf Laptop, Tablet und Smartphone',
      footerTagline: 'KI für Immobilien'
    },
    'ar-AE': {
      htmlLang: 'ar-AE',
      dir: 'rtl',
      title: 'Listia — الذكاء الاصطناعي للعقارات',
      description: 'ادخل إلى Listia أو نزّلها على iPhone أو Android أو الكمبيوتر.',
      languageLabel: 'اختر اللغة',
      heroEyebrow: 'الذكاء الاصطناعي للعقارات',
      heroTitle: 'ادخل إلى <span class="accent">Listia</span><br>أو نزّلها على جهازك',
      heroLede: 'منصة العقارات المدعومة بالذكاء الاصطناعي. متاحة على iPhone وAndroid والكمبيوتر.',
      access: 'الدخول إلى Listia',
      freeTag: 'نزّل التطبيق مجاناً',
      desktop: 'التنزيل للكمبيوتر',
      brandTitle: 'منصة <span class="accent">العقارات</span> المدعومة بالذكاء الاصطناعي',
      brandLede: 'وفّر الوقت، واحصل على مزيد من العملاء المحتملين، وأتمت العمليات، و<strong>أغلق مزيداً من الصفقات</strong> في مكان واحد.',
      devicesEyebrow: 'Listia واحدة على كل شاشة',
      devicesTitle: 'شاهد Listia على الكمبيوتر المحمول والجهاز اللوحي والهاتف',
      devicesAlt: 'Listia على الكمبيوتر المحمول والجهاز اللوحي والهاتف',
      footerTagline: 'الذكاء الاصطناعي للعقارات'
    }
  };"""

LEGACY_APPLY = """    document.documentElement.lang = t.htmlLang;
    document.documentElement.dataset.listiaLanguage = normalized;"""

GLOBAL_APPLY = """    const config = LANGUAGE_CONFIG[normalized] || LANGUAGE_CONFIG[FALLBACK_LANGUAGE];
    document.documentElement.lang = config.htmlLang;
    document.documentElement.dir = config.dir;
    document.documentElement.dataset.listiaLanguage = normalized;"""

RTL_CSS = """

  /* LISTIA commercial global i18n v1.0.0 */
  html[dir="rtl"] body { direction: rtl; }
  html[dir="rtl"] .layout,
  html[dir="rtl"] .brand-card,
  html[dir="rtl"] .devices-section { text-align: right; }
  html[dir="rtl"] .devices-shot { direction: ltr; }
"""


def replace_exact(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected exactly one legacy anchor, found {count}")
    return source.replace(old, new, 1)


def validate_final(source: str) -> None:
    required = [
        FINAL_MARKER,
        '<option value="it">Italiano</option>',
        '<option value="pt-BR">Português</option>',
        '<option value="de">Deutsch</option>',
        '<option value="ar-AE">العربية</option>',
        "'ar-AE': {",
        "document.documentElement.dir = config.dir;",
        "LISTIA commercial global i18n v1.0.0",
    ]
    missing = [marker for marker in required if marker not in source]
    if missing:
        raise ValueError("final localization markers missing: " + ", ".join(missing))


def localize(source: str) -> tuple[str, bool]:
    if FINAL_MARKER in source:
        validate_final(source)
        return source, False

    result = replace_exact(source, LEGACY_OPTIONS, GLOBAL_OPTIONS, "language selector")
    result = replace_exact(result, LEGACY_CONFIG, GLOBAL_CONFIG, "language config")
    result = replace_exact(result, LEGACY_FRENCH_END, GLOBAL_TRANSLATIONS_END, "translation table")
    result = replace_exact(result, LEGACY_NORMALIZE, GLOBAL_NORMALIZE, "language normalization")
    result = replace_exact(result, LEGACY_APPLY, GLOBAL_APPLY, "document locale")
    result = replace_exact(result, "</style>", RTL_CSS + "\n</style>", "RTL stylesheet")
    validate_final(result)
    return result, True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?")
    parser.add_argument("output", nargs="?")
    parser.add_argument("--check-stdin", action="store_true")
    args = parser.parse_args()

    if args.check_stdin:
        source = sys.stdin.read()
        localize(source)
        print("Commercial localization anchors verified.")
        return 0

    if not args.input or not args.output:
        parser.error("input and output paths are required")

    source = Path(args.input).read_bytes().decode("utf-8")
    localized, changed = localize(source)
    Path(args.output).write_bytes(localized.encode("utf-8"))
    print("Commercial Worker localization prepared." if changed else "Commercial Worker localization already current.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

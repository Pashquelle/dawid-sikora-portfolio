# DESIGN.md — system wizualny

Kierunek: **„Panel danych"**, zgodnie z `context/reference.html`.
Źródła: `context/brand.md` (fundamenty i zakazy), `context/reference.html` (kierunek),
`context/wireframe-dawid-sikora.html` (treść i struktura).

Ten dokument ustala tokeny i reguły. **Nie projektuje komponentów** — wygląd komponentów
powstaje w module o budowie stron.

---

## 1. Filozofia

Strona ma się czytać jak dobrze zaprojektowany panel danych, a nie jak folder reklamowy:
wszystko jest na wierzchu, w siatce, w tabeli, bez zasłon. Pierwsze wrażenie to
„ktoś tu panuje nad złożonością" — gęsto, technicznie, uporządkowane, ale ciepłe w kolorze,
więc nie zimne i nie korporacyjne. Kolor pojawia się wyłącznie tam, gdzie coś znaczy;
resztę roboty robią linia, odstęp i typografia.

---

## 2. Kolory

Wszystkie wartości kontrastu policzone względem `--bg` (#EBE8E0) wg WCAG 2.1.
Próg dla zwykłego tekstu: **4.5:1**. Dla elementów interaktywnych i ramek: **3:1**.

### Powierzchnie

| Token | Wartość | Gdzie się tego używa |
|---|---|---|
| `--bg` | `#EBE8E0` | tło całej strony — hero, sekcje `work`, `tools`, `contact`, stopka |
| `--surface` | `#E3DFD5` | tło sekcji odciętych od reszty (`process`, `about` — w wireframie `.bg-soft`), wypełnienie miejsc na obraz (`.ph`) |
| `--surface-inverse` | `#171713` | odwrócone stany: CTA po najechaniu, ewentualny ciemny pas stopki |

### Tekst

| Token | Wartość | Kontrast do `--bg` | Gdzie się tego używa |
|---|---|---|---|
| `--text` | `#171713` | **15.1:1** | nagłówki H1–H3, tekst ciągły, wartości w tabeli metadanych, brandmark, linki nawigacji |
| `--text-soft` | `#4A4A3F` | **7.3:1** | tekst drugorzędny: opisy kroków procesu, treść `.value` w kartach projektów, akapit „about", zdanie o alternatywnym kanale kontaktu |
| `--text-muted` | `#63604F` | **5.2:1** | etykiety i nagłówki kolumn pisane wersalikami: `.eyebrow`, `.label`, `.story-meta`, `.step-no`, `th` w tabeli metadanych, linki w stopce |
| `--text-inverse` | `#EBE8E0` | — (na `--surface-inverse`: **15.1:1**) | tekst na ciemnym tle |

> **Korekta wobec `reference.html`:** referencja używa `--ink-mute: #7C7867`, który daje
> tylko **3.6:1** — za mało dla zwykłego tekstu. Etykiety w tym projekcie bywają małe
> (11–12 px), więc token został przyciemniony do `#63604F`. Charakter koloru bez zmian,
> kontrast zgodny (5.2:1 na `--bg`, 4.8:1 na `--surface`). Wartości `#7C7867` nie używamy.

### Linie

| Token | Wartość | Gdzie się tego używa |
|---|---|---|
| `--line-strong` | `#171713` | linie nośne siatki: górna krawędź paska nawigacji, linia zamykająca hero, ramka przycisku, podziały sekcji (`.divider`) |
| `--line` | `#C9C5B8` | linie wewnętrzne i dekoracyjne: wiersze tabeli metadanych, wiersze `.facts`, podział kolumn, dolna krawędź paska nawigacji |
| `--line-control` | `#85806D` | ramki elementów interaktywnych w spoczynku, gdy nie używamy `--line-strong` (**3.2:1** — spełnia próg 3:1). `--line` ma tylko 1.4:1 i **nie może** nieść znaczenia — wolno nią rysować wyłącznie dekoracyjną siatkę |

### Akcent i status

| Token | Wartość | Gdzie się tego używa |
|---|---|---|
| `--accent` | `#D8F23A` | **tło, nigdy tekst na jasnym**: podświetlenie `.trait` w H1, wypełnienie głównego CTA, podświetlenie linku nawigacji po najechaniu; jako kolor tekstu tylko na `--surface-inverse` (**14.7:1**) |
| `--accent-ink` | `#171713` | tekst kładziony na `--accent` — **14.7:1** |
| `--status-ok` | `#1F6F3E` | wskaźnik dostępności „Open to new roles" (`.lamp`) — **5.0:1**, więc można nim też napisać sam status |

**Twarda zasada akcentu:** `--accent` na `--bg` daje **1.03:1** — limonkowy tekst na tle
strony jest fizycznie nieczytelny. Akcent działa jako pole wypełnienia z `--accent-ink`
na wierzchu, albo wcale.

---

## 3. Typografia

**Jeden krój na całej stronie: JetBrains Mono** (400 / 500 / 700).
Fallback: `ui-monospace, SFMono-Regular, Menlo, monospace`.

Brand mówi o „swobodnej, szeryfowej, miejscami technicznej" typografii — w kierunku
„Panel danych" wygrywa część techniczna, a swoboda idzie w ujemny tracking i rwany rytm
wierszy, nie w drugi krój. Drugiego kroju nie dokładamy.

Baza: `16px = 1rem`. Wysokość wiersza tekstu ciągłego: **1.6**.

| Token | Rozmiar | Waga / line-height / tracking | Użycie |
|---|---|---|---|
| `--text-display` | `clamp(1.8rem, 3.9vw, 3.1rem)` | 700 / 1.22 / `-0.045em` | H1 w hero — raz na stronę |
| `--text-h2` | `clamp(1.5rem, 2.6vw, 2.1rem)` | 700 / 1.25 / `-0.03em` | nagłówki sekcji: process, work, about, contact |
| `--text-h3` | `1.125rem` (18px) | 700 / 1.35 / `-0.01em` | tytuł kroku procesu, tytuł projektu w karcie |
| `--text-lead` | `1rem` (16px) | 400 / 1.6 / `0` | akapit wprowadzający pod H2, akapit „about" |
| `--text-body` | `0.9375rem` (15px) | 400 / 1.6 / `0` | tekst ciągły, opisy kroków, treść `.value` |
| `--text-small` | `0.8125rem` (13px) | 500 / 1.5 / `0` | komórki tabeli metadanych, wiersze `.facts`, adres e-mail |
| `--text-label` | `0.75rem` (12px) | 400 / 1.4 / `0.1em`, UPPERCASE | `.eyebrow`, `.label`, `th`, `.story-meta`, etykieta „Email" |
| `--text-micro` | `0.6875rem` (11px) | 400 / 1.4 / `0.06em`, UPPERCASE | pasek nawigacji, tekst przycisku, status, stopka |

Reguły:
- Wersaliki tylko w `--text-label` i `--text-micro`. Nigdy w nagłówkach ani w tekście ciągłym.
- Maksymalna długość wiersza: **21ch** dla H1, **22ch** dla H2, **68ch** dla tekstu ciągłego.
- Liczby (`.step-no`, lata, metryki) zawsze `font-variant-numeric: tabular-nums` — to panel danych.
- Waga 500 jest zarezerwowana dla wartości w tabelach: odróżnia dane od etykiety.

---

## 4. Odstępy

Skala oparta na 4 px. Używamy wyłącznie tych stopni.

| Token | px | Użycie |
|---|---|---|
| `--space-1` | 4 | wewnętrzny luz podświetlenia `.trait`, odstęp ikona ↔ etykieta |
| `--space-2` | 8 | lampka statusu do tekstu, odstępy w grupach inline |
| `--space-3` | 12 | padding pionowy wiersza tabeli, padding paska nawigacji |
| `--space-4` | 16 | odstęp między elementami w wierszu, nagłówek do pierwszego akapitu |
| `--space-5` | 20 | odstępy w nawigacji, wewnętrzny padding mniejszych bloków |
| `--space-6` | 24 | padding poziomy przycisku, odstęp etykieta ↔ wartość |
| `--space-8` | 32 | odstęp między akapitami, luz wewnątrz karty projektu |
| `--space-10` | 40 | nagłówek do CTA |
| `--space-12` | 48 | odstęp między krokami procesu i między kafelkami narzędzi |
| `--space-16` | 64 | H2 do zawartości sekcji, odstęp między kartami projektów |
| `--space-20` | 80 | padding pionowy sekcji na mobile |
| `--space-24` | 96 | padding pionowy sekcji na desktopie |
| `--space-32` | 128 | oddech wokół hero |

Marginesy boczne (gutter): `4vw`, minimum `--space-5` (20 px), maksimum `--space-24` (96 px).
Szerokość kontenera `.wrap`: maks. **1280 px**.

---

## 5. Kształty i głębia

| Token | Wartość | Uzasadnienie |
|---|---|---|
| `--radius` | `0` | wszystko: przyciski, karty, pola, obrazy, kafelki narzędzi |
| `--shadow` | `none` | głębi nie budujemy cieniem |
| `--border-width` | `1px` | jedyna grubość linii na całej stronie |

Hierarchię i głębię robimy **trzema rzeczami** i niczym więcej:

1. **kolorem linii** — `--line-strong` dzieli, `--line` porządkuje wewnątrz,
2. **odstępem** — gęsto w tabelach, luźno między sekcjami,
3. **odwróceniem** — blok na `--surface-inverse` albo `--accent` wychodzi na wierzch.

Jedyny wyjątek od `--border-width`: obrys ostrości (`:focus-visible`) — `2px` w `--text`
z odstępem `2px`. Ostrość musi być widoczna, nawet jeśli łamie rytm siatki.

---

## 6. Komponenty do zaprojektowania

Lista wynika z przeglądu `context/wireframe-dawid-sikora.html` — to elementy, które
powtarzają się co najmniej dwa razy albo wrócą na podstronach (`/projects`,
`/projects/[slug]`, `/about`) wg `context/sitemap.html`.

| Komponent | Po co jest |
|---|---|
| **Header / nav bar** | stała belka na każdej stronie: brandmark, linki sekcji, mały CTA „Email me"; otwiera siatkę linią nośną |
| **Footer** | zamknięcie każdej strony: podpis, e-mail, LinkedIn, CV |
| **Button** | jedno CTA w trzech zastosowaniach: główne (wypełnione akcentem), ghost („See all work", „Download CV") i małe (w nawigacji) |
| **Text link** | link inline i link kierunkowy („Read the case study", „More about me") |
| **Status pill** | dostępność do pracy: wskaźnik + tekst; wraca w hero i przy kontakcie |
| **Eyebrow / section label** | wersalikowa etykieta otwierająca każdą sekcję; nadaje sekcjom rangę bez dokładania kroju |
| **Data table (metadata)** | tabela wiersz po wierszu: rola, domena, zakres, status; serce kierunku, wraca w hero i w case studies |
| **Project card / story** | trzy razy na stronie głównej i cały listing `/projects`: podgląd, meta, tytuł, lista faktów, link |
| **Fact row (Problem / What I did / Result)** | wiersz etykieta ↔ wartość; wielokrotnie w każdej karcie i w case study |
| **Process step** | numerowany krok z tytułem i opisem; trzy sztuki, wraca w case studies |
| **Tool tile** | kafelek ikona + nazwa narzędzia; sześć sztuk w siatce |
| **Media placeholder** | miejsce na obraz w proporcjach 3:2 i 1:1, zanim trafią tam realne materiały |
| **Contact box** | blok z adresem e-mail i dwiema akcjami |
| **Section divider** | pozioma linia nośna rozdzielająca sekcje — element systemu, nie ozdobnik |

**Pole formularza — świadomie poza listą.** W obowiązującym wireframie nie ma formularza:
kontakt to `mail-box` z adresem i przyciskiem `mailto:`. Nie projektujemy pola, którego
w treści nie ma. Jeśli formularz ma się pojawić, to decyzja do podjęcia osobno — wtedy
dopisujemy tu `Input`, `Textarea` i `Field label`, a ich ramki biorą `--line-control`.

---

## 7. Czego nie robimy

Z `context/brand.md`:

- **Żadnych zdjęć stockowych.**
- **Żadnych ilustracji corporate memphis.**
- **Żadnej grafiki 3D** — brył, renderów, mockupów w perspektywie.
- **Żadnej cukierkowości** — pasteli, serduszek, zaokrągleń „dla miłego wrażenia".

Z kierunku „Panel danych":

- **Bez zaokrągleń.** `border-radius` jest zawsze `0`. Dotyczy też obrazów i awatarów.
- **Bez cieni i poświat.** Żadnego `box-shadow`, `text-shadow`, `filter: blur()`.
- **Bez gradientów.** Kolory są płaskie — żadnych przejść tonalnych w tle ani w tekście.
- **Bez drugiego kroju.** Nic poza JetBrains Mono — dotyczy też cytatów i ikon typograficznych.
- **Bez limonkowego tekstu na tle strony** — 1.03:1, znika. Akcent wyłącznie jako pole.
- **Drugi akcent jest zakazany.** Jedna barwa sygnałowa. `--status-ok` to wskaźnik stanu, nie kolor marki.
- **Bez emoji w interfejsie.** Status pokazuje kwadrat koloru, nie 🟢.
- **Bez ikon dekoracyjnych.** Ikona pojawia się tylko tam, gdzie nazywa konkretne narzędzie.
- **Bez wyśrodkowanego tekstu ciągłego.** Siatka jest lewostronna; środek łamie rytm tabeli.
- **Bez kolorowych „kart" na tle.** Blok wydzielamy linią albo `--surface`, nie prostokątem w innym kolorze.
- **Bez podkreślenia jako jedynego sygnału linku** i bez samego koloru jako jedynego sygnału stanu.
- **Bez lorem ipsum** w materiale pokazywanym komukolwiek — puste miejsca oznaczamy `[DO UZUPEŁNIENIA — …]`.

---

## 8. Animacje

*Do uzupełnienia w kolejnej lekcji.*

Co tu trafi: czasy trwania i krzywe, zachowanie mechaniki `.trait` w H1 (wygaszanie
wszystkich pól przy najechaniu na nagłówek, przywracanie pojedynczej cechy), stany
`:hover` i `:focus-visible` przycisków i kart, wejścia sekcji przy przewijaniu oraz
obsługa `prefers-reduced-motion`.

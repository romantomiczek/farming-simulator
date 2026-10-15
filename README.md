# Zlaté lány

Low-poly farmářská hra v prohlížeči. Herní smyčka je jako ve Farming Simulatoru (sklizeň, prodej, orba a kultivace, hnojení, setí, růst, sláma a balíky, nákup polí), vzhled je inspirovaný hrou The Headlands.

## Spuštění

Potřebuješ [Node.js](https://nodejs.org) 18 nebo novější.

- **Nejjednodušeji:** dvojklik na `spustit.bat`. Poprvé nainstaluje závislosti a pak otevře hru v prohlížeči.
- **Z příkazové řádky:**

```bash
npm install
npm run dev
```

Hra pak běží na <http://localhost:5173>. Příkaz `npm run build` vytvoří ve složce `dist/` statickou verzi, kterou jde nahrát na jakýkoli webhosting.

## Ovládání

| Klávesa | Akce |
| --- | --- |
| W / S | plyn, brzda, couvání |
| A / D | zatáčení |
| Mezerník | spustit / zvednout nářadí |
| Tab | přesednout do dalšího stroje (traktor → kombajn → sklízeč cukrovky) |
| F | prodej zrna u sil, překládka z kombajnu do přívěsu, vysypání přívěsu, prodej balíků u stodoly, výměna nářadí v kůlně, koupě pole u cedule |
| 1–6 | v kůlně: přímý výběr nářadí traktoru (1–6) nebo adaptéru kombajnu (1–2) |
| R | v kůlně: oprava stroje a připojeného nářadí |
| K | kancelář: obchod se stroji, zakázky, finance (čas se zastaví) |
| C | změnit osivo |
| T | rychlost času 1× / 5× / 20× |
| Q / E, tažení myší | otočení kamery |
| kolečko | přiblížení |
| Esc | menu, nastavení grafiky, uložení do souboru |

## Stroje a plodiny

| Nářadí traktoru | Šířka | Co dělá |
| --- | --- | --- |
| 1 Kultivátor | 4,2 m | strniště → zkultivovaná půda |
| 2 Pluh | 3,2 m | totéž, pomaleji, ale +15 % výnosu |
| 3 Secí stroj | 4 m | zasívá zvolenou plodinu (C) |
| 4 Rozmetadlo | 12 m | hnojivo za 2 Kč/m², +25 % výnosu (i na rostoucí plodiny) |
| 5 Lis na balíky | 2 m | sbírá řádky slámy, každých 60 m² vyhodí balík |
| 6 Přívěs | 14 000 l / 8 balíků | odvoz zrna nebo balíků |

Kombajn má dva adaptéry: **žací lištu** na pšenici, ječmen a řepku a **řádkový adaptér** na kukuřici a slunečnici. Vyměníš je v kůlně (F nebo 1–2).

**Cukrovku** sklízí jen samojízdný **sklízeč cukrovky** (zásobník 20 000 l). Stojí u sil a přesedneš do něj klávesou Tab. Vykládá stejně jako kombajn: ve žlutém kruhu u sil, nebo dopravníkem vlevo do přívěsu.

Pšenice a ječmen nechávají za kombajnem řádek slámy. Slisuj ho dřív, než pole zkultivuješ nebo zoráš, jinak sláma zmizí. Přívěs naloží balíky sám, když kolem nich projedeš, a prodáš je v hnědém kruhu před stodolou.

## Svět

Údolí se táhne od farmy na východ. Hlavní silnice vede kolem polí 5 a 6 do vesnice s kostelem. Na prodej je šest polí (3–8).

| Výkup | Kde | Co bere | Cena |
| --- | --- | --- | --- |
| Družstvo | u sil na farmě | všechno | 95 % |
| Mlýn Zlatý klas | u vjezdu do vesnice | pšenice, ječmen | 110–112 % |
| Olejna | za vesnicí jižně od silnice | řepka, slunečnice | 112–114 % |
| Cukrovar a bioplynka | na konci silnice | cukrovka, kukuřice | 110–115 % |

Ceny každého výkupu kolísají jinak. Ceník vpravo ukazuje pro každou plodinu, kde se teď prodá nejdráž. Minimapa sleduje stroj, ve kterém sedíš.

**Roční období** trvají tři dny a hra začíná v létě. Na jaře rostou plodiny normálně, v létě rychleji a na podzim pomaleji. V zimě nic neroste a nesije se. Krajina a stromy mění barvu.

**Počasí** se mění po čtyřech hodinách: jasno, oblačno, déšť, v zimě sněžení. Za deště a hodinu po něm se nesklízí. Déšť trochu urychlí růst. Předpověď je pod hodinami.

## Ekonomika

**Kancelář (K)** má tři záložky. Dokud je otevřená, čas stojí.

- **Obchod:** na začátku vlastníš traktor, kombajn, kultivátor, secí stroj a přívěs. Pluh, rozmetadlo, lis, řádkový adaptér a sklízeč cukrovky koupíš, nebo pronajmeš (5 % ceny předem a 1,2 % ceny za každý den). Vlastní stroj prodáš za 55 % ceny podle stavu.
- **Zakázky:** obděláváš sousedova pole, která ti nepatří (sklizeň, kultivace, orba, setí, hnojení). Osivo a hnojivo dodá soused a úrodu si odveze sám. Odměnu dostaneš, když do dvou dnů dokončíš 90 % práce. Nové nabídky přicházejí s každým dnem.
- **Finance:** úvěr až 1 000 000 Kč po 100 000 Kč s úrokem 0,4 % denně. Najdeš tu i nouzový dovoz 60 l nafty, když v poli dojde.

**Nafta:** stroje ji spotřebovávají při jízdě a víc při práci. Tankuje se v červeném kruhu u čerpací stanice vedle kůlny (F, 36 Kč/l). Bez nafty se stroj nerozjede.

**Opotřebení:** stroj i nářadí ztrácejí stav prací. Pod 50 % jezdí pomaleji a víc žerou. Opravíš je v kůlně klávesou R.

Úroky a leasing se strhávají o půlnoci. Starší uložené hry si ponechají všechny stroje, které v nich už byly.

## Přívěs na zrno

1. V kůlně připoj klávesou F přívěs (kultivátor → secí stroj → přívěs).
2. Postav přívěs vlevo od kombajnu, pod jeho výsypnou rouru.
3. Stiskni F v kombajnu nebo v traktoru. Zrno se přeloží, přívěs pojme 14 000 l.
4. Zajeď s přívěsem do žlutého kruhu u sil a stiskni F. Korba se zvedne a zrno se prodá.

Vykládka kombajnu běží dál, i když přesedneš do druhého stroje (Tab). Když přívěs během vykládky odjede, kombajn počká s vysunutou rourou, dokud se přívěs nevrátí. Vykládku zastavíš znovu klávesou F.

## Výkon

Cílový počítač: notebook s Intel Core i7-5500U, 8 GB RAM, GeForce 840M a Intel HD 5500.

- **Cíl:** 60 FPS v 1080p na 840M s kvalitou Střední, alespoň 30 FPS na Intel HD 5500 s kvalitou Nízká.
- **Rozpočet scény:** do 300 vykreslovacích volání a 300 tisíc trojúhelníků na snímek.
- **Měřič FPS:** v pravém horním rohu ukazuje FPS, nejhorší snímek, počet vykreslovacích volání a trojúhelníků. Vypíná se v menu.
- **Notebook se dvěma grafikami:** Windows často nechá prohlížeč na integrované Intel. Ve Windows otevři Nastavení → Systém → Obrazovka → Grafika, přidej prohlížeč, zvol „Vysoký výkon“ a prohlížeč restartuj. Hra v menu ukazuje, kterou kartu používá.

Jak to držíme nízko:

- Statické budovy a díly strojů se při startu slučují podle materiálu (`bake()` v `src/render/materials.js`), takže místo stovek objektů se kreslí desítky.
- Plodiny, stromy, živé ploty i částice jsou instancované (jedno volání na druh).
- HUD nepoužívá rozmazání pozadí ani CSS filtry přes plátno a sahá do DOM jen při změně hodnoty.

## Struktura

```
src/
  main.js              start hry a hlavní smyčka
  core/                pomocné funkce, vstup, nastavení grafiky
  render/              renderer, materiály a slučování, kamera, den a noc
  world/               rozvržení mapy, terén, budovy, vegetace, pole
  vehicles/            modely a jízda strojů
  game/                stav hry, plodiny a ceny, práce nářadí, akce, ukládání
  fx/                  částice (prach, plevy, kouř)
  ui/                  HUD, minimapa, menu, měřič FPS, hlášky
prototyp/              původní jednosouborový prototyp
```

## Plán

1. **Základ:** projekt s moduly, nastavení grafiky, měřič FPS, ukládání do souboru (hotovo).
2. **Logistika:** přívěs na zrno, překládka z kombajnu a vysypání ve výkupu (hotovo).
3. **Polní práce:** orba, hnojení, sláma a balíky, kukuřice a slunečnice s řádkovým adaptérem, cukrovka se sklízečem (hotovo).
4. **Ekonomika:** obchod se stroji (nákup, pronájem, prodej), nafta a opotřebení, zakázky u souseda, úvěr (hotovo).
5. **Svět:** větší mapa s vesnicí a osmi poli, čtyři výkupy s různými cenami, roční období a počasí (hotovo).
6. **Pomocníci:** najatí řidiči.

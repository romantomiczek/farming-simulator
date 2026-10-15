# Zlaté lány

Low-poly farmářská hra v prohlížeči. Herní smyčka je jako ve Farming Simulatoru: sklizeň a prodej ve výkupech, orba, kultivace, hnojení, setí, sláma a balíky, nákup polí a strojů, zakázky, úvěr, roční období a počasí, najatí pomocníci, zvířata, skleníky a les. Vzhled je inspirovaný hrou The Headlands.

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
| Tab | přesednout do dalšího stroje, který vlastníš (traktor, kombajn, sklízeč cukrovky, harvestor) |
| F | prodej úrody ve výkupu, krmení zvířat, překládka do přívěsu, vysypání přívěsu, prodej balíků u stodoly, tankování, voda pro skleníky, kácení stromu a prodej dřeva, výměna nářadí v kůlně, koupě pole u cedule |
| 1–7 | v kůlně: přímý výběr nářadí traktoru (1–7) nebo adaptéru kombajnu (1–2) |
| R | v kůlně: oprava stroje a připojeného nářadí |
| K | kancelář: obchod se stroji, zakázky, finance (čas se zastaví) |
| H | najmout pomocníka pro stroj, ve kterém sedíš, nebo ho propustit |
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
| 6 Přívěs | 14 000 l / 8 balíků | odvoz úrody nebo balíků |
| 7 Cisterna na vodu | 8 000 l | voda z rybníka pro skleníky |

Kombajn má dva adaptéry: **žací lištu** na pšenici, ječmen a řepku a **řádkový adaptér** na kukuřici a slunečnici. Vyměníš je v kůlně (F nebo 1–2).

**Cukrovku** sklízí jen samojízdný **sklízeč cukrovky** (zásobník 20 000 l). Na začátku ho nevlastníš: koupíš nebo pronajmeš ho v Kanceláři (K), pak stojí u sil a přesedneš do něj klávesou Tab. Vykládá stejně jako kombajn: v kruhu výkupu, který cukrovku bere (Cukrovar, Družstvo), nebo dopravníkem vlevo do přívěsu.

Pšenice a ječmen nechávají za kombajnem řádek slámy. Slisuj ho dřív, než pole zkultivuješ nebo zoráš, jinak sláma zmizí. Přívěs naloží balíky sám, když kolem nich projedeš, a prodáš je v hnědém kruhu před stodolou. Balíky na poli stroje odstrkují.

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

## Zvířata, skleníky a les

Všechno se kupuje v Kanceláři (K) → Obchod. Přehled zásob a produkce je v záložce **Farma**. Mléko, vejce a rajčata se odvážejí a platí o půlnoci.

| Budova | Kde | Co potřebuje | Co dává |
| --- | --- | --- | --- |
| Kravín s 10 kravami | jihozápadně od farmy | ječmen, kukuřice nebo cukrovka (480 l denně) | 1 440 l mléka denně po 9 Kč |
| Kurník se 40 slepicemi | vedle kravína | pšenice nebo ječmen (240 l denně) | 96 vajec denně po 15 Kč |
| Skleník s rajčaty (2×) | mezi farmou a rybníkem | voda (960 l denně na skleník) | 240 kg rajčat denně po 24 Kč |

- **Krmení:** zajeď sklízečem nebo traktorem s přívěsem do kruhu u budovy (zelený u kravína, žlutý u kurníku) a stiskni F. Úroda se vyloží do krmelce místo prodeje. Hladová zvířata nic nedají.
- **Voda:** cisternou (kůlna, klávesa 7) naber vodu klávesou F u rybníka a vylij ji v modrém kruhu u skleníků.
- **Les:** na severu je smrková plantáž. Harvestor kácí stromy, které dorostly aspoň na 85 % (F u stromu), a pojme 18 m³ dřeva. Dřevo prodáš na pile na konci polní cesty (F, kolem 950 Kč/m³). Místo pokáceného stromu vyroste za čtyři dny nový, v zimě roste pomaleji.
- **Vylepšení:** výkonnější motor traktoru (50 km/h, o 10 % rychlejší práce), široký kultivátor 6,3 m, větší zásobník kombajnu (13 000 l) a nástavba přívěsu (22 000 l).

Budovy a vylepšení se nedají pronajmout, jen koupit.

## Pomocníci

Zajeď strojem na pole a stiskni **H**. Pomocník převezme řízení a ty přesedneš do dalšího volného stroje.

- **Jak pracuje:** jezdí v pruzích sem a tam a na konci pruhu zvedne nářadí a otočí se. Nakonec projede souvratě na obou koncích pole.
- **S čím pracuje:** kultivátor, pluh, secí stroj (seje zvolené osivo), rozmetadlo, lis, kombajn i sklízeč cukrovky. S přívěsem nepracuje.
- **Mzda:** 600 Kč za hodinu práce. Hodina práce je minuta skutečného času, takže zrychlený čas (T) mzdu nenafoukne. Nafta a opotřebení se počítají jako při tvé jízdě.
- **Čekání:** sklízeč s plným zásobníkem čeká, až mu přistavíš přívěs a vyložíš ho (F). Za deště čeká, až plodiny oschnou.
- **Konec:** skončí, když je pole hotové, dojde nafta nebo peníze. Kdykoli ho propustíš klávesou H ve stroji, který řídí.
- **Zakázky:** na sousedově poli může pracovat, jen když tam máš zakázku s odpovídajícím nářadím.
- **Překážky:** pomocník nikdy neprojede budovou, plotem, stromem ani zaparkovaným strojem. Když mu něco stojí v cestě déle než 8 sekund, skončí s hlášením.
- **Ukládání:** pomocníci se ukládají i s rozpracovanou trasou. Po načtení hry pokračují tam, kde skončili.

## Ekonomika

**Kancelář (K)** má tři záložky. Dokud je otevřená, čas stojí.

- **Obchod:** na začátku vlastníš traktor, kombajn, kultivátor, secí stroj a přívěs. Pluh, rozmetadlo, lis, řádkový adaptér a sklízeč cukrovky koupíš, nebo pronajmeš (5 % ceny předem a 1,2 % ceny za každý den). Vlastní stroj prodáš za 55 % ceny podle stavu.
- **Zakázky:** obděláváš sousedova pole, která ti nepatří (sklizeň, kultivace, orba, setí, hnojení). Osivo a hnojivo dodá soused a úrodu si odveze sám. Odměnu dostaneš, když do dvou dnů dokončíš 90 % práce. Nové nabídky přicházejí s každým dnem.
- **Finance:** úvěr až 1 000 000 Kč po 100 000 Kč s úrokem 0,4 % denně. Najdeš tu i nouzový dovoz 60 l nafty, když v poli dojde.

**Nafta:** stroje ji spotřebovávají při jízdě a víc při práci. Tankuje se v červeném kruhu u čerpací stanice vedle kůlny (F, 36 Kč/l). Bez nafty se stroj nerozjede.

**Opotřebení:** stroj i nářadí ztrácejí stav prací. Pod 50 % jezdí pomaleji a víc žerou. Opravíš je v kůlně klávesou R.

Úroky a leasing se strhávají o půlnoci. Starší uložené hry si ponechají všechny stroje, které v nich už byly.

## Přívěs na úrodu

1. V kůlně připoj přívěs klávesou 6 (nebo procházej nářadí klávesou F).
2. Postav přívěs vlevo od kombajnu nebo sklízeče, pod jeho výsypnou rouru.
3. Stiskni F ve sklízeči nebo v traktoru. Úroda se přeloží, přívěs pojme 14 000 l.
4. Zajeď s přívěsem do kruhu výkupu, který tu plodinu bere, a stiskni F. Korba se zvedne a úroda se prodá.

Vykládka sklízeče běží dál, i když přesedneš do jiného stroje (Tab). Když přívěs během vykládky odjede, sklízeč počká s vysunutou rourou, dokud se přívěs nevrátí. Vykládku zastavíš znovu klávesou F.

## Výkon

Cílový počítač: notebook s Intel Core i7-5500U, 8 GB RAM, GeForce 840M a Intel HD 5500.

- **Cíl:** 60 FPS v 1080p na 840M s kvalitou Střední, alespoň 30 FPS na Intel HD 5500 s kvalitou Nízká.
- **Rozpočet scény:** do 300 vykreslovacích volání a 300 tisíc trojúhelníků na snímek.
- **Měřič FPS:** v pravém horním rohu ukazuje FPS, nejhorší snímek, počet vykreslovacích volání a trojúhelníků. Vypíná se v menu.
- **Notebook se dvěma grafikami:** Windows často nechá prohlížeč na integrované Intel. Ve Windows otevři Nastavení → Systém → Obrazovka → Grafika, přidej prohlížeč, zvol „Vysoký výkon“ a prohlížeč restartuj. Hra v menu ukazuje, kterou kartu používá.

Jak to držíme nízko:

- Statické budovy a díly strojů se při startu slučují podle materiálu (`bake()` v `src/render/materials.js`), takže místo stovek objektů se kreslí desítky.
- Plodiny, stromy, živé ploty, balíky, částice i déšť jsou instancované (jedno volání na druh).
- Plodiny pole mimo záběr kamery a mimo oblast stínů se nekreslí vůbec a jejich kvádry nemají neviditelnou spodní stěnu.
- HUD nepoužívá rozmazání pozadí ani CSS filtry přes plátno a sahá do DOM jen při změně hodnoty.

## Struktura

```
src/
  main.js              start hry a hlavní smyčka
  core/                pomocné funkce, vstup, nastavení grafiky
  render/              renderer, materiály a slučování, kamera, den a noc
  world/               rozvržení mapy, terén, budovy a vesnice, vegetace, pole, balíky,
                       kravín, kurník a skleníky (farmstead.js), les (forest.js)
  vehicles/            modely a jízda strojů, nářadí, přívěs
  game/                stav hry, plodiny, výkupy, práce nářadí, akce, ukládání,
                       stroje a ekonomika, zakázky, počasí a roční období, pomocníci,
                       zvířata a skleníky (farm.js), lesnictví (forestry.js)
  fx/                  částice (prach, plevy, kouř), déšť a sníh
  ui/                  HUD, minimapa, menu, kancelář, měřič FPS, hlášky
prototyp/              původní jednosouborový prototyp
godot-demo/            ukázka v enginu Godot (jedno pole, traktor, kombajn), viz godot-demo/README.md
```

## Hotové fáze

1. **Základ:** projekt s moduly, nastavení grafiky, měřič FPS, ukládání do souboru.
2. **Logistika:** přívěs, překládka ze sklízeče a vysypání ve výkupu.
3. **Polní práce:** orba, hnojení, sláma a balíky, kukuřice a slunečnice s řádkovým adaptérem, cukrovka se sklízečem.
4. **Ekonomika:** obchod se stroji (nákup, pronájem, prodej), nafta a opotřebení, zakázky u souseda, úvěr.
5. **Svět:** větší mapa s vesnicí a osmi poli, čtyři výkupy s různými cenami, roční období a počasí.
6. **Pomocníci:** najatí řidiči, kteří sami obdělají pole.
7. **Obsah:** zvířata, skleníky, lesnictví a další stroje a vylepšení v obchodě.

## Známá omezení a nápady

- Zima je zatím jen bledší, bez sněhu na zemi.
- Harvestor a lesní stromy pomocník neobsluhuje, kácí se jen ručně.
- Nápady na další obsah: prasata nebo ovce, výroba krmné směsi, prodej mléka do mlékárny, více lesních parcel.

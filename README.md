# Zlaté lány

Low-poly farmářská hra v prohlížeči. Herní smyčka je jako ve Farming Simulatoru: sklizeň a prodej ve výkupech, orba, kultivace, hnojení, setí, sláma a balíky, nákup polí a strojů, zakázky, úvěr, roční období a počasí a najatí pomocníci. Vzhled je inspirovaný hrou The Headlands.

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
| F | prodej úrody ve výkupu, překládka do přívěsu, vysypání přívěsu, prodej balíků u stodoly, tankování, výměna nářadí v kůlně, koupě pole u cedule |
| 1–6 | v kůlně: přímý výběr nářadí traktoru (1–6) nebo adaptéru kombajnu (1–2) |
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
| 6 Přívěs | 14 000 l / 8 balíků | odvoz zrna nebo balíků |

Kombajn má dva adaptéry: **žací lištu** na pšenici, ječmen a řepku a **řádkový adaptér** na kukuřici a slunečnici. Vyměníš je v kůlně (F nebo 1–2).

**Cukrovku** sklízí jen samojízdný **sklízeč cukrovky** (zásobník 20 000 l). Na začátku ho nevlastníš: koupíš nebo pronajmeš ho v Kanceláři (K), pak stojí u sil a přesedneš do něj klávesou Tab. Vykládá stejně jako kombajn: v kruhu výkupu, který cukrovku bere (Cukrovar, Družstvo), nebo dopravníkem vlevo do přívěsu.

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

## Pomocníci

Zajeď strojem na pole a stiskni **H**. Pomocník převezme řízení a ty přesedneš do dalšího volného stroje.

- **Jak pracuje:** jezdí v pruzích sem a tam a na konci pruhu zvedne nářadí a otočí se. Nakonec projede souvratě na obou koncích pole.
- **S čím pracuje:** kultivátor, pluh, secí stroj (seje zvolené osivo), rozmetadlo, lis, kombajn i sklízeč cukrovky. S přívěsem nepracuje.
- **Mzda:** 600 Kč za hodinu práce. Hodina práce je minuta skutečného času, takže zrychlený čas (T) mzdu nenafoukne. Nafta a opotřebení se počítají jako při tvé jízdě.
- **Čekání:** sklízeč s plným zásobníkem čeká, až mu přistavíš přívěs a vyložíš ho (F). Za deště čeká, až plodiny oschnou.
- **Konec:** skončí, když je pole hotové, dojde nafta nebo peníze. Kdykoli ho propustíš klávesou H ve stroji, který řídí.
- **Zakázky:** na sousedově poli může pracovat, jen když tam máš zakázku s odpovídajícím nářadím.
- **Ukládání:** pomocníci se do uložené hry neukládají. Po načtení je stačí najmout znovu.

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
  world/               rozvržení mapy, terén, budovy a vesnice, vegetace, pole, balíky
  vehicles/            modely a jízda strojů, nářadí, přívěs
  game/                stav hry, plodiny, výkupy, práce nářadí, akce, ukládání,
                       stroje a ekonomika, zakázky, počasí a roční období, pomocníci
  fx/                  částice (prach, plevy, kouř), déšť a sníh
  ui/                  HUD, minimapa, menu, kancelář, měřič FPS, hlášky
prototyp/              původní jednosouborový prototyp
```

## Hotové fáze

1. **Základ:** projekt s moduly, nastavení grafiky, měřič FPS, ukládání do souboru.
2. **Logistika:** přívěs, překládka ze sklízeče a vysypání ve výkupu.
3. **Polní práce:** orba, hnojení, sláma a balíky, kukuřice a slunečnice s řádkovým adaptérem, cukrovka se sklízečem.
4. **Ekonomika:** obchod se stroji (nákup, pronájem, prodej), nafta a opotřebení, zakázky u souseda, úvěr.
5. **Svět:** větší mapa s vesnicí a osmi poli, čtyři výkupy s různými cenami, roční období a počasí.
6. **Pomocníci:** najatí řidiči, kteří sami obdělají pole.

## Známá omezení a nápady

- Přívěs a balíky nemají kolize, stroje jimi projedou. Pomocník může na konci pole s živým plotem plot lehce „projet“.
- Zima je zatím jen bledší, bez sněhu na zemi.
- Pomocníci se neukládají, po načtení hry je stačí najmout znovu.
- Nápady na další obsah: zvířata, skleníky, lesnictví, více strojů v obchodě.

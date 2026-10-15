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
| 1–8 | v kůlně: přímý výběr nářadí traktoru (1–8) nebo adaptéru kombajnu (1–2) |
| R | v kůlně: oprava stroje a připojeného nářadí |
| K | kancelář: obchod se stroji, zakázky, farma a pozemky, cíle, finance (čas se zastaví) |
| M | velká mapa celého kraje; kliknutím na svůj stroj do něj přesedneš |
| H | najmout pomocníka pro stroj, ve kterém sedíš, nebo ho propustit |
| C | změnit osivo |
| T | rychlost času 1× / 5× / 20× |
| Q / E, tažení myší | otočení kamery |
| kolečko | přiblížení |
| Esc | menu, nastavení grafiky, uložení do souboru |
| F9 | vývojářský režim (jen při vývoji, viz níže) |

## Stroje a plodiny

| Nářadí traktoru | Šířka | Co dělá |
| --- | --- | --- |
| 1 Kultivátor | 4,2 m | strniště → zkultivovaná půda |
| 2 Pluh | 3,2 m | totéž, pomaleji, ale +15 % výnosu |
| 3 Secí stroj | 4 m | zasívá zvolenou plodinu (C) |
| 4 Rozmetadlo | 12 m | hnojivo za 2 Kč/m², +25 % výnosu (i na rostoucí plodiny) |
| 5 Lis na balíky | 2 m | sbírá řádky slámy nebo sena, každých 60 m² vyhodí balík |
| 6 Přívěs | 14 000 l / 8 balíků | odvoz úrody nebo balíků |
| 7 Cisterna na vodu | 8 000 l | voda z rybníka pro skleníky |
| 8 Žací lišta | 3 m | poseče louku a nechá řádek sena |

Kombajn má dva adaptéry: **žací lištu** na pšenici, ječmen a řepku a **řádkový adaptér** na kukuřici a slunečnici. Vyměníš je v kůlně (F nebo 1–2).

**Cukrovku** sklízí jen samojízdný **sklízeč cukrovky** (zásobník 20 000 l). Na začátku ho nevlastníš: koupíš nebo pronajmeš ho v Kanceláři (K), pak stojí u sil a přesedneš do něj klávesou Tab. Vykládá stejně jako kombajn: v kruhu výkupu, který cukrovku bere (Cukrovar, Družstvo), nebo dopravníkem vlevo do přívěsu.

Pšenice a ječmen nechávají za kombajnem řádek slámy. Slisuj ho dřív, než pole zkultivuješ nebo zoráš, jinak sláma zmizí. Přívěs naloží balíky sám, když kolem nich projedeš, a prodáš je v hnědém kruhu před stodolou. Balíky na poli stroje odstrkují.

## Svět

Kraj má 1,2 × 1 km. Uprostřed leží domovské údolí s farmou, poli 1–8 a vesnicí. Kolem něj:

- **Západ:** hustý smíšený les s mýtinami a lesními cestami. Jsou tu dvě nové parcely pro harvestor, posedy a hráně dřeva.
- **Sever:** mírně zvlněné kopce s velkými lány (pole 9–17 a 23, až 2,4 ha), remízky, živými ploty, kapličkou na kopci a větrnými elektrárnami na hřebeni.
- **Jih:** rybníky s hrázemi, rákosím, molem a volavkami, louky na seno a pole 20–22.
- **Východ:** řeka s vrbami, dvěma mosty a brodem. Za ní leží městečko Lánov s kostelem, nádražím a železnicí, pole 18 a 19 a pískovna.

Pole leží na plochých terasách ve výšce podle okolního terénu, stroje jezdí po svazích a naklánějí se. Řeka a rybníky stroje nepustí, přes řeku vedou mosty a brod. Některá pole mají nepravidelný tvar a každé má kvalitu půdy, která ovlivňuje výnos (v Kanceláři je vidět jako „půda 90 %“). Cena pole se odvíjí od výměry a kvality.

Po silnicích jezdí auta. Když jim stroj stojí v cestě, počkají. Po trati jezdí vlak a u nádraží houká.

| Výkup | Kde | Co bere | Cena |
| --- | --- | --- | --- |
| Družstvo | u sil na farmě | všechno | 95 % |
| Mlýn Zlatý klas | u vjezdu do vesnice | pšenice, ječmen | 110–112 % |
| Olejna | za vesnicí jižně od silnice | řepka, slunečnice | 112–114 % |
| Cukrovar a bioplynka | na konci silnice | cukrovka, kukuřice | 110–115 % |
| Nádraží – výkup obilí | městečko za řekou, u trati | pšenice, ječmen, řepka | 112–118 % |
| Krmivárna | městečko, jižně od hlavní silnice | kukuřice, ječmen, cukrovka | 108–116 % |

Dřevo kupuje pila u polní cesty a dřevosklad v městečku, který platí o 15 % víc.

Ceny každého výkupu kolísají jinak. Ceník vpravo ukazuje pro každou plodinu, kde se teď prodá nejdráž. Vzdálenější výkupy platí víc. Minimapa sleduje stroj, ve kterém sedíš, celý kraj ukáže velká mapa (M).

**Roční období** trvají tři dny a hra začíná v létě. Na jaře rostou plodiny normálně, v létě rychleji a na podzim pomaleji. V zimě nic neroste a nesije se. Krajina a stromy mění barvu.

**Počasí** se mění po čtyřech hodinách: jasno, oblačno, déšť, v zimě sněžení. Za deště a hodinu po něm se nesklízí. Déšť trochu urychlí růst. Předpověď je pod hodinami.

**Atmosféra:** obloha se sluncem, které zapadá za obzor, s měsícem, hvězdami a mraky (při zatažení jich je víc a šednou). Ráno a večer je světlo zlaté. Obilí, stromy a živé ploty se vlní ve větru, při dešti víc. Kola nechávají v poli koleje, které zmizí, až pole obděláš, a za sucha se za stroji práší. Kameru sklopíš myší až k obzoru.

**Zvuk** se zapne po kliknutí na Hrát (vypíná se tlačítkem Zvuk nahoře): motor podle otáček a zátěže, mlácení, nářadí v půdě, vítr, déšť, ptáci přes den, cvrčci v noci a cinknutí kasy při příjmu peněz. Všechno je syntetizované, hra nemá zvukové soubory.

**Zvířata v krajině:** pes běhá po dvoře a vyběhne za projíždějícím strojem, u stodoly a domu posedávají dvě kočky. V údolí skáčou zajíci, na kraji lesa a kopců žijí lišky (víc za soumraku a v noci), na jižních svazích se pase stádo srnek, které za svítání a soumraku schází na louku. Hejno vran sedá na pole za strojem, který orá, kultivuje nebo sklízí. Zvířata utíkají před jedoucími stroji.

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

**Kancelář (K)** má pět záložek. Dokud je otevřená, čas stojí.

- **Obchod:** na začátku vlastníš traktor, kombajn, kultivátor, secí stroj a přívěs. Pluh, rozmetadlo, lis, řádkový adaptér a sklízeč cukrovky koupíš, nebo pronajmeš (5 % ceny předem a 1,2 % ceny za každý den). Vlastní stroj prodáš za 55 % ceny podle stavu.
- **Zakázky:** obděláváš sousedova pole, která ti nepatří (sklizeň, kultivace, orba, setí, hnojení). Osivo a hnojivo dodá soused a úrodu si odveze sám. Odměnu dostaneš, když do dvou dnů dokončíš 90 % práce. Nové nabídky přicházejí s každým dnem.
- **Farma:** pozemky (výměra, co na nich je, nákup sousedových polí na dálku), zásoby zvířat a skleníků, stav lesa.
- **Cíle:** tři aktivní cíle s odměnou (od první sklizně po celé údolí) a statistiky farmy. Aktuální cíl je vidět i pod Dalším krokem.
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

## Výkon a kvalita grafiky

Grafika není stažená na nejslabší počítač. Čtyři předvolby (Menu → Grafika) pokrývají rozsah od starého notebooku po výkonnou kartu. Na samostatné grafické kartě se hra spustí ve Vysoké kvalitě, na integrované Intel v Nízké.

| Předvolba | Pro koho | Co přidává |
| --- | --- | --- |
| Nízká | integrovaná grafika (Intel HD 5500) | 70 % rozlišení, plodiny bez stínů, řidší les, kratší dohled |
| Střední | starší samostatné karty (GeForce 840M) | 85 % rozlišení, vyhlazování hran, stíny všech objektů |
| Vysoká | běžné herní karty | plné rozlišení i na displejích s jemnými pixely, stínová mapa 2048, celý les, nejdelší dohled |
| Ultra | výkonné karty | stínová mapa 4096, plastické plodiny (čtyři snopy na metr čtvereční místo kvádru), dvojnásobně hustý les na kopcích, hustší déšť |

- **Měřič FPS:** v pravém horním rohu ukazuje FPS, nejhorší snímek, počet vykreslovacích volání a trojúhelníků. Vypíná se v menu.
- **Notebook se dvěma grafikami:** Windows často nechá prohlížeč na integrované Intel. Ve Windows otevři Nastavení → Systém → Obrazovka → Grafika, přidej prohlížeč, zvol „Vysoký výkon“ a prohlížeč restartuj. Hra v menu ukazuje, kterou kartu používá.

Proč zbývá výkon na detail:

- Statické budovy a díly strojů se při startu slučují podle materiálu (`bake()` v `src/render/materials.js`). Vypadají stejně, jen je grafická karta dostane v pár velkých dávkách místo stovek malých, a ušetřený čas jde do stínů, rozlišení a hustší scény.
- Plodiny, stromy, živé ploty, balíky, částice i déšť jsou instancované, takže tisíce kusů stojí stejně volání jako jeden. Díky tomu může Ultra kreslit plastické plodiny na všech polích a dvakrát víc stromů bez většího počtu volání.
- Plodiny pole mimo záběr kamery a mimo oblast stínů se nekreslí vůbec.
- HUD nepoužívá rozmazání pozadí ani CSS filtry přes plátno a sahá do DOM jen při změně hodnoty.

## Vývojářský režim

Panel pro ladění a testování otevřeš klávesou **F9** nebo tlačítkem **Dev** nahoře. Funguje při spuštění přes `npm run dev` (nebo `spustit.bat`). V sestavené verzi ho zapneš přidáním `?dev` za adresu.

- **Čas:** hodina posuvníkem, ± den, skok na další roční období, rychlost času s násobičem až 60× a zastavení času (stroje dál jezdí).
- **Počasí:** vynutí jasno, oblačno nebo déšť, nebo vrátí počasí podle předpovědi.
- **Grafika:** předvolba a vlastní úpravy (rozlišení, stínová mapa, dohled, hustota stromů, expozice, stíny, stíny a tvar plodin). Úpravy se pamatují, dokud v panelu nedáš Zpět na předvolbu nebo nevybereš předvolbu v menu.
- **Svět:** vypínače oblohy, mraků, zvířat, větru, stop kol, částic a skrytí HUD na snímky obrazovky.
- **Hra:** peníze, všechny stroje a budovy, natankování a opravy, zralá pole, nákup všech polí, plné krmivo a voda, cíle a přesun stroje na vybrané místo.
- **Info:** grafická karta, rozlišení, vykreslovací volání a trojúhelníky, paměť, poloha a stav stroje.

## Struktura

```
src/
  main.js              start hry a hlavní smyčka
  core/                pomocné funkce, vstup, nastavení grafiky
  render/              renderer, materiály a slučování, kamera, den a noc, obloha (sky.js),
                       vítr ve vegetaci (wind.js)
  world/               rozvržení mapy (layout.js), terén s terasami, řekou a rybníky,
                       budovy a vesnice, městečko, nádraží a pískovna (landmarks.js),
                       vegetace, pole a louky, balíky, kravín, kurník a skleníky
                       (farmstead.js), les (forest.js), zvířata (wildlife.js),
                       auta a vlak (traffic.js)
  vehicles/            modely a jízda strojů, nářadí, přívěs
  game/                stav hry, plodiny, výkupy, práce nářadí, akce, ukládání,
                       stroje a ekonomika, zakázky, počasí a roční období, pomocníci,
                       zvířata a skleníky (farm.js), lesnictví (forestry.js), cíle a statistiky (goals.js)
  fx/                  částice (prach, plevy, kouř), déšť a sníh, stopy kol (tracks.js)
  ui/                  HUD, minimapa, menu, kancelář, měřič FPS, hlášky, vývojářský panel (devpanel.js)
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
8. **Svět a atmosféra:** obloha, zlatá hodina, zvuk, zvířata v krajině, vítr, stopy kol, cíle a statistiky, nákup polí v Kanceláři.
9. **Velký kraj:** mapa 1,2 × 1 km s terénem, řekou, rybníky, lesem, městečkem a železnicí, 23 polí a 3 louky, seno, doprava, velká mapa, vývojářský režim.

## Louky a seno

Tři louky (24–26) leží u řeky a u rybníků. Koupíš je levněji než pole, ale nic se na nich nesije.

- **Sečení:** žací lišta (obchod, v kůlně klávesa 8) poseče vysokou trávu a nechá uprostřed záběru řádek sena. Posečená tráva sama doroste zhruba za 10 herních hodin, pod ležícím řádkem neroste.
- **Lisování:** lis udělá z řádku kulaté balíky sena (zelenější než sláma). Naložíš je přívěsem a u stodoly prodáš dráž než slámu. Ceník ukazuje cenu balíku sena zvlášť.
- **Pomocník** umí louku posekat i slisovat. Polní nářadí a kombajn na louce nic nedělají a na loukách nejsou zakázky.

## Známá omezení a nápady

- Zima je zatím jen bledší, bez sněhu na zemi.
- Harvestor a lesní stromy pomocník neobsluhuje, kácí se jen ručně.
- Pomocník začíná práci na poli, kam ho dovezeš. Sám po silnicích na vzdálené pole nejede.
- Nápady na další obsah: prasata nebo ovce, výroba krmné směsi, seno jako krmivo pro krávy, prodej mléka do mlékárny.

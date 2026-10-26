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

Hra pak běží na <http://localhost:5173>. Příkaz `npm test` hru spustí v prohlížeči bez okna a projede hlavní funkce (jízda, sklizeň, prodej, kultivace, ukládání, předvolby grafiky, editor mapy); poprvé je potřeba `npx playwright install chromium`. Příkaz `npm run build` vytvoří ve složce `dist/` statickou verzi, kterou jde nahrát na jakýkoli webhosting.

## Ovládání

| Klávesa            | Akce                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W / S, šipky       | pěšky dopředu a dozadu, ve stroji plyn, brzda, couvání                                                                                                                                                         |
| A / D, šipky       | pěšky otáčení (kamera se drží za tebou), ve stroji zatáčení                                                                                                                                                    |
| Shift              | pěšky běh                                                                                                                                                                                                      |
| E                  | nastoupit do stroje (do 2,5 m od něj) / vystoupit vedle kabiny                                                                                                                                                 |
| V                  | pohled z kabiny (myší nebo Z/X se rozhlížíš), znovu V zpět za stroj                                                                                                                                            |
| Mezerník           | spustit / zvednout nářadí; v jeepu troubí                                                                                                                                                                      |
| Tab                | přesednout do dalšího stroje v okolí (150 m), pěšky do nejbližšího stroje; Shift+Tab do dalšího ze všech strojů                                                                                                |
| F                  | prodej úrody ve výkupu, krmení zvířat, překládka do přívěsu, vysypání přívěsu (i na hromadu na zem), prodej balíků u stodoly, tankování, osivo a hnojivo ve skladu nebo z big bagu, voda pro skleníky, kácení stromu a prodej dřeva, výměna nářadí v kůlně, koupě pole u cedule |
| L                  | nakladač (manipulátor, čelní nakladač na traktoru): naber balíky, paletu, big bag nebo lopatu z hromady / polož na přívěs, do zásobníku stroje, do krmelce nebo na zem; v kombajnu lišta na vozík a zpátky |
| 1–8                | v kůlně: přímý výběr nářadí traktoru (1–8) nebo adaptéru kombajnu (1–2); u traktoru 1 nasadí nebo sundá čelní nakladač                                                                                         |
| R                  | v kůlně: oprava stroje a připojeného nářadí                                                                                                                                                                    |
| K                  | kancelář: obchod se stroji, zakázky, farma a pozemky, cíle, finance (čas se zastaví)                                                                                                                           |
| M                  | velká mapa celého kraje; kliknutím na svůj stroj do něj přesedneš, 1–5 přepíná zobrazení (mapa, plodiny, růst, stav půdy, vlastnictví)                                                                         |
| P                  | ceník výkupů vpravo nahoře (zobrazit / skrýt)                                                                                                                                                                  |
| H                  | najmout pomocníka pro stroj, ve kterém sedíš, nebo ho propustit                                                                                                                                                |
| C                  | změnit osivo; s rozmetadlem hnojivo / vápno; u výdeje ze sila s přívěsem plodinu, která se naloží; ve skladu osiv druh big bagu                                                                                |
| G                  | uskladnit úrodu do sila (v kruhu Družstva na statku nebo před silem, které sis postavil)                                                                                                                       |
| B                  | stavby: Kancelář → Stavby; v režimu stavby R otočí budovu, F ji postaví, Esc stavbu zruší                                                                                                                      |
| Q                  | odpojit nářadí, kde stojíš / připojit nářadí, ke kterému jsi zacouval; v kombajnu prázdný vozík na lištu                                                                                                       |
| T                  | rychlost času 1× / 5× / 20×                                                                                                                                                                                    |
| Z / X, tažení myší | otočení kamery                                                                                                                                                                                                 |
| kolečko            | přiblížení (od kamery těsně za strojem až po pohled shora)                                                                                                                                                     |
| Esc                | menu, nastavení grafiky a zvuku, uložení do souboru                                                                                                                                                            |
| F9                 | vývojářský režim (jen při vývoji, viz níže)                                                                                                                                                                    |

## Stroje a plodiny

**Vozový park:** strojů a nářadí můžeš mít kolik chceš, i víc kusů stejného druhu (dva traktory, tři přívěsy…). První kus každého druhu stojí u kůlny jako dřív, další parkují na odstavné ploše jižně od dvora, která roste podle potřeby. Nářadí se připojuje ke konkrétnímu traktoru: v kůlně klávesy 1–8 nabízejí volné kusy, nářadí na jiném traktoru je obsazené. Kombajn přeloží zrno do kteréhokoli přívěsu pod rourou. V Kanceláři (K) → **Vozový park** vidíš každý kus s místem, stavem, naftou a nákladem, odtud do něj přesedneš nebo ho prodáš či vrátíš z pronájmu.

Stroje mají lesklý lak, profilované kapoty a blatníky, kola s dezénem, disky, náboji a maticemi, kabiny s rámy, dveřmi, stěrači, sedadlem a palubní deskou, světla a majáky, hydrauliku s hadicemi a spojkami, schůdky s plechem, SPZ, výstražné pruhy a nápisy.

**Modely a značky:** obchod nabízí 85 modelů od nejlevnějších po nejlepší (katalog v `src/game/catalog.js`). Liší se barvami a velikostí podle značky i parametry. Značky jsou jen jako názvy, stroje nenesou loga.

| Druh              | Modely                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Traktory          | Zetor Major 80, Brázda 140 (start), Zetor Forterra 150 HD, Massey Ferguson 6S.165, Case IH Puma 185, New Holland T7.210, John Deere 6R 250, Claas Axion 870, Fendt 942 Vario (80–420 koní, 40–60 km/h) |
| Kombajny          | Sampo Rosenlew SR2045, Klas 7 (start), Claas Tucano 450, Deutz-Fahr C6205, Case IH Axial-Flow 7250, John Deere S790, Claas Lexion 8900 (lišta 3,9–12,3 m, zásobník 4 500–18 000 l)                     |
| Sklízeče cukrovky | Bulva 6, Grimme Rexor 620, Holmer Terra Dos T4-40, Ropa Tiger 6S (6–9 řádků, 20–35 tisíc l)                                                                                                            |
| Řezačky           | Siláž 700, Claas Jaguar 960, Krone BiG X 1180 (adaptér 4,5–7,5 m, metá řezanku do přívěsu vedle sebe)                                                                                                     |
| Harvestory        | Les 6, Les 8, Komatsu 931XC, John Deere 1270G, Ponsse Scorpion King (16–32 m³, rychlost kácení)                                                                                                        |
| Auta              | Jeep Lesák 4×4, Dacia Duster 4×4, Toyota Hilux (80–100 km/h, mimo cesty pomalejší podle modelu)                                                                                                        |
| Kultivátory       | Bednar Fenix 3 m, Kultivátor 4,2 m, Lemken Karat 5, Horsch Terrano 6 FX a 10 FX                                                                                                                        |
| Pluhy             | Kverneland 3 radlice, Pluh 5 radlic, Lemken Juwel 6 radlic, Kuhn Vari-Master 8 radlic                                                                                                                  |
| Secí stroje       | 3 m, 4 m, Amazone Cirrus 6003, Väderstad Rapid 800S, Horsch Pronto 12 SW                                                                                                                               |
| Rozmetadla        | 12 m, Amazone ZA-TS 24 m, Rauch Axis 30 m                                                                                                                                                              |
| Žací lišty        | 3 m, Pöttinger Novacat 352, Krone EasyCut B 870 (motýlková 8,7 m)                                                                                                                                      |
| Lisy              | Lis na balíky, John Deere V461R, Krone Comprima V150 (rychlejší)                                                                                                                                       |
| Obraceče          | Obraceč 7,6 m, Krone Vendro 1120                                                                                                                                                                       |
| Shrnovače         | Shrnovač 6,8 m, Claas Liner 2900 (9 m)                                                                                                                                                                 |
| Ovíječ balíků     | Ovíječ balíků (tažený)                                                                                                                                                                                 |
| Přívěsy           | BSS 10 t, Sklápěcí přívěs 14 000 l, Fliegl TMK 22, Krampe Bandit 750, Annaburger HTS 34 (až 40 000 l a 12 balíků), samosběrací vůz Pöttinger Jumbo 6010                                               |
| Cisterny          | 5 000 l, 8 000 l, Joskin Modulo2 11000, Zunhammer SKE 18.5                                                                                                                                             |
| Manipulátory      | Manitou MLT 737, Merlo TF42.7, JCB 542-70 Agri Xtra (lopata 2 500–3 600 l, 2–3 balíky); čelní nakladač na traktor                                                                                      |
| Vozíky na lištu   | 8 m, 13 m (pro Lexion a S790)                                                                                                                                                                          |

## Stroje jako ve FS

- **Sklápění na cestu:** široké nářadí se při zvednutí složí a při spuštění rozloží: kultivátory a secí stroje širší než 4,5 m zvednou boční díly svisle nahoru (secí stroj má pak zásobník jen uprostřed), motýlková žací lišta Krone EasyCut zvedne boční lišty, postřikovač sklopí ramena dopředu, válec, obraceč a shrnovač zvednou boční díly. Pro kolize se počítá jen střed, takže složený stroj projede alejí.
- **Vozík na lištu:** kombajn zacouvá zádí k oji vozíku a klávesou **L** na něj položí lištu; vozík pak táhne za sebou a je úzký pro silnice i aleje (i Claas Lexion 8900). Na poli **L** nasadí lištu zpátky, prázdný vozík odpojíš nebo připojíš klávesou **Q**. Vozík 8 m unese lištu do 8 m, vozík 13 m každou. S lištou na vozíku kombajn nesklízí a pomocník ho nepřevezme. První vozík stojí na trávě jižně od dvora.
- **Osivo, hnojivo, vápno a postřik v zásobníku** (`src/game/supply.js`): secí stroj, rozmetadlo a postřikovač je nevezou za peníze na metr, ale v zásobníku (600–3 500 kg, nádrž 1 000–2 000 l). Naplníš je ve **skladu osiv a hnojiv** na severní straně dvora (zelený kruh, F zaplatí doplnění), nebo z **big bagů**: přívěs ve skladu naloží klávesou F big bag (1 000 kg osiva, hnojiva nebo vápna, IBC 1 000 l postřiku; C vybere druh), odvezeš ho k poli a F vedle přívěsu doplní nářadí. Cena za metr je stejná jako dřív (osivo 50 Kč/kg, hnojivo 10 Kč/kg, vápno 3 Kč/kg, postřik 25 Kč/l). Na sousedově poli při zakázce dodá vše soused. Pomocníkovi přivezou doplnění na pole o 10 % dráž. Nová farma má secí stroj plný, každé nové nářadí přijde prázdné.
- **Nakladače** (`src/game/loader.js`): teleskopický manipulátor (Manitou, Merlo, JCB) a čelní nakladač, který nasadíš na traktor v kůlně (1). Klávesa **L** nabere, co leží před hlavou: kleště balíky (2–3, čelní nakladač 1), vidle paletu z přívěsu nebo od budovy a big bag ve skladu, lopata zrno, řezanku nebo siláž z hromady, hnůj z hnojiště nebo siláž ze žlabu. Znovu **L** to položí: balíky a palety na přívěs, balíky sena do krmelce, big bag do zásobníku secího stroje, rozmetadla nebo postřikovače, paletu výrobků prodá v tržnici, lopatu vysype do přívěsu, do rozmetadla hnoje, do krmelce, do výkupu nebo na hromadu. Nástroj na hlavě se mění sám podle nákladu.
- **Hromady na zemi** (`src/world/heaps.js`): přívěs se zrnem nebo řezankou vysype mimo výkup klávesou F na hromadu za sebou (třeba u pole, když nestíhá odvoz); nakladač ji pak nabere a naloží. Hromady se ukládají.


**Výkon traktoru:** každé nářadí potřebuje určitý výkon („potřebuje … koní“). Slabší traktor ho utáhne, ale pracuje pomaleji, úměrně poměru výkonu (nejméně na 35 %): Brázda 140 s Horschem 10 m (350 koní) pracuje na 40 %, Fendt 942 naplno. S plným přívěsem nebo cisternou jede slabý traktor pomaleji (prázdný stojí 40 % potřebného výkonu, plný všechno, nejhůř 45 % rychlosti). Přetížený traktor spotřebuje víc nafty, silný traktor s lehkým nářadím méně. HUD ukazuje „140 / 350 k · práce 40 %“, kůlna u každého nářadí, jak rychle s ním traktor pojede, obchod u traktoru, které tvoje nářadí utáhne pomaleji, a u nářadí, jak pojede s tvým nejsilnějším traktorem. Pomocníci pracují stejnou rychlostí.

| Nářadí traktoru    | Šířka               | Co dělá                                                  |
| ------------------ | ------------------- | -------------------------------------------------------- |
| 1 Kultivátor       | 4,2 m               | strniště → zkultivovaná půda                             |
| 2 Pluh             | 3,2 m               | totéž, pomaleji, ale +15 % výnosu                        |
| 3 Secí stroj       | 4 m                 | zasívá zvolenou plodinu (C)                              |
| 4 Rozmetadlo       | 12 m                | hnojivo za 2 Kč/m², +25 % výnosu (i na rostoucí plodiny) |
| 5 Lis na balíky    | 2 m                 | sbírá řádky slámy nebo sena, každých 60 m² vyhodí balík  |
| 6 Přívěs           | 14 000 l / 8 balíků | odvoz úrody nebo balíků                                  |
| 7 Cisterna na vodu | 8 000 l             | voda z rybníka pro skleníky                              |
| 8 Žací lišta       | 3 m                 | poseče louku a nechá řádek sena                          |

Kombajn má dva adaptéry: **žací lištu** na pšenici, ječmen a řepku a **řádkový adaptér** na kukuřici a slunečnici. Vyměníš je v kůlně (F nebo 1–2).

**Cukrovku** sklízí jen samojízdný **sklízeč cukrovky** (zásobník 20 000 l). Na začátku ho nevlastníš: koupíš nebo pronajmeš ho v Kanceláři (K), pak stojí u sil a přesedneš do něj klávesou Tab. Vykládá stejně jako kombajn: v kruhu výkupu, který cukrovku bere (Cukrovar, Družstvo), nebo dopravníkem vlevo do přívěsu.

Pšenice a ječmen nechávají za kombajnem řádek slámy. Slisuj ho dřív, než pole zkultivuješ nebo zoráš, jinak sláma zmizí. Přívěs naloží balíky sám, když kolem nich projedeš, a prodáš je v hnědém kruhu před stodolou. Balíky na poli stroje odstrkují.

## Svět

Kraj má 1,2 × 1 km. Uprostřed leží domovské údolí s farmou, poli 1–8 a vesnicí. Kolem něj:

- **Západ:** hustý smíšený les s mýtinami a lesními cestami. Jsou tu dvě nové parcely pro harvestor, posedy a hráně dřeva.
- **Sever:** mírně zvlněné kopce s velkými lány (pole 9–17 a 23, až 2,4 ha), remízky, živými ploty, kapličkou na kopci a větrnými elektrárnami na hřebeni.
- **Jih:** rybníky s hrázemi, rákosím, molem a volavkami, louky na seno a pole 20–22.
- **Východ:** řeka s vrbami, dvěma mosty a brodem. Za ní leží městečko Lánov s kostelem, nádražím, mlékárnou a železnicí, pole 18 a 19 a pískovna.

Pole leží na plochých terasách ve výšce podle okolního terénu, stroje jezdí po svazích a naklánějí se. Řeka a rybníky stroje nepustí, přes řeku vedou mosty a brod. Některá pole mají nepravidelný tvar a každé má kvalitu půdy, která ovlivňuje výnos (v Kanceláři je vidět jako „půda 90 %“). Cena pole se odvíjí od výměry a kvality.

Po silnicích jezdí auta. Když jim stroj stojí v cestě, počkají. Po trati jezdí vlak a u nádraží houká.

| Výkup                 | Kde                               | Co bere                    | Cena      |
| --------------------- | --------------------------------- | -------------------------- | --------- |
| Družstvo              | u sil na farmě                    | všechno                    | 95 %      |
| Mlýn Zlatý klas       | u vjezdu do vesnice               | pšenice, ječmen            | 110–112 % |
| Olejna                | za vesnicí jižně od silnice       | řepka, slunečnice          | 112–114 % |
| Cukrovar a bioplynka  | na konci silnice                  | cukrovka, kukuřice         | 110–115 % |
| Nádraží – výkup obilí | městečko za řekou, u trati        | pšenice, ječmen, řepka     | 112–118 % |
| Krmivárna             | městečko, jižně od hlavní silnice | kukuřice, ječmen, cukrovka | 108–116 % |

Dřevo kupuje pila u polní cesty a dřevosklad v městečku, který platí o 15 % víc.

Ceny každého výkupu kolísají jinak. Ceník (klávesa P nebo tlačítko Ceny) ukazuje pro každou plodinu, kde se teď prodá nejdráž. Vzdálenější výkupy platí víc. Minimapa vlevo dole sleduje stroj, ve kterém sedíš, celý kraj ukáže velká mapa (M).

**Terén a pole:** tráva má jemnou texturu stébel a trsů a velké skvrny sušší a sytější trávy, hlína a štěrk (u vody, v pískovně) zrnitou texturu; terén je plynule stínovaný. Kolem kamery rostou stébla trávy, která se vlní ve větru (ne na cestách, polích, dvoře a ve vodě, v zimě pod sněhem zmizí). Plodiny jsou z křížených průhledných ploch se stébly a klasy (obilí), květy (řepka), listy a palicemi (kukuřice), hlávkami (slunečnice) a listy (cukrovka), s náhodnou výškou; krajní řada pole je nižší a okraj pole je roztřepený. Strniště má slámky, kultivovaná půda drobné hroudy a oranice velké hroudy (`soilDetail()` v `src/render/textures.js`). Silnice jsou asfaltové s vyjetými stopami, štěrkovou krajnicí, okrajovými čarami a přerušovanou středovou čarou na širokých silnicích (u křižovatek se čáry přeruší), v polích je podél nich mělký zatravněný příkop. Polní cesty mají dvě vyjeté koleje a trávu uprostřed. Barvy jsou méně syté a přirozenější. Všechny textury se kreslí při startu (`src/render/textures.js`), stébla trávy jsou v `src/world/grass.js`.

**Světlo a materiály:** lak strojů, sklo, voda a budovy odrážejí oblohu (mapa okolí z barev oblohy, mění se se dnem, nocí a mraky; `src/render/envmap.js`). Na Vysoké a Ultra je postprocessing (`src/render/post.js`): zastínění koutů budov, míst pod stroji a mezi nimi (SSAO z hloubky, bez dalšího průchodu scénou), jemná záře nejjasnějších věcí (slunce, lampy, majáky), vzdušný opar do dálky a při západu a východu slunce paprsky světla. Budovy mají textury: vlnitý plech na kůlnách a střechách, prkna na stodole a ohradách, cihly, omítku, střešní tašky, beton se skvrnami a zrnem na dvoře, sila s obručemi a tmavší spodek zdí. Textura se promítá podle směru plochy, takže budovy nepotřebují UV souřadnice (`TEX` a `MT()` v `src/render/materials.js`). Na dvoře stojí palety, IBC nádrže, hromada pneumatik, malé balíky a u domu plot se zahrádkou (`src/world/yard.js`). Listnáče a břízy mají blízko kamery kolem koruny plochy s průhledným listím, které se vlní ve větru.

**Polní práce jako ve FS25** (`src/game/agro.js`): výnos pole nezáleží jen na hnojení a orbě. Kancelář → Farma ukazuje u každého tvého pole **rozpis výnosu** a celkový výnos, velká mapa ho ukáže po najetí myší a HUD v řádku pole.

| Krok                    | Stroj                       | Účinek                                                                                                   |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Hnojení                 | rozmetadlo (C: hnojivo)     | +25 %, kdykoli před sklizní; druhá dávka na vzrostlé plodiny dalších +10 %                               |
| Orba                    | pluh                        | +15 %, ale vyorá kameny, které při sklizni ničí lištu                                                    |
| Válení                  | Cambridge válec             | +5 %, před setím nebo hned po něm, a zatlačí kameny                                                      |
| Mulčování               | mulčovač                    | +5 %, na strniště po sklizni (pole se pak ještě kultivuje)                                               |
| Osevní postup           | secí stroj                  | jiná plodina než minule +8 %, stejná −5 %                                                                |
| Postřik                 | postřikovač                 | plevel roste na nepostříkaných plodinách a bere 5–25 %; postřik (1 Kč/m²) ho zničí do sklizně            |
| Vápnění                 | rozmetadlo (C: vápno)       | po 3 sklizních bez vápna je půda kyselá a bere 15 %; vápno 1,5 Kč/m²                                     |
| Včasná sklizeň          | kombajn                     | zralá plodina po 16 hodinách přezraje (zhnědne) a dá jen polovinu                                        |
| Kalendář setí           | secí stroj                  | každá plodina se seje jen v některých obdobích (pšenice léto a podzim, cukrovka jaro…), viz Kancelář → Farma |

Postřikovač má rameno, které se na cestu sklopí podél traktoru, válec zvedne boční díly. Na mapě (M) ukáže Stav půdy i plevel, kameny, kyselou půdu, druhé hnojení a přezrálé plodiny, Růst ukáže přezrálé. Pomocník umí postřik, válení, mulčování i vápnění, „Další krok“ na ně upozorní.

**Silo a prodej později** (`src/game/silo.js`): úrodu nemusíš prodat hned. V kruhu Družstva na statku ji klávesou G (místo F) uskladníš v silech, každou plodinu zvlášť, dohromady 200 000 l. Když cena vyskočí, přistav přívěs napříč pod výsypku v bílém kruhu „Výdej ze sila“ na severní straně sil, klávesou F ho naplníš (C vybere plodinu) a odvezeš do výkupu, který zrovna platí nejvíc. Kancelář → **Ceny a silo** ukazuje zásobu a její hodnotu a pro každou plodinu graf cen ve všech výkupech za posledních 5 dní s průměrem a o kolik je cena nad ním nebo pod ním. Ceník (P) ukazuje, kolik je v silu, a „Další krok“ upozorní, když je uskladněná plodina výrazně nad průměrem. **Dodávky:** výkupy každý den nabízejí zakázky „N litrů plodiny do výkupu do 2–4 dnů za příplatek 12–30 %“ (Kancelář → Zakázky). Každý litr té plodiny prodaný v tom výkupu se počítá a platí s příplatkem, z pole i ze sila; najednou můžeš mít dvě, nesplněná propadne bez pokuty. Postup ukazuje HUD.

**Velká mapa (M) se zobrazeními** (`src/ui/mapfilters.js`): tlačítky nebo klávesami 1–5 přepneš, co pole ukazují. **Plodiny** obarví každý metr čtvereční podle plodiny, **Růst** podle fáze (zaseto, klíčí, roste, před zralostí, zralé), **Stav půdy** podle toho, co je potřeba udělat (kultivovat nebo zorat, slisovat slámu, zasít, pohnojit, sklidit, hotovo), **Vlastnictví** ukáže tvoje pole, pole zakázky a pole sousedů s cenou. Legenda u každé barvy sečte hektary na tvých polích (u vlastnictví na všech). Když najedeš myší na pole, ukáže se jeho velikost, majitel, co na něm roste a co potřebuje. Zbytek mapy se v zobrazeních ztmaví, aby pole vynikla; barvy se přepočítávají jednou za sekundu, jen když je mapa otevřená.

**Kamera a HUD jako ve Farming Simulatoru:** kamera stojí nízko asi 10–20 m za strojem (podle jeho velikosti), takže je vidět obzor; kolečkem ji oddálíš až do pohledu shora a každý stroj si svoje přiblížení pamatuje. Stíny se při pohledu k obzoru posunou před stroj. HUD je tmavý a poloprůhledný: vlevo nahoře peníze, čas a další krok, vlevo dole minimapa, vpravo dole budík rychlosti s ukazatelem nafty (modrý) a stavu stroje (zelený), písmenem směru jízdy (D, N, R) a ikonami nářadí (spuštěno / zvednuto, pracuje, naplnění zásobníku, přívěsu nebo lisu, pomocník, málo nafty), nad ním podrobnosti o stroji. Ceník je schovaný a hra si pamatuje, jestli ho chceš vidět.

**Kabina (V):** za volantem je přístrojový štít s otáčkoměrem, rychloměrem, naftou a kontrolkami, na pravém sloupku terminál se stavem nářadí (pracuje, spuštěno, zvednuto), naplněním, polem, stavem a naftou. Zpětná zrcátka ukazují, co je za strojem (kreslí se jen v kabině, každé druhý snímek jedno zrcátko v malém rozlišení). Strop kabiny je světlý. V kabině se panel stroje v HUD schová, ukazuje ho terminál.

**Roční období** trvají tři dny a hra začíná v létě. Na jaře rostou plodiny normálně, v létě rychleji a na podzim pomaleji. V zimě nic neroste a nesije se. Krajina a stromy mění barvu a v zimě během pár herních hodin napadne sníh: bílé jsou louky, pole, střechy, cesty i koruny stromů, místy prosvítá tráva. Když sněží, přibývá ho rychleji, na jaře roztaje. Stroje zůstávají bez sněhu.

**Počasí** se mění po čtyřech hodinách: jasno, oblačno, déšť, v zimě sněžení. Za deště a hodinu po něm se nesklízí. Déšť trochu urychlí růst. Předpověď je pod hodinami.

**Počasí s následky** (`src/game/climate.js`): část dešťů jsou **bouřky** s blesky a hromem, nejčastěji v létě. Některé bouřky přinesou **krupobití**: na většině polí potluče rostoucí a zralé plodiny (výnos o 8–30 % méně na každém metru). V létě bývá den **sucha**: celý den nezaprší, rostoucí plodiny rostou pomaleji a každou hodinu přijdou zhruba o procento výnosu. Škody jsou v rozpisu výnosu jako „Počasí“ a zmizí se sklizní nebo novým setím. Louky se nepoškodí. Ve vývojářském panelu (F9) jsou tlačítka Bouřka a Kroupy.

**Atmosféra:** obloha se sluncem, které zapadá za obzor, s měsícem, hvězdami a mraky (při zatažení jich je víc a šednou). Ráno a večer je světlo zlaté. Obilí, stromy a živé ploty se vlní ve větru, při dešti víc. Kola nechávají v poli koleje, které zmizí, až pole obděláš, a za sucha se za stroji práší. Kameru sklopíš myší až k obzoru.

**Viditelná práce:** kombajn rozhazuje za sebou z drtiče vějíř slámy a plev, sklízeč cukrovky sype hlínu a odhazuje chrást. Pluh převrací hroudy doprava, kultivátor je vyhazuje nahoru a za kultivátorem, pluhem i secím strojem zůstává pruh čerstvé tmavé hlíny, který za dvě minuty oschne (`src/fx/furrows.js`). Lis zvedá ze řádku seno a slámu a balík vypadne s obláčkem stébel. Z výsypné roury i ze sklopeného přívěsu teče souvislý proud zrna (`src/fx/streams.js`). Po dešti jsou pole a tráva tmavší a na cestách se lesknou kaluže, které s osycháním mizí (`src/fx/wet.js`).

**Špína a myčka** (`src/game/dirt.js`): stroje se při práci na poli a jízdě mimo cesty postupně špiní, v blátě po dešti mnohem rychleji (za sucha je traktor celý zablácený asi po sedmi minutách práce, v blátě za necelé dvě). Bláto je na stroji vidět: tmavší spodek, kola a fleky, nářadí a přívěs se špiní s ním. Déšť trochu opláchne. V myčce jižně od kravína (modrý rám a kroužek) F stroj i s nářadím umyje za 250 Kč. HUD ukazuje „špinavý“ nebo „zablácený“, hra si špínu pamatuje.

**Lidé** (`src/world/villagers.js`): ve vesnici a v městečku chodí lidé po chodnících (když jim před cestou projíždí stroj, počkají), u kostela, na náměstí a u obchodu stojí hloučky a povídají si. Na noc odejdou domů. U každého výkupu stojí výkupčí a mává, když tam prodáváš. Lidé jsou ze stejných dílů jako farmář, různě oblečení (kšiltovky, klobouky, vlasy), a kreslí se všichni dohromady jako instance. Stroj do nich nenajede.

**Nálada krajiny** (`src/world/atmosphere.js`): ráno od svítání do devíti se zatahuje mlha, nejhustší dole u řeky. Když v podvečer přestane pršet a slunce je nízko, objeví se naproti slunci duha. Večer se rozsvítí asi dvě třetiny oken a pouliční lampy ve vesnici, v městečku a v rozích dvora, které kreslí na zem teplý kruh světla. Z komínů statku a vesnických domů se kouří, nejvíc v zimě a ráno a večer. Na podzim padá ze stromů kolem tebe listí, v letních nocích létají nad trávou světlušky.

**Zvuk:** motory z nahrávek skutečných strojů, hudba, vítr, déšť, ptáci a zvířata, viz [Zvuk](#zvuk).

**Zvířata v krajině:** pes běhá po dvoře a vyběhne za projíždějícím strojem, u stodoly a domu posedávají dvě kočky. V údolí skáčou zajíci, na kraji lesa a kopců žijí lišky (víc za soumraku a v noci), na jižních svazích se pase stádo srnek, které za svítání a soumraku schází na louku. Hejno vran sedá na pole za strojem, který orá, kultivuje nebo sklízí. Zvířata utíkají před jedoucími stroji.

## Zvířata, skleníky a les

Všechno se kupuje v Kanceláři (K) → Obchod. Přehled zásob a produkce je v záložce **Farma**. Mléko, vejce, vlna, vepřové a rajčata se odvážejí a platí o půlnoci; mléko, vejce, vlnu a rajčata můžeš odvézt sám a dostaneš víc.

| Budova                 | Kde                     | Co potřebuje (denně)                           | Co dává (denně)                         |
| ---------------------- | ----------------------- | ---------------------------------------------- | --------------------------------------- |
| Kravín s 10 kravami    | jihozápadně od farmy    | ječmen, kukuřice, cukrovka nebo seno (1 920 l) | 9 600 l mléka po 9 Kč, v mlékárně 12 Kč |
| Kurník se 40 slepicemi | vedle kravína           | pšenice nebo ječmen (96 l)                     | 1 152 vajec po 15 Kč                    |
| Ovčín s 16 ovcemi      | jižně od kravína        | balíky sena (960 l, asi 1 balík)               | 480 kg vlny po 90 Kč                    |
| Vepřín s 12 prasaty    | vedle ovčína            | kukuřice nebo ječmen (1 440 l)                 | 1 440 kg vepřového po 48 Kč             |
| Míchací krmný vůz      | mezi kravínem a ovčínem | kravín                                         | +25 % mléka, když je krmivo vyvážené    |
| Skleník s rajčaty (2×) | mezi farmou a rybníkem  | voda (960 l na skleník)                        | 960 kg rajčat po 24 Kč                  |

- **Krmení:** zajeď sklízečem nebo traktorem s přívěsem do kruhu u budovy (zelený u kravína, žlutý u kurníku, světlý u ovčína, růžový u vepřína) a stiskni F. Úroda se vyloží do krmelce místo prodeje. Hladová zvířata nic nedají.
- **Seno:** přívěs s balíky sena v kruhu u kravína nebo ovčína vyloží klávesou F balíky do krmelce, jeden balík dá 1 000 l krmiva. Balíky slámy zůstanou v přívěsu.
- **Krmná směs:** s míchacím vozem dávají krávy o 25 % víc mléka, když je v krmelci zrno (ječmen nebo kukuřice), seno i cukrovka, každé aspoň 15 %. Složení ukazuje Kancelář → Farma.
- **Mlékárna:** cisterna veze vodu nebo mléko. Prázdnou cisternu naplníš mlékem klávesou F v bílém kruhu u chladicí nádrže kravína a mléko prodáš v mlékárně v městečku za 12 Kč/l. Co neodvezeš, koupí o půlnoci odvoz za 9 Kč/l. Mléčnou cisternu nejde naplnit vodou, dokud ji neprodáš.
- **Voda:** cisternou (kůlna, klávesa 7) naber vodu klávesou F u rybníka a vylij ji v modrém kruhu u skleníků.
- **Stádo** (`src/game/animals.js`): každá budova má stádo s počtem zvířat a zdravím. Nakrmená zvířata se uzdravují a při zdraví nad 75 % přibývají mláďata až do velikosti budovy (kravín 20, vepřín 30, ovčín 32, kurník 90). Hladová zvířata chřadnou a pod 20 % zdraví začnou hynout. Produkce i spotřeba krmiva se řídí počtem a zdravím zvířat. Stav ukazuje Kancelář → Farma.
- **Dobytčí trh a přívěs na zvířata:** přívěs (6 krav, 12 prasat nebo ovcí, 60 slepic) naložíš klávesou F v kruhu u budovy a na dobytčím trhu v městečku (jižně od hlavní silnice) zvířata prodáš podle jejich zdraví. S prázdným přívěsem tam zvířata koupíš (C vybere druh, jen pro budovy, které máš) a doma je vyložíš F v kruhu budovy.
- **Hnůj a kejda:** krávy a prasata dávají kejdu do jímky u kravína, krávy, ovce a slepice hnůj na hnojiště u vepřína. Cisternu na kejdu nebo rozmetadlo hnoje naplníš klávesou F v kruhu u jímky nebo před hnojištěm a na poli je rozmetáš mezerníkem: hnojí jako hnojivo (první i druhá dávka) a nic nestojí. Hladina v jímce a hromada na hnojišti ukazují, kolik je k vyvezení.
- **Palety:** vejce, vlna a rajčata se u kurníku, ovčína a skleníků skládají na palety (600 vajec, 120 kg vlny, 300 kg rajčat). Prázdným přívěsem je naložíš klávesou F v kruhu u budovy a v tržnici v městečku prodáš o 40 % dráž. Co zůstane, odvezou o půlnoci za základní cenu.
- **Les:** na severu je smrková plantáž. Harvestor kácí stromy, které dorostly aspoň na 85 % (F u stromu), a pojme 24 m³ dřeva. Dřevo prodáš na pile na konci polní cesty (F, kolem 1 500 Kč/m³) nebo v dřevoskladu v městečku. Místo pokáceného stromu vyroste asi za tři dny nový, v zimě roste pomaleji.

Budovy se nedají pronajmout, jen koupit. Dřívější vylepšení nahradily modely: uložená hra s nimi dostane odpovídající stroj (silnější motor → Case IH Puma 185, větší zásobník → Case IH Axial-Flow 7250, široký kultivátor → Horsch Terrano 6 FX, nástavba → Fliegl TMK 22).

## Sousedé

Pole, která nevlastníš, patří třem sousedům: Josef Novák (Zetor a starý Sampo), Marie Dvořáková (New Holland a Deutz-Fahr) a Petr Svoboda (Case IH). Zakázky v Kanceláři jsou od nich: každá nese jméno a prosbu („Kombajn mám v servisu, zaplatím slušně.“), při přijetí poděkují. Když nabídku asi čtyři herní hodiny nepřijmeš, soused práci udělá sám: na pole přijede jeho traktor s nářadím nebo kombajn a projede ho pruh po pruhu (najednou pracují nejvýš dva), nabídka zmizí a na tom poli nové zakázky nejsou, dokud nedojede. Po hlavní silnici jezdí další soused se Zetorem Major a přívěsem, a když mu v cestě něco stojí, otočí se. Stroje sousedů jsou slyšet a nenajedeš do nich. Kód je v `src/world/neighbours.js`.

## Dožínky

Poslední den léta (9:00–20:00) jsou u hlavní silnice za olejnou dožínky: stánky s pruhovanými stříškami, praporky, dožínkový věnec na tyči a lidé (`src/game/festival.js`). Ráno to oznámí hláška. V kroužku „Dožínky“:

- **Soutěž o největší úrodu:** F pěšky nebo v jiném stroji než v traktoru porovná, kolik jsi toho léta sklidil, se sousedy. První tři dostanou 60 000, 25 000 a 10 000 Kč, jednou za rok.
- **Traktoriáda:** F v traktoru spustí čas. Projeď slalomem šest bran z kuželů, minutá brána stojí 5 s trestu. První dojetí v roce vyplatí podle času (pod 35 s 30 000 Kč, pod 50 s 15 000 Kč, jinak 5 000 Kč) a hra si pamatuje rekord. HUD ukazuje bránu a čas.

## Pomocníci

Najednou může pracovat **až pět pomocníků**, každý za svou mzdu (Kancelář → Farma ukazuje, kolik jich pracuje). Pomocníka najmeš dvěma způsoby:

- **Na místě:** zajeď strojem na pole a stiskni **H**. Pomocník převezme řízení a ty přesedneš do dalšího volného stroje.
- **Z Kanceláře (K → Farma → Pomocník):** u traktoru vyber nářadí (zapojené, nebo kterékoli volné; u každého je vidět, jak rychle s ním traktor pojede), pak pole nebo louku (u harvestoru les) a dej **Poslat**. Pro jiné nářadí si pomocník nejdřív dojede tam, kde stojí, a připojí si ho. Pak jede po silnicích (vpravo, jako auta, přes mosty a brod), práci udělá a vrátí se na dvůr. Tady vidíš i jeho stav a můžeš ho propustit.

- **Jak pracuje:** jezdí v pruzích sem a tam a na konci pruhu zvedne nářadí a otočí se. Nakonec projede souvratě na obou koncích pole.
- **S čím pracuje:** kultivátor, pluh, secí stroj (seje zvolené osivo), rozmetadlo, žací lišta, lis, kombajn, sklízeč cukrovky a harvestor. S přívěsem nepracuje.
- **Sklizeň:** pomocník poslaný z Kanceláře odveze plný zásobník na výkup, který zrovna platí nejvíc, a vrátí se tam, kde přestal. Najatý na místě čeká, až mu přistavíš přívěs a vyložíš ho (F). Za deště čeká, až plodiny oschnou.
- **Les:** s harvestorem kácí vzrostlé stromy, ke kterým se dostane, plný harvestor odveze na výkup dřeva s lepší cenou a pokračuje, dokud v lese jsou vzrostlé stromy.
- **Přeprava ze sila:** traktor se sklápěcím přívěsem dostane v Kanceláři → Farma → Přeprava ze sila úlohu „nalož u sila, vylož jinde“: vybereš plodinu, cíl (výkup, krmelec zvířat nebo tvůj mlýn či olejna) a kolik. Pomocník jezdí mezi výdejem ze sila a cílem, dokud nepřeveze, co chceš, nebo silo nevyprázdní, pak se vrátí na dvůr.
- **Mzda:** 1 500 Kč za hodinu práce i cesty. Hodina je minuta skutečného času, takže zrychlený čas (T) mzdu nenafoukne. Když dochází nafta, pomocníkovi ji přivezou (cena nafty + 10 % za dovoz).
- **Konec:** skončí, když je práce hotová nebo dojdou peníze. Kdykoli ho propustíš klávesou H ve stroji, který řídí, nebo v Kanceláři.
- **Zakázky:** na sousedově poli může pracovat, jen když tam máš zakázku s odpovídajícím nářadím.
- **Překážky:** na poli pomocník nikdy neprojede budovou, plotem, stromem ani zaparkovaným strojem; když mu něco stojí v cestě déle než 8 sekund, skončí s hlášením. Na cestě po silnicích čeká na stroje a auta a krátké úseky mimo silnici (z kůlny, ke kraji pole) projede.
- **Ukládání:** pomocník se ukládá i s rozpracovanou trasou a fází (cesta pro nářadí, cesta, práce, odvoz, přeprava). Po načtení hry pokračuje.
- **Stavby na poli:** pomocník budovu, kterou sis postavil na poli, neobjede: když mu stojí v cestě, zastaví.

## Ekonomika

**Kancelář (K)** má osm záložek. Dokud je otevřená, čas stojí.

**Začátek hry:** Menu → Nová hra nabídne tři začátky. **Nový farmář** má statek s poli 1 a 2, traktorem, kombajnem, kultivátorem, secím strojem a přívěsem a 150 000 Kč. **Správce farmy** začíná s 1 500 000 Kč bez polí a strojů, jen s autem. **Začátek od nuly** má auto a 500 000 Kč a výkupy platí o 10 % méně. Ve všech třech je statek s budovami stejný.

- **Obchod:** záložky Traktory, Sklízeče, Nářadí, Přívěsy a cisterny, Nakladače, Lesnictví, Auta a Budovy. Každý druh má řadu karet od nejlevnějšího po nejlepší: fotka stroje, cena, proužky parametrů a srovnání s tím, co už máš („+50 % výkon“). Filtr „Jen na co mám“ a řazení od nejlevnějšího nebo od nejlepšího. Klik na kartu otevře detail s modelem stroje, který se otáčí (tažením myší ho otočíš sám), se všemi čísly, poznámkou o výkonu a nákupem. Stroj koupíš, nebo pronajmeš (5 % ceny předem a 1,2 % ceny za každý den); v detailu můžeš zvolit **protiúčet**: starý stroj stejného druhu se prodá (55 % ceny podle stavu) a doplatíš rozdíl, nový převezme jeho nářadí i tvoje místo za volantem. Na začátku vlastníš traktor, kombajn, kultivátor, secí stroj a přívěs. Fotky karet hra nafotí sama hned po otevření obchodu, jednu za snímek (`src/render/previews.js`): ve studiu se stejným světlem jako ve hře, takže se nic nekompiluje a hra se nezadrhne.
- **Vozový park:** každý stroj a nářadí s místem, stavem a nákladem; přesednutí, prodej a vrácení z pronájmu.
- **Zakázky:** obděláváš sousedova pole, která ti nepatří (sklizeň, kultivace, orba, setí, hnojení). Osivo a hnojivo dodá soused a úrodu si odveze sám. Odměnu dostaneš, když do dvou dnů dokončíš 90 % práce. Nové nabídky přicházejí s každým dnem. Když na zakázku nemáš stroj, vezmeš ji **se strojem souseda**: přistaví ho k ceduli pole (kombajn nebo sklízeč, u nářadí i traktor, když žádný nemáš), nechá si 30 % odměny a po zakázce si ho vezme zpátky. Jeho stroj pracuje jen na poli ze zakázky.
- **Farma:** pozemky (výměra, co na nich je, nákup sousedových polí na dálku), zásoby zvířat a skleníků, stav lesa.
- **Stavby:** budovy, které si postavíš sám, a stav výroby, viz [Stavby a výroba](#stavby-a-výroba).
- **Cíle:** tři aktivní cíle s odměnou (od první sklizně po celé údolí) a statistiky farmy. Aktuální cíl je vidět i pod Dalším krokem.
- **Finance:** úvěr až 1 000 000 Kč po 100 000 Kč s úrokem 0,4 % denně. Najdeš tu i nouzový dovoz 60 l nafty, když v poli dojde.

**Nafta:** stroje ji spotřebovávají při jízdě a víc při práci. Tankuje se v červeném kruhu u čerpací stanice vedle kůlny (F, 36 Kč/l). Bez nafty se stroj nerozjede.

**Opotřebení:** stroj i nářadí ztrácejí stav prací. Pod 50 % jezdí pomaleji a víc žerou. Opravíš je v kůlně klávesou R.

Úroky a leasing se strhávají o půlnoci. Starší uložené hry si ponechají všechny stroje, které v nich už byly.

## Stavby a výroba

**Stavění** (`src/game/build.js`, modely v `src/world/placed.js`): v Kanceláři → **Stavby** (nebo klávesou B) vybereš budovu a dáš Postavit. Před tebou se objeví průhledný náhled: zelený, kde budova smí stát, červený, kde ne (a proč). Najeď strojem nebo dojdi, kam ji chceš, **R** ji otočí o čtvrt otáčky, **F** ji postaví a zaplatí, **Esc** stavbu zruší. Stavět se dá jen na tvém: na tvých polích a loukách a na **stavebním pozemku** u vesnické silnice za polem 5 (cedule Na stavby), ne přes cesty, budovy, stromy a stroje a ne na velkém svahu. Na poli budova zabere kus pole, který se při zbourání vrátí jako strniště. Zbouráním dostaneš zpátky polovinu ceny.

| Budova        | Cena       | Co dělá                                                                                         |
| ------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Obilné silo   | 380 000 Kč | +150 000 l v silech statku; G v kruhu před ním uskladní, F naloží (nejvýš 3)                    |
| Strojní kůlna | 260 000 Kč | druhá dílna: oprava (R), adaptér kombajnu a čelní nakladač (nejvýš 2)                           |
| Kravín        | 520 000 Kč | místo pro dalších 20 krav ke stádu v kravíně (potřebuje kravín, nejvýš 2)                       |
| Mlýn          | 900 000 Kč | pšenice a ječmen → mouka: 800 l za hodinu dá 600 kg                                             |
| Pekárna       | 700 000 Kč | mouka z palet → chléb: 300 kg za hodinu dá 400 bochníků                                         |
| Olejna        | 800 000 Kč | řepka a slunečnice → olej: 400 l za hodinu dá 160 l                                             |
| Pila          | 600 000 Kč | kulatina z harvestoru → prkna: 2 m³ za hodinu dají 1,5 m³                                       |

**Výrobní řetězce** (`src/game/production.js`): výrobna má před vraty barevný kruh. Do mlýna a olejny vysypeš přívěs nebo zásobník sklízeče (F), může je vozit i pomocník z Přepravy ze sila; do pekárny vyložíš palety mouky (F s přívěsem nebo nakladačem L), na pilu složí harvestor dřevo (F). Výrobna pracuje po herních hodinách, dokud má vstup, a výrobky skládá na palety (mouka 500 kg, chléb 400 bochníků, olej 200 l, prkna 2 m³) do svého kruhu; když jich je 20, zastaví se. Palety naložíš přívěsem (F) nebo nakladačem a prodáš v tržnici v městečku (mouka 11 Kč/kg, chléb 14 Kč za bochník, olej 40 Kč/l, prkna 3 200 Kč/m³, tržnice přidá 40 %). Mouku můžeš místo prodeje upéct v pekárně. O půlnoci se výrobky neodvážejí. Kancelář → Stavby ukazuje vstup, výrobky a stav každé výrobny, Další krok upozorní, když výrobna stojí kvůli plným paletám.

## Přívěs na úrodu

1. V kůlně připoj přívěs klávesou 6 (nebo procházej nářadí klávesou F).
2. Postav přívěs vlevo od kombajnu nebo sklízeče, pod jeho výsypnou rouru.
3. Stiskni F ve sklízeči nebo v traktoru. Úroda se přeloží, přívěs pojme 14 000 l.
4. Zajeď s přívěsem do kruhu výkupu, který tu plodinu bere, a stiskni F. Korba se zvedne a úroda se prodá.

Vykládka sklízeče běží dál, i když přesedneš do jiného stroje (Tab). Když přívěs během vykládky odjede, sklízeč počká s vysunutou rourou, dokud se přívěs nevrátí. Vykládku zastavíš znovu klávesou F.

## Výkon a kvalita grafiky

Grafika není stažená na nejslabší počítač. Čtyři předvolby (Menu → Grafika) pokrývají rozsah od starého notebooku po výkonnou kartu. Na samostatné grafické kartě se hra spustí ve Vysoké kvalitě, na integrované Intel v Nízké.

| Předvolba | Pro koho                               | Co přidává                                                                                                                       |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Nízká     | integrovaná grafika (Intel HD 5500)    | 70 % rozlišení, plodiny jako kvádry bez stínů, bez stébel trávy, řidší les, kratší dohled, vzdálený terén v hrubší mřížce, jednodušší stromy a keře |
| Střední   | starší samostatné karty (GeForce 840M) | 85 % rozlišení, vyhlazování hran, stíny všech objektů, plodiny z ploch do 60 m, řídká stébla trávy, odlesky oblohy, listí na stromech                |
| Vysoká    | běžné herní karty                      | plné rozlišení i na displejích s jemnými pixely, stínová mapa 2048, celý les, nejdelší dohled, plodiny z ploch do 90 m, hustší tráva, postprocessing (SSAO, bloom, opar, paprsky slunce, FXAA) |
| Ultra     | výkonné karty                          | stínová mapa 4096, hustší plodiny (tři plochy na metr čtvereční) do 140 m, nejhustší tráva, dvojnásobně hustý les na kopcích, hustší déšť, postprocessing s vyhlazováním MSAA |

- **Měřič FPS:** v pravém horním rohu ukazuje FPS, nejhorší snímek, počet vykreslovacích volání a trojúhelníků. Vypíná se v menu.
- **Notebook se dvěma grafikami:** Windows často nechá prohlížeč na integrované Intel. Ve Windows otevři Nastavení → Systém → Obrazovka → Grafika, přidej prohlížeč, zvol „Vysoký výkon“ a prohlížeč restartuj. Hra v menu ukazuje, kterou kartu používá.

Proč zbývá výkon na detail:

- **Vozový park:** stroj nebo nářadí dál od kamery než 70 / 90 / 120 / 160 m (Nízká / Střední / Vysoká / Ultra) se kreslí zjednodušeným modelem (kolem 1,5–6,5 tisíce trojúhelníků místo 45 tisíc) a všechny takové kusy jednoho druhu jedním voláním. Stroj, který řídíš, a jeho nářadí zůstávají vždy podrobné. S 36 kusy na dvoře to dělá na Nízké 87 volání a 381 tisíc trojúhelníků místo 234 volání a 1,16 milionu. Noční reflektory jsou jen tři a dostanou je stroj, který řídíš, a nejbližší stroje v práci, takže další stroje neubírají výkon světly.
- Stroje a budovy se při startu slučují: díly obyčejné barvy do jednoho tvaru s barvou, drsností a kovovostí ve vrcholech, sklo a světla zvlášť (`bake()` v `src/render/materials.js`). Lesklý lak, guma, ocel i nápisy z atlasu (`src/vehicles/parts.js`) jednoho stroje tak jdou jedním vykreslovacím voláním, podrobnější stroje (kolem 45 tisíc trojúhelníků místo 10 tisíc) stojí jen trojúhelníky.
- Terén a stromy mají úrovně detailu podle vzdálenosti od kamery; hranice nastavuje předvolba (`terrainFine`, `treeNear`… v `src/core/settings.js`). Vzdálený terén má mřížku 10 nebo 20 m, jízda se vždy řídí jemnou mřížkou 5 m. Na Nízké a Střední se vzdálené stromy v hratelné oblasti jen vizuálně zředí, překážkou zůstávají všechny.
- Prázdné části polí (strniště, oranice) se nekreslí vůbec.
- Mapu okolí dostanou jen lesklé a sloučené materiály (stroje, budovy, sklo, voda), ne terén, pole a tráva, kde by stála každý pixel; u sloučených materiálů přidává jen odlesky. Postprocessing kreslí scénu do HDR cíle bez MSAA a hrany vyhladí FXAA (MSAA v HDR cíli stálo na slabší kartě 15 % FPS); SSAO je v poloviční velikosti, bloom ve čtvrtinové a osminové. Na Vysoké stojí světla a materiály proti kroku bez nich asi 8 % FPS, na Střední a Nízké nic.
- Plodiny z průhledných ploch se kreslí jen v blízkých částech polí, dál jsou to levné kvádry (z dálky vypadají stejně a průhledné plochy by stály hodně překreslování). Stébla trávy jsou jedním voláním: GPU je rozmístí po terénu kolem kamery a sám je posouvá, procesor s nimi nemá práci. Na Vysoké stojí nový terén, pole, silnice a tráva proti dřívějšku asi 10 % FPS, na Střední 3 %, na Nízké nic.

- Statické budovy a díly strojů se při startu slučují podle materiálu (`bake()` v `src/render/materials.js`). Vypadají stejně, jen je grafická karta dostane v pár velkých dávkách místo stovek malých, a ušetřený čas jde do stínů, rozlišení a hustší scény.
- Plodiny, stromy, živé ploty, balíky, částice i déšť jsou instancované, takže tisíce kusů stojí stejně volání jako jeden. Díky tomu může Ultra kreslit plastické plodiny na všech polích a dvakrát víc stromů bez většího počtu volání.
- Plodiny pole mimo záběr kamery a mimo oblast stínů se nekreslí vůbec.
- HUD nepoužívá rozmazání pozadí ani CSS filtry přes plátno a sahá do DOM jen při změně hodnoty.

## Vyvážení ekonomiky

Čísla, která rozhodují o výdělcích (ceny polí, produkce zvířat a skleníků, dřevo, harvestor, mzda pomocníka), jsou v `src/game/balance.js`. Příkaz `npm run ekonomika` z nich spočítá tabulku tržeb, nákladů a návratnosti. Cíl: budovy a stroje se vrátí za 5–10 herních dnů, pole zůstávají hlavním příjmem (hektar se zaplatí asi za čtyři sklizně).

| Investice   | Cena         | Zisk za herní den                           | Návratnost    |
| ----------- | ------------ | ------------------------------------------- | ------------- |
| Kravín      | 650 000 Kč   | asi 79 000 Kč (s mlékárnou 108 000 Kč)      | 8 dní (6 dní) |
| Kurník      | 140 000 Kč   | asi 16 600 Kč                               | 8 dní         |
| Ovčín       | 280 000 Kč   | asi 41 000 Kč (seno za cenu balíku)         | 7 dní         |
| Vepřín      | 420 000 Kč   | asi 60 000 Kč                               | 7 dní         |
| Míchací vůz | 220 000 Kč   | asi 21 600 Kč víc za mléko                  | 10 dní        |
| Skleník     | 180 000 Kč   | asi 23 000 Kč                               | 8 dní         |
| Harvestor   | 1 600 000 Kč | celý les asi 630 000 Kč, doroste za 2,5 dne | 6–7 dní       |

## Vývojářský režim

Panel pro ladění a testování otevřeš klávesou **F9** nebo tlačítkem **Dev** nahoře. Funguje při spuštění přes `npm run dev` (nebo `spustit.bat`). V sestavené verzi ho zapneš přidáním `?dev` za adresu.

- **Čas:** hodina posuvníkem, ± den, skok na další roční období, rychlost času s násobičem až 60× a zastavení času (stroje dál jezdí).
- **Počasí:** vynutí jasno, oblačno nebo déšť, nebo vrátí počasí podle předpovědi.
- **Grafika:** předvolba a vlastní úpravy (rozlišení, stínová mapa, dohled, hustota stromů, expozice, stíny, stíny a tvar plodin). Úpravy se pamatují, dokud v panelu nedáš Zpět na předvolbu nebo nevybereš předvolbu v menu.
- **Svět:** vypínače oblohy, mraků, zvířat, větru, stop kol, částic a skrytí HUD na snímky obrazovky.
- **Život v kraji:** počet aut (0–14) a cyklistů (0–10), vypínač lidí a strojů sousedů, tlačítko, po kterém sousedé hned převezmou volné nabídky; přehled lidí v dohledu a toho, co sousedé dělají.
- **Atmosféra:** ranní mlha, večer s lampami, duha hned, podzim s padajícím listím, letní noc se světluškami, mokro po dešti a sucho (období se přeskakuje jen dopředu).
- **Stroj:** pohled z kabiny, přesun k myčce, zablácení a umytí stroje s nářadím; ukazuje špínu, mokro a kabinu.
- **Dožínky:** skok na nejbližší dožínky, přesun ke kroužku, vynulování letošních výher; ukazuje stav soutěže, traktoriády a rekord.
- **Zvuk motoru:** zkušebna motorů, viz Zvuk.
- **Hra:** peníze, všechny stroje a budovy, natankování a opravy, zralá pole, nákup všech polí, plné krmivo a voda, cíle a přesun stroje na vybrané místo.
- **Info:** grafická karta, rozlišení, vykreslovací volání a trojúhelníky, paměť, poloha a stav stroje.
- **Mapa:** otevře editor mapy, viz níže.

### Editor mapy

V panelu F9 → **Editor mapy** se ukáže plán celého kraje shora (sever nahoře, stejně jako velká mapa M). Hra mezitím stojí.

- **Pole a louky:** klikni a táhni. Rohy vybraného pole mění jeho velikost, po metrech. V panelu vpravo nastavíš číslo, rozměr, louku, vlastnictví na začátku hry, stav a plodinu v nové hře, kvalitu půdy a cenu (prázdná cena = podle plochy).
- **Cesty:** táhni body. Dvojklik na cestu přidá bod, Delete smaže vybraný bod. **Přidat → Cestu** a klikáním zadáš novou, Enter ji dokončí.
- **Rybníky a lesní parcely:** posun a úchyty velikosti. Stromy pro harvestor se v parcelách rozmístí znovu.
- **Budovy:** výkupy (mlýn, olejna, cukrovar, krmivárna, dřevosklad, mlékárna), pila, kravín, kurník, ovčín, vepřín a míchací vůz táhneš i s jejich budovami a kruhy. Mimo rovinu u farmy a v městečku se pod budovou srovná terén. V `map.json` se ukládá jen posun od výchozího místa.
- **Řeka:** táhni body, dvojklik přidá bod, Delete ho smaže. Kde cesta kříží řeku, postaví se most sám, i šikmý. **Brod** táhneš podél řeky, cesta přes brod most nedostane.
- **Kontrola** upozorní na překrývající se pole, pole na cestě, řece nebo v rybníce, posunutou budovu na poli, cestě, v řece nebo na jiné budově, brod bez cesty, příliš šikmý most, řeku, která nekončí na okraji mapy, a věci za hranicí mapy.
- **Uložit a obnovit** zapíše změny do `src/world/map.json` a hra se obnoví s novou mapou. Terén, terasy, stromy, živé ploty, cedule, minimapa i doprava se přizpůsobí samy. Do souboru jde uložit jen při spuštění přes `spustit.bat` nebo `npm run dev`. V sestavené verzi editor ukáže text k ručnímu zkopírování do `map.json`.
- **Výchozí mapa** vrátí původní rozvržení (prázdný `map.json`).
- **Rozehraná hra** se načte i po úpravě mapy. Posunuté pole stejné velikosti si drží úrodu, pole se změněnou velikostí začne znovu podle nastavení pro novou hru. Koupená pole zůstanou koupená, zakázky na smazaných polích propadnou.
- **Zůstává na místě:** městečko a železnice s nádražím, dvůr s budovami, skleníky, vesnice a kaplička.

## Struktura

```
src/
  main.js              start hry a hlavní smyčka
  audio.js             zvuk: skupiny hlasitosti, syntetizované okolí a efekty
  audio/               motory z nahrávek (engines.js, profiles.js), hudba (music.js)
  core/                pomocné funkce, vstup, nastavení grafiky
  render/              renderer, materiály a slučování, kamera, den a noc, obloha (sky.js),
                       vítr ve vegetaci (wind.js), displeje a zrcátka v kabině (cabview.js),
                       procedurální textury terénu, polí, silnic, plodin, budov a listí (textures.js),
                       mapa okolí (envmap.js), postprocessing (post.js)
  world/               stébla trávy (grass.js), věci na dvoře (yard.js), panáček pěšky (person.js), rozvržení mapy (layout.js, úpravy z editoru v map.json), terén s terasami, řekou a rybníky,
                       budovy a vesnice, městečko, nádraží a pískovna (landmarks.js),
                       vegetace, pole a louky, balíky, kravín, kurník a skleníky
                       (farmstead.js), les (forest.js), zvířata (wildlife.js),
                       auta a vlak (traffic.js), hromady na zemi (heaps.js), postavené budovy (placed.js)
  vehicles/            modely a jízda strojů, kolizní tvary a nárazy (body.js), nářadí, přívěs
  game/                stav hry, plodiny, výkupy, práce nářadí, akce, ukládání,
                       stroje a ekonomika, zakázky, počasí a roční období, pomocníci,
                       zvířata a skleníky (farm.js), stáda, hnůj a palety (animals.js), lesnictví (forestry.js), cíle a statistiky (goals.js),
                       osivo a hnojivo v zásobnících a big bagy (supply.js), nakladače (loader.js), škody počasí (climate.js),
                       stavby (build.js), výroba (production.js)
  fx/                  částice (prach, plevy, kouř), déšť a sníh, stopy kol (tracks.js)
  ui/                  HUD, minimapa, menu, kancelář, měřič FPS, hlášky, vývojářský panel (devpanel.js),
                       editor mapy (mapeditor.js)
public/audio/          smyčky motorů a hudba, autoři a licence v CREDITS.md
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
10. **Výkon a ekonomika:** úrovně detailu terénu, stromů a plotů, slučování barev do vrcholů, `npm test`, čísla ekonomiky v `balance.js` a `npm run ekonomika`, editor mapy (F9).
11. **Pomocníci na velké mapě:** jízda po silnicích, odvoz úrody na nejlepší výkup, těžba dřeva, dovoz nafty, posílání z Kanceláře.
12. **Obsah:** sníh v zimě, seno pro krávy, mlékárna, krmná směs, ovce a prasata; editor posouvá i budovy, řeku a brod.
13. **Vozový park:** víc kusů každého stroje a odstavná plocha, záložka Vozový park, zjednodušené vzdálené stroje, 60 modelů známých značek, výkon traktoru, jeden pomocník s volbou nářadí, nový obchod s protiúčtem a fotkami strojů.
14. **Zvuk:** motory z nahrávek (5 sad, řazení, startování, stroje okolo a doprava), hudba (kytara a klavír), nastavení zvuku v menu, zkušebna motorů.
15. **Jízda a nárazy:** řízení omezené přilnavostí pneumatik, smyk auta, otáčení kolem nápravy, náklon karoserie, kolize podle tvaru strojů včetně lišt a nářadí, realistický náraz s otřesem a zvukem.
16. **Pěšky:** panáček, který chodí a běhá, nastupuje do strojů (E) a vystupuje, kolize s budovami a stroji, kroky, nová hra začíná pěšky.

## Pěšky

Nová hra začíná pěšky u dveří statku; kombajn stojí kousek odsud na cestě. Panáček (farmář v kostkované košili a kšiltovce) se ovládá jako stroj: W nebo šipka nahoru jde dopředu, S nebo šipka dolů couvá, A/D nebo šipky vlevo a vpravo ho otáčejí a kamera se drží za ním; s Shiftem běží (asi 23 km/h místo 8 km/h; na dotykovém ovládání tlačítko Běh). Klávesou E nastoupí do stroje, u kterého stojí (do 2,5 m od něj), a ze stroje vystoupí vedle kabiny (vlevo, když tam není místo, tak vpravo, za strojem nebo před ním). Vystoupit jde jen ze stojícího stroje. Ve stroji je farmář vidět, jak sedí za volantem; klávesou V se díváš jeho očima: z místa řidiče přes kapotu, se širším zorným polem, s rukama na volantu, které se při zatáčení posunou po věnci. Myší nebo Z/X se rozhlížíš, za chvíli se pohled vrátí dopředu (pomocník v modré košili sedí ve stroji, který řídí). Opuštěný stroj zastaví a za pár sekund zhasne motor. Do stroje, který řídí pomocník, nenastoupíš. Tab, velká mapa i Vozový park v Kanceláři tě do stroje dál přenesou odkudkoli.

Pěšky narážíš do budov, plotů, kmenů stromů, strojů, přívěsů, aut a vody a chodíš po terénu. Kamera je blíž (kolečkem 3,5–40 m). Když ji otočíš myší nebo Z/X, po vteřině se vrátí za tebe. HUD ukazuje, že jdeš pěšky, kde stojí stroj, ve kterém jsi seděl naposledy, a nabídne nastoupení nebo koupi pole u cedule (F). Klávesy, které ovládají stroj (mezerník, H, R, 1–8), pěšky jen připomenou, že máš nastoupit. Kroky je slyšet jinak na cestě, na poli, v trávě a ve sněhu. Hra si pamatuje, jestli jsi pěšky a kde. Kód je v `src/world/person.js`.

## Jízda a nárazy

- **Řízení:** volant se natáčí plynule a sám se vrací. V rychlosti se plný rejd omezí na to, co pneumatiky udrží: auto zatáčí nejvýš asi 1 g, traktor 0,5 g, kombajn 0,35 g. Na mokru (v dešti a dokud neoschne), mimo silnici a na sněhu drží kola méně: stroj se v zatáčce rozšiřuje a zpomaluje, auto dostane smyk a záď mu ujede. Stroj se otáčí kolem nápravy, která nezatáčí: auto a traktor kolem zadní, kombajn a sklízeč kolem přední (zatáčejí zadními koly). Karoserie se v zatáčce naklání a při brzdění kývne dopředu.
- **Tvar pro kolize:** každý stroj je jeden nebo víc obdélníků změřených z jeho 3D modelu: tělo (bez výsypné roury a jeřábu harvestoru), lišta kombajnu a sklízeče cukrovky a zapojené nářadí, takže narážejí i lišta a 12m secí stroj. Stromy překážejí kmenem, ne korunou. Kód je v `src/vehicles/body.js` a `drive()` v `src/vehicles/vehicles.js`.
- **Náraz:** stroj se o překážku zastaví a trochu odskočí. Když narazí šikmo, klouže podél ní a ztratí jen část rychlosti. Když narazí rohem, pootočí se. Chvíli po nárazu klouže, než ho kola znovu chytí. Silný náraz krátce zatřese kamerou a je slyšet. Stroje se nárazem nepoškozují.
- **Odstavná plocha** má místa po 14 m, aby se vedle sebe vešly i kombajny s nejširšími lištami.
- **Omezení:** Claas Lexion 8900 (lišta 14 m) s nasazenou lištou neprojede alejemi podél silnic, John Deere S790 (12,4 m) jen přesně středem; s lištou na vozíku projedou oba. Pomocníci objíždějí překážky podle těla stroje bez lišty a nářadí.

## Auta

Auta (obchod: Jeep Lesák 4×4 290 000 Kč, Dacia Duster 4×4 420 000 Kč, Toyota Hilux 750 000 Kč, dají se i pronajmout) se hodí na přejezdy po kraji: k polím na kopcích, do lesa nebo do městečka. Lesák jede všude 80 km/h, Duster po cestě 95 a mimo ni 71 km/h, Hilux 100 a 90 km/h. Nic netáhnou a nepracují, pomocník je neřídí. Tankují se jako ostatní stroje, mezerník troubí.

## Louky a seno

Tři louky (24–26) leží u řeky a u rybníků. Koupíš je levněji než pole, ale nic se na nich nesije. Seno se dělá jako ve FS: **sečení → obracení → shrnutí → lisování** (`src/game/work.js`, sušení v `src/world/fields.js`).

- **Sečení:** žací lišta poseče vysokou trávu a nechá uprostřed záběru řádek čerstvé trávy (tmavě zelený). Posečená tráva sama doroste zhruba za 10 herních hodin, pod ležícím řádkem neroste.
- **Sušení:** řádek čerstvé trávy uschne na seno (žlutozelený) za 6 herních hodin. **Obraceč** trávu rozhodí, takže uschne za 1,5 h. Rozhozenou trávu lis nesebere: **shrnovač** ji shrne zpátky do řádku.
- **Lisování:** lis udělá ze suchého řádku kulaté balíky sena, z čerstvého balíky travní senáže (zelené, u stodoly jen za 600 Kč). Ty zabalí **ovíječ balíků**: připojíš ho za traktor, spustíš mezerníkem a projedeš kolem balíků, každý zabalí za 60 Kč do tmavé fólie. Zabalená senáž stojí u stodoly 2 200 Kč a krávy ji žerou stejně jako seno.
- **Balíky** naložíš přívěsem a u stodoly prodáš (ceník ukazuje cenu sena a senáže zvlášť), nebo je vyložíš do krmelce kravína (seno i senáž) či ovčína (seno).
- **Pomocník** umí louku posekat, obrátit, shrnout i slisovat. Polní nářadí a kombajn na louce nic nedělají a na loukách nejsou zakázky.

## Siláž

Týmová práce jako ve FS (`src/game/forage.js`). **Řezačka** (samojízdná, v obchodě mezi sklízeči) seká kukuřici na siláž (už od posledního stupně růstu, nebo zralou) a sbírá řádky čerstvé trávy z luk. Má jen malý zásobník: řezanku metá výmetným komínem vlevo do přívěsu, který jede vedle ní. Přívěs řídíš sám (Tab přepíná stroje), řezačku pomocník neřídí. Místo řezačky můžeš řádky trávy sbírat **samosběracím vozem** Pöttinger Jumbo: spustíš mu sběrač mezerníkem.

- **Silážní žlab** stojí severně od kravína, zelený kruh je u jeho otevřeného konce. Přívěs s řezankou v něm vysypeš klávesou F.
- **Dusání:** řezanku udusáš tak, že po ní jezdíš traktorem (těžší a rychlejší stroj dusá víc, velkou hromadu déle). Stav ukazuje výzva u žlabu a Kancelář → Farma.
- **Zakrytí:** od 20 000 l a udusání aspoň 90 % žlab zakryješ plachtou (F v kruhu, i pěšky). Za 24 herních hodin je z řezanky siláž.
- **Siláž** naložíš prázdným přívěsem v kruhu žlabu (F). V zeleném kruhu u kravína ji vysypeš do krmelce, v krmné směsi se počítá jako seno. Bioplynka u cukrovaru koupí siláž za 1,80 Kč/l a čerstvou řezanku za 0,60 Kč/l.
- Cíl **Siláž** chce 40 000 l řezanky.

## Zvuk

Zvuk se zapne po kliknutí na Hrát a vypíná se tlačítkem Zvuk nahoře. V menu je **Nastavení zvuku** se čtyřmi posuvníky (Hudba, Motory, Okolí, Efekty) a volbou hudby (Obojí, Kytara, Klavír); nastavení se ukládá v prohlížeči. Motory a okolí v menu a v Kanceláři ztichnou, hudba hraje dál. Když přepneš na jinou záložku prohlížeče, zvuk se pozastaví.

- **Motory** jsou z nahrávek skutečných strojů (`public/audio/engines`, `src/audio/engines.js`). Každý model patří do jedné sady smyček a v sadě se liší výškou (menší a levnější stroj zní výš), hlasitostí a syčením turba (`src/audio/profiles.js`):

  | Sada | Stroje | Nahrávky |
  | --- | --- | --- |
  | starý traktor | Zetor Major 80 | Ursus C-342 a C-328 |
  | traktor | ostatní traktory; Claas Axion a Fendt 942 s plynulou převodovkou (otáčky drží, tiše hučí hydrostat) | John Deere 5820, nahoře Mercedes OM 67/4 |
  | velký stroj | kombajny, sklízeče cukrovky, řezačky, harvestory (s pilou při kácení) | volnoběh autobusu MAN, práce harvestoru Komatsu 941 |
  | dieselové auto | Dacia Duster, Toyota Hilux, auta v dopravě | dodávka Tarpan 239 D, Mercedes OM 67/4 |
  | benzínové auto | Lesák, auta v dopravě | Volvo 850 T5 |

  Smyčky jedné sady hrají současně: slyšet jsou dvě nejbližší aktuálním otáčkám a každá se přehrává rychleji nebo pomaleji podle otáček. Traktor zvedá otáčky s rychlostí, plynem a prací. Kombajn a harvestor jedou i pracují na stálých pracovních otáčkách. Auta řadí pět stupňů, takže otáčky stoupají a po přeřazení klesnou. Při tahu a práci motor zní hlasitěji a jasněji, po puštění plynu tlumeněji.
- **Startování:** když do stroje přesedneš nebo ho převezme pomocník, motor nastartuje startérem. Stroj, ve kterém nikdo nesedí a nepracuje, po 6 sekundách zhasne.
- **Stroje okolo:** najednou zní až čtyři motory: stroj, ve kterém sedíš, a nejbližší běžící stroje (pomocník, opuštěný stroj, který ještě nezhasl), z dopravy nejvýš dvě auta. Zvuk slábne a tlumí se se vzdáleností a ozývá se zleva nebo zprava podle kamery.
- **Hudba:** klidné skladby Kevina MacLeoda, dvě kytarové (Windswept, Morning) a tři klavírní (Fresh Air, Friday Morning, Facile), v náhodném pořadí s 1–3 minutami ticha mezi nimi (`src/audio/music.js`). Při hlasité práci se ztiší, v menu je výraznější.
- **Okolí a efekty** jsou syntetizované (`src/audio.js`): mlácení, nářadí v půdě, vítr, déšť, ptáci přes den, cvrčci v noci, zvířata, houkačky a cinknutí kasy při příjmu peněz.
- **Zkušebna:** ve vývojářském režimu (F9) je sekce Zvuk motoru: stroj, ve kterém sedíš, zahraje motor libovolného modelu v otáčkách a zátěži z posuvníků a panel ukazuje otáčky a míchání smyček.

**Autoři a licence** (podrobně v [public/audio/CREDITS.md](public/audio/CREDITS.md)): hudba Kevin MacLeod ([incompetech.com](https://incompetech.com)), licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Motory: nahrávky z Wikimedia Commons od [Work With Sounds](https://commons.wikimedia.org/wiki/Commons:Work_With_Sounds) (Museum of Municipal Engineering, Werstas, Technical Museum of Slovenia; CC BY 4.0), Jojhnjoy a Jonas Tittmann (CC BY-SA 4.0; smyčky z jejich nahrávek se šíří pod stejnou licencí) a X5DragonFire (CC0).

## Plánováno

Zbývající kroky vozového parku, odložené na později:

- **Bazar s ojetými stroji:** nová záložka obchodu. Každý den 4–6 nabídek ojetých strojů ve stavu 30–85 % za 35–70 % nové ceny. Nabídky se ukládají, nedají se pronajmout a platí pro ně stejné protiúčty jako u nových strojů. Opotřebovaný stroj se vyplatí opravit, nebo ho levně dojezdit.
- **Vyvážení strojů:** `npm run ekonomika` vypíše tabulku strojů (hektary za hodinu, náklad na hektar a návratnost) a podle ní se doladí ceny a výkony. Smoke test s plným vozovým parkem, doplnění README a nové snímky.

## Známá omezení a nápady

- Nápady na další obsah: pomocník, který sám krmí, vozí mléko nebo jezdí s přívěsem vedle řezačky.
- Pomocník na poli neobjede budovu, kterou sis na poli postavil. Přeprava ze sila neumí vozit z hromady ani výrobky z výroben.

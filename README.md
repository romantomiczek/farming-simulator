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
| F                  | prodej úrody ve výkupu, krmení zvířat, překládka do přívěsu, vysypání přívěsu, prodej balíků u stodoly, tankování, voda pro skleníky, kácení stromu a prodej dřeva, výměna nářadí v kůlně, koupě pole u cedule |
| 1–8                | v kůlně: přímý výběr nářadí traktoru (1–8) nebo adaptéru kombajnu (1–2)                                                                                                                                        |
| R                  | v kůlně: oprava stroje a připojeného nářadí                                                                                                                                                                    |
| K                  | kancelář: obchod se stroji, zakázky, farma a pozemky, cíle, finance (čas se zastaví)                                                                                                                           |
| M                  | velká mapa celého kraje; kliknutím na svůj stroj do něj přesedneš                                                                                                                                              |
| H                  | najmout pomocníka pro stroj, ve kterém sedíš, nebo ho propustit                                                                                                                                                |
| C                  | změnit osivo                                                                                                                                                                                                   |
| T                  | rychlost času 1× / 5× / 20×                                                                                                                                                                                    |
| Z / X, tažení myší | otočení kamery                                                                                                                                                                                                 |
| kolečko            | přiblížení                                                                                                                                                                                                     |
| Esc                | menu, nastavení grafiky a zvuku, uložení do souboru                                                                                                                                                            |
| F9                 | vývojářský režim (jen při vývoji, viz níže)                                                                                                                                                                    |

## Stroje a plodiny

**Vozový park:** strojů a nářadí můžeš mít kolik chceš, i víc kusů stejného druhu (dva traktory, tři přívěsy…). První kus každého druhu stojí u kůlny jako dřív, další parkují na odstavné ploše jižně od dvora, která roste podle potřeby. Nářadí se připojuje ke konkrétnímu traktoru: v kůlně klávesy 1–8 nabízejí volné kusy, nářadí na jiném traktoru je obsazené. Kombajn přeloží zrno do kteréhokoli přívěsu pod rourou. V Kanceláři (K) → **Vozový park** vidíš každý kus s místem, stavem, naftou a nákladem, odtud do něj přesedneš nebo ho prodáš či vrátíš z pronájmu.

Stroje mají lesklý lak, profilované kapoty a blatníky, kola s dezénem, disky, náboji a maticemi, kabiny s rámy, dveřmi, stěrači, sedadlem a palubní deskou, světla a majáky, hydrauliku s hadicemi a spojkami, schůdky s plechem, SPZ, výstražné pruhy a nápisy.

**Modely a značky:** obchod nabízí 60 modelů od nejlevnějších po nejlepší (katalog v `src/game/catalog.js`). Liší se barvami a velikostí podle značky i parametry. Značky jsou jen jako názvy, stroje nenesou loga.

| Druh              | Modely                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Traktory          | Zetor Major 80, Brázda 140 (start), Zetor Forterra 150 HD, Massey Ferguson 6S.165, Case IH Puma 185, New Holland T7.210, John Deere 6R 250, Claas Axion 870, Fendt 942 Vario (80–420 koní, 40–60 km/h) |
| Kombajny          | Sampo Rosenlew SR2045, Klas 7 (start), Claas Tucano 450, Deutz-Fahr C6205, Case IH Axial-Flow 7250, John Deere S790, Claas Lexion 8900 (lišta 3,9–12,3 m, zásobník 4 500–18 000 l)                     |
| Sklízeče cukrovky | Bulva 6, Grimme Rexor 620, Holmer Terra Dos T4-40, Ropa Tiger 6S (6–9 řádků, 20–35 tisíc l)                                                                                                            |
| Harvestory        | Les 6, Les 8, Komatsu 931XC, John Deere 1270G, Ponsse Scorpion King (16–32 m³, rychlost kácení)                                                                                                        |
| Auta              | Jeep Lesák 4×4, Dacia Duster 4×4, Toyota Hilux (80–100 km/h, mimo cesty pomalejší podle modelu)                                                                                                        |
| Kultivátory       | Bednar Fenix 3 m, Kultivátor 4,2 m, Lemken Karat 5, Horsch Terrano 6 FX a 10 FX                                                                                                                        |
| Pluhy             | Kverneland 3 radlice, Pluh 5 radlic, Lemken Juwel 6 radlic, Kuhn Vari-Master 8 radlic                                                                                                                  |
| Secí stroje       | 3 m, 4 m, Amazone Cirrus 6003, Väderstad Rapid 800S, Horsch Pronto 12 SW                                                                                                                               |
| Rozmetadla        | 12 m, Amazone ZA-TS 24 m, Rauch Axis 30 m                                                                                                                                                              |
| Žací lišty        | 3 m, Pöttinger Novacat 352, Krone EasyCut B 870 (motýlková 8,7 m)                                                                                                                                      |
| Lisy              | Lis na balíky, John Deere V461R, Krone Comprima V150 (rychlejší)                                                                                                                                       |
| Přívěsy           | BSS 10 t, Sklápěcí přívěs 14 000 l, Fliegl TMK 22, Krampe Bandit 750, Annaburger HTS 34 (až 40 000 l a 12 balíků)                                                                                      |
| Cisterny          | 5 000 l, 8 000 l, Joskin Modulo2 11000, Zunhammer SKE 18.5                                                                                                                                             |

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

Ceny každého výkupu kolísají jinak. Ceník vpravo ukazuje pro každou plodinu, kde se teď prodá nejdráž. Vzdálenější výkupy platí víc. Minimapa sleduje stroj, ve kterém sedíš, celý kraj ukáže velká mapa (M).

**Roční období** trvají tři dny a hra začíná v létě. Na jaře rostou plodiny normálně, v létě rychleji a na podzim pomaleji. V zimě nic neroste a nesije se. Krajina a stromy mění barvu a v zimě během pár herních hodin napadne sníh: bílé jsou louky, pole, střechy, cesty i koruny stromů, místy prosvítá tráva. Když sněží, přibývá ho rychleji, na jaře roztaje. Stroje zůstávají bez sněhu.

**Počasí** se mění po čtyřech hodinách: jasno, oblačno, déšť, v zimě sněžení. Za deště a hodinu po něm se nesklízí. Déšť trochu urychlí růst. Předpověď je pod hodinami.

**Atmosféra:** obloha se sluncem, které zapadá za obzor, s měsícem, hvězdami a mraky (při zatažení jich je víc a šednou). Ráno a večer je světlo zlaté. Obilí, stromy a živé ploty se vlní ve větru, při dešti víc. Kola nechávají v poli koleje, které zmizí, až pole obděláš, a za sucha se za stroji práší. Kameru sklopíš myší až k obzoru.

**Viditelná práce:** kombajn rozhazuje za sebou z drtiče vějíř slámy a plev, sklízeč cukrovky sype hlínu a odhazuje chrást. Pluh převrací hroudy doprava, kultivátor je vyhazuje nahoru a za kultivátorem, pluhem i secím strojem zůstává pruh čerstvé tmavé hlíny, který za dvě minuty oschne (`src/fx/furrows.js`). Lis zvedá ze řádku seno a slámu a balík vypadne s obláčkem stébel. Z výsypné roury i ze sklopeného přívěsu teče souvislý proud zrna (`src/fx/streams.js`). Po dešti jsou pole a tráva tmavší a na cestách se lesknou kaluže, které s osycháním mizí (`src/fx/wet.js`).

**Špína a myčka** (`src/game/dirt.js`): stroje se při práci na poli a jízdě mimo cesty postupně špiní, v blátě po dešti mnohem rychleji (za sucha je traktor celý zablácený asi po sedmi minutách práce, v blátě za necelé dvě). Bláto je na stroji vidět: tmavší spodek, kola a fleky, nářadí a přívěs se špiní s ním. Déšť trochu opláchne. V myčce jižně od kravína (modrý rám a kroužek) F stroj i s nářadím umyje za 250 Kč. HUD ukazuje „špinavý“ nebo „zablácený“, hra si špínu pamatuje.

**Nálada krajiny** (`src/world/atmosphere.js`): ráno od svítání do devíti se zatahuje mlha, nejhustší dole u řeky. Když v podvečer přestane pršet a slunce je nízko, objeví se naproti slunci duha. Večer se rozsvítí asi dvě třetiny oken a pouliční lampy ve vesnici, v městečku a v rozích dvora, které kreslí na zem teplý kruh světla. Z komínů statku a vesnických domů se kouří, nejvíc v zimě a ráno a večer. Na podzim padá ze stromů kolem tebe listí, v letních nocích létají nad trávou světlušky.

**Zvuk:** motory z nahrávek skutečných strojů, hudba, vítr, déšť, ptáci a zvířata, viz [Zvuk](#zvuk).

**Zvířata v krajině:** pes běhá po dvoře a vyběhne za projíždějícím strojem, u stodoly a domu posedávají dvě kočky. V údolí skáčou zajíci, na kraji lesa a kopců žijí lišky (víc za soumraku a v noci), na jižních svazích se pase stádo srnek, které za svítání a soumraku schází na louku. Hejno vran sedá na pole za strojem, který orá, kultivuje nebo sklízí. Zvířata utíkají před jedoucími stroji.

## Zvířata, skleníky a les

Všechno se kupuje v Kanceláři (K) → Obchod. Přehled zásob a produkce je v záložce **Farma**. Mléko, vejce, vlna, vepřové a rajčata se odvážejí a platí o půlnoci.

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
- **Les:** na severu je smrková plantáž. Harvestor kácí stromy, které dorostly aspoň na 85 % (F u stromu), a pojme 24 m³ dřeva. Dřevo prodáš na pile na konci polní cesty (F, kolem 1 500 Kč/m³) nebo v dřevoskladu v městečku. Místo pokáceného stromu vyroste asi za tři dny nový, v zimě roste pomaleji.

Budovy se nedají pronajmout, jen koupit. Dřívější vylepšení nahradily modely: uložená hra s nimi dostane odpovídající stroj (silnější motor → Case IH Puma 185, větší zásobník → Case IH Axial-Flow 7250, široký kultivátor → Horsch Terrano 6 FX, nástavba → Fliegl TMK 22).

## Pomocníci

Najednou pracuje **jen jeden pomocník**: dokud pracuje, další nenajmeš (Kancelář a klávesa H řeknou, kdo zrovna pracuje). Pomocníka najmeš dvěma způsoby:

- **Na místě:** zajeď strojem na pole a stiskni **H**. Pomocník převezme řízení a ty přesedneš do dalšího volného stroje.
- **Z Kanceláře (K → Farma → Pomocník):** u traktoru vyber nářadí (zapojené, nebo kterékoli volné; u každého je vidět, jak rychle s ním traktor pojede), pak pole nebo louku (u harvestoru les) a dej **Poslat**. Pro jiné nářadí si pomocník nejdřív dojede tam, kde stojí, a připojí si ho. Pak jede po silnicích (vpravo, jako auta, přes mosty a brod), práci udělá a vrátí se na dvůr. Tady vidíš i jeho stav a můžeš ho propustit.

- **Jak pracuje:** jezdí v pruzích sem a tam a na konci pruhu zvedne nářadí a otočí se. Nakonec projede souvratě na obou koncích pole.
- **S čím pracuje:** kultivátor, pluh, secí stroj (seje zvolené osivo), rozmetadlo, žací lišta, lis, kombajn, sklízeč cukrovky a harvestor. S přívěsem nepracuje.
- **Sklizeň:** pomocník poslaný z Kanceláře odveze plný zásobník na výkup, který zrovna platí nejvíc, a vrátí se tam, kde přestal. Najatý na místě čeká, až mu přistavíš přívěs a vyložíš ho (F). Za deště čeká, až plodiny oschnou.
- **Les:** s harvestorem kácí vzrostlé stromy, ke kterým se dostane, plný harvestor odveze na výkup dřeva s lepší cenou a pokračuje, dokud v lese jsou vzrostlé stromy.
- **Mzda:** 1 500 Kč za hodinu práce i cesty. Hodina je minuta skutečného času, takže zrychlený čas (T) mzdu nenafoukne. Když dochází nafta, pomocníkovi ji přivezou (cena nafty + 10 % za dovoz).
- **Konec:** skončí, když je práce hotová nebo dojdou peníze. Kdykoli ho propustíš klávesou H ve stroji, který řídí, nebo v Kanceláři.
- **Zakázky:** na sousedově poli může pracovat, jen když tam máš zakázku s odpovídajícím nářadím.
- **Překážky:** na poli pomocník nikdy neprojede budovou, plotem, stromem ani zaparkovaným strojem; když mu něco stojí v cestě déle než 8 sekund, skončí s hlášením. Na cestě po silnicích čeká na stroje a auta a krátké úseky mimo silnici (z kůlny, ke kraji pole) projede.
- **Ukládání:** pomocník se ukládá i s rozpracovanou trasou a fází (cesta pro nářadí, cesta, práce, odvoz). Po načtení hry pokračuje. Ze starší uložené hry s více pomocníky pokračuje jen první.

## Ekonomika

**Kancelář (K)** má šest záložek. Dokud je otevřená, čas stojí.

- **Obchod:** záložky Traktory, Sklízeče, Nářadí, Přívěsy a cisterny, Lesnictví, Auta a Budovy. Každý druh má řadu karet od nejlevnějšího po nejlepší: fotka stroje, cena, proužky parametrů a srovnání s tím, co už máš („+50 % výkon“). Filtr „Jen na co mám“ a řazení od nejlevnějšího nebo od nejlepšího. Klik na kartu otevře detail s modelem stroje, který se otáčí (tažením myší ho otočíš sám), se všemi čísly, poznámkou o výkonu a nákupem. Stroj koupíš, nebo pronajmeš (5 % ceny předem a 1,2 % ceny za každý den); v detailu můžeš zvolit **protiúčet**: starý stroj stejného druhu se prodá (55 % ceny podle stavu) a doplatíš rozdíl, nový převezme jeho nářadí i tvoje místo za volantem. Na začátku vlastníš traktor, kombajn, kultivátor, secí stroj a přívěs. Fotky karet hra nafotí sama hned po otevření obchodu, jednu za snímek (`src/render/previews.js`): ve studiu se stejným světlem jako ve hře, takže se nic nekompiluje a hra se nezadrhne.
- **Vozový park:** každý stroj a nářadí s místem, stavem a nákladem; přesednutí, prodej a vrácení z pronájmu.
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

| Předvolba | Pro koho                               | Co přidává                                                                                                                       |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Nízká     | integrovaná grafika (Intel HD 5500)    | 70 % rozlišení, plodiny bez stínů, řidší les, kratší dohled, vzdálený terén v hrubší mřížce, jednodušší stromy a keře            |
| Střední   | starší samostatné karty (GeForce 840M) | 85 % rozlišení, vyhlazování hran, stíny všech objektů                                                                            |
| Vysoká    | běžné herní karty                      | plné rozlišení i na displejích s jemnými pixely, stínová mapa 2048, celý les, nejdelší dohled                                    |
| Ultra     | výkonné karty                          | stínová mapa 4096, plastické plodiny (čtyři snopy na metr čtvereční místo kvádru), dvojnásobně hustý les na kopcích, hustší déšť |

- **Měřič FPS:** v pravém horním rohu ukazuje FPS, nejhorší snímek, počet vykreslovacích volání a trojúhelníků. Vypíná se v menu.
- **Notebook se dvěma grafikami:** Windows často nechá prohlížeč na integrované Intel. Ve Windows otevři Nastavení → Systém → Obrazovka → Grafika, přidej prohlížeč, zvol „Vysoký výkon“ a prohlížeč restartuj. Hra v menu ukazuje, kterou kartu používá.

Proč zbývá výkon na detail:

- **Vozový park:** stroj nebo nářadí dál od kamery než 70 / 90 / 120 / 160 m (Nízká / Střední / Vysoká / Ultra) se kreslí zjednodušeným modelem (kolem 1,5–6,5 tisíce trojúhelníků místo 45 tisíc) a všechny takové kusy jednoho druhu jedním voláním. Stroj, který řídíš, a jeho nářadí zůstávají vždy podrobné. S 36 kusy na dvoře to dělá na Nízké 87 volání a 381 tisíc trojúhelníků místo 234 volání a 1,16 milionu. Noční reflektory jsou jen tři a dostanou je stroj, který řídíš, a nejbližší stroje v práci, takže další stroje neubírají výkon světly.
- Stroje a budovy se při startu slučují: díly obyčejné barvy do jednoho tvaru s barvou, drsností a kovovostí ve vrcholech, sklo a světla zvlášť (`bake()` v `src/render/materials.js`). Lesklý lak, guma, ocel i nápisy z atlasu (`src/vehicles/parts.js`) jednoho stroje tak jdou jedním vykreslovacím voláním, podrobnější stroje (kolem 45 tisíc trojúhelníků místo 10 tisíc) stojí jen trojúhelníky.
- Terén a stromy mají úrovně detailu podle vzdálenosti od kamery; hranice nastavuje předvolba (`terrainFine`, `treeNear`… v `src/core/settings.js`). Vzdálený terén má mřížku 10 nebo 20 m, jízda se vždy řídí jemnou mřížkou 5 m. Na Nízké a Střední se vzdálené stromy v hratelné oblasti jen vizuálně zředí, překážkou zůstávají všechny.
- Prázdné části polí (strniště, oranice) se nekreslí vůbec.

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
                       vítr ve vegetaci (wind.js)
  world/               panáček pěšky (person.js), rozvržení mapy (layout.js, úpravy z editoru v map.json), terén s terasami, řekou a rybníky,
                       budovy a vesnice, městečko, nádraží a pískovna (landmarks.js),
                       vegetace, pole a louky, balíky, kravín, kurník a skleníky
                       (farmstead.js), les (forest.js), zvířata (wildlife.js),
                       auta a vlak (traffic.js)
  vehicles/            modely a jízda strojů, kolizní tvary a nárazy (body.js), nářadí, přívěs
  game/                stav hry, plodiny, výkupy, práce nářadí, akce, ukládání,
                       stroje a ekonomika, zakázky, počasí a roční období, pomocníci,
                       zvířata a skleníky (farm.js), lesnictví (forestry.js), cíle a statistiky (goals.js)
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
- **Omezení:** Claas Lexion 8900 (lišta 14 m) neprojede alejemi podél silnic, John Deere S790 (12,4 m) jen přesně středem. Pomocníci objíždějí překážky podle těla stroje bez lišty a nářadí.

## Auta

Auta (obchod: Jeep Lesák 4×4 290 000 Kč, Dacia Duster 4×4 420 000 Kč, Toyota Hilux 750 000 Kč, dají se i pronajmout) se hodí na přejezdy po kraji: k polím na kopcích, do lesa nebo do městečka. Lesák jede všude 80 km/h, Duster po cestě 95 a mimo ni 71 km/h, Hilux 100 a 90 km/h. Nic netáhnou a nepracují, pomocník je neřídí. Tankují se jako ostatní stroje, mezerník troubí.

## Louky a seno

Tři louky (24–26) leží u řeky a u rybníků. Koupíš je levněji než pole, ale nic se na nich nesije.

- **Sečení:** žací lišta (obchod, v kůlně klávesa 8) poseče vysokou trávu a nechá uprostřed záběru řádek sena. Posečená tráva sama doroste zhruba za 10 herních hodin, pod ležícím řádkem neroste.
- **Lisování:** lis udělá z řádku kulaté balíky sena (zelenější než sláma). Naložíš je přívěsem a u stodoly prodáš dráž než slámu, nebo je vyložíš do krmelce kravína či ovčína. Ceník ukazuje cenu balíku sena zvlášť.
- **Pomocník** umí louku posekat i slisovat. Polní nářadí a kombajn na louce nic nedělají a na loukách nejsou zakázky.

## Zvuk

Zvuk se zapne po kliknutí na Hrát a vypíná se tlačítkem Zvuk nahoře. V menu je **Nastavení zvuku** se čtyřmi posuvníky (Hudba, Motory, Okolí, Efekty) a volbou hudby (Obojí, Kytara, Klavír); nastavení se ukládá v prohlížeči. Motory a okolí v menu a v Kanceláři ztichnou, hudba hraje dál. Když přepneš na jinou záložku prohlížeče, zvuk se pozastaví.

- **Motory** jsou z nahrávek skutečných strojů (`public/audio/engines`, `src/audio/engines.js`). Každý model patří do jedné sady smyček a v sadě se liší výškou (menší a levnější stroj zní výš), hlasitostí a syčením turba (`src/audio/profiles.js`):

  | Sada | Stroje | Nahrávky |
  | --- | --- | --- |
  | starý traktor | Zetor Major 80 | Ursus C-342 a C-328 |
  | traktor | ostatní traktory; Claas Axion a Fendt 942 s plynulou převodovkou (otáčky drží, tiše hučí hydrostat) | John Deere 5820, nahoře Mercedes OM 67/4 |
  | velký stroj | kombajny, sklízeče cukrovky, harvestory (s pilou při kácení) | volnoběh autobusu MAN, práce harvestoru Komatsu 941 |
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

- Nápady na další obsah: siláž a senáž, chov zvířat s rozmnožováním, pomocník, který sám krmí a vozí mléko.

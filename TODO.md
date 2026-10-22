# TODO: víc jako Farming Simulator 25

Herní smyčka už je hodně bohatá: sklizeň, prodej, sláma, zvířata, les, pomocníci, sousedé i dožínky. Na rozdíl od FS25 ale hra vypadá jako „hračka shora“ a polní práce nemá tolik rozhodování. Návrhy jsou seřazené podle toho, kolik pocitu „jako ve Farming Simulatoru“ přinesou za vynaloženou práci.

## Vizuál

### 1. Kamera a HUD (nejlevnější a nejvíc znát)

- Kamera stojí ve výchozím stavu 52 m od stroje a dívá se zhora (`cam` v `src/render/camera.js`), takže to působí jako strategie. Ve FS je kamera asi 10–15 m za strojem a nízko nad zemí, takže je vidět horizont. Jen tahle změna přinese velkou část „FS pocitu“.
- HUD tvoří světlé krémové karty, které zabírají asi čtvrtinu obrazovky. Ve FS25 je HUD tmavý a poloprůhledný: vpravo dole budík rychlosti s ukazateli nafty a stavu, ikony stavu nářadí (spuštěno, sklopeno, plnění), vlevo dole minimapa. Ceník schovat do menu nebo na přepínač.
- Kabina je skoro celá černá. Chtělo by to palubní desku s budíky, displej terminálu se stavem nářadí a zpětná zrcátka.

### 2. Terén a pole (největší skok v kvalitě)

- Tráva je jedna plochá a hodně sytá zelená bez textury. Míchat textury podle místa (tráva, hlína, štěrk, asfalt) s jemným šumem a v blízkosti kamery přidat instancovaná stébla trávy, která jsou pro FS typická. Barevnou úpravu (`GRADE_SAT` 1,22 v `src/render/core.js`) ubrat směrem k realističtějším tónům.
- Plodiny jsou kvádry na metr čtvereční, takže pole vypadá shora jako koberec s čárkami. Lepší by byly křížené plochy s průhlednou texturou stébel, klasů a listů kukuřice, s náhodnou výškou a rozmazaným okrajem pole. Strniště, oranice a kultivovaná půda by měly mít vlastní texturu s hroudami, ne jen barvu s čárami.
- Silnice by potřebovaly asfaltovou texturu, krajnici, příkopy a vodorovné značení.

### 3. Světlo a materiály

- Scéna nemá mapu okolí (žádné `scene.environment` ani PMREM), takže lak a sklo strojů neodrážejí oblohu a stroje působí matně. Malá změna s velkým efektem.
- Postprocessing: SSAO (stíny v rozích budov a pod stroji), jemný bloom pro majáky a slunce, vzdušný opar do dálky, při západu slunce paprsky světla.
- Budovy jsou hladké šedé kvádry. Přidat textury (vlnitý plech, cihly, beton, dřevo), drobné detaily na dvoře (palety, IBC nádrže, stohy balíků, pneumatiky, ploty) a skvrny na betonu.
- Stromy jsou hranaté koule. Ve FS jsou to stromy s listy z průhledných ploch, které se vlní ve větru.

### 4. Mapa (M) s filtry jako ve FS

Velká mapa je teď plochá. Ve FS se na ní přepíná zobrazení: druh plodiny, fáze růstu, stav půdy (potřebuje orbu, hnojení…) a vlastnictví. Hodně to pomáhá při plánování.

## Hratelnost

### 5. Silo a prodej později (dnes chybí)

Úrodu jde jen hned prodat. Ve FS je hlavní ekonomické rozhodnutí uskladnit ji v silu a prodat, až cena vyskočí. Hodil by se i graf vývoje cen a zakázky na dodávku („20 000 l pšenice do mlýna do 3 dnů za +20 %“).

### 6. Hlubší polní práce s tabulkou výnosu

Dnes výnos ovlivňuje jen hnojivo a orba. FS25 má víc kroků a ke každému poli ukazuje rozpis výnosu:

- **plevel** a postřikovač (postřikovač ve hře úplně chybí),
- **vápnění** jednou za pár sklizní,
- **válení** po zasetí a **kameny** na poli,
- **mulčování** strniště a **osevní postup** (bonus za střídání plodin),
- **druhé hnojení** a **přezrálé plodiny**, které uschnou, když se nesklidí včas,
- **kalendář setí a sklizně** pro každou plodinu.

Každý krok znamená nový stroj do obchodu, další rozhodování a další práci pro pomocníka.

### 7. Uzavřený kruh zvířata ↔ pole

Zvířata by dávala hnůj a kejdu, které se rozvážejí rozmetadlem hnoje nebo cisternou na kejdu jako hnojivo. Zvířata by měla zdraví, rozmnožovala se a převážela by se přívěsem pro dobytek. Mléko, vejce a vlnu by šlo vozit jako palety.

### 8. Siláž (je i v nápadech v README)

Sklízecí řezačka a silážní vůz, který jede vedle ní, siláž do žlabu, udusání traktorem, zakrytí a kvašení, pak krmení krav. Je to jedna z nejzábavnějších týmových prací ve FS. K senu přidat obraceč a shrnovač (sečení → obracení → shrnutí → lisování) a ovíječ balíků.

### 9. Stroje, které se chovají jako ve FS

- **Sklápění nářadí pro přepravu**: široké stroje se na silnici složí. Vyřešilo by to i známé omezení, že Lexion neprojede alejí, a k tomu **vozík na lištu kombajnu**.
- **Plnění osiva a hnojiva** z big bagů a palet místo automatické platby za m². Přibude logistika.
- **Čelní nakladač a teleskopický manipulátor** na balíky, palety a hromady.
- **Sklápění na zem**: hromada zrna nebo hnoje na zemi, kterou nabereš nakladačem.

### 10. Výstavba a postup hrou

- Režim stavby: postavíš si silo, kůlnu, kravín nebo výrobnu kdekoli na svém pozemku.
- **Výrobní řetězce** jako ve FS25: mlýn (obilí → mouka) → pekárna, olejna, pila na vlastní farmě.
- Na začátku volba režimu: nový farmář, správce farmy, nebo začátek od nuly.
- Víc pomocníků najednou, každý za mzdu, a **přepravní úloha** („nalož u sila, vylož ve mlýně“).
- Zakázky se **zapůjčeným strojem** od souseda, aby šly brát i bez vlastního vybavení.
- Počasí s následky: bouřka nebo krupobití, které poškodí úrodu, a sucho.

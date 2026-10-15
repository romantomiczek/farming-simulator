# Zlaté lány

Low-poly farmářská hra v prohlížeči. Herní smyčka je jako ve Farming Simulatoru (sklizeň, prodej, kultivace, setí, růst, nákup polí), vzhled je inspirovaný hrou The Headlands.

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
| Tab | přesednout do druhého stroje |
| F | prodej zrna u sil, výměna nářadí v kůlně, koupě pole u cedule |
| C | změnit osivo |
| T | rychlost času 1× / 5× / 20× |
| Q / E, tažení myší | otočení kamery |
| kolečko | přiblížení |
| Esc | menu, nastavení grafiky, uložení do souboru |

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
2. **Logistika:** přívěs na zrno a odvoz do výkupu.
3. **Polní práce:** orba, hnojení, sláma a balíky, další plodiny.
4. **Ekonomika:** obchod se stroji, palivo a opotřebení, zakázky, úvěr.
5. **Svět:** větší mapa, více výkupů, roční období a počasí.
6. **Pomocníci:** najatí řidiči.

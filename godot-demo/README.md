# Zlaté lány – Godot demo

Malá ukázka, jak by hra vypadala v enginu [Godot](https://godotengine.org): jedno pole pšenice,
kombajn a traktor s kultivátorem. Slouží k porovnání s verzí v prohlížeči (vzhled, plynulost
na starším notebooku). Hlavní hra zůstává ve složce `src/`.

## Spuštění na Windows

1. Stáhni Godot 4.3 pro Windows 64 bit:
   <https://godotengine.org/download/archive/4.3-stable/> (stačí obyčejná verze, ne .NET).
2. Z archivu vybal soubor `Godot_v4.3-stable_win64.exe` do této složky (`godot-demo`).
3. Dvakrát klikni na `spustit-demo.bat`.

Godot se nemusí instalovat. Na noteboocích se dvěma grafikami (Intel + NVIDIA) se sám přepne
na výkonnější kartu NVIDIA.

Chceš-li se podívat i do editoru: spusť `Godot_v4.3-stable_win64.exe` bez parametrů,
zvol **Import**, vyber `project.godot` v této složce a hru pusť klávesou **F5**.

## Ovládání

| Klávesa | Akce |
| --- | --- |
| W A S D / šipky | jízda |
| Mezerník | spustit / zvednout žací lištu nebo kultivátor |
| F | prodat obilí z kombajnu ve žlutém kruhu u sil |
| Tab | přepnout kombajn / traktor |
| Myš (tažení) a kolečko | otáčení a přiblížení kamery |
| R | pole znovu dozraje |
| Q | kvalita grafiky (nízká / střední / vysoká) |
| F11 | celá obrazovka |
| Esc | konec |

Vpravo nahoře je počet snímků za sekundu (FPS), vykreslovacích volání a trojúhelníků.

## Co je v demu

- **Pole 64 × 40 m** rozdělené na buňky 0,5 m. Kombajn se šestimetrovou lištou sklízí,
  za ním zůstává strniště, traktor s kultivátorem (4,2 m) z něj udělá hlínu.
  Pšenice je stylizovaný „koberec“, po kterém běží vlny větru.
- **Stroje** z jednoduchých tvarů: otáčivá a zatáčející kola, kombajn zatáčí zadními koly,
  přiháněč se točí, zrní v zásobníku přibývá, za kombajnem letí plevy, za kultivátorem prach.
- **Krajina**: low-poly kopce, lesy a stromořadí, statek se stodolou, sila s výkupem.
- **Grafika**: vykreslovač Compatibility (OpenGL 3.3) kvůli starší grafické kartě,
  stíny od slunce, mlha, filmové tónování a záře.

Všechno se staví v kódu (`scripts/`), demo proto nepotřebuje žádné importované modely
a jde spustit rovnou ze složky.

## Soubory

- `scripts/main.gd` – ovládání, sklizeň, kultivace, prodej, kolize, kvalita grafiky
- `scripts/field.gd` – stav pole (buňky) a jeho vykreslení
- `scripts/vehicle.gd` – jízda a animace strojů
- `scripts/models.gd` – modely traktoru, kultivátoru a kombajnu
- `scripts/world.gd` – obloha, světlo, terén, statek, stromy
- `scripts/hud.gd`, `scripts/follow_camera.gd` – panely na obrazovce a kamera
- `shaders/` – shadery pole (půda a pšenice)
- `scripts/autotest.gd` – automatický test (spouští se jen s parametrem `-- --autotest=<složka>`)

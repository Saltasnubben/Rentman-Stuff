# Rentman Booking Visualizer

En webapp som visar en översikt av crew-bokningar från Rentman. Välj crewmedlemmar och tidsperiod (1-14 dagar) för att se deras bokade projekt i en tydlig timeline-vy.

## Funktioner

- **Crew-väljare** - Sök och välj en eller flera crewmedlemmar
- **Flexibel tidsperiod** - Välj mellan 1 dag och 2 veckor
- **Snabbval** - Knappar för Idag, 3 dagar, 1 vecka och 2 veckor
- **Visuell timeline** - Se alla bokningar på en tydlig tidslinje
- **Hover-tooltips** - Se detaljer om varje bokning
- **Statistik** - Antal bokningar, projekt och dagar
- **Caching** - Inbyggd cache för snabbare svarstider

## Teknikstack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** PHP 7.4+ (kompatibelt med one.com och andra webbhotell)
- **API:** Rentman Public API

---

## Deployment på one.com

### Förutsättningar

- one.com webbhotell med PHP 7.4+
- Rentman-konto med API-access
- FTP-klient (t.ex. FileZilla) eller one.com File Manager
- Node.js (lokalt för att bygga frontend)

### Steg 1: Hämta API-token från Rentman

1. Logga in på [Rentman](https://rentman.io)
2. Gå till **Configuration > Account > Integrations**
3. Klicka på **Connect** vid "API"
4. Klicka på **Show token** och kopiera den

### Steg 2: Bygg frontend lokalt

```bash
# Klona/ladda ner repot
git clone https://github.com/your-username/rentman-booking-visualizer.git
cd rentman-booking-visualizer

# Installera frontend-beroenden
cd frontend
npm install

# Bygg för produktion
npm run build

# Byggda filer hamnar i ../public/
cd ..
```

### Steg 3: Konfigurera API-token

```bash
# Kopiera config-mall
cp api/config.example.php api/config.php
```

Öppna `api/config.php` och fyll i din token:

```php
return [
    'rentman_api_token' => 'DIN_RENTMAN_API_TOKEN_HÄR',
    'rentman_api_url' => 'https://api.rentman.net',
    'allowed_origins' => '*',  // Eller din domän: 'https://dindomän.se'
    'debug' => false,
    'cache_ttl' => 300,  // 5 minuters cache
];
```

### Steg 4: Ladda upp till one.com

Ladda upp följande till din **webroot** (vanligtvis `/www/` eller `/public_html/`):

```
webroot/
├── .htaccess          # URL-routing och säkerhet
├── index.html         # React-app (från public/)
├── assets/            # JS/CSS (från public/)
└── api/
    ├── .htaccess      # API-routing
    ├── index.php      # API entry point
    ├── config.php     # Din konfiguration (LADDA INTE UPP config.example.php)
    ├── classes/
    │   ├── RentmanClient.php
    │   └── ApiResponse.php
    └── endpoints/
        ├── crew.php
        ├── projects.php
        └── bookings.php
```

**Via FileZilla:**
1. Anslut till one.com med FTP-uppgifter (finns i one.com kontrollpanel)
2. Navigera till webroot
3. Ladda upp filerna enligt strukturen ovan

**Via one.com File Manager:**
1. Logga in på one.com kontrollpanel
2. Gå till **Files & Security > File Manager**
3. Ladda upp filerna

### Steg 5: Testa

Öppna din domän i webbläsaren. Kontrollera att API:et fungerar:

```
https://dindomän.se/api/health
```

Du bör se:
```json
{
  "status": "ok",
  "hasApiToken": true,
  "version": "1.0.0"
}
```

---

## Lokal utveckling

### Med PHP:s inbyggda server

```bash
# Starta PHP-server för API
cd api
php -S localhost:8080

# I en annan terminal, starta frontend
cd frontend
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173)

### Alternativ: Med Docker

```bash
docker-compose up
```

---

## Projektstruktur

```
rentman-booking-visualizer/
├── api/                          # PHP Backend
│   ├── index.php                 # Entry point & routing
│   ├── config.example.php        # Konfigurationsmall
│   ├── .htaccess                 # URL-omskrivning
│   ├── classes/
│   │   ├── RentmanClient.php     # Rentman API-klient
│   │   └── ApiResponse.php       # JSON-svar helper
│   └── endpoints/
│       ├── crew.php              # GET /api/crew
│       ├── projects.php          # GET /api/projects
│       └── bookings.php          # GET /api/bookings
├── frontend/                     # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── CrewSelector.jsx
│   │   │   ├── DateRangePicker.jsx
│   │   │   ├── Timeline.jsx
│   │   │   └── StatusBar.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   └── App.jsx
│   ├── vite.config.js
│   └── package.json
├── public/                       # Byggd frontend (genereras)
├── .htaccess                     # Root routing för one.com
└── README.md
```

---

## API-endpoints

| Metod | Endpoint | Beskrivning |
|-------|----------|-------------|
| GET | `/api/health` | Hälsokontroll |
| GET | `/api/crew` | Lista alla crewmedlemmar |
| GET | `/api/crew/:id` | Hämta en crewmedlem |
| GET | `/api/crew/:id/availability` | Hämta tillgänglighet |
| GET | `/api/projects` | Lista projekt (med datumfilter) |
| GET | `/api/bookings` | Hämta bokningar för valda crew och period |
| DELETE | `/api/cache` | Rensa cache |

### Query-parametrar

**GET /api/bookings**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| crewIds | string | Kommaseparerade crew-ID:n |
| startDate | string | Startdatum (YYYY-MM-DD) |
| endDate | string | Slutdatum (YYYY-MM-DD) |

**GET /api/projects**
| Parameter | Typ | Beskrivning |
|-----------|-----|-------------|
| startDate | string | Filtrera från datum |
| endDate | string | Filtrera till datum |
| status | string | Filtrera på status |

### Exempel

```bash
# Hämta alla crewmedlemmar
curl https://dindomän.se/api/crew

# Hämta bokningar för crew 1, 2, 3 under en vecka
curl "https://dindomän.se/api/bookings?crewIds=1,2,3&startDate=2024-01-15&endDate=2024-01-22"

# Rensa cache
curl -X DELETE https://dindomän.se/api/cache
```

---

## Felsökning

### "Server configuration missing"
- Kopiera `api/config.example.php` till `api/config.php`
- Fyll i din Rentman API-token

### "hasApiToken: false"
- Kontrollera att token är korrekt ifylld i `config.php`
- Token ska INTE innehålla `YOUR_API_TOKEN_HERE`

### CORS-fel
- Kontrollera att `allowed_origins` i config.php matchar din domän
- Eller sätt till `'*'` för att tillåta alla

### 500 Internal Server Error
- Aktivera debug-läge: `'debug' => true` i config.php
- Kontrollera PHP-felloggar på one.com

### Långsamma svar
- Kontrollera att cache är aktiverad (`cache_ttl` > 0)
- Rensa cache om data verkar inaktuell: `GET /api/cache?clear`

---

## Säkerhet

- **API-token** skyddas av `.htaccess` och exponeras aldrig till frontend
- **config.php** nekas åtkomst via webbläsaren
- **Cache-mappen** är skyddad mot direkt åtkomst
- Använd HTTPS (one.com erbjuder gratis SSL)

---

## Senaste uppdateringar (2026-02-04)

### Nya funktioner

- ✅ **Klickbara bokningar** - Klicka på en bokning för att se detaljerad info (kund, plats, account manager, projektnummer)
- ✅ **Statusfilter** - Filtrera bokningar efter projektstatus (Bekräftad, Optie, etc)
- ✅ **Konfliktindikator** - Varning visas när crewmedlemmar har överlappande bokningar
- ✅ **Förbättrade tooltips** - Visar nu kund och plats direkt i tooltip
- ✅ **Tangentbordsgenvägar** - Snabbnavigering med piltangenter, T för idag, R för uppdatera, 1-4 för presets
- ✅ **Mer projektdata från API** - Hämtar nu kund, plats och account manager från Rentman

### Tangentbordsgenvägar

| Tangent | Funktion |
|---------|----------|
| ← / → | Navigera dagar |
| ⇧ + ← / → | Navigera veckor |
| T | Hoppa till idag |
| R | Uppdatera data |
| 1 | Visa 1 dag |
| 2 | Visa 3 dagar |
| 3 | Visa 1 vecka |
| 4 | Visa 2 veckor |
| Esc | Stäng dialog |

## Vidareutveckling

Några idéer:

- [ ] Exportera till PDF/Excel
- [ ] Webhook-integration för realtidsuppdateringar
- [ ] Subproject-stöd (olika platser per subprojekt)
- [ ] Tidrapportering

---

## Länkar

- [Rentman](https://rentman.io)
- [Rentman API-dokumentation](https://api.rentman.net/)
- [one.com Support](https://help.one.com/)

# CLAUDE.md

## Project Overview

Rentman Booking Visualizer - A webapp that displays an overview of crew bookings from Rentman. Users can select crew members and a time period (1-14 days) to see their booked projects in a visual timeline view.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** PHP 7.4+ (compatible with one.com and other web hosts)
- **API Integration:** Rentman Public API
- **HTTP Client:** Axios
- **Date Handling:** date-fns
- **UI Components:** react-select for crew selection

## Project Structure

```
rentman-booking-visualizer/
├── api/                      # PHP Backend
│   ├── index.php             # API entry point & routing
│   ├── router.php            # Local dev router
│   ├── config.example.php    # Configuration template
│   ├── classes/
│   │   ├── RentmanClient.php # Rentman API client with caching
│   │   └── ApiResponse.php   # JSON response helper
│   └── endpoints/
│       ├── crew.php          # GET /api/crew endpoints
│       ├── projects.php      # GET /api/projects endpoint
│       └── bookings.php      # GET /api/bookings endpoint
├── frontend/                 # React Frontend
│   ├── src/
│   │   ├── App.jsx           # Main application component
│   │   ├── main.jsx          # Entry point
│   │   ├── index.css         # Tailwind imports
│   │   ├── components/       # React components
│   │   ├── contexts/         # React contexts
│   │   └── services/         # API service layer
│   ├── vite.config.js        # Vite configuration
│   └── tailwind.config.js    # Tailwind configuration
├── public/                   # Built frontend output (generated)
├── package.json              # Root package with dev scripts
└── README.md                 # Full documentation
```

## Development Commands

```bash
# Install dependencies
npm install                    # Root dependencies (concurrently)
npm run install:frontend       # Frontend dependencies

# Development (runs both API and frontend)
npm run dev                    # Starts PHP server (8080) + Vite dev (5173)

# Individual servers
npm run dev:api                # PHP server only at localhost:8080
npm run dev:frontend           # Vite dev server at localhost:5173

# Build
npm run build                  # Build frontend to public/
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (returns status, hasApiToken, version) |
| GET | `/api/crew` | List all crew members |
| GET | `/api/crew/:id` | Get single crew member |
| GET | `/api/crew/:id/availability` | Get crew availability |
| GET | `/api/projects` | List projects (supports startDate, endDate, status params) |
| GET | `/api/bookings` | Get bookings (requires crewIds, startDate, endDate params) |
| DELETE | `/api/cache` | Clear API cache |

## Configuration

API configuration is stored in `api/config.php` (copy from `config.example.php`):

```php
return [
    'rentman_api_token' => 'YOUR_TOKEN',
    'rentman_api_url' => 'https://api.rentman.net',
    'allowed_origins' => '*',
    'debug' => false,
    'cache_ttl' => 300,
];
```

**Note:** Never commit `api/config.php` - it contains secrets.

## Key Implementation Details

- **Caching:** RentmanClient.php implements file-based caching with configurable TTL
- **CORS:** Handled in api/index.php, configurable via allowed_origins
- **Proxy:** Vite dev server proxies /api requests to PHP backend (see vite.config.js)
- **Timeline:** Main visualization component renders crew bookings on a day-based grid

## Language

The application UI and documentation are in Swedish. Code comments may be in Swedish.

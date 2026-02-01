<?php
/**
 * Rentman Booking Visualizer - API Entry Point
 *
 * Hanterar alla API-anrop och routar till rätt endpoint
 */

// Öka tidsgräns för långa API-anrop
set_time_limit(120);

// Felhantering
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Ladda konfiguration
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration missing. Copy config.example.php to config.php']);
    exit;
}

$config = require $configFile;

// Autoload klasser
spl_autoload_register(function ($class) {
    $file = __DIR__ . '/classes/' . $class . '.php';
    if (file_exists($file)) {
        require_once $file;
    }
});

// Initiera API-svar helper
$response = new ApiResponse($config['allowed_origins'] ?? '*');
$response->handlePreflight();

// Initiera Rentman-klient
$rentman = new RentmanClient(
    $config['rentman_api_url'] ?? 'https://api.rentman.net',
    $config['rentman_api_token'],
    $config['cache_ttl'] ?? 300
);

// Parsa request path
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$basePath = dirname($_SERVER['SCRIPT_NAME']);
$path = str_replace($basePath, '', parse_url($requestUri, PHP_URL_PATH));
$path = trim($path, '/');
$pathParts = explode('/', $path);

// Ta bort 'api' prefix om det finns (för /api/crew etc.)
if ($pathParts[0] === 'api') {
    array_shift($pathParts);
}

$endpoint = $pathParts[0] ?? '';
$id = $pathParts[1] ?? null;
$subEndpoint = $pathParts[2] ?? null;

// Debug-läge
if ($config['debug'] ?? false) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// Routing
try {
    switch ($endpoint) {
        case '':
        case 'health':
            $response->json([
                'status' => 'ok',
                'timestamp' => date('c'),
                'hasApiToken' => !empty($config['rentman_api_token']) && $config['rentman_api_token'] !== 'YOUR_API_TOKEN_HERE',
                'version' => '1.0.0',
                'php_version' => PHP_VERSION,
            ]);
            break;

        case 'crew':
            require __DIR__ . '/endpoints/crew.php';
            handleCrewEndpoint($rentman, $response, $id, $subEndpoint);
            break;

        case 'projects':
            require __DIR__ . '/endpoints/projects.php';
            handleProjectsEndpoint($rentman, $response, $id);
            break;

        case 'bookings':
            require __DIR__ . '/endpoints/bookings.php';
            handleBookingsEndpoint($rentman, $response);
            break;

        case 'vehicles':
            require __DIR__ . '/endpoints/vehicles.php';
            handleVehiclesEndpoint($rentman, $response, $subEndpoint);
            break;

        case 'cache':
            if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || isset($_GET['clear'])) {
                $rentman->clearCache();
                $response->json(['message' => 'Cache cleared']);
            } else {
                $response->badRequest('Use DELETE or ?clear to clear cache');
            }
            break;

        case 'warmup':
            require __DIR__ . '/endpoints/warmup.php';
            handleWarmupEndpoint($rentman, $response);
            break;

        case 'unfilled':
            require __DIR__ . '/endpoints/unfilled.php';
            handleUnfilledEndpoint($rentman, $response);
            break;

        case 'debug':
            require __DIR__ . '/endpoints/debug.php';
            handleDebugEndpoint($rentman, $response);
            break;

        default:
            $response->notFound("Unknown endpoint: $endpoint");
    }
} catch (Exception $e) {
    $statusCode = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    $response->error(
        $e->getMessage(),
        $statusCode,
        ($config['debug'] ?? false) ? $e->getTraceAsString() : null
    );
}

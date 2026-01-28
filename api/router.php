<?php
/**
 * Development Router
 *
 * Används med PHP:s inbyggda server för lokal utveckling.
 * Kör: php -S localhost:8080 api/router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Ta bort /api prefix om det finns (för Vite proxy)
if (strpos($uri, '/api') === 0) {
    $uri = substr($uri, 4) ?: '/';
    $_SERVER['REQUEST_URI'] = $uri . (isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING'] ? '?' . $_SERVER['QUERY_STRING'] : '');
}

// Servera statiska filer om de finns
$filePath = __DIR__ . $uri;
if ($uri !== '/' && file_exists($filePath) && is_file($filePath)) {
    return false;
}

// Annars, skicka allt till index.php
require __DIR__ . '/index.php';

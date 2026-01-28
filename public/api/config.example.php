<?php
/**
 * Rentman Booking Visualizer - Konfiguration
 *
 * VIKTIGT: Kopiera denna fil till config.php och fyll i din API-token
 * Ladda ALDRIG upp config.php till Git!
 */

return [
    // Din Rentman API-token
    // Hämta från: Rentman > Configuration > Account > Integrations > API
    'rentman_api_token' => 'YOUR_API_TOKEN_HERE',

    // Rentman API bas-URL
    'rentman_api_url' => 'https://api.rentman.net',

    // Tillåtna origins för CORS (kommaseparerade)
    // I produktion: din domän, t.ex. 'https://dindomän.se'
    // Under utveckling: 'http://localhost:5173'
    'allowed_origins' => '*',

    // Debug-läge (sätt till false i produktion)
    'debug' => false,

    // Cache-tid i sekunder (0 = ingen cache)
    'cache_ttl' => 300,
];

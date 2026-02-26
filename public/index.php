<?php
/**
 * Rentman Booking Visualizer - Entry Point
 * Auth wrapper: checks session before serving the React app.
 */
session_start();

// Load config
$configFile = __DIR__ . '/api/config.php';
$config = file_exists($configFile) ? require $configFile : [];

$appPassword = $config['app_password'] ?? null;

// Handle logout
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: /login.php');
    exit;
}

// If password protection is enabled, check session
if ($appPassword && empty($_SESSION['rentman_auth'])) {
    header('Location: /login.php');
    exit;
}

// Serve the React app
// index.html is the built React app (by Vite); index.php wraps it with auth
$appHtml = __DIR__ . '/index.html';
if (file_exists($appHtml)) {
    readfile($appHtml);
} else {
    echo '<!DOCTYPE html><html><head><title>Error</title></head><body>';
    echo '<p>index.html not found. Run: npm run build</p>';
    echo '</body></html>';
}

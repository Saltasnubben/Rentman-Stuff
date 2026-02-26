<?php
/**
 * Rentman Booking Visualizer - Login
 */
session_start();

// Load config
$configFile = __DIR__ . '/api/config.php';
$config = file_exists($configFile) ? require $configFile : [];

$appPassword = $config['app_password'] ?? null;

// If no password configured, skip auth
if (!$appPassword) {
    header('Location: /');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $submitted = $_POST['password'] ?? '';
    if (hash_equals($appPassword, $submitted)) {
        $_SESSION['rentman_auth'] = true;
        $_SESSION['rentman_auth_time'] = time();
        $redirect = $_GET['redirect'] ?? '/';
        header('Location: ' . $redirect);
        exit;
    } else {
        $error = 'Fel lösenord, försök igen.';
        // Small delay to slow brute force
        sleep(1);
    }
}
?>
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Logga in – Rentman Booking Visualizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    }

    .logo {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo-icon {
      width: 56px;
      height: 56px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      margin-bottom: 0.75rem;
    }

    .logo h1 {
      font-size: 1.1rem;
      font-weight: 600;
      color: #f1f5f9;
      letter-spacing: -0.02em;
    }

    .logo p {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 0.25rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 0.4rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    input[type="password"] {
      width: 100%;
      padding: 0.65rem 0.9rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 1rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }

    input[type="password"]:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      border-radius: 8px;
      padding: 0.6rem 0.9rem;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    button {
      width: 100%;
      padding: 0.7rem;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      letter-spacing: 0.01em;
    }

    button:hover { opacity: 0.9; }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">📅</div>
      <h1>Rentman Booking Visualizer</h1>
      <p>Logga in för att fortsätta</p>
    </div>

    <?php if ($error): ?>
    <div class="error">
      <span>⚠️</span>
      <span><?= htmlspecialchars($error) ?></span>
    </div>
    <?php endif; ?>

    <form method="POST">
      <div class="form-group">
        <label for="password">Lösenord</label>
        <input
          type="password"
          id="password"
          name="password"
          placeholder="••••••••"
          autofocus
          autocomplete="current-password"
        />
      </div>
      <button type="submit">Logga in →</button>
    </form>
  </div>
</body>
</html>

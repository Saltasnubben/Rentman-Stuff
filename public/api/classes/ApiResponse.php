<?php
/**
 * API Response Helper
 *
 * Hanterar JSON-svar och CORS-headers
 */

class ApiResponse
{
    private string $allowedOrigins;

    public function __construct(string $allowedOrigins = '*')
    {
        $this->allowedOrigins = $allowedOrigins;
    }

    /**
     * Sätter CORS-headers
     */
    public function setCorsHeaders(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';

        if ($this->allowedOrigins === '*') {
            header('Access-Control-Allow-Origin: *');
        } elseif (in_array($origin, explode(',', $this->allowedOrigins))) {
            header("Access-Control-Allow-Origin: $origin");
        }

        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Max-Age: 86400');
    }

    /**
     * Hanterar OPTIONS preflight request
     */
    public function handlePreflight(): void
    {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            $this->setCorsHeaders();
            http_response_code(204);
            exit;
        }
    }

    /**
     * Skickar JSON-svar
     */
    public function json(array $data, int $statusCode = 200): void
    {
        $this->setCorsHeaders();
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($statusCode);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * Skickar felmeddelande
     */
    public function error(string $message, int $statusCode = 500, ?string $details = null): void
    {
        $data = ['error' => $message];

        if ($details !== null) {
            $data['details'] = $details;
        }

        $this->json($data, $statusCode);
    }

    /**
     * Skickar 404 Not Found
     */
    public function notFound(string $message = 'Resource not found'): void
    {
        $this->error($message, 404);
    }

    /**
     * Skickar 400 Bad Request
     */
    public function badRequest(string $message): void
    {
        $this->error($message, 400);
    }
}

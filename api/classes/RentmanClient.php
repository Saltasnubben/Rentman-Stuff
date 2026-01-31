<?php
/**
 * Rentman API Client
 *
 * Hanterar all kommunikation med Rentman API
 */

class RentmanClient
{
    private string $apiUrl;
    private string $apiToken;
    private int $cacheTtl;
    private string $cacheDir;

    public function __construct(string $apiUrl, string $apiToken, int $cacheTtl = 300)
    {
        $this->apiUrl = rtrim($apiUrl, '/');
        $this->apiToken = $apiToken;
        $this->cacheTtl = $cacheTtl;
        $this->cacheDir = __DIR__ . '/../cache';

        // Skapa cache-mapp om den inte finns
        if ($cacheTtl > 0 && !is_dir($this->cacheDir)) {
            mkdir($this->cacheDir, 0755, true);
        }
    }

    /**
     * Gör ett GET-anrop till Rentman API
     */
    public function get(string $endpoint, array $params = []): array
    {
        $url = $this->apiUrl . $endpoint;

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        // Kolla cache först
        $cacheKey = $this->getCacheKey($url);
        $cached = $this->getFromCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        // Gör API-anrop
        $response = $this->makeRequest($url);

        // Spara i cache
        $this->saveToCache($cacheKey, $response);

        return $response;
    }

    /**
     * Hämtar alla sidor från ett paginerat endpoint
     */
    public function fetchAllPages(string $endpoint, array $params = [], int $limit = 25): array
    {
        $allData = [];
        $offset = 0;

        do {
            $params['limit'] = $limit;
            $params['offset'] = $offset;

            $response = $this->get($endpoint, $params);
            $data = $response['data'] ?? [];

            $allData = array_merge($allData, $data);
            $offset += $limit;

            // Fortsätt om vi fick exakt limit antal resultat
            $hasMore = count($data) === $limit;
        } while ($hasMore);

        return $allData;
    }

    /**
     * Utför HTTP-anrop med cURL
     */
    private function makeRequest(string $url): array
    {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiToken,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        $requestUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);

        if ($error) {
            throw new Exception("cURL error: $error");
        }

        if ($httpCode >= 400) {
            $errorData = json_decode($response, true);
            // Rentman kan returnera fel i olika format
            $message = $errorData['message']
                ?? $errorData['error']
                ?? $errorData['detail']
                ?? $response  // Visa råa svaret om inget annat
                ?? "HTTP error $httpCode";
            throw new Exception("Rentman API error ($httpCode) on $requestUrl: $message", $httpCode);
        }

        $data = json_decode($response, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON response from Rentman API");
        }

        return $data;
    }

    /**
     * Genererar en cache-nyckel baserat på URL
     */
    private function getCacheKey(string $url): string
    {
        return md5($url);
    }

    /**
     * Hämtar data från cache
     */
    private function getFromCache(string $key): ?array
    {
        if ($this->cacheTtl <= 0) {
            return null;
        }

        $cacheFile = $this->cacheDir . '/' . $key . '.json';

        if (!file_exists($cacheFile)) {
            return null;
        }

        $mtime = filemtime($cacheFile);
        if (time() - $mtime > $this->cacheTtl) {
            unlink($cacheFile);
            return null;
        }

        $content = file_get_contents($cacheFile);
        return json_decode($content, true);
    }

    /**
     * Sparar data i cache
     */
    private function saveToCache(string $key, array $data): void
    {
        if ($this->cacheTtl <= 0) {
            return;
        }

        $cacheFile = $this->cacheDir . '/' . $key . '.json';
        file_put_contents($cacheFile, json_encode($data));
    }

    /**
     * Hämtar alla sidor med namngivd cache-nyckel (aggregerad cache)
     * Istället för en fil per URL sparas hela resultatet under en enda nyckel.
     */
    public function fetchAllPagesCached(string $endpoint, array $params = [], int $limit = 25, string $cacheKey = null): array
    {
        $cacheKey = $cacheKey ?? $this->getCacheKey($endpoint . json_encode($params));

        // Kolla aggregerad cache
        $cached = $this->getFromCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        // Hämta all data
        $allData = $this->fetchAllPages($endpoint, $params, $limit);

        // Spara aggregerat
        $this->saveToCache($cacheKey, $allData);

        return $allData;
    }

    /**
     * Rensar all cache
     */
    public function clearCache(): void
    {
        $files = glob($this->cacheDir . '/*.json');
        foreach ($files as $file) {
            unlink($file);
        }
    }
}

<?php
/**
 * Cache Warmup Endpoint
 * 
 * GET /api/warmup - Värmer cachen för mevida-teamet
 * 
 * Query params:
 * - days: Antal dagar framåt att cacha (default: 60)
 * - tag: Vilken tag att värma (default: mevida)
 * - key: Enkel API-nyckel för att skydda endpoint (valfri)
 */

function handleWarmupEndpoint(RentmanClient $rentman, ApiResponse $response): void
{
    $t0 = microtime(true);
    
    // Enkel skyddsnyckel (kan sättas i config senare)
    $expectedKey = $_GET['key'] ?? '';
    $configKey = defined('WARMUP_KEY') ? WARMUP_KEY : '';
    
    // Om nyckel är konfigurerad, kräv den
    if (!empty($configKey) && $expectedKey !== $configKey) {
        $response->json(['error' => 'Invalid key'], 403);
        return;
    }
    
    $tag = $_GET['tag'] ?? 'mevida';
    $days = (int)($_GET['days'] ?? 60);
    $days = max(7, min(180, $days)); // Begränsa till 7-180 dagar
    
    $startDate = date('Y-m-d');
    $endDate = date('Y-m-d', strtotime("+{$days} days"));
    
    $stats = [
        'tag' => $tag,
        'period' => ['start' => $startDate, 'end' => $endDate],
        'crew_found' => 0,
        'assignments_cached' => 0,
        'functions_cached' => 0,
        'projects_cached' => 0,
        'errors' => [],
    ];
    
    // Steg 1: Hämta alla crew med taggen
    try {
        $allCrew = $rentman->fetchAllPages('/crew', [], 100);
        $targetCrew = array_filter($allCrew, function($c) use ($tag) {
            $tags = $c['tags'] ?? [];
            return in_array($tag, $tags);
        });
        $stats['crew_found'] = count($targetCrew);
    } catch (Exception $e) {
        $stats['errors'][] = "Failed to fetch crew: " . $e->getMessage();
        $response->json([
            'success' => false,
            'stats' => $stats,
            'time_seconds' => microtime(true) - $t0,
        ]);
        return;
    }
    
    // Steg 2: Hämta assignments för varje crew-medlem
    $allFunctionIds = [];
    
    foreach ($targetCrew as $crew) {
        $crewId = $crew['id'];
        try {
            $assignments = $rentman->fetchAllPages("/projectcrew", [
                'crewmember' => "/crew/$crewId"
            ], 100);
            
            foreach ($assignments as $assignment) {
                $assignmentStart = $assignment['planperiod_start'] ?? null;
                $assignmentEnd = $assignment['planperiod_end'] ?? null;
                
                if (!$assignmentStart || !$assignmentEnd) continue;
                
                $assignmentStartDate = substr($assignmentStart, 0, 10);
                $assignmentEndDate = substr($assignmentEnd, 0, 10);
                
                // Filtrera på datumintervall
                if ($assignmentEndDate < $startDate) continue;
                if ($assignmentStartDate > $endDate) continue;
                
                $stats['assignments_cached']++;
                
                // Samla function IDs
                $functionRef = $assignment['function'] ?? null;
                if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
                    $allFunctionIds[$matches[1]] = true;
                }
            }
        } catch (Exception $e) {
            $stats['errors'][] = "Crew $crewId: " . $e->getMessage();
        }
    }
    
    // Steg 3: Hämta alla funktioner (detta cachar dem)
    $allProjectIds = [];
    
    foreach (array_keys($allFunctionIds) as $funcId) {
        try {
            $funcData = $rentman->get("/projectfunctions/$funcId");
            $func = $funcData['data'] ?? $funcData;
            $stats['functions_cached']++;
            
            $projectRef = $func['project'] ?? null;
            if ($projectRef && preg_match('/\/projects\/(\d+)/', $projectRef, $matches)) {
                $allProjectIds[$matches[1]] = true;
            }
        } catch (Exception $e) {
            $stats['errors'][] = "Function $funcId: " . $e->getMessage();
        }
    }
    
    // Steg 4: Hämta alla projekt (detta cachar dem)
    foreach (array_keys($allProjectIds) as $projectId) {
        try {
            $rentman->get("/projects/$projectId");
            $stats['projects_cached']++;
        } catch (Exception $e) {
            $stats['errors'][] = "Project $projectId: " . $e->getMessage();
        }
    }
    
    $totalTime = microtime(true) - $t0;
    
    $response->json([
        'success' => count($stats['errors']) === 0,
        'message' => "Cache warmup complete for tag '$tag'",
        'stats' => $stats,
        'time_seconds' => round($totalTime, 2),
    ]);
}

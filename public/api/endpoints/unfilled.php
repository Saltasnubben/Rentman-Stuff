<?php
/**
 * Unfilled Functions Endpoint - OPTIMIZED v4
 * 
 * Strategi för maximal prestanda:
 * 1. Hämta subprojects (cachad), filtrera på datum + status -> få relevanta projekt-IDs
 * 2. För varje relevant projekt: hämta funktioner OCH crew i samma loop
 * 3. Skippa bulk-fetch av projectcrew (det var flaskhalsen!)
 */

function handleUnfilledEndpoint(RentmanClient $rentman, ApiResponse $response): void
{
    $debug = ($_GET['debug'] ?? '') === '1';
    $t0 = microtime(true);
    $timings = [];

    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $statusFilter = $_GET['status'] ?? '3';

    if (empty($startDate) || empty($endDate)) {
        $response->badRequest('startDate and endDate are required');
        return;
    }

    $allowedStatuses = $statusFilter === 'all' ? null : array_map('intval', explode(',', $statusFilter));

    // STEG 1: Hämta subprojects och filtrera - detta ger oss relevanta projekt
    $relevantProjectIds = [];
    $projectStatusMap = [];
    
    try {
        $allSubprojects = $rentman->fetchAllPages('/subprojects', [], 300);
        
        foreach ($allSubprojects as $sp) {
            $spStart = $sp['planperiod_start'] ?? null;
            $spEnd = $sp['planperiod_end'] ?? null;
            
            if (!$spStart || !$spEnd) continue;
            if (substr($spEnd, 0, 10) < $startDate) continue;
            if (substr($spStart, 0, 10) > $endDate) continue;
            
            $projectRef = $sp['project'] ?? null;
            if (!$projectRef || !preg_match('/\/projects\/(\d+)/', $projectRef, $matches)) continue;
            $projId = (int)$matches[1];
            
            $statusRef = $sp['status'] ?? null;
            $statusId = null;
            if ($statusRef && preg_match('/\/statuses\/(\d+)/', $statusRef, $matches)) {
                $statusId = (int)$matches[1];
            }
            
            if (!isset($projectStatusMap[$projId]) || $statusId === 3) {
                $projectStatusMap[$projId] = $statusId;
            }
            
            if ($allowedStatuses !== null && ($statusId === null || !in_array($statusId, $allowedStatuses))) {
                continue;
            }
            
            $relevantProjectIds[$projId] = true;
        }
        
        $timings['subprojects_total'] = count($allSubprojects);
        $timings['relevant_projects'] = count($relevantProjectIds);
    } catch (Exception $e) {
        error_log("Failed to fetch subprojects: " . $e->getMessage());
    }

    $timings['step1_done'] = microtime(true) - $t0;

    if (empty($relevantProjectIds)) {
        $response->json([
            'data' => [],
            'count' => 0,
            'period' => ['startDate' => $startDate, 'endDate' => $endDate],
            'statusFilter' => $statusFilter,
        ]);
        return;
    }

    // STEG 2: Hämta projekt-info
    $projectMap = [];
    try {
        $allProjects = $rentman->fetchAllPages('/projects', [], 300);
        foreach ($allProjects as $p) {
            if (isset($relevantProjectIds[$p['id']])) {
                $projectMap[$p['id']] = [
                    'name' => $p['displayname'] ?? $p['name'] ?? 'Unnamed',
                    'color' => $p['color'] ?? null,
                ];
            }
        }
    } catch (Exception $e) {
        error_log("Failed to fetch projects: " . $e->getMessage());
    }

    $timings['step2_done'] = microtime(true) - $t0;

    // STEG 3: För varje projekt - hämta funktioner OCH kolla crew
    $unfilledFunctions = [];
    $statusNames = [1 => 'Pending', 2 => 'Canceled', 3 => 'Confirmed', 4 => 'Prepped', 5 => 'On location', 6 => 'Returned', 7 => 'Inquiry', 8 => 'Concept'];
    $functionsChecked = 0;
    $apiCallsForFunctions = 0;

    foreach (array_keys($relevantProjectIds) as $projectId) {
        $apiCallsForFunctions++;
        
        try {
            // Hämta funktioner för detta projekt
            $functions = $rentman->fetchAllPages("/projects/$projectId/projectfunctions", [], 300);
            
            // Hämta crew för detta projekt (för att veta vilka funktioner har tilldelad crew)
            $projectCrew = $rentman->fetchAllPages("/projects/$projectId/projectcrew", [], 300);
            $apiCallsForFunctions++;
            
            // Bygg set av funktions-IDs som har crew
            $functionsWithCrew = [];
            foreach ($projectCrew as $pc) {
                $funcRef = $pc['function'] ?? null;
                if ($funcRef && preg_match('/\/projectfunctions\/(\d+)/', $funcRef, $matches)) {
                    $functionsWithCrew[(int)$matches[1]] = true;
                }
            }
            
            foreach ($functions as $func) {
                $functionsChecked++;
                $funcId = $func['id'];
                
                // Skippa om har crew
                if (isset($functionsWithCrew[$funcId])) continue;
                
                // Kolla datum
                $funcStart = $func['planperiod_start'] ?? null;
                $funcEnd = $func['planperiod_end'] ?? null;
                
                if (!$funcStart || !$funcEnd) continue;
                if (substr($funcEnd, 0, 10) < $startDate) continue;
                if (substr($funcStart, 0, 10) > $endDate) continue;
                
                $statusId = $projectStatusMap[$projectId] ?? null;
                $projectInfo = $projectMap[$projectId] ?? ['name' => 'Projekt #' . $projectId, 'color' => null];
                
                $roleName = $func['name'] ?? $func['displayname'] ?? 'Okänd roll';
                $isTransport = stripos($roleName, 'transport') !== false;
                
                $unfilledFunctions[] = [
                    'id' => 'unfilled_' . $funcId,
                    'type' => 'unfilled',
                    'subtype' => $isTransport ? 'transport' : 'crew',
                    'functionId' => $funcId,
                    'projectId' => $projectId,
                    'projectName' => $projectInfo['name'],
                    'projectColor' => $projectInfo['color'],
                    'color' => $projectInfo['color'],
                    'statusId' => $statusId,
                    'statusName' => $statusNames[$statusId] ?? null,
                    'role' => $roleName,
                    'start' => $funcStart,
                    'end' => $funcEnd,
                    'crewId' => null,
                    'remark' => $func['remark_planner'] ?? null,
                    'quantity' => $func['amount'] ?? 1,
                    'isTransport' => $isTransport,
                ];
            }
        } catch (Exception $e) {
            error_log("Failed to fetch data for project $projectId: " . $e->getMessage());
        }
    }

    $timings['functions_checked'] = $functionsChecked;
    $timings['api_calls_step3'] = $apiCallsForFunctions;
    $timings['step3_done'] = microtime(true) - $t0;

    usort($unfilledFunctions, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $timings['total'] = microtime(true) - $t0;

    $result = [
        'data' => $unfilledFunctions,
        'count' => count($unfilledFunctions),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
        'statusFilter' => $statusFilter === 'all' ? 'all' : array_map(fn($s) => $statusNames[(int)$s] ?? $s, explode(',', $statusFilter)),
    ];

    if ($debug) {
        $result['_debug'] = ['timings_seconds' => $timings];
    }

    $response->json($result);
}

<?php
/**
 * Unfilled Functions Endpoint
 * 
 * GET /api/unfilled - Hämta projektfunktioner utan tilldelad personal
 *
 * Query params:
 * - startDate: Startdatum (ISO format)
 * - endDate: Slutdatum (ISO format)
 * - projectIds: Kommaseparerade projekt-ID:n (valfritt)
 */

function handleUnfilledEndpoint(RentmanClient $rentman, ApiResponse $response): void
{
    $debug = ($_GET['debug'] ?? '') === '1';
    $t0 = microtime(true);
    $timings = [];

    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $projectIdsParam = $_GET['projectIds'] ?? '';

    if (empty($startDate) || empty($endDate)) {
        $response->badRequest('startDate and endDate are required');
        return;
    }

    // Valfritt: filtrera på specifika projekt
    $filterProjectIds = [];
    if (!empty($projectIdsParam)) {
        $filterProjectIds = array_map('intval', array_filter(explode(',', $projectIdsParam)));
    }

    $timings['step1_start'] = microtime(true) - $t0;

    // STEG 1: Hämta alla projekt i datumintervallet (begränsa fält för att minska data)
    try {
        // Begränsa till aktiva projekt och färre fält
        $allProjects = $rentman->fetchAllPages('/projects', [
            'fields' => 'id,displayname,name,planperiod_start,planperiod_end,color,planningstate,status'
        ], 100);
        
        // Filtrera på datum
        $relevantProjects = array_filter($allProjects, function($project) use ($startDate, $endDate, $filterProjectIds) {
            // Om specifika projektIDs angivna, filtrera på dem
            if (!empty($filterProjectIds) && !in_array($project['id'], $filterProjectIds)) {
                return false;
            }
            
            $projectStart = $project['planperiod_start'] ?? null;
            $projectEnd = $project['planperiod_end'] ?? null;
            
            if (!$projectStart || !$projectEnd) return false;
            
            // Endast bekräftade projekt
            $status = strtolower($project['planningstate'] ?? $project['status'] ?? '');
            if ($status !== 'confirmed') return false;
            
            $projectStartDate = substr($projectStart, 0, 10);
            $projectEndDate = substr($projectEnd, 0, 10);
            
            // Projekt inom datumintervall
            if ($projectEndDate < $startDate) return false;
            if ($projectStartDate > $endDate) return false;
            
            return true;
        });
        
        $relevantProjects = array_values($relevantProjects);
    } catch (Exception $e) {
        $response->error("Failed to fetch projects: " . $e->getMessage(), 500);
        return;
    }

    $timings['step1_projects'] = count($relevantProjects);
    $timings['step2_start'] = microtime(true) - $t0;

    // STEG 2: För varje projekt, hämta funktioner och kolla om de har crew
    $unfilledFunctions = [];
    $projectMap = [];

    foreach ($relevantProjects as $project) {
        $projectId = $project['id'];
        $projectMap[$projectId] = [
            'name' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
            'color' => $project['color'] ?? null,
            'status' => $project['planningstate'] ?? $project['status'] ?? null,
            'start' => $project['planperiod_start'] ?? null,
            'end' => $project['planperiod_end'] ?? null,
        ];

        try {
            // Hämta projektets funktioner (begränsa fält)
            $functions = $rentman->fetchAllPages("/projects/$projectId/projectfunctions", [
                'fields' => 'id,name,displayname,planperiod_start,planperiod_end,crewmember_count,quantity,remark'
            ], 100);
            
            foreach ($functions as $func) {
                $funcId = $func['id'];
                $funcStart = $func['planperiod_start'] ?? $project['planperiod_start'] ?? null;
                $funcEnd = $func['planperiod_end'] ?? $project['planperiod_end'] ?? null;
                
                if (!$funcStart || !$funcEnd) continue;
                
                // Filtrera på datumintervall
                $funcStartDate = substr($funcStart, 0, 10);
                $funcEndDate = substr($funcEnd, 0, 10);
                
                if ($funcEndDate < $startDate) continue;
                if ($funcStartDate > $endDate) continue;
                
                // Hämta crew tilldelad till denna funktion
                $crewCount = $func['crewmember_count'] ?? null;
                
                // Om crewmember_count inte finns, kolla manuellt
                if ($crewCount === null) {
                    try {
                        $projectCrew = $rentman->get("/projectfunctions/$funcId/projectcrew");
                        $crewCount = count($projectCrew['data'] ?? []);
                    } catch (Exception $e) {
                        $crewCount = 0;
                    }
                }
                
                // Lägg till om ingen crew tilldelad
                if ($crewCount === 0) {
                    $unfilledFunctions[] = [
                        'id' => 'unfilled_' . $funcId,
                        'type' => 'unfilled',
                        'functionId' => $funcId,
                        'projectId' => $projectId,
                        'projectName' => $projectMap[$projectId]['name'],
                        'projectColor' => $projectMap[$projectId]['color'],
                        'color' => $projectMap[$projectId]['color'],
                        'projectStatus' => $projectMap[$projectId]['status'],
                        'role' => $func['name'] ?? $func['displayname'] ?? 'Okänd roll',
                        'start' => $funcStart,
                        'end' => $funcEnd,
                        'crewId' => null,
                        'remark' => $func['remark'] ?? null,
                        'quantity' => $func['quantity'] ?? 1,
                    ];
                }
            }
        } catch (Exception $e) {
            error_log("Failed to fetch functions for project $projectId: " . $e->getMessage());
        }
    }

    $timings['step2_done'] = microtime(true) - $t0;
    $timings['unfilled_count'] = count($unfilledFunctions);

    // Sortera efter startdatum
    usort($unfilledFunctions, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $timings['total'] = microtime(true) - $t0;

    $result = [
        'data' => $unfilledFunctions,
        'count' => count($unfilledFunctions),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ];

    if ($debug) {
        $result['_debug'] = [
            'timings_seconds' => $timings,
        ];
    }

    $response->json($result);
}

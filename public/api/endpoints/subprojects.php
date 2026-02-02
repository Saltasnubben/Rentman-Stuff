<?php
/**
 * Subprojects Endpoint
 *
 * GET /api/subprojects - Lista alla subprojekt med status
 * GET /api/subprojects/{id} - Hämta ett specifikt subprojekt
 */

function handleSubprojectsEndpoint(RentmanClient $rentman, ApiResponse $response, ?string $id): void
{
    if ($id === null) {
        handleGetAllSubprojects($rentman, $response);
    } else {
        handleGetSubproject($rentman, $response, $id);
    }
}

/**
 * Hämtar alla subprojekt med status
 */
function handleGetAllSubprojects(RentmanClient $rentman, ApiResponse $response): void
{
    // Hämta subprojects
    $subprojects = $rentman->fetchAllPages('/subprojects', [], 25);
    
    // Hämta alla statusar för att kunna mappa id -> namn
    $statusMap = [];
    try {
        $statuses = $rentman->fetchAllPages('/statuses', [], 50);
        foreach ($statuses as $status) {
            $statusMap[$status['id']] = $status['name'] ?? $status['displayname'] ?? 'Unknown';
        }
    } catch (Exception $e) {
        // Om vi inte kan hämta statusar, fortsätt ändå
        error_log("Could not fetch statuses: " . $e->getMessage());
    }
    
    // Debug mode
    if (isset($_GET['debug']) && !empty($subprojects)) {
        $response->json([
            'debug' => true,
            'sample_raw' => $subprojects[0],
            'available_fields' => array_keys($subprojects[0]),
            'status_map' => $statusMap,
            'total' => count($subprojects),
        ]);
        return;
    }

    // Filtrera på datum om angivet
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;

    if ($startDate || $endDate) {
        $subprojects = array_filter($subprojects, function($sp) use ($startDate, $endDate) {
            $spStart = $sp['planperiod_start'] ?? null;
            $spEnd = $sp['planperiod_end'] ?? null;

            if (!$spStart || !$spEnd) return false;
            if ($startDate && $spEnd < $startDate) return false;
            if ($endDate && $spStart > $endDate) return false;

            return true;
        });
        $subprojects = array_values($subprojects);
    }

    // Mappa till förenklat format
    $simplifiedSubprojects = array_map(function ($sp) use ($statusMap) {
        // Extrahera status ID från referens (t.ex. "/statuses/123" -> 123)
        $statusRef = $sp['status'] ?? null;
        $statusId = null;
        $statusName = null;
        
        if ($statusRef) {
            preg_match('/\/statuses\/(\d+)/', $statusRef, $matches);
            $statusId = isset($matches[1]) ? (int)$matches[1] : null;
            $statusName = $statusId !== null ? ($statusMap[$statusId] ?? null) : null;
        }
        
        // Extrahera project ID
        $projectRef = $sp['project'] ?? null;
        $projectId = null;
        if ($projectRef) {
            preg_match('/\/projects\/(\d+)/', $projectRef, $matches);
            $projectId = isset($matches[1]) ? (int)$matches[1] : null;
        }

        return [
            'id' => $sp['id'],
            'name' => $sp['displayname'] ?? $sp['name'] ?? 'Unnamed',
            'projectId' => $projectId,
            'projectRef' => $projectRef,
            'statusId' => $statusId,
            'statusName' => $statusName,
            'statusRef' => $statusRef,
            'start' => $sp['planperiod_start'] ?? null,
            'end' => $sp['planperiod_end'] ?? null,
            'location' => $sp['location'] ?? null,
            'in_planning' => $sp['in_planning'] ?? true,
            'in_financial' => $sp['in_financial'] ?? true,
        ];
    }, $subprojects);

    // Sortera efter startdatum
    usort($simplifiedSubprojects, function ($a, $b) {
        return strcmp($a['start'] ?? '', $b['start'] ?? '');
    });

    $response->json([
        'data' => $simplifiedSubprojects,
        'count' => count($simplifiedSubprojects),
        'statusMap' => $statusMap,
    ]);
}

/**
 * Hämtar ett specifikt subprojekt
 */
function handleGetSubproject(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    try {
        $result = $rentman->get("/subprojects/$id");
        $response->json($result);
    } catch (Exception $e) {
        if ($e->getCode() === 404) {
            $response->notFound("Subproject not found: $id");
        }
        throw $e;
    }
}

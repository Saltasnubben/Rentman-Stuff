<?php
/**
 * Vehicles Endpoint
 *
 * GET /api/vehicles - Lista alla fordon
 * GET /api/vehicles/bookings - Hämta fordonsbokningar
 */

function handleVehiclesEndpoint(RentmanClient $rentman, ApiResponse $response, ?string $subEndpoint): void
{
    if ($subEndpoint === 'bookings') {
        handleGetVehicleBookings($rentman, $response);
    } else {
        handleGetAllVehicles($rentman, $response);
    }
}

/**
 * Hämtar alla fordon
 */
function handleGetAllVehicles(RentmanClient $rentman, ApiResponse $response): void
{
    $vehicles = $rentman->fetchAllPages('/vehicles', [], 100);

    // Mappa till förenklat format
    $simplified = array_map(function ($v) {
        return [
            'id' => $v['id'],
            'name' => $v['displayname'] ?? $v['name'] ?? 'Unnamed',
            'licenseplate' => $v['licenseplate'] ?? null,
            'seats' => $v['seats'] ?? null,
            'payload_capacity' => $v['payload_capacity'] ?? null,
            'in_planner' => $v['in_planner'] ?? true,
            'tags' => $v['tags'] ?? '',
        ];
    }, $vehicles);

    // Filtrera till de som är synliga i planner
    $simplified = array_filter($simplified, fn($v) => $v['in_planner']);
    $simplified = array_values($simplified);

    $response->json([
        'data' => $simplified,
        'count' => count($simplified),
    ]);
}

/**
 * Hämtar fordonsbokningar
 */
function handleGetVehicleBookings(RentmanClient $rentman, ApiResponse $response): void
{
    $debug = ($_GET['debug'] ?? '') === '1';
    $t0 = microtime(true);
    $timings = [];

    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $vehicleIdsParam = $_GET['vehicleIds'] ?? '';

    if (empty($startDate) || empty($endDate)) {
        $response->badRequest('startDate and endDate are required');
        return;
    }

    $selectedVehicleIds = [];
    if (!empty($vehicleIdsParam)) {
        $selectedVehicleIds = array_map('intval', array_filter(explode(',', $vehicleIdsParam)));
    }

    if (empty($selectedVehicleIds)) {
        $response->json([
            'data' => [],
            'count' => 0,
            'period' => ['startDate' => $startDate, 'endDate' => $endDate],
        ]);
        return;
    }

    $timings['step1_start'] = microtime(true) - $t0;

    // STEG 1: Hämta alla projectvehicles för valda fordon
    $allAssignments = [];
    $neededFunctionIds = [];

    foreach ($selectedVehicleIds as $vehicleId) {
        try {
            $assignments = $rentman->fetchAllPages("/projectvehicles", [
                'vehicle' => "/vehicles/$vehicleId"
            ], 100);

            foreach ($assignments as $assignment) {
                $assignmentStart = $assignment['planningperiod_start'] ?? null;
                $assignmentEnd = $assignment['planningperiod_end'] ?? null;

                if (!$assignmentStart || !$assignmentEnd) continue;

                $assignmentStartDate = substr($assignmentStart, 0, 10);
                $assignmentEndDate = substr($assignmentEnd, 0, 10);

                if ($assignmentEndDate < $startDate) continue;
                if ($assignmentStartDate > $endDate) continue;

                // Samla function IDs
                $functionRef = $assignment['function'] ?? null;
                if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
                    $neededFunctionIds[$matches[1]] = true;
                }

                $allAssignments[] = [
                    'assignment' => $assignment,
                    'vehicleId' => $vehicleId,
                ];
            }
        } catch (Exception $e) {
            error_log("Failed to fetch assignments for vehicle $vehicleId: " . $e->getMessage());
        }
    }

    $timings['step1_done'] = microtime(true) - $t0;
    $timings['assignments_count'] = count($allAssignments);

    // STEG 2: Hämta funktioner för att få projektinfo
    $functionMap = [];
    $neededProjectIds = [];

    foreach (array_keys($neededFunctionIds) as $funcId) {
        try {
            $funcData = $rentman->get("/projectfunctions/$funcId");
            $func = $funcData['data'] ?? $funcData;

            $projectRef = $func['project'] ?? null;
            $projectId = null;
            if ($projectRef && preg_match('/\/projects\/(\d+)/', $projectRef, $matches)) {
                $projectId = $matches[1];
                $neededProjectIds[$projectId] = true;
            }

            $functionMap[$funcId] = [
                'name' => $func['name'] ?? null,
                'projectId' => $projectId,
            ];
        } catch (Exception $e) {
            error_log("Failed to fetch function $funcId: " . $e->getMessage());
        }
    }

    $timings['step2_done'] = microtime(true) - $t0;

    // STEG 3: Hämta projekt
    $projectMap = [];

    foreach (array_keys($neededProjectIds) as $projectId) {
        try {
            $projectData = $rentman->get("/projects/$projectId");
            $project = $projectData['data'] ?? $projectData;

            $projectMap[$projectId] = [
                'name' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
                'color' => $project['color'] ?? null,
            ];
        } catch (Exception $e) {
            error_log("Failed to fetch project $projectId: " . $e->getMessage());
        }
    }

    $timings['step3_done'] = microtime(true) - $t0;

    // STEG 4: Bygg bokningar
    $allBookings = [];

    foreach ($allAssignments as $item) {
        $assignment = $item['assignment'];
        $vehicleId = $item['vehicleId'];

        $functionRef = $assignment['function'] ?? null;
        $projectName = 'Okänt projekt';
        $projectId = null;
        $projectColor = null;

        if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
            $funcId = $matches[1];

            if (isset($functionMap[$funcId])) {
                $funcInfo = $functionMap[$funcId];
                $projectId = $funcInfo['projectId'];

                if ($projectId && isset($projectMap[$projectId])) {
                    $projInfo = $projectMap[$projectId];
                    $projectName = $projInfo['name'];
                    $projectColor = $projInfo['color'];
                }
            }
        }

        // Fallback namn
        $displayName = $assignment['displayname'] ?? '';
        if ($projectName === 'Okänt projekt' && !empty($displayName) && stripos($displayName, 'Display') === false) {
            $projectName = $displayName;
        }

        $allBookings[] = [
            'id' => 'vehicle_' . $assignment['id'],
            'type' => 'vehicle',
            'projectId' => $projectId ? (int)$projectId : null,
            'projectName' => $projectName,
            'projectColor' => $projectColor,
            'color' => $projectColor,
            'vehicleId' => $vehicleId,
            'role' => $assignment['transport'] ?? 'Transport',
            'start' => $assignment['planningperiod_start'],
            'end' => $assignment['planningperiod_end'],
            'remark' => $assignment['remark'] ?? null,
        ];
    }

    // Sortera
    usort($allBookings, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $timings['total'] = microtime(true) - $t0;

    $result = [
        'data' => $allBookings,
        'count' => count($allBookings),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ];

    if ($debug) {
        $result['_debug'] = ['timings_seconds' => $timings];
    }

    $response->json($result);
}

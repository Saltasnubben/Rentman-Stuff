<?php
/**
 * Bookings Endpoint - Optimized with proper project names
 *
 * GET /api/bookings - Hämta bokningar för valda crewmedlemmar under en period
 *
 * Query params:
 * - crewIds: Kommaseparerade crew-ID:n
 * - startDate: Startdatum (ISO format)
 * - endDate: Slutdatum (ISO format)
 * - includeAppointments: true/false
 */

function handleBookingsEndpoint(RentmanClient $rentman, ApiResponse $response): void
{
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $crewIdsParam = $_GET['crewIds'] ?? '';
    $includeAppointments = ($_GET['includeAppointments'] ?? 'true') !== 'false';

    // Validera required params
    if (empty($startDate) || empty($endDate)) {
        $response->badRequest('startDate and endDate are required');
        return;
    }

    // Parsa crew IDs
    $selectedCrewIds = [];
    if (!empty($crewIdsParam)) {
        $selectedCrewIds = array_map('intval', array_filter(explode(',', $crewIdsParam)));
    }

    if (empty($selectedCrewIds)) {
        $response->json([
            'data' => [],
            'count' => 0,
            'period' => ['startDate' => $startDate, 'endDate' => $endDate],
        ]);
        return;
    }

    // STEG 1: Samla alla assignments för alla crew-medlemmar
    $allAssignments = [];
    $functionIds = []; // Unika function IDs att slå upp

    foreach ($selectedCrewIds as $crewId) {
        try {
            $params = ['crewmember' => "/crew/$crewId"];
            $assignments = $rentman->fetchAllPages("/projectcrew", $params, 25);

            foreach ($assignments as $assignment) {
                $assignmentStart = $assignment['planperiod_start'] ?? null;
                $assignmentEnd = $assignment['planperiod_end'] ?? null;

                if (!$assignmentStart || !$assignmentEnd) continue;

                $assignmentStartDate = substr($assignmentStart, 0, 10);
                $assignmentEndDate = substr($assignmentEnd, 0, 10);

                if ($assignmentEndDate < $startDate) continue;
                if ($assignmentStartDate > $endDate) continue;

                // Extrahera function ID
                $functionRef = $assignment['function'] ?? null;
                $functionId = null;
                if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
                    $functionId = $matches[1];
                    $functionIds[$functionId] = true;
                }

                $allAssignments[] = [
                    'assignment' => $assignment,
                    'crewId' => $crewId,
                    'functionId' => $functionId,
                ];
            }
        } catch (Exception $e) {
            error_log("Failed to fetch assignments for crew $crewId: " . $e->getMessage());
        }
    }

    // STEG 2: Hämta projektinfo för alla unika functions (med caching via RentmanClient)
    $projectInfoCache = [];
    foreach (array_keys($functionIds) as $functionId) {
        try {
            $projectInfo = fetchProjectInfoByFunction($rentman, $functionId);
            $projectInfoCache[$functionId] = $projectInfo;
        } catch (Exception $e) {
            error_log("Failed to fetch project info for function $functionId: " . $e->getMessage());
        }
    }

    // STEG 3: Bygg bookings med riktig projektinfo
    $allBookings = [];
    foreach ($allAssignments as $item) {
        $assignment = $item['assignment'];
        $crewId = $item['crewId'];
        $functionId = $item['functionId'];

        $projectInfo = $projectInfoCache[$functionId] ?? null;

        $allBookings[] = [
            'id' => $assignment['id'],
            'type' => 'project',
            'projectId' => $projectInfo['projectId'] ?? null,
            'projectName' => $projectInfo['projectName'] ?? ($assignment['displayname'] ?? 'Unnamed'),
            'projectColor' => $projectInfo['color'] ?? null,
            'color' => $projectInfo['color'] ?? null,
            'projectStatus' => $projectInfo['status'] ?? null,
            'crewId' => $crewId,
            'role' => $projectInfo['functionName'] ?? ($assignment['displayname'] ?? 'Unnamed'),
            'start' => $assignment['planperiod_start'],
            'end' => $assignment['planperiod_end'],
            'remark' => $assignment['remark'] ?? null,
        ];
    }

    // Hämta appointments om aktiverat
    if ($includeAppointments) {
        foreach ($selectedCrewIds as $crewId) {
            $appointments = fetchAppointmentsForCrew($rentman, $crewId, $startDate, $endDate);
            $allBookings = array_merge($allBookings, $appointments);
        }
    }

    // Sortera efter startdatum
    usort($allBookings, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $response->json([
        'data' => $allBookings,
        'count' => count($allBookings),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ]);
}

/**
 * Hämtar projektinfo via projectfunction ID
 * Returnerar projektnamn, färg och status
 */
function fetchProjectInfoByFunction(RentmanClient $rentman, string $functionId): array
{
    // Hämta projectfunction
    $funcData = $rentman->get("/projectfunctions/$functionId");
    $func = $funcData['data'] ?? $funcData;

    $functionName = $func['name'] ?? null;
    $projectRef = $func['project'] ?? null;

    if (!$projectRef || !preg_match('/\/projects\/(\d+)/', $projectRef, $matches)) {
        return [
            'projectId' => null,
            'projectName' => $functionName ?? 'Unknown',
            'functionName' => $functionName,
            'color' => null,
            'status' => null,
        ];
    }

    $projectId = $matches[1];

    // Hämta projekt
    $projectData = $rentman->get("/projects/$projectId");
    $project = $projectData['data'] ?? $projectData;

    return [
        'projectId' => (int)$projectId,
        'projectName' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
        'functionName' => $functionName,
        'color' => $project['color'] ?? null,
        'status' => $project['planningstate'] ?? $project['status'] ?? null,
    ];
}

/**
 * Hämtar projektinfo från assignment med caching
 */
function getProjectInfo(RentmanClient $rentman, array $assignment, array &$projectCache): array
{
    $defaultInfo = [
        'id' => null,
        'name' => $assignment['displayname'] ?? 'Unnamed',
        'color' => '#3B82F6',
        'status' => null,
        'functionName' => null,
    ];

    // Försök hämta projekt via function-referensen
    $functionRef = $assignment['function'] ?? null;
    if (!$functionRef) {
        return $defaultInfo;
    }

    // Extrahera function ID
    if (!preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
        return $defaultInfo;
    }
    $functionId = $matches[1];

    // Kolla cache först
    if (isset($projectCache[$functionId])) {
        return $projectCache[$functionId];
    }

    try {
        // Hämta projektfunktion
        $funcData = $rentman->get("/projectfunctions/$functionId");
        $func = $funcData['data'] ?? $funcData;
        $defaultInfo['functionName'] = $func['name'] ?? null;

        // Hämta projekt
        $projectRef = $func['project'] ?? null;
        if ($projectRef && preg_match('/\/projects\/(\d+)/', $projectRef, $projMatches)) {
            $projectId = $projMatches[1];

            // Kolla om projektet finns i cache
            $cacheKey = "project_$projectId";
            if (isset($projectCache[$cacheKey])) {
                $projectInfo = $projectCache[$cacheKey];
                $projectInfo['functionName'] = $defaultInfo['functionName'];
                $projectCache[$functionId] = $projectInfo;
                return $projectInfo;
            }

            $projectData = $rentman->get("/projects/$projectId");
            $project = $projectData['data'] ?? $projectData;

            $projectInfo = [
                'id' => (int)$projectId,
                'name' => $project['displayname'] ?? $project['name'] ?? $defaultInfo['name'],
                'color' => $project['color'] ?? $defaultInfo['color'],
                'status' => $project['planningstate'] ?? $project['status'] ?? null,
                'functionName' => $defaultInfo['functionName'],
            ];

            // Spara i cache
            $projectCache[$functionId] = $projectInfo;
            $projectCache[$cacheKey] = $projectInfo;

            return $projectInfo;
        }
    } catch (Exception $e) {
        error_log("Failed to get project info for function $functionId: " . $e->getMessage());
    }

    $projectCache[$functionId] = $defaultInfo;
    return $defaultInfo;
}

/**
 * Hämtar kalenderbokningar för en crewmedlem
 */
function fetchAppointmentsForCrew(RentmanClient $rentman, int $crewId, string $startDate, string $endDate): array
{
    $appointments = [];

    try {
        $rawAppointments = $rentman->fetchAllPages("/crew/$crewId/appointments", [], 25);

        foreach ($rawAppointments as $apt) {
            $aptStart = $apt['start'] ?? null;
            $aptEnd = $apt['end'] ?? null;

            if (!$aptStart || !$aptEnd) continue;

            $aptStartDate = substr($aptStart, 0, 10);
            $aptEndDate = substr($aptEnd, 0, 10);

            if ($aptEndDate < $startDate) continue;
            if ($aptStartDate > $endDate) continue;

            $appointments[] = [
                'id' => 'apt_' . $apt['id'],
                'type' => 'appointment',
                'projectId' => null,
                'projectName' => $apt['displayname'] ?? $apt['name'] ?? 'Kalenderbokning',
                'start' => $aptStart,
                'end' => $aptEnd,
                'role' => $apt['displayname'] ?? $apt['name'] ?? 'Möte',
                'remark' => $apt['remark'] ?? null,
                'color' => $apt['color'] ?? null,
                'crewId' => $crewId,
            ];
        }
    } catch (Exception $e) {
        error_log("Failed to fetch appointments for crew $crewId: " . $e->getMessage());
    }

    return $appointments;
}

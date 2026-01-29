<?php
/**
 * Bookings Endpoint - Optimized
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

    $allBookings = [];
    $projectCache = []; // Cache för projektdata

    // Hämta projektbokningar för varje vald crewmedlem
    foreach ($selectedCrewIds as $crewId) {
        $bookings = fetchProjectBookingsForCrew($rentman, $crewId, $startDate, $endDate, $projectCache);
        $allBookings = array_merge($allBookings, $bookings);
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
 * Hämtar projektbokningar för en specifik crewmedlem
 * Optimerad version - använder endast data från projectcrew utan extra API-anrop
 */
function fetchProjectBookingsForCrew(RentmanClient $rentman, int $crewId, string $startDate, string $endDate, array &$projectCache): array
{
    $bookings = [];

    try {
        // Hämta projektuppdrag för denna crew via /projectcrew
        $params = ['crewmember' => "/crew/$crewId"];
        $assignments = $rentman->fetchAllPages("/projectcrew", $params, 25);

        foreach ($assignments as $assignment) {
            $assignmentStart = $assignment['planperiod_start'] ?? null;
            $assignmentEnd = $assignment['planperiod_end'] ?? null;

            // Hoppa över om datum saknas
            if (!$assignmentStart || !$assignmentEnd) continue;

            // Filtrera på datum
            $assignmentStartDate = substr($assignmentStart, 0, 10);
            $assignmentEndDate = substr($assignmentEnd, 0, 10);

            if ($assignmentEndDate < $startDate) continue;
            if ($assignmentStartDate > $endDate) continue;

            // Extrahera projekt-ID från function-referensen för caching
            $functionRef = $assignment['function'] ?? null;
            $projectId = null;
            if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
                $projectId = $matches[1];
            }

            // Använd displayname direkt - undvik extra API-anrop
            $projectName = $assignment['displayname'] ?? 'Unnamed';

            $bookings[] = [
                'id' => $assignment['id'],
                'type' => 'project',
                'projectId' => $projectId ? (int)$projectId : null,
                'projectName' => $projectName,
                'projectColor' => null, // Skippa för snabbhet
                'color' => null,
                'projectStatus' => null, // Skippa för snabbhet
                'crewId' => $crewId,
                'role' => $projectName,
                'start' => $assignmentStart,
                'end' => $assignmentEnd,
                'remark' => $assignment['remark'] ?? null,
            ];
        }
    } catch (Exception $e) {
        error_log("Failed to fetch bookings for crew $crewId: " . $e->getMessage());
    }

    return $bookings;
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

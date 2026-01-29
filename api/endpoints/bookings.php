<?php
/**
 * Bookings Endpoint - Optimized with bulk pre-fetching
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

    // STEG 1: Förhämta ALLA projekt och funktioner (bulk fetch - mycket snabbare)
    $projectMap = [];    // project_id => {name, color, status}
    $functionMap = [];   // function_id => {name, project_id}

    try {
        // Hämta alla projekt (med cache via RentmanClient)
        $allProjects = $rentman->fetchAllPages("/projects", [], 100);
        foreach ($allProjects as $project) {
            $projectId = $project['id'] ?? null;
            if ($projectId) {
                $projectMap[(string)$projectId] = [
                    'name' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
                    'color' => $project['color'] ?? null,
                    'status' => $project['planningstate'] ?? $project['status'] ?? null,
                ];
            }
        }
    } catch (Exception $e) {
        error_log("Failed to fetch projects: " . $e->getMessage());
    }

    try {
        // Hämta alla projektfunktioner
        $allFunctions = $rentman->fetchAllPages("/projectfunctions", [], 100);
        foreach ($allFunctions as $func) {
            $funcId = $func['id'] ?? null;
            $projectRef = $func['project'] ?? null;
            $projectId = null;
            if ($projectRef && preg_match('/\/projects\/(\d+)/', $projectRef, $matches)) {
                $projectId = $matches[1]; // Behåll som sträng
            }
            if ($funcId) {
                $functionMap[(string)$funcId] = [
                    'name' => $func['name'] ?? null,
                    'projectId' => $projectId,
                ];
            }
        }
    } catch (Exception $e) {
        error_log("Failed to fetch project functions: " . $e->getMessage());
    }

    // STEG 2: Hämta assignments för varje crewmedlem
    $allBookings = [];

    foreach ($selectedCrewIds as $crewId) {
        try {
            $params = ['crewmember' => "/crew/$crewId"];
            $assignments = $rentman->fetchAllPages("/projectcrew", $params, 100);

            foreach ($assignments as $assignment) {
                $assignmentStart = $assignment['planperiod_start'] ?? null;
                $assignmentEnd = $assignment['planperiod_end'] ?? null;

                if (!$assignmentStart || !$assignmentEnd) continue;

                $assignmentStartDate = substr($assignmentStart, 0, 10);
                $assignmentEndDate = substr($assignmentEnd, 0, 10);

                if ($assignmentEndDate < $startDate) continue;
                if ($assignmentStartDate > $endDate) continue;

                // Extrahera function ID och slå upp i våra maps
                $functionRef = $assignment['function'] ?? null;
                $functionId = null;
                $projectId = null;
                $projectName = $assignment['displayname'] ?? 'Unnamed';
                $functionName = $projectName;
                $projectColor = null;
                $projectStatus = null;

                if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
                    $functionId = $matches[1]; // Sträng för konsekvent lookup

                    // Slå upp funktion
                    if (isset($functionMap[$functionId])) {
                        $funcInfo = $functionMap[$functionId];
                        $functionName = $funcInfo['name'] ?? $functionName;
                        $projectId = $funcInfo['projectId'];

                        // Slå upp projekt
                        if ($projectId && isset($projectMap[$projectId])) {
                            $projInfo = $projectMap[$projectId];
                            $projectName = $projInfo['name'];
                            $projectColor = $projInfo['color'];
                            $projectStatus = $projInfo['status'];
                        }
                    }
                }

                $allBookings[] = [
                    'id' => $assignment['id'],
                    'type' => 'project',
                    'projectId' => $projectId,
                    'projectName' => $projectName,
                    'projectColor' => $projectColor,
                    'color' => $projectColor,
                    'projectStatus' => $projectStatus,
                    'crewId' => $crewId,
                    'role' => $functionName,
                    'start' => $assignmentStart,
                    'end' => $assignmentEnd,
                    'remark' => $assignment['remark'] ?? null,
                ];
            }
        } catch (Exception $e) {
            error_log("Failed to fetch assignments for crew $crewId: " . $e->getMessage());
        }
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
 * Hämtar kalenderbokningar för en crewmedlem
 */
function fetchAppointmentsForCrew(RentmanClient $rentman, int $crewId, string $startDate, string $endDate): array
{
    $appointments = [];

    try {
        $rawAppointments = $rentman->fetchAllPages("/crew/$crewId/appointments", [], 100);

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

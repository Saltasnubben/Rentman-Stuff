<?php
/**
 * Bookings Endpoint - Optimized with targeted fetching
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

    // STEG 1: Hämta alla assignments för alla crew först
    $allAssignments = [];
    $neededFunctionIds = [];

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

                // Samla function IDs vi behöver
                $functionRef = $assignment['function'] ?? null;
                if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
                    $neededFunctionIds[$matches[1]] = true;
                }

                $allAssignments[] = [
                    'assignment' => $assignment,
                    'crewId' => $crewId,
                ];
            }
        } catch (Exception $e) {
            error_log("Failed to fetch assignments for crew $crewId: " . $e->getMessage());
        }
    }

    // STEG 2: Hämta bara de funktioner vi behöver (med cache)
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

    // STEG 3: Hämta bara de projekt vi behöver (med cache)
    $projectMap = [];

    foreach (array_keys($neededProjectIds) as $projectId) {
        try {
            $projectData = $rentman->get("/projects/$projectId");
            $project = $projectData['data'] ?? $projectData;

            $projectMap[$projectId] = [
                'name' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
                'color' => $project['color'] ?? null,
                'status' => $project['planningstate'] ?? $project['status'] ?? null,
            ];
        } catch (Exception $e) {
            error_log("Failed to fetch project $projectId: " . $e->getMessage());
        }
    }

    // STEG 4: Bygg bookings med projektinfo
    $allBookings = [];

    foreach ($allAssignments as $item) {
        $assignment = $item['assignment'];
        $crewId = $item['crewId'];

        $functionRef = $assignment['function'] ?? null;
        $projectName = $assignment['displayname'] ?? 'Unnamed';
        $functionName = $projectName;
        $projectId = null;
        $projectColor = null;
        $projectStatus = null;

        if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
            $funcId = $matches[1];

            if (isset($functionMap[$funcId])) {
                $funcInfo = $functionMap[$funcId];
                $functionName = $funcInfo['name'] ?? $functionName;
                $projectId = $funcInfo['projectId'];

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
            'projectId' => $projectId ? (int)$projectId : null,
            'projectName' => $projectName,
            'projectColor' => $projectColor,
            'color' => $projectColor,
            'projectStatus' => $projectStatus,
            'crewId' => $crewId,
            'role' => $functionName,
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

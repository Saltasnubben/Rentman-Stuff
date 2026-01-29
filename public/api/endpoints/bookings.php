<?php
/**
 * Bookings Endpoint
 *
 * GET /api/bookings - Hämta bokningar för valda crewmedlemmar under en period
 *
 * Query params:
 * - crewIds: Kommaseparerade crew-ID:n
 * - startDate: Startdatum (ISO format)
 * - endDate: Slutdatum (ISO format)
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
    }

    // Parsa crew IDs
    $selectedCrewIds = [];
    if (!empty($crewIdsParam)) {
        $selectedCrewIds = array_map('intval', array_filter(explode(',', $crewIdsParam)));
    }

    // Hämta projekt (planperiod_* är genererade fält och kan inte filtreras i API)
    $projects = $rentman->fetchAllPages('/projects', [], 10);

    // Filtrera på datum lokalt
    $projects = array_filter($projects, function($project) use ($startDate, $endDate) {
        $projectStart = $project['planperiod_start'] ?? null;
        $projectEnd = $project['planperiod_end'] ?? null;

        // Projekt utan datum inkluderas inte
        if (!$projectStart || !$projectEnd) {
            return false;
        }

        // Projekt slutar innan vårt startdatum
        if ($projectEnd < $startDate) {
            return false;
        }

        // Projekt startar efter vårt slutdatum
        if ($projectStart > $endDate) {
            return false;
        }

        return true;
    });
    $projects = array_values($projects);

    if (empty($projects)) {
        $response->json([
            'data' => [],
            'count' => 0,
            'period' => ['startDate' => $startDate, 'endDate' => $endDate],
            'projectCount' => 0,
        ]);
        return;
    }

    // Hämta crew-tilldelningar för varje projekt
    $bookings = [];
    $functionsByProject = [];

    foreach ($projects as $project) {
        $projectId = $project['id'];

        // Hämta crew-tilldelningar
        try {
            $crewAssignments = $rentman->fetchAllPages("/projects/$projectId/projectcrew");
        } catch (Exception $e) {
            // Logga fel men fortsätt
            error_log("Failed to fetch crew for project $projectId: " . $e->getMessage());
            continue;
        }

        // Hämta projektfunktioner för mer detaljer
        try {
            $functions = $rentman->fetchAllPages("/projects/$projectId/projectfunctions");
            $functionsByProject[$projectId] = $functions;
        } catch (Exception $e) {
            $functionsByProject[$projectId] = [];
        }

        // Bearbeta crew-tilldelningar
        foreach ($crewAssignments as $assignment) {
            // Try multiple field names for crew reference
            $crewRef = $assignment['crewmember'] ?? $assignment['crew'] ?? null;
            $crewId = extractCrewId($crewRef);

            // Filtrera på valda crew om specificerat
            if (!empty($selectedCrewIds) && !in_array($crewId, $selectedCrewIds)) {
                continue;
            }

            // Hitta kopplad funktion för tidsdetaljer
            $projectFunction = findFunction(
                $functionsByProject[$projectId] ?? [],
                $assignment['projectfunction'] ?? null
            );

            $booking = [
                'id' => $projectId . '-' . $assignment['id'],
                'type' => 'project',
                'projectId' => $projectId,
                'projectName' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
                'projectColor' => $project['color'] ?? '#3B82F6',
                'color' => $project['color'] ?? null,
                'projectStatus' => $project['planningstate'] ?? $project['status'] ?? null,
                'crewId' => $crewId,
                'crewAssignmentId' => $assignment['id'],
                'role' => $assignment['function_name'] ?? $projectFunction['name'] ?? 'Crew',
                'start' => $projectFunction['planperiod_start'] ?? $project['planperiod_start'] ?? null,
                'end' => $projectFunction['planperiod_end'] ?? $project['planperiod_end'] ?? null,
                'location' => $project['location'] ?? null,
                'customer' => $project['account_name'] ?? null,
                'remark' => $assignment['remark'] ?? null,
            ];

            $bookings[] = $booking;
        }
    }

    // Hämta appointments för varje vald crewmedlem om aktiverat
    if ($includeAppointments && !empty($selectedCrewIds)) {
        foreach ($selectedCrewIds as $crewId) {
            $appointments = fetchCrewAppointmentsForBookings($rentman, $crewId, $startDate, $endDate);
            $bookings = array_merge($bookings, $appointments);
        }
    }

    // Sortera efter startdatum
    usort($bookings, function ($a, $b) {
        return strcmp($a['start'] ?? '', $b['start'] ?? '');
    });

    $response->json([
        'data' => $bookings,
        'count' => count($bookings),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
        'projectCount' => count($projects),
    ]);
}

/**
 * Hämtar kalenderbokningar (appointments) för en crewmedlem
 */
function fetchCrewAppointmentsForBookings(RentmanClient $rentman, int $crewId, string $startDate, string $endDate): array
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
                'location' => $apt['location'] ?? null,
                'color' => $apt['color'] ?? null,
                'crewId' => $crewId,
            ];
        }
    } catch (Exception $e) {
        error_log("Failed to fetch appointments for crew $crewId: " . $e->getMessage());
    }

    return $appointments;
}

/**
 * Extraherar crew-ID från en referenssträng som "/crew/123"
 */
function extractCrewId($crewRef): ?int
{
    if ($crewRef === null) {
        return null;
    }

    if (is_numeric($crewRef)) {
        return (int) $crewRef;
    }

    // Try both /crew/ and /crewmember/ patterns
    if (preg_match('/\/crew(?:member)?\/(\d+)/', $crewRef, $matches)) {
        return (int) $matches[1];
    }

    return null;
}

/**
 * Hittar en funktion baserat på referens
 */
function findFunction(array $functions, $functionRef): ?array
{
    if (empty($functions) || $functionRef === null) {
        return null;
    }

    if (preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
        $functionId = (int) $matches[1];
        foreach ($functions as $func) {
            if (($func['id'] ?? null) === $functionId) {
                return $func;
            }
        }
    }

    return null;
}

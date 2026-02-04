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
    $debug = ($_GET['debug'] ?? '') === '1';
    $timings = [];
    $t0 = microtime(true);

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
    $timings['step1_start'] = microtime(true) - $t0;

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
    $timings['step1_done'] = microtime(true) - $t0;
    $timings['assignments_count'] = count($allAssignments);
    $timings['functions_needed'] = count($neededFunctionIds);

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
    $timings['step2_done'] = microtime(true) - $t0;
    $timings['projects_needed'] = count($neededProjectIds);

    $projectMap = [];
    $neededContactIds = [];

    foreach (array_keys($neededProjectIds) as $projectId) {
        try {
            $projectData = $rentman->get("/projects/$projectId");
            $project = $projectData['data'] ?? $projectData;

            // Extract contact IDs for later fetching
            $customerId = null;
            $locationId = null;
            $accountManagerId = null;
            
            if (!empty($project['customer']) && preg_match('/\/contacts\/(\d+)/', $project['customer'], $m)) {
                $customerId = $m[1];
                $neededContactIds[$customerId] = true;
            }
            if (!empty($project['location']) && preg_match('/\/contacts\/(\d+)/', $project['location'], $m)) {
                $locationId = $m[1];
                $neededContactIds[$locationId] = true;
            }
            if (!empty($project['account_manager']) && preg_match('/\/crew\/(\d+)/', $project['account_manager'], $m)) {
                $accountManagerId = $m[1];
            }

            $projectMap[$projectId] = [
                'name' => $project['displayname'] ?? $project['name'] ?? 'Unnamed',
                'number' => $project['number'] ?? null,
                'color' => $project['color'] ?? null,
                'status' => $project['planningstate'] ?? $project['status'] ?? null,
                'customerId' => $customerId,
                'locationId' => $locationId,
                'accountManagerId' => $accountManagerId,
                'accountManagerName' => null, // Will be filled later
            ];
        } catch (Exception $e) {
            error_log("Failed to fetch project $projectId: " . $e->getMessage());
        }
    }

    // STEG 3b: Hämta kontaktnamn för kunder och platser
    $contactMap = [];
    foreach (array_keys($neededContactIds) as $contactId) {
        try {
            $contactData = $rentman->get("/contacts/$contactId");
            $contact = $contactData['data'] ?? $contactData;
            $contactMap[$contactId] = $contact['displayname'] ?? $contact['name'] ?? null;
        } catch (Exception $e) {
            error_log("Failed to fetch contact $contactId: " . $e->getMessage());
        }
    }

    // Fetch account manager names from crew endpoint
    $accountManagerIds = array_filter(array_map(fn($p) => $p['accountManagerId'], $projectMap));
    foreach (array_unique($accountManagerIds) as $amId) {
        try {
            $crewData = $rentman->get("/crew/$amId");
            $crew = $crewData['data'] ?? $crewData;
            // Update all projects with this account manager
            foreach ($projectMap as $pId => &$pData) {
                if ($pData['accountManagerId'] === $amId) {
                    $pData['accountManagerName'] = $crew['displayname'] ?? $crew['name'] ?? null;
                }
            }
            unset($pData);
        } catch (Exception $e) {
            error_log("Failed to fetch crew (AM) $amId: " . $e->getMessage());
        }
    }

    // Add contact names to project map
    foreach ($projectMap as $pId => &$pData) {
        if ($pData['customerId'] && isset($contactMap[$pData['customerId']])) {
            $pData['customerName'] = $contactMap[$pData['customerId']];
        }
        if ($pData['locationId'] && isset($contactMap[$pData['locationId']])) {
            $pData['locationName'] = $contactMap[$pData['locationId']];
        }
    }
    unset($pData);

    // STEG 4: Bygg bookings med projektinfo
    $timings['step3_done'] = microtime(true) - $t0;

    $allBookings = [];

    foreach ($allAssignments as $item) {
        $assignment = $item['assignment'];
        $crewId = $item['crewId'];

        $functionRef = $assignment['function'] ?? null;
        $projectId = null;
        $projectColor = null;
        $projectStatus = null;

        // Start med null - vi sätter riktiga namn nedan
        $resolvedProjectName = null;
        $resolvedFunctionName = null;

        if ($functionRef && preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches)) {
            $funcId = $matches[1];

            if (isset($functionMap[$funcId])) {
                $funcInfo = $functionMap[$funcId];
                $resolvedFunctionName = $funcInfo['name'] ?? null;
                $projectId = $funcInfo['projectId'];

                if ($projectId && isset($projectMap[$projectId])) {
                    $projInfo = $projectMap[$projectId];
                    $resolvedProjectName = $projInfo['name'];
                    $projectColor = $projInfo['color'];
                    $projectStatus = $projInfo['status'];
                }
            }
        }

        // Fallback-kedja för projektnamn (undvik placeholder-namn)
        $displayName = $assignment['displayname'] ?? '';
        $isPlaceholder = empty($displayName)
            || stripos($displayName, 'Display') !== false
            || stripos($displayName, 'Planningpersonell') !== false
            || stripos($displayName, 'Planning personnel') !== false;

        // Prioritet: Riktigt projektnamn > Funktionsnamn > Assignment displayname (om ej placeholder) > Fallback
        $projectName = $resolvedProjectName
            ?? $resolvedFunctionName
            ?? (!$isPlaceholder ? $displayName : null)
            ?? 'Projekt #' . ($projectId ?? $assignment['id'] ?? 'okänt');

        $functionName = $resolvedFunctionName ?? $projectName;

        // Get additional project info
        $projectNumber = null;
        $customerName = null;
        $locationName = null;
        $accountManagerName = null;
        
        if ($projectId && isset($projectMap[$projectId])) {
            $projInfo = $projectMap[$projectId];
            $projectNumber = $projInfo['number'] ?? null;
            $customerName = $projInfo['customerName'] ?? null;
            $locationName = $projInfo['locationName'] ?? null;
            $accountManagerName = $projInfo['accountManagerName'] ?? null;
        }

        $allBookings[] = [
            'id' => $assignment['id'],
            'type' => 'project',
            'projectId' => $projectId ? (int)$projectId : null,
            'projectName' => $projectName,
            'projectNumber' => $projectNumber,
            'projectColor' => $projectColor,
            'color' => $projectColor,
            'projectStatus' => $projectStatus,
            'customer' => $customerName,
            'location' => $locationName,
            'accountManager' => $accountManagerName,
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

    $timings['total'] = microtime(true) - $t0;

    $result = [
        'data' => $allBookings,
        'count' => count($allBookings),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ];

    // Lägg till debug-info om ?debug=1
    if ($debug) {
        $result['_debug'] = [
            'timings_seconds' => $timings,
            'crew_ids' => $selectedCrewIds,
        ];
    }

    $response->json($result);
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

<?php
/**
 * Bookings Endpoint - OPTIMIZED VERSION
 *
 * Strategies:
 * 1. Batch collect all function/project IDs before fetching
 * 2. Use in-memory cache during request
 * 3. Fetch projects directly with date filter instead of via projectcrew
 * 4. Single aggregated cache file per request type
 */

function handleBookingsEndpoint(RentmanClient $rentman, ApiResponse $response): void
{
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $crewIdsParam = $_GET['crewIds'] ?? '';
    $includeAppointments = ($_GET['includeAppointments'] ?? 'true') !== 'false';

    if (empty($startDate) || empty($endDate)) {
        $response->badRequest('startDate and endDate are required');
        return;
    }

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

    // PHASE 1: Collect ALL assignments for all crew (parallel if possible)
    $allAssignments = [];
    $functionIdsNeeded = [];

    foreach ($selectedCrewIds as $crewId) {
        try {
            $assignments = $rentman->fetchAllPages("/projectcrew", [
                'crewmember' => "/crew/$crewId"
            ], 100);

            foreach ($assignments as $assignment) {
                $start = $assignment['planperiod_start'] ?? null;
                $end = $assignment['planperiod_end'] ?? null;

                if (!$start || !$end) continue;

                $startDay = substr($start, 0, 10);
                $endDay = substr($end, 0, 10);

                if ($endDay < $startDate || $startDay > $endDate) continue;

                // Extract function ID
                $funcRef = $assignment['function'] ?? '';
                $funcId = null;
                if (preg_match('/\/projectfunctions\/(\d+)/', $funcRef, $m)) {
                    $funcId = (int)$m[1];
                    $functionIdsNeeded[$funcId] = true;
                }

                $allAssignments[] = [
                    'assignment' => $assignment,
                    'crewId' => $crewId,
                    'functionId' => $funcId,
                ];
            }
        } catch (Exception $e) {
            error_log("Failed to fetch assignments for crew $crewId: " . $e->getMessage());
        }
    }

    // PHASE 2: Batch-fetch all needed functions (one call to get all)
    $functionMap = [];
    $projectIdsNeeded = [];

    // Try to fetch all functions in one batch if API supports it
    // Otherwise, fetch them individually but with better caching
    $functionIds = array_keys($functionIdsNeeded);

    if (!empty($functionIds)) {
        // Strategy: Fetch ALL projectfunctions and filter locally (cached!)
        // This is faster than N individual calls when you need many functions
        $cacheKey = 'all_projectfunctions';

        try {
            $allFunctions = $rentman->fetchAllPagesCached('/projectfunctions', [], 100, $cacheKey);

            foreach ($allFunctions as $func) {
                $fid = $func['id'] ?? null;
                if ($fid && isset($functionIdsNeeded[$fid])) {
                    $projectRef = $func['project'] ?? '';
                    $projectId = null;
                    if (preg_match('/\/projects\/(\d+)/', $projectRef, $m)) {
                        $projectId = (int)$m[1];
                        $projectIdsNeeded[$projectId] = true;
                    }

                    $functionMap[$fid] = [
                        'name' => $func['name'] ?? $func['displayname'] ?? null,
                        'projectId' => $projectId,
                    ];
                }
            }
        } catch (Exception $e) {
            // Fallback: individual fetches (original behavior)
            error_log("Bulk function fetch failed, falling back: " . $e->getMessage());
            foreach ($functionIds as $funcId) {
                try {
                    $funcData = $rentman->get("/projectfunctions/$funcId");
                    $func = $funcData['data'] ?? $funcData;

                    $projectRef = $func['project'] ?? '';
                    $projectId = null;
                    if (preg_match('/\/projects\/(\d+)/', $projectRef, $m)) {
                        $projectId = (int)$m[1];
                        $projectIdsNeeded[$projectId] = true;
                    }

                    $functionMap[$funcId] = [
                        'name' => $func['name'] ?? null,
                        'projectId' => $projectId,
                    ];
                } catch (Exception $e2) {
                    error_log("Failed to fetch function $funcId: " . $e2->getMessage());
                }
            }
        }
    }

    // PHASE 3: Batch-fetch all needed projects
    $projectMap = [];
    $projectIds = array_keys($projectIdsNeeded);

    if (!empty($projectIds)) {
        // Same strategy: fetch all projects and filter locally
        $cacheKey = 'all_projects';

        try {
            $allProjects = $rentman->fetchAllPagesCached('/projects', [], 100, $cacheKey);

            foreach ($allProjects as $proj) {
                $pid = $proj['id'] ?? null;
                if ($pid && isset($projectIdsNeeded[$pid])) {
                    $projectMap[$pid] = [
                        'name' => $proj['displayname'] ?? $proj['name'] ?? 'Unnamed',
                        'color' => $proj['color'] ?? null,
                        'status' => $proj['planningstate'] ?? $proj['status'] ?? null,
                    ];
                }
            }
        } catch (Exception $e) {
            // Fallback: individual fetches
            error_log("Bulk project fetch failed, falling back: " . $e->getMessage());
            foreach ($projectIds as $projId) {
                try {
                    $projectData = $rentman->get("/projects/$projId");
                    $proj = $projectData['data'] ?? $projectData;
                    $projectMap[$projId] = [
                        'name' => $proj['displayname'] ?? $proj['name'] ?? 'Unnamed',
                        'color' => $proj['color'] ?? null,
                        'status' => $proj['planningstate'] ?? $proj['status'] ?? null,
                    ];
                } catch (Exception $e2) {
                    error_log("Failed to fetch project $projId: " . $e2->getMessage());
                }
            }
        }
    }

    // PHASE 4: Build bookings with resolved names
    $allBookings = [];

    foreach ($allAssignments as $item) {
        $assignment = $item['assignment'];
        $crewId = $item['crewId'];
        $funcId = $item['functionId'];

        $projectName = 'Unnamed';
        $functionName = null;
        $projectId = null;
        $projectColor = null;
        $projectStatus = null;

        if ($funcId && isset($functionMap[$funcId])) {
            $funcInfo = $functionMap[$funcId];
            $functionName = $funcInfo['name'];
            $projectId = $funcInfo['projectId'];

            if ($projectId && isset($projectMap[$projectId])) {
                $projInfo = $projectMap[$projectId];
                $projectName = $projInfo['name'];
                $projectColor = $projInfo['color'];
                $projectStatus = $projInfo['status'];
            }
        }

        // Skip entries with default placeholder names
        $displayName = $assignment['displayname'] ?? '';
        $isPlaceholder = stripos($displayName, 'Display') !== false
                      || stripos($displayName, 'Planningpersonell') !== false
                      || stripos($displayName, 'Planning personnel') !== false;

        // Use resolved names, skip placeholders
        if ($projectName === 'Unnamed' && !$isPlaceholder && !empty($displayName)) {
            $projectName = $displayName;
        }

        // If we still have placeholder or no name, try to use function name
        if (($projectName === 'Unnamed' || $isPlaceholder) && $functionName) {
            $projectName = $functionName;
        }

        // Final fallback
        if ($projectName === 'Unnamed' || $isPlaceholder) {
            $projectName = 'Projekt #' . ($projectId ?? 'okänt');
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
            'role' => $functionName ?? $projectName,
            'start' => $assignment['planperiod_start'],
            'end' => $assignment['planperiod_end'],
            'remark' => $assignment['remark'] ?? null,
        ];
    }

    // PHASE 5: Fetch appointments (already efficient - one call per crew)
    if ($includeAppointments) {
        foreach ($selectedCrewIds as $crewId) {
            $appointments = fetchAppointmentsForCrewOptimized($rentman, $crewId, $startDate, $endDate);
            $allBookings = array_merge($allBookings, $appointments);
        }
    }

    // Sort by start date
    usort($allBookings, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $response->json([
        'data' => $allBookings,
        'count' => count($allBookings),
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ]);
}

function fetchAppointmentsForCrewOptimized(RentmanClient $rentman, int $crewId, string $startDate, string $endDate): array
{
    $appointments = [];

    try {
        $rawAppointments = $rentman->fetchAllPages("/crew/$crewId/appointments", [], 100);

        foreach ($rawAppointments as $apt) {
            $aptStart = $apt['start'] ?? null;
            $aptEnd = $apt['end'] ?? null;

            if (!$aptStart || !$aptEnd) continue;

            if (substr($aptEnd, 0, 10) < $startDate) continue;
            if (substr($aptStart, 0, 10) > $endDate) continue;

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

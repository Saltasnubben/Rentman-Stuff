<?php
/**
 * Crew Endpoint
 *
 * GET /api/crew - Lista alla crewmedlemmar
 * GET /api/crew/{id} - Hämta en specifik crewmedlem
 * GET /api/crew/{id}/availability - Hämta tillgänglighet
 */

function handleCrewEndpoint(RentmanClient $rentman, ApiResponse $response, ?string $id, ?string $subEndpoint): void
{
    if ($id === null) {
        // GET /api/crew - Lista alla
        handleGetAllCrew($rentman, $response);
    } elseif ($subEndpoint === 'availability') {
        // GET /api/crew/{id}/availability
        handleGetCrewAvailability($rentman, $response, $id);
    } elseif ($subEndpoint === 'bookings' || $subEndpoint === 'projectcrew') {
        // GET /api/crew/{id}/bookings - Hämta crewmedlems bokningar
        handleGetCrewBookings($rentman, $response, $id);
    } else {
        // GET /api/crew/{id}
        handleGetCrewMember($rentman, $response, $id);
    }
}

/**
 * Hämtar alla crewmedlemmar
 */
function handleGetAllCrew(RentmanClient $rentman, ApiResponse $response): void
{
    $crew = $rentman->fetchAllPages('/crew');

    // Debug: visa rådata för första crewmedlemmen
    if (isset($_GET['debug']) && !empty($crew)) {
        $response->json([
            'debug' => true,
            'sample_raw_data' => $crew[0],
            'available_fields' => array_keys($crew[0]),
            'total_crew' => count($crew),
        ]);
        return;
    }

    // Hämta alla unika tags (tags är en kommaseparerad sträng i Rentman)
    $allTags = [];
    foreach ($crew as $member) {
        $tagsString = $member['tags'] ?? '';
        if (!empty($tagsString)) {
            $tags = array_map('trim', explode(',', $tagsString));
            foreach ($tags as $tag) {
                if (!empty($tag) && !in_array($tag, $allTags)) {
                    $allTags[] = $tag;
                }
            }
        }
    }
    sort($allTags);

    // Mappa till förenklat format
    $simplifiedCrew = array_map(function ($member) {
        $firstName = $member['firstname'] ?? '';
        $lastName = $member['lastname'] ?? '';
        $displayName = $member['displayname'] ?? trim("$firstName $lastName");

        // Konvertera tags från sträng till array
        $tagsString = $member['tags'] ?? '';
        $tagsArray = !empty($tagsString) ? array_map('trim', explode(',', $tagsString)) : [];
        $tagsArray = array_filter($tagsArray); // Ta bort tomma värden

        return [
            'id' => $member['id'],
            'name' => $displayName ?: 'Unnamed',
            'firstName' => $firstName,
            'lastName' => $lastName,
            'email' => $member['email'] ?? null,
            'phone' => $member['phone'] ?? null,
            'function' => $member['function'] ?? null,
            'color' => $member['color'] ?? '#3B82F6',
            'active' => ($member['active'] ?? true) !== false,
            'tags' => $tagsArray,
        ];
    }, $crew);

    // Sortera efter namn (svensk sortering)
    usort($simplifiedCrew, function ($a, $b) {
        return strcoll($a['name'], $b['name']);
    });

    // Filtrera på tag om angiven
    if (!empty($_GET['tag'])) {
        $filterTag = $_GET['tag'];
        $simplifiedCrew = array_filter($simplifiedCrew, fn($c) => in_array($filterTag, $c['tags']));
        $simplifiedCrew = array_values($simplifiedCrew);
    }

    // Filtrera endast aktiva om ?active=true
    if (isset($_GET['active']) && $_GET['active'] === 'true') {
        $simplifiedCrew = array_filter($simplifiedCrew, fn($c) => $c['active']);
        $simplifiedCrew = array_values($simplifiedCrew);
    }

    $response->json([
        'data' => $simplifiedCrew,
        'count' => count($simplifiedCrew),
        'availableTags' => $allTags,
    ]);
}

/**
 * Hämtar en specifik crewmedlem
 */
function handleGetCrewMember(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    try {
        $result = $rentman->get("/crew/$id");
        $response->json($result);
    } catch (Exception $e) {
        if ($e->getCode() === 404) {
            $response->notFound("Crew member not found: $id");
        }
        throw $e;
    }
}

/**
 * Hämtar tillgänglighet för en crewmedlem
 */
function handleGetCrewAvailability(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    $params = [];

    if (!empty($_GET['startDate'])) {
        $params['start[gte]'] = $_GET['startDate'];
    }
    if (!empty($_GET['endDate'])) {
        $params['end[lte]'] = $_GET['endDate'];
    }

    $result = $rentman->get("/crew/$id/crewavailability", $params);
    $response->json($result);
}

/**
 * Hämtar bokningar/projektuppdrag för en crewmedlem
 */
function handleGetCrewBookings(RentmanClient $rentman, ApiResponse $response, string $id): void
{
    $startDate = $_GET['startDate'] ?? date('Y-m-d');
    $endDate = $_GET['endDate'] ?? date('Y-m-d', strtotime('+7 days'));

    // Hämta projektuppdrag via globala /projectcrew med crewmember-filter
    // Rentman använder referens-format för relationer
    $params = ['crewmember' => "/crew/$id"];
    $assignments = $rentman->fetchAllPages("/projectcrew", $params, 25);

    // Filtrera assignments på datum (datum finns direkt i assignment)
    $bookings = [];
    foreach ($assignments as $assignment) {
        $assignmentStart = $assignment['planperiod_start'] ?? null;
        $assignmentEnd = $assignment['planperiod_end'] ?? null;

        // Hoppa över om datum saknas
        if (!$assignmentStart || !$assignmentEnd) continue;

        // Extrahera endast datumdelen för jämförelse
        $assignmentStartDate = substr($assignmentStart, 0, 10);
        $assignmentEndDate = substr($assignmentEnd, 0, 10);

        // Filtrera på datum
        if ($assignmentEndDate < $startDate) continue;
        if ($assignmentStartDate > $endDate) continue;

        // Hämta projektfunktion för att få projektnamn
        $functionRef = $assignment['function'] ?? null;
        $roleName = $assignment['displayname'] ?? 'Unnamed';
        $projectName = null;
        $projectId = null;

        if ($functionRef) {
            preg_match('/\/projectfunctions\/(\d+)/', $functionRef, $matches);
            if (!empty($matches[1])) {
                try {
                    $funcData = $rentman->get("/projectfunctions/" . $matches[1]);
                    $func = $funcData['data'] ?? $funcData;
                    $roleName = $func['name'] ?? $roleName;

                    // Hämta projekt från funktionen för att få projektnamn
                    $projectRef = $func['project'] ?? null;
                    if ($projectRef) {
                        preg_match('/\/projects\/(\d+)/', $projectRef, $projMatches);
                        $projectId = $projMatches[1] ?? null;

                        if ($projectId) {
                            try {
                                $projectData = $rentman->get("/projects/" . $projectId);
                                $project = $projectData['data'] ?? $projectData;
                                $projectName = $project['displayname'] ?? $project['name'] ?? null;
                            } catch (Exception $e) {
                                // Ignorera fel
                            }
                        }
                    }
                } catch (Exception $e) {
                    // Ignorera fel, använd displayname
                }
            }
        }

        $bookings[] = [
            'id' => $assignment['id'],
            'projectId' => $projectId ? (int)$projectId : null,
            'projectName' => $projectName ?? $roleName,
            'start' => $assignmentStart,
            'end' => $assignmentEnd,
            'role' => $roleName,
            'remark' => $assignment['remark'] ?? null,
            'visible' => $assignment['visible'] ?? true,
        ];
    }

    // Sortera efter startdatum
    usort($bookings, fn($a, $b) => strcmp($a['start'] ?? '', $b['start'] ?? ''));

    $response->json([
        'data' => $bookings,
        'count' => count($bookings),
        'crewId' => (int)$id,
        'period' => ['startDate' => $startDate, 'endDate' => $endDate],
    ]);
}

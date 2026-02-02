<?php
/**
 * Debug Endpoint - Testa Rentman API struktur
 * 
 * GET /api/debug?type=status - Lista alla statusar
 * GET /api/debug?type=project&id=XXX - Visa ett projekt med alla fält
 * GET /api/debug?type=vehicles - Visa fordon
 */

function handleDebugEndpoint(RentmanClient $rentman, ApiResponse $response): void
{
    $type = $_GET['type'] ?? 'status';
    $id = $_GET['id'] ?? null;
    
    try {
        switch ($type) {
            case 'status':
                // Hämta alla statusar
                $data = $rentman->fetchAllPages('/status', [], 100);
                $response->json([
                    'type' => 'status',
                    'count' => count($data),
                    'data' => $data,
                ]);
                break;
                
            case 'project':
                if (!$id) {
                    // Hämta första projektet med alla fält
                    $projects = $rentman->get('/projects', ['limit' => 1]);
                    $data = $projects['data'][0] ?? null;
                } else {
                    $data = $rentman->get("/projects/$id");
                    $data = $data['data'] ?? $data;
                }
                $response->json([
                    'type' => 'project',
                    'all_fields' => $data ? array_keys($data) : [],
                    'data' => $data,
                ]);
                break;
                
            case 'vehicles':
                // Hämta fordon
                $data = $rentman->fetchAllPages('/vehicles', [], 50);
                $response->json([
                    'type' => 'vehicles',
                    'count' => count($data),
                    'sample_fields' => !empty($data) ? array_keys($data[0]) : [],
                    'data' => array_slice($data, 0, 3), // Visa bara 3 första
                ]);
                break;
                
            case 'projectvehicle':
                // Hämta projektfordon
                $data = $rentman->fetchAllPages('/projectvehicles', [], 50);
                $response->json([
                    'type' => 'projectvehicles',
                    'count' => count($data),
                    'sample_fields' => !empty($data) ? array_keys($data[0]) : [],
                    'data' => array_slice($data, 0, 5),
                ]);
                break;
                
            case 'projecttypes':
                // Hämta projekttyper
                $data = $rentman->fetchAllPages('/projecttypes', [], 100);
                $response->json([
                    'type' => 'projecttypes',
                    'count' => count($data),
                    'data' => $data,
                ]);
                break;
                
            case 'projectfunction':
                // Hämta en specifik projektfunktion
                if (!$id) {
                    $response->badRequest("id parameter required for projectfunction");
                    return;
                }
                $data = $rentman->get("/projectfunctions/$id");
                $response->json([
                    'type' => 'projectfunction',
                    'all_fields' => $data['data'] ? array_keys($data['data']) : [],
                    'data' => $data['data'] ?? $data,
                ]);
                break;
                
            default:
                $response->badRequest("Unknown type: $type. Use: status, project, vehicles, projectvehicle, projecttypes");
        }
    } catch (Exception $e) {
        $response->error("API Error: " . $e->getMessage(), 500);
    }
}

# Test API Endpoints and Show Logs
Write-Host "=== Testing POS Coffee API ===" -ForegroundColor Green
Write-Host ""

$baseUrl = "http://localhost:5000"

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/test" -Method GET
    Write-Host "✓ Success:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 2: Login (with correct credentials)
Write-Host "Test 2: Login - Correct Credentials" -ForegroundColor Yellow
try {
    $body = @{
        username = "admin"
        pin = "123456"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/cashiers/login" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Success:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 3: Login (with wrong credentials)
Write-Host "Test 3: Login - Wrong Credentials" -ForegroundColor Yellow
try {
    $body = @{
        username = "admin"
        pin = "wrong"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$baseUrl/api/cashiers/login" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Success:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "✗ Expected error:" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host $responseBody
    } else {
        Write-Host $_.Exception.Message
    }
}
Write-Host ""

# Test 4: Get Menu
Write-Host "Test 4: Get Menu" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/menu" -Method GET
    Write-Host "✓ Success - Found $($response.Count) menu items" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Green

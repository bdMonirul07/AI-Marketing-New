
$API_KEY = "AIzaSyCA_HvUhWSJPM2D0pHAa5mBii79kJlG97E"
$URL = "https://generativelanguage.googleapis.com/v1beta/models?key=$API_KEY"

try {
    $Response = Invoke-RestMethod -Uri $URL -Method Get
    Write-Host "--- Available Models ---"
    $Response.models | ForEach-Object { $_.name }
    Write-Host "------------------------"
    Write-Host "SUCCESS: Connection established, showing available models."
} catch {
    Write-Host "--- API Error ---"
    $ErrorMessage = $_.Exception.Message
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $ErrorMessage = $Reader.ReadToEnd()
    }
    Write-Host $ErrorMessage
    Write-Host "-----------------"
    Write-Host "FAILURE: Could not connect to the API."
}


$API_KEY = "AIzaSyCv7TQawHO0eB4y87hhji6QZYvn-O1PtoI"
$URL = "https://generativelanguage.googleapis.com/v1beta/models?key=$API_KEY"

try {
    $Response = Invoke-RestMethod -Uri $URL -Method Get
    Write-Host "--- Available Models for New Key ---"
    $Response.models | ForEach-Object { $_.name }
    Write-Host "------------------------"
    Write-Host "SUCCESS: Connection established."
} catch {
    Write-Host "--- API Error ---"
    $ErrorMessage = $_.Exception.Message
    if ($_.Exception.Response) {
        $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $ErrorMessage = $Reader.ReadToEnd()
    }
    Write-Host $ErrorMessage
    Write-Host "-----------------"
}

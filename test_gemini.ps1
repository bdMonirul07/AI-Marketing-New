
$API_KEY = "AIzaSyCv7TQawHO0eB4y87hhji6QZYvn-O1PtoI"
$URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=$API_KEY"

$Body = @{
    contents = @(
        @{
            parts = @(
                @{ text = "Hello Gemini, are you working? Please respond with a short confirmation." }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $Response = Invoke-RestMethod -Uri $URL -Method Post -ContentType "application/json" -Body $Body
    Write-Host "--- API Response ---"
    $Response.candidates[0].content.parts[0].text
    Write-Host "--------------------"
    Write-Host "SUCCESS: The API key is working with gemini-pro-latest!"
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

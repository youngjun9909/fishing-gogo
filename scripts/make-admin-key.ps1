# ADMIN_KEY로 쓸 무작위 문자열을 만들어 화면에 보여 주고 클립보드에 복사한다(파일로는 저장하지 않는다)
$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').Replace('=','')
Set-Clipboard -Value $key
Write-Host "만든 값 (클립보드에도 복사됨): $key"
Write-Host "Render > 서버 > Environment 에 ADMIN_KEY 이름으로 붙여넣고 저장하세요. 채팅에는 붙여넣지 마세요."

$ErrorActionPreference = 'Stop'
try {
  [Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
  [Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
  Add-Type -AssemblyName PresentationFramework
  $request = ConvertFrom-Json ([Console]::In.ReadToEnd())
  if ($request.username -notin @('momor1n', 'pic.pilot')) { exit 1 }
  [xml]$markup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="ABC MSA | Penyiapan akun lokal" SizeToContent="WidthAndHeight" WindowStartupLocation="CenterScreen" ResizeMode="NoResize" Topmost="True">
  <StackPanel Margin="24" Width="420">
    <TextBlock Name="Account" FontSize="20" FontWeight="Bold" Margin="0,0,0,16"/>
    <TextBlock Text="Hanya akun fiktif pada run launcher ini. Kata sandi tidak disimpan ke berkas. Stop menghapus konteks akun; restart memerlukan setup baru." TextWrapping="Wrap" Margin="0,0,0,16"/>
    <StackPanel Name="CurrentPanel"><TextBlock Text="Kata sandi saat ini"/><PasswordBox Name="Current" MaxLength="128" Height="36" Margin="0,4,0,12"/></StackPanel>
    <TextBlock Text="Kata sandi baru (12-128 karakter)"/><PasswordBox Name="Password" MaxLength="128" Height="36" Margin="0,4,0,12"/>
    <TextBlock Text="Ulangi kata sandi baru"/><PasswordBox Name="Confirm" MaxLength="128" Height="36" Margin="0,4,0,12"/>
    <TextBlock Name="Feedback" TextWrapping="Wrap" Margin="0,0,0,12"/>
    <Button Name="Save" Content="Simpan kata sandi" Height="44" IsDefault="True"/>
    <Button Content="Batal" Height="44" Margin="0,8,0,0" IsCancel="True"/>
  </StackPanel>
</Window>
'@
  $window = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $markup))
  $window.FindName('Account').Text = 'Akun pilot: ' + $request.username
  if (-not $request.established) { $window.FindName('CurrentPanel').Visibility = 'Collapsed' }
  $window.FindName('Save').Add_Click({
    $password = $window.FindName('Password').Password
    if ($password.Length -lt 12 -or $password -cne $window.FindName('Confirm').Password) {
      $window.FindName('Feedback').Text = 'Kata sandi harus 12-128 karakter dan kedua isian baru harus sama.'
      return
    }
    if ($request.established -and -not $window.FindName('Current').Password) {
      $window.FindName('Feedback').Text = 'Isi kata sandi saat ini.'
      return
    }
    $window.DialogResult = $true
  })
  $window.Add_ContentRendered({
    if ($request.established) { [void]$window.FindName('Current').Focus() }
    else { [void]$window.FindName('Password').Focus() }
  })
  if ($window.ShowDialog()) {
    # stdout is an owned anonymous pipe read only by the launcher. Never log it.
    [Console]::Out.Write((@{password=$window.FindName('Password').Password;currentPassword=$window.FindName('Current').Password} | ConvertTo-Json -Compress))
  } else { [Console]::Out.Write('{"cancelled":true}') }
} catch { exit 1 }

; Clipped: 動画ファイルの右クリックメニュー登録/解除
; HKCUのみ使用(管理者権限不要、per-userインストールに対応)

!include "LogicLib.nsh"

!macro CLIPPED_ADD_MENU EXT
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\Clipped" "" "$R9"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\Clipped" "Icon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\""
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\Clipped\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
!macroend

!macro CLIPPED_REMOVE_MENU EXT
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\Clipped"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; インストーラの言語が日本語(1041)ならメニューも日本語にする
  ${If} $LANGUAGE = 1041
    StrCpy $R9 "Clippedで編集"
  ${Else}
    StrCpy $R9 "Edit with Clipped"
  ${EndIf}

  !insertmacro CLIPPED_ADD_MENU ".mp4"
  !insertmacro CLIPPED_ADD_MENU ".mkv"
  !insertmacro CLIPPED_ADD_MENU ".mov"
  !insertmacro CLIPPED_ADD_MENU ".webm"
  !insertmacro CLIPPED_ADD_MENU ".avi"
  !insertmacro CLIPPED_ADD_MENU ".ts"
  !insertmacro CLIPPED_ADD_MENU ".m4v"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro CLIPPED_REMOVE_MENU ".mp4"
  !insertmacro CLIPPED_REMOVE_MENU ".mkv"
  !insertmacro CLIPPED_REMOVE_MENU ".mov"
  !insertmacro CLIPPED_REMOVE_MENU ".webm"
  !insertmacro CLIPPED_REMOVE_MENU ".avi"
  !insertmacro CLIPPED_REMOVE_MENU ".ts"
  !insertmacro CLIPPED_REMOVE_MENU ".m4v"
!macroend

// Base UI 시트와 모달이 열려 있으면 전역 단축키가 편집 중인 작업을 가로채지 않는다.
export function hasOpenDialog() {
  return !!document.querySelector(
    '[role="dialog"][data-open], [role="alertdialog"][data-open]'
  )
}

import { subscribeSaveStatus } from "../state/persistence.js";

const MESSAGES = {
  unavailable: ["진행 상황을 저장하지 못했습니다", "브라우저의 저장 공간과 사이트 데이터 설정을 확인해 주세요. 저장될 때까지 새로고침하거나 창을 닫으면 최근 진행을 잃을 수 있습니다."],
  corrupt: ["저장 기록을 읽을 수 없습니다", "기존 기록을 보호하기 위해 게임 시작과 덮어쓰기를 중지했습니다. 사이트 데이터를 지우지 말고 복구를 확인해 주세요."],
  unsupported: ["이 버전에서 열 수 없는 저장 기록입니다", "기존 기록은 그대로 보존했습니다. 최신 게임으로 다시 열어 주세요."],
  conflict: ["다른 화면에서 저장 기록이 변경되었습니다", "이 화면의 최근 변경은 저장되지 않았습니다. 다른 게임 탭을 닫고 저장된 기록을 다시 불러와 주세요."],
};

export function mountSaveNotice({ initial, retry }) {
  const notice = document.createElement("aside");
  notice.id = "save-notice";
  notice.className = "save-notice";
  notice.hidden = true;
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  const title = document.createElement("strong");
  const description = document.createElement("p");
  const button = document.createElement("button");
  button.type = "button";
  let reload = false;
  button.addEventListener("click", () => reload ? window.location.reload() : retry());
  notice.append(title, description, button);
  document.body.append(notice);
  // A native modal is above body content; keep the notice reachable there too.
  const placeNotice = () => {
    const parent = document.querySelector("dialog[open]") || document.body;
    if (notice.parentNode !== parent) parent.append(notice);
  };
  new MutationObserver(placeNotice).observe(document.body, {
    subtree: true, attributes: true, attributeFilter: ["open"],
  });
  function show(result, startup = false) {
    notice.hidden = result.ok;
    if (result.ok) return;
    const message = MESSAGES[result.reason] || MESSAGES.unavailable;
    title.textContent = message[0];
    description.textContent = startup && result.reason === "unavailable"
      ? "저장 기록에 접근할 수 없어 게임 시작을 멈췄습니다. 브라우저의 사이트 데이터 설정을 확인한 뒤 다시 불러와 주세요."
      : message[1];
    reload = startup || result.reason !== "unavailable";
    button.textContent = reload ? "다시 불러오기" : "저장 다시 시도";
    notice.classList.toggle("save-notice-blocked", startup);
    placeNotice();
  }
  subscribeSaveStatus(show);
  if (initial) show(initial, true);
}

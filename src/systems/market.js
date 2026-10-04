import { rollItem } from "./items.js";
import { itemGoldValue, INVENTORY_CAPACITY } from "./inventory.js";
const fail = (message) => ({ ok: false, message }),
  ok = (message) => ({ ok: true, message });
let sequence = 0;
const uid = () =>
  `market_${Date.now()}_${sequence++}_${Math.floor(Math.random() * 1e6)}`;
const priceOf = (item) =>
  Math.max(
    5,
    itemGoldValue(item) +
      Math.round(Object.values(item.statBonus).reduce((a, b) => a + b, 0) * 2),
  );
function deliver(state, item, message) {
  state.market.deliveries.push({ id: uid(), item, message });
}
function log(state, message) {
  state.market.history.unshift(message);
  state.market.history = state.market.history.slice(0, 12);
}
export function ensureMarket(state, now = Date.now()) {
  const m = state.market;
  let changed = false;
  if (!m.refreshedAt || now - m.refreshedAt >= 300000) {
    changed = true;
    m.refreshedAt = now;
    m.stock = ["weapon", "armor", "charm"].map((slot, index) => {
      const item = rollItem(Math.random, {
        grade: index === 2 ? "rare" : "magic",
        slot,
        identified: true,
      });
      return { id: uid(), item, price: priceOf(item) * 3 };
    });
  }
  if (!m.auctions.some((a) => a.seller === "npc" && a.status === "open")) {
    changed = true;
    for (let i = 0; i < 2; i++) {
      const item = rollItem(Math.random, {
        grade: i ? "epic" : "rare",
        identified: true,
      });
      const base = priceOf(item);
      m.auctions.push({
        id: uid(),
        item,
        seller: "npc",
        status: "open",
        bid: base,
        buyout: base * 4,
        highest: null,
        escrow: 0,
        npcLimit: Math.floor(base * (1.3 + Math.random())),
        endAt: now + 90000 + i * 15000,
        nextNpcAt: now + 15000,
      });
    }
  }
  return changed;
}
export function tickMarket(state, now = Date.now()) {
  let changed = false;
  for (const auction of state.market.auctions) {
    if (auction.status !== "open") continue;
    // Replay a scheduled rival bid before expiry even after a closed-tab interval.
    if (now >= auction.nextNpcAt && auction.nextNpcAt < auction.endAt) {
      auction.nextNpcAt = now + 15000;
      if (
        auction.seller === "player" &&
        !auction.highest &&
        auction.bid <= auction.npcLimit
      ) {
        auction.highest = "npc";
        changed = true;
      } else if (
        auction.seller === "npc" &&
        auction.highest === "player" &&
        auction.bid + 5 <= auction.npcLimit
      ) {
        state.currency.gold += auction.escrow;
        auction.escrow = 0;
        auction.highest = "npc";
        auction.bid += 5;
        log(state, "NPC 경쟁 입찰 · 예치금을 전액 돌려받았습니다.");
        changed = true;
      }
    }
    if (now >= auction.endAt) {
      if (auction.seller === "player") {
        if (auction.highest === "npc") {
          const proceeds = Math.floor(auction.bid * 0.95);
          state.currency.gold += proceeds;
          log(
            state,
            `${auction.item.name} 낙찰 · 수수료 5% 제외 ${proceeds}G 입금`,
          );
        } else deliver(state, auction.item, "유찰 장비 반환");
      } else if (auction.highest === "player") {
        deliver(state, auction.item, "경매 낙찰품");
        auction.escrow = 0;
        log(state, `${auction.item.name} 낙찰 · 보관함에서 수령하세요.`);
      }
      auction.status = "closed";
      changed = true;
      continue;
    }
  }
  state.market.auctions = state.market.auctions.filter(
    (a) => a.status === "open",
  );
  return changed;
}
export function buyStock(state, id) {
  const index = state.market.stock.findIndex((x) => x.id === id);
  if (index < 0) return fail("이미 판매된 상품입니다.");
  const offer = state.market.stock[index];
  if (state.inventory.length >= INVENTORY_CAPACITY)
    return fail("인벤토리 공간을 비워주세요.");
  if (state.currency.gold < offer.price) return fail("골드가 부족합니다.");
  state.currency.gold -= offer.price;
  state.inventory.push(offer.item);
  state.market.stock.splice(index, 1);
  return ok("상품을 인벤토리에 보관했습니다.");
}
export function buyRune(state, rune) {
  if (!["ember", "frost", "ward"].includes(rune)) return fail("없는 룬입니다.");
  if (state.currency.gold < 30) return fail("30G가 필요합니다.");
  state.currency.gold -= 30;
  state.materials[rune]++;
  return ok("룬 1개를 구매했습니다.");
}
export function sellItem(state, id) {
  const index = state.inventory.findIndex((i) => i.id === id);
  if (index < 0) return fail("매각할 장비가 없습니다.");
  const [item] = state.inventory.splice(index, 1),
    price = priceOf(item);
  state.currency.gold += price;
  state.market.buyback.unshift({ id: uid(), item, price });
  state.market.buyback = state.market.buyback.slice(0, 10);
  return ok(`${price}G에 판매했습니다. 최근 10개는 되살 수 있습니다.`);
}
export function buyBack(state, id) {
  const index = state.market.buyback.findIndex((x) => x.id === id);
  if (index < 0) return fail("되살 수 없는 장비입니다.");
  const offer = state.market.buyback[index];
  if (state.inventory.length >= INVENTORY_CAPACITY)
    return fail("인벤토리 공간을 비워주세요.");
  if (state.currency.gold < offer.price) return fail("골드가 부족합니다.");
  state.currency.gold -= offer.price;
  state.inventory.push(offer.item);
  state.market.buyback.splice(index, 1);
  return ok("매각한 장비를 되샀습니다.");
}
export function bidAuction(state, id, buyout = false, now = Date.now()) {
  tickMarket(state, now);
  const auction = state.market.auctions.find(
    (a) => a.id === id && a.status === "open",
  );
  if (!auction || auction.seller === "player")
    return fail("입찰할 수 없는 경매입니다.");
  const price = buyout
      ? auction.buyout
      : Math.min(auction.buyout, auction.bid + 5),
    cost = price - auction.escrow;
  if (state.currency.gold < cost) return fail("입찰할 골드가 부족합니다.");
  state.currency.gold -= cost;
  auction.bid = price;
  auction.escrow = price;
  auction.highest = "player";
  if (buyout || price === auction.buyout) {
    auction.endAt = now;
    tickMarket(state, now);
    return ok("즉시 구매 완료 · 낙찰 보관함에서 수령하세요.");
  }
  return ok(`${price}G를 예치했습니다. NPC가 경쟁 입찰할 수 있습니다.`);
}
export function listAuction(state, id, multiplier = 2, now = Date.now()) {
  const index = state.inventory.findIndex((i) => i.id === id);
  if (index < 0 || state.inventory[index].identified === false)
    return fail("감정된 인벤토리 장비만 출품할 수 있습니다.");
  if (state.market.auctions.filter((a) => a.seller === "player").length >= 3)
    return fail("동시 출품은 3개까지입니다.");
  if (![1, 2, 3].includes(multiplier)) return fail("잘못된 시작가입니다.");
  if (state.currency.gold < 5) return fail("출품비 5G가 필요합니다.");
  const [item] = state.inventory.splice(index, 1);
  state.currency.gold -= 5;
  const base = priceOf(item);
  state.market.auctions.push({
    id: uid(),
    item,
    seller: "player",
    status: "open",
    bid: base * multiplier,
    highest: null,
    escrow: 0,
    npcLimit: Math.floor(base * (1.5 + Math.random())),
    endAt: now + 90000,
    nextNpcAt: now + 15000,
  });
  return ok("90초 NPC 경매에 출품했습니다. 출품비 5G · 낙찰 수수료 5%.");
}
export function cancelAuction(state, id, now = Date.now()) {
  tickMarket(state, now);
  const index = state.market.auctions.findIndex(
    (a) => a.id === id && a.seller === "player",
  );
  if (index < 0) return fail("취소할 출품이 없습니다.");
  const auction = state.market.auctions[index];
  if (auction.highest) return fail("입찰자가 있어 취소할 수 없습니다.");
  deliver(state, auction.item, "취소 장비 반환");
  state.market.auctions.splice(index, 1);
  return ok(
    "출품을 취소했습니다. 보관함에서 수령하세요. 출품비는 반환되지 않습니다.",
  );
}
export function claimDelivery(state, id) {
  const index = state.market.deliveries.findIndex((x) => x.id === id);
  if (index < 0) return fail("이미 수령한 장비입니다.");
  if (state.inventory.length >= INVENTORY_CAPACITY)
    return fail("가방이 가득 찼습니다. 보관함의 장비는 유지됩니다.");
  state.inventory.push(state.market.deliveries[index].item);
  state.market.deliveries.splice(index, 1);
  return ok("장비를 수령했습니다.");
}

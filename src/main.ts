import "./style.css";
import { BASE, t } from "./i18n";

/* ---------- Twitch embed typings (loaded from player.twitch.tv/js/embed/v1.js) ---------- */
interface TwitchPlayer {
  setMuted(muted: boolean): void;
  setQuality(quality: string): void;
  play(): void;
  pause(): void;
  addEventListener(event: string, cb: () => void): void;
}
interface TwitchPlayerOptions {
  channel: string;
  parent: string[];
  muted: boolean;
  autoplay: boolean;
  width: string;
  height: string;
  controls?: boolean;
}
type TwitchGlobal = {
  Player: {
    new (id: string, options: TwitchPlayerOptions): TwitchPlayer;
  };
};
declare global {
  interface Window { Twitch?: TwitchGlobal }
}

/* ---------- state ---------- */
const MIN_SLOTS = 2;
const MAX_SLOTS = 9;
const ZEVENT_MODE = /^\/(fr\/)?zevent\/?$/.test(location.pathname);
const ZEVENT_SLOTS = 9;
const STORE_KEY = ZEVENT_MODE ? "multiview.zevent.v1" : "multiview.state.v1";
const HOST = location.hostname || "localhost";

type State = { channels: string[]; main: number; mutedAll: boolean };

const el = <T extends HTMLElement>(sel: string): T => {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`missing element: ${sel}`);
  return node;
};

const clean = (name: string): string =>
  name.trim().replace(/^.*twitch\.tv\//i, "").replace(/[^A-Za-z0-9_]/g, "").toLowerCase();

function readStored(): State | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    if (!Array.isArray(rec.channels)) return null;
    const channels = rec.channels.filter((c): c is string => typeof c === "string").map(clean).filter(Boolean);
    if (channels.length < MIN_SLOTS) return null;
    return {
      channels: channels.slice(0, MAX_SLOTS),
      main: typeof rec.main === "number" ? rec.main : 0,
      mutedAll: rec.mutedAll === true,
    };
  } catch {
    return null;
  }
}

/* multitwitch-style paths (/a/b/c or /fr/a/b/c) are read like ?c=a,b,c */
function pathChannels(): string[] {
  const rest = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : "";
  return rest.split("/").map(clean).filter(Boolean);
}

function readUrl(): State | null {
  if (ZEVENT_MODE) return null;
  const params = new URLSearchParams(location.search);
  const c = params.get("c");
  const list = c ? c.split(",") : pathChannels();
  if (list.length === 0) return null;
  const channels = list.map(clean).filter(Boolean).slice(0, MAX_SLOTS);
  if (channels.length < 1) return null;
  const slot = Number(params.get("m") ?? "1");
  return {
    channels,
    main: Number.isFinite(slot) ? slot - 1 : 0,
    mutedAll: params.get("mute") === "1",
  };
}

let state: State = { channels: [], main: 0, mutedAll: false };

function persist(): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  const params = new URLSearchParams();
  if (!ZEVENT_MODE) params.set("c", state.channels.join(","));
  params.set("m", String(state.main + 1));
  if (state.mutedAll) params.set("mute", "1");
  const path = ZEVENT_MODE ? location.pathname : BASE;
  history.replaceState(null, "", `${path}?${params.toString()}`);
  syncLangLink();
}

/* the EN/FR link keeps the current channels so a switch never loses the setup */
const langLink = document.getElementById("lang-link") as HTMLAnchorElement | null;
function syncLangLink(): void {
  if (!langLink) return;
  const url = new URL(langLink.href, location.origin);
  url.search = location.search;
  langLink.href = url.pathname + url.search;
}
syncLangLink();

/* ---------- stage ---------- */
const stage = el<HTMLElement>("#stage");
const muteAllBtn = el<HTMLButtonElement>("#mute-all");
const players = new Map<string, TwitchPlayer>();
const tiles: HTMLElement[] = [];
let chatBox: HTMLElement | null = null;

function buildStage(): void {
  stage.replaceChildren();
  tiles.length = 0;
  players.clear();

  state.channels.forEach((channel, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.slot = String(i);
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", t.slot(i + 1, channel));

    const screen = document.createElement("div");
    screen.className = "screen";
    screen.id = `screen-${i}`;

    const label = document.createElement("div");
    label.className = "label";
    label.innerHTML =
      `<span class="label-num">${i + 1}</span>` +
      `<span class="label-name"></span>` +
      `<span class="label-count"></span>` +
      `<span class="label-tag"></span>`;
    label.querySelector<HTMLElement>(".label-name")!.textContent = channel;
    const count = label.querySelector<HTMLElement>(".label-count");
    if (count) count.textContent = ZEVENT_MODE ? (zeventCounts.get(channel) ?? "") : "";

    tile.append(screen, label);
    stage.append(tile);
    tiles.push(tile);

    const activate = (): void => selectSlot(i);
    label.addEventListener("click", activate);
    tile.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });

  chatBox = document.createElement("aside");
  chatBox.id = "chat";
  stage.append(chatBox);

  const status = document.createElement("div");
  status.id = "status";
  status.innerHTML = `<div class="clock" id="clock">--:--:--</div><div class="status-line" id="status-line"></div>`;
  stage.append(status);

  stage.style.setProperty("--sides", String(Math.max(1, state.channels.length - 1)));
  mountPlayers();
  applyLayout();
}

function mountPlayers(): void {
  const Twitch = window.Twitch;
  if (!Twitch) {
    window.setTimeout(mountPlayers, 250);
    return;
  }
  state.channels.forEach((channel, i) => {
    if (players.has(channel + i)) return;
    const player = new Twitch.Player(`screen-${i}`, {
      channel,
      parent: [HOST],
      muted: true,
      autoplay: false,
      width: "100%",
      height: "100%",
    });
    players.set(channel + i, player);

  });
  applyAudio();
}

function applyLayout(): void {
  tiles.forEach((tile, i) => {
    const isMain = i === state.main;
    tile.classList.toggle("is-main", isMain);
    tile.classList.toggle("is-side", !isMain);
    const tag = tile.querySelector<HTMLElement>(".label-tag");
    if (tag) tag.textContent = isMain ? "PGM" : "";
  });
  renderChat();
  renderStatus();
}

function applyAudio(): void {
  state.channels.forEach((channel, i) => {
    const player = players.get(channel + i);
    if (!player) return;
    player.setMuted(state.mutedAll || i !== state.main);
    player.setQuality("auto");
  });
  muteAllBtn.setAttribute("aria-pressed", String(state.mutedAll));
  muteAllBtn.textContent = state.mutedAll ? t.audioOff : t.audioOn;
}

/* the chat iframe is the only element allowed to be recreated on a switch */
function renderChat(): void {
  if (!chatBox) return;
  const channel = state.channels[state.main];
  if (!channel) return;
  if (chatBox.dataset.channel === channel) return;
  chatBox.dataset.channel = channel;
  const frame = document.createElement("iframe");
  frame.src = `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?parent=${encodeURIComponent(HOST)}&darkpopout`;
  frame.title = t.chat(channel);
  chatBox.replaceChildren(frame);
}

function renderStatus(): void {
  const line = document.getElementById("status-line");
  if (line) line.textContent = t.status(state.channels.length, state.main + 1);
}

function tickClock(): void {
  const clock = document.getElementById("clock");
  if (clock) clock.textContent = new Date().toTimeString().slice(0, 8);
}
window.setInterval(tickClock, 1000);

function selectSlot(index: number): void {
  if (index < 0 || index >= state.channels.length || index === state.main) return;
  state.main = index;
  applyLayout();
  applyAudio();
  persist();
}

/* ---------- zevent mode ---------- */
interface ZeventEntry {
  twitch: unknown;
  online: unknown;
  viewersAmount?: { number?: unknown; formatted?: unknown };
}

const zeventCounts = new Map<string, string>();
const zeventBadge = el<HTMLElement>("#zevent-badge");
const zeventRefreshBtn = el<HTMLButtonElement>("#zevent-refresh");
const zeventUpdated = el<HTMLElement>("#zevent-updated");
const zeventError = el<HTMLElement>("#zevent-error");
const editBtn = el<HTMLButtonElement>("#edit");
const modeLink = el<HTMLAnchorElement>("#mode-link");

type ZeventFeed = { channels: string[]; counts: Map<string, string> };

async function fetchZevent(): Promise<ZeventFeed> {
  const res = await fetch("/api/zevent", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`zevent api ${res.status}`);
  const body: unknown = await res.json();
  const live = (body as { live?: unknown } | null)?.live;
  if (!Array.isArray(live)) throw new Error("zevent api: unexpected payload");

  const rows = (live as ZeventEntry[])
    .filter((e) => e && e.online === true && typeof e.twitch === "string")
    .map((e) => ({
      login: clean(e.twitch as string),
      viewers: typeof e.viewersAmount?.number === "number" ? e.viewersAmount.number : 0,
      formatted:
        typeof e.viewersAmount?.formatted === "string"
          ? e.viewersAmount.formatted
          : String(typeof e.viewersAmount?.number === "number" ? e.viewersAmount.number : ""),
    }))
    .filter((r) => r.login);

  rows.sort((a, b) => b.viewers - a.viewers);

  const counts = new Map<string, string>();
  const channels: string[] = [];
  for (const row of rows) {
    if (channels.includes(row.login)) continue;
    channels.push(row.login);
    counts.set(row.login, row.formatted);
    if (channels.length >= ZEVENT_SLOTS) break;
  }
  if (channels.length === 0) throw new Error("zevent api: nobody live");
  return { channels, counts };
}

function setZeventError(message: string | null): void {
  zeventError.textContent = message ?? "";
  zeventError.hidden = message === null;
}

function stampZeventUpdate(): void {
  zeventUpdated.hidden = false;
  zeventUpdated.textContent = t.updated(new Date().toTimeString().slice(0, 8));
}

let flashTimer = 0;
function flashRefreshLabel(text: string): void {
  window.clearTimeout(flashTimer);
  zeventRefreshBtn.textContent = text;
  flashTimer = window.setTimeout(() => {
    zeventRefreshBtn.textContent = t.refresh;
  }, 1500);
}

async function loadZevent(isRefresh: boolean): Promise<void> {
  zeventRefreshBtn.disabled = true;
  try {
    const feed = await fetchZevent();
    setZeventError(null);
    const unchanged = feed.channels.join(",") === state.channels.join(",");
    zeventCounts.clear();
    feed.counts.forEach((v, k) => zeventCounts.set(k, v));
    stampZeventUpdate();

    if (unchanged && isRefresh) {
      flashRefreshLabel(t.upToDate);
      return;
    }

    // keep the persisted program slot only if that channel is still at the same index
    const previous = state.channels[state.main];
    const main = previous && feed.channels[state.main] === previous ? state.main : 0;
    state = { channels: feed.channels, main, mutedAll: state.mutedAll };
    persist();
    buildStage();
    tickClock();
  } catch (err) {
    console.error(err);
    setZeventError(t.unreachable);
    if (isRefresh) flashRefreshLabel(t.failed);
  } finally {
    zeventRefreshBtn.disabled = false;
  }
}

if (ZEVENT_MODE) {
  zeventBadge.hidden = false;
  zeventRefreshBtn.hidden = false;
  editBtn.hidden = true;
  modeLink.href = BASE;
  modeLink.textContent = t.manual;
  zeventRefreshBtn.addEventListener("click", () => void loadZevent(true));
}

/* ---------- setup screen ---------- */
const setup = el<HTMLElement>("#setup");
const setupForm = el<HTMLFormElement>("#setup-form");
const slotsBox = el<HTMLElement>("#slots");
const slotCount = el<HTMLElement>("#slot-count");
const setupError = el<HTMLElement>("#setup-error");
const cancelBtn = el<HTMLButtonElement>("#setup-cancel");

function slotInputs(): HTMLInputElement[] {
  return Array.from(slotsBox.querySelectorAll<HTMLInputElement>("input"));
}

function addSlot(value = ""): void {
  if (slotInputs().length >= MAX_SLOTS) return;
  const row = document.createElement("div");
  row.className = "slot";
  const num = document.createElement("span");
  num.className = "slot-num";
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.spellcheck = false;
  input.autocapitalize = "off";
  input.placeholder = t.placeholder;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "slot-del";
  del.textContent = "×";
  del.title = t.removeSlot;
  del.addEventListener("click", () => {
    if (slotInputs().length <= MIN_SLOTS) return;
    row.remove();
    renumber();
  });
  row.append(num, input, del);
  slotsBox.append(row);
  renumber();
}

function renumber(): void {
  const rows = Array.from(slotsBox.children);
  rows.forEach((row, i) => {
    const num = row.querySelector(".slot-num");
    if (num) num.textContent = String(i + 1);
  });
  slotCount.textContent = t.slotCount(rows.length, MAX_SLOTS);
}

function openSetup(): void {
  slotsBox.replaceChildren();
  setupError.textContent = "";
  const seed = state.channels.length >= MIN_SLOTS ? state.channels : ["", "", "", ""];
  seed.forEach((c) => addSlot(c));
  cancelBtn.hidden = state.channels.length < MIN_SLOTS;
  setup.hidden = false;
  slotInputs()[0]?.focus();
}

function closeSetup(): void {
  setup.hidden = true;
}

el<HTMLButtonElement>("#add-slot").addEventListener("click", () => addSlot());
el<HTMLButtonElement>("#edit").addEventListener("click", openSetup);
cancelBtn.addEventListener("click", closeSetup);

setupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const channels = slotInputs().map((i) => clean(i.value)).filter(Boolean);
  if (channels.length < MIN_SLOTS) {
    setupError.textContent = t.minChannels(MIN_SLOTS);
    return;
  }
  const changed = channels.join(",") !== state.channels.join(",");
  state = { channels, main: Math.min(state.main, channels.length - 1), mutedAll: state.mutedAll };
  persist();
  closeSetup();
  if (changed || tiles.length === 0) buildStage();
});

muteAllBtn.addEventListener("click", () => {
  state.mutedAll = !state.mutedAll;
  applyAudio();
  persist();
});

window.addEventListener("keydown", (e) => {
  if (!setup.hidden) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  if (e.key >= "1" && e.key <= "9") selectSlot(Number(e.key) - 1);
});

/* ---------- boot ---------- */
if (ZEVENT_MODE) {
  const stored = readStored();
  if (stored) state = { channels: [], main: Math.max(stored.main, 0), mutedAll: stored.mutedAll };
  void loadZevent(false);
} else {
const initial = readUrl() ?? readStored();
if (initial && initial.channels.length >= 1) {
  state = {
    channels: initial.channels,
    main: Math.min(Math.max(initial.main, 0), initial.channels.length - 1),
    mutedAll: initial.mutedAll,
  };
  persist();
  buildStage();
  tickClock();
} else {
  openSetup();
}
}

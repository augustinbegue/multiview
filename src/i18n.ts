export type Lang = "en" | "fr";

export const LANG: Lang = document.documentElement.lang === "fr" ? "fr" : "en";
export const BASE = LANG === "fr" ? "/fr/" : "/";

const dict = {
  en: {
    slot: (n: number, channel: string) => `Slot ${n}: ${channel}`,
    audioOn: "audio on",
    audioOff: "audio off",
    chat: (channel: string) => `${channel} chat`,
    status: (n: number, pgm: number) => `${n} SOURCES / PGM ${pgm}`,
    updated: (time: string) => `last updated ${time}`,
    refresh: "refresh channels",
    upToDate: "up to date",
    failed: "failed",
    unreachable: "zevent.fr unreachable",
    minChannels: (n: number) => `Enter at least ${n} channel names.`,
    removeSlot: "Remove slot",
    placeholder: "twitch channel",
    slotCount: (n: number, max: number) => `${n} of ${max} slots`,
    manual: "manual",
  },
  fr: {
    slot: (n: number, channel: string) => `Slot ${n} : ${channel}`,
    audioOn: "audio activé",
    audioOff: "audio coupé",
    chat: (channel: string) => `chat de ${channel}`,
    status: (n: number, pgm: number) => `${n} SOURCES / PGM ${pgm}`,
    updated: (time: string) => `mis à jour ${time}`,
    refresh: "actualiser les chaînes",
    upToDate: "à jour",
    failed: "échec",
    unreachable: "zevent.fr injoignable",
    minChannels: (n: number) => `Entrez au moins ${n} noms de chaînes.`,
    removeSlot: "Retirer le slot",
    placeholder: "chaîne twitch",
    slotCount: (n: number, max: number) => `${n} slots sur ${max}`,
    manual: "manuel",
  },
} as const;

export const t = dict[LANG];

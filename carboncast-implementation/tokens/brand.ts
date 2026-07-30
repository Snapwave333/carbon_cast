export const carbonCastBrand = {
  name: "CarbonCast IPTV",
  tagline: "Stream more. Live better.",
  colors: {
    carbonBlack: "#07090C",
    carbonPanel: "#11161B",
    carbonLifted: "#171E25",
    racingRed: "#E10D1A",
    hotRed: "#FF2233",
    deepRed: "#850912",
    signalOrange: "#FF6A00",
    electricCyan: "#00D8FF",
    paperWhite: "#F4F7FA",
    steel: "#8C98A5",
    border: "#26313C",
  },
  semantic: {
    live: "#E10D1A",
    upcoming: "#FF6A00",
    connected: "#00D8FF",
    focus: "#00D8FF",
  },
} as const;

export type CarbonCastBrand = typeof carbonCastBrand;

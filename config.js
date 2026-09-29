/* ============================================================
   ROYAL WEDDING INVITE — CLIENT CONFIG
   ============================================================ */
window.WEDDING_CONFIG = {

  couple: {
    groom: "Vaibhav",
    bride: "Tonakshi",
    groomFull: "Vaibhav",
    brideFull: "Tonakshi",
    monogram: "V.T",
    tagline: "Two souls, one sacred fire",
  },

  wedding: {
    dateISO: "2026-11-25T12:00:00+05:30",
    dateDisplay: "25–26 November 2026",
    muhurat: "Baraat · Thursday, 26 November · 1:00 PM",
  },

  dressCodes: {
    pink: { theme: "Shades of Pink", palette: "pink-swatches" },
    glitter: { theme: "All That Glitters", palette: "gold-swatches" },
    serene: { theme: "Soft & Serene", palette: "soft-swatches" },
  },

  events: [
    {
      id: "haldi",
      name: "Haldi",
      icon: "haldi",
      date: "Wednesday, 25 November 2026",
      time: "1:00 PM",
      venue: "Nirvana River Resort",
      line: "An afternoon of colour and laughter",
      dressCode: "pink",
      accent: "#A34468",
    },
    {
      id: "sangeet",
      name: "Sangeet / Engagement",
      icon: "sangeet",
      date: "Wednesday, 25 November 2026",
      time: "7:00 PM",
      venue: "Nirvana River Resort",
      line: "Music, cocktails and an evening to sparkle",
      dressCode: "glitter",
      accent: "#5B3A8E",
    },
    {
      id: "baraat",
      name: "Baraat",
      icon: "reception",
      date: "Thursday, 26 November 2026",
      time: "1:00 PM",
      venue: "Nirvana River Resort",
      line: "Join the joyous procession and the groom’s grand arrival",
      dressCode: "serene",
      accent: "#B08A3E",
    },
    {
      id: "varmaala",
      name: "Varmaala",
      icon: "wedding",
      date: "Thursday, 26 November 2026",
      time: "3:30 PM",
      venue: "Nirvana River Resort",
      line: "A beautiful exchange of garlands and promises",
      dressCode: "serene",
      accent: "#D06A78",
    },
    {
      id: "wedding-dinner",
      name: "Wedding Dinner",
      icon: "reception",
      date: "Thursday, 26 November 2026",
      time: "7:00 PM",
      venue: "Nirvana River Resort",
      line: "Raise a toast to love, family and our new beginning",
      dressCode: "serene",
      accent: "#7A1F3D",
    },
  ],

  venue: {
    name: "Nirvana River Resort",
    address: "Rishikesh, Uttarakhand",
    mapsQuery: "Nirvana River Resort, Mohan Chatti, Rishikesh",
    mapsUrl: "https://share.google/W509T9xez5OkFm9Eq",
  },

  rsvp: {
    email: "vaibhavbhatiab94@gmail.com",
    deadline: "20 October 2026",
  },

  theme: {
    maroon: "#6D1A33",
    maroonDeep: "#4A0F22",
    gold: "#C9A24B",
    goldSoft: "#E5C878",
    ivory: "#F4EBDB",
    inkOnIvory: "#3A2230",
  },

  frames: {
    count: 180,
    loPath: "assets/origami-hero/lo/",
    hiPath: "assets/origami-hero/hi/",
    prefix: "o_",
    ext: ".webp",
  },

  sanctum: {
    count: 121,
    path: "assets/frames2/",
    prefix: "s_",
    ext: ".webp",
    heading: "The Hidden Moment",
    eyebrow: "A sacred moment awaits",
    hint: "Scroll gently to unfold this hidden moment",
    veilText: "A sacred moment awaits",
  },
};

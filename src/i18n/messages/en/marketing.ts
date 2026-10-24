import { common } from "./common";

const brand = common.brand.name;

/** English copy: marketing. Source of truth for the shape; es/marketing.ts must match it. */
export const marketing = {
  nav: {
    label: "Page sections",
    howItWorks: "How it works",
    install: "Install",
    features: "Features",
    faq: "FAQ",
  },
  entry: { signIn: "Sign in", openApp: "Open app" },
  hero: {
    title: "Save anything. Find it again.",
    lead: `Drop in links, files and notes. ${brand} sorts them by format and keeps them easy to find.`,
  },
  how: {
    title: "How it works",
    lead: "Three steps from a stray link to something you can find in seconds.",
    steps: [
      {
        title: "Capture in one gesture",
        body: "Paste a link, drop a file or jot a note. It saves at once, with no form to fill in first.",
        example: "Paste a link, drop a PDF or type a note.",
        chips: ["https://…", "report.pdf", "Buy oat milk"],
      },
      {
        title: "Organize without effort",
        body: "Each save is filed by format and enriched with a title, image and thumbnail a moment later.",
        example: "It's filed as Article, PDF or Note.",
        chips: ["Article", "PDF", "Note"],
      },
      {
        title: "Find it again",
        body: "Search, filter by format, tag or status, and open any item for a full preview.",
        example: "Find it with Ctrl+K or by format.",
        chips: ["Ctrl+K", "Format", "Tag"],
      },
    ],
  },
  install: {
    eyebrow: "Install",
    title: "Install the app",
    lead: `${brand} runs in your browser. Add it to your home screen or desktop to open it like any other app.`,
    tabsLabel: "Choose your device",
    installButton: "Install",
    installedNote: "Installed. Open it from your home screen or app list.",
    platforms: {
      android: {
        tab: "Android",
        title: "Android, in Chrome",
        steps: [
          "Open the menu (three dots) in the top corner of Chrome.",
          "Tap Add to home screen, or Install app.",
          "Confirm with Install.",
        ],
      },
      ios: {
        tab: "iPhone and iPad",
        title: "iPhone and iPad, in Safari",
        steps: ["Tap the Share button.", "Scroll down and tap Add to Home Screen.", "Tap Add."],
        note: "On iOS this works from Safari. Other browsers can do it too from iOS 16.4 onwards, through their Share menu.",
      },
      desktop: {
        tab: "Desktop",
        title: "Desktop, in Chrome or Edge",
        steps: [
          "Click the install icon at the right end of the address bar.",
          "Or open the menu, then Cast, save and share, then Install page as app.",
          "Confirm with Install.",
        ],
      },
    },
  },
  features: {
    eyebrow: "Features",
    title: "Organized before you think about it",
    lead: `${brand} looks at every save and files it by format, so your board already makes sense. Collections, tags and smart views are there when you want more.`,
    formatsTitle: "Sorted by format, automatically",
    formatsLabel: "Formats",
    formats: {
      link: "Links",
      article: "Articles",
      video: "Videos",
      image: "Images",
      pdf: "PDFs",
      document: "Documents",
      note: "Notes",
      code: "Code",
    },
    items: {
      capture: {
        title: "Capture from anywhere",
        body: "Paste on the board, drag files and links in from your desktop or another tab, or use quick add. Up to 20 things save in one go.",
      },
      previews: {
        title: "Rich previews",
        body: "Links unfurl into cards with a title, description, image and site name. Images, PDFs and videos get a thumbnail.",
      },
      collections: {
        title: "Collections and tags",
        body: "Give an item one home in a collection with its own emoji and color, and as many tags as you like. Type #tag in a title or note to add one.",
      },
      smartViews: {
        title: "Smart views",
        body: "Save a filter, like unread PDFs tagged #thesis, and it stays in the sidebar, always up to date.",
      },
      drag: {
        title: "Drag to organize",
        body: "Reorder cards by hand, or drag one card or a whole selection onto a collection, a tag, Favorites, Archive or Trash. Works with the keyboard too.",
      },
      layouts: {
        title: "Grid, list or canvas",
        body: "Browse as cards or dense rows, or lay a collection out on its own infinite canvas, where things stay where you put them.",
      },
      drawer: {
        title: "Details in a drawer",
        body: "Open any item for a large preview, an editable title and note, its tags and source. Every drawer has its own link.",
      },
      safety: {
        title: "Nothing lost by accident",
        body: "Mark things read, favorite or archive them. Deleted items wait in Trash for 30 days, and every destructive action can be undone.",
      },
    },
  },
  guest: {
    eyebrow: "Guest mode",
    title: "Try it without an account",
    lead: `One click gives you a private board. Make an account only once ${brand} has earned it.`,
    facts: [
      { term: "No sign-up", detail: "Start saving straight away. No email, no password." },
      {
        term: "Same app",
        detail: "Guests get every feature, with files up to 10 MB each and 25 MB in total.",
      },
      {
        term: "Keep it all",
        detail: "Add your email later and everything you saved stays right where it is.",
      },
    ],
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered",
    items: [
      {
        question: "What can I save?",
        answer:
          "Links, articles, videos, images, PDFs, documents, code and plain-text notes. Anything else is kept as a file.",
      },
      {
        question: "Do I need to organize as I go?",
        answer:
          "No. New saves go to your Inbox and are already grouped by format. Move them into collections or tag them whenever it suits you.",
      },
      {
        question: "Who can see my things?",
        answer:
          "Only you. Each account is for one person, and every item and file is private to the account that saved it.",
      },
      {
        question: "How big can files be?",
        answer:
          "Up to 50 MB per file with an account. Guests can upload files up to 10 MB each and 25 MB in total.",
      },
      {
        question: "What happens to my guest things when I sign up?",
        answer:
          "Nothing moves. Adding your email turns your guest board into a full account, with every item in place.",
      },
      {
        question: "How do I sign in?",
        answer: "With a 6-digit code sent to your email. There is no password to remember.",
      },
    ],
  },
  cta: {
    title: "Your next save is one paste away",
    lead: "Start as a guest, and keep everything when you sign up.",
  },
};

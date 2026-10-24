import { common } from "./common";

const brand = common.brand.name;

/** English copy: the first-visit tour. Source of truth for the shape; es/onboarding.ts must match. */
export const onboarding = {
  skip: "Skip",
  back: "Back",
  next: "Next",
  finish: "Finish",
  addEmail: "Add email",
  progress: (step: number, total: number) => `Step ${step} of ${total}`,
  showTour: "Show the tour",
  steps: {
    welcome: {
      title: `Welcome to ${brand}`,
      body: `${brand} keeps links, files and notes for later. Everything you save is sorted by format automatically.`,
    },
    capture: {
      title: "Save anything fast",
      body: "Paste anywhere with ⌘V, drop files onto the page, or use Add to type a link or a note.",
    },
    organize: {
      title: "Keep it organized",
      body: "Group things into collections, add tags, and drag cards to move them. Smart views save a filter you use often.",
    },
    find: {
      title: "Find it again",
      body: "Press / to search; typos and accents are fine. Press ⌘K for every command, J and K to move between cards, F to favorite and E to archive.",
    },
    canvas: {
      title: "Arrange on a canvas",
      body: "Switch a collection or the Inbox to canvas view to place cards freely, like a board.",
    },
    keep: {
      title: "Keep your things",
      body: "You're a guest, so your things live in this browser's session. Add your email to keep them and open them anywhere.",
    },
  },
};

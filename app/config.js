// App configuration. Safe to commit — no secrets here.
//
// syncUrl: leave empty for per-device saves (localStorage only). Set it to your
// deployed sync endpoint to make a kitchen name follow you across phone and
// computer. Deploy the one-file backend in app/sync/ (see app/sync/README.md).
//
// feedbackUrl: leave empty to keep reviews local. Set it to the feedback Worker
// in app/sync/feedback/ to create public GitHub issues from cook-mode reviews.
window.MEALS_CONFIG = {
  syncUrl: "",
  feedbackUrl: "https://meals-feedback.alejoacelas.workers.dev",
};

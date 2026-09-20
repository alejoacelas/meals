# Meals decisions

## Core decisions

### Optimize the actual meal constraints

- [Rank by the deciding criterion rather than averaging scores](#rank-by-the-deciding-criterion-rather-than-averaging-scores).
- [Count effort as active time, attention episodes and elapsed time](#count-effort-as-active-time-attention-episodes-and-elapsed-time).

### Separate research from experience

- [Only the user promotes ingredients or confirms a recipe was tried](#only-the-user-promotes-ingredients-or-confirms-a-recipe-was-tried).
- [Preserve authored overlays when rebuilding the app catalog](#preserve-authored-overlays-when-rebuilding-the-app-catalog).

### Keep optional services’ limits visible

- [Treat kitchen names as shared keys, not authentication](#treat-kitchen-names-as-shared-keys-not-authentication).
- [Keep local commands and public feedback explicit](#keep-local-commands-and-public-feedback-explicit).

## Details

### Rank by the deciding criterion rather than averaging scores

[README.md](README.md) defines nutrition, effort, availability and taste. Name the dominant criterion for each category and treat the rest as constraints or tie-breakers; spices earn their place through taste. Price is not an additional scoring principle.

### Count effort as active time, attention episodes and elapsed time

Keep basic-kitchen availability and widely stocked ingredients explicit. Do not make an apparently quick recipe depend on special equipment, several return visits or unlisted pantry extras. The core version must cook from the proven kit; label optional additions.

### Only the user promotes ingredients or confirms a recipe was tried

Ingredients retain candidates/ and proven/; recipes share one menu/ with a tried marker only after actual cooking. `f03d72c` removed a recipe split that no longer helped while preserving the ingredient distinction. A research score is not evidence of personal use.

### Preserve authored overlays when rebuilding the app catalog

[app/build.py](app/build.py) generates data from Markdown plus authored content overlays. [App documentation](app/README.md) records source hashes and committed generated artifacts so the static site can serve without a build. Edit source or overlays and rebuild; do not make generated data a competing authoring source.

### Treat kitchen names as shared keys, not authentication

The [optional sync service](app/sync/README.md) deliberately allows anyone knowing a kitchen name to read or overwrite its data. Keep private information out; without sync, state remains per-device. Do not imply account isolation merely because a kitchen name persists across devices.

### Keep local commands and public feedback explicit

The [app README](app/README.md) describes local command preview/apply behavior, not an implemented general model agent. Configured feedback files public GitHub issues with app context. Preserve that distinction before expanding command execution or including private information in feedback.

---
description: "Switch the active feature for this session. Usage: /work-on <feature-id>. All subsequent supercrew skill operations will target this feature."
disable-model-invocation: true
---

The user wants to switch the active feature for this session.

1. Check if the user provided a feature ID argument. If not, list available features from `.supercrew/features/` and ask them to choose.
2. Verify the feature directory `.supercrew/features/<feature-id>/` exists.
3. Read the feature's `meta.yaml`, `plan.md` progress, and last `log.md` entry.
4. Confirm to the user:

```
🔄 Switched active feature to: <feature-id>
📋 Title: <title>
🏷️ Status: <status> | Priority: <priority> | Progress: <progress>%

All supercrew skills will now operate on this feature.
```

5. For the rest of this session, treat this feature as the active feature for `update-status`, `sync-plan`, `log-progress`, and `managing-features` skills.

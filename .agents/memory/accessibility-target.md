---
name: Accessibility conformance target
description: User requires site-wide WCAG 2.2 work based on ALTCHA and UX/UI references; truthful verification boundaries.
---

The user asked to modify the entire website to WCAG 2.2 and explicitly said 「我需要完全符合」, supplying ALTCHA and plugin87/ux-ui-agent-skills as references. Work targets A+AA, consistent with the ALTCHA reference, not a visual redesign.

**Why:** Installing an accessible CAPTCHA or following a checklist does not establish whole-site conformance. This is a complete-flow requirement, including admin and third-party transaction steps, not just an axe score.

**How to apply:** Use W3C as authoritative when reference checklists simplify criteria. Never claim full conformance without all applicable criteria and complete flows verified. Record pending assistive-technology checks and third-party limitations explicitly. Banner preservation remains in scope; do not presume alt text alone resolves images-of-text requirements.

The user explicitly chose 「保留原圖，先記錄這項無障礙限制」 on 2026-10-11 after being offered accessible HTML banner text.

**Why:** Original banner preservation takes precedence over replacing their embedded text in this work. This is an acknowledged unresolved limitation, not a WCAG exception or acceptance of a conformance claim.

**How to apply:** Do not rebuild or replace banners without new authorization. Keep their text equivalents and record the unresolved images-of-text assessment in accessibility reporting.

Use the user's supplied “Meet an accessibility baseline” checklist for this project's UI work: semantic HTML, keyboard access, labels/alternatives, contrast, associated errors, accessible media/reduced motion, and correct ARIA/focus management.

**Why:** The user supplied the intended Skill directly after stopping the unrelated GitHub toolkit audit. That toolkit is not a prerequisite for this checklist.

**How to apply:** Apply these seven checks to UI changes and report specific verified passes and manual-review gaps. Do not lower the existing WCAG 2.2 A+AA target or treat checklist adoption as conformance.

For performance optimization, the user explicitly said 「不動圖片 修改其他的」 on 2026-10-11.

**Why:** The performance audit identified large images, but the user authorized only non-image optimization.

**How to apply:** Preserve all images, not just banners; do not resize, compress, replace, or adjust image loading without new permission. Optimize application code, styles and fonts instead, and be explicit that the remaining image payload can prevent LCP targets.

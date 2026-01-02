# Eddo Design Principles

A unified design philosophy for building a professional, craft-focused productivity application.

---

## Core Philosophy

### Quality Is the Strategy

Quality is not a tradeoff against speed. The best teams achieve both. When you hire craft-oriented people and give them autonomy, quality becomes the fastest path to differentiation.

**For Eddo**: Every interaction should feel considered. The spec is the baseline, not the finish line. Polish is not optional—it's the product.

### Design for Someone, Not Everyone

Generic design serves no one well. Know exactly who you're building for. Eddo targets productivity-focused individuals who appreciate GTD methodology, keyboard shortcuts, and tools that get out of the way.

**For Eddo**: Design for power users first. Make the common paths effortless, but don't dumb down for imaginary beginners.

### Every Pixel Communicates

Every element must earn its place. Decoration without purpose creates noise. Restraint is a skill. If removing something preserves meaning, remove it.

**For Eddo**: Audit every component. If it doesn't help the user complete a task or understand context, question its existence.

---

## Visual Design Principles

### 1. Hierarchy Through Contrast, Not Decoration

Don't rely on borders, backgrounds, or separators to distinguish elements. Use:

- **Font weight** (not just size)
- **Color saturation** (muted vs. vibrant)
- **Spacing** (proximity implies relationship)

```
❌ Bad:  Border around every card
✅ Good: Subtle shadow + spacing creates natural grouping
```

**For Eddo**: The Kanban columns should feel distinct through whitespace and typography, not heavy borders.

### 2. Limit Your Choices

Every design decision (color, font size, spacing) should come from a defined system:

- **5-7 font sizes** (not arbitrary pixels)
- **A spacing scale** (4, 8, 12, 16, 24, 32, 48, 64)
- **A cohesive color palette** with purpose-driven roles

**For Eddo**: Define design tokens. Stop using arbitrary Tailwind values. Create a system.

### 3. Typography Is 90% of Your Interface

Strong typography can carry a design. Weak typography breaks it.

Recommendations:

- Use **Inter** or a similar variable font
- Establish clear hierarchy: `text-xs` for metadata, `text-sm` for body, `text-base` for emphasis
- Line height: 1.5-1.6 for readability
- Letter spacing: slightly tighter for headings, normal for body

**For Eddo**: The current typography feels generic. Define a type scale with intentional rhythm.

### 4. Color With Purpose

Every color needs a job:

- **Primary**: CTAs, active states, focus indicators
- **Neutral**: Text, backgrounds, borders
- **Success/Warning/Error**: Semantic feedback only
- **Accent**: Sparingly, for delight

Dark mode isn't an afterthought—for productivity tools, it's often the default expectation.

**For Eddo**: Audit the color usage. Create a semantic color system. Dark mode should feel native, not inverted.

### 5. Whitespace Is a Feature

Proper whitespace usage boosts text comprehension by 20%. Generous spacing creates:

- Visual breathing room
- Clear content hierarchy
- Professional appearance
- Reduced cognitive load

**For Eddo**: Increase padding in cards, columns, and between sections. Let the content breathe.

---

## Interaction Design Principles

### 6. Every Interaction Deserves Feedback

Users should never wonder "did that work?" The invisible details make great interactions feel right. Provide feedback through:

- **State changes**: Hover, focus, active, disabled
- **Micro-animations**: Subtle transforms, opacity shifts
- **Skeleton loaders**: Better than spinners for perceived performance
- **Completion signals**: Checkmarks, color shifts, brief animations

**For Eddo**: Add hover states to all interactive elements. Animate todo completion. Pulse the active time-tracking indicator.

### 7. Motion With Intention

Animation should:

- **Guide attention** (where should I look next?)
- **Provide continuity** (this element moved, it didn't teleport)
- **Communicate state** (loading, success, error)
- **Feel natural** (ease-out for entrances, ease-in for exits)

Animation should NOT:

- Delay the user
- Exist purely for decoration
- Be longer than 200-300ms for UI transitions

**For Eddo**: Animate view transitions (kanban ↔ table). Add subtle card entrance animations. Keep durations tight.

### 8. Speed Is a Feature

Response time should be measured in milliseconds, not seconds. Perceived performance matters as much as actual performance:

- Optimistic UI updates (show success immediately, sync in background)
- Skeleton screens during data fetches
- Instant keyboard response
- No layout shifts during loading

**For Eddo**: Implement optimistic updates for todo actions. Use skeleton loaders instead of spinners.

### 9. Keyboard-First Design

Power users live on the keyboard. Every critical action should be:

- Accessible via shortcut
- Discoverable (show hints on hover or in command palette)
- Consistent with industry conventions

**For Eddo**: Implement a command palette (Cmd+K). Add shortcuts for add todo, complete, start/stop time tracking.

---

## Structural Principles

### 10. The Inverted-L Navigation

A proven pattern for productivity tools:

- **Sidebar**: Workspaces, navigation, global actions
- **Top bar**: Context-specific controls, filters, view toggles
- **Main content**: The actual work

This creates a stable frame while content changes.

**For Eddo**: Consider a collapsible sidebar for contexts/tags. Move filters to a persistent top bar.

### 11. Progressive Disclosure

Don't overwhelm with options. Reveal complexity as needed:

- **Level 1**: Primary actions visible
- **Level 2**: Secondary actions in menus/dropdowns
- **Level 3**: Advanced options in settings/modals

**For Eddo**: Hide advanced todo options (repeat, link) behind an expand action. Show what matters first.

### 12. Consistent Density

Information density should match the task:

- **High density**: Lists, tables, dashboards (more items visible)
- **Low density**: Creation flows, editing, reading

Don't mix densities randomly within the same view.

**For Eddo**: Kanban can be denser (more todos visible). Todo detail view should have more breathing room.

---

## Emotional Design Principles

### 13. Delight in the Details

Taste comes from craft. When you understand your craft deeply, you know what good looks like. Small moments of polish create irrational loyalty:

- A satisfying checkmark animation
- A clever empty state illustration
- A well-crafted loading message
- Easter eggs for power users

**For Eddo**: The ASCII logo is quirky but may feel amateur. Consider keeping it but pairing with refined UI polish elsewhere.

### 14. Trust Through Consistency

Every part of the product must deliver a quality experience. Every touchpoint reinforces (or undermines) trust:

- Consistent visual language across all states
- Predictable interaction patterns
- Reliable system behavior
- Professional error handling

**For Eddo**: Audit inconsistencies. Ensure buttons, cards, and interactions feel unified.

### 15. Make It Feel Inevitable

The best design feels obvious in retrospect. Users shouldn't marvel at your creativity—they should complete their tasks without friction. Great design means seeing the world through your own eyes, then translating that for others.

**For Eddo**: The goal is invisible design. Users should feel productive, not impressed.

---

## Implementation Priorities for Eddo

### Phase 1: Foundation

1. Define design tokens (colors, spacing, typography scale)
2. Implement dark mode as first-class citizen
3. Add consistent hover/focus states to all interactive elements
4. Increase whitespace throughout the interface

### Phase 2: Polish

5. Add micro-interactions (todo completion, time tracking pulse)
6. Implement skeleton loaders for data fetching
7. Refine Kanban card design (shadows, spacing, typography)
8. Add command palette (Cmd+K)

### Phase 3: Delight

9. Animate view transitions
10. Design meaningful empty states
11. Add keyboard shortcut hints
12. Consider collapsible sidebar navigation

---

## Reference Products

Study these for inspiration:

| Product      | Learn From                                            |
| ------------ | ----------------------------------------------------- |
| **Linear**   | Navigation, speed, keyboard shortcuts, polish         |
| **Notion**   | Flexible layouts, clean hierarchy, empty states       |
| **Things 3** | Minimalist todo UI, typography, completion animations |
| **Todoist**  | Date picker UX, quick-add interactions                |
| **Slack**    | Status indicators, real-time feedback                 |
| **Raycast**  | Command palette, keyboard-first design                |

---

## The Quality Test

Before shipping any design change, ask:

1. **Does this earn its place?** (no decoration for decoration's sake)
2. **Does this feel fast?** (perceived and actual performance)
3. **Is there feedback?** (every interaction acknowledged)
4. **Is this consistent?** (with the rest of the system)
5. **Would best-in-class products ship this?** (quality bar check)

If you can't answer yes to all five, iterate.

---

Quality doesn't mean perfection—it means direction.

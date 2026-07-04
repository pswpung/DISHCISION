# DISHCISION LINE Flex Message Design System

All Flex messages pushed to LINE must follow this design spec for visual consistency.

---

## Color Palette

| Hex | Usage |
|-----|-------|
| `#F58357` | Primary accent — header backgrounds, all button colors, score text >= 5, highlighted values |
| `#FFF5EB` | Light header background (creation flex, slot detail cards) |
| `#2B303B` | Dark header background (survey bubbles), dark text on light backgrounds |
| `#FFFFFF` | Text on colored (coral/dark) backgrounds |
| `#555555` | Body descriptive text |
| `#aaaaaa` | Labels, metadata, muted text, attendee names |
| `#333333` | Dark text for restaurant names, command labels |
| `#FFD700` | Gold for high scores (>= 8) |
| `#666666` | Grey for low scores (< 5) |
| `#dddddd` | Separator lines |
| `#4CAF50` | Green for success indicators (checkmarks, confirmed status) |
| `#EEEEEE` | Light separator lines |

---

## Header Pattern

```python
"header": {
    "type": "box",
    "layout": "vertical",
    "backgroundColor": "#F58357",   # coral for CTAs, #FFF5EB for light
    "paddingAll": "lg",
    "contents": [
        {"type": "text", "text": "📊 Label", "weight": "bold", "color": "#FFFFFF", "size": "sm"},
        {"type": "text", "text": meeting_name, "weight": "bold", "size": "xl", "color": "#FFFFFF", "wrap": True, "margin": "md"}
    ]
}
```

- Emoji/icon text: `size: "sm"`, `weight: "bold"`
- Title text: `size: "xl"`, `weight: "bold"`, `wrap: True`, `margin: "md"`
- On coral (`#F58357`) headers → text is `#FFFFFF`
- On light (`#FFF5EB`) headers → label `#F58357`, title `#2B303B`

---

## Body Layout

### Info rows
```python
{
    "type": "box",
    "layout": "baseline",
    "spacing": "sm",
    "contents": [
        {"type": "text", "text": "Label", "color": "#aaaaaa", "size": "sm", "flex": 2},
        {"type": "text", "text": value, "color": "#2B303B", "size": "sm", "flex": 4}
    ]
}
```

### Separators
```python
{"type": "separator", "margin": "md", "color": "#dddddd"}
```
- `margin` between sections: `"md"` or `"lg"`
- No `color` field uses LINE default

---

## Button Pattern

```python
{
    "type": "button",
    "style": "primary",        # "primary" (filled) or "secondary" (outlined)
    "height": "sm",
    "color": "#F58357",        # always coral
    "action": {
        "type": "uri",
        "label": "Button Text",
        "uri": url
    }
}
```

- All buttons use `#F58357` regardless of style
- `primary` = filled background, `secondary` = outlined

---

## Footer Pattern

```python
"footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [...],
    "flex": 0
}
```

---

## Score Color Convention

| Score | Color | Display |
|-------|-------|---------|
| >= 8 | `#FFD700` (gold) | Excellent match |
| >= 5 | `#F58357` (coral) | Good match |
| < 5 | `#666666` (grey) | Low match |

---

## Text Sizes

| Size | Usage |
|------|-------|
| `"xxs"` | Overflow counts, tiny metadata |
| `"xs"` | Labels, descriptions, secondary text |
| `"sm"` | Body text, info values |
| `"md"` | Emoji labels, mid-level headings |
| `"lg"` | Single-line section headers |
| `"xl"` | Meeting title in headers |

---

## Existing Functions

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `push_message_creation_flex` | `line_services.py` | 143 | Meeting created → "Add Preferences" |
| `push_message_all_declined_flex` | `line_services.py` | 289 | All declined → no action |
| `push_message_result_flex` | `line_services.py` | 331 | Suggestions ready / finalized → "See Suggestions & Vote" |
| `push_message_decision_summary_flex` | `line_services.py` | 1321 | All votes collected → "Review & Decide" |

---

## Adding a New Flex Message

1. Use the **Header Pattern** above with `backgroundColor: "#F58357"`
2. Use `#555555` for body text, `#aaaaaa` for labels
3. Use `#F58357` for all button colors
4. Follow the **Score Color Convention** for any numeric scores
5. Add the function to the **Existing Functions** table above

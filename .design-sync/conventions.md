# Retail OS Design System — build guide

A **shadcn/ui + Tailwind v4** system for retail / point-of-sale / merchant software.
Emerald primary over warm-stone neutrals. Build every screen from these components and
the token-backed utility classes below — do not hand-roll buttons, inputs, or cards.

## Setup

- The theme ships in `styles.css` (imported for you). It defines all tokens as CSS
  variables and maps them onto Tailwind utilities. Nothing else is needed to style.
- **Dark mode** is opt-in: add `class="dark"` (or `data-theme="dark"`) to a parent.
  Never hard-code light/dark colors — the tokens flip automatically.
- **Fonts**: Inter loads at runtime; `font-sans` is already the body default.
- A few components compose from parts (import the parts, they're all exported):
  - `Card` → `CardHeader` `CardTitle` `CardDescription` `CardAction` `CardContent` `CardFooter`
  - `Table` → `TableHeader` `TableBody` `TableFooter` `TableRow` `TableHead` `TableCell` `TableCaption`
  - `Tabs` → `TabsList` `TabsTrigger` `TabsContent`
  - `Dialog` → `DialogTrigger` `DialogContent` `DialogHeader` `DialogFooter` `DialogTitle` `DialogDescription` `DialogClose`
  - `Select` → `SelectTrigger` `SelectValue` `SelectContent` `SelectItem` `SelectGroup` `SelectLabel`
  - `DropdownMenu` → `DropdownMenuTrigger` `DropdownMenuContent` `DropdownMenuItem` `DropdownMenuLabel` `DropdownMenuSeparator` `DropdownMenuShortcut`
  - `Tooltip` → `TooltipTrigger` `TooltipContent` (self-provides context)
  - `Avatar` → `AvatarImage` `AvatarFallback`; `Alert` → `AlertTitle` `AlertDescription`

## Styling idiom — Tailwind utilities bound to semantic tokens

Style layout and surfaces with these utility families. **Always prefer the semantic
token classes over raw colors** (`bg-primary`, never `bg-emerald-600`) so light/dark and
re-theming just work:

| Concern | Use |
|---|---|
| Surfaces | `bg-background` `bg-card` `bg-muted` `bg-accent` `bg-popover` `bg-secondary` |
| Text | `text-foreground` `text-muted-foreground` `text-primary` `text-card-foreground` |
| Brand / status | `bg-primary` · `bg-success/15 text-success` · `bg-warning/15 text-warning-foreground` · `bg-destructive` |
| Lines / focus | `border` `border-border` `ring` `ring-ring/50` `divide-y` |
| Radius / depth | `rounded-md` `rounded-lg` `rounded-xl` · `shadow-xs` `shadow-sm` `shadow-md` |

**Layout is flex/grid first — this is a dense, responsive retail UI.** The shipped
stylesheet includes the full responsive layout toolkit so you can compose freely:

- **Flex rows that reflow**: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
  — the workhorse for toolbars, list rows, and action bars (stack on mobile, row on ≥sm).
- **Responsive product/metric grids**: `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4`.
- **Truncation & alignment in rows**: wrap flexible text in `min-w-0 truncate`; keep prices
  in `tabular-nums text-right` so columns align.
- Spacing scale `gap-*`/`p-*`/`px-*` (0,1,2,3,4,6,8…), sizing `w-full w-fit max-w-md size-*`,
  and responsive prefixes `sm: md: lg: xl:` are all available.

Money: render prices with the `Currency` component (integer minor units in) or
`formatMoney(...)`; always pair numeric columns with `tabular-nums`.

## Where the truth lives

Read `styles.css` (and its `@import`ed `_ds_bundle.css`) for the exact token set, and each
component's `*.prompt.md` for its props and composition. The preview cards show the
intended retail usage for every component.

## One idiomatic build — a checkout action bar

```tsx
<Card className="w-full max-w-md">
  <CardHeader>
    <CardTitle>Order #10428</CardTitle>
    <CardDescription>3 items · card</CardDescription>
    <CardAction><Badge variant="success">Paid</Badge></CardAction>
  </CardHeader>
  <CardContent className="space-y-2 text-sm">
    <div className="flex items-center justify-between">
      <span className="min-w-0 truncate text-muted-foreground">Subtotal</span>
      <span className="tabular-nums">$108.00</span>
    </div>
  </CardContent>
  <CardFooter className="flex flex-col gap-3 border-t sm:flex-row sm:justify-end">
    <Button variant="outline" className="sm:w-auto">Hold</Button>
    <Button className="sm:w-auto">Charge $125.28</Button>
  </CardFooter>
</Card>
```

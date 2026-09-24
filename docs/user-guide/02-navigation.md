# Navigation

## 1. What is Navigation?

Navigation is the header menu at the top of every public Springboard
page, the links sitting next to the SPRINGBOARD wordmark. Navigation
controls **only those links**, the words visitors click on and where
each one takes them. It has nothing to do with the articles, sections,
or categories those links might point at (see
[Understanding Springboard](01-understanding-springboard.md) if you
haven't read the note on this).

Menu items come in two kinds:

- A **group heading**, like **People & Culture**, **Company & Business**,
  or **Engagement & Community**. It isn't a link itself, clicking it
  opens a dropdown (on desktop) or expands a list (on mobile) showing its
  items underneath.
- A **child item** inside a group, or a **standalone item** that isn't in
  any group, like **Search**. Both are real links a visitor can click.

The current menu is three groups, each with its own items, plus Search
standing on its own outside every group:

- **People & Culture**, HR Corner, Staff Spotlight, Staff News,
  Healthline.
- **Company & Business**, Company News, Articles.
- **Engagement & Community**, Photos of the Quarter, Games.
- **Search**, standalone.

## 2. Why is it important?

The header menu is on every single page of the public site — it's the
one piece of navigation a visitor always has, no matter where they are.
If it's wrong, out of order, or points somewhere broken, every visitor
notices immediately. Because it's managed in the Admin rather than hard
into the code, an Editor or Admin can relabel a link, reorder the menu,
hide an item, or point "Search" somewhere new, without needing a
developer or a code deployment.

## 3. What can I do here?

| Capability | Contributor | Editor | Admin |
|---|:---:|:---:|:---:|
| View the Navigation list | ✅ (view only) | ✅ | ✅ |
| Add a navigation item | ❌ | ✅ | ✅ |
| Edit a navigation item | ❌ | ✅ | ✅ |
| Delete a navigation item | ❌ | ✅ | ✅ |
| Hide/show a navigation item | ❌ | ✅ | ✅ |
| Reorder navigation items | ❌ | ✅ | ✅ |

A Contributor doesn't even see **Navigation** as an option in the Admin's
top menu bar — it's hidden for that role. If you're an Editor or Admin,
you'll see it between **Publications** and **Activity**.

## 4. How do I use it?

Go to **Navigation** in the Admin menu.

Groups are listed first, each followed by its own child items indented
underneath, then any standalone items after them. Each row shows the
item's label, its destination, its position (`order`), and whether it's
internal or external.

### Add a new group heading

1. Click **New top-level item**.
2. Fill in **Label** (e.g. "Engagement & Community") and **Display
   order**. Leave **Group** as "None" and leave **URL** blank, a blank
   URL is what tells Springboard this row is a heading, not a link.
3. Click **Save**.

### Add a new item inside a group

1. Click **New item in a group**.
2. Choose which **Group** it belongs to.
3. Fill in **Label**, **URL** (required for an item inside a group), and
   **Display order**.
4. Click **Save**.

### Add a standalone item (not in any group)

Click **New top-level item**, leave **Group** as "None", and fill in a
real **URL**, this is what makes it a standalone link like Search rather
than a heading.

Every form also has:

- **External link**, tick this only if the URL leaves the Springboard
  site entirely (see below).
- **Visible**, leave ticked to show it right away, or untick to save it
  hidden for now.

### Edit an existing item

1. Click **Edit** on the row you want to change.
2. The same form opens, pre-filled with that item's current values.
3. Change whatever you need, then click **Save**.

### Hide an item without deleting it

Open **Edit** and untick **Visible**, then **Save**. The item disappears
from the public menu immediately but stays in this list, so you can bring
it back later with one click.

### Reorder the menu

Open **Edit** on an item and change its **Display order** number. Items
are shown left-to-right in ascending order (1, 2, 3, …). To swap two
items, give them each other's number.

### Delete an item

Click **Delete** on a row. For a standalone item or a child item,
Springboard will tell you nothing else depends on it and offer **Delete
anyway**. **Deleting a group heading also deletes every item inside
it**, Springboard tells you how many sub-items that would remove first,
so you can back out instead. Either way, deleting is permanent.

### Internal vs. external links, and "open in new tab"

- An **internal link** stays on the Springboard site — a page path like
  `/search`, or a same-page anchor like `/#people` (which jumps to a
  block already on the homepage). Leave **External link** unticked for
  these.
- An **external link** leaves the Springboard site entirely — e.g. a link
  to PHD Nigeria's main corporate site, or a partner's page. Tick
  **External link** for these, and enter the full address including
  `https://`.
- Only when **External link** is ticked does an **Open in new tab**
  option appear. Turn it on if the destination should open in a new
  browser tab rather than replacing the current one — the usual choice
  for a link that takes visitors away from Springboard, so they don't
  lose their place.

Every current item is internal, which is why "External link" and "Open
in new tab" don't show as ticked on any of them today. The eight child
items each go to their own listing page (e.g. Healthline goes to
`/healthline`, see [Categories](04-categories.md) for how a piece of
content ends up listed there), and Search goes to `/search`.

![The public search page, reached via the "Search" navigation item](images/02-public-search.png)

## 5. What happens on the public website?

Whatever is in this list, in this order, with **Visible** ticked, is
exactly what every visitor sees in the header. There's only one menu;
Springboard doesn't maintain a separate list for phones, on desktop a
group opens as a dropdown, on mobile the same group expands in place as
an accordion, same items, same order, different presentation. A hidden
item disappears from both instantly, and a reorder is visible on the
very next page load.

Editing Navigation **never** changes any article, section, or category —
it only changes which words appear in the menu and where they point.

## 6. Important things to know

- **Permissions.** Only Editors and Admins can add, edit, hide, reorder,
  or delete navigation items. A Contributor doesn't see the Navigation
  page in the menu at all.
- **Nothing outside Navigation depends on a navigation item.** No
  article, image, or contributor record references one, so deleting a
  standalone or child item is always safe from the rest of the system's
  point of view. Deleting a group heading is the one exception, it takes
  its child items with it (see "Delete an item" above). The other real
  risk either way is a dead link if you mistype a URL, or removing a way
  visitors expect to get somewhere.
- **A broken or wrong URL isn't caught automatically.** Springboard
  doesn't check that the address you type actually exists — double-check
  it before saving, especially for external links.
- **Visibility is immediate and has no in-between state.** There's no
  "draft" version of a navigation change — the moment you click Save, it
  goes live on the public menu.
- **This does not affect Sections or Categories.** Renaming or removing a
  Navigation item called "Insights" has zero effect on the Section or
  Category also called "Insights" — see
  [Understanding Springboard](01-understanding-springboard.md).

Next: [Sections](03-sections.md).

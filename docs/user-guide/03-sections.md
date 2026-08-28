# Sections

## 1. What is a Section?

A Section is a named block of content that appears on one specific
**Publication's** page. Springboard uses "Publication" to mean an issue
or drop of the magazine — right now there is one, called **Development
Preview**. That issue's page is broken into Sections — currently
**Insights**, **Culture**, **People**, and **Company News** — and each
Section shows the Content that's been assigned to it, as its own
titled block with a lead story and a "Recent Stories" grid underneath.

A Section always belongs to exactly one Publication. It is not a
site-wide thing the way Navigation or Categories are.

Publications have their own list in the Admin menu, described there in
its own words as *"Issues that group sections and content together."*
You don't need to manage Publications to use Sections day to day, but
it's worth knowing what a Section belongs to:

![The Publications list, showing "Development Preview" with its section and item counts](images/31-admin-publications.png)

## 2. Why is it important?

Sections are how one issue's worth of stories gets organized into a
readable page, instead of one long undifferentiated list. They give an
editor control over the *structure* of an issue — what topics it's
divided into, and in what order those topics appear — separately from
deciding what any individual story is *about* (that's what
[Categories](04-categories.md) are for).

## 3. What can I do here?

| Capability | Contributor | Editor | Admin |
|---|:---:|:---:|:---:|
| View the Sections list | ✅ (view only) | ✅ | ✅ |
| Create a section | ❌ | ✅ | ✅ |
| Edit a section | ❌ | ✅ | ✅ |
| Delete a section | ❌ | ✅ | ✅ |
| Assign content to a section | ✅ (on their own draft content) | ✅ (on any content) | ✅ |

A Contributor can pick a Section for content they're writing (in the
[Content](05-content.md) editor), but cannot create, rename, reorder, or
delete Sections themselves.

## 4. How do I use it?

Go to **Sections** in the Admin menu.

![The Sections page, listing Insights, Culture, People, and Company News, each tied to the Development Preview publication](images/30-admin-sections.png)

Each row shows the Section's title, its slug, which Publication it
belongs to, its display order, and how many pieces of Content currently
use it.

### Create a new section

1. Click **New section**.
2. Fill in:
   - **Title** — what readers see as the block heading on the issue page
     (e.g. "Culture").
   - **Slug** — a short, URL-safe identifier (lowercase letters, numbers,
     and hyphens only). Springboard uses this internally; it doesn't need
     to match the Title exactly, but keeping them close avoids confusion.
   - **Publication** — which issue this Section belongs to. Required —
     you can't create a Section until at least one Publication exists.
   - **Display order** — a number controlling where this block appears
     on the issue page relative to the others (lower numbers first).
3. Click **Save**.

![The "New section" form, with Title, Slug, Publication, and Display order fields](images/32-admin-sections-new-form.png)

### Edit or delete a section

Click **Edit** on a row to change its title, slug, publication, or
order. Click **Delete** to remove it — Springboard first tells you how
many pieces of Content currently use it (if any), since deleting a
Section doesn't delete that content; it just leaves those pieces without
a Section assigned.

## 5. What happens on the public website?

Each Section becomes one titled block on its Publication's page
(`/issues/development-preview`, for the current issue), in ascending
**Display order**. Within a block, the most relevant story gets a large
featured treatment, and the rest appear in a "Recent Stories" grid.

![The Development Preview issue page, showing the Insights, Culture, People, and Company News sections in order](images/05-public-issue.png)

## 6. Important things to know

- **Permissions.** Only Editors and Admins can create, edit, or delete
  Sections. Contributors can assign existing Sections to their own
  content, but can't manage the Sections themselves.
- **There is no separate "visible/hidden" toggle for a Section.** A
  Section shows up on the issue page automatically the moment it has at
  least one published (or scheduled-and-due) piece of Content assigned
  to it — and it automatically disappears the moment it has none. You
  don't need to hide an empty Section yourself; it happens on its own.
- **Deleting a Section never deletes Content.** Every piece of content
  that referenced it simply becomes "no section assigned" — it isn't
  removed from the site, and it stays wherever else it's shown (e.g. the
  homepage, if applicable). You'll need to give it a new Section from the
  Content editor if you want it to reappear on an issue page.
- **A Section is not a Category, and not a Navigation item.** Even when
  the names match (as "Insights" and "People" currently do across all
  three), they are separate records with no connection to one another —
  see [Understanding Springboard](01-understanding-springboard.md).
- **Ordering only affects the issue page.** Display order has no effect
  anywhere else on the site — not the homepage, not search results.

Next: [Categories](04-categories.md).

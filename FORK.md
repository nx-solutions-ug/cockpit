# This fork

`nx-solutions-ug/cockpit` is a fork of [quaresc/cockpit](https://github.com/quaresc/cockpit). It carries upstream
unchanged plus a few commits on `main`:

| Commit | Kind | What it does |
| --- | --- | --- |
| Herdr app: pin a block of your own in the sidebar's app strip | feature, meant for upstream | `spaces` entries `{name, child, label, icon, key}` show as icons in the Herdr app's sidebar and open that block of the `center` stack. Kept on the branch `sidebar-custom-apps` (upstream's `main` plus the feature commits only), the head of a pull request to upstream once it is agreed. |
| Herdr app: a block of your own fills itself back in and counts its badge unshown | feature, meant for upstream | A `spaces` entry's `mod` makes the sidebar add its block back to the `center` stack after `cockpit app install`; its `badge` command counts the badge while the block has not started. On `sidebar-custom-apps` too, after the commit above. |
| Herdr app: the sidebar shows each Claude session's context, status line and details | feature, fork or upstream undecided | Each agent row carries its status line and the context left (amber under 25%, red under 10%); its hover card and chevron show model, cost, turn and last activity; the 5h and 7d limits sit side by side. Not on `sidebar-custom-apps`. |
| Fork: updates from nx-solutions-ug/cockpit | fork only, never for upstream | `FORK.md`, and the places that name the repo updates come from: `install.sh`, `herdr/fetch-apps.sh`, `herdr/tui/update/src/lib.rs`, `herdr/tui/hub/src/feed/upgrade.rs`, `plugin/hooks/upkeep.ts`, `app/mods/cockpit/update.js`. |

Keep the fork-only commit last, so a rebase onto upstream replays the feature commits first and any conflict on the
repo name stays in one small commit.

## Remotes

```sh
git clone https://github.com/nx-solutions-ug/cockpit.git && cd cockpit
git remote add upstream https://github.com/quaresc/cockpit.git
```

## Taking upstream changes

```sh
git fetch upstream
git switch main && git rebase upstream/main        # or: git merge upstream/main
git switch sidebar-custom-apps && git rebase upstream/main
git push --force-with-lease origin main sidebar-custom-apps
```

A rebase keeps `main` as upstream plus our commits on top, and rewrites `main` (hence the force push); a merge leaves
`main`'s history as it is and adds a merge commit. Either works: pick one and stay with it. Upstream's release commits (`0.40.4 (#49)` and so on) bump every
version, so after taking one the fork is on upstream's version number.

## How an installation updates from the fork

What reaches an installed cockpit, and from where:

| Part | Comes from | Updated by |
| --- | --- | --- |
| `cockpit` binary, the herdr scripts, the Herdr app's layout and mod (`~/.local/share/cockpit`) | a release of this fork: `cockpit-apps-<version>-<target>.tar.gz` and the tag's sources | `install.sh` again (`update.sh` runs the installed copy), then `cockpit app install` |
| Claude Code plugin `cockpit@cockpit` | the marketplace `cockpit`, added from this repo | `claude plugin marketplace update cockpit && claude plugin update cockpit@cockpit` |
| "Cockpit X is out" notice | this fork's `main`: `plugin/.claude-plugin/plugin.json` and `CHANGELOG.md`, once the binary is a fork release; an upstream build watches upstream's `main` | the hub, every six hours |

Switching a machine over:

```sh
# the plugin
claude plugin marketplace remove cockpit
claude plugin marketplace add nx-solutions-ug/cockpit
claude plugin install cockpit@cockpit
# the binary, scripts, layout and mod: needs a release of this fork
curl -fsSL https://raw.githubusercontent.com/nx-solutions-ug/cockpit/main/install.sh | sh
```

Until this fork has a release, `install.sh` stops with "no release found" and changes nothing. In the meantime:

- The Herdr app half comes from a checkout of this fork's `main`. `cockpit app install` looks for `app/` beside the
  install's `herdr/` folder before the copy packed with the binary, so a link there makes every plain
  `cockpit app install` (`update.sh`, the doctor's fix, `/cockpit:setup`) take the checkout:

  ```sh
  ln -sn <checkout>/app ~/.local/share/cockpit/app
  ```

  `git pull` in the checkout, then `cockpit app install`, brings the fork's mod in. The next `install.sh` replaces the
  folder, link included, with the release's own `app/`.
- Put the fork's `install.sh` in place of the copy in `~/.local/share/cockpit`, so `update.sh` fails safely instead of
  installing upstream's binary and mod over the fork's.
- The binary is still upstream's build, so its "Cockpit X is out" notice follows upstream's releases: when one shows,
  its update fails as above. Take the release into the fork (below), then cut a fork release.

## Releases

A release is cut as upstream does it: run the `release` workflow (Actions, `workflow_dispatch`, patch/minor/major). It
opens a pull request bumping every version with its changelog section; merging it lets `publish.yml` tag the version
and attach the binaries. GitHub turns Actions off for a new fork: enable them first. Releasing the same number as an
upstream release that is not in the fork yet would make two different `vX.Y.Z`; release after taking upstream, on the
next number.

## After every `cockpit app install`

`cockpit app install` writes `layouts/cockpit.json` again from the release. A block of your own whose `spaces` entry
names its `mod` comes back by itself (the sidebar adds it to the `center` stack, `docs/configuration.md`, "A block of
your own in the Herdr app"); one without a `mod` has to be added again by hand. Don't restore an old copy of the file:
it would undo the release's own layout changes.
